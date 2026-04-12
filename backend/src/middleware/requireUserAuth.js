const User = require("../models/User");
const { getUserSessionToken, hashSessionToken } = require("../utils/userAuth");

async function requireUserAuth(req, res, next) {
    try {
        const sessionToken = getUserSessionToken(req);

        if (!sessionToken) {
            return res.status(401).json({ message: "Não autenticado" });
        }

        const user = await User.findOne({ sessionTokenHash: hashSessionToken(sessionToken) });

        if (!user) {
            return res.status(401).json({ message: "Não autenticado" });
        }

        req.user = user;
        return next();
    } catch (error) {
        return res.status(500).json({ message: "Erro ao validar sessão do usuário" });
    }
}

module.exports = requireUserAuth;
