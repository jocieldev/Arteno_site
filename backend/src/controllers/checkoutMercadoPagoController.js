const Order = require("../models/Order");
const Product = require("../models/Product");
const { previewCouponApplication, markCouponAsUsed } = require("../services/couponService");
const {
    buildMercadoPagoPublicConfig,
    createMercadoPagoPayment,
    isMercadoPagoReady,
    mapMercadoPagoStatusToOrderStatus
} = require("../services/mercadoPagoService");
const legacyCheckoutController = require("./checkoutController");

const ORDER_STATUS_LABELS = {
    payment_pending: "Pagamento pendente",
    payment_confirmed: "Pagamento confirmado",
    cancelled: "Cancelado"
};

function hasCouponUsageBeenMarked(order = {}) {
    return Boolean(order.payment?.details?.couponUsageMarkedAt);
}

function shouldMarkCouponAsUsed(order = {}) {
    return Boolean(
        order.coupon?.couponId
        && !hasCouponUsageBeenMarked(order)
        && (
            normalizeText(order.orderStatus) === "payment_confirmed"
            || normalizeText(order.payment?.status) === "approved"
        )
    );
}

async function markCouponAsUsedForConfirmedOrder(order) {
    if (!shouldMarkCouponAsUsed(order)) {
        return false;
    }

    const usedAt = new Date();
    await markCouponAsUsed(order.coupon.couponId, usedAt);
    order.payment = {
        ...(order.payment || {}),
        details: {
            ...(order.payment?.details || {}),
            couponUsageMarkedAt: usedAt.toISOString()
        }
    };

    return true;
}

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
        provider: normalizeText(option.provider || "melhor-envio"),
        serviceId,
        serviceName: normalizeText(option.serviceName || option.name || "Frete"),
        companyName: normalizeText(option.companyName || option.company || "Correios"),
        price: normalizePrice(option.price),
        deliveryTime: normalizeQuantity(option.deliveryTime || 1),
        dispatchDays: normalizeQuantity(option.dispatchDays || 0),
        distanceKm: normalizeSignedNumber(option.distanceKm, 0),
        estimatedDurationMinutes: normalizeQuantity(option.estimatedDurationMinutes || 0),
        deliveryWindowLabel: normalizeText(option.deliveryWindowLabel),
        originLabel: normalizeText(option.originLabel)
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

