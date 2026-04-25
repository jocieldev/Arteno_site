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
const desktopCategoriesMenu = document.getElementById("desktopCategoriesMenu");
const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");
const footerCategoriesMenu = document.getElementById("footerCategoriesMenu");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutLayout = document.getElementById("checkoutLayout");
const checkoutEmptyState = document.getElementById("checkoutEmptyState");
const checkoutFeedback = document.getElementById("checkoutFeedback");
const checkoutSummaryItems = document.getElementById("checkoutSummaryItems");
const checkoutSummaryCount = document.getElementById("checkoutSummaryCount");
const checkoutSubtotal = document.getElementById("checkoutSubtotal");
const checkoutDiscountTotal = document.getElementById("checkoutDiscountTotal");
const checkoutShippingTotal = document.getElementById("checkoutShippingTotal");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutSubmitButton = document.getElementById("checkoutSubmitButton");
const checkoutShippingFeedback = document.getElementById("checkoutShippingFeedback");
const checkoutShippingOptions = document.getElementById("checkoutShippingOptions");
const checkoutResult = document.getElementById("checkoutResult");
const checkoutResultTitle = document.getElementById("checkoutResultTitle");
const checkoutResultSubtitle = document.getElementById("checkoutResultSubtitle");
const checkoutResultShell = document.getElementById("checkoutResultShell");
const checkoutModeBadge = document.getElementById("checkoutModeBadge");
const checkoutCardFields = document.getElementById("checkoutCardFields");
const checkoutMercadoPagoPanel = document.getElementById("checkoutMercadoPagoPanel");
const checkoutPaymentBrick = document.getElementById("checkoutPaymentBrick");
const checkoutMercadoPagoHint = document.getElementById("checkoutMercadoPagoHint");
const checkoutLegacyPaymentOptions = document.getElementById("checkoutLegacyPaymentOptions");
const checkoutSubmitNote = document.getElementById("checkoutSubmitNote");
const checkoutSkeleton = document.getElementById("checkoutSkeleton");
const checkoutCouponCodeInput = document.getElementById("checkoutCouponCode");
const checkoutCouponApplyButton = document.getElementById("checkoutCouponApplyButton");
const checkoutCouponFeedback = document.getElementById("checkoutCouponFeedback");
const checkoutCouponApplied = document.getElementById("checkoutCouponApplied");
const checkoutCardNumberInput = document.getElementById("checkoutCardNumberInput");
const checkoutCardExpiryInput = document.getElementById("checkoutCardExpiryInput");
const checkoutCardCvvInput = document.getElementById("checkoutCardCvvInput");
const checkoutCardNumberField = document.getElementById("checkoutCardNumber");
const checkoutCardExpiryField = document.getElementById("checkoutCardExpiry");
const checkoutCardCvvField = document.getElementById("checkoutCardCvv");
const checkoutCardIssuer = document.getElementById("checkoutCardIssuer");
const checkoutCardInstallmentsField = document.getElementById("checkoutCardInstallmentsField");
const checkoutCardInstallments = document.getElementById("checkoutCardInstallments");
const checkoutCardIdentificationType = document.getElementById("checkoutCardIdentificationType");
const SHIPPING_ZIP_STORAGE_KEY = "arteno-shipping-zip-code";
const PERSONALIZATION_IMAGE_DB_NAME = "arteno-personalization-images";
const PERSONALIZATION_IMAGE_STORE_NAME = "uploads";
const MERCADO_PAGO_MIN_BIN_LENGTH = 6;

let checkoutItems = [];
let checkoutCompleted = false;
let availableShippingOptions = [];
let selectedShippingOption = null;
let lastAutoQuotedZipCode = "";
let lastAutoQuotedCartSignature = "";
let lastObservedZipCode = "";
let lastAddressLookupZipCode = "";
let addressLookupRequestInFlight = false;
let checkoutSubmitRequestInFlight = false;
let appliedCoupon = null;
let checkoutConfig = null;
let mercadoPagoInstance = null;
let mercadoPagoSecureFieldsReady = false;
let mercadoPagoCardPaymentMethodId = "";
let mercadoPagoCardBin = "";
let mercadoPagoDetectedCardType = "";
let mercadoPagoInstallmentsCacheKey = "";
let mercadoPagoInstallmentsRequestId = 0;
let installmentsLoadWarningShown = false;
const checkoutPersonalizationPreviewObjectUrls = new Map();

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

function getCategoryUrl(category) {
    return `/categoria/${encodeURIComponent(category.slug || "")}`;
}

function buildCategoryLinkMarkup(category) {
    return `<a href="${escapeHtml(getCategoryUrl(category))}">${escapeHtml(category.name || "Categoria")}</a>`;
}

function buildMobileCategoryItemMarkup(category) {
    return `<a href="${escapeHtml(getCategoryUrl(category))}" class="mobile-category-link">${escapeHtml(category.name || "Categoria")}</a>`;
}

function buildFooterCategoryItemMarkup(category) {
    return `<li><a href="${escapeHtml(getCategoryUrl(category))}">${escapeHtml(category.name || "Categoria")}</a></li>`;
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
    const totalItems = getStoredCartItems().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    document.querySelectorAll(".cart-count").forEach((element) => {
        element.textContent = String(totalItems);
    });
}

function getCartSubtotal(items) {
    return items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
}

function getCouponDiscountAmount() {
    return Number(appliedCoupon?.discountAmount || 0);
}

function clearCouponFeedback() {
    if (!checkoutCouponFeedback) {
        return;
    }

    checkoutCouponFeedback.hidden = true;
    checkoutCouponFeedback.textContent = "";
    checkoutCouponFeedback.className = "checkout-coupon-feedback";
}

function showCouponFeedback(message, type = "error") {
    if (!checkoutCouponFeedback) {
        return;
    }

    checkoutCouponFeedback.hidden = false;
    checkoutCouponFeedback.textContent = message;
    checkoutCouponFeedback.className = `checkout-coupon-feedback ${type}`;
}

function renderAppliedCoupon() {
    if (!checkoutCouponApplied) {
        return;
    }

    if (!appliedCoupon?.code) {
        checkoutCouponApplied.hidden = true;
        checkoutCouponApplied.innerHTML = "";
        return;
    }

    checkoutCouponApplied.hidden = false;
    checkoutCouponApplied.innerHTML = `
        <strong>${escapeHtml(appliedCoupon.code)}</strong>
        <span>${escapeHtml(String(appliedCoupon.percentageOff || 0))}% aplicado com desconto de ${escapeHtml(formatCurrency(appliedCoupon.discountAmount || 0))}.</span>
    `;
}

function getCartSignature(items = checkoutItems) {
    return items
        .map((item) => `${String(item.cartKey || item.slug || "")}:${Number(item.quantity || 0)}`)
        .sort()
        .join("|");
}

function getStoredShippingZipCode() {
    try {
        return normalizeZipCode(window.localStorage.getItem(SHIPPING_ZIP_STORAGE_KEY) || "");
    } catch (_error) {
        return "";
    }
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

function revokeCheckoutPersonalizationPreviewUrls() {
    checkoutPersonalizationPreviewObjectUrls.forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
    });
    checkoutPersonalizationPreviewObjectUrls.clear();
}

function openCheckoutPersonalizationImageDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB indisponível"));
            return;
        }

        const request = window.indexedDB.open(PERSONALIZATION_IMAGE_DB_NAME, 1);
        request.onerror = () => reject(request.error || new Error("Não foi possível abrir o IndexedDB."));
        request.onsuccess = () => resolve(request.result);
    });
}

async function getCheckoutStoredPersonalizationImageFile(storageKey) {
    if (!storageKey) {
        return null;
    }

    if (window.personalizationImageStore?.getFile) {
        return window.personalizationImageStore.getFile(storageKey);
    }

    const database = await openCheckoutPersonalizationImageDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(PERSONALIZATION_IMAGE_STORE_NAME, "readonly");
        const store = transaction.objectStore(PERSONALIZATION_IMAGE_STORE_NAME);
        const request = store.get(storageKey);

        request.onsuccess = () => {
            database.close();
            resolve(request.result?.file || null);
        };
        request.onerror = () => {
            database.close();
            reject(request.error || new Error("Não foi possível carregar a imagem temporária."));
        };
    });
}

function getNormalizedPersonalizationPreviews(item = {}) {
    return (Array.isArray(item.personalizationPreviews) ? item.personalizationPreviews : [])
        .map((preview = {}, index) => ({
            name: String(preview.name || `Prévia ${index + 1}`).trim() || `Prévia ${index + 1}`,
            textValue: String(preview.textValue || item.personalizationName || "").trim(),
            overlayImageKind: String(preview.overlayImageKind || "").trim(),
            overlayImageUrl: String(preview.overlayImageUrl || "").trim(),
            overlayImageStorageKey: String(preview.overlayImageStorageKey || "").trim()
        }))
        .filter((preview) => (
            preview.textValue
            || preview.overlayImageKind
            || preview.overlayImageUrl
            || preview.overlayImageStorageKey
        ));
}

