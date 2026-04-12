const crypto = require("crypto");

const COOKIE_NAME = "user_session";

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

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function createPasswordHash(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);

    return {
        salt,
        passwordHash
    };
}

function verifyPassword(password, salt, expectedHash) {
    const candidateHash = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(candidateHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function createSessionToken() {
    return crypto.randomBytes(32).toString("hex");
}

function hashSessionToken(token) {
    return crypto.createHash("sha256").update(String(token || "")).digest("hex");
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

function getUserSessionToken(req) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[COOKIE_NAME] || "";
}

function buildUserSessionCookie(token) {
    const oneWeekInSeconds = 60 * 60 * 24 * 7;
    return `${COOKIE_NAME}=${encodeURIComponent(token)}; ${getCookieAttributes(oneWeekInSeconds)}`;
}

function buildUserLogoutCookie() {
    return `${COOKIE_NAME}=; ${getCookieAttributes(0)}`;
}

module.exports = {
    buildUserLogoutCookie,
    buildUserSessionCookie,
    createPasswordHash,
    createSessionToken,
    getUserSessionToken,
    hashSessionToken,
    verifyPassword
};
