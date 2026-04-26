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
let sharedCategoriesCache = [];

let currentProduct = null;
let currentProductImages = [];
let currentImageIndex = 0;
let galleryTouchStartX = 0;
let galleryTouchStartY = 0;
let galleryTouchActive = false;
let shippingQuoteRequestInFlight = false;
let selectedPersonalizationOverlayImagesByPreview = {};
let uploadedPersonalizationOverlayImagesByPreview = {};
let uploadedPersonalizationOverlayObjectUrlsByPreview = {};
let personalizationImageUploadRequestInFlight = false;
let activePersonalizationControlPanel = "text";
let activePersonalizationPreviewIndex = 0;
let personalizationPreviewRenderRequestId = 0;
let addToCartButtonSuccessTimeoutId = null;
let addToCartInteractionLocked = false;
let buyNowRequestInFlight = false;
let selectedProductVariationItems = {};
let activeProductLoadRequestId = 0;
const SHIPPING_ZIP_STORAGE_KEY = "arteno-shipping-zip-code";
let personalizationAdjustmentsByPreview = {};

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

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function decodeCartStateFromQuery() {
    try {
        const params = new URLSearchParams(window.location.search);
        const encodedState = String(params.get("cartState") || "").trim();

        if (!encodedState) {
            return null;
        }

        return JSON.parse(decodeURIComponent(escape(window.atob(encodedState))));
    } catch (_error) {
        return null;
    }
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

function getStoredCartItems() {
    try {
        const rawValue = window.localStorage.getItem("arteno-cart");
        const parsedValue = JSON.parse(rawValue || "[]");
        return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (_error) {
        return [];
    }
}

function setStoredCartItems(items) {
    window.localStorage.setItem("arteno-cart", JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cart:updated"));
}

function updateCartCount() {
    if (!cartCount) {
        return;
    }

    const totalItems = getStoredCartItems().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    cartCount.textContent = String(totalItems);
}

function getProductImages(product) {
    if (Array.isArray(product?.images) && product.images.length) {
        return product.images.filter((image) => image?.imageUrl);
    }

    if (product?.imageUrl) {
        return [{ imageUrl: product.imageUrl }];
    }

    return [{ imageUrl: "/img/tabua-produto01.webp" }];
}

function getStockQuantity(product) {
    if (product.stock?.mode === "limited") {
        return Math.max(0, Number(product.stock?.quantity || 0));
    }

    return null;
}

function getStockText(product) {
    if (product.stock?.mode === "limited") {
        const quantity = getStockQuantity(product);

        if (quantity <= 0) {
            return "Produto indisponível no momento";
        }

        return `${quantity} unidades disponíveis`;
    }

    return "";
}

function getQuantityInput() {
    return document.getElementById("productQuantityInput");
}

function normalizeQuantity(value) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.floor(parsedValue) : 1;
}

function getSelectedQuantity() {
    const quantityInput = getQuantityInput();
    return normalizeQuantity(quantityInput?.value || 1);
}

function getProductVariationGroups(product = currentProduct) {
    if (!Array.isArray(product?.variations)) {
        return [];
    }

    return product.variations
        .map((variation = {}) => {
            const type = variation.type === "color" ? "color" : "custom";
            const name = type === "color"
                ? "Cor"
                : String(variation.name || "").trim();
            const items = Array.isArray(variation.items)
                ? variation.items
                    .map((item = {}) => {
                        const label = String(item.label || "").trim();

                        if (!label) {
                            return null;
                        }

                        return {
                            id: String(item.id || "").trim(),
                            label,
                            colorHex: type === "color" ? String(item.colorHex || "#d1d5db").trim() : "",
                            price: item.price === null || item.price === undefined || item.price === ""
                                ? null
                                : Number(item.price),
                            imageUrl: type === "custom" ? String(item.imageUrl || "").trim() : "",
                            previewImageUrl: String(item.previewImageUrl || "").trim()
                        };
                    })
                    .filter(Boolean)
                : [];

            if (!name || !items.length) {
                return null;
            }

            return {
                id: String(variation.id || "").trim(),
                type,
                name,
                items
            };
        })
        .filter(Boolean);
}

function getSelectedProductVariations(product = currentProduct) {
    return getProductVariationGroups(product)
        .map((variation) => {
            const selectedItemId = selectedProductVariationItems[variation.id];
            const selectedItem = variation.items.find((item) => item.id === selectedItemId);

            if (!selectedItem) {
                return null;
            }

            return {
                variationId: variation.id,
                variationType: variation.type,
                variationName: variation.name,
                itemId: selectedItem.id,
                itemLabel: selectedItem.label,
                colorHex: selectedItem.colorHex || "",
                price: selectedItem.price,
                imageUrl: selectedItem.imageUrl || "",
                previewImageUrl: selectedItem.previewImageUrl || ""
            };
        })
        .filter(Boolean);
}

function getSelectedVariationPreviewImage(product = currentProduct) {
    const selectedVariations = getSelectedProductVariations(product);
    const variationWithPreviewImage = selectedVariations.find((variation) => variation.previewImageUrl);

    return variationWithPreviewImage?.previewImageUrl || "";
}

function getCurrentProductDisplayPrice(product = currentProduct) {
    const selectedVariations = getSelectedProductVariations(product);
    const variationWithOwnPrice = selectedVariations.find((variation) => variation.price !== null && variation.price !== undefined);

    if (variationWithOwnPrice) {
        return Number(variationWithOwnPrice.price || 0);
    }

    return Number(product?.price || 0);
}

function updateDisplayedProductPricing(product = currentProduct) {
    const productPrice = document.getElementById("productPrice");
    const productInstallments = document.getElementById("productInstallments");
    const finalPrice = getCurrentProductDisplayPrice(product);
    const installmentQuantity = Math.max(1, Number(product?.installments?.quantity || 1));
    const installmentValue = finalPrice / installmentQuantity;

    if (productPrice) {
        productPrice.textContent = formatCurrency(finalPrice);
    }

    if (productInstallments) {
        productInstallments.textContent = `${installmentQuantity}x de ${formatCurrency(installmentValue)} sem juros`;
    }
}

function getSelectedProductVariationSignature(product = currentProduct) {
    return getSelectedProductVariations(product)
        .map((variation) => `${variation.variationId}:${variation.itemId}`)
        .sort()
        .join("|");
}

function renderProductVariationSelectors(product = currentProduct) {
    const variationWrap = document.getElementById("productVariationWrap");
    const variationGroupsElement = document.getElementById("productVariationGroups");
    const variations = getProductVariationGroups(product);

    if (!variationWrap || !variationGroupsElement) {
        return;
    }

    if (!variations.length) {
        variationWrap.hidden = true;
        variationGroupsElement.innerHTML = "";
        return;
    }

    variationWrap.hidden = false;
    variationGroupsElement.innerHTML = variations.map((variation) => `
        <section class="product-page-variation-group" data-variation-id="${escapeHtml(variation.id)}">
            <div class="product-page-variation-label">
                <span class="product-page-field-label">${escapeHtml(variation.name)}</span>
                <span class="product-page-variation-required">Selecione uma opção</span>
            </div>
            <div class="product-page-variation-options">
                ${variation.items.map((item) => {
        const isSelected = selectedProductVariationItems[variation.id] === item.id;
        const shouldShowLabelBelow = variation.type === "color" || Boolean(item.imageUrl);
        const visualContent = variation.type === "color"
            ? `<span class="product-page-variation-option-color" style="background:${escapeHtml(item.colorHex || "#d1d5db")}"></span>`
            : (
                item.imageUrl
                    ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.label)}">`
                    : `<span class="product-page-variation-option-fallback">${escapeHtml(item.label)}</span>`
            );

        return `
                        <button
                            type="button"
                            class="product-page-variation-option ${isSelected ? "is-selected" : ""}"
                            data-variation-select="true"
                            data-variation-id="${escapeHtml(variation.id)}"
                            data-variation-item-id="${escapeHtml(item.id)}"
                            aria-pressed="${isSelected ? "true" : "false"}"
                        >
                            <span class="product-page-variation-option-box">${visualContent}</span>
                            ${shouldShowLabelBelow ? `<span class="product-page-variation-option-name">${escapeHtml(item.label)}${item.price !== null && item.price !== undefined ? ` (${escapeHtml(formatCurrency(item.price))})` : ""}</span>` : ""}
                        </button>
                    `;
    }).join("")}
            </div>
        </section>
    `).join("");
}

function validateProductVariationSelections(product = currentProduct) {
    const variations = getProductVariationGroups(product);

    if (!variations.length) {
        return true;
    }

    const missingVariation = variations.find((variation) => !selectedProductVariationItems[variation.id]);

    if (!missingVariation) {
        return true;
    }

    showCartFeedback(`Selecione uma opção em "${missingVariation.name}" antes de continuar.`, "error");
    return false;
}

function getPersonalizationInput() {
    return document.getElementById("productPersonalizationInput");
}

function getSelectedPersonalizationName() {
    const input = getPersonalizationInput();
    return String(input?.value || "").trim();
}

function getPersonalizationPreviewElements() {
    return {
        wrap: document.getElementById("productPersonalizationPreview"),
        tabs: document.getElementById("productPersonalizationPreviewTabs"),
        image: document.getElementById("productPersonalizationPreviewImage"),
        overlayImage: document.getElementById("productPersonalizationOverlayImage"),
        text: document.getElementById("productPersonalizationPreviewText")
    };
}

function productRequiresPersonalizationName(product = currentProduct) {
    return Boolean(product?.personalization?.requireName ?? product?.personalization?.enabled);
}

function productHasPersonalizationContent(product = currentProduct) {
    const personalization = product?.personalization || {};
    const previewConfigs = getPersonalizationPreviewConfigs(product);

    return Boolean(
        productRequiresPersonalizationName(product) ||
        previewConfigs.length ||
        personalization.preview?.enabled ||
        personalization.imageOverlay?.enabled
    );
}

function normalizePersonalizationPreviewConfig(preview = {}, index = 0) {
    return {
        name: String(preview.name || preview.label || `Prévia ${index + 1}`),
        enabled: Boolean(preview.enabled),
        imageUrl: String(preview.imageUrl || ""),
        positionXPercent: Number(preview.positionXPercent ?? 50),
        positionYPercent: Number(preview.positionYPercent ?? 50),
        widthPercent: Number(preview.widthPercent ?? 60),
        allowCustomerAdjust: Boolean(preview.allowCustomerAdjust),
        fontSizePx: Number(preview.fontSizePx ?? 28),
        referenceWidthPx: Number(preview.referenceWidthPx ?? 0),
        sampleText: String(preview.sampleText || "Maria"),
        textColor: String(preview.textColor || "#ffffff"),
        fontFamily: String(preview.fontFamily || "'Georgia', 'Times New Roman', serif"),
        fontWeight: String(preview.fontWeight || "700"),
        letterSpacingEm: Number(preview.letterSpacingEm ?? 0.04),
        rotationDeg: Number(preview.rotationDeg ?? 0),
        textTransform: preview.textTransform === "none" ? "none" : "uppercase",
        textShadow: String(preview.textShadow || "0 2px 10px rgba(0, 0, 0, 0.35)")
    };
}

function getPersonalizationPreviewConfigs(product = currentProduct) {
    const previews = Array.isArray(product?.personalization?.previews)
        ? product.personalization.previews
            .filter((preview) => preview?.enabled || preview?.imageUrl)
            .map((preview, index) => normalizePersonalizationPreviewConfig(preview, index))
        : [];

    if (previews.length) {
        return previews;
    }

    const legacyPreview = normalizePersonalizationPreviewConfig(product?.personalization?.preview || {}, 0);
    return legacyPreview.enabled || legacyPreview.imageUrl ? [legacyPreview] : [];
}

function getPersonalizationPreviewConfig(product = currentProduct) {
    const previewConfigs = getPersonalizationPreviewConfigs(product);
    const nextIndex = Math.min(Math.max(activePersonalizationPreviewIndex, 0), Math.max(previewConfigs.length - 1, 0));
    activePersonalizationPreviewIndex = nextIndex;

    return previewConfigs[nextIndex] || normalizePersonalizationPreviewConfig({}, 0);
}

function getPersonalizationImageOverlayConfig(product = currentProduct) {
    const overlay = product?.personalization?.imageOverlay || {};

    return {
        enabled: Boolean(overlay.enabled),
        allowOptionImages: Boolean(overlay.allowOptionImages),
        requireSelection: Boolean(overlay.requireSelection),
        allowCustomerUpload: Boolean(overlay.allowCustomerUpload),
        optionImages: Boolean(overlay.allowOptionImages) && Array.isArray(overlay.optionImages) ? overlay.optionImages.filter((image) => image?.imageUrl) : [],
        positionXPercent: Number(overlay.positionXPercent ?? 50),
        positionYPercent: Number(overlay.positionYPercent ?? 50),
        maxWidthPercent: Number(overlay.maxWidthPercent ?? overlay.widthPercent ?? 34),
        maxHeightPercent: Number(overlay.maxHeightPercent ?? overlay.widthPercent ?? 34),
        isRound: Boolean(overlay.isRound),
        allowCustomerAdjust: Boolean(overlay.allowCustomerAdjust),
        rotationDeg: Number(overlay.rotationDeg ?? 0)
    };
}

function createDefaultPersonalizationAdjustments() {
    return {
        text: { offsetXPercent: 0, offsetYPercent: 0, scalePercent: 100 },
        image: { offsetXPercent: 0, offsetYPercent: 0, scalePercent: 100 }
    };
}

function resetPersonalizationAdjustments() {
    personalizationAdjustmentsByPreview = {};
}

function getCurrentPersonalizationAdjustments() {
    const previewKey = String(activePersonalizationPreviewIndex);

    if (!personalizationAdjustmentsByPreview[previewKey]) {
        personalizationAdjustmentsByPreview[previewKey] = createDefaultPersonalizationAdjustments();
    }

    return personalizationAdjustmentsByPreview[previewKey];
}

function getCurrentPersonalizationPreviewKey() {
    return String(activePersonalizationPreviewIndex);
}

function getUploadedPersonalizationOverlayImage(previewKey = getCurrentPersonalizationPreviewKey()) {
    return uploadedPersonalizationOverlayImagesByPreview[previewKey] || null;
}

function getSelectedPersonalizationOverlayImage(previewKey = getCurrentPersonalizationPreviewKey()) {
    return selectedPersonalizationOverlayImagesByPreview[previewKey] || null;
}

function setSelectedPersonalizationOverlayImage(image, previewKey = getCurrentPersonalizationPreviewKey()) {
    if (!image) {
        delete selectedPersonalizationOverlayImagesByPreview[previewKey];
        return;
    }

    selectedPersonalizationOverlayImagesByPreview[previewKey] = { ...image };
}

function setUploadedPersonalizationOverlayImage(image, previewKey = getCurrentPersonalizationPreviewKey()) {
    if (!image) {
        delete uploadedPersonalizationOverlayImagesByPreview[previewKey];
        return;
    }

    uploadedPersonalizationOverlayImagesByPreview[previewKey] = { ...image };
}

async function cleanupUploadedPersonalizationOverlayImages() {
    const previousUploadedImages = Object.values(uploadedPersonalizationOverlayImagesByPreview);
    const previousObjectUrls = Object.values(uploadedPersonalizationOverlayObjectUrlsByPreview);

    selectedPersonalizationOverlayImagesByPreview = {};
    uploadedPersonalizationOverlayImagesByPreview = {};
    uploadedPersonalizationOverlayObjectUrlsByPreview = {};

    if (window.personalizationImageStore?.deleteFile) {
        await Promise.all(previousUploadedImages.map(async (image) => {
            if (!image?.storageKey) {
                return;
            }

            try {
                await window.personalizationImageStore.deleteFile(image.storageKey);
            } catch (_error) {
                // Ignora falhas de limpeza local.
            }
        }));
    }

    previousObjectUrls.forEach((objectUrl) => {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }
    });
}

async function restoreUploadedOverlayImageFromStorage(preview = {}, previewKey = "0") {
    const storageKey = String(preview.overlayImageStorageKey || "").trim();

    if (!storageKey || !window.personalizationImageStore?.getFile) {
        return null;
    }

    const file = await window.personalizationImageStore.getFile(storageKey);

    if (!file) {
        return null;
    }

    if (uploadedPersonalizationOverlayObjectUrlsByPreview[previewKey]) {
        URL.revokeObjectURL(uploadedPersonalizationOverlayObjectUrlsByPreview[previewKey]);
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedPersonalizationOverlayObjectUrlsByPreview[previewKey] = objectUrl;

    return {
        id: `upload:${storageKey}`,
        kind: "upload",
        index: -1,
        imageUrl: objectUrl,
        imagePublicId: "",
        storageKey,
        name: String(file.name || "").trim()
    };
}

function restoreSelectedVariationsFromState(product = currentProduct, state = {}) {
    const variationGroups = getProductVariationGroups(product);
    const selectedVariations = Array.isArray(state.selectedVariations) ? state.selectedVariations : [];

    variationGroups.forEach((group) => {
        const matchedVariation = selectedVariations.find((variation) => (
            String(variation.variationId || "").trim() === group.id
            || String(variation.variationName || "").trim().toLowerCase() === group.name.toLowerCase()
        ));

        if (!matchedVariation) {
            return;
        }

        const matchedItem = group.items.find((item) => (
            String(matchedVariation.itemId || "").trim() === item.id
            || String(matchedVariation.itemLabel || "").trim().toLowerCase() === item.label.toLowerCase()
        ));

        if (matchedItem) {
            selectedProductVariationItems[group.id] = matchedItem.id;
        }
    });
}

async function restorePersonalizationStateFromCart(product = currentProduct, state = {}) {
    const personalizationInput = getPersonalizationInput();
    const personalizationName = String(state.personalizationName || "").trim();
    const personalizationPreviews = Array.isArray(state.personalizationPreviews) ? state.personalizationPreviews : [];

    if (personalizationInput && personalizationName) {
        personalizationInput.value = personalizationName;
    }

    selectedPersonalizationOverlayImagesByPreview = {};
    uploadedPersonalizationOverlayImagesByPreview = {};
    personalizationAdjustmentsByPreview = {};

    for (let index = 0; index < personalizationPreviews.length; index += 1) {
        const preview = personalizationPreviews[index] || {};
        const previewKey = String(index);

        personalizationAdjustmentsByPreview[previewKey] = {
            text: {
                offsetXPercent: Number(preview.textOffsetXPercent || 0),
                offsetYPercent: Number(preview.textOffsetYPercent || 0),
                scalePercent: Number(preview.textScalePercent || 100) || 100
            },
            image: {
                offsetXPercent: Number(preview.overlayImageOffsetXPercent || 0),
                offsetYPercent: Number(preview.overlayImageOffsetYPercent || 0),
                scalePercent: Number(preview.overlayImageScalePercent || 100) || 100
            }
        };

        if (preview.overlayImageKind === "upload") {
            const restoredUpload = await restoreUploadedOverlayImageFromStorage(preview, previewKey);

            if (restoredUpload) {
                setUploadedPersonalizationOverlayImage(restoredUpload, previewKey);
                setSelectedPersonalizationOverlayImage(restoredUpload, previewKey);
            }

            continue;
        }

        if (preview.overlayImageUrl) {
            const overlayConfig = getPersonalizationImageOverlayConfig(product);
            const matchedOptionIndex = overlayConfig.optionImages.findIndex((image) => image?.imageUrl === preview.overlayImageUrl);
            setSelectedPersonalizationOverlayImage({
                id: matchedOptionIndex >= 0 ? `option:${matchedOptionIndex}:${preview.overlayImageUrl}` : `option:${preview.overlayImageUrl}`,
                kind: preview.overlayImageKind || "option",
                index: matchedOptionIndex,
                imageUrl: preview.overlayImageUrl,
                imagePublicId: preview.overlayImagePublicId || ""
            }, previewKey);
        }
    }

    renderProductVariationSelectors(product);
    renderGallery(product);
    renderPersonalizationImageOverlayOptions(product);
    updateDisplayedProductPricing(product);
    updatePurchaseButtonsState(product);
    updatePersonalizationPreview(product);
    updatePersonalizationControlVisibility(product);
}

function clampPersonalizationAdjustment(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
}

function getPersonalizationAdjustmentSignature() {
    const { text, image } = getCurrentPersonalizationAdjustments();

    if (
        text.offsetXPercent === 0 &&
        text.offsetYPercent === 0 &&
        text.scalePercent === 100 &&
        image.offsetXPercent === 0 &&
        image.offsetYPercent === 0 &&
        image.scalePercent === 100
    ) {
        return "";
    }

    return [
        text.offsetXPercent,
        text.offsetYPercent,
        text.scalePercent,
        image.offsetXPercent,
        image.offsetYPercent,
        image.scalePercent
    ].join(":");
}

function updatePersonalizationControlVisibility(product = currentProduct) {
    const controlsWrap = document.getElementById("productPersonalizationControls");
    const tabsWrap = document.getElementById("productPersonalizationTabs");
    const tabButtons = Array.from(document.querySelectorAll("[data-adjust-panel-tab]"));
    const textControls = document.getElementById("productTextAdjustControls");
    const imageControls = document.getElementById("productImageAdjustControls");
    const previewConfig = getPersonalizationPreviewConfig(product);
    const overlayConfig = getPersonalizationImageOverlayConfig(product);
    const hasPreviewImage = Boolean(previewConfig.enabled && previewConfig.imageUrl);
    const showTextControls = Boolean(hasPreviewImage && previewConfig.allowCustomerAdjust && productRequiresPersonalizationName(product));
    const showImageControls = Boolean(hasPreviewImage && overlayConfig.enabled && overlayConfig.allowCustomerAdjust && getSelectedPersonalizationOverlayImage()?.imageUrl);
    const availablePanels = [];

    if (showTextControls) {
        availablePanels.push("text");
    }

    if (showImageControls) {
        availablePanels.push("image");
    }

    if (!availablePanels.includes(activePersonalizationControlPanel)) {
        activePersonalizationControlPanel = availablePanels[0] || "text";
    }

    if (textControls) {
        textControls.hidden = !(showTextControls && activePersonalizationControlPanel === "text");
    }

    if (imageControls) {
        imageControls.hidden = !(showImageControls && activePersonalizationControlPanel === "image");
    }

    if (tabsWrap) {
        tabsWrap.hidden = availablePanels.length <= 1;
    }

    tabButtons.forEach((button) => {
        const panel = String(button.dataset.adjustPanelTab || "");
        const isAvailable = availablePanels.includes(panel);
        const isActive = isAvailable && activePersonalizationControlPanel === panel;
        button.hidden = !isAvailable;
        button.disabled = !isAvailable;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (controlsWrap) {
        controlsWrap.hidden = !(showTextControls || showImageControls);
    }
}

function applyPersonalizationControlAction(target, action) {
    const adjustments = getCurrentPersonalizationAdjustments();
    const adjustment = adjustments[target];

    if (!adjustment) {
        return;
    }

    switch (action) {
        case "up":
            adjustment.offsetYPercent = clampPersonalizationAdjustment(adjustment.offsetYPercent - 2, -40, 40);
            break;
        case "down":
            adjustment.offsetYPercent = clampPersonalizationAdjustment(adjustment.offsetYPercent + 2, -40, 40);
            break;
        case "left":
            adjustment.offsetXPercent = clampPersonalizationAdjustment(adjustment.offsetXPercent - 2, -40, 40);
            break;
        case "right":
            adjustment.offsetXPercent = clampPersonalizationAdjustment(adjustment.offsetXPercent + 2, -40, 40);
            break;
        case "bigger":
            adjustment.scalePercent = clampPersonalizationAdjustment(adjustment.scalePercent + 8, 40, 220);
            break;
        case "smaller":
            adjustment.scalePercent = clampPersonalizationAdjustment(adjustment.scalePercent - 8, 40, 220);
            break;
        default:
            return;
    }

    updatePersonalizationPreview();
}

function setActivePersonalizationControlPanel(panel) {
    if (panel !== "text" && panel !== "image") {
        return;
    }

    activePersonalizationControlPanel = panel;
    updatePersonalizationControlVisibility();
}

function getPersonalizationImageOverlayElements() {
    return {
        wrap: document.getElementById("productImageOverlayWrap"),
        options: document.getElementById("productImageOverlayOptions"),
        uploadInput: document.getElementById("productImageOverlayUploadInput")
    };
}

async function preparePersonalizationImagePreview(file) {
    const previewKey = getCurrentPersonalizationPreviewKey();
    const currentUploadedImage = getUploadedPersonalizationOverlayImage(previewKey);

    if (!window.personalizationImageStore?.saveFile) {
        throw new Error("O armazenamento temporário de imagens não está disponível.");
    }

    if (currentUploadedImage?.storageKey && window.personalizationImageStore?.deleteFile) {
        try {
            await window.personalizationImageStore.deleteFile(currentUploadedImage.storageKey);
        } catch (_error) {
            // Ignora falhas de limpeza local antes de substituir a imagem.
        }
    }

    if (uploadedPersonalizationOverlayObjectUrlsByPreview[previewKey]) {
        URL.revokeObjectURL(uploadedPersonalizationOverlayObjectUrlsByPreview[previewKey]);
        delete uploadedPersonalizationOverlayObjectUrlsByPreview[previewKey];
    }

    const storedImage = await window.personalizationImageStore.saveFile(file);
    const previewUrl = URL.createObjectURL(file);
    uploadedPersonalizationOverlayObjectUrlsByPreview[previewKey] = previewUrl;

    return {
        storageKey: storedImage.id,
        imageUrl: previewUrl,
        imagePublicId: "",
        name: storedImage.name || String(file?.name || "").trim()
    };
}

function renderPersonalizationImageOverlayOptions(product = currentProduct) {
    const { wrap, options } = getPersonalizationImageOverlayElements();
    const overlayConfig = getPersonalizationImageOverlayConfig(product);
    const selectedPersonalizationOverlayImage = getSelectedPersonalizationOverlayImage();
    const uploadedPersonalizationOverlayImage = getUploadedPersonalizationOverlayImage();

    if (!wrap || !options) {
        return;
    }

    if (!overlayConfig.enabled) {
        wrap.hidden = true;
        return;
    }

    wrap.hidden = false;

    const noImageOptionMarkup = `
        <button
            type="button"
            class="product-page-image-overlay-option ${selectedPersonalizationOverlayImage?.imageUrl ? "" : "is-selected"}"
            data-overlay-no-image-option="true"
            aria-pressed="${selectedPersonalizationOverlayImage?.imageUrl ? "false" : "true"}"
        >
            <img src="/img/SEM%20IMAGEM.png" alt="Sem imagem">
        </button>
    `;

    const optionButtonsMarkup = overlayConfig.optionImages.map((image, index) => `
        <button
            type="button"
            class="product-page-image-overlay-option ${selectedPersonalizationOverlayImage?.kind === "option" && selectedPersonalizationOverlayImage?.index === index ? "is-selected" : ""}"
            data-overlay-option-index="${index}"
            aria-pressed="${selectedPersonalizationOverlayImage?.kind === "option" && selectedPersonalizationOverlayImage?.index === index ? "true" : "false"}"
        >
            <img src="${escapeHtml(image.imageUrl)}" alt="Opção ${index + 1}">
        </button>
    `).join("");

    const uploadedOptionMarkup = uploadedPersonalizationOverlayImage?.imageUrl
        ? `
            <button
                type="button"
                class="product-page-image-overlay-option ${selectedPersonalizationOverlayImage?.id === uploadedPersonalizationOverlayImage.id ? "is-selected" : ""}"
                data-overlay-upload-option="true"
                aria-pressed="${selectedPersonalizationOverlayImage?.id === uploadedPersonalizationOverlayImage.id ? "true" : "false"}"
            >
                <img src="${escapeHtml(uploadedPersonalizationOverlayImage.imageUrl)}" alt="Imagem enviada pelo cliente">
            </button>
        `
        : "";

    const uploadTileMarkup = overlayConfig.allowCustomerUpload
        ? `
            <label class="product-page-image-upload-label product-page-image-overlay-option product-page-image-upload-option" for="productImageOverlayUploadInput">
                <span>+</span>
                <strong>Enviar</strong>
            </label>
        `
        : "";

    options.innerHTML = `${noImageOptionMarkup}${optionButtonsMarkup}${uploadedOptionMarkup}${uploadTileMarkup}`;
}

function updatePersonalizationPreview(product = currentProduct) {
    const { wrap, tabs, image, overlayImage, text } = getPersonalizationPreviewElements();
    const renderRequestId = ++personalizationPreviewRenderRequestId;

    if (!wrap || !image || !text || !overlayImage) {
        return;
    }

    const previewConfigs = getPersonalizationPreviewConfigs(product);
    const previewConfig = getPersonalizationPreviewConfig(product);
    const overlayConfig = getPersonalizationImageOverlayConfig(product);
    const personalizationAdjustments = getCurrentPersonalizationAdjustments();
    const hasMultiplePreviews = previewConfigs.length > 1;

    if (tabs) {
        tabs.hidden = !hasMultiplePreviews;
        tabs.innerHTML = hasMultiplePreviews
            ? previewConfigs.map((config, index) => `
                <button
                    type="button"
                    class="product-page-preview-tab${index === activePersonalizationPreviewIndex ? " is-active" : ""}"
                    data-preview-index="${index}"
                    aria-pressed="${index === activePersonalizationPreviewIndex ? "true" : "false"}"
                >${escapeHtml(config.name)}</button>
            `).join("")
            : "";
    }

    if (!previewConfig.enabled) {
        wrap.hidden = true;
        image.removeAttribute("src");
        image.alt = "";
        overlayImage.hidden = true;
        overlayImage.removeAttribute("src");
        overlayImage.alt = "";
        text.textContent = "";
        return;
    }

    const previewImageUrl = getSelectedVariationPreviewImage(product) || previewConfig.imageUrl || "";
    const userInput = getSelectedPersonalizationName();
    const personalizationName = userInput || (previewConfig.showSampleTextInPreview !== false ? (previewConfig.sampleText || "Maria") : "");
    const shouldShowPreviewText = Boolean(previewConfig.enabled && personalizationName);

    if (!previewImageUrl) {
        wrap.hidden = true;
        image.removeAttribute("src");
        image.alt = "";
        overlayImage.hidden = true;
        overlayImage.removeAttribute("src");
        overlayImage.alt = "";
        text.textContent = "";
        return;
    }

    wrap.hidden = false;
    image.src = previewImageUrl;
    image.alt = product?.name ? `Prévia personalizada de ${product.name}` : "Prévia personalizada do produto";
    text.hidden = !shouldShowPreviewText;
    text.textContent = shouldShowPreviewText
        ? (previewConfig.textTransform === "uppercase" ? personalizationName.toUpperCase() : personalizationName)
        : "";
    const applyPreviewTextStyles = () => {
        if (renderRequestId !== personalizationPreviewRenderRequestId) {
            return;
        }

        const currentWidth = image.clientWidth || image.parentElement?.clientWidth || 0;
        const referenceWidth = previewConfig.referenceWidthPx || currentWidth || 1;
        const widthRatio = currentWidth > 0 ? (currentWidth / referenceWidth) : 1;
        const scaledFontSize = previewConfig.fontSizePx * widthRatio;

        text.style.left = `${previewConfig.positionXPercent + personalizationAdjustments.text.offsetXPercent}%`;
        text.style.top = `${previewConfig.positionYPercent + personalizationAdjustments.text.offsetYPercent}%`;
        text.style.width = `${previewConfig.widthPercent}%`;
        text.style.fontSize = `${scaledFontSize * (personalizationAdjustments.text.scalePercent / 100)}px`;
        text.style.color = previewConfig.textColor;
        text.style.fontFamily = previewConfig.fontFamily;
        text.style.fontWeight = previewConfig.fontWeight;
        text.style.letterSpacing = `${previewConfig.letterSpacingEm}em`;
        text.style.textTransform = previewConfig.textTransform;
        text.style.textShadow = previewConfig.textShadow;
        text.style.transform = `translate(-50%, -50%) rotate(${previewConfig.rotationDeg}deg)`;

        const selectedOverlayImage = getSelectedPersonalizationOverlayImage();
        const overlayImageUrl = selectedOverlayImage?.imageUrl || "";

        if (!overlayConfig.enabled || !overlayImageUrl) {
            overlayImage.hidden = true;
            overlayImage.removeAttribute("src");
            overlayImage.alt = "";
            return;
        }

        overlayImage.hidden = false;
        overlayImage.src = overlayImageUrl;
        overlayImage.alt = "Imagem aplicada na prévia do produto";
        overlayImage.style.left = `${overlayConfig.positionXPercent + personalizationAdjustments.image.offsetXPercent}%`;
        overlayImage.style.top = `${overlayConfig.positionYPercent + personalizationAdjustments.image.offsetYPercent}%`;
        overlayImage.style.width = "auto";
        overlayImage.style.height = "auto";
        overlayImage.style.maxWidth = `${overlayConfig.maxWidthPercent * (personalizationAdjustments.image.scalePercent / 100)}%`;
        overlayImage.style.maxHeight = `${overlayConfig.maxHeightPercent * (personalizationAdjustments.image.scalePercent / 100)}%`;
        overlayImage.style.borderRadius = overlayConfig.isRound ? "50%" : "0";
        overlayImage.style.transform = `translate(-50%, -50%) rotate(${overlayConfig.rotationDeg}deg)`;
    };

    if (image.complete && image.naturalWidth > 0) {
        applyPreviewTextStyles();
    } else {
        image.onload = () => {
            applyPreviewTextStyles();
        };
    }

    updatePersonalizationControlVisibility(product);
}

function buildCartItemKey(product, personalizationName) {
    const slug = String(product?.slug || "").trim();
    const engraving = String(personalizationName || "").trim().toLowerCase();
    const previewConfigs = getPersonalizationPreviewConfigs(product);
    const overlayKey = previewConfigs.map((_, index) => selectedPersonalizationOverlayImagesByPreview[String(index)]?.id || "").join("|");
    const adjustmentKey = previewConfigs.map((_, index) => {
        const adjustments = personalizationAdjustmentsByPreview[String(index)] || createDefaultPersonalizationAdjustments();
        const { text, image } = adjustments;

        if (
            text.offsetXPercent === 0 &&
            text.offsetYPercent === 0 &&
            text.scalePercent === 100 &&
            image.offsetXPercent === 0 &&
            image.offsetYPercent === 0 &&
            image.scalePercent === 100
        ) {
            return "";
        }

        return [
            text.offsetXPercent,
            text.offsetYPercent,
            text.scalePercent,
            image.offsetXPercent,
            image.offsetYPercent,
            image.scalePercent
        ].join(":");
    }).join("|");
    const variationKey = getSelectedProductVariationSignature(product);
    const parts = [slug];

    if (variationKey) {
        parts.push(variationKey);
    }

    if (engraving) {
        parts.push(engraving);
    }

    if (overlayKey) {
        parts.push(overlayKey);
    }

    if (adjustmentKey) {
        parts.push(adjustmentKey);
    }

    return parts.join("::");
}

function normalizeZipCode(value = "") {
    return String(value).replace(/\D/g, "").slice(0, 8);
}

function setStoredShippingZipCode(zipCode) {
    try {
        if (!zipCode) {
            window.localStorage.removeItem(SHIPPING_ZIP_STORAGE_KEY);
            return;
        }

        window.localStorage.setItem(SHIPPING_ZIP_STORAGE_KEY, zipCode);
    } catch (_error) {
        // Ignora falhas de armazenamento local.
    }
}

function showShippingFeedback(message, type = "success") {
    const shippingQuoteFeedback = document.getElementById("shippingQuoteFeedback");

    if (!shippingQuoteFeedback) {
        return;
    }

    shippingQuoteFeedback.hidden = false;
    shippingQuoteFeedback.className = `product-page-shipping-feedback ${type}`;
    shippingQuoteFeedback.textContent = message;
}

function clearShippingFeedback() {
    const shippingQuoteFeedback = document.getElementById("shippingQuoteFeedback");

    if (!shippingQuoteFeedback) {
        return;
    }

    shippingQuoteFeedback.hidden = true;
    shippingQuoteFeedback.textContent = "";
    shippingQuoteFeedback.className = "product-page-shipping-feedback";
}

function updateShippingHelpText(text) {
    const shippingHelpText = document.getElementById("shippingHelpText");

    if (!shippingHelpText) {
        return;
    }

    shippingHelpText.textContent = text;
}

function getProductProductionDays(product = currentProduct) {
    const productionDays = Number(product?.shipping?.productionDays || 0);
    return Number.isFinite(productionDays) && productionDays > 0 ? Math.floor(productionDays) : 0;
}

function buildShippingHelpText({ productionDays = 0, isDemo = false } = {}) {
    const shippingMessage = isDemo
        ? "Modo demonstracao ativo. Os valores abaixo simulam como PAC e SEDEX aparecerao no front-end."
        : "Fretes consultados em tempo real com PAC e SEDEX.";

    if (!productionDays) {
        return shippingMessage;
    }

    return `Prazo de produção: ${productionDays} dia(s) úteis. ${shippingMessage}`;
}

function formatShippingDeadlineLabel(option = {}) {
    const productionDays = Number(option.productionDays || 0);
    const dispatchDays = Number(option.dispatchDays || 0);
    const deliveryDays = Number(option.deliveryTime || 0);
    const totalDeliveryDays = Number(option.totalDeliveryDays || (productionDays + dispatchDays + deliveryDays));

    if (dispatchDays) {
        return `${productionDays} dia(s) de produção + ${dispatchDays} dia(s) após embalagem + ${deliveryDays} dia(s) de entrega = ${totalDeliveryDays} dia(s) úteis`;
    }

    if (!productionDays) {
        return `${deliveryDays} dia(s) úteis`;
    }

    return `${productionDays} dia(s) de produção + ${deliveryDays} dia(s) de entrega = ${totalDeliveryDays} dia(s) úteis`;
}

function renderShippingOptions(options = []) {
    const shippingQuoteResults = document.getElementById("shippingQuoteResults");

    if (!shippingQuoteResults) {
        return;
    }

    if (!options.length) {
        shippingQuoteResults.hidden = true;
        shippingQuoteResults.innerHTML = "";
        return;
    }

    shippingQuoteResults.hidden = false;
    shippingQuoteResults.innerHTML = options.map((option) => `
        <article class="product-page-shipping-option">
            <div class="product-page-shipping-option-main">
                <strong class="product-page-shipping-option-name">${escapeHtml(option.name || "Frete")}</strong>
                <span class="product-page-shipping-option-meta">
                    ${escapeHtml(option.company || "Correios")} - ${escapeHtml(formatShippingDeadlineLabel(option))}
                </span>
            </div>
            <span class="product-page-shipping-option-price">${escapeHtml(formatCurrency(option.price || 0))}</span>
        </article>
    `).join("");
}

function setShippingButtonLoading(isLoading) {
    const shippingQuoteButton = document.getElementById("shippingQuoteButton");

    if (window.siteUi?.setButtonLoading) {
        window.siteUi.setButtonLoading(shippingQuoteButton, isLoading, {
            loadingText: "Calculando..."
        });
        return;
    }

    if (!shippingQuoteButton) {
        return;
    }

    shippingQuoteButton.disabled = isLoading;
    shippingQuoteButton.textContent = isLoading ? "Calculando..." : "Calcular";
}

async function calculateShippingQuote() {
    const shippingZipCodeInput = document.getElementById("shippingZipCodeInput");

    if (!shippingZipCodeInput || !currentProduct || shippingQuoteRequestInFlight) {
        return;
    }

    const zipCode = normalizeZipCode(shippingZipCodeInput.value);

    if (zipCode.length !== 8) {
        renderShippingOptions([]);
        showShippingFeedback("Digite um CEP válido com 8 números.", "error");
        return;
    }

    shippingQuoteRequestInFlight = true;
    setShippingButtonLoading(true);
    clearShippingFeedback();

    try {
        setStoredShippingZipCode(zipCode);
        const response = await fetch("/api/shipping/quote", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                productId: currentProduct._id,
                quantity: getSelectedQuantity(),
                zipCode
            })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Não foi possível calcular o frete.");
        }

        renderShippingOptions(result.options || []);
        updateShippingHelpText(buildShippingHelpText({
            productionDays: result.productionDays ?? getProductProductionDays(currentProduct),
            isDemo: result.isDemo
        }));
        updateShippingHelpText(
            result.isDemo
                ? "Modo demonstração ativo. Os valores abaixo simulam como PAC e SEDEX aparecerão no front-end."
                : "Fretes consultados em tempo real com Correios e motoboy local quando disponível."
        );

        updateShippingHelpText(buildShippingHelpText({
            productionDays: result.productionDays ?? getProductProductionDays(currentProduct),
            isDemo: result.isDemo
        }));

        if (Array.isArray(result.options) && result.options.length) {
            const motoboyMessage = result?.diagnostics?.motoboy?.available === false
                ? result?.diagnostics?.motoboy?.message
                : "";
            const warnings = Array.isArray(result?.warnings) && result.warnings.length
                ? ` ${result.warnings.join(" ")}`
                : "";
            showShippingFeedback(
                result.isDemo
                    ? "Simulação carregada com sucesso para este CEP."
                    : "Fretes encontrados para o seu CEP.",
                "success"
            );
        } else {
            const motoboyMessage = result?.diagnostics?.motoboy?.message;
            const warnings = Array.isArray(result?.warnings) && result.warnings.length
                ? ` ${result.warnings.join(" ")}`
                : "";
            showShippingFeedback(
                motoboyMessage
                    ? `${motoboyMessage}${warnings}`
                    : `Nenhuma opção de frete foi encontrada para este CEP.${warnings}`,
                "error"
            );
        }
    } catch (error) {
        renderShippingOptions([]);
        updateShippingHelpText("Consulte frete com Correios e motoboy local informando seu CEP.");
        updateShippingHelpText(buildShippingHelpText({
            productionDays: getProductProductionDays(currentProduct),
            isDemo: false
        }));
        showShippingFeedback(error.message, "error");
    } finally {
        shippingQuoteRequestInFlight = false;
        setShippingButtonLoading(false);
    }
}

function setSelectedQuantity(value) {
    const quantityInput = getQuantityInput();

    if (!quantityInput) {
        return;
    }

    const maxQuantity = currentProduct?.stock?.mode === "limited" ? Math.max(1, getStockQuantity(currentProduct) || 1) : null;
    const normalizedValue = normalizeQuantity(value);
    const nextValue = maxQuantity ? Math.min(normalizedValue, maxQuantity) : normalizedValue;
    quantityInput.value = String(nextValue);
}

function updatePurchaseButtonsState(product) {
    const buyNowButton = document.getElementById("buyNowButton");
    const addToCartButton = document.getElementById("addToCartButton");
    const quantityInput = getQuantityInput();
    const isUnavailable = product.stock?.mode === "limited" && getStockQuantity(product) <= 0;

    if (buyNowButton) {
        buyNowButton.disabled = isUnavailable;
        buyNowButton.textContent = isUnavailable ? "Produto indisponível" : "Comprar agora";
    }

    if (addToCartButton) {
        addToCartButton.disabled = isUnavailable;
    }

    if (quantityInput) {
        quantityInput.disabled = isUnavailable;
    }
}

function showCartFeedback(message, type = "success") {
    const feedback = document.getElementById("productCartFeedback");

    if (window.showSiteToast) {
        window.showSiteToast(message, type, {
            duration: type === "error" ? 5200 : 4200
        });
    }

    if (!feedback) {
        return;
    }

    feedback.hidden = true;
    feedback.textContent = message;
}

function triggerAddToCartButtonSuccessAnimation() {
    const addToCartButton = document.getElementById("addToCartButton");

    if (!addToCartButton) {
        return;
    }

    window.clearTimeout(addToCartButtonSuccessTimeoutId);
    addToCartButton.classList.remove("is-confirmed");
    void addToCartButton.offsetWidth;
    addToCartButton.classList.add("is-confirmed");

    addToCartButtonSuccessTimeoutId = window.setTimeout(() => {
        addToCartButton.classList.remove("is-confirmed");
    }, 1450);
}

function setBuyNowButtonLoading(isLoading) {
    const buyNowButton = document.getElementById("buyNowButton");

    if (window.siteUi?.setButtonLoading) {
        window.siteUi.setButtonLoading(buyNowButton, isLoading, {
            loadingText: "Abrindo checkout..."
        });
        return;
    }

    if (buyNowButton) {
        buyNowButton.disabled = isLoading;
    }
}

function validatePersonalizationName() {
    const personalizationInput = getPersonalizationInput();
    const personalizationName = getSelectedPersonalizationName();

    if (!productRequiresPersonalizationName()) {
        return "";
    }

    if (!personalizationName) {
        showCartFeedback("Informe o nome que será gravado antes de continuará", "error");

        if (personalizationInput) {
            personalizationInput.focus();
        }

        return "";
    }

    return personalizationName;
}

function validatePersonalizationImageSelection() {
    const overlayConfig = getPersonalizationImageOverlayConfig();
    const selectedOverlayImage = getSelectedPersonalizationOverlayImage();

    if (personalizationImageUploadRequestInFlight) {
        showCartFeedback("A imagem ainda está sendo enviada. Aguarde um instante.", "error");
        return false;
    }

    if (!overlayConfig.enabled || !overlayConfig.requireSelection) {
        return true;
    }

    if (selectedOverlayImage?.imageUrl) {
        return true;
    }

    showCartFeedback("Escolha ou envie uma imagem antes de continuar.", "error");
    return false;
}

function applyZipCodeMask(value = "") {
    const digits = String(value).replace(/\D/g, "").slice(0, 8);

    if (digits.length <= 5) {
        return digits;
    }

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function setMainGalleryImage(index) {
    const productMainImageCurrent = document.getElementById("productMainImageCurrent");
    const productMainImageNext = document.getElementById("productMainImageNext");
    const productGalleryThumbs = document.getElementById("productGalleryThumbs");
    const safeIndex = Math.max(0, Math.min(index, currentProductImages.length - 1));
    currentImageIndex = safeIndex;

    if (productMainImageCurrent && currentProductImages[safeIndex]) {
        productMainImageCurrent.src = currentProductImages[safeIndex].imageUrl;
        productMainImageCurrent.alt = currentProduct?.name || "Produto";
    }

    if (productMainImageNext) {
        productMainImageNext.removeAttribute("src");
        productMainImageNext.alt = "";
    }

    if (productGalleryThumbs) {
        productGalleryThumbs.querySelectorAll(".product-gallery-thumb").forEach((thumb, thumbIndex) => {
            thumb.classList.toggle("active", thumbIndex === safeIndex);
        });
    }
}

function renderGalleryImage(index, direction = "next") {
    const safeIndex = Math.max(0, Math.min(index, currentProductImages.length - 1));
    void direction;
    setMainGalleryImage(safeIndex);
}

function renderGallery(product) {
    const productGalleryThumbs = document.getElementById("productGalleryThumbs");
    currentProductImages = getProductImages(product);
    currentImageIndex = 0;

    if (!productGalleryThumbs) {
        return;
    }

    productGalleryThumbs.innerHTML = currentProductImages.map((image, index) => `
        <button type="button" class="product-gallery-thumb ${index === 0 ? "active" : ""}" data-image-index="${index}">
            <img src="${escapeHtml(image.imageUrl)}" alt="Miniatura ${index + 1}">
        </button>
    `).join("");

    setMainGalleryImage(0);
}

function normalizeComparableText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function getProductCategoryLinkData(product) {
    const explicitSlug = String(product?.categorySlug || product?.category?.slug || "").trim();
    const explicitName = String(product?.categoryName || product?.category?.name || product?.category || "").trim();

    if (explicitSlug) {
        return {
            name: explicitName || "Categoria",
            url: `/categoria/${encodeURIComponent(explicitSlug)}`
        };
    }

    const normalizedCategoryName = normalizeComparableText(explicitName);
    const matchedCategory = sharedCategoriesCache.find((category) => {
        return normalizeComparableText(category?.name) === normalizedCategoryName;
    });

    if (matchedCategory?.slug) {
        return {
            name: matchedCategory.name || explicitName || "Categoria",
            url: getCategoryUrl(matchedCategory)
        };
    }

    if (explicitName) {
        return {
            name: explicitName,
            url: ""
        };
    }

    return null;
}

function renderProductBreadcrumb(product) {
    const breadcrumb = document.getElementById("productBreadcrumb");

    if (!breadcrumb) {
        return;
    }

    const productName = escapeHtml(product?.name || "Produto");
    const categoryData = getProductCategoryLinkData(product);
    const categoryMarkup = categoryData
        ? (categoryData.url
            ? `<a href="${escapeHtml(categoryData.url)}">${escapeHtml(categoryData.name)}</a>`
            : `<span>${escapeHtml(categoryData.name)}</span>`)
        : "";
    const categorySeparatorMarkup = categoryData
        ? `<span class="product-breadcrumb-separator" aria-hidden="true">/</span>`
        : "";

    breadcrumb.innerHTML = `
        <a href="/">Início</a>
        ${categorySeparatorMarkup}
        ${categoryMarkup}
        <span class="product-breadcrumb-separator" aria-hidden="true">/</span>
        <span aria-current="page">${productName}</span>
    `;
    breadcrumb.hidden = false;
}

function setProductPageLoadingState({ isLoading = false, errorMessage = "" } = {}) {
    const feedback = document.getElementById("productPageFeedback");
    const skeleton = document.getElementById("productSkeleton");
    const content = document.getElementById("productPageContent");
    const shell = document.getElementById("productPageShell");
    const descriptionSection = document.getElementById("productDescriptionSection");
    const breadcrumb = document.getElementById("productBreadcrumb");

    document.body.classList.toggle("product-page-is-loading", isLoading);
    document.body.setAttribute("aria-busy", isLoading ? "true" : "false");

    if (skeleton) {
        skeleton.hidden = !isLoading;
        skeleton.setAttribute("aria-hidden", isLoading ? "false" : "true");
    }

    if (content) {
        content.hidden = isLoading || Boolean(errorMessage);
    }

    if (breadcrumb) {
        breadcrumb.hidden = isLoading || Boolean(errorMessage);
    }

    if (shell) {
        shell.hidden = isLoading || Boolean(errorMessage);
    }

    if (descriptionSection) {
        descriptionSection.hidden = isLoading || Boolean(errorMessage);
    }

    if (feedback) {
        feedback.hidden = !errorMessage;
        feedback.textContent = errorMessage;
    }
}

function preloadImage(url) {
    return new Promise((resolve) => {
        const normalizedUrl = String(url || "").trim();

        if (!normalizedUrl) {
            resolve(false);
            return;
        }

        const image = new Image();
        let settled = false;
        const finalize = () => {
            if (settled) {
                return;
            }

            settled = true;
            resolve(true);
        };

        image.onload = finalize;
        image.onerror = finalize;
        image.src = normalizedUrl;

        if (typeof image.decode === "function") {
            image.decode().then(finalize).catch(finalize);
        }
    });
}

async function preloadProductAssets(product) {
    const primaryImageUrl = getProductImages(product)?.[0]?.imageUrl || "";
    await preloadImage(primaryImageUrl);
}

function renderProduct(product) {
    const productName = document.getElementById("productName");
    const productCategory = document.getElementById("productCategory");
    const productPrice = document.getElementById("productPrice");
    const productCompareAtPrice = document.getElementById("productCompareAtPrice");
    const productInstallments = document.getElementById("productInstallments");
    const productStock = document.getElementById("productStock");
    const productDescription = document.getElementById("productDescription");
    const productDescriptionSection = document.getElementById("productDescriptionSection");
    const productPageContent = document.getElementById("productPageContent");
    const productPageShell = document.getElementById("productPageShell");

    currentProduct = product;
    selectedProductVariationItems = {};

    renderProductBreadcrumb(product);
    document.title = `${product.name || "Produto"} | Arteno`;
    productName.textContent = product.name || "Produto";
    productCategory.textContent = product.category || "";
    updateDisplayedProductPricing(product);
    productStock.textContent = getStockText(product);
    productStock.hidden = !productStock.textContent;
    productDescription.innerHTML = product.description || "<p>Sem descrição cadastrada para este produto.</p>";

    if (product.compareAtPrice) {
        productCompareAtPrice.hidden = false;
        productCompareAtPrice.textContent = formatCurrency(product.compareAtPrice);
    } else {
        productCompareAtPrice.hidden = true;
    }

    renderGallery(product);
    renderProductVariationSelectors(product);
    cleanupUploadedPersonalizationOverlayImages();
    activePersonalizationControlPanel = "text";
    activePersonalizationPreviewIndex = 0;
    resetPersonalizationAdjustments();
    renderPersonalizationImageOverlayOptions(product);
    setSelectedQuantity(1);
    const personalizationWrap = document.getElementById("productPersonalizationWrap");
    const personalizationNameField = document.getElementById("productPersonalizationNameField");
    const personalizationInput = getPersonalizationInput();
    const personalizationLabel = document.getElementById("productPersonalizationLabel");
    const { uploadInput: overlayUploadInput } = getPersonalizationImageOverlayElements();

    if (personalizationWrap) {
        personalizationWrap.hidden = !productHasPersonalizationContent(product);
    }

    if (personalizationInput) {
        personalizationInput.value = "";
    }

    if (personalizationNameField) {
        personalizationNameField.hidden = !productRequiresPersonalizationName(product);
    } else {
        if (personalizationInput) {
            personalizationInput.hidden = !productRequiresPersonalizationName(product);
        }

        if (personalizationLabel) {
            personalizationLabel.hidden = !productRequiresPersonalizationName(product);
        }
    }

    if (overlayUploadInput) {
        overlayUploadInput.value = "";
    }

    updateShippingHelpText(buildShippingHelpText({
        productionDays: getProductProductionDays(product),
        isDemo: false
    }));

    updatePurchaseButtonsState(product);
    if (productPageContent) {
        productPageContent.hidden = false;
    }
    productPageShell.hidden = false;
    if (productDescriptionSection) {
        productDescriptionSection.hidden = false;
    }

    updatePersonalizationPreview(product);
    updatePersonalizationControlVisibility(product);
    window.requestAnimationFrame(() => {
        if (currentProduct?._id === product?._id) {
            updatePersonalizationPreview(product);
            updatePersonalizationControlVisibility(product);
        }
    });
}

function addCurrentProductToCart({ redirectToCheckout = false } = {}) {
    if (!currentProduct) {
        return false;
    }

    if (!validateProductVariationSelections()) {
        return false;
    }

    const personalizationName = validatePersonalizationName();

    if (productRequiresPersonalizationName() && !personalizationName) {
        return false;
    }

    if (!validatePersonalizationImageSelection()) {
        return false;
    }

    const quantity = getSelectedQuantity();
    const items = getStoredCartItems();
    const cartKey = buildCartItemKey(currentProduct, personalizationName);
    const selectedOverlayImage = getSelectedPersonalizationOverlayImage();
    const selectedVariations = getSelectedProductVariations(currentProduct);
    const previewConfig = getPersonalizationPreviewConfig(currentProduct);
    const overlayConfig = getPersonalizationImageOverlayConfig(currentProduct);
    const personalizationPreviewsForCart = getPersonalizationPreviewConfigs(currentProduct).map((preview, index) => {
        const previewKey = String(index);
        const previewOverlayImage = selectedPersonalizationOverlayImagesByPreview[previewKey] || null;
        const previewAdjustments = personalizationAdjustmentsByPreview[previewKey] || createDefaultPersonalizationAdjustments();

        return {
            name: preview.name,
            imageUrl: preview.imageUrl || "",
            textValue: personalizationName || (preview.showSampleTextInPreview !== false ? (preview.sampleText || "") : ""),
            textBaseXPercent: preview.positionXPercent,
            textBaseYPercent: preview.positionYPercent,
            textWidthPercent: preview.widthPercent,
            textFontSizePx: preview.fontSizePx,
            referenceWidthPx: preview.referenceWidthPx,
            textColor: preview.textColor,
            textFontFamily: preview.fontFamily,
            textFontWeight: preview.fontWeight,
            textTransform: preview.textTransform,
            letterSpacingEm: preview.letterSpacingEm,
            textShadow: preview.textShadow,
            textRotationDeg: preview.rotationDeg,
            textOffsetXPercent: previewAdjustments.text.offsetXPercent,
            textOffsetYPercent: previewAdjustments.text.offsetYPercent,
            textScalePercent: previewAdjustments.text.scalePercent,
            overlayImageUrl: previewOverlayImage?.kind === "upload" ? "" : (previewOverlayImage?.imageUrl || ""),
            overlayImagePublicId: previewOverlayImage?.kind === "upload" ? "" : (previewOverlayImage?.imagePublicId || ""),
            overlayImageStorageKey: previewOverlayImage?.kind === "upload" ? (previewOverlayImage?.storageKey || "") : "",
            overlayImageKind: previewOverlayImage?.kind || "",
            overlayBaseXPercent: overlayConfig.positionXPercent,
            overlayBaseYPercent: overlayConfig.positionYPercent,
            overlayBaseMaxWidthPercent: overlayConfig.maxWidthPercent,
            overlayBaseMaxHeightPercent: overlayConfig.maxHeightPercent,
            overlayBaseRotationDeg: overlayConfig.rotationDeg,
            overlayImageIsRound: overlayConfig.isRound,
            overlayImageOffsetXPercent: previewAdjustments.image.offsetXPercent,
            overlayImageOffsetYPercent: previewAdjustments.image.offsetYPercent,
            overlayImageScalePercent: previewAdjustments.image.scalePercent
        };
    });
    const firstPreviewWithOverlay = personalizationPreviewsForCart.find((preview) => preview.overlayImageUrl || preview.overlayImageStorageKey) || null;
    const activePreviewAdjustments = getCurrentPersonalizationAdjustments();
    const existingItem = items.find((item) => String(item.cartKey || item.slug) === cartKey);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        items.push({
            cartKey,
            productId: currentProduct._id,
            slug: currentProduct.slug,
            name: currentProduct.name,
            selectedVariations,
            personalizationName,
            personalizationImageUrl: firstPreviewWithOverlay?.overlayImageUrl || (selectedOverlayImage?.kind === "upload" ? "" : (selectedOverlayImage?.imageUrl || "")),
            personalizationImagePublicId: firstPreviewWithOverlay?.overlayImagePublicId || (selectedOverlayImage?.kind === "upload" ? "" : (selectedOverlayImage?.imagePublicId || "")),
            personalizationImageStorageKey: firstPreviewWithOverlay?.overlayImageStorageKey || (selectedOverlayImage?.kind === "upload" ? (selectedOverlayImage?.storageKey || "") : ""),
            personalizationImageKind: firstPreviewWithOverlay?.overlayImageKind || selectedOverlayImage?.kind || "",
            personalizationPreviews: personalizationPreviewsForCart,
            personalizationPreviewImageUrl: previewConfig.imageUrl || "",
            personalizationPreviewTextBaseXPercent: previewConfig.positionXPercent,
            personalizationPreviewTextBaseYPercent: previewConfig.positionYPercent,
            personalizationPreviewTextWidthPercent: previewConfig.widthPercent,
            personalizationPreviewTextFontSizePx: previewConfig.fontSizePx,
            personalizationPreviewReferenceWidthPx: previewConfig.referenceWidthPx,
            personalizationPreviewTextColor: previewConfig.textColor,
            personalizationPreviewTextFontFamily: previewConfig.fontFamily,
            personalizationPreviewTextFontWeight: previewConfig.fontWeight,
            personalizationPreviewTextTransform: previewConfig.textTransform,
            personalizationPreviewLetterSpacingEm: previewConfig.letterSpacingEm,
            personalizationPreviewTextShadow: previewConfig.textShadow,
            personalizationPreviewTextRotationDeg: previewConfig.rotationDeg,
            personalizationImageBaseXPercent: overlayConfig.positionXPercent,
            personalizationImageBaseYPercent: overlayConfig.positionYPercent,
            personalizationImageBaseMaxWidthPercent: overlayConfig.maxWidthPercent,
            personalizationImageBaseMaxHeightPercent: overlayConfig.maxHeightPercent,
            personalizationImageBaseRotationDeg: overlayConfig.rotationDeg,
            personalizationImageIsRound: overlayConfig.isRound,
            personalizationTextOffsetXPercent: activePreviewAdjustments.text.offsetXPercent,
            personalizationTextOffsetYPercent: activePreviewAdjustments.text.offsetYPercent,
            personalizationTextScalePercent: activePreviewAdjustments.text.scalePercent,
            personalizationImageOffsetXPercent: activePreviewAdjustments.image.offsetXPercent,
            personalizationImageOffsetYPercent: activePreviewAdjustments.image.offsetYPercent,
            personalizationImageScalePercent: activePreviewAdjustments.image.scalePercent,
            price: getCurrentProductDisplayPrice(currentProduct),
            imageUrl: currentProductImages[0]?.imageUrl || currentProduct.imageUrl || "",
            quantity
        });
    }

    setStoredCartItems(items);
    updateCartCount();
    triggerAddToCartButtonSuccessAnimation();
    showCartFeedback(
        personalizationName
            ? `${quantity} item(ns) adicionado(s) ao carrinho com a gravação "${personalizationName}".`
            : `${quantity} item(ns) adicionado(s) ao carrinho.`
    );

    if (redirectToCheckout) {
        window.location.href = "/checkout";
    }

    return true;
}

function bindProductInteractions() {
    const productGalleryThumbs = document.getElementById("productGalleryThumbs");
    const productGalleryMainFrame = document.querySelector(".product-gallery-main-frame");
    const productVariationGroups = document.getElementById("productVariationGroups");
    const prevButton = document.getElementById("productGalleryPrev");
    const nextButton = document.getElementById("productGalleryNext");
    const decreaseButton = document.getElementById("decreaseQuantityButton");
    const increaseButton = document.getElementById("increaseQuantityButton");
    const quantityInput = getQuantityInput();
    const addToCartButton = document.getElementById("addToCartButton");
    const buyNowButton = document.getElementById("buyNowButton");
    const shippingZipCodeInput = document.getElementById("shippingZipCodeInput");
    const shippingQuoteButton = document.getElementById("shippingQuoteButton");
    const personalizationControls = document.getElementById("productPersonalizationControls");
    const personalizationInput = getPersonalizationInput();
    const { options: overlayOptions, uploadInput: overlayUploadInput } = getPersonalizationImageOverlayElements();

    if (productGalleryThumbs) {
        productGalleryThumbs.addEventListener("click", (event) => {
            const button = event.target.closest(".product-gallery-thumb");

            if (!button) {
                return;
            }

            const nextIndex = Number(button.dataset.imageIndex || 0);
            renderGalleryImage(nextIndex, nextIndex < currentImageIndex ? "prev" : "next");
        });
    }

    if (productVariationGroups) {
        productVariationGroups.addEventListener("click", (event) => {
            const optionButton = event.target.closest("[data-variation-select]");

            if (!optionButton) {
                return;
            }

            const variationId = String(optionButton.dataset.variationId || "");
            const itemId = String(optionButton.dataset.variationItemId || "");

            if (!variationId || !itemId) {
                return;
            }

            selectedProductVariationItems = {
                ...selectedProductVariationItems,
                [variationId]: itemId
            };
            renderProductVariationSelectors();
            updateDisplayedProductPricing();
            renderGallery(currentProduct);
            updatePersonalizationPreview();
        });
    }

    if (productGalleryMainFrame) {
        productGalleryMainFrame.addEventListener("touchstart", (event) => {
            const touch = event.touches?.[0];

            if (!touch) {
                return;
            }

            galleryTouchStartX = touch.clientX;
            galleryTouchStartY = touch.clientY;
            galleryTouchActive = true;
        }, { passive: true });

        productGalleryMainFrame.addEventListener("touchend", (event) => {
            if (!galleryTouchActive || !currentProductImages.length) {
                galleryTouchActive = false;
                return;
            }

            const touch = event.changedTouches?.[0];

            if (!touch) {
                galleryTouchActive = false;
                return;
            }

            const deltaX = touch.clientX - galleryTouchStartX;
            const deltaY = touch.clientY - galleryTouchStartY;
            const minSwipeDistance = 40;

            galleryTouchActive = false;

            if (Math.abs(deltaX) < minSwipeDistance || Math.abs(deltaX) <= Math.abs(deltaY)) {
                return;
            }

            if (deltaX < 0) {
                const nextIndex = (currentImageIndex + 1) % currentProductImages.length;
                renderGalleryImage(nextIndex, "next");
            } else {
                const nextIndex = (currentImageIndex - 1 + currentProductImages.length) % currentProductImages.length;
                renderGalleryImage(nextIndex, "prev");
            }
        }, { passive: true });

        productGalleryMainFrame.addEventListener("touchcancel", () => {
            galleryTouchActive = false;
        }, { passive: true });
    }

    if (prevButton) {
        prevButton.addEventListener("click", () => {
            if (!currentProductImages.length) {
                return;
            }

            const nextIndex = (currentImageIndex - 1 + currentProductImages.length) % currentProductImages.length;
            renderGalleryImage(nextIndex, "prev");
        });
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            if (!currentProductImages.length) {
                return;
            }

            const nextIndex = (currentImageIndex + 1) % currentProductImages.length;
            renderGalleryImage(nextIndex, "next");
        });
    }

    if (decreaseButton) {
        decreaseButton.addEventListener("click", () => {
            setSelectedQuantity(getSelectedQuantity() - 1);
        });
    }

    if (increaseButton) {
        increaseButton.addEventListener("click", () => {
            setSelectedQuantity(getSelectedQuantity() + 1);
        });
    }

    if (quantityInput) {
        quantityInput.addEventListener("input", () => {
            setSelectedQuantity(quantityInput.value);
        });
    }

    if (personalizationInput) {
        personalizationInput.addEventListener("input", () => {
            updatePersonalizationPreview();
        });
    }

    const personalizationPreviewTabs = document.getElementById("productPersonalizationPreviewTabs");
    if (personalizationPreviewTabs) {
        personalizationPreviewTabs.addEventListener("click", (event) => {
            const previewTab = event.target.closest("[data-preview-index]");

            if (!previewTab) {
                return;
            }

            activePersonalizationPreviewIndex = Number(previewTab.dataset.previewIndex || 0);
            renderPersonalizationImageOverlayOptions();
            updatePersonalizationPreview();
        });
    }

    if (personalizationControls) {
        personalizationControls.addEventListener("click", (event) => {
            const panelTab = event.target.closest("[data-adjust-panel-tab]");

            if (panelTab) {
                setActivePersonalizationControlPanel(String(panelTab.dataset.adjustPanelTab || ""));
                return;
            }

            const button = event.target.closest("[data-adjust-target][data-adjust-action]");

            if (!button) {
                return;
            }

            applyPersonalizationControlAction(
                String(button.dataset.adjustTarget || ""),
                String(button.dataset.adjustAction || "")
            );
        });
    }

    if (overlayOptions) {
        overlayOptions.addEventListener("click", (event) => {
            const noImageOptionButton = event.target.closest("[data-overlay-no-image-option]");
            const optionButton = event.target.closest("[data-overlay-option-index]");
            const uploadedOptionButton = event.target.closest("[data-overlay-upload-option]");

            if (noImageOptionButton) {
                setSelectedPersonalizationOverlayImage(null);
                renderPersonalizationImageOverlayOptions();
                updatePersonalizationPreview();
                updatePersonalizationControlVisibility();
                return;
            }

            if (uploadedOptionButton) {
                const uploadedPersonalizationOverlayImage = getUploadedPersonalizationOverlayImage();

                if (!uploadedPersonalizationOverlayImage?.imageUrl) {
                    return;
                }

                setSelectedPersonalizationOverlayImage(uploadedPersonalizationOverlayImage);
                renderPersonalizationImageOverlayOptions();
                updatePersonalizationPreview();
                updatePersonalizationControlVisibility();
                return;
            }

            if (!optionButton) {
                return;
            }

            const overlayConfig = getPersonalizationImageOverlayConfig();
            const optionIndex = Number(optionButton.dataset.overlayOptionIndex || 0);
            const selectedOption = overlayConfig.optionImages[optionIndex];

            if (!selectedOption) {
                return;
            }

            setSelectedPersonalizationOverlayImage({
                id: `option:${optionIndex}:${selectedOption.imageUrl}`,
                kind: "option",
                index: optionIndex,
                imageUrl: selectedOption.imageUrl,
                imagePublicId: selectedOption.imagePublicId || ""
            });
            renderPersonalizationImageOverlayOptions();
            updatePersonalizationPreview();
            updatePersonalizationControlVisibility();
        });
    }

    if (overlayUploadInput) {
        overlayUploadInput.addEventListener("change", async () => {
            const file = overlayUploadInput.files?.[0];

            if (!file) {
                return;
            }

            try {
                personalizationImageUploadRequestInFlight = true;
                const uploadedImage = await preparePersonalizationImagePreview(file);
                const nextUploadedImage = {
                    id: `upload:${uploadedImage.storageKey || Date.now()}`,
                    kind: "upload",
                    index: -1,
                    imageUrl: uploadedImage.imageUrl,
                    imagePublicId: uploadedImage.imagePublicId,
                    storageKey: uploadedImage.storageKey,
                    name: uploadedImage.name
                };
                setUploadedPersonalizationOverlayImage(nextUploadedImage);
                setSelectedPersonalizationOverlayImage(nextUploadedImage);
                overlayUploadInput.value = "";
                renderPersonalizationImageOverlayOptions();
                updatePersonalizationPreview();
                updatePersonalizationControlVisibility();
                personalizationImageUploadRequestInFlight = false;
            } catch (error) {
                personalizationImageUploadRequestInFlight = false;
                showCartFeedback("Não foi possível processar a imagem enviada.", "error");
            }
        });
    }

    if (shippingZipCodeInput) {
        shippingZipCodeInput.addEventListener("input", () => {
            shippingZipCodeInput.value = applyZipCodeMask(shippingZipCodeInput.value);
        });

        shippingZipCodeInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                calculateShippingQuote();
            }
        });
    }

    if (shippingQuoteButton) {
        shippingQuoteButton.addEventListener("click", () => {
            calculateShippingQuote();
        });
    }

    if (addToCartButton) {
        addToCartButton.addEventListener("click", () => {
            if (addToCartInteractionLocked) {
                return;
            }

            const wasAdded = addCurrentProductToCart();

            if (!wasAdded) {
                return;
            }

            addToCartInteractionLocked = true;
            addToCartButton.disabled = true;

            window.setTimeout(() => {
                addToCartInteractionLocked = false;
                addToCartButton.disabled = false;
            }, 900);
        });
    }

    if (buyNowButton) {
        buyNowButton.addEventListener("click", () => {
            if (buyNowRequestInFlight) {
                return;
            }

            const wasAdded = addCurrentProductToCart({ redirectToCheckout: true });

            if (!wasAdded) {
                return;
            }

            buyNowRequestInFlight = true;
            setBuyNowButtonLoading(true);
        });
    }
}

async function loadProductPage() {
    const slug = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || "");
    const cartState = decodeCartStateFromQuery();
    const requestId = ++activeProductLoadRequestId;

    setProductPageLoadingState({ isLoading: true });

    try {
        const response = await fetch(`/api/products/${encodeURIComponent(slug)}`);

        if (!response.ok) {
            throw new Error("Não foi possível carregar o produto.");
        }

        const product = await response.json();
        await preloadProductAssets(product);

        if (requestId !== activeProductLoadRequestId) {
            return;
        }

        renderProduct(product);

        if (cartState && requestId === activeProductLoadRequestId) {
            restoreSelectedVariationsFromState(product, cartState);
            await restorePersonalizationStateFromCart(product, cartState);
        }

        window.requestAnimationFrame(() => {
            if (requestId !== activeProductLoadRequestId) {
                return;
            }

            setProductPageLoadingState({ isLoading: false });
        });
    } catch (error) {
        if (requestId !== activeProductLoadRequestId) {
            return;
        }

        setProductPageLoadingState({
            isLoading: false,
            errorMessage: error?.message || "Não foi possível carregar o produto."
        });
    }
}

updateCartCount();
loadSharedCategories();
bindProductInteractions();
loadProductPage();
