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
const adminSiteSettingRoutes = require("./routes/adminSiteSettingRoutes");
const adminProductRoutes = require("./routes/adminProductRoutes");
const adminCategoryRoutes = require("./routes/adminCategoryRoutes");
const adminOrderRoutes = require("./routes/adminOrderRoutes");
const adminMessageRoutes = require("./routes/adminMessageRoutes");
const adminCouponRoutes = require("./routes/adminCouponRoutes");
const ContactMessage = require("./models/ContactMessage");
const { handleMelhorEnvioWebhook } = require("./controllers/melhorEnvioWebhookController");
const {
    buildLogoutCookie,
    buildSessionCookie,
    isAdminAuthenticated,
    validateAdminCredentials
} = require("./utils/adminAuth");
const requireAdminAuth = require("./middleware/requireAdminAuth");

const app = express();
const frontendPublicPath = path.join(__dirname, "..", "..", "frontend", "Public");
const frontendImagesPath = path.join(__dirname, "..", "..", "frontend", "img");
const adminViewsPath = path.join(frontendPublicPath, "admin");

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
app.use("/api/admin/site-settings", requireAdminAuth, adminSiteSettingRoutes);
app.post("/api/integrations/melhor-envio/webhook", handleMelhorEnvioWebhook);

app.get("/", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "index.html"));
});

app.get("/produto/:slug", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "product.html"));
});

app.get("/quem-somos", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "about.html"));
});

app.get("/contato", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "contact.html"));
});

app.get("/blog", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "blog.html"));
});

app.get("/blog/:slug", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "blog-article.html"));
});

app.get("/entrar", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "auth.html"));
});

app.get("/minha-conta", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "account.html"));
});

app.get("/meus-pedidos", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "orders.html"));
});

app.get("/meus-pedidos/:orderId", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "order-detail.html"));
});

app.get("/busca", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "search.html"));
});

app.get("/checkout", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "checkout.html"));
});

app.get(["/trocas-e-devolucoes", "/trocas-e-devolu%C3%A7%C3%B5es"], (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "returns.html"));
});
app.get("/categoria/:slug", (_req, res) => {
    res.sendFile(path.join(frontendPublicPath, "category.html"));
});

app.get("/admin/login", (req, res) => {
    if (isAdminAuthenticated(req)) {
        return res.redirect("/admin");
    }

    return res.sendFile(path.join(adminViewsPath, "login.html"));
});

app.post("/admin/login", (req, res) => {
    const { username = "", password = "" } = req.body;

    if (!validateAdminCredentials(username.trim(), password)) {
        return res.redirect("/admin/login?error=1");
    }

    res.setHeader("Set-Cookie", buildSessionCookie());
    return res.redirect("/admin");
});

app.post("/admin/logout", (_req, res) => {
    res.setHeader("Set-Cookie", buildLogoutCookie());
    return res.redirect("/admin/login");
});

app.get("/admin/logout", (_req, res) => {
    res.setHeader("Set-Cookie", buildLogoutCookie());
    return res.redirect("/admin/login");
});

app.get("/admin", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "index.html"));
});

app.get("/admin/products/new", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "index.html"));
});

app.get("/admin/products/:id/edit", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "index.html"));
});

app.get("/admin/categories", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "categories.html"));
});

app.get("/admin/categories/new", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "categories.html"));
});

app.get("/admin/categories/:id/edit", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "categories.html"));
});

app.get("/admin/integrations", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "integrations.html"));
});

app.get("/admin/settings", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "settings.html"));
});

app.get("/admin/orders", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "orders.html"));
});

app.get("/admin/messages", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "messages.html"));
});

app.get("/admin/coupons", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "coupons.html"));
});

app.get("/admin/coupons/new", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "coupon-form.html"));
});

app.get("/admin/coupons/:id", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "coupon-detail.html"));
});

app.get("/admin/coupons/:id/edit", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "coupon-form.html"));
});

app.get("/admin/orders/:id", (req, res) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return res.sendFile(path.join(adminViewsPath, "order-detail.html"));
});

app.get("/admin/integrations/melhor-envio/callback", (req, res, next) => {
    if (!isAdminAuthenticated(req)) {
        return res.redirect("/admin/login");
    }

    return next();
}, require("./controllers/adminIntegrationController").handleMelhorEnvioCallback);

app.use("/admin", express.static(adminViewsPath, { index: false, redirect: false }));
app.use("/img", express.static(frontendImagesPath));
app.use(express.static(frontendPublicPath));

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
