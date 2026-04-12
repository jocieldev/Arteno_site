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

const STATE_COOKIE_NAME = "melhor_envio_oauth_state";

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
        return res.redirect(`/admin/integrations?error=${encodeURIComponent(returnedError)}`);
    }

    if (!returnedCode) {
        return res.redirect("/admin/integrations?error=authorization_code_missing");
    }

    if (!expectedState || expectedState !== returnedState) {
        return res.redirect("/admin/integrations?error=state_invalid");
    }

    try {
        await exchangeAuthorizationCode(returnedCode);
        return res.redirect("/admin/integrations?success=connected");
    } catch (error) {
        return res.redirect(`/admin/integrations?error=${encodeURIComponent(error.message || "oauth_failed")}`);
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
    startMelhorEnvioConnection,
    handleMelhorEnvioCallback,
    disconnectMelhorEnvioConnection
};
