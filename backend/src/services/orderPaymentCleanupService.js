const Order = require("../models/Order");
const { cloudinary, ensureCloudinaryConfig } = require("../config/cloudinary");

const EXPIRED_ORDER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeText(value = "") {
    return String(value || "").trim();
}

function getPaymentExpiration(order = {}) {
    const expiresAt = normalizeText(order.payment?.details?.expiresAt);

    if (!expiresAt) {
        return {
            expiresAt: "",
            expiresAtTimestamp: Number.NaN,
            isExpired: false
        };
    }

    const expiresAtTimestamp = new Date(expiresAt).getTime();

    if (!Number.isFinite(expiresAtTimestamp)) {
        return {
            expiresAt,
            expiresAtTimestamp,
            isExpired: false
        };
    }

    return {
        expiresAt,
        expiresAtTimestamp,
        isExpired: expiresAtTimestamp <= Date.now()
    };
}

function hasPendingPaymentStatus(order = {}) {
    const paymentStatus = normalizeText(order.payment?.status).toLowerCase();
    return ["pending", "in_process", "authorized", "expired"].includes(paymentStatus);
}

function hasExpirablePaymentMethod(order = {}) {
    const paymentMethod = normalizeText(order.payment?.method).toLowerCase();
    return paymentMethod === "pix" || paymentMethod === "boleto";
}

function shouldExpireOrderPayment(order = {}) {
    const expiration = getPaymentExpiration(order);

    return Boolean(
        expiration.isExpired
        && hasPendingPaymentStatus(order)
        && hasExpirablePaymentMethod(order)
    );
}

function stripExpiredPaymentInstructions(details = {}) {
    return {
        ...details,
        qrCode: "",
        qrCodeBase64: "",
        boletoLine: "",
        ticketUrl: "",
        instructions: "",
        message: "Pagamento expirado."
    };
}

function buildExpiredPaymentHistoryEntry() {
    return {
        status: "payment_pending",
        label: "Pagamento expirado",
        note: "O prazo para pagamento venceu e as instrucoes foram removidas.",
        createdAt: new Date()
    };
}

async function applyExpiredPaymentState(order, { save = true } = {}) {
    if (!shouldExpireOrderPayment(order)) {
        return false;
    }

    const hasExpiredEntry = Array.isArray(order.statusHistory) && order.statusHistory.some((entry = {}) => (
        normalizeText(entry.label).toLowerCase() === "pagamento expirado"
    ));
    const alreadyExpired = normalizeText(order.payment?.status).toLowerCase() === "expired";
    const hasLiveInstructions = Boolean(
        normalizeText(order.payment?.details?.qrCode)
        || normalizeText(order.payment?.details?.qrCodeBase64)
        || normalizeText(order.payment?.details?.boletoLine)
        || normalizeText(order.payment?.details?.ticketUrl)
    );

    if (alreadyExpired && !hasLiveInstructions && hasExpiredEntry) {
        return false;
    }

    order.payment = {
        ...(order.payment || {}),
        status: "expired",
        details: stripExpiredPaymentInstructions(order.payment?.details || {})
    };

    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];

    if (!hasExpiredEntry) {
        order.statusHistory.push(buildExpiredPaymentHistoryEntry());
    }

    if (save) {
        await order.save();
    }

    return true;
}

async function deleteOrderAssets(order) {
    const publicIds = Array.from(new Set(
        (Array.isArray(order?.items) ? order.items : []).flatMap((item = {}) => {
            const previewIds = (Array.isArray(item.personalizationPreviews) ? item.personalizationPreviews : [])
                .map((preview = {}) => normalizeText(preview.overlayImagePublicId))
                .filter(Boolean);

            return [
                normalizeText(item.personalizationImagePublicId),
                ...previewIds
            ].filter(Boolean);
        })
    ));

    if (!publicIds.length) {
        return;
    }

    try {
        ensureCloudinaryConfig();
    } catch (_error) {
        return;
    }

    await Promise.all(publicIds.map((publicId) => cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true
    })));
}

function shouldDeleteExpiredOrder(order = {}) {
    if (!shouldExpireOrderPayment(order)) {
        return false;
    }

    const { expiresAtTimestamp } = getPaymentExpiration(order);

    return Number.isFinite(expiresAtTimestamp)
        && expiresAtTimestamp + EXPIRED_ORDER_RETENTION_MS <= Date.now();
}

async function cleanupExpiredPendingOrders() {
    if (Order.db.readyState !== 1) {
        return {
            deletedCount: 0
        };
    }

    const orders = await Order.find({
        "payment.details.expiresAt": { $exists: true, $ne: "" },
        "payment.method": { $in: ["pix", "boleto"] },
        "payment.status": { $in: ["pending", "in_process", "authorized", "expired"] }
    });

    let deletedCount = 0;

    for (const order of orders) {
        if (!shouldDeleteExpiredOrder(order)) {
            continue;
        }

        await deleteOrderAssets(order);
        await Order.deleteOne({ _id: order._id });
        deletedCount += 1;
    }

    return {
        deletedCount
    };
}

module.exports = {
    applyExpiredPaymentState,
    cleanupExpiredPendingOrders,
    getPaymentExpiration,
    shouldExpireOrderPayment,
    stripExpiredPaymentInstructions
};
