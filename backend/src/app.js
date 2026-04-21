const express = require("express");
const cors = require("cors");
const path = require("path");

const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const authRoutes = require("./routes/authRoutes");
const shippingRoutes = require("./routes/shippingRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const siteSettingRoutes = require("./routes/siteSettingRoutes");
const adminIntegrationRoutes = require("./routes/adminIntegrationRoutes");
const adminMotoboyRoutes = require("./routes/adminMotoboyRoutes");
const adminSiteSettingRoutes = require("./routes/adminSiteSettingRoutes");
const adminProductRoutes = require("./routes/adminProductRoutes");
const adminCategoryRoutes = require("./routes/adminCategoryRoutes");
const adminOrderRoutes = require("./routes/adminOrderRoutes");
const adminMessageRoutes = require("./routes/adminMessageRoutes");
const adminCouponRoutes = require("./routes/adminCouponRoutes");
const ContactMessage = require("./models/ContactMessage");
const { handleMelhorEnvioWebhook } = require("./controllers/melhorEnvioWebhookController");
const { handleMercadoPagoWebhook } = require("./controllers/mercadoPagoWebhookController");
const {
    buildLogoutCookie,
    buildSessionCookie,
    createAdminSession,
    getAdminConfigError,
    isAdminAuthenticated,
    revokeAdminSession,
    validateAdminCredentials
} = require("./utils/adminAuth");
const requireAdminAuth = require("./middleware/requireAdminAuth");

const app = express();
const frontendPublicPath = path.join(__dirname, "..", "..", "frontend", "Public");
const frontendImagesPath = path.join(__dirname, "..", "..", "frontend", "img");
const adminViewsPath = path.join(frontendPublicPath, "admin");

function setUtf8ContentType(res, filePath = "") {
    const normalizedPath = String(filePath || "").toLowerCase();

    if (normalizedPath.endsWith(".html")) {
        res.setHeader("Content-Type", "text/html; charset=UTF-8");
        return;
    }

    if (normalizedPath.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css; charset=UTF-8");
        return;
    }

    if (normalizedPath.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
        return;
    }

    if (normalizedPath.endsWith(".svg")) {
        res.setHeader("Content-Type", "image/svg+xml; charset=UTF-8");
    }
}

function sendHtmlFile(res, fileName) {
    const filePath = path.join(frontendPublicPath, fileName);
    setUtf8ContentType(res, filePath);
    res.sendFile(filePath);
}

function sendAdminHtmlFile(res, fileName) {
    const filePath = path.join(adminViewsPath, fileName);
    setUtf8ContentType(res, filePath);
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(filePath);
}

app.set("trust proxy", 1);

const allowedCorsOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (!allowedCorsOrigins.length || allowedCorsOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("Origem nao permitida por CORS."));
    },
    credentials: true
}));
app.use(express.json({
    verify: (req, _res, buffer) => {
        req.rawBody = buffer.toString("utf8");
    }
}));
app.use(express.urlencoded({ extended: true }));
app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
});

app.get("/api/health", (_req, res) => {
    res.json({
        ok: true,
        message: "API online"
    });
});

app.post("/api/contact", async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const message = String(req.body.message || "").trim();

    if (!name || !email || !message) {
        return res.status(400).json({
            message: "Preencha seu nome, email e mensagem."
        });
    }

    try {
        await ContactMessage.create({
            name,
            email,
            message
        });

        return res.json({
            ok: true,
            message: "Mensagem enviada com sucesso."
        });
    } catch (_error) {
        return res.status(500).json({
            message: "Não foi possível enviar sua mensagem agora."
        });
    }
});

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/site-settings", siteSettingRoutes);
app.use("/api/admin/products", requireAdminAuth, adminProductRoutes);
app.use("/api/admin/categories", requireAdminAuth, adminCategoryRoutes);
app.use("/api/admin/orders", requireAdminAuth, adminOrderRoutes);
app.use("/api/admin/messages", requireAdminAuth, adminMessageRoutes);
app.use("/api/admin/coupons", requireAdminAuth, adminCouponRoutes);
app.use("/api/admin/integrations", requireAdminAuth, adminIntegrationRoutes);
app.use("/api/admin/motoboy", requireAdminAuth, adminMotoboyRoutes);
app.use("/api/admin/site-settings", requireAdminAuth, adminSiteSettingRoutes);
app.post("/api/integrations/melhor-envio/webhook", handleMelhorEnvioWebhook);
app.post("/api/integrations/mercado-pago/webhook", handleMercadoPagoWebhook);

app.get("/", (_req, res) => {
    sendHtmlFile(res, "index.html");
});

app.get("/produto/:slug", (_req, res) => {
    sendHtmlFile(res, "product.html");
});

app.get("/quem-somos", (_req, res) => {
    sendHtmlFile(res, "about.html");
});

app.get("/contato", (_req, res) => {
    sendHtmlFile(res, "contact.html");
});

app.get("/blog", (_req, res) => {
    sendHtmlFile(res, "blog.html");
});

app.get("/blog/:slug", (_req, res) => {
    sendHtmlFile(res, "blog-article.html");
});

app.get("/entrar", (_req, res) => {
    sendHtmlFile(res, "auth.html");
});

