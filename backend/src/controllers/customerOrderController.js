const Order = require("../models/Order");
const { isMercadoPagoReady } = require("../services/mercadoPagoService");
const {
    applyExpiredPaymentState,
    cleanupExpiredPendingOrders,
    getPaymentExpiration,
    shouldExpireOrderPayment,
    stripExpiredPaymentInstructions
} = require("../services/orderPaymentCleanupService");

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

function normalizePaymentMethod(value = "") {
    const normalized = normalizeText(value).toLowerCase();
    return ["pix", "card"].includes(normalized) ? normalized : "";
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
        return ["pix"];
    }

    if (resolveDevelopmentMode()) {
        return ["pix"];
    }

    return [];
}

function hasPendingPaymentStatus(order = {}) {
    const paymentStatus = normalizeText(order.payment?.status).toLowerCase();

    return ["pending", "in_process", "authorized"].includes(paymentStatus);
}

function canRetryCustomerPayment(order = {}) {
    const orderStatus = normalizeText(order.orderStatus);
    const provider = normalizeText(order.payment?.provider || "mercado_pago");

    return provider === "mercado_pago"
        && orderStatus === "payment_pending"
        && Number(order.totals?.total || 0) > 0;
}

function buildPaymentAction(order = {}) {
    const { expiresAt, isExpired } = getPaymentExpiration(order);
    const hasCurrentInstructions = shouldReuseCurrentPendingPayment(order, order.payment?.method || "");

    return {
        canPayNow: Boolean(canRetryCustomerPayment(order) && !isExpired && hasCurrentInstructions),
        isExpired,
        expiresAt,
        availableMethods: getSupportedPendingPaymentMethods()
    };
}

function serializeCustomerOrder(order) {
    const plainOrder = typeof order.toObject === "function" ? order.toObject() : { ...order };
    const normalizedStatus = normalizeStatus(plainOrder.orderStatus);
    const shouldHideExpiredInstructions = shouldExpireOrderPayment(plainOrder);
    const paymentStatus = shouldHideExpiredInstructions
        ? "expired"
        : (String(plainOrder.payment?.status || "").trim() || "approved");
    const paymentDetails = shouldHideExpiredInstructions
        ? stripExpiredPaymentInstructions(plainOrder.payment?.details || {})
        : (plainOrder.payment?.details || {});

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
            status: paymentStatus,
            method: plainOrder.payment?.method || "",
            details: paymentDetails
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

    return false;
}

async function listCustomerOrders(req, res) {
    try {
        await cleanupExpiredPendingOrders();
        const orders = await Order.find(buildCustomerOrderQuery(req.user)).sort({ createdAt: -1 });
        await Promise.all(orders.map((order) => applyExpiredPaymentState(order)));

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
        await cleanupExpiredPendingOrders();
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

        await applyExpiredPaymentState(order);

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
        await cleanupExpiredPendingOrders();
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

        await applyExpiredPaymentState(order);

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
            return res.json({
                ok: true,
                reusedPayment: true,
                message: "Pagamento pendente ainda valido. Mostrando as mesmas instrucoes.",
                order: serializeCustomerOrder(order)
            });
        }
        return res.status(400).json({
            message: "Este pagamento expirou ou nao possui mais instrucoes disponiveis."
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Nao foi possivel consultar o pagamento deste pedido."
        });
    }
}

module.exports = {
    getCustomerOrderById,
    listCustomerOrders,
    retryCustomerOrderPayment
};