function getCheckoutPersonalizationSummaryEntries(item = {}) {
    const previews = getNormalizedPersonalizationPreviews(item);

    if (previews.length) {
        return previews.map((preview) => {
            const details = [];

            if (preview.textValue) {
                details.push(`Texto: ${preview.textValue}`);
            }

            if (preview.overlayImageKind) {
                details.push(`Imagem: ${preview.overlayImageKind === "upload" ? "enviada pelo cliente" : "selecionada"}`);
            }

            return {
                label: preview.name,
                description: details.join(" | ") || "Personalizado"
            };
        });
    }

    const fallbackEntries = [];

    if (item.personalizationName) {
        fallbackEntries.push({
            label: "Personalização",
            description: `Texto: ${String(item.personalizationName || "").trim()}`
        });
    }

    if (item.personalizationImageKind) {
        fallbackEntries.push({
            label: "Imagem",
            description: item.personalizationImageKind === "upload" ? "Enviada pelo cliente" : "Selecionada"
        });
    }

    return fallbackEntries;
}

function renderCheckoutPersonalizationSummary(item = {}) {
    return getCheckoutPersonalizationSummaryEntries(item).map((entry) => `
        <p>${escapeHtml(entry.label)}: ${escapeHtml(entry.description)}</p>
    `).join("");
}

function renderCheckoutPersonalizationPreview(item = {}) {
    const normalizedPreviews = getNormalizedPersonalizationPreviews(item);
    const previewsWithImages = normalizedPreviews
        .filter((preview) => preview.overlayImageUrl || preview.overlayImageStorageKey);
    const imageEntries = previewsWithImages.length
        ? previewsWithImages.map((preview) => ({
            label: preview.name,
            kind: preview.overlayImageKind,
            imageUrl: preview.overlayImageUrl,
            storageKey: preview.overlayImageStorageKey
        }))
        : [{
            label: "Personalização",
            kind: String(item.personalizationImageKind || "").trim(),
            imageUrl: String(item.personalizationImageUrl || "").trim(),
            storageKey: String(item.personalizationImageStorageKey || "").trim()
        }].filter((entry) => entry.imageUrl || entry.storageKey);

    const summaryMarkup = normalizedPreviews.length > 1
        ? renderCheckoutPersonalizationSummary(item)
        : "";

    if (!imageEntries.length) {
        return summaryMarkup;
    }

    return `${summaryMarkup}${imageEntries.map((entry) => {
        if (entry.kind === "upload" && entry.storageKey) {
            return `
                <div class="checkout-personalization-thumb" data-personalization-storage-key="${escapeHtml(entry.storageKey)}" hidden></div>
            `;
        }

        if (entry.imageUrl) {
            return `
                <div class="checkout-personalization-thumb">
                    <img src="${escapeHtml(entry.imageUrl)}" alt="${escapeHtml(`Imagem de ${entry.label}`)}">
                </div>
            `;
        }

        return "";
    }).join("")}`;
}

async function hydrateCheckoutPersonalizationThumbs() {
    const previewNodes = Array.from(checkoutSummaryItems.querySelectorAll("[data-personalization-storage-key]"));

    if (!previewNodes.length) {
        return;
    }

    await Promise.all(previewNodes.map(async (node) => {
        const storageKey = String(node.getAttribute("data-personalization-storage-key") || "").trim();

        if (!storageKey) {
            return;
        }

        try {
            const file = await getCheckoutStoredPersonalizationImageFile(storageKey);

            if (!file) {
                return;
            }

            const objectUrl = URL.createObjectURL(file);
            checkoutPersonalizationPreviewObjectUrls.set(storageKey, objectUrl);
            node.hidden = false;
            node.innerHTML = `<img src="${escapeHtml(objectUrl)}" alt="Imagem da personalizacao">`;
        } catch (_error) {
            // Se a imagem temporária não existir mais, mantemos apenas o texto.
        }
    }));
}

function renderCheckoutSummary() {
    checkoutItems = getStoredCartItems();
    updateCartCount();

    if (checkoutSkeleton) {
        checkoutSkeleton.hidden = true;
    }

    if (!checkoutItems.length) {
        revokeCheckoutPersonalizationPreviewUrls();
        checkoutLayout.hidden = true;
        checkoutEmptyState.hidden = checkoutCompleted;
        checkoutDiscountTotal.textContent = formatCurrency(0);
        renderAppliedCoupon();

        if (!checkoutCompleted) {
            checkoutEmptyState.hidden = false;
        }

        return;
    }

    checkoutEmptyState.hidden = true;
    checkoutLayout.hidden = false;
    revokeCheckoutPersonalizationPreviewUrls();

    const subtotal = getCartSubtotal(checkoutItems);
    const discountValue = Math.min(subtotal, getCouponDiscountAmount());
    const totalItems = checkoutItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const shippingValue = Number(selectedShippingOption?.price || 0);
    const total = subtotal - discountValue + shippingValue;

    checkoutSummaryCount.textContent = `${totalItems} item(ns)`;
    checkoutSubtotal.textContent = formatCurrency(subtotal);
    checkoutDiscountTotal.textContent = formatCurrency(discountValue);
    checkoutShippingTotal.textContent = selectedShippingOption ? formatCurrency(shippingValue) : "Escolha no checkout";
    checkoutTotal.textContent = formatCurrency(total);
    renderAppliedCoupon();

    checkoutSummaryItems.innerHTML = checkoutItems.map((item) => `
        <article class="checkout-summary-item">
            <img src="${escapeHtml(item.imageUrl || "/img/tabua-produto01.webp")}" alt="${escapeHtml(item.name || "Produto")}">
            <div>
                <strong>${escapeHtml(item.name || "Produto")}</strong>
                ${Array.isArray(item.selectedVariations) ? item.selectedVariations.map((variation) => `<p>${escapeHtml(variation.variationName || "Variação")}: ${escapeHtml(variation.itemLabel || "-")}${variation.price !== null && variation.price !== undefined ? ` (${escapeHtml(formatCurrency(variation.price))})` : ""}</p>`).join("") : ""}
                ${item.personalizationName ? `<p>Gravação: ${escapeHtml(item.personalizationName)}</p>` : ""}
                ${renderCheckoutPersonalizationPreview(item)}
                ${item.personalizationImageKind ? `<p>Imagem aplicada: ${escapeHtml(item.personalizationImageKind === "upload" ? "enviada pelo cliente" : "selecionada")}</p>` : ""}
                <p>Quantidade: ${Number(item.quantity || 0)}</p>
                <span class="checkout-summary-item-price">${formatCurrency(item.price)}</span>
            </div>
        </article>
    `).join("");
    void hydrateCheckoutPersonalizationThumbs();

    void ensureMercadoPagoSecureFields();
    void refreshCheckoutInstallments();
}

function fillCheckoutAddressFromZipCode(address = {}) {
    const streetInput = document.getElementById("checkoutStreet");
    const neighborhoodInput = document.getElementById("checkoutNeighborhood");
    const cityInput = document.getElementById("checkoutCity");
    const stateInput = document.getElementById("checkoutState");

    if (streetInput) {
        streetInput.value = String(address.street || "").trim();
    }

    if (neighborhoodInput) {
        neighborhoodInput.value = String(address.neighborhood || "").trim();
    }

    if (cityInput) {
        cityInput.value = String(address.city || "").trim();
    }

    if (stateInput) {
        stateInput.value = String(address.state || "").trim().toUpperCase();
    }
}

