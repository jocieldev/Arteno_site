const { isAdminAuthenticated } = require("../utils/adminAuth");

function requireAdminAuth(req, res, next) {
    if (!isAdminAuthenticated(req)) {
        return res.status(401).json({ message: "Não autorizado" });
    }

    return next();
}

module.exports = requireAdminAuth;
