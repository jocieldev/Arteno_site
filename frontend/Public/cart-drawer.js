(function initCartDrawer() {
    const cartTriggers = document.querySelectorAll("#cart");

    if (!cartTriggers.length) {
        return;
    }

    const SHIPPING_ZIP_STORAGE_KEY = "arteno-shipping-zip-code";
    const PERSONALIZATION_IMAGE_DB_NAME = "arteno-personalization-images";
    const PERSONALIZATION_IMAGE_STORE_NAME = "uploads";
    const personalizationPreviewObjectUrls = new Map();

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

    function formatShippingDeadlineLabel(option = {}) {
        const productionDays = Number(option.productionDays || 0);
        const deliveryDays = Number(option.deliveryTime || 0);
        const totalDeliveryDays = Number(option.totalDeliveryDays || (productionDays + deliveryDays));

        if (!productionDays) {
            return `${deliveryDays} dia(s) úteis`;
        }

        return `${productionDays} dia(s) produção + ${deliveryDays} dia(s) entrega = ${totalDeliveryDays} dia(s) úteis`;
    }

    function normalizeZipCode(value = "") {
        return String(value).replace(/\D/g, "").slice(0, 8);
    }

    function applyZipCodeMask(value = "") {
        const digits = normalizeZipCode(value);
        return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
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

    function getCartTotalItems(items = getStoredCartItems()) {
        return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    }

    function getCartSubtotal(items = getStoredCartItems()) {
        return items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    }

    function getCartSignature(items = getStoredCartItems()) {
        return items
            .map((item) => `${String(item.cartKey || item.slug || "")}:${Number(item.quantity || 0)}`)
            .sort()
            .join("|");
    }

    function updateCartCount() {
        const totalItems = getCartTotalItems();
        document.querySelectorAll(".cart-count").forEach((element) => {
            element.textContent = String(totalItems);
        });
    }

    function renderSelectedVariations(item = {}) {
        if (!Array.isArray(item.selectedVariations) || !item.selectedVariations.length) {
            return "";
        }

        return item.selectedVariations.map((variation) => `
            <p class="cart-drawer-item-detail">${escapeHtml(variation.variationName || "Variação")}: ${escapeHtml(variation.itemLabel || "-")}${variation.price !== null && variation.price !== undefined ? ` (${escapeHtml(formatCurrency(variation.price))})` : ""}</p>
        `).join("");
    }

    function revokePersonalizationPreviewUrls() {
        personalizationPreviewObjectUrls.forEach((objectUrl) => {
            URL.revokeObjectURL(objectUrl);
        });
        personalizationPreviewObjectUrls.clear();
    }

    function openPersonalizationImageDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("IndexedDB indisponivel"));
                return;
            }

            const request = window.indexedDB.open(PERSONALIZATION_IMAGE_DB_NAME, 1);
            request.onerror = () => reject(request.error || new Error("Nao foi possivel abrir o IndexedDB."));
            request.onsuccess = () => resolve(request.result);
        });
    }

    async function getStoredPersonalizationImageFile(storageKey) {
        if (!storageKey) {
            return null;
        }

        if (window.personalizationImageStore?.getFile) {
            return window.personalizationImageStore.getFile(storageKey);
        }

        const database = await openPersonalizationImageDatabase();

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
                reject(request.error || new Error("Nao foi possivel carregar a imagem temporaria."));
            };
        });
    }

    function renderPersonalizationImagePreview(item = {}) {
        if (item.personalizationImageKind === "upload" && item.personalizationImageStorageKey) {
            return `
                <div class="cart-drawer-personalization-thumb" data-personalization-storage-key="${escapeHtml(item.personalizationImageStorageKey)}" hidden></div>
            `;
        }

        if (item.personalizationImageUrl) {
            return `
                <div class="cart-drawer-personalization-thumb">
                    <img src="${escapeHtml(item.personalizationImageUrl)}" alt="Imagem da personalizacao">
                </div>
            `;
        }

        return "";
    }

    const drawerMarkup = `
        <div class="cart-drawer-backdrop" id="cartDrawerBackdrop"></div>
        <aside class="cart-drawer" id="cartDrawer" aria-hidden="true">
            <div class="cart-drawer-header">
                <div class="cart-drawer-title">
                    <i class="fa-solid fa-bag-shopping"></i>
                    <div>
                        <strong>Seu carrinho</strong>
                        <span id="cartDrawerCountLabel">0 item(ns)</span>
                    </div>
                </div>
                <button type="button" class="cart-drawer-close" id="cartDrawerClose" aria-label="Fechar carrinho">X</button>
            </div>
            <div class="cart-drawer-body">
                <div class="cart-drawer-empty" id="cartDrawerEmpty" hidden>
                    <p>Seu carrinho esta vazio no momento.</p>
                </div>
                <div class="cart-drawer-items" id="cartDrawerItems"></div>
            </div>
            <div class="cart-drawer-footer">
                <section class="cart-drawer-shipping" id="cartDrawerShippingBlock">
                    <div class="cart-drawer-shipping-header">
                        <strong>Frete do carrinho</strong>
                        <span>Calcule para todos os itens juntos.</span>
                    </div>
                    <div class="cart-drawer-shipping-form">
                        <input type="text" id="cartDrawerZipCode" inputmode="numeric" autocomplete="postal-code" placeholder="Digite seu CEP">
                        <button type="button" id="cartDrawerShippingButton">Calcular frete</button>
                    </div>
                    <p class="cart-drawer-shipping-feedback" id="cartDrawerShippingFeedback" hidden></p>
                    <div class="cart-drawer-shipping-options" id="cartDrawerShippingOptions" hidden></div>
                </section>
                <div class="cart-drawer-summary">
                    <span>Subtotal</span>
                    <strong id="cartDrawerSubtotal">R$ 0,00</strong>
                </div>
                <div class="cart-drawer-summary cart-drawer-summary-secondary">
                    <span>Frete estimado</span>
                    <strong id="cartDrawerShippingTotal">Calcule</strong>
                </div>
                <div class="cart-drawer-summary cart-drawer-summary-total">
                    <span>Total estimado</span>
                    <strong id="cartDrawerGrandTotal">R$ 0,00</strong>
                </div>
                <div class="cart-drawer-buttons">
                    <button type="button" class="cart-drawer-checkout" id="cartDrawerCheckout">Fazer pedido</button>
                    <button type="button" class="cart-drawer-clear" id="cartDrawerClear">Limpar carrinho</button>
                </div>
            </div>
        </aside>
    `;

    document.body.insertAdjacentHTML("beforeend", drawerMarkup);

    const drawer = document.getElementById("cartDrawer");
    const backdrop = document.getElementById("cartDrawerBackdrop");
    const closeButton = document.getElementById("cartDrawerClose");
    const itemsContainer = document.getElementById("cartDrawerItems");
    const emptyState = document.getElementById("cartDrawerEmpty");
    const subtotalElement = document.getElementById("cartDrawerSubtotal");
    const shippingTotalElement = document.getElementById("cartDrawerShippingTotal");
    const grandTotalElement = document.getElementById("cartDrawerGrandTotal");
    const countLabel = document.getElementById("cartDrawerCountLabel");
    const clearButton = document.getElementById("cartDrawerClear");
    const checkoutButton = document.getElementById("cartDrawerCheckout");
    const shippingBlock = document.getElementById("cartDrawerShippingBlock");
    const shippingInput = document.getElementById("cartDrawerZipCode");
    const shippingButton = document.getElementById("cartDrawerShippingButton");
    const shippingFeedback = document.getElementById("cartDrawerShippingFeedback");
    const shippingOptionsElement = document.getElementById("cartDrawerShippingOptions");

    let shippingRequestInFlight = false;
    let availableShippingOptions = [];
    let selectedShippingOption = null;
    let lastQuotedZipCode = "";
    let lastQuotedCartSignature = "";

    async function hydrateCartDrawerPersonalizationThumbs() {
        const previewNodes = Array.from(itemsContainer.querySelectorAll("[data-personalization-storage-key]"));

        if (!previewNodes.length) {
            return;
        }

        await Promise.all(previewNodes.map(async (node) => {
            const storageKey = String(node.getAttribute("data-personalization-storage-key") || "").trim();

            if (!storageKey) {
                return;
            }

            try {
                const file = await getStoredPersonalizationImageFile(storageKey);

                if (!file) {
                    return;
                }

                const objectUrl = URL.createObjectURL(file);
                personalizationPreviewObjectUrls.set(storageKey, objectUrl);
                node.hidden = false;
                node.innerHTML = `<img src="${escapeHtml(objectUrl)}" alt="Imagem da personalizacao">`;
            } catch (_error) {
                // Se a imagem temporaria nao existir mais, mantemos apenas o texto do item.
            }
        }));
    }

    function openDrawer() {
        drawer.classList.add("is-open");
        backdrop.classList.add("is-open");
        drawer.setAttribute("aria-hidden", "false");
        document.body.classList.add("cart-drawer-open");
    }

    function closeDrawer() {
        drawer.classList.remove("is-open");
        backdrop.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");
        document.body.classList.remove("cart-drawer-open");
    }

    function setShippingButtonLoading(isLoading) {
        shippingRequestInFlight = isLoading;

        if (window.siteUi?.setButtonLoading) {
            window.siteUi.setButtonLoading(shippingButton, isLoading, {
                loadingText: "Calculando..."
            });
            return;
        }

        shippingButton.disabled = isLoading;
        shippingButton.textContent = isLoading ? "Calculando..." : "Calcular frete";
    }

    function showShippingFeedback(message, type = "error") {
        if (!shippingFeedback) {
            return;
        }

        shippingFeedback.hidden = false;
        shippingFeedback.textContent = message;
        shippingFeedback.className = `cart-drawer-shipping-feedback ${type}`;
    }

    function clearShippingFeedback() {
        if (!shippingFeedback) {
            return;
        }

        shippingFeedback.hidden = true;
        shippingFeedback.textContent = "";
        shippingFeedback.className = "cart-drawer-shipping-feedback";
    }

    function resetShippingState({ preserveZip = true } = {}) {
        availableShippingOptions = [];
        selectedShippingOption = null;
        lastQuotedZipCode = preserveZip ? lastQuotedZipCode : "";
        lastQuotedCartSignature = "";
        clearShippingFeedback();
        renderShippingOptions();
    }

    function renderShippingOptions() {
        if (!shippingOptionsElement) {
            return;
        }

        if (!availableShippingOptions.length) {
            shippingOptionsElement.hidden = true;
            shippingOptionsElement.innerHTML = "";
            return;
        }

        shippingOptionsElement.hidden = false;
        shippingOptionsElement.innerHTML = availableShippingOptions.map((option) => {
            const optionId = String(option.serviceId || "");
            const isSelected = selectedShippingOption?.serviceId === optionId;

            return `
                <button type="button" class="cart-drawer-shipping-option ${isSelected ? "is-selected" : ""}" data-shipping-option-id="${escapeHtml(optionId)}">
                    <div>
                        <strong>${escapeHtml(option.company || "Correios")} - ${escapeHtml(option.name || "Frete")}</strong>
                        <span>${escapeHtml(String(option.deliveryTime || 0))} dia(s) úteis</span>
                    </div>
                    <strong>${escapeHtml(formatCurrency(option.price || 0))}</strong>
                </button>
            `;
        }).join("");
        shippingOptionsElement.querySelectorAll("[data-shipping-option-id]").forEach((buttonElement, index) => {
            const labelElement = buttonElement.querySelector("span");

            if (!labelElement) {
                return;
            }

            labelElement.textContent = formatShippingDeadlineLabel(availableShippingOptions[index] || {});
        });
    }

    function renderCartDrawer() {
        const items = getStoredCartItems();
        const totalItems = getCartTotalItems(items);
        const subtotal = getCartSubtotal(items);
        const shippingValue = Number(selectedShippingOption?.price || 0);
        const grandTotal = subtotal + shippingValue;
        const currentCartSignature = getCartSignature(items);

        if (lastQuotedCartSignature && currentCartSignature !== lastQuotedCartSignature) {
            resetShippingState();
        }

        countLabel.textContent = `${totalItems} item(ns)`;
        subtotalElement.textContent = formatCurrency(subtotal);
        shippingTotalElement.textContent = selectedShippingOption ? formatCurrency(shippingValue) : "Calcule";
        grandTotalElement.textContent = formatCurrency(grandTotal);
        updateCartCount();

        if (shippingBlock) {
            shippingBlock.hidden = !items.length;
        }

        if (!items.length) {
            revokePersonalizationPreviewUrls();
            itemsContainer.innerHTML = "";
            emptyState.hidden = false;
            checkoutButton.disabled = true;
            clearButton.disabled = true;
            shippingTotalElement.textContent = "Calcule";
            grandTotalElement.textContent = formatCurrency(0);
            renderShippingOptions();
            return;
        }

        emptyState.hidden = true;
        checkoutButton.disabled = false;
        clearButton.disabled = false;
        revokePersonalizationPreviewUrls();

        itemsContainer.innerHTML = items.map((item) => {
            const productUrl = `/produto/${encodeURIComponent(item.slug || "")}`;
            const imageUrl = escapeHtml(item.imageUrl || "/img/tabua-produto01.webp");
            const name = escapeHtml(item.name || "Produto");
            const cartKey = escapeHtml(item.cartKey || item.slug || "");
            const personalizationName = escapeHtml(item.personalizationName || "");
            const personalizationImageKind = escapeHtml(item.personalizationImageKind || "");

            return `
                <article class="cart-drawer-item" data-cart-key="${cartKey}">
                    <a href="${productUrl}">
                        <img class="cart-drawer-item-image" src="${imageUrl}" alt="${name}">
                    </a>
                    <div>
                        <a href="${productUrl}">
                            <h3 class="cart-drawer-item-name">${name}</h3>
                        </a>
                        ${renderSelectedVariations(item)}
                        ${personalizationName ? `<p class="cart-drawer-item-detail">Gravação: ${personalizationName}</p>` : ""}
                        ${renderPersonalizationImagePreview(item)}
                        ${personalizationImageKind ? `<p class="cart-drawer-item-detail">Imagem aplicada: ${personalizationImageKind === "upload" ? "enviada pelo cliente" : "selecionada"}</p>` : ""}
                        <p class="cart-drawer-item-price">${formatCurrency(item.price)}</p>
                        <div class="cart-drawer-item-actions">
                            <div class="cart-drawer-qty">
                                <button type="button" data-cart-action="decrease" data-cart-key="${cartKey}">-</button>
                                <span>${Number(item.quantity || 0)}</span>
                                <button type="button" data-cart-action="increase" data-cart-key="${cartKey}">+</button>
                            </div>
                            <button type="button" class="cart-drawer-remove" data-cart-action="remove" data-cart-key="${cartKey}">Remover</button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
        void hydrateCartDrawerPersonalizationThumbs();
    }

    async function calculateCartShipping() {
        const items = getStoredCartItems();

        if (!items.length || shippingRequestInFlight) {
            return;
        }

        const zipCode = normalizeZipCode(shippingInput?.value || "");

        if (zipCode.length !== 8) {
            showShippingFeedback("Digite um CEP válido com 8 números.", "error");
            return;
        }

        setStoredShippingZipCode(zipCode);
        setShippingButtonLoading(true);
        clearShippingFeedback();

        try {
            const response = await fetch("/api/shipping/checkout-quote", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    zipCode,
                    items
                })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível calcular o frete do carrinho.");
            }

            availableShippingOptions = Array.isArray(result.options) ? result.options : [];
            selectedShippingOption = availableShippingOptions[0] || null;
            lastQuotedZipCode = zipCode;
            lastQuotedCartSignature = getCartSignature(items);
            renderShippingOptions();
            renderCartDrawer();

            if (!availableShippingOptions.length) {
                showShippingFeedback("Nenhuma opção de frete foi encontrada para este CEP.", "error");
                return;
            }

            showShippingFeedback("Frete calculado para todos os itens do carrinho.", "success");
        } catch (error) {
            resetShippingState();
            showShippingFeedback(error.message || "Não foi possível calcular o frete do carrinho.", "error");
            renderCartDrawer();
        } finally {
            setShippingButtonLoading(false);
        }
    }

    function updateItemQuantity(cartKey, delta) {
        const items = getStoredCartItems();
        const item = items.find((entry) => String(entry.cartKey || entry.slug) === cartKey);

        if (!item) {
            return;
        }

        item.quantity = Math.max(1, Number(item.quantity || 0) + delta);
        setStoredCartItems(items);
    }

    function removeItem(cartKey) {
        const items = getStoredCartItems().filter((entry) => String(entry.cartKey || entry.slug) !== cartKey);
        setStoredCartItems(items);
    }

    function clearCart() {
        setStoredCartItems([]);
    }

    function goToCheckout() {
        const items = getStoredCartItems();

        if (!items.length) {
            return;
        }

        const zipCode = normalizeZipCode(shippingInput?.value || "");

        if (zipCode) {
            setStoredShippingZipCode(zipCode);
        }

        window.location.href = "/checkout";
    }

    if (shippingInput) {
        shippingInput.value = applyZipCodeMask(getStoredShippingZipCode());

        shippingInput.addEventListener("input", (event) => {
            event.target.value = applyZipCodeMask(event.target.value);
            const normalizedZipCode = normalizeZipCode(event.target.value);

            setStoredShippingZipCode(normalizedZipCode);

            if (normalizedZipCode !== lastQuotedZipCode) {
                resetShippingState();
                renderCartDrawer();
            }
        });

        shippingInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                calculateCartShipping();
            }
        });
    }

    if (shippingButton) {
        shippingButton.addEventListener("click", calculateCartShipping);
    }

    cartTriggers.forEach((trigger) => {
        trigger.addEventListener("click", (event) => {
            event.preventDefault();
            renderCartDrawer();
            openDrawer();
        });
    });

    closeButton.addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);

    itemsContainer.addEventListener("click", (event) => {
        const actionButton = event.target.closest("[data-cart-action]");

        if (!actionButton) {
            return;
        }

        const cartKey = String(actionButton.dataset.cartKey || "");
        const action = actionButton.dataset.cartAction;

        if (!cartKey) {
            return;
        }

        if (action === "increase") {
            updateItemQuantity(cartKey, 1);
        }

        if (action === "decrease") {
            updateItemQuantity(cartKey, -1);
        }

        if (action === "remove") {
            removeItem(cartKey);
        }
    });

    if (shippingOptionsElement) {
        shippingOptionsElement.addEventListener("click", (event) => {
            const optionButton = event.target.closest("[data-shipping-option-id]");

            if (!optionButton) {
                return;
            }

            const selectedId = String(optionButton.dataset.shippingOptionId || "");

            selectedShippingOption = availableShippingOptions.find((option) => String(option.serviceId) === selectedId) || null;
            renderShippingOptions();
            renderCartDrawer();
        });
    }

    clearButton.addEventListener("click", clearCart);
    checkoutButton.addEventListener("click", goToCheckout);

    window.addEventListener("cart:updated", renderCartDrawer);
    window.addEventListener("storage", () => {
        if (shippingInput) {
            shippingInput.value = applyZipCodeMask(getStoredShippingZipCode());
        }

        renderCartDrawer();
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeDrawer();
        }
    });

    renderCartDrawer();
})();
