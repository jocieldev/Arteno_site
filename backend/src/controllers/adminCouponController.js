const Coupon = require("../models/Coupon");
const Order = require("../models/Order");
const { normalizeCode } = require("../services/couponService");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizePositiveNumber(value, fallback = 0) {
    const normalized = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function normalizeInteger(value, fallback = 0) {
    const normalized = Number.parseInt(value, 10);
    return Number.isInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function normalizeBoolean(value) {
    if (typeof value === "boolean") {
        return value;
    }

    return value === "true" || value === "1" || value === 1 || value === "on";
}

function normalizeOptionalDate(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function buildCouponPayload(body = {}) {
    const code = normalizeCode(body.code);
    const name = normalizeText(body.name);
    const percentageOff = normalizePositiveNumber(body.percentageOff, 0);
    const startsAt = normalizeOptionalDate(body.startsAt);
    const endsAt = normalizeOptionalDate(body.endsAt);

    if (!code) {
        const error = new Error("Informe o código do cupom.");
        error.status = 400;
        throw error;
    }

    if (!name) {
        const error = new Error("Informe o nome do cupom.");
        error.status = 400;
        throw error;
    }

    if (percentageOff <= 0 || percentageOff > 100) {
        const error = new Error("A porcentagem de desconto deve estar entre 1% e 100%.");
        error.status = 400;
        throw error;
    }

    if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
        const error = new Error("A data inicial do cupom não pode ser maior que a data final.");
        error.status = 400;
        throw error;
    }

    return {
        code,
        name,
        description: normalizeText(body.description),
        percentageOff,
        isActive: body.isActive === undefined ? true : normalizeBoolean(body.isActive),
        startsAt,
        endsAt,
        rules: {
            minSubtotal: normalizePositiveNumber(body.minSubtotal, 0),
            maxUsesTotal: normalizeInteger(body.maxUsesTotal, 0)
        }
    };
}

function serializeCoupon(coupon) {
    if (!coupon) {
        return coupon;
    }

    const plainCoupon = typeof coupon.toObject === "function" ? coupon.toObject() : { ...coupon };

    return {
        _id: String(plainCoupon._id),
        code: plainCoupon.code || "",
        name: plainCoupon.name || "",
        description: plainCoupon.description || "",
        percentageOff: Number(plainCoupon.percentageOff || 0),
        isActive: Boolean(plainCoupon.isActive),
        startsAt: plainCoupon.startsAt,
        endsAt: plainCoupon.endsAt,
        rules: {
            minSubtotal: Number(plainCoupon.rules?.minSubtotal || 0),
            maxUsesTotal: Number(plainCoupon.rules?.maxUsesTotal || 0)
        },
        usageCount: Number(plainCoupon.usageCount || 0),
        lastUsedAt: plainCoupon.lastUsedAt,
        createdAt: plainCoupon.createdAt,
        updatedAt: plainCoupon.updatedAt
    };
}

function serializeCouponOrder(order) {
    return {
        _id: String(order._id),
        orderNumber: order.orderNumber || "",
        customerName: order.customer?.name || "-",
        customerEmail: order.customer?.email || "-",
        total: Number(order.totals?.total || 0),
        discount: Number(order.totals?.discount || 0),
        createdAt: order.createdAt,
        orderStatus: order.orderStatus || "payment_confirmed"
    };
}

async function listAdminCoupons(_req, res) {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        const usageAggregation = await Order.aggregate([
            { $match: { "coupon.couponId": { $ne: null } } },
            {
                $group: {
                    _id: "$coupon.couponId",
                    orderCount: { $sum: 1 },
                    lastUsedAt: { $max: "$createdAt" }
                }
            }
        ]);
        const usageByCouponId = new Map(usageAggregation.map((entry) => [String(entry._id), entry]));

        return res.json(coupons.map((coupon) => {
            const serializedCoupon = serializeCoupon(coupon);
            const usage = usageByCouponId.get(serializedCoupon._id);

            if (!usage) {
                return serializedCoupon;
            }

            return {
                ...serializedCoupon,
                usageCount: Number(usage.orderCount || serializedCoupon.usageCount || 0),
                lastUsedAt: usage.lastUsedAt || serializedCoupon.lastUsedAt
            };
        }));
    } catch (_error) {
        return res.status(500).json({
            message: "Não foi possível carregar os cupons."
        });
    }
}

async function getAdminCouponById(req, res) {
    try {
        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).json({
                message: "Cupom não encontrado."
            });
        }

        const orders = await Order.find({ "coupon.couponId": coupon._id })
            .sort({ createdAt: -1 })
            .limit(50);

        return res.json({
            coupon: serializeCoupon(coupon),
            usage: {
                orderCount: orders.length,
                orders: orders.map(serializeCouponOrder)
            }
        });
    } catch (_error) {
        return res.status(400).json({
            message: "Não foi possível carregar o cupom."
        });
    }
}

async function createAdminCoupon(req, res) {
    try {
        const payload = buildCouponPayload(req.body);
        const existingCoupon = await Coupon.findOne({ code: payload.code });

        if (existingCoupon) {
            return res.status(400).json({
                message: "Já existe um cupom com esse código."
            });
        }

        const coupon = await Coupon.create(payload);
        return res.status(201).json(serializeCoupon(coupon));
    } catch (error) {
        return res.status(error.status || 400).json({
            message: error.message || "Não foi possível criar o cupom."
        });
    }
}

async function updateAdminCoupon(req, res) {
    try {
        const payload = buildCouponPayload(req.body);
        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).json({
                message: "Cupom não encontrado."
            });
        }

        const existingCoupon = await Coupon.findOne({
            code: payload.code,
            _id: { $ne: coupon._id }
        });

        if (existingCoupon) {
            return res.status(400).json({
                message: "Já existe outro cupom com esse código."
            });
        }

        coupon.code = payload.code;
        coupon.name = payload.name;
        coupon.description = payload.description;
        coupon.percentageOff = payload.percentageOff;
        coupon.isActive = payload.isActive;
        coupon.startsAt = payload.startsAt;
        coupon.endsAt = payload.endsAt;
        coupon.rules = payload.rules;

        await coupon.save();

        return res.json(serializeCoupon(coupon));
    } catch (error) {
        return res.status(error.status || 400).json({
            message: error.message || "Não foi possível atualizar o cupom."
        });
    }
}

module.exports = {
    listAdminCoupons,
    getAdminCouponById,
    createAdminCoupon,
    updateAdminCoupon
};
