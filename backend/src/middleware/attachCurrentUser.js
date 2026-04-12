const User = require("../models/User");
const { getUserSessionToken, hashSessionToken } = require("../utils/userAuth");

async function attachCurrentUser(req, _res, next) {
    try {
        const sessionToken = getUserSessionToken(req);

        if (!sessionToken) {
            return next();
        }

        const user = await User.findOne({ sessionTokenHash: hashSessionToken(sessionToken) });

        if (user) {
            req.user = user;
        }

        return next();
    } catch (_error) {
        return next();
    }
}

module.exports = attachCurrentUser;
