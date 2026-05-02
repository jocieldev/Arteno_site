const menuIcon = document.querySelector(".menu-icon");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");
const produtos = document.getElementById("abrir-submenu");
const cartCount = document.getElementById("cart-count");
const desktopCategoriesMenu = document.getElementById("desktopCategoriesMenu");
const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");
const footerCategoriesMenu = document.getElementById("footerCategoriesMenu");
const authTabs = document.querySelectorAll("#authTabs [data-auth-tab]");
const authFeedback = document.getElementById("authFeedback");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const verifyCodeForm = document.getElementById("verifyCodeForm");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const forgotPasswordToggle = document.getElementById("forgotPasswordToggle");
const backToLoginFromForgot = document.getElementById("backToLoginFromForgot");
const resendCodeButton = document.getElementById("resendCodeButton");
const backToForgotFromVerify = document.getElementById("backToForgotFromVerify");
const backToLoginFromReset = document.getElementById("backToLoginFromReset");

const passwordRecoveryState = {
    email: "",
    code: ""
};

const PASSWORD_RESET_CODE_LENGTH = 6;

let loginRequestInFlight = false;
let registerRequestInFlight = false;
let forgotPasswordRequestInFlight = false;
let resendCodeRequestInFlight = false;
let verifyCodeRequestInFlight = false;
let resetPasswordRequestInFlight = false;

if (menuIcon && sideMenu && overlay) {
    menuIcon.addEventListener("click", () => {
        sideMenu.classList.add("active");
        overlay.classList.add("active");
    });
}

function closeSideMenu() {
    if (!sideMenu || !overlay) {
        return;
    }

    sideMenu.classList.remove("active");
    overlay.classList.remove("active");
}

if (closeMenu) {
    closeMenu.addEventListener("click", closeSideMenu);
}

if (overlay) {
    overlay.addEventListener("click", closeSideMenu);
}

if (produtos) {
    produtos.addEventListener("click", () => {
        produtos.classList.toggle("ativo");
    });
}

function getStoredCartItems() {
    try {
        const rawValue = window.localStorage.getItem("arteno-cart");
        const parsedValue = JSON.parse(rawValue || "[]");
        return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (_error) {
        return [];
    }
}

function updateCartCount() {
    if (!cartCount) {
        return;
    }

    const totalItems = getStoredCartItems().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    cartCount.textContent = String(totalItems);
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getCategoryUrl(category) {
    return `/categoria/${encodeURIComponent(category.slug || "")}`;
}

function buildCategoryLinkMarkup(category) {
    const categoryUrl = escapeHtml(getCategoryUrl(category));
    const categoryName = escapeHtml(category.name || "Categoria");
    return `<a href="${categoryUrl}">${categoryName}</a>`;
}

function buildMobileCategoryItemMarkup(category) {
    const categoryUrl = escapeHtml(getCategoryUrl(category));
    const categoryName = escapeHtml(category.name || "Categoria");
    return `<a href="${categoryUrl}" class="mobile-category-link">${categoryName}</a>`;
}

function buildFooterCategoryItemMarkup(category) {
    const categoryUrl = escapeHtml(getCategoryUrl(category));
    const categoryName = escapeHtml(category.name || "Categoria");
    return `<li><a href="${categoryUrl}">${categoryName}</a></li>`;
}

function renderSharedCategories(categories) {
    if (desktopCategoriesMenu) {
        desktopCategoriesMenu.innerHTML = categories.map((category) => buildCategoryLinkMarkup(category)).join("");
    }

    if (mobileCategoriesMenu) {
        mobileCategoriesMenu.innerHTML = categories.map((category) => buildMobileCategoryItemMarkup(category)).join("");
    }

    if (footerCategoriesMenu) {
        footerCategoriesMenu.innerHTML = categories.map((category) => buildFooterCategoryItemMarkup(category)).join("");
    }
}

async function loadSharedCategories() {
    try {
        const response = await fetch("/api/categories");

        if (!response.ok) {
            throw new Error("Não foi possível carregar as categorias.");
        }

        const categories = await response.json();
        renderSharedCategories(categories);
    } catch (error) {
        console.error("Erro ao carregar categorias compartilhadas:", error);
    }
}

function showAuthFeedback(message, type = "success") {
    if (window.showSiteToast) {
        window.showSiteToast(message, type, {
            duration: type === "error" ? 5200 : 4200
        });
    }

    if (!authFeedback) {
        return;
    }

    authFeedback.hidden = false;
    authFeedback.className = `auth-feedback ${type}`;
    authFeedback.textContent = message;
}

function getReadableErrorMessage(error, fallbackMessage) {
    if (error && error.name === "TypeError" && /fetch/i.test(String(error.message || ""))) {
        return "Não foi possível conectar ao servidor. Recarregue a página e confirme se o backend está rodando.";
    }

    return error?.message || fallbackMessage;
}

function hideAuthFeedback() {
    if (!authFeedback) {
        return;
    }

    authFeedback.hidden = true;
    authFeedback.textContent = "";
    authFeedback.className = "auth-feedback";
}

function bindPasswordVisibilityToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const fieldWrap = button.closest(".auth-password-field");
            const input = fieldWrap?.querySelector("input");
            const icon = button.querySelector("i");

            if (!input || !icon) {
                return;
            }

            const shouldShowPassword = input.type === "password";
            input.type = shouldShowPassword ? "text" : "password";
            icon.className = shouldShowPassword ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
            button.setAttribute("aria-pressed", String(shouldShowPassword));
            button.setAttribute("aria-label", shouldShowPassword ? "Ocultar senha" : "Mostrar senha");
        });
    });
}

