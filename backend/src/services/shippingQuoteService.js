const crypto = require("node:crypto");

const QUOTE_TTL_MS = 15 * 60 * 1000;
const quoteSecret = String(process.env.CHECKOUT_SHIPPING_QUOTE_SECRET || "").trim()
    || crypto.randomBytes(32).toString("hex");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeZipCode(value = "") {
    return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function normalizeQuantity(value, fallback = 1) {
    const normalized = Number.parseInt(value, 10);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizePrice(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function normalizeSignedNumber(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
}

function buildCartFingerprint(items = []) {
    const normalized = (Array.isArray(items) ? items : [])
        .map((item = {}) => ({
            productId: normalizeText(item.productId || item._id),
            slug: normalizeText(item.slug),
            quantity: normalizeQuantity(item.quantity, 1)
        }))
        .filter((item) => item.productId || item.slug)
        .sort((left, right) => {
            const leftKey = `${left.productId}|${left.slug}|${left.quantity}`;
            const rightKey = `${right.productId}|${right.slug}|${right.quantity}`;
            return leftKey.localeCompare(rightKey);
        });

    return normalized
        .map((item) => `${item.productId || "-"}:${item.slug || "-"}:${item.quantity}`)
        .join(";");
}

function normalizeShippingOptionForQuote(option = {}) {
    return {
        provider: normalizeText(option.provider || "melhor-envio"),
        serviceId: normalizeText(option.serviceId || option.id),
        serviceName: normalizeText(option.serviceName || option.name || "Frete"),
        companyName: normalizeText(option.companyName || option.company || "Correios"),
        price: normalizePrice(option.price),
        deliveryTime: normalizeQuantity(option.deliveryTime, 1),
        dispatchDays: normalizeQuantity(option.dispatchDays, 0),
        distanceKm: normalizeSignedNumber(option.distanceKm, 0),
        estimatedDurationMinutes: normalizeSignedNumber(option.estimatedDurationMinutes, 0),
        deliveryWindowLabel: normalizeText(option.deliveryWindowLabel),
        originLabel: normalizeText(option.originLabel),
        productionDays: normalizeQuantity(option.productionDays, 0),
        totalDeliveryDays: normalizeQuantity(option.totalDeliveryDays, 0)
    };
}

function signManifest(manifest) {
    return crypto
        .createHmac("sha256", quoteSecret)
        .update(manifest)
        .digest("hex");
}

function buildManifest(payload) {
    return JSON.stringify(payload);
}

function encodeToken(payload) {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeToken(token = "") {
    try {
        const parsed = JSON.parse(
            Buffer.from(String(token || ""), "base64url").toString("utf8")
        );
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
        return null;
    }
}

function createCheckoutShippingQuoteToken({ zipCode, items = [], option = {}, expiresAt = "" }) {
    const normalizedOption = normalizeShippingOptionForQuote(option);
    const normalizedZipCode = normalizeZipCode(zipCode);
    const normalizedExpiresAt = normalizeText(expiresAt) || new Date(Date.now() + QUOTE_TTL_MS).toISOString();
    const payload = {
        v: 1,
        zipCode: normalizedZipCode,
        cartFingerprint: buildCartFingerprint(items),
        expiresAt: normalizedExpiresAt,
        option: normalizedOption
    };
    const signature = signManifest(buildManifest(payload));

    return encodeToken({
        ...payload,
        signature
    });
}

function verifyCheckoutShippingQuoteToken({ token = "", zipCode = "", items = [] }) {
    const decoded = decodeToken(token);

    if (!decoded) {
        return {
            ok: false,
            message: "A cotacao de frete nao pode ser validada. Calcule novamente o frete."
        };
    }

    const payload = {
        v: Number(decoded.v || 0),
        zipCode: normalizeZipCode(decoded.zipCode),
        cartFingerprint: normalizeText(decoded.cartFingerprint),
        expiresAt: normalizeText(decoded.expiresAt),
        option: normalizeShippingOptionForQuote(decoded.option || {})
    };
    const receivedSignature = normalizeText(decoded.signature);
    const expectedSignature = signManifest(buildManifest(payload));

    if (!receivedSignature || receivedSignature.length !== expectedSignature.length) {
        return {
            ok: false,
            message: "A cotacao de frete expirou. Recalcule para continuar."
        };
    }

    if (!crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) {
        return {
            ok: false,
            message: "A cotacao de frete foi alterada. Recalcule para continuar."
        };
    }

    const expectedZipCode = normalizeZipCode(zipCode);
    const expectedCartFingerprint = buildCartFingerprint(items);

    if (payload.zipCode !== expectedZipCode || payload.cartFingerprint !== expectedCartFingerprint) {
        return {
            ok: false,
            message: "A cotacao de frete nao corresponde ao pedido atual. Recalcule o frete."
        };
    }

    const expiresAtTimestamp = new Date(payload.expiresAt).getTime();

    if (!Number.isFinite(expiresAtTimestamp) || expiresAtTimestamp <= Date.now()) {
        return {
            ok: false,
            message: "A cotacao de frete expirou. Recalcule para continuar."
        };
    }

    return {
        ok: true,
        option: payload.option,
        expiresAt: payload.expiresAt
    };
}

module.exports = {
    createCheckoutShippingQuoteToken,
    verifyCheckoutShippingQuoteToken
};