function serializeItem(item = {}) {
    const quantity = normalizeQuantity(item.quantity);
    const price = normalizePrice(item.price);
    const personalizationPreviews = Array.isArray(item.personalizationPreviews)
        ? item.personalizationPreviews
            .map((preview = {}) => ({
                name: normalizeText(preview.name) || "Prévia",
                textValue: normalizeText(preview.textValue),
                imageUrl: normalizeText(preview.imageUrl),
                textBaseXPercent: normalizeSignedNumber(preview.textBaseXPercent, 50),
                textBaseYPercent: normalizeSignedNumber(preview.textBaseYPercent, 50),
                textWidthPercent: normalizeSignedNumber(preview.textWidthPercent, 60),
                textFontSizePx: normalizeSignedNumber(preview.textFontSizePx, 28),
                referenceWidthPx: normalizeSignedNumber(preview.referenceWidthPx, 0),
                textColor: normalizeText(preview.textColor),
                textFontFamily: normalizeText(preview.textFontFamily),
                textFontWeight: normalizeText(preview.textFontWeight),
                textTransform: normalizeText(preview.textTransform),
                letterSpacingEm: normalizeSignedNumber(preview.letterSpacingEm, 0.04),
                textShadow: normalizeText(preview.textShadow),
                textRotationDeg: normalizeSignedNumber(preview.textRotationDeg, 0),
                textOffsetXPercent: normalizeSignedNumber(preview.textOffsetXPercent),
                textOffsetYPercent: normalizeSignedNumber(preview.textOffsetYPercent),
                textScalePercent: normalizeSignedNumber(preview.textScalePercent, 100) || 100,
                overlayImageUrl: normalizeText(preview.overlayImageUrl),
                overlayImagePublicId: normalizeText(preview.overlayImagePublicId),
                overlayImageStorageKey: normalizeText(preview.overlayImageStorageKey),
                overlayImageKind: normalizeText(preview.overlayImageKind),
                overlayBaseXPercent: normalizeSignedNumber(preview.overlayBaseXPercent, 50),
                overlayBaseYPercent: normalizeSignedNumber(preview.overlayBaseYPercent, 50),
                overlayBaseMaxWidthPercent: normalizeSignedNumber(preview.overlayBaseMaxWidthPercent, 34),
                overlayBaseMaxHeightPercent: normalizeSignedNumber(preview.overlayBaseMaxHeightPercent, 34),
                overlayBaseRotationDeg: normalizeSignedNumber(preview.overlayBaseRotationDeg, 0),
                overlayImageIsRound: Boolean(preview.overlayImageIsRound),
                overlayImageOffsetXPercent: normalizeSignedNumber(preview.overlayImageOffsetXPercent),
                overlayImageOffsetYPercent: normalizeSignedNumber(preview.overlayImageOffsetYPercent),
                overlayImageScalePercent: normalizeSignedNumber(preview.overlayImageScalePercent, 100) || 100
            }))
            .filter((preview) => (
                preview.imageUrl
                || preview.textValue
                || preview.overlayImageUrl
                || preview.overlayImageStorageKey
            ))
        : [];

    return {
        cartKey: normalizeText(item.cartKey),
        productId: normalizeText(item.productId || item._id),
        slug: normalizeText(item.slug),
        selectedVariations: normalizeSelectedVariations(item.selectedVariations),
        name: normalizeText(item.name) || "Produto",
        personalizationName: normalizeText(item.personalizationName),
        personalizationImageUrl: normalizeText(item.personalizationImageUrl),
        personalizationImagePublicId: normalizeText(item.personalizationImagePublicId),
        personalizationImageStorageKey: normalizeText(item.personalizationImageStorageKey),
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
        personalizationPreviews,
        imageUrl: normalizeText(item.imageUrl),
        price,
        quantity,
        lineTotal: Number((price * quantity).toFixed(2))
    };
}

async function buildCouponSummary(couponInput, subtotal) {
    const normalizedCode = normalizeText(couponInput?.code || couponInput?.couponCode);

    if (!normalizedCode) {
        return null;
    }

    return previewCouponApplication(normalizedCode, subtotal);
}

function buildStatusHistoryEntry(status, note = "") {
    const normalizedStatus = normalizeText(status) || "payment_pending";

    return {
        status: normalizedStatus,
        label: ORDER_STATUS_LABELS[normalizedStatus] || "Pagamento pendente",
        note: normalizeText(note),
        createdAt: new Date()
    };
}

function generateOrderNumber() {
    const dateToken = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const randomToken = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `ART-${dateToken}-${randomToken}`;
}

