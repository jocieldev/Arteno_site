const Order = require("../models/Order");
const { markCouponAsUsed } = require("../services/couponService");
const { sendPixPaymentInstructionsEmail } = require("../services/emailService");
const {
    createMercadoPagoPayment,
    isMercadoPagoReady,
    mapMercadoPagoStatusToOrderStatus
} = require("../services/mercadoPagoService");

const ORDER_STATUS_META = {
    payment_pending: { label: "Pagamento pendente", step: 1 },
    payment_confirmed: { label: "Pagamento confirmado", step: 2 },
    preparing: { label: "Em preparacao", step: 3 },
    shipped: { label: "Enviado", step: 4 },
    delivered: { label: "Entregue", step: 5 },
    cancelled: { label: "Cancelado", step: 0 }
};

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeStatus(value = "") {
    const normalized = normalizeText(value);
    return ORDER_STATUS_META[normalized] ? normalized : "payment_confirmed";
}

function normalizeEmail(value = "") {
    return normalizeText(value).toLowerCase();
}

function normalizePhone(value = "") {
    return String(value || "").replace(/\D/g, "");
}

function normalizeDocumentNumber(value = "") {
    return String(value || "").replace(/\D/g, "");
}

function normalizePaymentMethod(value = "") {
    const normalized = normalizeText(value).toLowerCase();
    return ["pix", "boleto", "card"].includes(normalized) ? normalized : "";
}

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

function buildCustomerOrderQuery(user = {}) {
    const userId = user?._id || null;
    const userEmail = String(user?.email || "").trim().toLowerCase();
    const filters = [];

    if (userId) {
        filters.push({ userId });
    }

    if (userEmail) {
        filters.push({
            userId: null,
            "customer.email": userEmail
        });
    }

    return filters.length ? { $or: filters } : { _id: null };
}

function resolveDevelopmentMode() {
    if (isMercadoPagoReady()) {
        return false;
    }

    if (process.env.NODE_ENV === "production") {
        return false;
    }

    return process.env.ALLOW_DEVELOPMENT_PAYMENTS === "true";
}

function getSupportedPendingPaymentMethods() {
    if (isMercadoPagoReady()) {
        return ["pix", "boleto"];
    }

    if (resolveDevelopmentMode()) {
        return ["pix", "boleto"];
    }

    return [];
}

function getPaymentExpiration(order = {}) {
    const expiresAt = normalizeText(order.payment?.details?.expiresAt);

    if (!expiresAt) {
        return {
            expiresAt: "",
            isExpired: false
        };
    }

    const timestamp = new Date(expiresAt).getTime();

    if (!Number.isFinite(timestamp)) {
        return {
            expiresAt,
            isExpired: false
        };
    }

    return {
        expiresAt,
        isExpired: timestamp <= Date.now()
    };
}

function hasPendingPaymentStatus(order = {}) {
    const paymentStatus = normalizeText(order.payment?.status).toLowerCase();

    return ["pending", "in_process", "authorized"].includes(paymentStatus);
}

function canRetryCustomerPayment(order = {}) {
    const orderStatus = normalizeText(order.orderStatus);
    const provider = normalizeText(order.payment?.provider || "mercado_pago");

    return provider === "mercado_pago"
        && ["payment_pending", "cancelled"].includes(orderStatus)
        && Number(order.totals?.total || 0) > 0;
}

function buildPaymentAction(order = {}) {
    const { expiresAt, isExpired } = getPaymentExpiration(order);

    return {
        canPayNow: canRetryCustomerPayment(order),
        isExpired,
        expiresAt,
        availableMethods: getSupportedPendingPaymentMethods()
    };
}

function serializeCustomerOrder(order) {
    const plainOrder = typeof order.toObject === "function" ? order.toObject() : { ...order };
    const normalizedStatus = normalizeStatus(plainOrder.orderStatus);

    return {
        _id: String(plainOrder._id),
        orderNumber: plainOrder.orderNumber || "",
        orderStatus: normalizedStatus,
        orderStatusLabel: ORDER_STATUS_META[normalizedStatus].label,
        statusHistory: Array.isArray(plainOrder.statusHistory) ? plainOrder.statusHistory : [],
        tracking: plainOrder.tracking || {},
        payment: {
            provider: String(plainOrder.payment?.provider || "").trim(),
            mode: String(plainOrder.payment?.mode || "").trim(),
            status: String(plainOrder.payment?.status || "").trim() || "approved",
            method: plainOrder.payment?.method || "",
            details: plainOrder.payment?.details || {}
        },
        paymentAction: buildPaymentAction(plainOrder),
        customer: plainOrder.customer || {},
        shippingAddress: plainOrder.shippingAddress || {},
        shippingIntegration: plainOrder.shippingIntegration || {},
        coupon: plainOrder.coupon || {},
        totals: plainOrder.totals || {},
        items: Array.isArray(plainOrder.items) ? plainOrder.items.map((item = {}) => ({
            slug: item.slug || "",
            name: item.name || "Produto",
            quantity: Number(item.quantity || 1),
            imageUrl: item.imageUrl || "/img/tabua-produto01.webp",
            personalizationName: item.personalizationName || "",
            selectedVariations: Array.isArray(item.selectedVariations) ? item.selectedVariations : [],
            personalizationPreviews: Array.isArray(item.personalizationPreviews) ? item.personalizationPreviews : [],
            price: Number(item.price || 0)
        })) : [],
        createdAt: plainOrder.createdAt,
        updatedAt: plainOrder.updatedAt
    };
}

