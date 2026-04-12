const Order = require("../models/Order");
const { previewCouponApplication, markCouponAsUsed } = require("../services/couponService");
const { cloudinary, ensureCloudinaryConfig } = require("../config/cloudinary");

const ORDER_STATUS_LABELS = {
    payment_pending: "Pagamento pendente",
    payment_confirmed: "Pagamento confirmado",
    preparing: "Em preparação",
    shipped: "Enviado",
    delivered: "Entregue",
    cancelled: "Cancelado"
};

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeEmail(value = "") {
    return normalizeText(value).toLowerCase();
}

function normalizePhone(value = "") {
    return String(value || "").replace(/\D/g, "");
}

function normalizeZipCode(value = "") {
    return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function normalizePrice(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;
}

function normalizeSignedNumber(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizeQuantity(value) {
    const normalized = Number.parseInt(value, 10);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : 1;
}

function normalizeShippingOption(option = {}) {
    const serviceId = normalizeText(option.serviceId || option.id);

    return {
        serviceId,
        serviceName: normalizeText(option.serviceName || option.name || "Frete"),
        companyName: normalizeText(option.companyName || option.company || "Correios"),
        price: normalizePrice(option.price),
        deliveryTime: normalizeQuantity(option.deliveryTime || 1)
    };
}

function normalizeSelectedVariations(variations = []) {
    if (!Array.isArray(variations)) {
        return [];
    }

    return variations
        .map((variation = {}) => {
            const variationName = normalizeText(variation.variationName || variation.name);
            const itemLabel = normalizeText(variation.itemLabel || variation.label);

            if (!variationName || !itemLabel) {
                return null;
            }

            return {
                variationId: normalizeText(variation.variationId || variation.id),
                variationType: normalizeText(variation.variationType || variation.type),
                variationName,
                itemId: normalizeText(variation.itemId),
                itemLabel,
                colorHex: normalizeText(variation.colorHex),
                price: variation.price === "" || variation.price === null || variation.price === undefined
                    ? null
                    : normalizePrice(variation.price),
                imageUrl: normalizeText(variation.imageUrl),
                previewImageUrl: normalizeText(variation.previewImageUrl)
            };
        })
        .filter(Boolean);
}

function isDataImageUrl(value = "") {
    return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(String(value || "").trim());
}

async function uploadPersonalizationImageFile(file) {
    if (!file) {
        throw new Error("Selecione uma imagem para enviar.");
    }

    ensureCloudinaryConfig();

    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
        folder: "arteno/personalization/customer-uploads",
        resource_type: "image"
    });

    return {
        imageUrl: result.secure_url,
        imagePublicId: result.public_id
    };
}

async function uploadPersonalizationDataUrl(dataUrl) {
    ensureCloudinaryConfig();

    const result = await cloudinary.uploader.upload(String(dataUrl || "").trim(), {
        folder: "arteno/personalization/customer-uploads",
        resource_type: "image"
    });

    return {
        imageUrl: result.secure_url,
        imagePublicId: result.public_id
    };
}

function buildStatusHistoryEntry(status, note = "") {
    const normalizedStatus = normalizeText(status) || "payment_confirmed";

    return {
        status: normalizedStatus,
        label: ORDER_STATUS_LABELS[normalizedStatus] || "Pagamento confirmado",
        note: normalizeText(note),
        createdAt: new Date()
    };
}

function generateOrderNumber() {
    const dateToken = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const randomToken = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `ART-${dateToken}-${randomToken}`;
}

function buildPixCode(orderNumber, total) {
    const cents = Math.round(total * 100)
        .toString()
        .padStart(10, "0");

    return [
        "00020101021226850014br.gov.bcb.pix2563pix.mercadopago.com/dev/",
        orderNumber,
        `520400005303986540${cents}5802BR5907ARTENO6009SAOPAULO62070503***6304`
    ].join("");
}

function buildBoletoLine(orderNumber) {
    const seed = orderNumber.replace(/\D/g, "").slice(-10).padStart(10, "0");
    return `23791.11125 ${seed.slice(0, 5)}.444440 55000.123456 7 999900000${seed}`;
}

function resolveDevelopmentMode() {
    return process.env.MERCADO_PAGO_DEVELOPMENT_MODE !== "false"
        || !process.env.MERCADO_PAGO_PUBLIC_KEY
        || !process.env.MERCADO_PAGO_ACCESS_TOKEN;
}

