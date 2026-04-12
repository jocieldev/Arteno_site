const Order = require("../models/Order");
const { purchaseLabelForOrder, getLabelPdfForOrder } = require("../services/melhorEnvioOrderService");

const ORDER_STATUS_META = {
    payment_pending: "Pagamento pendente",
    payment_confirmed: "Pagamento confirmado",
    preparing: "Em preparação",
    shipped: "Enviado",
    delivered: "Entregue",
    cancelled: "Cancelado"
};

function normalizeStatus(value = "") {
    const normalized = String(value || "").trim();
    return ORDER_STATUS_META[normalized] ? normalized : "payment_confirmed";
}

function normalizeTrackingCode(value = "") {
    return String(value || "").trim().toUpperCase();
}

function buildStatusHistoryEntry(status, note = "") {
    const normalizedStatus = normalizeStatus(status);

    return {
        status: normalizedStatus,
        label: ORDER_STATUS_META[normalizedStatus] || "Pagamento confirmado",
        note: String(note || "").trim(),
        createdAt: new Date()
    };
}

function derivePaymentStatus(orderStatus) {
    switch (orderStatus) {
        case "payment_pending":
            return "pending";
        case "cancelled":
            return "cancelled";
        default:
            return "approved";
    }
}

function serializeOrder(order) {
    if (!order) {
        return order;
    }

    const plainOrder = typeof order.toObject === "function" ? order.toObject() : { ...order };

    return {
        ...plainOrder,
        orderStatus: normalizeStatus(plainOrder.orderStatus),
        payment: {
            ...(plainOrder.payment || {}),
            status: String(plainOrder.payment?.status || derivePaymentStatus(plainOrder.orderStatus)).trim() || "approved"
        }
    };
}

async function listAdminOrders(_req, res) {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        return res.json(orders.map(serializeOrder));
    } catch (_error) {
        return res.status(500).json({
            message: "Não foi possível carregar os pedidos."
        });
    }
}

async function getAdminOrderById(req, res) {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                message: "Pedido não encontrado."
            });
        }

        return res.json(serializeOrder(order));
    } catch (_error) {
        return res.status(400).json({
            message: "Não foi possível carregar o pedido."
        });
    }
}

async function updateAdminOrderStatus(req, res) {
    try {
        const orderStatus = normalizeStatus(req.body.orderStatus);
        const trackingCode = normalizeTrackingCode(req.body.trackingCode);
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                message: "Pedido não encontrado."
            });
        }

        const previousStatus = normalizeStatus(order.orderStatus);

        order.orderStatus = orderStatus;
        order.payment = {
            ...(order.payment || {}),
            status: derivePaymentStatus(orderStatus)
        };
        order.tracking = {
            ...(order.tracking || {}),
            carrier: "Correios",
            code: trackingCode
        };

        if (orderStatus === "shipped" && !order.tracking.shippedAt) {
            order.tracking.shippedAt = new Date();
        }

        if (orderStatus === "delivered" && !order.tracking.deliveredAt) {
            order.tracking.deliveredAt = new Date();
        }

        if (orderStatus !== "delivered") {
            order.tracking.deliveredAt = null;
        }

        if (orderStatus !== "shipped" && orderStatus !== "delivered") {
            order.tracking.shippedAt = null;
        }

        if (previousStatus !== orderStatus) {
            order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
            order.statusHistory.push(buildStatusHistoryEntry(orderStatus, "Status atualizado no painel admin."));
        }

        await order.save();

        return res.json(serializeOrder(order));
    } catch (_error) {
        return res.status(400).json({
            message: "Não foi possível atualizar o status do pedido."
        });
    }
}

async function purchaseAdminOrderShipping(req, res) {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                message: "Pedido não encontrado."
            });
        }

        if (!order.shippingIntegration?.serviceId) {
            return res.status(400).json({
                message: "Este pedido ainda não tem uma opção de frete escolhida pelo cliente."
            });
        }

        const result = await purchaseLabelForOrder(order, order.shippingIntegration.serviceId);
        const trackingCode = String(
            result.generateResponse?.tracking
            || result.generateResponse?.tracking_code
            || result.checkoutResponse?.tracking
            || result.checkoutResponse?.tracking_code
            || ""
        ).trim().toUpperCase();

        order.shippingIntegration = {
            ...(order.shippingIntegration || {}),
            provider: "melhor-envio",
            serviceId: result.selectedOption.serviceId,
            serviceName: result.selectedOption.serviceName,
            companyName: result.selectedOption.companyName,
            quotePrice: result.selectedOption.price,
            deliveryTime: result.selectedOption.deliveryTime,
            melhorEnvioCartId: result.cartOrderId,
            melhorEnvioOrderId: String(
                result.generateResponse?.id
                || result.checkoutResponse?.id
                || result.cartResponse?.id
                || ""
            ).trim(),
            melhorEnvioProtocol: String(
                result.checkoutResponse?.protocol
                || result.generateResponse?.protocol
                || ""
            ).trim(),
            status: "label_generated",
            purchasedAt: new Date(),
            labelGeneratedAt: new Date(),
            payload: {
                cart: result.cartResponse,
                checkout: result.checkoutResponse,
                generate: result.generateResponse
            }
        };

        if (trackingCode) {
            order.tracking = {
                ...(order.tracking || {}),
                code: trackingCode,
                carrier: result.selectedOption.companyName || order.tracking?.carrier || "Correios"
            };
        }

        order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
        order.statusHistory.push(buildStatusHistoryEntry("preparing", "Etiqueta comprada e gerada no Melhor Envio."));

        await order.save();

        return res.json({
            ok: true,
            message: "Frete comprado e etiqueta gerada com sucesso no Melhor Envio.",
            order: serializeOrder(order)
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Não foi possível comprar o frete e gerar a etiqueta."
        });
    }
}

async function downloadAdminOrderLabel(req, res) {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                message: "Pedido não encontrado."
            });
        }

        const result = await getLabelPdfForOrder(order);

        order.shippingIntegration = {
            ...(order.shippingIntegration || {}),
            status: order.shippingIntegration?.status || "label_generated",
            labelGeneratedAt: order.shippingIntegration?.labelGeneratedAt || new Date(),
            payload: {
                ...(order.shippingIntegration?.payload || {}),
                print: result.printResponsePayload,
                printUrl: result.printUrl
            }
        };

        await order.save();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${order.orderNumber || "etiqueta"}.pdf"`);
        return res.send(result.buffer);
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Não foi possível baixar a etiqueta deste pedido."
        });
    }
}

module.exports = {
    listAdminOrders,
    getAdminOrderById,
    updateAdminOrderStatus,
    purchaseAdminOrderShipping,
    downloadAdminOrderLabel
};