app.get("/minha-conta", (_req, res) => {
    sendHtmlFile(res, "account.html");
});

app.get("/meus-pedidos", (_req, res) => {
    sendHtmlFile(res, "orders.html");
});

app.get("/meus-pedidos/:orderId", (_req, res) => {
    sendHtmlFile(res, "order-detail.html");
});

app.get("/busca", (_req, res) => {
    sendHtmlFile(res, "search.html");
});

app.get("/checkout", (_req, res) => {
    sendHtmlFile(res, "checkout.html");
});

app.get(["/trocas-e-devolucoes", "/trocas-e-devolu%C3%A7%C3%B5es"], (_req, res) => {
    sendHtmlFile(res, "returns.html");
});
app.get("/categoria/:slug", (_req, res) => {
    sendHtmlFile(res, "category.html");
});

app.get("/admin/login", (req, res) => {
    if (isAdminAuthenticated(req)) {
        return res.redirect("/admin");
    }

    return sendAdminHtmlFile(res, "login.html");
});

app.post("/admin/login", (req, res) => {
    const { username = "", password = "" } = req.body;
    const configError = getAdminConfigError();

    if (configError) {
        return res.redirect("/admin/login?error=config");
    }

    if (!validateAdminCredentials(username.trim(), password)) {
        return res.redirect("/admin/login?error=invalid");
    }

    const sessionToken = createAdminSession();
    res.setHeader("Set-Cookie", buildSessionCookie(sessionToken));
    return res.redirect("/admin");
});

app.post("/api/admin/session/login", (req, res) => {
    const { username = "", password = "" } = req.body;
    const configError = getAdminConfigError();

    if (configError) {
        return res.status(500).json({
            message: configError,
            code: "config"
        });
    }

    if (!validateAdminCredentials(username.trim(), password)) {
        return res.status(401).json({
            message: "Usuario ou senha invalidos. Tente novamente.",
            code: "invalid"
        });
    }

    const sessionToken = createAdminSession();
    res.setHeader("Set-Cookie", buildSessionCookie(sessionToken));
    return res.json({
        ok: true
    });
});

app.post("/admin/logout", (req, res) => {
    revokeAdminSession(req);
    res.setHeader("Set-Cookie", buildLogoutCookie());
    return res.redirect("/admin/login");
});

app.post("/api/admin/session/logout", (req, res) => {
    revokeAdminSession(req);
    res.setHeader("Set-Cookie", buildLogoutCookie());
    return res.json({
        ok: true
    });
});

app.get("/admin/logout", (req, res) => {
    revokeAdminSession(req);
    res.setHeader("Set-Cookie", buildLogoutCookie());
    return res.redirect("/admin/login");
});

app.get("/admin", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "index.html");
});

app.get("/admin/products/new", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "index.html");
});

app.get("/admin/products/:id/edit", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "index.html");
});

app.get("/admin/categories", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "categories.html");
});

app.get("/admin/categories/new", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "categories.html");
});

app.get("/admin/categories/:id/edit", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "categories.html");
});

app.get("/admin/integrations", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "integrations.html");
});

app.get("/admin/motoboy", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "motoboy.html");
});

app.get("/admin/settings", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "settings.html");
});

app.get("/admin/orders", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "orders.html");
});

app.get("/admin/messages", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "messages.html");
});

app.get("/admin/coupons", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "coupons.html");
});

app.get("/admin/coupons/new", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "coupon-form.html");
});

app.get("/admin/coupons/:id", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "coupon-detail.html");
});

app.get("/admin/coupons/:id/edit", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "coupon-form.html");
});

app.get("/admin/orders/:id", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return sendAdminHtmlFile(res, "order-detail.html");
});

app.get("/admin/integrations/melhor-envio/callback", (req, res, next) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return next();
}, require("./controllers/adminIntegrationController").handleMelhorEnvioCallback);

app.use("/admin", express.static(adminViewsPath, {
    index: false,
    redirect: false,
    setHeaders: setUtf8ContentType
}));
app.use("/img", express.static(frontendImagesPath, { setHeaders: setUtf8ContentType }));
app.use(express.static(frontendPublicPath, { setHeaders: setUtf8ContentType }));

app.use((error, _req, res, _next) => {
    console.error("Erro na aplicação:", error);

    const knownUploadErrors = {
        LIMIT_FILE_SIZE: "Cada imagem deve ter no máximo 5 MB.",
        LIMIT_FILE_COUNT: "Você pode enviar no máximo 8 imagens por produto.",
        LIMIT_UNEXPECTED_FILE: "Campo de upload inválido. Tente selecionar as imagens novamente."
    };

    if (error?.code && knownUploadErrors[error.code]) {
        return res.status(400).json({
            message: knownUploadErrors[error.code],
            error: knownUploadErrors[error.code]
        });
    }

    if (error?.message === "Envie apenas arquivos de imagem.") {
        return res.status(400).json({
            message: error.message,
            error: error.message
        });
    }

    return res.status(error?.status || 500).json({
        message: "Erro interno do servidor.",
        error: error?.message || "Erro interno do servidor."
    });
});

module.exports = app;