function buildCardSimulation(card = {}) {
    const sanitizedNumber = String(card.number || "").replace(/\D/g, "");
    const lastDigit = Number.parseInt(sanitizedNumber.slice(-1) || "0", 10);
    const approved = Number.isFinite(lastDigit) && lastDigit % 2 === 0;

    if (approved) {
        return {
            status: "approved",
            orderStatus: "paid",
            details: {
                brand: "Mercado Pago Teste",
                lastFour: sanitizedNumber.slice(-4).padStart(4, "0"),
                authorizationCode: `DEV${String(Date.now()).slice(-6)}`,
                message: "Pagamento aprovado no modo de desenvolvimento."
            }
        };
    }

    return {
        status: "rejected",
        orderStatus: "payment_failed",
        details: {
            brand: "Mercado Pago Teste",
            lastFour: sanitizedNumber.slice(-4).padStart(4, "0"),
            message: "Pagamento recusado no modo de desenvolvimento."
        }
    };
}

function buildPaymentSimulation({ paymentMethod, card, orderNumber, total }) {
    if (paymentMethod === "pix") {
        return {
            status: "approved",
            orderStatus: "payment_confirmed",
            details: {
                qrCode: buildPixCode(orderNumber, total),
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                instructions: "Pedido confirmado automaticamente no modo de teste sem Mercado Pago conectado.",
                message: "Pagamento confirmado automaticamente no modo de teste."
            }
        };
    }

    if (paymentMethod === "boleto") {
        return {
            status: "approved",
            orderStatus: "payment_confirmed",
            details: {
                boletoLine: buildBoletoLine(orderNumber),
                expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                instructions: "Pedido confirmado automaticamente no modo de teste sem Mercado Pago conectado.",
                message: "Pagamento confirmado automaticamente no modo de teste."
            }
        };
    }

    const cardSimulation = buildCardSimulation(card);

    if (cardSimulation.status === "approved") {
        return cardSimulation;
    }

    return {
        status: "approved",
        orderStatus: "payment_confirmed",
        details: {
            ...cardSimulation.details,
            message: "Pagamento confirmado automaticamente no modo de teste."
        }
    };
}

function serializeItem(item = {}) {
    const quantity = normalizeQuantity(item.quantity);
    const price = normalizePrice(item.price);

    return {
        cartKey: normalizeText(item.cartKey),
        slug: normalizeText(item.slug),
        selectedVariations: normalizeSelectedVariations(item.selectedVariations),
        name: normalizeText(item.name) || "Produto",
        personalizationName: normalizeText(item.personalizationName),
        personalizationImageUrl: normalizeText(item.personalizationImageUrl),
        personalizationImagePublicId: normalizeText(item.personalizationImagePublicId),
        personalizationImageKind: normalizeText(item.personalizationImageKind),
        personalizationPreviewImageUrl: normalizeText(item.personalizationPreviewImageUrl),
        personalizationPreviewTextBaseXPercent: normalizeSignedNumber(item.personalizationPreviewTextBaseXPercent, 50),
        personalizationPreviewTextBaseYPercent: normalizeSignedNumber(item.personalizationPreviewTextBaseYPercent, 50),
        personalizationPreviewTextWidthPercent: normalizeSignedNumber(item.personalizationPreviewTextWidthPercent, 60),
        personalizationPreviewTextFontSizePx: normalizeSignedNumber(item.personalizationPreviewTextFontSizePx, 28),
        personalizationPreviewReferenceWidthPx: normalizeSignedNumber(item.personalizationPreviewReferenceWidthPx, 0),
        personalizationPreviewTextColor: normalizeText(item.personalizationPreviewTextColor),
        personalizationPreviewTextFontFamily: normalizeText(item.personalizationPreviewTextFontFamily),
        personalizationPreviewTextFontWeight: normalizeText(item.personalizationPreviewTextFontWeight),
        personalizationPreviewTextTransform: normalizeText(item.personalizationPreviewTextTransform),
        personalizationPreviewLetterSpacingEm: normalizeSignedNumber(item.personalizationPreviewLetterSpacingEm, 0.04),
        personalizationPreviewTextShadow: normalizeText(item.personalizationPreviewTextShadow),
        personalizationPreviewTextRotationDeg: normalizeSignedNumber(item.personalizationPreviewTextRotationDeg, 0),
        personalizationImageBaseXPercent: normalizeSignedNumber(item.personalizationImageBaseXPercent, 50),
        personalizationImageBaseYPercent: normalizeSignedNumber(item.personalizationImageBaseYPercent, 50),
        personalizationImageBaseMaxWidthPercent: normalizeSignedNumber(item.personalizationImageBaseMaxWidthPercent, 34),
        personalizationImageBaseMaxHeightPercent: normalizeSignedNumber(item.personalizationImageBaseMaxHeightPercent, 34),
        personalizationImageBaseRotationDeg: normalizeSignedNumber(item.personalizationImageBaseRotationDeg, 0),
        personalizationImageIsRound: Boolean(item.personalizationImageIsRound),
        personalizationTextOffsetXPercent: normalizeSignedNumber(item.personalizationTextOffsetXPercent),
        personalizationTextOffsetYPercent: normalizeSignedNumber(item.personalizationTextOffsetYPercent),
        personalizationTextScalePercent: normalizeSignedNumber(item.personalizationTextScalePercent, 100) || 100,
        personalizationImageOffsetXPercent: normalizeSignedNumber(item.personalizationImageOffsetXPercent),
        personalizationImageOffsetYPercent: normalizeSignedNumber(item.personalizationImageOffsetYPercent),
        personalizationImageScalePercent: normalizeSignedNumber(item.personalizationImageScalePercent, 100) || 100,
        imageUrl: normalizeText(item.imageUrl),
        price,
        quantity,
        lineTotal: Number((price * quantity).toFixed(2))
    };
}