function buildStatusHistoryEntry(status, note = "") {
    const normalizedStatus = normalizeStatus(status);

    return {
        status: normalizedStatus,
        label: ORDER_STATUS_META[normalizedStatus]?.label || "Atualizacao",
        note: normalizeText(note),
        createdAt: new Date()
    };
}

function buildDirectMercadoPagoFormData(paymentMethod, order = {}) {
    const customer = order.customer || {};
    const customerDocumentNumber = normalizeDocumentNumber(
        customer.documentNumber
        || order.payment?.details?.customerDocumentNumber
    );

    if (paymentMethod === "pix") {
        return {
            payment_method_id: "pix",
            installments: 1,
            payer: {
                email: normalizeEmail(customer.email),
                identification: {
                    type: "CPF",
                    number: customerDocumentNumber
                }
            }
        };
    }

    if (paymentMethod === "boleto") {
        return {
            payment_method_id: normalizeText(order.payment?.details?.paymentMethodId || "bolbradesco") || "bolbradesco",
            installments: 1,
            payer: {
                email: normalizeEmail(customer.email),
                identification: {
                    type: "CPF",
                    number: customerDocumentNumber
                }
            }
        };
    }

    return null;
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
                ? "Pagamento criado. Aguarde a confirmacao pelo Mercado Pago."
                : "O Mercado Pago retornou uma atualizacao para esta compra."
    };
}

function shouldReuseCurrentPendingPayment(order = {}, paymentMethod = "") {
    if (!hasPendingPaymentStatus(order)) {
        return false;
    }

    if (normalizePaymentMethod(order.payment?.method) !== normalizePaymentMethod(paymentMethod)) {
        return false;
    }

    const expiration = getPaymentExpiration(order);

    if (expiration.isExpired) {
        return false;
    }

    if (paymentMethod === "pix") {
        return Boolean(order.payment?.details?.qrCode || order.payment?.details?.qrCodeBase64);
    }

    if (paymentMethod === "boleto") {
        return Boolean(order.payment?.details?.boletoLine || order.payment?.details?.ticketUrl);
    }

    return false;
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
    const seed = String(orderNumber || "").replace(/\D/g, "").slice(-10).padStart(10, "0");
    return `23791.11125 ${seed.slice(0, 5)}.444440 55000.123456 7 999900000${seed}`;
}

function buildDevelopmentPendingDetails(order = {}, paymentMethod = "") {
    if (paymentMethod === "pix") {
        return {
            paymentMethodId: "pix",
            qrCode: buildPixCode(order.orderNumber, Number(order.totals?.total || 0)),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            instructions: "Escaneie o QR Code ou copie a chave Pix para pagar.",
            message: "Pix regenerado em modo de desenvolvimento."
        };
    }

    return {
        paymentMethodId: "bolbradesco",
        boletoLine: buildBoletoLine(order.orderNumber),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        instructions: "Use a linha digitavel para pagar o boleto.",
        message: "Boleto regenerado em modo de desenvolvimento."
    };
}

async function listCustomerOrders(req, res) {
    try {
        const orders = await Order.find(buildCustomerOrderQuery(req.user)).sort({ createdAt: -1 });

        return res.json({
            ok: true,
            orders: orders.map(serializeCustomerOrder)
        });
    } catch (_error) {
        return res.status(500).json({
            message: "Nao foi possivel carregar seus pedidos."
        });
    }
}

async function getCustomerOrderById(req, res) {
    try {
        const orderId = String(req.params.id || "").trim();

        if (!orderId) {
            return res.status(400).json({
                message: "Pedido invalido."
            });
        }

        const order = await Order.findOne({
            ...buildCustomerOrderQuery(req.user),
            _id: orderId
        });

        if (!order) {
            return res.status(404).json({
                message: "Pedido nao encontrado."
            });
        }

        return res.json({
            ok: true,
            order: serializeCustomerOrder(order)
        });
    } catch (_error) {
        return res.status(500).json({
            message: "Nao foi possivel carregar os detalhes do pedido."
        });
    }
}

