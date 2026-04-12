const IntegrationSetting = require("../models/IntegrationSetting");

const DEFAULT_MELHOR_ENVIO_BASE_URL = "https://melhorenvio.com.br";
const DEFAULT_MELHOR_ENVIO_SANDBOX_URL = "https://sandbox.melhorenvio.com.br";
const MELHOR_ENVIO_PROVIDER = "melhor-envio";
const DEFAULT_SCOPE = [
    "cart-read",
    "cart-write",
    "orders-read",
    "users-read",
    "shipping-calculate",
    "shipping-checkout",
    "shipping-companies",
    "shipping-generate",
    "shipping-preview",
    "shipping-print",
    "shipping-tracking",
    "ecommerce-shipping"
].join(" ");

function getRequiredScopes() {
    return DEFAULT_SCOPE.split(/\s+/).filter(Boolean);
}

function getMelhorEnvioBaseUrl() {
    const useSandbox = process.env.MELHOR_ENVIO_USE_SANDBOX === "true";
    const configuredBaseUrl = String(process.env.MELHOR_ENVIO_BASE_URL || "").trim();

    return (configuredBaseUrl || (useSandbox ? DEFAULT_MELHOR_ENVIO_SANDBOX_URL : DEFAULT_MELHOR_ENVIO_BASE_URL)).replace(/\/+$/, "");
}

function getMelhorEnvioOAuthConfig() {
    return {
        clientId: String(process.env.MELHOR_ENVIO_CLIENT_ID || "").trim(),
        clientSecret: String(process.env.MELHOR_ENVIO_CLIENT_SECRET || "").trim(),
        redirectUri: String(process.env.MELHOR_ENVIO_REDIRECT_URI || "").trim(),
        userAgent: String(process.env.MELHOR_ENVIO_USER_AGENT || "Arteno (suporte@arteno.local)").trim(),
        baseUrl: getMelhorEnvioBaseUrl(),
        fromPostalCode: String(process.env.MELHOR_ENVIO_FROM_POSTAL_CODE || "").replace(/\D/g, ""),
        useSandbox: process.env.MELHOR_ENVIO_USE_SANDBOX === "true",
        scope: String(process.env.MELHOR_ENVIO_SCOPE || DEFAULT_SCOPE).trim(),
        webhookSecret: String(process.env.MELHOR_ENVIO_WEBHOOK_SECRET || "").trim(),
        webhookUrl: String(process.env.MELHOR_ENVIO_WEBHOOK_URL || "").trim()
    };
}

function getConfiguredScopes() {
    return String(getMelhorEnvioOAuthConfig().scope || "")
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

function hasRequiredScopes(scopeValue = "") {
    const grantedScopes = String(scopeValue || "")
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean);

    return getRequiredScopes().every((scope) => grantedScopes.includes(scope));
}

function assertMelhorEnvioOAuthConfig() {
    const config = getMelhorEnvioOAuthConfig();

    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
        const error = new Error("Configure MELHOR_ENVIO_CLIENT_ID, MELHOR_ENVIO_CLIENT_SECRET e MELHOR_ENVIO_REDIRECT_URI no .env.");
        error.status = 503;
        throw error;
    }

    return config;
}

function buildAuthorizationUrl(state) {
    const config = assertMelhorEnvioOAuthConfig();
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        state,
        scope: config.scope
    });

    return `${config.baseUrl}/oauth/authorize?${params.toString()}`;
}

async function requestToken(params) {
    const config = assertMelhorEnvioOAuthConfig();
    const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        ...params
    });
    const response = await fetch(`${config.baseUrl}/oauth/token`, {
        method: "POST",
        headers: {
            Accept: "application/json"
        },
        body
    });
    const responseText = await response.text();
    let parsedResponse = null;

    try {
        parsedResponse = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
        parsedResponse = null;
    }

    if (!response.ok) {
        const error = new Error(parsedResponse?.message || parsedResponse?.error || "Não foi possível autenticar no Melhor Envio.");
        error.status = response.status || 502;
        error.details = parsedResponse || responseText;
        throw error;
    }

    return parsedResponse || {};
}

