const crypto = require("crypto");

const COOKIE_NAME = "admin_session";
const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const MINIMUM_SECRET_LENGTH = 32;
const adminSessions = new Map();

function getCookieAttributes(maxAgeSeconds) {
    const cookieAttributes = [
        "Path=/",
        "HttpOnly",
        `SameSite=${process.env.COOKIE_SAME_SITE || "Lax"}`,
        `Max-Age=${maxAgeSeconds}`
    ];

    if (process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production") {
        cookieAttributes.push("Secure");
    }

    return cookieAttributes.join("; ");
}

function parseCookies(cookieHeader = "") {
    return cookieHeader
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const separatorIndex = part.indexOf("=");

            if (separatorIndex === -1) {
                return acc;
            }

            const key = part.slice(0, separatorIndex).trim();
            const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
            acc[key] = value;
            return acc;
        }, {});
}

function createHash(value = "") {
    return crypto.createHash("sha256").update(String(value || "")).digest();
}

function safeCompare(leftValue = "", rightValue = "") {
    if (!leftValue || !rightValue) {
        return false;
    }

    return crypto.timingSafeEqual(createHash(leftValue), createHash(rightValue));
}

function getAdminConfig() {
    return {
        username: String(process.env.ADMIN_USERNAME || "").trim(),
        password: String(process.env.ADMIN_PASSWORD || ""),
        secret: String(process.env.ADMIN_SESSION_SECRET || "").trim()
    };
}

function getAdminConfigError() {
    const { username, password, secret } = getAdminConfig();

    if (!username || !password) {
        return "Painel admin nao configurado. Defina ADMIN_USERNAME e ADMIN_PASSWORD no backend/.env.";
    }

    if (secret.length < MINIMUM_SECRET_LENGTH) {
        return "Painel admin nao configurado. Defina ADMIN_SESSION_SECRET com pelo menos 32 caracteres no backend/.env.";
    }

    return "";
}

function getSessionMaxAgeSeconds() {
    const configuredMaxAge = Number.parseInt(process.env.ADMIN_SESSION_MAX_AGE_SECONDS, 10);

    if (Number.isInteger(configuredMaxAge) && configuredMaxAge > 0) {
        return configuredMaxAge;
    }

    return DEFAULT_SESSION_MAX_AGE_SECONDS;
}

function hashSessionToken(token = "") {
    return createHash(token).toString("hex");
}

function purgeExpiredSessions() {
    const currentTime = Date.now();

    for (const [sessionHash, session] of adminSessions.entries()) {
        if (!session || session.expiresAt <= currentTime) {
            adminSessions.delete(sessionHash);
        }
    }
}

function getAdminSessionToken(req) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[COOKIE_NAME] || "";
}

function createAdminSession() {
    purgeExpiredSessions();

    const token = crypto.randomBytes(32).toString("base64url");
    const sessionHash = hashSessionToken(token);

    adminSessions.set(sessionHash, {
        createdAt: Date.now(),
        expiresAt: Date.now() + (getSessionMaxAgeSeconds() * 1000)
    });

    return token;
}

function getAdminSession(req) {
    purgeExpiredSessions();

    const token = getAdminSessionToken(req);

    if (!token) {
        return null;
    }

    const sessionHash = hashSessionToken(token);
    const session = adminSessions.get(sessionHash);

    if (!session) {
        return null;
    }

    if (session.expiresAt <= Date.now()) {
        adminSessions.delete(sessionHash);
        return null;
    }

    return session;
}

function revokeAdminSession(req) {
    const token = getAdminSessionToken(req);

    if (!token) {
        return;
    }

    adminSessions.delete(hashSessionToken(token));
}

function isAdminAuthenticated(req) {
    return Boolean(getAdminSession(req));
}

function validateAdminCredentials(username, password) {
    const adminConfigError = getAdminConfigError();

    if (adminConfigError) {
        return false;
    }

    const adminConfig = getAdminConfig();

    return safeCompare(String(username || "").trim(), adminConfig.username)
        && safeCompare(String(password || ""), adminConfig.password);
}

function buildSessionCookie(token) {
    return `${COOKIE_NAME}=${encodeURIComponent(token)}; ${getCookieAttributes(getSessionMaxAgeSeconds())}`;
}

function buildLogoutCookie() {
    return `${COOKIE_NAME}=; ${getCookieAttributes(0)}`;
}

module.exports = {
    buildLogoutCookie,
    buildSessionCookie,
    createAdminSession,
    getAdminConfigError,
    isAdminAuthenticated,
    revokeAdminSession,
    validateAdminCredentials
};