async function retryCustomerOrderPayment(req, res) {
    try {
        const orderId = normalizeText(req.params.id);

        if (!orderId) {
            return res.status(400).json({
                message: "Pedido invalido."
            });
        }

        const order = await Order.findOne({
            ...buildCustomerOrderQuery(req.user),
            _id: orderId
        });

        if (!order) {
            return res.status(404).json({
                message: "Pedido nao encontrado."
            });
        }

        if (!canRetryCustomerPayment(order)) {
            return res.status(400).json({
                message: "Este pedido nao permite um novo pagamento no momento."
            });
        }

        const availableMethods = getSupportedPendingPaymentMethods();

        if (!availableMethods.length) {
            return res.status(503).json({
                message: "Pagamentos indisponiveis no momento. Tente novamente mais tarde."
            });
        }

        const requestedMethod = normalizePaymentMethod(req.body?.paymentMethod);
        const currentMethod = normalizePaymentMethod(order.payment?.method);
        const paymentMethod = requestedMethod || (availableMethods.includes(currentMethod) ? currentMethod : availableMethods[0]);

        if (!availableMethods.includes(paymentMethod)) {
            return res.status(400).json({
                message: "Selecione um metodo de pagamento valido para continuar."
            });
        }

        if (shouldReuseCurrentPendingPayment(order, paymentMethod)) {
            order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
            order.statusHistory.push(
                buildStatusHistoryEntry("payment_pending", "Cliente reabriu as instrucoes de pagamento pendente.")
            );
            await order.save();

            return res.json({
                ok: true,
                reusedPayment: true,
                message: "Pagamento pendente ainda valido. Mostrando as mesmas instrucoes.",
                order: serializeCustomerOrder(order)
            });
        }

        if (!isMercadoPagoReady()) {
            const devDetails = buildDevelopmentPendingDetails(order, paymentMethod);

            order.payment = {
                ...(order.payment || {}),
                provider: "mercado_pago",
                mode: "development",
                method: paymentMethod,
                status: "pending",
                details: {
                    ...(order.payment?.details || {}),
                    ...devDetails
                }
            };
            order.orderStatus = "payment_pending";
            order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
            order.statusHistory.push(
                buildStatusHistoryEntry("payment_pending", `Pagamento ${paymentMethod === "pix" ? "Pix" : "Boleto"} regenerado em modo de desenvolvimento.`)
            );
            await order.save();

            return res.json({
                ok: true,
                reusedPayment: false,
                message: "Novo pagamento gerado com sucesso.",
                order: serializeCustomerOrder(order)
            });
        }

        const formData = buildDirectMercadoPagoFormData(paymentMethod, order);

        if (!formData) {
            return res.status(400).json({
                message: "Nao foi possivel preparar os dados de pagamento para esse metodo."
            });
        }

        if (!formData?.payer?.identification?.number) {
            return res.status(400).json({
                message: "Este pedido nao possui CPF vinculado para gerar um novo pagamento. Fale com o suporte para regularizar."
            });
        }

        const nextRetrySequence = Number(order.payment?.details?.retrySequence || 0) + 1;
        const paymentResponse = await createMercadoPagoPayment({
            amount: Number(order.totals?.total || 0),
            description: `Pedido ${order.orderNumber}`,
            customer: {
                ...(order.customer || {}),
                documentNumber: order.customer?.documentNumber || ""
            },
            shippingAddress: order.shippingAddress || {},
            items: Array.isArray(order.items) ? order.items : [],
            orderNumber: order.orderNumber,
            formData,
            idempotencyKey: `order-retry:${order.orderNumber}:${paymentMethod}:${nextRetrySequence}`
        });

        const mappedMethod = mapMercadoPagoPaymentMethod(paymentResponse, paymentMethod);
        const mappedOrderStatus = mapMercadoPagoStatusToOrderStatus(paymentResponse.status);
        const paymentDetails = {
            ...(order.payment?.details || {}),
            ...extractMercadoPagoResultDetails(paymentResponse),
            retrySequence: nextRetrySequence
        };

        order.payment = {
            ...(order.payment || {}),
            provider: "mercado_pago",
            mode: paymentResponse.live_mode ? "production" : "sandbox",
            method: mappedMethod,
            status: normalizeText(paymentResponse.status) || "pending",
            details: paymentDetails
        };
        order.orderStatus = mappedOrderStatus;
        order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
        order.statusHistory.push(
            buildStatusHistoryEntry(mappedOrderStatus, `Cliente gerou novo pagamento usando ${mappedMethod === "pix" ? "Pix" : mappedMethod === "boleto" ? "Boleto" : "Cartao"}.`)
        );

        await markCouponAsUsedForConfirmedOrder(order);
        await order.save();

        if (mappedMethod === "pix" && order.customer?.email) {
            sendPixPaymentInstructionsEmail({
                toEmail: order.customer.email,
                toName: order.customer.name,
                orderNumber: order.orderNumber,
                amount: Number(order.totals?.total || 0),
                qrCode: paymentDetails.qrCode,
                qrCodeBase64: paymentDetails.qrCodeBase64,
                expiresAt: paymentDetails.expiresAt
            }).catch((emailError) => {
                console.error("Erro ao reenviar email do Pix:", emailError);
            });
        }

        return res.json({
            ok: true,
            reusedPayment: false,
            message: "Novo pagamento gerado com sucesso.",
            order: serializeCustomerOrder(order)
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Nao foi possivel gerar um novo pagamento para este pedido."
        });
    }
}

module.exports = {
    getCustomerOrderById,
    listCustomerOrders,
    retryCustomerOrderPayment
};
