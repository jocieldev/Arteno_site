function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(value || 0));
}

const menuIcon = document.querySelector(".menu-icon");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");
const produtos = document.getElementById("abrir-submenu");
const cartCount = document.getElementById("cart-count");
const desktopCategoriesMenu = document.getElementById("desktopCategoriesMenu");
const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");
const footerCategoriesMenu = document.getElementById("footerCategoriesMenu");
const PRODUCTS_PER_BATCH = 9;

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

function getProductImageUrl(product) {
    return product.images?.[0]?.imageUrl || product.imageUrl || "/img/tabua-produto01.webp";
}

function getProductUrl(product) {
    return `/produto/${encodeURIComponent(product.slug || "")}`;
}

function setupProductCardNavigation() {
    const isInteractiveElement = (target) => target.closest("a, button, input, select, textarea, label");

    document.addEventListener("click", (event) => {
        const card = event.target.closest(".js-product-card");

        if (!card || isInteractiveElement(event.target)) {
            return;
        }

        const productUrl = card.dataset.productUrl;

        if (productUrl) {
            window.location.href = productUrl;
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        const card = event.target.closest(".js-product-card");

        if (!card) {
            return;
        }

        event.preventDefault();

        const productUrl = card.dataset.productUrl;

        if (productUrl) {
            window.location.href = productUrl;
        }
    });
}

function buildProductCard(product) {
    const imageUrl = escapeHtml(getProductImageUrl(product));
    const productUrl = escapeHtml(getProductUrl(product));
    const name = escapeHtml(product.name || "");
    const price = formatCurrency(product.price);
    const compareAtPrice = product.compareAtPrice ? `<span class="price-compare">${formatCurrency(product.compareAtPrice)}</span>` : "";
    const installmentQuantity = product.installments?.quantity || 1;
    const installmentValue = product.installments?.value || product.price || 0;

    return `
        <div>
            <div class="produto-content item js-product-card" data-product-url="${productUrl}" role="link" tabindex="0" aria-label="Abrir produto ${name}">
                <a href="${productUrl}">
                    <img src="${imageUrl}" alt="${name}">
                </a>

                <div class="item-name-wrapper">
                    <a href="${productUrl}">
                        <span>${name}</span>
                    </a>
                </div>

                <div class="item-price-container">
                    <div class="item-featured-price">
                        ${compareAtPrice}
                        <span class="item-price">${price}</span>
                    </div>

                    <div class="card-parcelamento">
                        <i class="fa-regular fa-credit-card icone-parcela"></i>
                        <div class="max-installments-container">
                            <span>${installmentQuantity}</span>
                            <span> x de </span>
                            <span class="product-installment-value">${formatCurrency(installmentValue)}</span>
                            <span class="sem-juros">sem juros</span>
                        </div>
                    </div>

                    <div class="mt-2">
                        <a href="${productUrl}" class="add-to-cart">
                            <svg class="icone-carrinho" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>
                            <span>COMPRAR</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPaginatedProductGrid(gridElement, products, renderProductMarkup) {
    if (!gridElement) {
        return;
    }

    const allProducts = Array.isArray(products) ? products : [];
    let visibleCount = Math.min(PRODUCTS_PER_BATCH, allProducts.length);
    let loadMoreButton = gridElement.nextElementSibling;

    if (!loadMoreButton || !loadMoreButton.classList.contains("products-load-more")) {
        loadMoreButton = document.createElement("button");
        loadMoreButton.type = "button";
        loadMoreButton.className = "products-load-more";
        loadMoreButton.textContent = "Ver mais";
        loadMoreButton.hidden = true;
        gridElement.insertAdjacentElement("afterend", loadMoreButton);
    }

    function render() {
        gridElement.innerHTML = allProducts
            .slice(0, visibleCount)
            .map((product) => renderProductMarkup(product))
            .join("");

        loadMoreButton.hidden = visibleCount >= allProducts.length;
    }

    loadMoreButton.onclick = () => {
        visibleCount = Math.min(visibleCount + PRODUCTS_PER_BATCH, allProducts.length);
        render();
    };

    render();
}

function hideProductGridLoadMoreButton(gridElement) {
    const loadMoreButton = gridElement?.nextElementSibling;

    if (loadMoreButton?.classList.contains("products-load-more")) {
        loadMoreButton.hidden = true;
    }
}

async function loadCategoryPage() {
    const feedback = document.getElementById("categoryPageFeedback");
    const shell = document.getElementById("categoryDetailShell");
    const skeleton = document.getElementById("categorySkeleton");
    const slug = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || "");

    try {
        const response = await fetch(`/api/categories/${encodeURIComponent(slug)}`);

        if (!response.ok) {
            throw new Error("Não foi possível carregar a categoria.");
        }

        const category = await response.json();
        const categoryName = document.getElementById("categoryName");
        const categoryImage = document.getElementById("categoryImage");
        const categoryProductCount = document.getElementById("categoryProductCount");
        const categoryProductsGrid = document.getElementById("categoryProductsGrid");

        document.title = `${category.name || "Categoria"} | Arteno`;
        categoryName.textContent = category.name || "Categoria";
        categoryImage.src = category.imageUrl || "/img/categoria1-img.webp";
        categoryImage.alt = category.name || "Categoria";
        categoryProductCount.textContent = `${Number(category.productsCount || category.products?.length || 0)} produtos nesta categoria`;

        if (category.products?.length) {
            renderPaginatedProductGrid(categoryProductsGrid, category.products, buildProductCard);
        } else {
            categoryProductsGrid.innerHTML = `<p class="category-page-empty">Nenhum produto ativo está vinculado a esta categoria.</p>`;
        }

        if (skeleton) {
            skeleton.hidden = true;
        }

        shell.hidden = false;
    } catch (error) {
        if (skeleton) {
            skeleton.hidden = true;
        }

        feedback.hidden = false;
        feedback.textContent = error.message;
    }
}

updateCartCount();
loadSharedCategories();
loadCategoryPage();
setupProductCardNavigation();
