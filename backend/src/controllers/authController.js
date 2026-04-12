const User = require("../models/User");
const {
    buildUserLogoutCookie,
    buildUserSessionCookie,
    createPasswordHash,
    createSessionToken,
    getUserSessionToken,
    hashSessionToken,
    verifyPassword
} = require("../utils/userAuth");
const { sendPasswordResetCodeEmail } = require("../services/emailService");

function serializeUser(user) {
    return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone || ""
    };
}

function normalizeEmail(value = "") {
    return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
    return String(value || "").replace(/\D/g, "");
}

function hashResetCode(code) {
    return hashSessionToken(String(code || "").trim());
}

function createPasswordResetCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function hasValidPasswordResetCode(user, code) {
    if (
        !user
        || !user.passwordResetCodeHash
        || !user.passwordResetExpiresAt
    ) {
        return false;
    }

    if (new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
        return false;
    }

    return user.passwordResetCodeHash === hashResetCode(code);
}

async function registerUser(req, res) {
    try {
        const name = String(req.body.name || "").trim();
        const email = normalizeEmail(req.body.email);
        const phone = normalizePhone(req.body.phone);
        const password = String(req.body.password || "");
        const confirmPassword = String(req.body.confirmPassword || "");

        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({ message: "Preencha todos os campos obrigatórios." });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "As senhas não coincidem." });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({ message: "Já existe uma conta cadastrada com esse e-mail." });
        }

        const { salt, passwordHash } = createPasswordHash(password);
        const sessionToken = createSessionToken();

        const user = await User.create({
            name,
            email,
            phone,
            passwordHash,
            passwordSalt: salt,
            sessionTokenHash: hashSessionToken(sessionToken)
        });

        res.setHeader("Set-Cookie", buildUserSessionCookie(sessionToken));

        return res.status(201).json({
            ok: true,
            message: "Conta criada com sucesso.",
            user: serializeUser(user)
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao criar conta." });
    }
}

async function loginUser(req, res) {
    try {
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.password || "");

        if (!email || !password) {
            return res.status(400).json({ message: "Informe e-mail e senha." });
        }

        const user = await User.findOne({ email });

        if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
            return res.status(401).json({ message: "E-mail ou senha inválidos." });
        }

        const sessionToken = createSessionToken();
        user.sessionTokenHash = hashSessionToken(sessionToken);
        await user.save();

        res.setHeader("Set-Cookie", buildUserSessionCookie(sessionToken));

        return res.json({
            ok: true,
            message: "Login realizado com sucesso.",
            user: serializeUser(user)
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao entrar na conta." });
    }
}

async function getCurrentUser(req, res) {
    try {
        const sessionToken = getUserSessionToken(req);

        if (!sessionToken) {
            return res.json({
                ok: true,
                user: null
            });
        }

        const user = await User.findOne({ sessionTokenHash: hashSessionToken(sessionToken) });

        if (!user) {
            return res.json({
                ok: true,
                user: null
            });
        }

        return res.json({
            ok: true,
            user: serializeUser(user)
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar usuário atual." });
    }
}

async function logoutUser(_req, res) {
    res.setHeader("Set-Cookie", buildUserLogoutCookie());
    return res.json({
        ok: true,
        message: "Logout realizado com sucesso."
    });
}

async function getAccountDetails(req, res) {
    return res.json({
        ok: true,
        user: serializeUser(req.user)
    });
}

async function requestPasswordResetCode(req, res) {
    try {
        const email = normalizeEmail(req.body.email);

        if (!email) {
            return res.status(400).json({
                message: "Informe seu e-mail para continuar"
            });
        }

        const user = await User.findOne({ email });

        if (user) {
            const resetCode = createPasswordResetCode();
            user.passwordResetCodeHash = hashResetCode(resetCode);
            user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
            user.passwordResetRequestedAt = new Date();
            await user.save();

            await sendPasswordResetCodeEmail({
                toEmail: user.email,
                toName: user.name,
                code: resetCode
            });
        }

        return res.json({
            ok: true,
            message: "Se existir uma conta com esse e-mail, o código de recuperação foi enviado."
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Não foi possível enviar o código de recuperação."
        });
    }
}

async function verifyPasswordResetCode(req, res) {
    try {
        const email = normalizeEmail(req.body.email);
        const code = String(req.body.code || "").trim();

        if (!email || !code) {
            return res.status(400).json({
                message: "Informe e-mail e código para continuar."
            });
        }

        const user = await User.findOne({ email });

        if (!hasValidPasswordResetCode(user, code)) {
            return res.status(400).json({
                message: "Código inválido ou expirado."
            });
        }

        return res.json({
            ok: true,
            message: "Código confirmado com sucesso."
        });
    } catch (error) {
        return res.status(500).json({
            message: "Não foi possível validar o código."
        });
    }
}

async function resetPasswordWithCode(req, res) {
    try {
        const email = normalizeEmail(req.body.email);
        const code = String(req.body.code || "").trim();
        const password = String(req.body.password || "");
        const confirmPassword = String(req.body.confirmPassword || "");

        if (!email || !code || !password || !confirmPassword) {
            return res.status(400).json({
                message: "Preencha e-mail, código e a nova senha."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "A nova senha deve ter pelo menos 6 caracteres."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "As senhas não coincidem."
            });
        }

        const user = await User.findOne({ email });

        if (!hasValidPasswordResetCode(user, code)) {
            return res.status(400).json({
                message: "Código inválido ou expirado."
            });
        }

        const { salt, passwordHash } = createPasswordHash(password);
        user.passwordSalt = salt;
        user.passwordHash = passwordHash;
        user.sessionTokenHash = "";
        user.passwordResetCodeHash = "";
        user.passwordResetExpiresAt = null;
        user.passwordResetRequestedAt = null;
        await user.save();

        return res.json({
            ok: true,
            message: "Senha redefinida com sucesso. Agora voce ja pode entrar na sua conta."
        });
    } catch (error) {
        return res.status(500).json({
            message: "Não foi possível redefinir sua senha."
        });
    }
}

module.exports = {
    registerUser,
    loginUser,
    getCurrentUser,
    logoutUser,
    getAccountDetails,
    requestPasswordResetCode,
    verifyPasswordResetCode,
    resetPasswordWithCode
};
