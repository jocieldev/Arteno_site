const menuIcon = document.querySelector(".menu-icon");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");
const produtos = document.getElementById("abrir-submenu");
const cartCount = document.getElementById("cart-count");
const desktopCategoriesMenu = document.getElementById("desktopCategoriesMenu");
const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");
const footerCategoriesMenu = document.getElementById("footerCategoriesMenu");
const searchSummary = document.getElementById("searchSummary");
const searchResultsGrid = document.getElementById("searchResultsGrid");
const searchEmptyState = document.getElementById("searchEmptyState");
const searchPageHeaderInput = document.querySelector(".search-container input");
const searchFiltersForm = document.getElementById("searchFiltersForm");
const searchCategoryFilter = document.getElementById("searchCategoryFilter");
const searchMinPriceFilter = document.getElementById("searchMinPriceFilter");
const searchMaxPriceFilter = document.getElementById("searchMaxPriceFilter");
const searchSortFilter = document.getElementById("searchSortFilter");
const searchPersonalizableFilter = document.getElementById("searchPersonalizableFilter");
const searchClearFiltersButton = document.getElementById("searchClearFiltersButton");
const searchOpenFiltersButton = document.getElementById("searchOpenFiltersButton");
const searchOpenFiltersInlineButton = document.getElementById("searchOpenFiltersInlineButton");
const searchCloseFiltersButton = document.getElementById("searchCloseFiltersButton");
const searchFiltersBackdrop = document.getElementById("searchFiltersBackdrop");
const searchActiveFiltersBar = document.getElementById("searchActiveFiltersBar");
const searchActiveFiltersChips = document.getElementById("searchActiveFiltersChips");
const searchClearAllChipsButton = document.getElementById("searchClearAllChipsButton");

const PRODUCTS_PER_BATCH = 9;
let sharedCategoriesCache = [];

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

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(value || 0));
}

function getCategoryUrl(category) {
    return `/categoria/${encodeURIComponent(category.slug || "")}`;
}

function getProductUrl(product) {
    return `/produto/${encodeURIComponent(product.slug || "")}`;
}

function getProductImageUrl(product) {
    return product.images?.[0]?.imageUrl || product.imageUrl || "/img/tabua-produto01.webp";
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
    sharedCategoriesCache = Array.isArray(categories) ? categories : [];

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

function readSearchFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);

    return {
        term: String(params.get("q") || "").trim(),
        category: String(params.get("category") || "").trim(),
        minPrice: String(params.get("minPrice") || "").trim(),
        maxPrice: String(params.get("maxPrice") || "").trim(),
        personalizable: params.get("personalizable") === "true",
        sort: String(params.get("sort") || "").trim()
    };
}

function populateSearchCategoryFilter(categories = []) {
    if (!searchCategoryFilter) {
        return;
    }

    const currentValue = searchCategoryFilter.value;
    const filterOptionsMarkup = categories
        .map((category) => `<option value="${escapeHtml(category.slug || "")}">${escapeHtml(category.name || "Categoria")}</option>`)
        .join("");

    searchCategoryFilter.innerHTML = `<option value="">Todas</option>${filterOptionsMarkup}`;
    searchCategoryFilter.value = currentValue || readSearchFiltersFromUrl().category || "";
}

function syncSearchFilterForm() {
    const filters = readSearchFiltersFromUrl();

    if (searchPageHeaderInput) {
        searchPageHeaderInput.value = filters.term;
    }

    if (searchCategoryFilter) {
        searchCategoryFilter.value = filters.category;
    }

    if (searchMinPriceFilter) {
        searchMinPriceFilter.value = filters.minPrice;
    }

    if (searchMaxPriceFilter) {
        searchMaxPriceFilter.value = filters.maxPrice;
    }

    if (searchSortFilter) {
        searchSortFilter.value = filters.sort;
    }

    if (searchPersonalizableFilter) {
        searchPersonalizableFilter.checked = filters.personalizable;
    }
}

function buildSearchQueryString() {
    const params = new URLSearchParams();
    const currentFilters = readSearchFiltersFromUrl();
    const sourceTerm = searchPageHeaderInput ? searchPageHeaderInput.value : currentFilters.term;
    const term = String(sourceTerm || "").trim();

    if (term) {
        params.set("q", term);
    }

    if (searchCategoryFilter?.value) {
        params.set("category", searchCategoryFilter.value);
    }

    if (searchMinPriceFilter?.value) {
        params.set("minPrice", searchMinPriceFilter.value);
    }

    if (searchMaxPriceFilter?.value) {
        params.set("maxPrice", searchMaxPriceFilter.value);
    }

    if (searchPersonalizableFilter?.checked) {
        params.set("personalizable", "true");
    }

    if (searchSortFilter?.value) {
        params.set("sort", searchSortFilter.value);
    }

    return params.toString();
}

function isSearchMobileLayout() {
    return window.matchMedia("(max-width: 991px)").matches;
}

