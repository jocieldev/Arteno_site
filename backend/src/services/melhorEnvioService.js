const crypto = require("node:crypto");
const {
    getMelhorEnvioOAuthConfig,
    getValidAçõessToken
} = require("./melhorEnvioOAuthService");

function ensureOriginPostalCode(config) {
    if (!config.fromPostalCode) {
        const error = new Error("Configure MELHOR_ENVIO_FROM_POSTAL_CODE no .env para calcular o frete.");
        error.status = 503;
        throw error;
    }
}

function formatMelhorEnvioValidationDetails(details) {
    const errorEntries = Object.entries(details?.errors || {});

    if (!errorEntries.length) {
        return "";
    }

    return errorEntries
        .map(([field, messages]) => {
            const normalizedMessages = (Array.isArray(messages) ? messages : [messages])
                .map((message) => String(message || "").trim())
                .filter(Boolean)
                .join(", ");

            return normalizedMessages
                ? `${String(field || "").trim()}: ${normalizedMessages}`
                : String(field || "").trim();
        })
        .filter(Boolean)
        .join(" | ");
}

async function requestMelhorEnvio(pathname, { method = "GET", body, headers = {} } = {}) {
    const config = getMelhorEnvioOAuthConfig();
    const token = await getValidAçõessToken();
    const response = await fetch(`${config.baseUrl}${pathname}`, {
        method,
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": config.userAgent,
            ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const responseText = await response.text();
    let parsedResponse = null;

    try {
        parsedResponse = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
        parsedResponse = null;
    }

    if (!response.ok) {
        const validationDetails = formatMelhorEnvioValidationDetails(parsedResponse);
        const error = new Error(
            parsedResponse?.message
            || parsedResponse?.error
            || "Não foi possível se comunicar com o Melhor Envio."
        );
        error.status = response.status || 502;
        error.details = parsedResponse || responseText;
        error.validationDetails = validationDetails;
        error.userMessage = validationDetails
            ? `${error.message} Campos rejeitados: ${validationDetails}`
            : error.message;
        throw error;
    }

    return parsedResponse;
}

async function requestMelhorEnvioRaw(pathname, { method = "GET", body, headers = {} } = {}) {
    const config = getMelhorEnvioOAuthConfig();
    const token = await getValidAçõessToken();

    return fetch(`${config.baseUrl}${pathname}`, {
        method,
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": config.userAgent,
            ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

async function quoteShipmentByProducts({ toPostalCode, products }) {
    const config = getMelhorEnvioOAuthConfig();
    ensureOriginPostalCode(config);

    const result = await requestMelhorEnvio("/api/v2/me/shipment/calculate", {
        method: "POST",
        body: {
            from: {
                postal_code: config.fromPostalCode
            },
            to: {
                postal_code: toPostalCode
            },
            products
        }
    });

    return Array.isArray(result) ? result : [];
}

async function trackShipmentByCode(trackingCode) {
    const sanitizedTrackingCode = String(trackingCode || "").trim().toUpperCase();

    if (!sanitizedTrackingCode) {
        const error = new Error("Código de rastreio invalido para consulta no Melhor Envio.");
        error.status = 400;
        throw error;
    }

    return requestMelhorEnvio(`/api/v2/me/shipment/tracking/${encodeURIComponent(sanitizedTrackingCode)}`);
}

function verifyMelhorEnvioWebhookSignature(rawBody = "", signature = "") {
    const config = getMelhorEnvioOAuthConfig();

    if (!config.webhookSecret) {
        return true;
    }

    const expected = crypto
        .createHmac("sha256", config.webhookSecret)
        .update(String(rawBody || ""))
        .digest("hex");

    const normalizedSignature = String(signature || "").replace(/^sha256=/i, "").trim();

    if (!normalizedSignature || normalizedSignature.length !== expected.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedSignature));
}

module.exports = {
    quoteShipmentByProducts,
    requestMelhorEnvio,
    requestMelhorEnvioRaw,
    trackShipmentByCode,
    verifyMelhorEnvioWebhookSignature
};
