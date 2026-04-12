const Order = require("../models/Order");
const { verifyMelhorEnvioWebhookSignature } = require("../services/melhorEnvioService");

const STATUS_LABELS = {
    payment_confirmed: "Pagamento confirmado",
    preparing: "Em preparação",
    shipped: "Enviado",
    delivered: "Entregue",
    cancelled: "Cancelado"
};

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeTrackingCode(value = "") {
    return normalizeText(value).toUpperCase();
}

function mapWebhookStatus(eventName = "", payload = {}) {
    const normalizedEvent = normalizeText(eventName).toLowerCase();
    const normalizedStatus = normalizeText(payload.status || payload.situaçãon || payload.description).toLowerCase();

    if (
        normalizedEvent.includes("delivered")
        || normalizedStatus.includes("entreg")
    ) {
        return "delivered";
    }

    if (
        normalizedEvent.includes("posted")
        || normalizedEvent.includes("shipped")
        || normalizedEvent.includes("released")
        || normalizedStatus.includes("postado")
        || normalizedStatus.includes("transito")
        || normalizedStatus.includes("rota")
        || normalizedStatus.includes("enviado")
    ) {
        return "shipped";
    }

    if (
        normalizedEvent.includes("cancel")
        || normalizedStatus.includes("cancel")
        || normalizedStatus.includes("devol")
    ) {
        return "cancelled";
    }

    return "preparing";
}

function buildHistoryNote(eventName = "", payload = {}) {
    return normalizeText(
        payload.description
        || payload.message
        || payload.details
        || eventName
    );
}

async function handleMelhorEnvioWebhook(req, res) {
    try {
        const signature = req.headers["x-me-signature"] || req.headers["x-melhorenvio-signature"] || "";

        if (!verifyMelhorEnvioWebhookSignature(req.rawBody || "", String(signature || ""))) {
            return res.status(401).json({
                message: "Assinatura do webhook do Melhor Envio inválida."
            });
        }

        const payload = req.body?.data || req.body?.resource || req.body || {};
        const eventName = normalizeText(req.body?.event || req.body?.event_name || payload.event || "");
        const trackingCode = normalizeTrackingCode(
            payload.tracking_code
            || payload.tracking
            || payload.code
        );

        if (!trackingCode) {
            return res.status(202).json({
                ok: true,
                ignored: true
            });
        }

        const order = await Order.findOne({ "tracking.code": trackingCode });

        if (!order) {
            return res.status(202).json({
                ok: true,
                ignored: true
            });
        }

        const nextStatus = mapWebhookStatus(eventName, payload);
        const nextLabel = STATUS_LABELS[nextStatus] || STATUS_LABELS.preparing;
        const historyNote = buildHistoryNote(eventName, payload);

        order.tracking = {
            ...(order.tracking || {}),
            code: trackingCode,
            carrier: normalizeText(payload.company || payload.carrier || order.tracking?.carrier || "Correios"),
            lastEvent: historyNote
        };

        if (nextStatus === "shipped" && !order.tracking.shippedAt) {
            order.tracking.shippedAt = new Date();
        }

        if (nextStatus === "delivered" && !order.tracking.deliveredAt) {
            order.tracking.deliveredAt = new Date();
        }

        if (order.orderStatus !== nextStatus) {
            order.orderStatus = nextStatus;
            order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
            order.statusHistory.push({
                status: nextStatus,
                label: nextLabel,
                note: historyNote,
                createdAt: new Date()
            });
        }

        await order.save();

        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Não foi possível processar o webhook do Melhor Envio."
        });
    }
}

module.exports = {
    handleMelhorEnvioWebhook
};