function openSearchFiltersDrawer() {
    if (!searchFiltersForm || !isSearchMobileLayout()) {
        return;
    }

    searchFiltersForm.classList.add("is-open");

    if (searchFiltersBackdrop) {
        searchFiltersBackdrop.hidden = false;
    }

    document.body.classList.add("filters-drawer-open");
}

function closeSearchFiltersDrawer() {
    if (!searchFiltersForm) {
        return;
    }

    searchFiltersForm.classList.remove("is-open");

    if (searchFiltersBackdrop) {
        searchFiltersBackdrop.hidden = true;
    }

    document.body.classList.remove("filters-drawer-open");
}

function updateSearchPageUrl() {
    const queryString = buildSearchQueryString();
    const nextUrl = queryString ? `/busca?${queryString}` : "/busca";

    window.history.replaceState({}, "", nextUrl);
}

function bindSearchFilterForm() {
    if (searchFiltersForm) {
        searchFiltersForm.addEventListener("submit", (event) => {
            event.preventDefault();
            updateSearchPageUrl();
            closeSearchFiltersDrawer();
            loadSearchResults();
        });
    }

    if (searchClearFiltersButton) {
        searchClearFiltersButton.addEventListener("click", () => {
            if (searchCategoryFilter) {
                searchCategoryFilter.value = "";
            }

            if (searchMinPriceFilter) {
                searchMinPriceFilter.value = "";
            }

            if (searchMaxPriceFilter) {
                searchMaxPriceFilter.value = "";
            }

            if (searchSortFilter) {
                searchSortFilter.value = "";
            }

            if (searchPersonalizableFilter) {
                searchPersonalizableFilter.checked = false;
            }

            updateSearchPageUrl();
            syncSearchFilterForm();
            closeSearchFiltersDrawer();
            loadSearchResults();
        });
    }

    [searchOpenFiltersButton, searchOpenFiltersInlineButton].forEach((button) => {
        if (!button) {
            return;
        }

        button.addEventListener("click", openSearchFiltersDrawer);
    });

    if (searchCloseFiltersButton) {
        searchCloseFiltersButton.addEventListener("click", closeSearchFiltersDrawer);
    }

    if (searchFiltersBackdrop) {
        searchFiltersBackdrop.addEventListener("click", closeSearchFiltersDrawer);
    }

    if (searchClearAllChipsButton) {
        searchClearAllChipsButton.addEventListener("click", () => {
            if (searchCategoryFilter) {
                searchCategoryFilter.value = "";
            }

            if (searchMinPriceFilter) {
                searchMinPriceFilter.value = "";
            }

            if (searchMaxPriceFilter) {
                searchMaxPriceFilter.value = "";
            }

            if (searchSortFilter) {
                searchSortFilter.value = "";
            }

            if (searchPersonalizableFilter) {
                searchPersonalizableFilter.checked = false;
            }

            updateSearchPageUrl();
            syncSearchFilterForm();
            renderSearchActiveFilterChips();
            loadSearchResults();
        });
    }

    if (searchActiveFiltersChips) {
        searchActiveFiltersChips.addEventListener("click", (event) => {
            const button = event.target.closest("[data-filter-key]");

            if (!button) {
                return;
            }

            const filterKey = button.dataset.filterKey;

            if (filterKey === "category" && searchCategoryFilter) {
                searchCategoryFilter.value = "";
            }

            if (filterKey === "minPrice" && searchMinPriceFilter) {
                searchMinPriceFilter.value = "";
            }

            if (filterKey === "maxPrice" && searchMaxPriceFilter) {
                searchMaxPriceFilter.value = "";
            }

            if (filterKey === "sort" && searchSortFilter) {
                searchSortFilter.value = "";
            }

            if (filterKey === "personalizable" && searchPersonalizableFilter) {
                searchPersonalizableFilter.checked = false;
            }

            updateSearchPageUrl();
            syncSearchFilterForm();
            renderSearchActiveFilterChips();
            loadSearchResults();
        });
    }

    window.addEventListener("resize", () => {
        if (!isSearchMobileLayout()) {
            closeSearchFiltersDrawer();
        }
    });
}

async function loadSharedCategories() {
    try {
        const response = await fetch("/api/categories");

        if (!response.ok) {
            throw new Error("Não foi possível carregar as categorias.");
        }

        const categories = await response.json();
        renderSharedCategories(categories);
        populateSearchCategoryFilter(categories);
        syncSearchFilterForm();
        renderSearchActiveFilterChips();
    } catch (error) {
        console.error("Erro ao carregar categorias compartilhadas:", error);
    }
}

function clearSearchSkeleton() {
    if (!searchResultsGrid) {
        return;
    }

    if (searchResultsGrid.querySelector(".search-skeleton-card")) {
        searchResultsGrid.innerHTML = "";
    }
}