async function lookupAddressByZipCode(zipCode) {
    const normalizedZipCode = normalizeZipCode(zipCode);

    if (normalizedZipCode.length !== 8 || addressLookupRequestInFlight || normalizedZipCode === lastAddressLookupZipCode) {
        return;
    }

    addressLookupRequestInFlight = true;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${normalizedZipCode}/json/`);
        const result = await response.json();

        if (!response.ok || result?.erro) {
            throw new Error("CEP nao encontrado.");
        }

        fillCheckoutAddressFromZipCode({
            street: result.logradouro,
            neighborhood: result.bairro,
            city: result.localidade,
            state: result.uf
        });
        lastAddressLookupZipCode = normalizedZipCode;
    } catch (_error) {
        lastAddressLookupZipCode = "";
    } finally {
        addressLookupRequestInFlight = false;
    }
}

function showShippingFeedback(message, type = "error") {
    if (!checkoutShippingFeedback) {
        return;
    }

    checkoutShippingFeedback.hidden = false;
    checkoutShippingFeedback.textContent = message;
    checkoutShippingFeedback.style.background = type === "success" ? "rgba(28, 139, 83, 0.08)" : "rgba(145, 43, 43, 0.08)";
    checkoutShippingFeedback.style.borderColor = type === "success" ? "rgba(28, 139, 83, 0.14)" : "rgba(145, 43, 43, 0.14)";
    checkoutShippingFeedback.style.color = type === "success" ? "#1c8b53" : "#7b2323";
}

function clearShippingFeedback() {
    if (!checkoutShippingFeedback) {
        return;
    }

    checkoutShippingFeedback.hidden = true;
    checkoutShippingFeedback.textContent = "";
}

function renderShippingOptions() {
    if (!checkoutShippingOptions) {
        return;
    }

    if (!availableShippingOptions.length) {
        checkoutShippingOptions.innerHTML = "";
        return;
    }

    checkoutShippingOptions.innerHTML = availableShippingOptions.map((option) => {
        const optionId = String(option.serviceId || "");
        const isSelected = selectedShippingOption?.serviceId === optionId;

        return `
            <label class="checkout-shipping-option ${isSelected ? "active" : ""}">
                <input type="radio" name="checkoutShippingOption" value="${escapeHtml(optionId)}" ${isSelected ? "checked" : ""}>
                <div>
                    <strong>${escapeHtml(option.company || "Correios")} - ${escapeHtml(option.name || "Frete")}</strong>
                    <span>${escapeHtml(`${String(option.deliveryTime || 0)} dia(s) úteis`)}</span>
                </div>
                <span class="checkout-shipping-option-price">${escapeHtml(formatCurrency(option.price || 0))}</span>
            </label>
        `;
    }).join("");
    checkoutShippingOptions.querySelectorAll('input[name="checkoutShippingOption"]').forEach((inputElement, index) => {
        const labelElement = inputElement.closest(".checkout-shipping-option")?.querySelector("div span");

        if (!labelElement) {
            return;
        }

        labelElement.textContent = formatShippingDeadlineLabel(availableShippingOptions[index] || {});
    });
}

async function calculateCheckoutShipping() {
    if (!checkoutItems.length) {
        showShippingFeedback("Seu carrinho está vazio.");
        return;
    }

    const zipCode = normalizeZipCode(document.getElementById("checkoutZipCode").value);

    if (zipCode.length !== 8) {
        showShippingFeedback("Informe primeiro um CEP válido para calcular o frete.");
        return;
    }

    setStoredShippingZipCode(zipCode);
    clearShippingFeedback();

    try {
        const response = await fetch("/api/shipping/checkout-quote", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                zipCode,
                items: checkoutItems
            })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Não foi possível calcular o frete.");
        }

        availableShippingOptions = Array.isArray(result.options) ? result.options : [];
        selectedShippingOption = availableShippingOptions[0] || null;
        lastAutoQuotedZipCode = zipCode;
        lastAutoQuotedCartSignature = getCartSignature(checkoutItems);
        renderShippingOptions();
        renderCheckoutSummary();

        if (!availableShippingOptions.length) {
            const motoboyMessage = result?.diagnostics?.motoboy?.message;
            const warnings = Array.isArray(result?.warnings) && result.warnings.length
                ? ` ${result.warnings.join(" ")}`
                : "";
            showShippingFeedback(
                motoboyMessage
                    ? `${motoboyMessage}${warnings}`
                    : `Nenhuma opção de frete foi encontrada para este CEP.${warnings}`
            );
            return;
        }

        showShippingFeedback("Selecione uma das opções de frete abaixo.", "success");
    } catch (error) {
        availableShippingOptions = [];
        selectedShippingOption = null;
        lastAutoQuotedZipCode = "";
        lastAutoQuotedCartSignature = "";
        renderShippingOptions();
        renderCheckoutSummary();
        showShippingFeedback(error.message);
    }
}

async function applyCoupon() {
    if (!checkoutItems.length) {
        showCouponFeedback("Seu carrinho está vazio.", "error");
        return;
    }

    const code = String(checkoutCouponCodeInput?.value || "").trim().toUpperCase();

    if (!code) {
        showCouponFeedback("Digite um cupom para validar.", "error");
        return;
    }

    clearCouponFeedback();

    const response = await fetch("/api/checkout/coupon-preview", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            coupon: { code },
            items: checkoutItems
        })
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível aplicar o cupom.");
    }

    appliedCoupon = result.coupon || null;
    renderCheckoutSummary();
    showCouponFeedback("Cupom aplicado com sucesso.", "success");
}

function showCheckoutFeedback(message, type = "info") {
    if (window.showSiteToast) {
        window.showSiteToast(message, type, {
            duration: type === "error" ? 5200 : 4200
        });
    }

    if (!checkoutFeedback) {
        return;
    }

    checkoutFeedback.hidden = false;
    checkoutFeedback.textContent = message;
}

function setCheckoutSubmitButtonLoading(isLoading) {
    if (window.siteUi?.setButtonLoading) {
        window.siteUi.setButtonLoading(checkoutSubmitButton, isLoading, {
            loadingText: "Finalizando..."
        });
        return;
    }

    if (!checkoutSubmitButton) {
        return;
    }

    checkoutSubmitButton.disabled = isLoading;
    checkoutSubmitButton.textContent = isLoading ? "Finalizando..." : "Finalizar compra";
}

function clearCheckoutFeedback() {
    checkoutFeedback.hidden = true;
    checkoutFeedback.textContent = "";
}

function normalizeZipCode(value = "") {
    return String(value).replace(/\D/g, "").slice(0, 8);
}

function normalizePhone(value = "") {
    return String(value).replace(/\D/g, "").slice(0, 11);
}

function normalizeDocumentNumber(value = "") {
    return String(value).replace(/\D/g, "").slice(0, 14);
}

function applyZipCodeMask(value = "") {
    const digits = normalizeZipCode(value);
    return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function applyPhoneMask(value = "") {
    const digits = normalizePhone(value);

    if (digits.length <= 2) {
        return digits;
    }

    if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function applyCpfMask(value = "") {
    const digits = normalizeDocumentNumber(value).slice(0, 11);

    if (digits.length <= 3) {
        return digits;
    }

    if (digits.length <= 6) {
        return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }

    if (digits.length <= 9) {
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }

    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function applyCardNumberMask(value = "") {
    return String(value)
        .replace(/\D/g, "")
        .slice(0, 16)
        .replace(/(\d{4})(?=\d)/g, "$1 ")
        .trim();
}

function applyCardExpiryMask(value = "") {
    const digits = String(value).replace(/\D/g, "").slice(0, 4);
    return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isMercadoPagoCheckoutActive() {
    return Boolean(checkoutConfig?.isConfigured && checkoutConfig?.publicKey && window.MercadoPago);
}

function setCheckoutSubmitAvailability() {
    if (!checkoutSubmitButton) {
        return;
    }

    checkoutSubmitButton.disabled = false;
}

function legacySetMercadoPagoCheckoutVisibility() {
    const enabled = Boolean(checkoutConfig?.isConfigured);

    if (checkoutLegacyPaymentOptions) {
        checkoutLegacyPaymentOptions.hidden = false;
    }

    if (checkoutSubmitNote) {
        checkoutSubmitNote.textContent = enabled
            ? "Checkout transparente ativo: finalize usando o formulário seguro do Mercado Pago acima."
            : "Modo teste ativo: ao finalizar, o pedido será criado com pagamento confirmado automaticamente.";
    }

    if (checkoutMercadoPagoHint) {
        checkoutMercadoPagoHint.textContent = enabled
            ? "Preencha o método desejado no formulário seguro do Mercado Pago para concluir a compra."
            : "Conecte suas credenciais de teste do Mercado Pago para renderizar o Payment Brick aqui.";
    }

    setCheckoutSubmitAvailability();
}

async function submitCheckoutOrder(extraPayload = {}) {
    if (checkoutSubmitRequestInFlight) {
        return;
    }

    if (!checkoutItems.length) {
        throw new Error("Seu carrinho está vazio.");
    }

    if (!selectedShippingOption?.serviceId) {
        throw new Error("Selecione uma opção de frete antes de finalizar a compra.");
    }

    checkoutSubmitRequestInFlight = true;
    setCheckoutSubmitButtonLoading(true);

    try {
        showCheckoutFeedback("Preparando seu pedido...", "info");
        const payload = {
            ...(await buildCheckoutPayload()),
            ...extraPayload
        };
        const response = await fetch("/api/checkout/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Não foi possível finalizar a compra.");
        }

        renderCheckoutResult(result);

        if (result.payment?.status === "approved" || result.payment?.status === "pending") {
            await cleanupStoredPersonalizationImages(payload.items);
            checkoutCompleted = true;
            checkoutLayout.hidden = true;
            checkoutEmptyState.hidden = true;
            setStoredCartItems([]);
            updateCartCount();
        }

        return result;
    } finally {
        checkoutSubmitRequestInFlight = false;
        setCheckoutSubmitButtonLoading(false);
    }
}

async function legacyRenderMercadoPagoBrick() {
    if (!isMercadoPagoCheckoutActive()) {
        return;
    }

    if (!checkoutItems.length) {
        return;
    }

    if (!window.MercadoPago || !checkoutConfig?.publicKey || !checkoutPaymentBrick) {
        return;
    }

    if (!mercadoPagoInstance) {
        mercadoPagoInstance = new window.MercadoPago(checkoutConfig.publicKey, {
            locale: "pt-BR"
        });
    }

    if (mercadoPagoBrickController?.unmount) {
        await mercadoPagoBrickController.unmount();
    }

    checkoutPaymentBrick.innerHTML = "";
    mercadoPagoBrickReady = false;

    const bricksBuilder = mercadoPagoInstance.bricks();
    mercadoPagoBrickController = await bricksBuilder.create("payment", "checkoutPaymentBrick", {
        initialization: {
            amount: Number((getCartSubtotal(checkoutItems) - getCouponDiscountAmount() + Number(selectedShippingOption?.price || 0)).toFixed(2))
        },
        customization: {
            paymentMethods: {
                creditCard: "all",
                debitCard: "all",
                prepaidCard: "all",
            }
        },
        callbacks: {
            onReady: () => {
                mercadoPagoBrickReady = true;
            },
            onSubmit: ({ selectedPaymentMethod, formData }, additionalData) => {
                return submitCheckoutOrder({
                    paymentMethod: "card",
                    mercadoPagoPayment: {
                        selectedPaymentMethod,
                        formData,
                        additionalData: additionalData || {}
                    }
                }).catch((error) => {
                    showCheckoutFeedback(error.message, "error");
                    throw error;
                });
            },
            onError: (error) => {
                const message = error?.message || "Não foi possível carregar o formulário do Mercado Pago.";
                showCheckoutFeedback(message, "error");
            }
        }
    });
}

function setPaymentMethodUI() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "pix";
    const shouldUseSecureFields = selectedMethod === "card" && isMercadoPagoCheckoutActive();

    document.querySelectorAll(".checkout-payment-option").forEach((option) => {
        const input = option.querySelector("input");
        option.classList.toggle("active", input?.checked);
    });

    checkoutCardFields.hidden = selectedMethod !== "card";
    if (checkoutCardNumberInput) {
        checkoutCardNumberInput.hidden = shouldUseSecureFields;
    }
    if (checkoutCardExpiryInput) {
        checkoutCardExpiryInput.hidden = shouldUseSecureFields;
    }
    if (checkoutCardCvvInput) {
        checkoutCardCvvInput.hidden = shouldUseSecureFields;
    }
    if (checkoutCardNumberField) {
        checkoutCardNumberField.hidden = !shouldUseSecureFields;
    }
    if (checkoutCardExpiryField) {
        checkoutCardExpiryField.hidden = !shouldUseSecureFields;
    }
    if (checkoutCardCvvField) {
        checkoutCardCvvField.hidden = !shouldUseSecureFields;
    }

    setCheckoutInstallmentsFieldVisibility();
    void ensureMercadoPagoSecureFields();
    void refreshCheckoutInstallments();
}

function setCardTypeUI(options = {}) {
    const shouldRefreshPaymentMethod = options?.shouldRefreshPaymentMethod !== false;

    document.querySelectorAll(".checkout-card-type-option").forEach((option) => {
        const input = option.querySelector("input");
        option.classList.toggle("active", Boolean(input?.checked));
        option.classList.toggle("disabled", Boolean(input?.disabled));
    });

    if (shouldRefreshPaymentMethod && mercadoPagoCardBin.length >= MERCADO_PAGO_MIN_BIN_LENGTH) {
        void updateMercadoPagoPaymentMethod(mercadoPagoCardBin).catch(() => {
            mercadoPagoCardPaymentMethodId = "";
            resetCheckoutInstallments();
        });
        return;
    }

    void refreshCheckoutInstallments({ force: true });
}

async function loadCheckoutConfig() {
    try {
        const response = await fetch("/api/checkout/config");

        if (!response.ok) {
        throw new Error("Não foi possível carregar a configuração do checkout.");
        }

        checkoutConfig = await response.json();
        checkoutModeBadge.textContent = checkoutConfig.isDevelopmentMode
            ? "Modo desenvolvimento"
            : checkoutConfig.mode === "production"
                ? "Mercado Pago produção"
                : "Mercado Pago sandbox";
        setMercadoPagoCheckoutVisibility();
    } catch (_error) {
        checkoutModeBadge.textContent = "Modo desenvolvimento";
        setMercadoPagoCheckoutVisibility();
    }
}

async function prefillCurrentUser() {
    try {
        const response = await fetch("/api/auth/me");

        if (!response.ok) {
            return;
        }

        const result = await response.json();

        if (!result.user) {
            return;
        }

        document.getElementById("checkoutCustomerName").value = result.user.name || "";
        document.getElementById("checkoutCustomerEmail").value = result.user.email || "";
        document.getElementById("checkoutCustomerPhone").value = applyPhoneMask(result.user.phone || "");
    } catch (_error) {
        // Ignora usuários não autenticados.
    }
}

function prefillStoredShippingZipCode() {
    const checkoutZipCodeInput = document.getElementById("checkoutZipCode");

    if (!checkoutZipCodeInput || checkoutZipCodeInput.value.trim()) {
        return;
    }

    const storedZipCode = getStoredShippingZipCode();

    if (!storedZipCode) {
        return;
    }

    checkoutZipCodeInput.value = applyZipCodeMask(storedZipCode);
    lastObservedZipCode = storedZipCode;

    if (storedZipCode.length === 8) {
        void lookupAddressByZipCode(storedZipCode);
    }
}

function tryAutoCalculateStoredShipping() {
    const checkoutZipCodeInput = document.getElementById("checkoutZipCode");

    if (!checkoutZipCodeInput || !checkoutItems.length) {
        return;
    }

    const zipCode = normalizeZipCode(checkoutZipCodeInput.value);
    const cartSignature = getCartSignature(checkoutItems);

    if (zipCode.length !== 8) {
        return;
    }

    if (zipCode === lastAutoQuotedZipCode && cartSignature === lastAutoQuotedCartSignature) {
        return;
    }

    calculateCheckoutShipping();
}

function buildPseudoQrMarkup(seed = "") {
    const safeSeed = String(seed || "arteno-pix-dev");
    const cells = [];

    for (let index = 0; index < 289; index += 1) {
        const charCode = safeSeed.charCodeAt(index % safeSeed.length);
        const value = (charCode + index * 7) % 11;
        const isFilled = value > 4 || index % 29 === 0;
        cells.push(`<span class="${isFilled ? "is-filled" : ""}"></span>`);
    }

    return `<div class="checkout-pseudo-qr" aria-hidden="true">${cells.join("")}</div>`;
}

function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(date);
}

function buildResultActions() {
    return `
        <div class="checkout-actions-row">
            <a href="/" class="checkout-secondary-link">Voltar para a loja</a>
            <a href="/minha-conta" class="checkout-secondary-link">Minha conta</a>
        </div>
    `;
}

function renderApprovedResult(result) {
    checkoutResultTitle.textContent = "Pagamento confirmado";
    checkoutResultSubtitle.textContent = checkoutConfig?.isDevelopmentMode
        ? "Seu pedido foi concluido automaticamente no modo de teste."
        : "Seu pedido foi confirmado com sucesso pelo Mercado Pago.";

    checkoutResultShell.innerHTML = `
        <article class="checkout-result-card success">
            <h3>Compra concluída</h3>
            <p>${escapeHtml(result.payment?.details?.message || "Pagamento confirmado automaticamente para testes.")}</p>
            <div class="checkout-result-meta">
                <div><span>Pedido</span><strong>${escapeHtml(result.order?.orderNumber || "-")}</strong></div>
                <div><span>Total</span><strong>${formatCurrency(result.order?.totals?.total || 0)}</strong></div>
                <div><span>Status</span><strong>Pagamento confirmado</strong></div>
            </div>
            ${buildResultActions()}
        </article>
    `;
}

function legacyRenderPixResultOriginal(result) {
    const qrCode = result.payment?.details?.qrCode || "";
    const expiresAt = result.payment?.details?.expiresAt || "";

    checkoutResultTitle.textContent = "Pix gerado com sucesso";
    checkoutResultSubtitle.textContent = "Seu pedido foi criado e está aguardando o pagamento via Pix.";

    checkoutResultShell.innerHTML = `
        <article class="checkout-result-card pending">
            <h3>Aguardando pagamento</h3>
            <p>${escapeHtml(result.payment?.details?.instructions || "Escaneie o QR Code abaixo ou copie o código Pix.")}</p>
            <div class="checkout-result-meta">
                <div><span>Pedido</span><strong>${escapeHtml(result.order?.orderNumber || "-")}</strong></div>
                <div><span>Total</span><strong>${formatCurrency(result.order?.totals?.total || 0)}</strong></div>
                <div><span>Validade</span><strong>${escapeHtml(formatDate(expiresAt))}</strong></div>
            </div>
        </article>
        <article class="checkout-result-card">
            <div class="checkout-pix-layout">
                ${buildPseudoQrMarkup(qrCode)}
                <div>
                    <h3>QR Code Pix</h3>
                    <p>Esse visual e uma simulação de como o Pix do Mercado Pago vai aparecer quando as chaves reais forem conectadas.</p>
                    <div class="checkout-copy-box">
                        <textarea id="pixCopyCode" readonly>${escapeHtml(qrCode)}</textarea>
                        <button type="button" class="checkout-copy-button" data-copy-target="pixCopyCode">Copiar código Pix</button>
                    </div>
                </div>
            </div>
            ${buildResultActions()}
        </article>
    `;
}

function renderLegacyPendingResult(result) {
    const legacyLine = result.payment?.details?.ticketUrl || "";
    const expiresAt = result.payment?.details?.expiresAt || "";

    checkoutResultTitle.textContent = "Pagamento pendente";
    checkoutResultSubtitle.textContent = "Seu pedido foi criado e esta aguardando confirmacao.";

    checkoutResultShell.innerHTML = `
        <article class="checkout-result-card pending">
            <h3>Pagamento pendente</h3>
            <p>${escapeHtml(result.payment?.details?.instructions || "Aguardando a confirmacao do pagamento.")}</p>
            <div class="checkout-result-meta">
                <div><span>Pedido</span><strong>${escapeHtml(result.order?.orderNumber || "-")}</strong></div>
                <div><span>Total</span><strong>${formatCurrency(result.order?.totals?.total || 0)}</strong></div>
                <div><span>Vencimento</span><strong>${escapeHtml(formatDate(expiresAt))}</strong></div>
            </div>
            <div class="checkout-copy-box">
                <textarea id="legacyPaymentCode" readonly>${escapeHtml(legacyLine)}</textarea>
            <button type="button" class="checkout-copy-button" data-copy-target="legacyPaymentCode">Copiar codigo</button>
            </div>
            ${buildResultActions()}
        </article>
    `;
}

function renderCardResult(result) {
    const approved = result.payment?.status === "approved";

    checkoutResultTitle.textContent = approved ? "Pagamento aprovado" : "Pagamento recusado";
    checkoutResultSubtitle.textContent = approved
        ? "Seu pedido foi confirmado com sucesso no modo de desenvolvimento."
        : "O cartão foi recusado na simulação. Ajuste os dados ou use outro final de cartão para testar.";

    checkoutResultShell.innerHTML = `
        <article class="checkout-result-card ${approved ? "success" : "error"}">
            <h3>${approved ? "Compra concluída" : "Não foi possível aprovar o pagamento"}</h3>
            <p>${escapeHtml(result.payment?.details?.message || "")}</p>
            <div class="checkout-result-meta">
                <div><span>Pedido</span><strong>${escapeHtml(result.order?.orderNumber || "-")}</strong></div>
                <div><span>Total</span><strong>${formatCurrency(result.order?.totals?.total || 0)}</strong></div>
                <div><span>Cartão final</span><strong>${escapeHtml(result.payment?.details?.lastFour || "0000")}</strong></div>
            </div>
            ${buildResultActions()}
        </article>
    `;
}

function renderCheckoutResult(result) {
    checkoutResult.hidden = false;

    if (result.payment?.status === "approved") {
        renderApprovedResult(result);
    } else if (result.payment?.method === "pix") {
        renderPixResult(result);
    } else {
        renderCardResult(result);
    }

    checkoutResult.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function copyFromTarget(targetId) {
    const target = document.getElementById(targetId);

    if (!target) {
        return;
    }

    try {
        await navigator.clipboard.writeText(target.value);
        showCheckoutFeedback("Código copiado com sucesso.", "success");
    } catch (_error) {
        target.focus();
        target.select();
        showCheckoutFeedback("Selecione e copie manualmente o código exibido.", "warning");
    }
}

async function uploadCheckoutPersonalizationImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/checkout/personalization-image", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível enviar a imagem de personalização.");
    }

    return {
        imageUrl: String(result.imageUrl || "").trim(),
        imagePublicId: String(result.imagePublicId || "").trim()
    };
}

async function resolveCheckoutItemsForSubmission(items = checkoutItems) {
    if (!Array.isArray(items) || !items.length) {
        return [];
    }

    return Promise.all(items.map(async (item = {}) => {
        const resolvedPreviews = Array.isArray(item.personalizationPreviews)
            ? await Promise.all(item.personalizationPreviews.map(async (preview = {}) => {
                if (preview.overlayImageKind !== "upload") {
                    return preview;
                }

                if (preview.overlayImageUrl && !String(preview.overlayImageUrl || "").startsWith("data:image/")) {
                    return preview;
                }

                const previewStorageKey = String(preview.overlayImageStorageKey || "").trim();

                if (!previewStorageKey) {
                    throw new Error(`A imagem de uma das prévias do item "${item.name || "Produto"}" não está mais disponível no navegador. Envie novamente antes de finalizar.`);
                }

                if (!window.personalizationImageStore?.getFile) {
                    throw new Error("O armazenamento temporário de imagens não está disponível neste navegador.");
                }

                const previewFile = await window.personalizationImageStore.getFile(previewStorageKey);

                if (!previewFile) {
                    throw new Error(`A imagem de uma das prévias do item "${item.name || "Produto"}" não foi encontrada. Envie novamente antes de finalizar.`);
                }

                const uploadedPreviewImage = await uploadCheckoutPersonalizationImage(previewFile);

                return {
                    ...preview,
                    overlayImageUrl: uploadedPreviewImage.imageUrl,
                    overlayImagePublicId: uploadedPreviewImage.imagePublicId
                };
            }))
            : [];
        const firstPreviewWithOverlay = resolvedPreviews.find((preview) => preview.overlayImageUrl || preview.overlayImageStorageKey) || null;

        if (firstPreviewWithOverlay) {
            return {
                ...item,
                personalizationImageUrl: firstPreviewWithOverlay.overlayImageUrl || "",
                personalizationImagePublicId: firstPreviewWithOverlay.overlayImagePublicId || "",
                personalizationImageStorageKey: firstPreviewWithOverlay.overlayImageStorageKey || "",
                personalizationImageKind: firstPreviewWithOverlay.overlayImageKind || "",
                personalizationPreviews: resolvedPreviews
            };
        }

        if (item.personalizationImageKind !== "upload") {
            return {
                ...item,
                personalizationImageUrl: String(item.personalizationImageUrl || "").trim(),
                personalizationImagePublicId: String(item.personalizationImagePublicId || "").trim(),
                personalizationImageStorageKey: String(item.personalizationImageStorageKey || "").trim(),
                personalizationImageKind: String(item.personalizationImageKind || "").trim(),
                personalizationPreviews: resolvedPreviews
            };
        }

        if (item.personalizationImageUrl && !String(item.personalizationImageUrl || "").startsWith("data:image/")) {
            return {
                ...item,
                personalizationPreviews: resolvedPreviews
            };
        }

        const storageKey = String(item.personalizationImageStorageKey || "").trim();

        if (!storageKey) {
            throw new Error(`A imagem do item "${item.name || "Produto"}" não está mais disponível no navegador. Envie novamente antes de finalizar.`);
        }

        if (!window.personalizationImageStore?.getFile) {
            throw new Error("O armazenamento temporário de imagens não está disponível neste navegador.");
        }

        const file = await window.personalizationImageStore.getFile(storageKey);

        if (!file) {
            throw new Error(`A imagem do item "${item.name || "Produto"}" não foi encontrada. Envie novamente antes de finalizar.`);
        }

        const uploadedImage = await uploadCheckoutPersonalizationImage(file);

        return {
            ...item,
            personalizationImageUrl: uploadedImage.imageUrl,
            personalizationImagePublicId: uploadedImage.imagePublicId,
            personalizationPreviews: resolvedPreviews
        };
    }));
}

async function cleanupStoredPersonalizationImages(items = []) {
    if (!window.personalizationImageStore?.deleteFile || !Array.isArray(items) || !items.length) {
        return;
    }

    await Promise.all(items.map(async (item = {}) => {
        const storageKey = String(item.personalizationImageStorageKey || "").trim();
        if (storageKey) {
            try {
                await window.personalizationImageStore.deleteFile(storageKey);
            } catch (_error) {
                // Ignora falhas de limpeza local.
            }
        }

        await Promise.all((Array.isArray(item.personalizationPreviews) ? item.personalizationPreviews : []).map(async (preview = {}) => {
            const previewStorageKey = String(preview.overlayImageStorageKey || "").trim();

            if (!previewStorageKey) {
                return;
            }

            try {
                await window.personalizationImageStore.deleteFile(previewStorageKey);
            } catch (_error) {
                // Ignora falhas de limpeza local.
            }
        }));
    }));
}

async function legacyBuildCheckoutPayloadOriginal() {
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "pix";
    const cardType = document.querySelector('input[name="checkoutCardType"]:checked')?.value || "credit";
    const items = await resolveCheckoutItemsForSubmission(checkoutItems);

    return {
        customer: {
            name: document.getElementById("checkoutCustomerName").value.trim(),
            email: document.getElementById("checkoutCustomerEmail").value.trim(),
            phone: document.getElementById("checkoutCustomerPhone").value.trim()
        },
        shippingAddress: {
            zipCode: document.getElementById("checkoutZipCode").value.trim(),
            street: document.getElementById("checkoutStreet").value.trim(),
            number: document.getElementById("checkoutStreetNumber").value.trim(),
            neighborhood: document.getElementById("checkoutNeighborhood").value.trim(),
            city: document.getElementById("checkoutCity").value.trim(),
            state: document.getElementById("checkoutState").value.trim(),
            complement: document.getElementById("checkoutComplement").value.trim()
        },
        shippingOption: selectedShippingOption || {},
        coupon: appliedCoupon ? { code: appliedCoupon.code } : null,
        paymentMethod,
        items,
        card: paymentMethod === "card" ? {
            number: document.getElementById("checkoutCardNumber").value.trim(),
            holderName: document.getElementById("checkoutCardHolder").value.trim(),
            expiry: document.getElementById("checkoutCardExpiry").value.trim(),
            cvv: document.getElementById("checkoutCardCvv").value.trim()
        } : {}
    };
}

function handleCartStateChange() {
    const checkoutZipCodeInput = document.getElementById("checkoutZipCode");
    const storedZipCode = getStoredShippingZipCode();

    if (checkoutZipCodeInput && storedZipCode && normalizeZipCode(checkoutZipCodeInput.value) !== storedZipCode) {
        checkoutZipCodeInput.value = applyZipCodeMask(storedZipCode);
        lastObservedZipCode = storedZipCode;
    }

    const previousSignature = getCartSignature(checkoutItems);
    renderCheckoutSummary();
    const nextSignature = getCartSignature(checkoutItems);

    if (!nextSignature) {
        availableShippingOptions = [];
        selectedShippingOption = null;
        lastAutoQuotedZipCode = "";
        lastAutoQuotedCartSignature = "";
        appliedCoupon = null;
        renderShippingOptions();
        clearShippingFeedback();
        clearCouponFeedback();
        return;
    }

    if (previousSignature === nextSignature) {
        return;
    }

    availableShippingOptions = [];
    selectedShippingOption = null;
    appliedCoupon = null;
    renderShippingOptions();
    renderCheckoutSummary();
    clearShippingFeedback();
    clearCouponFeedback();

    if (nextSignature !== lastAutoQuotedCartSignature) {
        lastAutoQuotedCartSignature = "";
    }

    const zipCode = normalizeZipCode(document.getElementById("checkoutZipCode")?.value || "");

    if (zipCode.length === 8) {
        calculateCheckoutShipping();
    }
}

async function handleCheckoutSubmit(event) {
    event.preventDefault();
    if (checkoutSubmitRequestInFlight) {
        return;
    }

    clearCheckoutFeedback();

    if (!checkoutItems.length) {
        showCheckoutFeedback("Seu carrinho está vazio.", "error");
        return;
    }

    if (!selectedShippingOption?.serviceId) {
        showCheckoutFeedback("Selecione uma opção de frete antes de finalizar a compra.", "error");
        return;
    }

    checkoutSubmitRequestInFlight = true;
    setCheckoutSubmitButtonLoading(true);

    try {
        showCheckoutFeedback("Preparando seu pedido...", "info");
        const payload = await buildCheckoutPayload();
        const response = await fetch("/api/checkout/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Não foi possível finalizar a compra.");
        }

        renderCheckoutResult(result);

        if (result.payment?.status === "approved" || result.payment?.status === "pending") {
            await cleanupStoredPersonalizationImages(payload.items);
            checkoutCompleted = true;
            checkoutLayout.hidden = true;
            checkoutEmptyState.hidden = true;
            setStoredCartItems([]);
            updateCartCount();
        }
    } catch (error) {
        showCheckoutFeedback(error.message, "error");
    } finally {
        checkoutSubmitRequestInFlight = false;
        setCheckoutSubmitButtonLoading(false);
    }
}

async function legacyHandleCheckoutSubmitRealOriginal(event) {
    event.preventDefault();

    try {
        clearCheckoutFeedback();

        if (isMercadoPagoCheckoutActive()) {
            showCheckoutFeedback("Use o formulário seguro do Mercado Pago para concluir o pagamento.", "info");
            return;
        }

        await submitCheckoutOrder();
    } catch (error) {
        showCheckoutFeedback(error.message, "error");
    }
}

function bindCheckoutInteractions() {
    document.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
        input.addEventListener("change", setPaymentMethodUI);
    });

    document.querySelectorAll('input[name="checkoutCardType"]').forEach((input) => {
        input.addEventListener("change", setCardTypeUI);
    });

    checkoutForm.addEventListener("submit", handleCheckoutSubmitReal);

    document.getElementById("checkoutZipCode").addEventListener("input", (event) => {
        event.target.value = applyZipCodeMask(event.target.value);
        const normalizedZipCode = normalizeZipCode(event.target.value);
        setStoredShippingZipCode(normalizedZipCode);

        if (normalizedZipCode === lastObservedZipCode) {
            return;
        }

        lastObservedZipCode = normalizedZipCode;

        availableShippingOptions = [];
        selectedShippingOption = null;
        renderShippingOptions();
        renderCheckoutSummary();
        clearShippingFeedback();

        if (normalizedZipCode !== lastAutoQuotedZipCode) {
            lastAutoQuotedZipCode = "";
            lastAutoQuotedCartSignature = "";
        }

        if (normalizedZipCode !== lastAddressLookupZipCode) {
            lastAddressLookupZipCode = "";
        }

        if (normalizedZipCode.length === 8) {
            void lookupAddressByZipCode(normalizedZipCode);
        }

        if (normalizedZipCode.length === 8 && normalizedZipCode !== lastAutoQuotedZipCode) {
            calculateCheckoutShipping();
        }
    });

    document.getElementById("checkoutCustomerPhone").addEventListener("input", (event) => {
        event.target.value = applyPhoneMask(event.target.value);
    });

    document.getElementById("checkoutCustomerDocument").addEventListener("input", (event) => {
        event.target.value = applyCpfMask(event.target.value);
    });

    if (checkoutCardNumberInput) {
        checkoutCardNumberInput.addEventListener("input", (event) => {
            event.target.value = applyCardNumberMask(event.target.value);
        });
    }

    if (checkoutCardExpiryInput) {
        checkoutCardExpiryInput.addEventListener("input", (event) => {
            event.target.value = applyCardExpiryMask(event.target.value);
        });
    }

    if (checkoutCardCvvInput) {
        checkoutCardCvvInput.addEventListener("input", (event) => {
            event.target.value = String(event.target.value).replace(/\D/g, "").slice(0, 4);
        });
    }

    if (checkoutCouponCodeInput) {
        checkoutCouponCodeInput.addEventListener("input", (event) => {
            event.target.value = String(event.target.value || "").toUpperCase().replace(/\s+/g, "");
        });

        checkoutCouponCodeInput.addEventListener("keydown", async (event) => {
            if (event.key !== "Enter") {
                return;
            }

            event.preventDefault();

            try {
                await applyCoupon();
            } catch (error) {
                showCouponFeedback(error.message, "error");
            }
        });
    }

    if (checkoutCouponApplyButton) {
        checkoutCouponApplyButton.addEventListener("click", async () => {
            try {
                await applyCoupon();
            } catch (error) {
                showCouponFeedback(error.message, "error");
            }
        });
    }

    checkoutResult.addEventListener("click", (event) => {
        const copyButton = event.target.closest("[data-copy-target]");

        if (!copyButton) {
            return;
        }

        copyFromTarget(copyButton.dataset.copyTarget);
    });

    if (checkoutShippingOptions) {
        checkoutShippingOptions.addEventListener("change", (event) => {
            const selectedId = event.target instanceof HTMLInputElement ? event.target.value : "";

            if (!selectedId) {
                return;
            }

            selectedShippingOption = availableShippingOptions.find((option) => String(option.serviceId) === selectedId) || null;
            renderShippingOptions();
            renderCheckoutSummary();
        });
    }
}

function setMercadoPagoCheckoutVisibility() {
    const enabled = Boolean(checkoutConfig?.isConfigured && checkoutConfig?.publicKey);
    const cardPaymentInput = document.querySelector('input[name="paymentMethod"][value="card"]');
    const cardPaymentOption = cardPaymentInput ? cardPaymentInput.closest(".checkout-payment-option") : null;

    if (checkoutMercadoPagoPanel) {
        checkoutMercadoPagoPanel.hidden = true;
    }

    if (checkoutLegacyPaymentOptions) {
        checkoutLegacyPaymentOptions.hidden = false;
    }

    if (cardPaymentOption) {
        cardPaymentOption.hidden = false;
    }

    if (checkoutSubmitNote) {
        checkoutSubmitNote.textContent = enabled
            ? "Seu layout continua o mesmo, com Pix e cartao processados pelo Mercado Pago no backend."
            : "Modo teste ativo: ao finalizar, o pedido sera criado com pagamento confirmado automaticamente.";
    }

    setPaymentMethodUI();
    setCheckoutSubmitAvailability();
}

async function renderMercadoPagoBrick() {
    return;
}

function getCheckoutAmount() {
    return Number((getCartSubtotal(checkoutItems) - getCouponDiscountAmount() + Number(selectedShippingOption?.price || 0)).toFixed(2));
}

function getSelectedCardType() {
    return document.querySelector('input[name="checkoutCardType"]:checked')?.value || "credit";
}

function setSelectedCardType(cardType) {
    const normalizedCardType = cardType === "debit" ? "debit" : "credit";
    const radio = document.querySelector(`input[name="checkoutCardType"][value="${normalizedCardType}"]`);

    if (!radio) {
        return false;
    }

    const changed = !radio.checked;
    radio.checked = true;
    return changed;
}

function setCardTypeAvailability({ hasCredit = true, hasDebit = true } = {}) {
    document.querySelectorAll('input[name="checkoutCardType"]').forEach((input) => {
        if (!(input instanceof HTMLInputElement)) {
            return;
        }

        if (input.value === "credit") {
            input.disabled = !hasCredit;
            return;
        }

        if (input.value === "debit") {
            input.disabled = !hasDebit;
        }
    });
}

function resolvePreferredCardType(methods = []) {
    const normalizedMethods = Array.isArray(methods) ? methods : [];
    const hasCredit = normalizedMethods.some((method = {}) => String(method.payment_type_id || "").toLowerCase() === "credit_card");
    const hasDebit = normalizedMethods.some((method = {}) => String(method.payment_type_id || "").toLowerCase() === "debit_card");
    const selectedType = getSelectedCardType();

    if (selectedType === "credit" && hasCredit) {
        return "credit";
    }

    if (selectedType === "debit" && hasDebit) {
        return "debit";
    }

    if (hasCredit) {
        return "credit";
    }

    if (hasDebit) {
        return "debit";
    }

    return selectedType;
}

function pickMercadoPagoPaymentMethod(methods = [], preferredType = getSelectedCardType()) {
    const normalizedMethods = Array.isArray(methods) ? methods : [];
    const paymentTypeId = preferredType === "debit" ? "debit_card" : "credit_card";

    return normalizedMethods.find((method = {}) => String(method.payment_type_id || "").toLowerCase() === paymentTypeId)
        || normalizedMethods[0]
        || null;
}

function setCheckoutInstallmentsFieldVisibility() {
    if (!checkoutCardInstallmentsField) {
        return;
    }

    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "pix";
    const cardType = getSelectedCardType();
    checkoutCardInstallmentsField.hidden = !(selectedMethod === "card" && cardType === "credit");
}

function setCheckoutInstallmentsOptions(options = [], selectedInstallments = 1) {
    if (!checkoutCardInstallments) {
        return;
    }

    const normalizedOptions = Array.isArray(options) && options.length
        ? options
        : [{ value: 1, label: "1x sem juros" }];

    checkoutCardInstallments.innerHTML = normalizedOptions
        .map((option) => `<option value="${String(option.value)}">${escapeHtml(option.label)}</option>`)
        .join("");
    checkoutCardInstallments.value = String(selectedInstallments);

    if (checkoutCardInstallments.value !== String(selectedInstallments)) {
        checkoutCardInstallments.value = String(normalizedOptions[0]?.value || 1);
    }
}

function setCheckoutInstallmentsHint(message) {
    if (!checkoutCardInstallments) {
        return;
    }

    checkoutCardInstallments.innerHTML = `<option value="1">${escapeHtml(message)}</option>`;
    checkoutCardInstallments.value = "1";
}

function resetCheckoutInstallments() {
    mercadoPagoInstallmentsCacheKey = "";
    setCheckoutInstallmentsOptions([{ value: 1, label: "1x sem juros" }], 1);
    if (checkoutCardIssuer) {
        checkoutCardIssuer.innerHTML = '<option value=""></option>';
        checkoutCardIssuer.value = "";
    }
}

async function fetchCheckoutCardInstallments({ amount, bin, paymentMethodId }) {
    const query = new URLSearchParams({
        amount: String(Number(amount || 0)),
        bin: String(bin || "")
    });

    if (paymentMethodId) {
        query.set("paymentMethodId", String(paymentMethodId));
    }

    const response = await fetch(`/api/checkout/card-installments?${query.toString()}`, {
        credentials: "same-origin"
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Nao foi possivel carregar as opcoes de parcelamento.");
    }

    return {
        payerCosts: Array.isArray(result.payerCosts) ? result.payerCosts : [],
        issuerId: String(result.issuerId || "").trim(),
        policy: result.policy && typeof result.policy === "object" ? result.policy : null
    };
}

async function refreshCheckoutInstallments({ force = false } = {}) {
    setCheckoutInstallmentsFieldVisibility();

    if (!checkoutCardInstallments) {
        return;
    }

    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "pix";
    const cardType = getSelectedCardType();

    if (selectedMethod !== "card" || cardType !== "credit" || !isMercadoPagoCheckoutActive()) {
        resetCheckoutInstallments();
        return;
    }

    const amount = getCheckoutAmount();
    if (!amount || amount <= 0) {
        resetCheckoutInstallments();
        return;
    }

    if (mercadoPagoCardBin.length < MERCADO_PAGO_MIN_BIN_LENGTH || !mercadoPagoCardPaymentMethodId) {
        setCheckoutInstallmentsHint("Digite os 6 primeiros digitos para carregar as parcelas");
        return;
    }

    const requestKey = `${mercadoPagoCardPaymentMethodId}|${mercadoPagoCardBin}|${amount.toFixed(2)}`;
    if (!force && mercadoPagoInstallmentsCacheKey === requestKey) {
        return;
    }

    mercadoPagoInstallmentsCacheKey = requestKey;
    const requestId = ++mercadoPagoInstallmentsRequestId;

    try {
        const { payerCosts, issuerId, policy } = await fetchCheckoutCardInstallments({
            amount,
            bin: mercadoPagoCardBin,
            paymentMethodId: mercadoPagoCardPaymentMethodId
        });

        if (requestId !== mercadoPagoInstallmentsRequestId) {
            return;
        }

        const options = payerCosts
            .map((cost = {}) => {
                const installments = Number(cost.installments || 0);
                if (!Number.isInteger(installments) || installments < 1) {
                    return null;
                }

                const promotionLabel = String(cost.promotionLabel || "").trim();
                const label = promotionLabel
                    || String(cost.recommended_message || "").trim()
                    || `${installments}x de ${formatCurrency(cost.installment_amount || 0)} (total ${formatCurrency(cost.total_amount || 0)})`;
                return {
                    value: installments,
                    label
                };
            })
            .filter(Boolean);

        const uniqueOptions = options.filter((option, index, list) => (
            list.findIndex((item) => Number(item.value) === Number(option.value)) === index
        ));

        setCheckoutInstallmentsOptions(uniqueOptions, 1);
        if (checkoutCardIssuer) {
            const resolvedIssuerId = issuerId || String(payerCosts[0]?.issuer?.id || "").trim();
            checkoutCardIssuer.innerHTML = `<option value="${escapeHtml(resolvedIssuerId)}">${escapeHtml(resolvedIssuerId || "default")}</option>`;
            checkoutCardIssuer.value = resolvedIssuerId;
        }
        if (policy?.enabled && Number(policy.desiredInterestFreeInstallments || 1) > Number(policy.appliedInterestFreeInstallments || 1)) {
            showCheckoutFeedback(
                `Sua promocao permite ate ${Number(policy.desiredInterestFreeInstallments || 1)}x sem juros, mas a operadora deste cartao liberou ate ${Number(policy.appliedInterestFreeInstallments || 1)}x sem juros para este pedido.`,
                "info"
            );
        }
        installmentsLoadWarningShown = false;
    } catch (_error) {
        resetCheckoutInstallments();
        if (!installmentsLoadWarningShown) {
            showCheckoutFeedback("Nao foi possivel carregar o parcelamento agora. Tente novamente em alguns segundos ou finalize em 1x.", "warning");
            installmentsLoadWarningShown = true;
        }
    }
}

async function updateMercadoPagoPaymentMethod(bin = "") {
    mercadoPagoCardBin = String(bin || "").trim();
    mercadoPagoCardPaymentMethodId = "";
    mercadoPagoInstallmentsCacheKey = "";

    if (!mercadoPagoInstance || mercadoPagoCardBin.length < MERCADO_PAGO_MIN_BIN_LENGTH) {
        mercadoPagoDetectedCardType = "";
        setCardTypeAvailability({ hasCredit: true, hasDebit: true });
        setCardTypeUI({ shouldRefreshPaymentMethod: false });
        resetCheckoutInstallments();
        return;
    }

    const response = await mercadoPagoInstance.getPaymentMethods({ bin: mercadoPagoCardBin });
    const availableMethods = Array.isArray(response?.results) ? response.results : [];
    const hasCredit = availableMethods.some((method = {}) => String(method.payment_type_id || "").toLowerCase() === "credit_card");
    const hasDebit = availableMethods.some((method = {}) => String(method.payment_type_id || "").toLowerCase() === "debit_card");
    setCardTypeAvailability({ hasCredit, hasDebit });
    const preferredType = resolvePreferredCardType(availableMethods);
    mercadoPagoDetectedCardType = preferredType;
    const cardTypeChanged = setSelectedCardType(preferredType);

    if (cardTypeChanged) {
        showCheckoutFeedback(
            preferredType === "debit"
                ? "Cartao detectado como debito. Pagamento sera a vista."
                : "Cartao detectado como credito. Parcelamento habilitado conforme a operadora.",
            "info"
        );
        setCardTypeUI({ shouldRefreshPaymentMethod: false });
    }

    const selectedMethod = pickMercadoPagoPaymentMethod(availableMethods, preferredType);

    if (!selectedMethod?.id) {
        throw new Error("Nao foi possivel identificar a bandeira do cartao informado.");
    }

    mercadoPagoCardPaymentMethodId = String(selectedMethod.id).trim();
    await refreshCheckoutInstallments({ force: true });
}

async function ensureMercadoPagoSecureFields() {
    if (mercadoPagoSecureFieldsReady || !isMercadoPagoCheckoutActive()) {
        return;
    }

    if (!checkoutCardNumberField || !checkoutCardExpiryField || !checkoutCardCvvField) {
        return;
    }

    if (!mercadoPagoInstance) {
        mercadoPagoInstance = new window.MercadoPago(checkoutConfig.publicKey, {
            locale: "pt-BR"
        });
    }

    const mountedCardNumberField = mercadoPagoInstance.fields.create("cardNumber", {
        placeholder: "0000 0000 0000 0000"
    }).mount("checkoutCardNumber");
    mercadoPagoInstance.fields.create("expirationDate", {
        placeholder: "MM/AA"
    }).mount("checkoutCardExpiry");
    mercadoPagoInstance.fields.create("securityCode", {
        placeholder: "123"
    }).mount("checkoutCardCvv");

    if (mountedCardNumberField?.on) {
        mountedCardNumberField.on("binChange", ({ bin }) => {
            if (!bin || String(bin).trim().length < MERCADO_PAGO_MIN_BIN_LENGTH) {
                mercadoPagoCardBin = "";
                mercadoPagoCardPaymentMethodId = "";
                mercadoPagoDetectedCardType = "";
                setCardTypeAvailability({ hasCredit: true, hasDebit: true });
                setCardTypeUI({ shouldRefreshPaymentMethod: false });
                setCheckoutInstallmentsHint("Digite os 6 primeiros digitos para carregar as parcelas");
                return;
            }

            updateMercadoPagoPaymentMethod(bin).catch(() => {
                mercadoPagoCardPaymentMethodId = "";
                resetCheckoutInstallments();
            });
        });
    }

    if (checkoutCardIdentificationType) {
        checkoutCardIdentificationType.innerHTML = '<option value="CPF">CPF</option>';
        checkoutCardIdentificationType.value = "CPF";
    }

    if (checkoutCardInstallments) {
        setCheckoutInstallmentsHint("Digite os 6 primeiros digitos para carregar as parcelas");
    }

    mercadoPagoSecureFieldsReady = true;
}

async function buildMercadoPagoCardPayment() {
    await ensureMercadoPagoSecureFields();

    if (!mercadoPagoSecureFieldsReady || !mercadoPagoInstance?.fields) {
        throw new Error("Os campos seguros do cartao ainda nao ficaram prontos. Tente novamente em alguns segundos.");
    }

    const identificationNumber = normalizeDocumentNumber(document.getElementById("checkoutCustomerDocument").value);
    const cardholderName = document.getElementById("checkoutCardHolder").value.trim();

    if (!cardholderName || identificationNumber.length !== 11) {
        throw new Error("Preencha o nome no cartao e o CPF do comprador para continuar.");
    }

    if (!mercadoPagoCardPaymentMethodId) {
        throw new Error("Nao foi possivel identificar o cartao. Confira os dados digitados e tente novamente.");
    }

    const selectedCardType = getSelectedCardType();
    const installments = selectedCardType === "credit"
        ? Number(checkoutCardInstallments?.value || 1)
        : 1;

    if (!Number.isInteger(installments) || installments < 1) {
        throw new Error("Nao foi possivel validar o parcelamento escolhido.");
    }

    const token = await mercadoPagoInstance.fields.createCardToken({
        cardholderName,
        identificationType: "CPF",
        identificationNumber
    });

    if (!token?.id) {
        throw new Error("Nao foi possivel tokenizar o cartao com seguranca.");
    }

    return {
        token: token.id,
        payment_method_id: mercadoPagoCardPaymentMethodId,
        issuer_id: checkoutCardIssuer?.value || "",
        installments,
        payer: {
            email: document.getElementById("checkoutCustomerEmail").value.trim(),
            identification: {
                type: "CPF",
                number: identificationNumber
            }
        }
    };
}

function renderPixResult(result) {
    const qrCode = result.payment?.details?.qrCode || "";
    const qrCodeBase64 = result.payment?.details?.qrCodeBase64 || "";
    const expiresAt = result.payment?.details?.expiresAt || "";
    const qrCodeMarkup = qrCodeBase64
        ? `<img src="data:image/png;base64,${escapeHtml(qrCodeBase64)}" alt="QR Code Pix" class="checkout-pix-image">`
        : buildPseudoQrMarkup(qrCode);

    checkoutResultTitle.textContent = "Pix gerado com sucesso";
    checkoutResultSubtitle.textContent = "Seu pedido foi criado e esta aguardando o pagamento via Pix.";

    checkoutResultShell.innerHTML = `
        <article class="checkout-result-card pending">
            <h3>Aguardando pagamento</h3>
            <p>${escapeHtml(result.payment?.details?.instructions || "Escaneie o QR Code abaixo ou copie a chave Pix.")}</p>
            <div class="checkout-result-meta">
                <div><span>Pedido</span><strong>${escapeHtml(result.order?.orderNumber || "-")}</strong></div>
                <div><span>Total</span><strong>${formatCurrency(result.order?.totals?.total || 0)}</strong></div>
                <div><span>Validade</span><strong>${escapeHtml(formatDate(expiresAt))}</strong></div>
            </div>
        </article>
        <article class="checkout-result-card">
            <div class="checkout-pix-layout">
                ${qrCodeMarkup}
                <div>
                    <h3>QR Code Pix</h3>
                    <p>Escaneie o QR Code abaixo ou copie a chave Pix com o valor da compra. Essas instrucoes tambem foram enviadas para o email informado no checkout.</p>
                    <div class="checkout-copy-box">
                        <textarea id="pixCopyCode" readonly>${escapeHtml(qrCode)}</textarea>
                        <button type="button" class="checkout-copy-button" data-copy-target="pixCopyCode">Copiar chave Pix</button>
                    </div>
                </div>
            </div>
            ${buildResultActions()}
        </article>
    `;
}

async function buildCheckoutPayload() {
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "pix";
    const cardType = document.querySelector('input[name="checkoutCardType"]:checked')?.value || "credit";
    const items = await resolveCheckoutItemsForSubmission(checkoutItems);

    return {
        customer: {
            name: document.getElementById("checkoutCustomerName").value.trim(),
            documentNumber: document.getElementById("checkoutCustomerDocument").value.trim(),
            email: document.getElementById("checkoutCustomerEmail").value.trim(),
            phone: document.getElementById("checkoutCustomerPhone").value.trim()
        },
        shippingAddress: {
            zipCode: document.getElementById("checkoutZipCode").value.trim(),
            street: document.getElementById("checkoutStreet").value.trim(),
            number: document.getElementById("checkoutStreetNumber").value.trim(),
            neighborhood: document.getElementById("checkoutNeighborhood").value.trim(),
            city: document.getElementById("checkoutCity").value.trim(),
            state: document.getElementById("checkoutState").value.trim(),
            complement: document.getElementById("checkoutComplement").value.trim()
        },
        shippingOption: selectedShippingOption || {},
        coupon: appliedCoupon ? { code: appliedCoupon.code } : null,
        paymentMethod,
        items,
        card: paymentMethod === "card" ? {
            type: cardType,
            number: checkoutCardNumberInput?.value.trim() || "",
            holderName: document.getElementById("checkoutCardHolder").value.trim(),
            expiry: checkoutCardExpiryInput?.value.trim() || "",
            cvv: checkoutCardCvvInput?.value.trim() || ""
        } : {}
    };
}

async function handleCheckoutSubmitReal(event) {
    event.preventDefault();

    try {
        clearCheckoutFeedback();
        const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "pix";

        if (selectedMethod === "card" && isMercadoPagoCheckoutActive()) {
            const selectedCardType = getSelectedCardType();
            const mercadoPagoPayment = await buildMercadoPagoCardPayment();
            await submitCheckoutOrder({
                paymentMethod: "card",
                mercadoPagoPayment: {
                    selectedPaymentMethod: "card",
                    formData: mercadoPagoPayment,
                    additionalData: {
                        cardType: selectedCardType,
                        detectedCardType: mercadoPagoDetectedCardType || selectedCardType
                    }
                }
            });
            return;
        }

        await submitCheckoutOrder();
    } catch (error) {
        showCheckoutFeedback(error.message, "error");
    }
}

loadSharedCategories();
loadCheckoutConfig();
prefillCurrentUser();
prefillStoredShippingZipCode();
renderCheckoutSummary();
bindCheckoutInteractions();
setPaymentMethodUI();
setCardTypeUI();
tryAutoCalculateStoredShipping();
window.addEventListener("storage", handleCartStateChange);
window.addEventListener("cart:updated", handleCartStateChange);
