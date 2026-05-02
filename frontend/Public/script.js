// ============================================
// Meta Pixel Event Tracking Helper
// ============================================
window.trackMetaPixelEvent = function (eventName, params = {}) {
    try {
        if (typeof window.fbq !== "function") {
            return;
        }

        const safeParams = {
            ...params,
            currency: String(params.currency || "BRL"),
            value: Number(params.value || 0)
        };

        window.fbq("track", eventName, safeParams);
    } catch (_error) {
        // Silencia erros do pixel para não impactar a experiência do usuário
        console.debug(`Pixel tracking error for ${eventName}:`, _error);
    }
};

const menuIcon = document.querySelector(".menu-icon");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");
const produtos = document.getElementById("abrir-submenu");
const desktopCategoriesMenu = document.getElementById("desktopCategoriesMenu");
const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");
const footerCategoriesMenu = document.getElementById("footerCategoriesMenu");

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

const swiper = new Swiper(".mySwiper", {
    slidesPerView: 1,
    spaceBetween: 20,
    pagination: {
        el: ".swiper-pagination",
        clickable: true,
        enabled: true
    },
    navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
        enabled: false
    },
    breakpoints: {
        991: {
            slidesPerView: 3,
            slidesPerGroup: 3,
            pagination: {
                enabled: false
            },
            navigation: {
                enabled: true
            }
        },
        1198: {
            slidesPerView: 4,
            slidesPerGroup: 4,
            pagination: {
                enabled: false
            },
            navigation: {
                enabled: true
            }
        }
    }
});

let categoriesSwiper = null;

let productCardsSwiper = null;
let homeBannerSwiper = null;
const PRODUCTS_PER_BATCH = 9;

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(value || 0));
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getProductImageUrl(product) {
    return product.images?.[0]?.imageUrl || product.imageUrl || "/img/tabua-produto01.webp";
}

function getProductUrl(product) {
    return `/produto/${encodeURIComponent(product.slug || "")}`;
}