function buildExpiresAt(expiresInSeconds) {
    const seconds = Number(expiresInSeconds || 0);

    if (!Number.isFinite(seconds) || seconds <= 0) {
        return null;
    }

    return new Date(Date.now() + seconds * 1000);
}

async function upsertTokens(tokenPayload, metadata = {}) {
    const nextDocument = {
        provider: MELHOR_ENVIO_PROVIDER,
        accessToken: String(tokenPayload.access_token || "").trim(),
        refreshToken: String(tokenPayload.refresh_token || "").trim(),
        tokenType: String(tokenPayload.token_type || "Bearer").trim(),
        scope: String(tokenPayload.scope || "").trim(),
        expiresAt: buildExpiresAt(tokenPayload.expires_in),
        metadata
    };

    return IntegrationSetting.findOneAndUpdate(
        { provider: MELHOR_ENVIO_PROVIDER },
        nextDocument,
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    );
}

async function fetchMelhorEnvioProfile(accessToken) {
    const config = assertMelhorEnvioOAuthConfig();
    const response = await fetch(`${config.baseUrl}/api/v2/me`, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": config.userAgent
        }
    });

    if (!response.ok) {
        return null;
    }

    return response.json();
}

async function updateStoredProfile(profile) {
    if (!profile) {
        return null;
    }

    return IntegrationSetting.findOneAndUpdate(
        { provider: MELHOR_ENVIO_PROVIDER },
        {
            $set: {
                accountName: String(profile.fullname || profile.name || "").trim(),
                accountEmail: String(profile.email || "").trim(),
                metadata: profile
            }
        },
        {
            new: true
        }
    );
}

async function exchangeAuthorizationCode(code) {
    const config = assertMelhorEnvioOAuthConfig();
    const tokenPayload = await requestToken({
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
        code: String(code || "").trim()
    });
    const setting = await upsertTokens(tokenPayload);
    const profile = await fetchMelhorEnvioProfile(setting.accessToken);

    if (profile) {
        await updateStoredProfile(profile);
    }

    return IntegrationSetting.findOne({ provider: MELHOR_ENVIO_PROVIDER });
}

async function refreshStoredToken(setting) {
    if (!setting?.refreshToken) {
        const error = new Error("A integração do Melhor Envio precisa ser conectada novamente.");
        error.status = 401;
        throw error;
    }

    const tokenPayload = await requestToken({
        grant_type: "refresh_token",
        refresh_token: setting.refreshToken
    });
    const updatedSetting = await upsertTokens(tokenPayload, setting.metadata || {});
    const profile = await fetchMelhorEnvioProfile(updatedSetting.accessToken);

    if (profile) {
        await updateStoredProfile(profile);
    }

    return IntegrationSetting.findOne({ provider: MELHOR_ENVIO_PROVIDER });
}

async function getStoredIntegration() {
    return IntegrationSetting.findOne({ provider: MELHOR_ENVIO_PROVIDER });
}

function tokenNeedsRefresh(setting) {
    if (!setting?.accessToken || !setting?.expiresAt) {
        return true;
    }

    const refreshThresholdMs = 60 * 1000;
    return new Date(setting.expiresAt).getTime() <= Date.now() + refreshThresholdMs;
}

async function getValidAçõessToken() {
    let setting = await getStoredIntegration();

    if (!setting) {
        const error = new Error("O Melhor Envio ainda não foi conectado.");
        error.status = 401;
        throw error;
    }

    if (tokenNeedsRefresh(setting)) {
        setting = await refreshStoredToken(setting);
    }

    return setting.accessToken;
}

async function disconnectMelhorEnvio() {
    await IntegrationSetting.findOneAndDelete({ provider: MELHOR_ENVIO_PROVIDER });
}

module.exports = {
    MELHOR_ENVIO_PROVIDER,
    DEFAULT_SCOPE,
    getMelhorEnvioOAuthConfig,
    getConfiguredScopes,
    getRequiredScopes,
    hasRequiredScopes,
    buildAuthorizationUrl,
    exchangeAuthorizationCode,
    fetchMelhorEnvioProfile,
    getStoredIntegration,
    getValidAçõessToken,
    disconnectMelhorEnvio
};