async function persistCheckoutPersonalizationImages(items = []) {
    if (!Array.isArray(items) || !items.length) {
        return [];
    }

    return Promise.all(items.map(async (item = {}) => {
        if (item.personalizationImageKind !== "upload" || !isDataImageUrl(item.personalizationImageUrl)) {
            return item;
        }

        const uploadedImage = await uploadPersonalizationDataUrl(item.personalizationImageUrl);

        return {
            ...item,
            personalizationImageUrl: uploadedImage.imageUrl,
            personalizationImagePublicId: uploadedImage.imagePublicId
        };
    }));
}

function normalizeCouponInput(coupon = {}) {
    const safeCoupon = coupon && typeof coupon === "object" ? coupon : {};

    return {
        code: normalizeText(safeCoupon.code || safeCoupon.couponCode)
    };
}

async function buildCouponSummary(couponInput, subtotal) {
    const normalizedCoupon = normalizeCouponInput(couponInput);

    if (!normalizedCoupon.code) {
        return null;
    }

    return previewCouponApplication(normalizedCoupon.code, subtotal);
}

async function previewCheckoutCoupon(req, res) {
    try {
        const items = await persistCheckoutPersonalizationImages(
            Array.isArray(req.body.items) ? req.body.items.map(serializeItem) : []
        );

        if (!items.length) {
            return res.status(400).json({
                message: "Seu carrinho está vazio."
            });
        }

        const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
        const coupon = await buildCouponSummary(req.body.coupon || req.body, subtotal);

        if (!coupon) {
            return res.status(400).json({
                message: "Informe um cupom para validar."
            });
        }

        return res.json({
            ok: true,
            coupon,
            totals: {
                subtotal,
                discount: coupon.discountAmount,
                subtotalAfterDiscount: Number((subtotal - coupon.discountAmount).toFixed(2))
            }
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Não foi possível validar o cupom."
        });
    }
}