async function resolveCheckoutItemsFromCatalog(items = []) {
    const serializedItems = Array.isArray(items) ? items.map(serializeItem) : [];
    const productIds = Array.from(new Set(serializedItems.map((item) => normalizeText(item.productId)).filter(Boolean)));
    const slugs = Array.from(new Set(serializedItems.map((item) => normalizeText(item.slug)).filter(Boolean)));

    if (!serializedItems.length) {
        return [];
    }

    const filters = [];

    if (productIds.length) {
        filters.push({ _id: { $in: productIds } });
    }

    if (slugs.length) {
        filters.push({ slug: { $in: slugs } });
    }

    const products = await Product.find(filters.length === 1 ? filters[0] : { $or: filters });
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const productBySlug = new Map(products.map((product) => [normalizeText(product.slug), product]));

    return serializedItems.map((item) => {
        const product = (item.productId && productById.get(normalizeText(item.productId)))
            || (item.slug && productBySlug.get(normalizeText(item.slug)));

        if (!product || product.isActive === false || product.status === "draft") {
            const error = new Error(`O produto "${item.name || item.slug || "Produto"}" não está disponível para compra.`);
            error.status = 400;
            throw error;
        }

        let variationPriceDelta = 0;
        const authoritativeVariations = item.selectedVariations.map((selectedVariation = {}) => {
            const productVariation = (Array.isArray(product.variations) ? product.variations : []).find((variation) => (
                normalizeText(variation.id) === normalizeText(selectedVariation.variationId)
                || normalizeText(variation.name) === normalizeText(selectedVariation.variationName)
            ));

            if (!productVariation) {
                const error = new Error(`A variação "${selectedVariation.variationName || "Variação"}" não foi encontrada no produto "${product.name}".`);
                error.status = 400;
                throw error;
            }

            const productVariationItem = (Array.isArray(productVariation.items) ? productVariation.items : []).find((variationItem) => (
                normalizeText(variationItem.id) === normalizeText(selectedVariation.itemId)
                || normalizeText(variationItem.label) === normalizeText(selectedVariation.itemLabel)
            ));

            if (!productVariationItem) {
                const error = new Error(`A opção "${selectedVariation.itemLabel || "Selecionada"}" não existe mais no produto "${product.name}".`);
                error.status = 400;
                throw error;
            }

            const variationPrice = productVariationItem.price === null || productVariationItem.price === undefined
                ? null
                : normalizePrice(productVariationItem.price);

            if (variationPrice !== null) {
                variationPriceDelta += variationPrice;
            }

            return {
                variationId: normalizeText(productVariation.id),
                variationType: normalizeText(productVariation.type),
                variationName: normalizeText(productVariation.name),
                itemId: normalizeText(productVariationItem.id),
                itemLabel: normalizeText(productVariationItem.label),
                colorHex: normalizeText(productVariationItem.colorHex),
                price: variationPrice,
                imageUrl: normalizeText(productVariationItem.imageUrl),
                previewImageUrl: normalizeText(productVariationItem.previewImageUrl)
            };
        });

        const unitPrice = Number((normalizePrice(product.price) + variationPriceDelta).toFixed(2));

        return {
            ...item,
            productId: String(product._id),
            slug: normalizeText(product.slug),
            name: normalizeText(product.name),
            imageUrl: normalizeText(item.imageUrl || product.imageUrl),
            selectedVariations: authoritativeVariations,
            price: unitPrice,
            lineTotal: Number((unitPrice * normalizeQuantity(item.quantity)).toFixed(2))
        };
    });
}

function extractMercadoPagoResultDetails(paymentResponse = {}) {
    const transactionData = paymentResponse.point_of_interaction?.transaction_data || {};
    const barcode = paymentResponse.barcode || {};

    return {
        mercadoPagoPaymentId: paymentResponse.id || "",
        paymentMethodId: paymentResponse.payment_method_id || "",
        ticketUrl: paymentResponse.transaction_details?.external_resource_url || "",
        qrCode: transactionData.qr_code || "",
        qrCodeBase64: transactionData.qr_code_base64 || "",
        boletoLine: barcode.content || transactionData.barcode_content || "",
        expiresAt: paymentResponse.date_of_expiration || "",
        paidAt: paymentResponse.date_approved || "",
        statusDetail: paymentResponse.status_detail || "",
        message: paymentResponse.status === "approved"
            ? "Pagamento aprovado pelo Mercado Pago."
            : paymentResponse.status === "pending"
                ? "Pagamento criado. Aguarde a confirmação pelo Mercado Pago."
                : "O Mercado Pago retornou uma atualização para esta compra."
    };
}

