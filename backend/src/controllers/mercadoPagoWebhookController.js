const Order = require("../models/Order");
const { markCouponAsUsed } = require("../services/couponService");
const {
    getMercadoPagoPayment,
    mapMercadoPagoStatusToOrderStatus,
    verifyMercadoPagoWebhookSignature
} = require("../services/mercadoPagoService");

const STATUS_LABELS = {
    payment_pending: "Pagamento pendente",
    payment_confirmed: "Pagamento confirmado",
    cancelled: "Cancelado"
};

function normalizeText(value = "") {
    return String(value || "").trim();
}

function buildPaymentMessage(payment = {}) {
    return normalizeText(
        payment.status_detail
        || payment.status
        || payment.transaction_details?.external_resource_url
        || "Atualização recebida do Mercado Pago."
    );
}

function extractPaymentDetails(payment = {}) {
    const transactionData = payment.point_of_interaction?.transaction_data || {};
    return {
        mercadoPagoPaymentId: payment.id || "",
        paymentMethodId: payment.payment_method_id || "",
        statusDetail: payment.status_detail || "",
        ticketUrl: payment.transaction_details?.external_resource_url || "",
        qrCode: transactionData.qr_code || "",
        qrCodeBase64: transactionData.qr_code_base64 || "",
        expiresAt: payment.date_of_expiration || "",
        paidAt: payment.date_approved || ""
    };
}

function hasCouponUsageBeenMarked(order = {}) {
    return Boolean(order.payment?.details?.couponUsageMarkedAt);
}

async function markCouponAsUsedForConfirmedOrder(order) {
    if (
        !order?.coupon?.couponId
        || hasCouponUsageBeenMarked(order)
        || normalizeText(order.orderStatus) !== "payment_confirmed"
        || normalizeText(order.payment?.status) !== "approved"
    ) {
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

async function handleMercadoPagoWebhook(req, res) {
    try {
        if (!verifyMercadoPagoWebhookSignature(req)) {
            return res.status(401).json({
                message: "Assinatura do webhook do Mercado Pago inválida."
            });
        }

        const paymentId = normalizeText(
            req.query?.["data.id"]
            || req.body?.data?.id
            || req.body?.id
        );

        if (!paymentId) {
            return res.status(202).json({
                ok: true,
                ignored: true
            });
        }

        const payment = await getMercadoPagoPayment(paymentId);
        const orderNumber = normalizeText(payment.external_reference);

        if (!orderNumber) {
            return res.status(202).json({
                ok: true,
                ignored: true
            });
        }

        const order = await Order.findOne({ orderNumber });

        if (!order) {
            return res.status(202).json({
                ok: true,
                ignored: true
            });
        }

        const nextOrderStatus = mapMercadoPagoStatusToOrderStatus(payment.status);
        const historyNote = buildPaymentMessage(payment);

        order.payment = {
            ...(order.payment || {}),
            provider: "mercado_pago",
            mode: payment.live_mode ? "production" : "sandbox",
            method: normalizeText(order.payment?.method || payment.payment_type_id || payment.payment_method_id),
            status: normalizeText(payment.status),
            details: {
                ...(order.payment?.details || {}),
                ...extractPaymentDetails(payment)
            }
        };
        order.orderStatus = nextOrderStatus;
        order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];

        const lastHistoryStatus = order.statusHistory.at(-1)?.status || "";

        if (lastHistoryStatus !== nextOrderStatus) {
            order.statusHistory.push({
                status: nextOrderStatus,
                label: STATUS_LABELS[nextOrderStatus] || "Pagamento atualizado",
                note: historyNote,
                createdAt: new Date()
            });
        }

        await markCouponAsUsedForConfirmedOrder(order);
        await order.save();

        return res.json({ ok: true });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Não foi possível processar o webhook do Mercado Pago."
        });
    }
}

module.exports = {
    handleMercadoPagoWebhook
};
