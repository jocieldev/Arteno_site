const menuIcon = document.querySelector(".menu-icon");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");
const produtos = document.getElementById("abrir-submenu");
const cartCount = document.getElementById("cart-count");
const desktopCategoriesMenu = document.getElementById("desktopCategoriesMenu");
const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");
const footerCategoriesMenu = document.getElementById("footerCategoriesMenu");
const accountFeedback = document.getElementById("accountFeedback");
const accountName = document.getElementById("accountName");
const accountEmail = document.getElementById("accountEmail");
const accountPhone = document.getElementById("accountPhone");
const accountLogoutButton = document.getElementById("accountLogoutButton");

let accountLogoutRequestInFlight = false;

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(value || 0));
}

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

function showAccountError(message) {
    if (window.showSiteToast) {
        window.showSiteToast(message, "error", {
            duration: 5200
        });
    }

    if (!accountFeedback) {
        return;
    }

    accountFeedback.hidden = false;
    accountFeedback.textContent = message;
}

async function loadAccount() {
    try {
        const response = await fetch("/api/auth/account");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Não foi possível carregar sua conta.");
        }

        if (accountName) {
            accountName.textContent = result.user.name || "-";
        }

        if (accountEmail) {
            accountEmail.textContent = result.user.email || "-";
        }

        if (accountPhone) {
            accountPhone.textContent = result.user.phone || "Não informado";
        }
    } catch (error) {
        showAccountError(error.message);
        window.setTimeout(() => {
            window.location.href = "/entrar";
        }, 800);
    }
}

if (accountLogoutButton) {
    accountLogoutButton.addEventListener("click", async () => {
        if (accountLogoutRequestInFlight) {
            return;
        }

        accountLogoutRequestInFlight = true;

        if (window.siteUi?.setButtonLoading) {
            window.siteUi.setButtonLoading(accountLogoutButton, true, {
                loadingText: "Saindo..."
            });
        }

        try {
            const response = await fetch("/api/auth/logout", { method: "POST" });

            if (!response.ok) {
                throw new Error("Não foi possível sair da conta agora.");
            }

            window.dispatchEvent(new CustomEvent("auth:updated"));
            window.location.href = "/";
        } catch (_error) {
            accountLogoutRequestInFlight = false;

            if (window.siteUi?.setButtonLoading) {
                window.siteUi.setButtonLoading(accountLogoutButton, false, {
                    loadingText: "Saindo..."
                });
            }

            showAccountError("Não foi possível sair da conta agora.");
        }
    });
}

loadSharedCategories();
updateCartCount();
loadAccount();