function setActionButtonLoading(button, isLoading, loadingText) {
    if (window.siteUi?.setButtonLoading) {
        window.siteUi.setButtonLoading(button, isLoading, { loadingText });
        return;
    }

    if (button) {
        button.disabled = isLoading;
    }
}

function syncPasswordRecoveryForms() {
    if (forgotPasswordForm) {
        forgotPasswordForm.elements.email.value = passwordRecoveryState.email;
    }

    if (verifyCodeForm) {
        verifyCodeForm.elements.email.value = passwordRecoveryState.email;
        verifyCodeForm.elements.code.value = passwordRecoveryState.code;
    }

    if (resetPasswordForm) {
        resetPasswordForm.elements.email.value = passwordRecoveryState.email;
        resetPasswordForm.elements.code.value = passwordRecoveryState.code;
    }
}

function resetPasswordRecoveryState({ keepEmail = false } = {}) {
    passwordRecoveryState.email = keepEmail ? passwordRecoveryState.email : "";
    passwordRecoveryState.code = "";
    syncPasswordRecoveryForms();
}

function setActiveAuthView(viewName) {
    authTabs.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.authTab === viewName);
    });

    if (loginForm) {
        loginForm.hidden = viewName !== "login";
    }

    if (registerForm) {
        registerForm.hidden = viewName !== "register";
    }

    if (forgotPasswordForm) {
        forgotPasswordForm.hidden = viewName !== "forgot";
    }

    if (verifyCodeForm) {
        verifyCodeForm.hidden = viewName !== "verify";
    }

    if (resetPasswordForm) {
        resetPasswordForm.hidden = viewName !== "reset";
    }

    syncPasswordRecoveryForms();
    hideAuthFeedback();
}

authTabs.forEach((button) => {
    button.addEventListener("click", () => {
        setActiveAuthView(button.dataset.authTab || "login");
    });
});

if (forgotPasswordToggle) {
    forgotPasswordToggle.addEventListener("click", () => {
        resetPasswordRecoveryState();
        setActiveAuthView("forgot");
    });
}

if (backToLoginFromForgot) {
    backToLoginFromForgot.addEventListener("click", () => {
        resetPasswordRecoveryState();
        setActiveAuthView("login");
    });
}

if (backToForgotFromVerify) {
    backToForgotFromVerify.addEventListener("click", () => {
        passwordRecoveryState.code = "";
        syncPasswordRecoveryForms();
        setActiveAuthView("forgot");
    });
}

if (backToLoginFromReset) {
    backToLoginFromReset.addEventListener("click", () => {
        resetPasswordRecoveryState();
        setActiveAuthView("login");
    });
}

setActiveAuthView("login");
bindPasswordVisibilityToggles();

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (loginRequestInFlight) {
            return;
        }

        const formData = new FormData(loginForm);
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const payload = {
            email: String(formData.get("email") || "").trim(),
            password: String(formData.get("password") || "")
        };

        loginRequestInFlight = true;
        setActionButtonLoading(submitButton, true, "Entrando...");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível entrar.");
            }

            window.dispatchEvent(new CustomEvent("auth:updated"));
            window.location.href = "/minha-conta";
        } catch (error) {
            showAuthFeedback(getReadableErrorMessage(error, "Não foi possível entrar."), "error");
        } finally {
            loginRequestInFlight = false;
            setActionButtonLoading(submitButton, false, "Entrando...");
        }
    });
}

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (registerRequestInFlight) {
            return;
        }

        const formData = new FormData(registerForm);
        const submitButton = registerForm.querySelector('button[type="submit"]');
        const payload = {
            name: String(formData.get("name") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            phone: String(formData.get("phone") || "").trim(),
            password: String(formData.get("password") || ""),
            confirmPassword: String(formData.get("confirmPassword") || "")
        };

        registerRequestInFlight = true;
        setActionButtonLoading(submitButton, true, "Criando conta...");

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível criar sua conta.");
            }

            // Track CompleteRegistration event
            if (typeof window.trackMetaPixelEvent === "function") {
                window.trackMetaPixelEvent("CompleteRegistration", {
                    status: "completed"
                });
            }

            window.dispatchEvent(new CustomEvent("auth:updated"));
            window.location.href = "/minha-conta";
        } catch (error) {
            showAuthFeedback(getReadableErrorMessage(error, "Não foi possível criar sua conta."), "error");
        } finally {
            registerRequestInFlight = false;
            setActionButtonLoading(submitButton, false, "Criando conta...");
        }
    });
}

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (forgotPasswordRequestInFlight) {
            return;
        }

        const formData = new FormData(forgotPasswordForm);
        const submitButton = forgotPasswordForm.querySelector('button[type="submit"]');
        const email = String(formData.get("email") || "").trim();

        forgotPasswordRequestInFlight = true;
        setActionButtonLoading(submitButton, true, "Enviando código...");

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível enviar o código.");
            }

            passwordRecoveryState.email = email;
            passwordRecoveryState.code = "";
            syncPasswordRecoveryForms();
            setActiveAuthView("verify");
            showAuthFeedback(result.message || "Código enviado com sucesso.", "success");
        } catch (error) {
            showAuthFeedback(getReadableErrorMessage(error, "Não foi possível enviar o código."), "error");
        } finally {
            forgotPasswordRequestInFlight = false;
            setActionButtonLoading(submitButton, false, "Enviando código...");
        }
    });
}