function buildSearchActiveFilterItems() {
    const filters = readSearchFiltersFromUrl();
    const activeFilters = [];

    if (filters.category) {
        const categoryName = sharedCategoriesCache.find((category) => String(category.slug || "") === filters.category)?.name || filters.category;
        activeFilters.push({ key: "category", label: `Categoria: ${categoryName}` });
    }

    if (filters.minPrice) {
        activeFilters.push({ key: "minPrice", label: `Min: ${formatCurrency(filters.minPrice)}` });
    }

    if (filters.maxPrice) {
        activeFilters.push({ key: "maxPrice", label: `Max: ${formatCurrency(filters.maxPrice)}` });
    }

    if (filters.sort === "price_asc") {
        activeFilters.push({ key: "sort", label: "Menor preço" });
    } else if (filters.sort === "price_desc") {
        activeFilters.push({ key: "sort", label: "Maior preço" });
    }

    if (filters.personalizable) {
        activeFilters.push({ key: "personalizable", label: "Personalizável" });
    }

    return activeFilters;
}

function renderSearchActiveFilterChips() {
    if (!searchActiveFiltersBar || !searchActiveFiltersChips) {
        return;
    }

    const activeFilters = buildSearchActiveFilterItems();

    if (!activeFilters.length) {
        searchActiveFiltersBar.hidden = true;
        searchActiveFiltersChips.innerHTML = "";
        return;
    }

    searchActiveFiltersBar.hidden = false;
    searchActiveFiltersChips.innerHTML = activeFilters.map((filter) => `
        <button type="button" class="active-filter-chip" data-filter-key="${escapeHtml(filter.key)}">
            <span>${escapeHtml(filter.label)}</span>
            <i class="fa-solid fa-xmark"></i>
        </button>
    `).join("");
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
    const rawPrice = Number(product.price || 0);
    const rawCompareAtPrice = Number(product.compareAtPrice || 0);
    const discountPercent = rawCompareAtPrice > rawPrice && rawPrice > 0
        ? Math.round(((rawCompareAtPrice - rawPrice) / rawCompareAtPrice) * 100)
        : 0;
    const compareAtPrice = product.compareAtPrice
        ? `<span class="price-compare">${formatCurrency(product.compareAtPrice)}</span>`
        : "";
    const discountBadge = discountPercent > 0
        ? `<span class="product-discount-badge">${discountPercent}% OFF</span>`
        : "";
    const installmentQuantity = product.installments?.quantity || 1;
    const installmentValue = product.installments?.value || product.price || 0;

    const cardMarkup = `
        <div class="produto-content item js-product-card" data-product-url="${productUrl}" role="link" tabindex="0" aria-label="Abrir produto ${name}">
            ${discountBadge}
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
    `;

    return `<div>${cardMarkup}</div>`;
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

async function loadSearchResults() {
    const filters = readSearchFiltersFromUrl();
    const term = filters.term;
    syncSearchFilterForm();
    renderSearchActiveFilterChips();

    if (!term) {
        clearSearchSkeleton();

        if (searchSummary) {
            searchSummary.textContent = "Digite o nome de um produto, categoria ou palavra relacionada para pesquisar.";
        }

        if (searchResultsGrid) {
            searchResultsGrid.innerHTML = "";
        }

        if (searchEmptyState) {
            searchEmptyState.hidden = false;
            searchEmptyState.textContent = "Nenhum termo informado para a pesquisa.";
        }

        return;
    }

    try {
        const response = await fetch(`/api/products?${buildSearchQueryString()}`);

        if (!response.ok) {
            throw new Error("Não foi possível carregar os resultados da pesquisa.");
        }

        const products = await response.json();
        clearSearchSkeleton();

        if (searchSummary) {
            const filterHighlights = [];

            if (filters.category) {
                const categoryName = sharedCategoriesCache.find((category) => String(category.slug || "") === filters.category)?.name || filters.category;
                filterHighlights.push(`categoria ${categoryName}`);
            }

            if (filters.personalizable) {
                filterHighlights.push("personalizáveis");
            }

            searchSummary.textContent = filterHighlights.length
                ? `${products.length} resultado(s) para "${term}" com filtros de ${filterHighlights.join(", ")}.`
                : `${products.length} resultado(s) para "${term}".`;
        }

        if (products.length) {
            renderPaginatedProductGrid(searchResultsGrid, products, buildProductCard);

            if (searchEmptyState) {
                searchEmptyState.hidden = true;
            }

            return;
        }

        if (searchResultsGrid) {
            searchResultsGrid.innerHTML = "";
        }

        if (searchEmptyState) {
            searchEmptyState.hidden = false;
            searchEmptyState.textContent = `Nenhum produto foi encontrado para "${term}".`;
        }
    } catch (error) {
        console.error("Erro ao buscar resultados:", error);
        clearSearchSkeleton();

        if (searchResultsGrid) {
            searchResultsGrid.innerHTML = "";
        }

        if (searchEmptyState) {
            searchEmptyState.hidden = false;
            searchEmptyState.textContent = "Não foi possível carregar os resultados agora.";
        }
    }
}

updateCartCount();
bindSearchFilterForm();
loadSharedCategories();
loadSearchResults();
setupProductCardNavigation();
