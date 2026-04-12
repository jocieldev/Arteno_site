const Order = require("../models/Order");

const ORDER_STATUS_META = {
    payment_pending: { label: "Pagamento pendente", step: 1 },
    payment_confirmed: { label: "Pagamento confirmado", step: 2 },
    preparing: { label: "Em preparação", step: 3 },
    shipped: { label: "Enviado", step: 4 },
    delivered: { label: "Entregue", step: 5 },
    cancelled: { label: "Cancelado", step: 0 }
};

function normalizeStatus(value = "") {
    const normalized = String(value || "").trim();
    return ORDER_STATUS_META[normalized] ? normalized : "payment_confirmed";
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
            price: Number(item.price || 0)
        })) : [],
        createdAt: plainOrder.createdAt,
        updatedAt: plainOrder.updatedAt
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
            message: "Não foi possível carregar seus pedidos."
        });
    }
}

async function getCustomerOrderById(req, res) {
    try {
        const orderId = String(req.params.id || "").trim();

        if (!orderId) {
            return res.status(400).json({
                message: "Pedido inválido."
            });
        }

        const order = await Order.findOne({
            ...buildCustomerOrderQuery(req.user),
            _id: orderId
        });

        if (!order) {
            return res.status(404).json({
                message: "Pedido não encontrado."
            });
        }

        return res.json({
            ok: true,
            order: serializeCustomerOrder(order)
        });
    } catch (_error) {
        return res.status(500).json({
            message: "Não foi possível carregar os detalhes do pedido."
        });
    }
}

module.exports = {
    getCustomerOrderById,
    listCustomerOrders
};
