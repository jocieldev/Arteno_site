const crypto = require("crypto");

const COOKIE_NAME = "admin_session";

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

function getAdminConfig() {
    return {
        username: process.env.ADMIN_USERNAME || "admin",
        password: process.env.ADMIN_PASSWORD || "admin123",
        secret: process.env.ADMIN_SESSION_SECRET || "vsantos-admin-secret"
    };
}

function createSessionToken() {
    const { username, password, secret } = getAdminConfig();

    return crypto
        .createHmac("sha256", secret)
        .update(`${username}:${password}`)
        .digest("hex");
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

function isAdminAuthenticated(req) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[COOKIE_NAME] === createSessionToken();
}

function validateAdminCredentials(username, password) {
    const adminConfig = getAdminConfig();

    return username === adminConfig.username && password === adminConfig.password;
}

function buildSessionCookie() {
    const oneDayInSeconds = 60 * 60 * 24;
    return `${COOKIE_NAME}=${createSessionToken()}; ${getCookieAttributes(oneDayInSeconds)}`;
}

function buildLogoutCookie() {
    return `${COOKIE_NAME}=; ${getCookieAttributes(0)}`;
}

module.exports = {
    buildLogoutCookie,
    buildSessionCookie,
    isAdminAuthenticated,
    validateAdminCredentials
};
