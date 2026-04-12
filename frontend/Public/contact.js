const menuIcon = document.querySelector(".menu-icon");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");
const produtos = document.getElementById("abrir-submenu");
const cartCount = document.getElementById("cart-count");
const desktopCategoriesMenu = document.getElementById("desktopCategoriesMenu");
const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");
const footerCategoriesMenu = document.getElementById("footerCategoriesMenu");
const contactForm = document.getElementById("contactForm");
const contactFormFeedback = document.getElementById("contactFormFeedback");

let contactRequestInFlight = false;

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

function showContactFeedback(message, type = "success") {
    if (window.showSiteToast) {
        window.showSiteToast(message, type, {
            duration: type === "error" ? 5200 : 4200
        });
    }

    if (!contactFormFeedback) {
        return;
    }

    contactFormFeedback.hidden = false;
    contactFormFeedback.className = `contact-form-feedback ${type}`;
    contactFormFeedback.textContent = message;
}

function setContactSubmitButtonLoading(button, isLoading) {
    if (window.siteUi?.setButtonLoading) {
        window.siteUi.setButtonLoading(button, isLoading, {
            loadingText: "Enviando..."
        });
        return;
    }

    if (button) {
        button.disabled = isLoading;
    }
}

if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (contactRequestInFlight) {
            return;
        }

        const submitButton = contactForm.querySelector('button[type="submit"]');
        const formData = new FormData(contactForm);
        const payload = {
            name: String(formData.get("name") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            message: String(formData.get("message") || "").trim()
        };

        if (contactFormFeedback) {
            contactFormFeedback.hidden = true;
        }

        contactRequestInFlight = true;
        setContactSubmitButtonLoading(submitButton, true);

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível enviar sua mensagem.");
            }

            contactForm.reset();
            showContactFeedback(result.message || "Mensagem enviada com sucesso.", "success");
        } catch (error) {
            showContactFeedback(error.message || "Não foi possível enviar sua mensagem.", "error");
        } finally {
            contactRequestInFlight = false;
            setContactSubmitButtonLoading(submitButton, false);
        }
    });
}

updateCartCount();
loadSharedCategories();