function mapMercadoPagoPaymentMethod(paymentResponse = {}, fallbackMethod = "") {
    const paymentMethodId = normalizeText(paymentResponse.payment_method_id || fallbackMethod).toLowerCase();
    const paymentTypeId = normalizeText(paymentResponse.payment_type_id).toLowerCase();

    if (paymentMethodId === "pix" || paymentTypeId === "bank_transfer") {
        return "pix";
    }

    if (paymentMethodId.startsWith("bol") || paymentTypeId === "ticket") {
        return "boleto";
    }

    return "card";
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

function buildCardSimulation(card = {}) {
    const sanitizedNumber = String(card.number || "").replace(/\D/g, "");
    const lastDigit = Number.parseInt(sanitizedNumber.slice(-1) || "0", 10);
    const approved = Number.isFinite(lastDigit) && lastDigit % 2 === 0;

    return approved
        ? {
            status: "approved",
            orderStatus: "payment_confirmed",
            details: {
                brand: "Mercado Pago Teste",
                lastFour: sanitizedNumber.slice(-4).padStart(4, "0"),
                authorizationCode: `DEV${String(Date.now()).slice(-6)}`,
                message: "Pagamento aprovado no modo de desenvolvimento."
            }
        }
        : {
            status: "rejected",
            orderStatus: "cancelled",
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

    return buildCardSimulation(card);
}

function resolveDevelopmentMode() {
    return !isMercadoPagoReady();
}

async function createCheckoutOrder(req, res) {
    try {
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        const paymentMethod = normalizeText(req.body.paymentMethod).toLowerCase();
        const isDevelopmentMode = resolveDevelopmentMode();
        const hasMercadoPagoIntegration = isMercadoPagoReady();
        const mercadoPagoPaymentInput = req.body.mercadoPagoPayment && typeof req.body.mercadoPagoPayment === "object"
            ? req.body.mercadoPagoPayment
            : null;

        if (!items.length) {
            return res.status(400).json({ message: "Seu carrinho está vazio." });
        }

        if (Order.db.readyState !== 1) {
            return res.status(503).json({
                message: "O banco de dados está indisponível no momento. Conecte o MongoDB antes de processar pedidos."
            });
        }

        if (!["pix", "card", "boleto"].includes(paymentMethod)) {
            return res.status(400).json({ message: "Selecione uma forma de pagamento válida." });
        }

        if (!hasMercadoPagoIntegration && paymentMethod === "card") {
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
            return res.status(400).json({ message: "Preencha nome, e-mail e telefone para continuar" });
        }

        if (!shippingAddress.zipCode || !shippingAddress.street || !shippingAddress.number || !shippingAddress.neighborhood || !shippingAddress.city || !shippingAddress.state) {
            return res.status(400).json({ message: "Preencha os dados principais do endereço de entrega." });
        }

        if (hasMercadoPagoIntegration && !mercadoPagoPaymentInput?.formData) {
            return res.status(400).json({
                message: "O formulÃ¡rio seguro do Mercado Pago nÃ£o foi enviado. Recarregue a pÃ¡gina e tente novamente."
            });
        }

        const shippingOption = normalizeShippingOption(req.body.shippingOption);

        if (!shippingOption.serviceId || shippingOption.price < 0) {
            return res.status(400).json({
                message: "Selecione uma opção de frete válida antes de finalizar a compra."
            });
        }

        const resolvedItems = await resolveCheckoutItemsFromCatalog(items);
        const subtotal = Number(resolvedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
        const appliedCoupon = await buildCouponSummary(req.body.coupon, subtotal);
        const discount = Number(appliedCoupon?.discountAmount || 0);
        const shipping = shippingOption.price;
        const total = Number((subtotal - discount + shipping).toFixed(2));
        const orderNumber = generateOrderNumber();
        const defaultOrderStatus = hasMercadoPagoIntegration ? "payment_pending" : "payment_confirmed";
        const defaultPaymentStatus = hasMercadoPagoIntegration ? "pending" : "approved";

        const order = await Order.create({
            orderNumber,
            userId: req.user?._id || null,
            customer,
            shippingAddress,
            items: resolvedItems.map(({ lineTotal, ...item }) => item),
            coupon: appliedCoupon || undefined,
            totals: { subtotal, discount, shipping, total },
            shippingIntegration: {
                provider: shippingOption.provider || "melhor-envio",
                serviceId: shippingOption.serviceId,
                serviceName: shippingOption.serviceName,
                companyName: shippingOption.companyName,
                quotePrice: shippingOption.price,
                deliveryTime: shippingOption.deliveryTime,
                dispatchDays: shippingOption.dispatchDays,
                distanceKm: shippingOption.distanceKm,
                estimatedDurationMinutes: shippingOption.estimatedDurationMinutes,
                deliveryWindowLabel: shippingOption.deliveryWindowLabel,
                originLabel: shippingOption.originLabel,
                status: shippingOption.provider === "motoboy" ? "awaiting_dispatch" : "customer_selected",
                purchasedAt: null,
                labelGeneratedAt: null,
                payload: {}
            },
            payment: {
                provider: "mercado_pago",
                mode: hasMercadoPagoIntegration ? "real" : "development",
                method: paymentMethod,
                status: defaultPaymentStatus,
                details: {}
            },
            orderStatus: defaultOrderStatus,
            tracking: {
                code: "",
                carrier: "Correios",
                shippedAt: null,
                deliveredAt: null
            },
            statusHistory: [
                buildStatusHistoryEntry(defaultOrderStatus, "Pedido criado no site.")
            ]
        });

        if (hasMercadoPagoIntegration) {
            if (!mercadoPagoPaymentInput?.formData) {
                return res.status(400).json({
                    message: "O formulário seguro do Mercado Pago não foi enviado. Recarregue a página e tente novamente."
                });
            }

            try {
                const paymentResponse = await createMercadoPagoPayment({
                    amount: total,
                    description: `Pedido ${orderNumber}`,
                    customer,
                    shippingAddress,
                    items: resolvedItems,
                    orderNumber,
                    formData: mercadoPagoPaymentInput.formData
                });
                const mappedMethod = mapMercadoPagoPaymentMethod(paymentResponse, paymentMethod);
                const mappedOrderStatus = mapMercadoPagoStatusToOrderStatus(paymentResponse.status);
                const paymentDetails = {
                    ...extractMercadoPagoResultDetails(paymentResponse),
                    additionalData: mercadoPagoPaymentInput.additionalData || {}
                };

                order.payment = {
                    provider: "mercado_pago",
                    mode: paymentResponse.live_mode ? "production" : "sandbox",
                    method: mappedMethod,
                    status: normalizeText(paymentResponse.status) || "pending",
                    details: paymentDetails
                };
                order.orderStatus = mappedOrderStatus;
                order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
                order.statusHistory.push(
                    buildStatusHistoryEntry(mappedOrderStatus, paymentDetails.message || "Pagamento criado no Mercado Pago.")
                );
                await markCouponAsUsedForConfirmedOrder(order);
                await order.save();

                return res.status(201).json({
                    ok: true,
                    isDevelopmentMode: false,
                    order: {
                        orderNumber,
                        status: mappedOrderStatus,
                        totals: { subtotal, discount, shipping, total },
                        coupon: appliedCoupon || null,
                        shippingOption,
                        customer
                    },
                    payment: {
                        provider: "mercado_pago",
                        method: mappedMethod,
                        status: order.payment.status,
                        details: paymentDetails
                    }
                });
            } catch (error) {
                order.payment = {
                    ...(order.payment || {}),
                    provider: "mercado_pago",
                    mode: "real",
                    method: paymentMethod,
                    status: "error",
                    details: {
                        message: error.message,
                        details: error.details || null
                    }
                };
                order.orderStatus = "payment_pending";
                order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
                order.statusHistory.push(
                    buildStatusHistoryEntry("payment_pending", "Falha ao criar o pagamento no Mercado Pago.")
                );
                await order.save();

                return res.status(error.status || 502).json({
                    message: error.message || "Não foi possível iniciar o pagamento no Mercado Pago."
                });
            }
        }

        if (!isDevelopmentMode) {
            return res.status(501).json({
                message: "A integração real com o Mercado Pago ainda não foi ativada neste ambiente."
            });
        }

        const paymentSimulation = buildPaymentSimulation({
            paymentMethod,
            card: req.body.card || {},
            orderNumber,
            total
        });

        order.payment = {
            provider: "mercado_pago",
            mode: "development",
            method: paymentMethod,
            status: paymentSimulation.status,
            details: paymentSimulation.details
        };
        order.orderStatus = paymentSimulation.orderStatus;
        order.statusHistory = [
            buildStatusHistoryEntry(paymentSimulation.orderStatus, "Pedido criado no site.")
        ];
        await markCouponAsUsedForConfirmedOrder(order);
        await order.save();

        return res.status(201).json({
            ok: true,
            isDevelopmentMode: true,
            order: {
                orderNumber,
                status: paymentSimulation.orderStatus,
                totals: { subtotal, discount, shipping, total },
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
    return res.json(buildMercadoPagoPublicConfig());
}

module.exports = {
    createCheckoutOrder,
    getCheckoutPublicConfig,
    previewCheckoutCoupon: legacyCheckoutController.previewCheckoutCoupon,
    uploadCheckoutPersonalizationImage: legacyCheckoutController.uploadCheckoutPersonalizationImage
};