if (resendCodeButton) {
    resendCodeButton.addEventListener("click", async () => {
        if (resendCodeRequestInFlight) {
            return;
        }

        const email = String(passwordRecoveryState.email || "").trim();

        if (!email) {
            showAuthFeedback("Informe primeiro o e-mail para reenviar o código.", "error");
            setActiveAuthView("forgot");
            return;
        }

        resendCodeRequestInFlight = true;
        setActionButtonLoading(resendCodeButton, true, "Reenviando...");

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível reenviar o código.");
            }

            passwordRecoveryState.code = "";
            syncPasswordRecoveryForms();
            showAuthFeedback(result.message || "Código reenviado com sucesso.", "success");
        } catch (error) {
            showAuthFeedback(getReadableErrorMessage(error, "Não foi possível reenviar o código."), "error");
        } finally {
            resendCodeRequestInFlight = false;
            setActionButtonLoading(resendCodeButton, false, "Reenviando...");
        }
    });
}

if (verifyCodeForm) {
    verifyCodeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (verifyCodeRequestInFlight) {
            return;
        }

        const formData = new FormData(verifyCodeForm);
        const submitButton = verifyCodeForm.querySelector('button[type="submit"]');
        const email = String(formData.get("email") || "").trim();
        const code = String(formData.get("code") || "").trim();

        if (!email) {
            showAuthFeedback("Informe o e-mail para continuar.", "error");
            setActiveAuthView("forgot");
            return;
        }

        if (code.length !== PASSWORD_RESET_CODE_LENGTH) {
            showAuthFeedback("Digite o código completo de 6 dígitos para continuar.", "error");
            return;
        }

        verifyCodeRequestInFlight = true;
        setActionButtonLoading(submitButton, true, "Confirmando...");

        try {
            const response = await fetch("/api/auth/verify-reset-code", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, code })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível validar o código.");
            }

            passwordRecoveryState.email = email;
            passwordRecoveryState.code = code;
            syncPasswordRecoveryForms();
            setActiveAuthView("reset");
            showAuthFeedback(result.message || "Código confirmado. Agora crie sua nova senha.", "success");
        } catch (error) {
            showAuthFeedback(getReadableErrorMessage(error, "Não foi possível validar o código."), "error");
        } finally {
            verifyCodeRequestInFlight = false;
            setActionButtonLoading(submitButton, false, "Confirmando...");
        }
    });
}

if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (resetPasswordRequestInFlight) {
            return;
        }

        const formData = new FormData(resetPasswordForm);
        const submitButton = resetPasswordForm.querySelector('button[type="submit"]');
        const payload = {
            email: String(formData.get("email") || "").trim(),
            code: String(formData.get("code") || "").trim(),
            password: String(formData.get("password") || ""),
            confirmPassword: String(formData.get("confirmPassword") || "")
        };

        resetPasswordRequestInFlight = true;
        setActionButtonLoading(submitButton, true, "Redefinindo...");

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível redefinir sua senha.");
            }

            resetPasswordForm.reset();
            resetPasswordRecoveryState();
            setActiveAuthView("login");
            if (loginForm) {
                loginForm.elements.email.value = payload.email;
            }
            showAuthFeedback(result.message || "Senha redefinida com sucesso.", "success");
        } catch (error) {
            showAuthFeedback(getReadableErrorMessage(error, "Não foi possível redefinir sua senha."), "error");
        } finally {
            resetPasswordRequestInFlight = false;
            setActionButtonLoading(submitButton, false, "Redefinindo...");
        }
    });
}

loadSharedCategories();
updateCartCount();

