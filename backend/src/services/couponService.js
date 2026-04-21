const Coupon = require("../models/Coupon");
const Order = require("../models/Order");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeCode(value = "") {
    return normalizeText(value).toUpperCase();
}

function normalizePrice(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;
}

function isCouponWithinSchedule(coupon, referenceDate = new Date()) {
    const startsAt = coupon?.startsAt ? new Date(coupon.startsAt) : null;
    const endsAt = coupon?.endsAt ? new Date(coupon.endsAt) : null;

    if (startsAt && startsAt.getTime() > referenceDate.getTime()) {
        return false;
    }

    if (endsAt && endsAt.getTime() < referenceDate.getTime()) {
        return false;
    }

    return true;
}

async function validateCouponEligibility(coupon, subtotal) {
    if (!coupon) {
        const error = new Error("Cupom não encontrado.");
        error.status = 404;
        throw error;
    }

    if (!coupon.isActive) {
        const error = new Error("Este cupom está inativo no momento.");
        error.status = 400;
        throw error;
    }

    if (!isCouponWithinSchedule(coupon)) {
        const error = new Error("Este cupom está fora do período de validade.");
        error.status = 400;
        throw error;
    }

    const minSubtotal = normalizePrice(coupon.rules?.minSubtotal);

    if (minSubtotal > 0 && subtotal < minSubtotal) {
        const error = new Error(`Este cupom é válido apenas para compras a partir de R$ ${minSubtotal.toFixed(2).replace(".", ",")}.`);
        error.status = 400;
        throw error;
    }

    const maxUsesTotal = Number.parseInt(coupon.rules?.maxUsesTotal, 10);

    if (Number.isInteger(maxUsesTotal) && maxUsesTotal > 0) {
        const currentUsageCount = await Order.countDocuments({ "coupon.couponId": coupon._id });

        if (currentUsageCount >= maxUsesTotal) {
            const error = new Error("Este cupom atingiu o limite máximo de usos.");
            error.status = 400;
            throw error;
        }
    }
}

function buildAppliedCouponSnapshot(coupon, subtotal) {
    const normalizedSubtotal = normalizePrice(subtotal);
    const percentageOff = Math.max(1, Math.min(100, Number(coupon.percentageOff || 0)));
    const discountAmount = Number(((normalizedSubtotal * percentageOff) / 100).toFixed(2));

    return {
        couponId: coupon._id,
        code: normalizeCode(coupon.code),
        name: normalizeText(coupon.name),
        percentageOff,
        discountAmount,
        appliedAt: new Date(),
        rules: {
            minSubtotal: normalizePrice(coupon.rules?.minSubtotal),
            maxUsesTotal: Number.parseInt(coupon.rules?.maxUsesTotal, 10) || 0
        }
    };
}

async function previewCouponApplication(code, subtotal) {
    const normalizedCode = normalizeCode(code);

    if (!normalizedCode) {
        const error = new Error("Informe um código de cupom para continuar.");
        error.status = 400;
        throw error;
    }

    const coupon = await Coupon.findOne({ code: normalizedCode });
    await validateCouponEligibility(coupon, subtotal);

    return buildAppliedCouponSnapshot(coupon, subtotal);
}

async function markCouponAsUsed(couponId, usedAt = new Date()) {
    if (!couponId) {
        return;
    }

    await Coupon.findByIdAndUpdate(couponId, {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: usedAt }
    });
}

module.exports = {
    normalizeCode,
    previewCouponApplication,
    markCouponAsUsed
};
