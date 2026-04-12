const menuIcon = document.querySelector(".menu-icon");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");
const produtos = document.getElementById("abrir-submenu");
const cartCount = document.getElementById("cart-count");
const desktopCategoriesMenu = document.getElementById("desktopCategoriesMenu");
const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");
const footerCategoriesMenu = document.getElementById("footerCategoriesMenu");
const blogGrid = document.getElementById("blogGrid");
const blogArticles = Array.isArray(window.BLOG_ARTICLES) ? window.BLOG_ARTICLES : [];

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

function getToneClass(article) {
    switch (article.heroTone) {
        case "tabua":
            return "blog-card-visual-tabua";
        case "madeira":
            return "blog-card-visual-madeira";
        default:
            return "blog-card-visual-cuia";
    }
}

function renderBlogCards() {
    if (!blogGrid) {
        return;
    }

    if (!blogArticles.length) {
        blogGrid.innerHTML = '<div class="blog-empty-state">Nenhum conteúdo foi cadastrado no blog ainda.</div>';
        return;
    }

    blogGrid.innerHTML = blogArticles.map((article) => `
        <a class="blog-card" href="/blog/${encodeURIComponent(article.slug || "")}">
            <div class="blog-card-visual ${getToneClass(article)}">
                <span class="blog-card-badge">${escapeHtml(article.category || "Blog")}</span>
            </div>
            <div class="blog-card-copy">
                <div class="blog-card-meta">
                    <span>${escapeHtml(article.readTime || "Leitura rápida")}</span>
                    <span>|</span>
                    <span>Arteno</span>
                </div>
                <h2 class="blog-card-title">${escapeHtml(article.title || "Conteúdo")}</h2>
                <p class="blog-card-excerpt">${escapeHtml(article.excerpt || "")}</p>
                <span class="blog-card-link">Ler conteúdo <i class="fa-solid fa-arrow-right"></i></span>
            </div>
        </a>
    `).join("");
}

updateCartCount();
loadSharedCategories();
renderBlogCards();