function getCategoryUrl(category) {
    return `/categoria/${encodeURIComponent(category.slug || "")}`;
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

function buildProductCard(product, { slide = false } = {}) {
    const imageUrl = escapeHtml(getProductImageUrl(product));
    const productUrl = escapeHtml(getProductUrl(product));
    const name = escapeHtml(product.name || "");
    const price = formatCurrency(product.price);
    const rawPrice = Number(product.price || 0);
    const rawCompareAtPrice = Number(product.compareAtPrice || 0);
    const discountPercent = rawCompareAtPrice > rawPrice && rawPrice > 0
        ? Math.round(((rawCompareAtPrice - rawPrice) / rawCompareAtPrice) * 100)
        : 0;
    const compareAtPrice = product.compareAtPrice ? `<span class="price-compare">${formatCurrency(product.compareAtPrice)}</span>` : "";
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

    if (slide) {
        return `<div class="swiper-slide">${cardMarkup}</div>`;
    }

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

function buildCategoryCard(category) {
    const categoryUrl = escapeHtml(getCategoryUrl(category));
    const imageUrl = escapeHtml(category.imageUrl || "/img/categoria1-img.webp");
    const name = escapeHtml(category.name || "Categoria");

    return `
        <div class="swiper-slide">
            <a href="${categoryUrl}">
                <div class="card categories-cards">
                    <img src="${imageUrl}" alt="${name}">
                    <p>${name}</p>
                </div>
            </a>
        </div>
    `;
}

function buildHomeBannerSlideMarkup(banner) {
    const desktopImageUrl = escapeHtml(banner.desktopImageUrl || banner.imageUrl || "");
    const mobileImageUrl = escapeHtml(banner.mobileImageUrl || banner.desktopImageUrl || banner.imageUrl || "");
    const altText = escapeHtml(banner.name || "Banner principal");
    const linkUrl = String(banner.linkUrl || "").trim();
    const imageMarkup = `
        <picture>
            <source media="(max-width: 768px)" srcset="${mobileImageUrl}">
            <img src="${desktopImageUrl}" alt="${altText}">
        </picture>
    `;

    return `
        <div class="swiper-slide">
            ${linkUrl ? `<a href="${escapeHtml(linkUrl)}" class="banner-slide-link">${imageMarkup}</a>` : imageMarkup}
        </div>
    `;
}

function initHomeBannerSwiper(slidesCount) {
    const sliderElement = document.getElementById("homeBannerSwiper");
    const prevButton = document.getElementById("homeBannerPrev");
    const nextButton = document.getElementById("homeBannerNext");
    const shouldEnableNavigation = slidesCount > 1;

    if (!sliderElement || !prevButton || !nextButton) {
        return;
    }

    prevButton.hidden = !shouldEnableNavigation;
    nextButton.hidden = !shouldEnableNavigation;

    if (homeBannerSwiper) {
        homeBannerSwiper.destroy(true, true);
        homeBannerSwiper = null;
    }

    if (!slidesCount) {
        return;
    }

    homeBannerSwiper = new Swiper("#homeBannerSwiper", {
        loop: shouldEnableNavigation,
        slidesPerView: 1,
        spaceBetween: 0,
        navigation: {
            nextEl: "#homeBannerNext",
            prevEl: "#homeBannerPrev",
            enabled: shouldEnableNavigation
        }
    });
}

async function loadHomeBanners() {
    const bannerSection = document.querySelector(".banner");
    const slidesContainer = document.getElementById("homeBannerSlides");

    if (!slidesContainer || !bannerSection) {
        return;
    }

    try {
        const response = await fetch("/api/site-settings/banners");

        if (!response.ok) {
            throw new Error("Não foi possível carregar os banners da home.");
        }

        const result = await response.json();
        const banners = Array.isArray(result.banners) ? result.banners : [];

        if (banners.length) {
            slidesContainer.innerHTML = banners.map((banner) => buildHomeBannerSlideMarkup(banner)).join("");
            bannerSection.hidden = false;
            initHomeBannerSwiper(banners.length);
            return;
        }
    } catch (error) {
        console.error("Erro ao carregar banners da home:", error);
    }

    slidesContainer.innerHTML = "";
    bannerSection.hidden = true;
}

function initCategoriesSwiper() {
    const sliderElement = document.querySelector(".produtosSwiper");

    if (!sliderElement) {
        return;
    }

    if (categoriesSwiper) {
        categoriesSwiper.destroy(true, true);
    }

    categoriesSwiper = new Swiper(".produtosSwiper", {
        grabCursor: true,
        slidesPerView: 3,
        pagination: {
            el: ".produtosSwiper .swiper-pagination",
            clickable: true
        },
        breakpoints: {
            768: {
                slidesPerView: "auto",
                allowTouchMove: false
            }
        }
    });
}

function initProductCardsSwiper(slidesCount) {
    const sliderElement = document.querySelector(".productCardsSwiper");

    if (!sliderElement) {
        return;
    }

    if (productCardsSwiper) {
        productCardsSwiper.destroy(true, true);
    }

    productCardsSwiper = new Swiper(".productCardsSwiper", {
        loop: slidesCount > 3,
        slidesPerView: 2,
        slidesPerGroup: 1,
        spaceBetween: 15,
        observer: true,
        observeParents: true,
        updateOnWindowResize: true,
        watchOverflow: true,
        pagination: {
            el: ".product-cards-pagination",
            clickable: true
        },
        navigation: {
            nextEl: ".product-cards-next",
            prevEl: ".product-cards-prev"
        },
        breakpoints: {
            0: {
                slidesPerView: 2,
                spaceBetween: 15
            },
            640: {
                slidesPerView: 2,
                spaceBetween: 15
            },
            768: {
                slidesPerView: 3,
                spaceBetween: 15
            },
            992: {
                slidesPerView: 3,
                spaceBetween: 15
            }
        }
    });
}

async function loadStoreProducts() {
    const featuredGrid = document.getElementById("featuredProductsGrid");
    const dynamicProductCarousel = document.getElementById("dynamicProductCarousel");

    if (!featuredGrid || !dynamicProductCarousel) {
        initProductCardsSwiper(dynamicProductCarousel?.children.length || 0);
        return;
    }

    try {
        const [allResponse, featuredResponse] = await Promise.all([
            fetch("/api/products"),
            fetch("/api/products/featured")
        ]);

        if (!allResponse.ok || !featuredResponse.ok) {
            throw new Error("Não foi possível carregar os produtos da loja.");
        }

        const allProducts = await allResponse.json();
        const featuredProducts = await featuredResponse.json();
        const productsForGrid = featuredProducts;
        const productsForçarousel = allProducts
            .filter((product) => Boolean(product.showInMoreOptions))
            .slice(0, 12);

        renderPaginatedProductGrid(featuredGrid, productsForGrid, (product) => buildProductCard(product));

        dynamicProductCarousel.innerHTML = productsForçarousel.map((product) => buildProductCard(product, { slide: true })).join("");

        initProductCardsSwiper(productsForçarousel.length);
    } catch (error) {
        console.error("Erro ao renderizar produtos:", error);
        initProductCardsSwiper(dynamicProductCarousel.children.length);
    }
}

async function loadStoreCategories() {
    const categoriesCarousel = document.getElementById("categoriesCarousel");

    try {
        const response = await fetch("/api/categories");

        if (!response.ok) {
            throw new Error("Não foi possível carregar as categorias.");
        }

        const categories = await response.json();
        renderSharedCategories(categories);

        if (categoriesCarousel && categories.length) {
            categoriesCarousel.innerHTML = categories.map((category) => buildCategoryCard(category)).join("");
        }

        initCategoriesSwiper();
    } catch (error) {
        console.error("Erro ao renderizar categorias:", error);
        initCategoriesSwiper();
    }
}

loadStoreCategories();
loadHomeBanners();
loadStoreProducts();
setupProductCardNavigation();

const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach((item) => {
    const button = item.querySelector(".faq-question");

    button.addEventListener("click", () => {
        const isActive = item.classList.contains("active");

        faqItems.forEach((faqItem) => {
            faqItem.classList.remove("active");
            faqItem.querySelector(".faq-question").setAttribute("aria-expanded", "false");
        });

        if (!isActive) {
            item.classList.add("active");
            button.setAttribute("aria-expanded", "true");
        }
    });
});

const elementos = document.querySelectorAll(".animar");

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("ativo");
        } else {
            entry.target.classList.remove("ativo");
        }
    });
}, {
    threshold: 0.2
});

elementos.forEach((el) => observer.observe(el));
