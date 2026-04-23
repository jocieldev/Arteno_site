const crypto = require("node:crypto");
const {
    getMelhorEnvioOAuthConfig,
    buildAuthorizationUrl,
    exchangeAuthorizationCode,
    getStoredIntegration,
    getRequiredScopes,
    hasRequiredScopes,
    disconnectMelhorEnvio
} = require("../services/melhorEnvioOAuthService");
const { getMercadoPagoConfig } = require("../services/mercadoPagoService");

const STATE_COOKIE_NAME = "melhor_envio_oauth_state";

function getFrontendBaseUrl(req) {
    const configuredFrontendBaseUrl = String(process.env.FRONTEND_BASE_URL || "").trim().replace(/\/+$/, "");

    if (configuredFrontendBaseUrl) {
        return configuredFrontendBaseUrl;
    }

    const allowedCorsOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean);

    if (allowedCorsOrigins.length) {
        return allowedCorsOrigins[0];
    }

    return `${req.protocol}://${req.get("host")}`;
}

function buildFrontendAdminUrl(req, path, query = {}) {
    const baseUrl = getFrontendBaseUrl(req);
    const url = new URL(path, `${baseUrl}/`);

    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });

    return url.toString();
}

function buildPublicUrl(req, path) {
    return new URL(path, `${getFrontendBaseUrl(req)}/`).toString();
}

function buildStateCookie(value = "") {
    return [
        `${STATE_COOKIE_NAME}=${encodeURIComponent(value)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=900"
    ].join("; ");
}

function clearStateCookie() {
    return [
        `${STATE_COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0"
    ].join("; ");
}

function readCookieValue(req, name) {
    const rawCookie = String(req.headers.cookie || "");
    const cookieEntry = rawCookie
        .split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${name}=`));

    if (!cookieEntry) {
        return "";
    }

    return decodeURIComponent(cookieEntry.slice(name.length + 1));
}

function serializeIntegrationStatus(setting) {
    const config = getMelhorEnvioOAuthConfig();
    const grantedScopes = String(setting?.scope || config.scope || "").trim();

    return {
        isConfigured: Boolean(config.clientId && config.clientSecret && config.redirectUri && config.fromPostalCode),
        hasClientCredentials: Boolean(config.clientId && config.clientSecret),
        hasRedirectUri: Boolean(config.redirectUri),
        hasOriginPostalCode: Boolean(config.fromPostalCode),
        hasWebhookSecret: Boolean(config.webhookSecret),
        useSandbox: config.useSandbox,
        redirectUri: config.redirectUri,
        scope: grantedScopes,
        requiredScopes: getRequiredScopes(),
        hasRequiredScopes: hasRequiredScopes(grantedScopes),
        fromPostalCode: config.fromPostalCode,
        webhookUrl: config.webhookUrl,
        isConnected: Boolean(setting?.accessToken),
        connectedAccountName: setting?.accountName || "",
        connectedAccountEmail: setting?.accountEmail || "",
        expiresAt: setting?.expiresAt || null,
        lastUpdatedAt: setting?.updatedAt || null
    };
}

function maskSecret(value = "", { keepStart = 4, keepEnd = 4 } = {}) {
    const normalized = String(value || "").trim();

    if (!normalized) {
        return "";
    }

    if (normalized.length <= keepStart + keepEnd) {
        return normalized;
    }

    return `${normalized.slice(0, keepStart)}...${normalized.slice(-keepEnd)}`;
}

function normalizeUrl(value = "") {
    return String(value || "").trim().replace(/\/+$/, "");
}

function serializeMercadoPagoStatus(req) {
    const config = getMercadoPagoConfig();
    const webhookUrl = buildPublicUrl(req, "/api/integrations/mercado-pago/webhook");
    const notificationUrl = normalizeUrl(config.notificationUrl) || webhookUrl;

    return {
        provider: "mercado_pago",
        checkout: "payment_brick",
        mode: config.mode,
        environmentLabel: config.mode === "production" ? "Produção" : "Sandbox",
        isConfigured: config.isConfigured,
        isDevelopmentMode: !config.isConfigured,
        hasAccessToken: Boolean(config.accessToken),
        hasPublicKey: Boolean(config.publicKey),
        hasWebhookSecret: Boolean(config.webhookSecret),
        hasNotificationUrl: Boolean(config.notificationUrl),
        accessTokenPreview: maskSecret(config.accessToken, { keepStart: 10, keepEnd: 6 }),
        publicKeyPreview: maskSecret(config.publicKey, { keepStart: 12, keepEnd: 6 }),
        webhookSecretPreview: maskSecret(config.webhookSecret, { keepStart: 6, keepEnd: 4 }),
        notificationUrl,
        configuredNotificationUrl: normalizeUrl(config.notificationUrl),
        webhookUrl,
        notificationUrlMatchesWebhook: notificationUrl === webhookUrl,
        statementDescriptor: config.statementDescriptor || "",
        requiredEnvVars: [
            "MERCADO_PAGO_PUBLIC_KEY",
            "MERCADO_PAGO_ACCESS_TOKEN",
            "MERCADO_PAGO_NOTIFICATION_URL",
            "MERCADO_PAGO_WEBHOOK_SECRET"
        ]
    };
}

async function getMelhorEnvioStatus(_req, res) {
    try {
        const setting = await getStoredIntegration();
        return res.json(serializeIntegrationStatus(setting));
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Não foi possível carregar o status da integração."
        });
    }
}

function getMercadoPagoStatus(req, res) {
    try {
        return res.json(serializeMercadoPagoStatus(req));
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Não foi possível carregar o status do Mercado Pago."
        });
    }
}

async function startMelhorEnvioConnection(req, res) {
    try {
        const state = crypto.randomUUID();
        const authorizationUrl = buildAuthorizationUrl(state);

        res.setHeader("Set-Cookie", buildStateCookie(state));
        return res.redirect(authorizationUrl);
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Não foi possível iniciar a conexão com o Melhor Envio."
        });
    }
}

async function handleMelhorEnvioCallback(req, res) {
    const returnedState = String(req.query.state || "");
    const expectedState = readCookieValue(req, STATE_COOKIE_NAME);
    const returnedCode = String(req.query.code || "");
    const returnedError = String(req.query.error || "");

    res.setHeader("Set-Cookie", clearStateCookie());

    if (returnedError) {
        return res.redirect(buildFrontendAdminUrl(req, "/admin/integrations", {
            error: returnedError
        }));
    }

    if (!returnedCode) {
        return res.redirect(buildFrontendAdminUrl(req, "/admin/integrations", {
            error: "authorization_code_missing"
        }));
    }

    if (!expectedState || expectedState !== returnedState) {
        return res.redirect(buildFrontendAdminUrl(req, "/admin/integrations", {
            error: "state_invalid"
        }));
    }

    try {
        await exchangeAuthorizationCode(returnedCode);
        return res.redirect(buildFrontendAdminUrl(req, "/admin/integrations", {
            success: "connected"
        }));
    } catch (error) {
        return res.redirect(buildFrontendAdminUrl(req, "/admin/integrations", {
            error: error.message || "oauth_failed"
        }));
    }
}

async function disconnectMelhorEnvioConnection(_req, res) {
    try {
        await disconnectMelhorEnvio();
        return res.json({
            message: "Integração do Melhor Envio desconectada com sucesso."
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Não foi possível desconectar o Melhor Envio."
        });
    }
}

module.exports = {
    getMelhorEnvioStatus,
    getMercadoPagoStatus,
    startMelhorEnvioConnection,
    handleMelhorEnvioCallback,
    disconnectMelhorEnvioConnection
};