async function createCheckoutOrder(req, res) {
    try {
        const items = Array.isArray(req.body.items) ? req.body.items.map(serializeItem) : [];
        const paymentMethod = normalizeText(req.body.paymentMethod).toLowerCase();
        const isDevelopmentMode = resolveDevelopmentMode();

        if (!items.length) {
            return res.status(400).json({
                message: "Seu carrinho está vazio."
            });
        }

        if (!["pix", "card", "boleto"].includes(paymentMethod)) {
            return res.status(400).json({
                message: "Selecione uma forma de pagamento válida."
            });
        }

        if (paymentMethod === "card") {
            const cardNumber = String(req.body.card?.number || "").replace(/\D/g, "");
            const cardHolder = normalizeText(req.body.card?.holderName);
            const cardExpiry = normalizeText(req.body.card?.expiry);
            const cardCvv = String(req.body.card?.cvv || "").replace(/\D/g, "");

            if (cardNumber.length < 13 || !cardHolder || cardExpiry.length < 4 || cardCvv.length < 3) {
                return res.status(400).json({
                    message: "Preencha os dados principais do cartão para testar esse pagamento."
                });
            }
        }

        const customer = {
            name: normalizeText(req.body.customer?.name),
            email: normalizeEmail(req.body.customer?.email),
            phone: normalizePhone(req.body.customer?.phone)
        };

        const shippingAddress = {
            zipCode: normalizeZipCode(req.body.shippingAddress?.zipCode),
            street: normalizeText(req.body.shippingAddress?.street),
            number: normalizeText(req.body.shippingAddress?.number),
            neighborhood: normalizeText(req.body.shippingAddress?.neighborhood),
            city: normalizeText(req.body.shippingAddress?.city),
            state: normalizeText(req.body.shippingAddress?.state).toUpperCase(),
            complement: normalizeText(req.body.shippingAddress?.complement)
        };

        if (!customer.name || !customer.email || !customer.phone) {
            return res.status(400).json({
                message: "Preencha nome, e-mail e telefone para continuar"
            });
        }

        if (!shippingAddress.zipCode || !shippingAddress.street || !shippingAddress.number || !shippingAddress.neighborhood || !shippingAddress.city || !shippingAddress.state) {
            return res.status(400).json({
                message: "Preencha os dados principais do endereço de entrega."
            });
        }

        if (!isDevelopmentMode) {
            return res.status(501).json({
                message: "A integração real com o Mercado Pago ainda não foi ativada neste ambiente."
            });
        }

        const shippingOption = normalizeShippingOption(req.body.shippingOption);

        if (!shippingOption.serviceId || shippingOption.price < 0) {
            return res.status(400).json({
                message: "Selecione uma opção de frete válida antes de finalizar a compra."
            });
        }

        const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
        const appliedCoupon = await buildCouponSummary(req.body.coupon, subtotal);
        const discount = Number(appliedCoupon?.discountAmount || 0);
        const shipping = shippingOption.price;
        const total = Number((subtotal - discount + shipping).toFixed(2));
        const orderNumber = generateOrderNumber();
        const paymentSimulation = buildPaymentSimulation({
            paymentMethod,
            card: req.body.card || {},
            orderNumber,
            total
        });

        const orderPayload = {
            orderNumber,
            userId: req.user?._id || null,
            customer,
            shippingAddress,
            items: items.map(({ lineTotal, ...item }) => item),
            coupon: appliedCoupon || undefined,
            totals: {
                subtotal,
                discount,
                shipping,
                total
            },
            shippingIntegration: {
                provider: "melhor-envio",
                serviceId: shippingOption.serviceId,
                serviceName: shippingOption.serviceName,
                companyName: shippingOption.companyName,
                quotePrice: shippingOption.price,
                deliveryTime: shippingOption.deliveryTime,
                status: "customer_selected",
                purchasedAt: null,
                labelGeneratedAt: null,
                payload: {}
            },
            payment: {
                provider: "mercado_pago",
                mode: "development",
                method: paymentMethod,
                status: paymentSimulation.status,
                details: paymentSimulation.details
            },
            orderStatus: paymentSimulation.orderStatus,
            tracking: {
                code: "",
                carrier: "Correios",
                shippedAt: null,
                deliveredAt: null
            },
            statusHistory: [
                buildStatusHistoryEntry(paymentSimulation.orderStatus, "Pedido criado no site.")
            ]
        };

        if (Order.db.readyState === 1) {
            await Order.create(orderPayload);

            if (appliedCoupon?.couponId) {
                await markCouponAsUsed(appliedCoupon.couponId);
            }
        }

        return res.status(201).json({
            ok: true,
            isDevelopmentMode: true,
            order: {
                orderNumber,
                status: paymentSimulation.orderStatus,
                totals: {
                    subtotal,
                    discount,
                    shipping,
                    total
                },
                coupon: appliedCoupon || null,
                shippingOption,
                customer
            },
            payment: {
                provider: "mercado_pago",
                method: paymentMethod,
                status: paymentSimulation.status,
                details: paymentSimulation.details
            }
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Não foi possível finalizar a compra."
        });
    }
}

function getCheckoutPublicConfig(_req, res) {
    return res.json({
        provider: "mercado_pago",
        isDevelopmentMode: resolveDevelopmentMode(),
        hasPublicKey: Boolean(process.env.MERCADO_PAGO_PUBLIC_KEY),
        checkout: "payment_brick"
    });
}

async function uploadCheckoutPersonalizationImage(req, res) {
    try {
        const uploadedImage = await uploadPersonalizationImageFile(req.file);

        return res.status(201).json({
            ok: true,
            imageUrl: uploadedImage.imageUrl,
            imagePublicId: uploadedImage.imagePublicId
        });
    } catch (error) {
        return res.status(error.status || 400).json({
            message: error.message || "Nao foi possivel enviar a imagem."
        });
    }
}

module.exports = {
    createCheckoutOrder,
    getCheckoutPublicConfig,
    previewCheckoutCoupon,
    uploadCheckoutPersonalizationImage
};
