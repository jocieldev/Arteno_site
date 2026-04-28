const alertBox = document.getElementById("adminAuthAlert");
const passwordInput = document.getElementById("adminPasswordInput");
const passwordToggle = document.getElementById("adminPasswordToggle");
const adminAuthForm = document.querySelector(".admin-auth-form");
const adminAuthSubmitButton = adminAuthForm?.querySelector('button[type="submit"]');

const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const adminSidebarLinks = document.querySelectorAll(".admin-sidebar-link, .admin-sidebar-secondary");

const productForm = document.getElementById("productForm");
const tableBody = document.getElementById("adminProductsTableBody");
const feedbackBox = document.getElementById("adminFeedback");
const emptyState = document.getElementById("adminEmptyState");
const tableWrap = document.getElementById("adminTableWrap");
const formTitle = document.getElementById("productFormTitle");
const cancelEditButton = document.getElementById("cancelEditButton");
const submitButton = document.getElementById("productSubmitButton");
const openCreateProductButton = document.getElementById("openCreateProductButton");
const adminEditorPage = document.getElementById("adminEditorPage");
const editorStatusBadge = document.getElementById("editorStatusBadge");
const productImageHelp = document.getElementById("productImageHelp");
const productImageInput = document.getElementById("productImageInput");
const productMediaPreview = document.getElementById("productMediaPreview");
const descriptionEditor = document.getElementById("descriptionEditor");
const descriptionInput = document.getElementById("descriptionInput");
const descriptionToolbar = document.getElementById("descriptionToolbar");
const descriptionBlockType = document.getElementById("descriptionBlockType");
const descriptionTextColor = document.getElementById("descriptionTextColor");
const productStockMode = document.getElementById("productStockMode");
const productStockQuantityField = document.getElementById("productStockQuantityField");
const productStockQuantityInput = document.getElementById("productStockQuantityInput");
const productVariationsList = document.getElementById("productVariationsList");
const addProductVariationButton = document.getElementById("addProductVariationButton");
const productStatusInput = document.getElementById("productStatusInput");
const productStatusDropdown = document.getElementById("productStatusDropdown");
const productStatusTrigger = document.getElementById("productStatusTrigger");
const productStatusTriggerLabel = document.getElementById("productStatusTriggerLabel");
const productStatusHintList = document.getElementById("productStatusHintList");
const adminProductTabs = document.querySelectorAll(".admin-products-tab[data-filter]");
const productCategorySelect = document.getElementById("productCategorySelect");
const personalizationPreviewEnabledInput = document.getElementById("personalizationPreviewEnabled");
const personalizationPreviewFields = document.getElementById("personalizationPreviewFields");
const personalizationPreviewNameInput = document.getElementById("personalizationPreviewName");
const personalizationPreviewItems = document.getElementById("personalizationPreviewItems");
const addPersonalizationPreviewButton = document.getElementById("addPersonalizationPreviewButton");
const removePersonalizationPreviewButton = document.getElementById("removePersonalizationPreviewButton");
const adminImageOverlayFields = document.getElementById("adminImageOverlayFields");
const adminOverlayOptionImagesField = document.getElementById("adminOverlayOptionImagesField");
const adminPersonalizationPreviewImage = document.getElementById("adminPersonalizationPreviewImage");
const adminPersonalizationOverlayImage = document.getElementById("adminPersonalizationOverlayImage");
const adminPersonalizationPreviewText = document.getElementById("adminPersonalizationPreviewText");
const productPreviewImageInput = document.getElementById("productPreviewImageInput");
const productPreviewImageHelp = document.getElementById("productPreviewImageHelp");
const adminPreviewImageCard = document.getElementById("adminPreviewImageCard");
const adminPreviewImageCardImage = document.getElementById("adminPreviewImageCardImage");
const productOverlayOptionImagesInput = document.getElementById("productOverlayOptionImagesInput");
const productOverlayOptionImagesHelp = document.getElementById("productOverlayOptionImagesHelp");
const adminOverlayOptionsGrid = document.getElementById("adminOverlayOptionsGrid");

let productsState = [];
let categoriesState = [];
let editingProductId = null;
let activeFilter = "all";
let selectedProductImageFiles = [];
let existingProductImages = [];
let selectedPreviewImageFile = null;
let existingPreviewImage = null;
let personalizationPreviewItemsState = [];
let activeAdminPersonalizationPreviewIndex = 0;
let selectedOverlayOptionImageFiles = [];
let existingOverlayOptionImages = [];
let productVariationsState = [];
let variationItemUploadFiles = new Map();
let variationItemUploadPreviewUrls = new Map();
let variationItemPreviewFiles = new Map();
let variationItemPreviewPreviewUrls = new Map();
let originalProductSnapshot = null;
let productSaveRequestInFlight = false;
let productDeleteRequestInFlight = false;
let adminLoginRequestInFlight = false;

function setButtonLoading(button, isLoading, loadingText) {
    if (!(button instanceof HTMLElement)) {
        return;
    }

    if (isLoading) {
        if (!button.dataset.originalHtml) {
            button.dataset.originalHtml = button.innerHTML;
        }

        if (!button.dataset.originalDisabled) {
            button.dataset.originalDisabled = button.disabled ? "true" : "false";
        }

        button.classList.add("site-button-loading");
        button.disabled = true;
        button.innerHTML = `
            <span class="site-button-spinner" aria-hidden="true"></span>
            <span class="site-button-loading-label">${loadingText}</span>
        `;
        return;
    }

    button.classList.remove("site-button-loading");
    button.disabled = button.dataset.originalDisabled === "true";

    if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
    }

    delete button.dataset.originalDisabled;
}

function getStatusMeta(statusValue = "active") {
    switch (statusValue) {
        case "draft":
            return { value: "draft", label: "Rascunho", pillClass: "inactive" };
        case "unlisted":
            return { value: "unlisted", label: "Não listado", pillClass: "unlisted" };
        default:
            return { value: "active", label: "Ativo", pillClass: "" };
    }
}

function getAdminRouteState(pathname = window.location.pathname) {
    const newProductRoute = /^\/admin\/products\/new\/?$/;
    const editProductRoute = /^\/admin\/products\/([^/]+)\/edit\/?$/;

    if (newProductRoute.test(pathname)) {
        return { page: "create", productId: null };
    }

    const editMatch = pathname.match(editProductRoute);

    if (editMatch) {
        return { page: "edit", productId: decodeURIComponent(editMatch[1]) };
    }

    return { page: "list", productId: null };
}

function navigateAdmin(pathname, { replace = false } = {}) {
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({}, "", pathname);
    renderAdminRoute();
}

function openAdminSidebar() {
    document.body.classList.add("sidebar-open");
}

function closeAdminSidebar() {
    document.body.classList.remove("sidebar-open");
}

function openProductEditor() {
    document.body.classList.add("editor-open");
    adminEditorPage?.removeAttribute("hidden");
    adminEditorPage?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeProductEditor() {
    document.body.classList.remove("editor-open");
    adminEditorPage?.setAttribute("hidden", "");
}

function renderAdminRoute() {
    const routeState = getAdminRouteState();

    if (routeState.page === "create") {
        clearFeedback();
        resetProductForm();
        openProductEditor();
        return;
    }

    if (routeState.page === "edit") {
        const selectedProduct = productsState.find((product) => product._id === routeState.productId);

        if (!selectedProduct) {
            closeProductEditor();
            return;
        }

        clearFeedback();
        populateProductForm(selectedProduct);
        openProductEditor();
        return;
    }

    clearFeedback();
    resetProductForm();
    closeProductEditor();
}

if (alertBox) {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error");

    if (errorCode === "invalid") {
        alertBox.textContent = "Usuario ou senha invalidos. Tente novamente.";
        alertBox.hidden = false;
    }

    if (errorCode === "config") {
        alertBox.textContent = "Painel admin nao configurado. Atualize ADMIN_USERNAME, ADMIN_PASSWORD e ADMIN_SESSION_SECRET no backend/.env.";
        alertBox.hidden = false;
    }
}

if (passwordInput && passwordToggle) {
    passwordToggle.addEventListener("click", () => {
        const isPasswordHidden = passwordInput.type === "password";

        passwordInput.type = isPasswordHidden ? "text" : "password";
        passwordToggle.classList.toggle("is-visible", isPasswordHidden);
        passwordToggle.setAttribute("aria-pressed", String(isPasswordHidden));
        passwordToggle.setAttribute("aria-label", isPasswordHidden ? "Ocultar senha" : "Mostrar senha");
    });
}

if (adminAuthForm && adminAuthSubmitButton) {
    adminAuthForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (adminLoginRequestInFlight) {
            return;
        }

        adminLoginRequestInFlight = true;
        setButtonLoading(adminAuthSubmitButton, true, "Entrando...");

        if (alertBox) {
            alertBox.hidden = true;
            alertBox.textContent = "";
        }

        try {
            const formData = new FormData(adminAuthForm);
            const payload = {
                username: String(formData.get("username") || "").trim(),
                password: String(formData.get("password") || "")
            };
            const response = await fetch("/api/admin/session/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.message || "Nao foi possivel entrar no painel.");
            }

            window.location.href = "/admin";
        } catch (error) {
            if (alertBox) {
                alertBox.textContent = error.message || "Nao foi possivel entrar no painel.";
                alertBox.hidden = false;
            }

            adminLoginRequestInFlight = false;
            setButtonLoading(adminAuthSubmitButton, false, "Entrando...");
        }
    });
}

window.addEventListener("popstate", renderAdminRoute);
window.addEventListener("resize", () => {
    updateAdminPersonalizationPreview();
});

if (adminMobileMenuButton) {
    adminMobileMenuButton.addEventListener("click", openAdminSidebar);
}

if (adminSidebarClose) {
    adminSidebarClose.addEventListener("click", closeAdminSidebar);
}

if (adminMobileOverlay) {
    adminMobileOverlay.addEventListener("click", closeAdminSidebar);
}

adminSidebarLinks.forEach((link) => {
    link.addEventListener("click", closeAdminSidebar);
});

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

function showFeedback(message, type = "success") {
    if (!feedbackBox) {
        return;
    }

    feedbackBox.textContent = message;
    feedbackBox.className = `admin-feedback admin-products-feedback ${type}`;
    feedbackBox.hidden = false;
}

function clearFeedback() {
    if (!feedbackBox) {
        return;
    }

    feedbackBox.hidden = true;
    feedbackBox.textContent = "";
    feedbackBox.className = "admin-feedback admin-products-feedback";
}

function updateStockQuantityFieldVisibility() {
    if (!productStockMode || !productStockQuantityField || !productStockQuantityInput) {
        return;
    }

    const isLimitedStock = productStockMode.value === "limited";

    productStockQuantityField.hidden = !isLimitedStock;
    productStockQuantityInput.disabled = !isLimitedStock;
    productStockQuantityInput.required = isLimitedStock;

    if (!isLimitedStock) {
        productStockQuantityInput.value = "";
    }
}

function normalizeVariationInput(variation = {}) {
    const stockMode = variation.stockMode === "limited" || variation.stock?.mode === "limited"
        ? "limited"
        : "unlimited";
    const stockQuantity = stockMode === "limited"
        ? String(variation.stockQuantity ?? variation.stock?.quantity ?? 0)
        : "";

    return {
        name: String(variation.name || "").trim(),
        sku: String(variation.sku || "").trim(),
        price: variation.price === null || variation.price === undefined ? "" : String(variation.price),
        compareAtPrice: variation.compareAtPrice === null || variation.compareAtPrice === undefined ? "" : String(variation.compareAtPrice),
        stockMode,
        stockQuantity
    };
}

function getVariationRowMarkup(variation = {}, index = 0) {
    const normalizedVariation = normalizeVariationInput(variation);
    const quantityFieldHidden = normalizedVariation.stockMode !== "limited" ? "hidden" : "";

    return `
        <div class="admin-variation-row" data-variation-index="${index}">
            <div class="admin-variation-row-top">
                <strong>Variação ${index + 1}</strong>
                <button type="button" class="admin-variation-remove" data-remove-variation="${index}">Remover</button>
            </div>

            <div class="admin-form-grid admin-variation-grid">
                <label class="admin-auth-field">
                    <span>Nome da variação</span>
                    <input type="text" data-variation-field="name" value="${escapeHtml(normalizedVariation.name)}" placeholder="Ex: Azul / Tamanho G">
                </label>

                <label class="admin-auth-field">
                    <span>SKU</span>
                    <input type="text" data-variation-field="sku" value="${escapeHtml(normalizedVariation.sku)}" placeholder="Ex: AZUL-G">
                </label>

                <label class="admin-auth-field">
                    <span>Preço</span>
                    <input type="number" min="0" step="0.01" data-variation-field="price" value="${escapeHtml(normalizedVariation.price)}" placeholder="Opcional">
                </label>

                <label class="admin-auth-field">
                    <span>Preço anterior</span>
                    <input type="number" min="0" step="0.01" data-variation-field="compareAtPrice" value="${escapeHtml(normalizedVariation.compareAtPrice)}" placeholder="Opcional">
                </label>

                <label class="admin-auth-field">
                    <span>Estoque</span>
                    <select data-variation-field="stockMode">
                        <option value="unlimited" ${normalizedVariation.stockMode === "unlimited" ? "selected" : ""}>Ilimitado</option>
                        <option value="limited" ${normalizedVariation.stockMode === "limited" ? "selected" : ""}>Controlado</option>
                    </select>
                </label>

                <label class="admin-auth-field" data-variation-quantity-wrap ${quantityFieldHidden}>
                    <span>Quantidade</span>
                    <input type="number" min="0" step="1" data-variation-field="stockQuantity" value="${escapeHtml(normalizedVariation.stockQuantity)}" placeholder="Ex: 12">
                </label>
            </div>
        </div>
    `;
}

function renderProductVariations(variations = []) {
    if (!productVariationsList) {
        return;
    }

    if (!variations.length) {
        productVariationsList.innerHTML = `
            <div class="admin-variation-empty">
                Nenhuma variação cadastrada para este produto.
            </div>
        `;
        return;
    }

    productVariationsList.innerHTML = variations.map((variation, index) => getVariationRowMarkup(variation, index)).join("");
}

function readProductVariations({ includeEmpty = false } = {}) {
    if (!productVariationsList) {
        return [];
    }

    return Array.from(productVariationsList.querySelectorAll("[data-variation-index]"))
        .map((row) => {
            const readValue = (field) => String(row.querySelector(`[data-variation-field="${field}"]`)?.value || "").trim();
            const name = readValue("name");

            if (!name && !includeEmpty) {
                return null;
            }

            const stockMode = readValue("stockMode") === "limited" ? "limited" : "unlimited";

            return {
                name,
                sku: readValue("sku"),
                price: readValue("price"),
                compareAtPrice: readValue("compareAtPrice"),
                stockMode,
                stockQuantity: stockMode === "limited" ? readValue("stockQuantity") : ""
            };
        })
        .filter((variation) => includeEmpty ? variation !== null : Boolean(variation));
}

function syncVariationQuantityField(row) {
    if (!(row instanceof HTMLElement)) {
        return;
    }

    const stockModeField = row.querySelector('[data-variation-field="stockMode"]');
    const quantityWrap = row.querySelector("[data-variation-quantity-wrap]");
    const quantityInput = row.querySelector('[data-variation-field="stockQuantity"]');
    const isLimited = stockModeField?.value === "limited";

    if (quantityWrap) {
        quantityWrap.hidden = !isLimited;
    }

    if (quantityInput) {
        quantityInput.disabled = !isLimited;

        if (!isLimited) {
            quantityInput.value = "";
        }
    }
}

function createVariationClientId(prefix = "variation") {
    if (window.crypto?.randomUUID) {
        return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeVariationColorHex(value, fallback = "#d1d5db") {
    const normalized = String(value || "").trim();

    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
        return normalized.length === 4
            ? `#${normalized.slice(1).split("").map((character) => `${character}${character}`).join("")}`.toLowerCase()
            : normalized.toLowerCase();
    }

    return fallback;
}

function clearVariationUploadState() {
    variationItemUploadPreviewUrls.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl);
    });
    variationItemPreviewPreviewUrls.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl);
    });

    variationItemUploadFiles = new Map();
    variationItemUploadPreviewUrls = new Map();
    variationItemPreviewFiles = new Map();
    variationItemPreviewPreviewUrls = new Map();
}

function normalizeVariationItemInput(item = {}, type = "custom") {
    return {
        id: String(item.id || createVariationClientId("variation-item")).trim(),
        label: String(item.label || item.name || "").trim(),
        colorHex: type === "color" ? normalizeVariationColorHex(item.colorHex || item.color) : "",
        price: item.price === null || item.price === undefined ? "" : String(item.price),
        imageUrl: type === "custom" ? String(item.imageUrl || "").trim() : "",
        imagePublicId: type === "custom" ? String(item.imagePublicId || "").trim() : "",
        previewImageUrl: String(item.previewImageUrl || "").trim(),
        previewImagePublicId: String(item.previewImagePublicId || "").trim()
    };
}

function normalizeVariationInput(variation = {}) {
    const type = variation.type === "color" ? "color" : "custom";
    const items = Array.isArray(variation.items) && variation.items.length
        ? variation.items.map((item) => normalizeVariationItemInput(item, type))
        : [normalizeVariationItemInput({}, type)];

    return {
        id: String(variation.id || createVariationClientId("variation")).trim(),
        type,
        name: type === "color" ? "Cor" : String(variation.name || "").trim(),
        items
    };
}

function getVariationItemPreviewMarkup(type, item = {}) {
    const previewUrl = variationItemUploadPreviewUrls.get(item.id) || item.imageUrl || "";

    if (type === "color") {
        return `<span class="admin-variation-item-preview-color" style="background:${escapeHtml(item.colorHex || "#d1d5db")}"></span>`;
    }

    if (previewUrl) {
        return `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(item.label || "Imagem do item")}">`;
    }

    return `<span class="admin-variation-item-preview-fallback">${escapeHtml(item.label || "Sem foto")}</span>`;
}

function getVariationItemProductPreviewMarkup(item = {}) {
    const previewUrl = variationItemPreviewPreviewUrls.get(item.id) || item.previewImageUrl || "";

    if (previewUrl) {
        return `<img src="${escapeHtml(previewUrl)}" alt="Prévia do produto para ${escapeHtml(item.label || "item")}">`;
    }

    return `<span class="admin-variation-item-preview-fallback">Usa a imagem padrão</span>`;
}

function getVariationItemRowMarkup(variation, item, variationIndex, itemIndex) {
    const imageInputId = `variation-item-image-${item.id}`;

    return `
        <div
            class="admin-variation-item-row"
            data-variation-item-index="${itemIndex}"
            data-variation-item-id="${escapeHtml(item.id)}"
            data-variation-item-image-url="${escapeHtml(item.imageUrl || "")}"
            data-variation-item-image-public-id="${escapeHtml(item.imagePublicId || "")}"
            data-variation-item-preview-image-url="${escapeHtml(item.previewImageUrl || "")}"
            data-variation-item-preview-image-public-id="${escapeHtml(item.previewImagePublicId || "")}"
        >
            <div class="admin-variation-item-main">
                <div class="admin-variation-item-preview" data-variation-item-preview="true">
                    ${getVariationItemPreviewMarkup(variation.type, item)}
                </div>
                <div class="admin-variation-item-fields">
                    <label class="admin-auth-field">
                        <span>Nome do item</span>
                        <input type="text" data-variation-item-field="label" value="${escapeHtml(item.label)}" placeholder="${variation.type === "color" ? "Ex: Azul petróleo" : "Ex: Tamanho M"}">
                    </label>
                    <label class="admin-auth-field">
                        <span>Preço do item</span>
                        <input type="number" min="0" step="0.01" data-variation-item-field="price" value="${escapeHtml(item.price || "")}" placeholder="Ex: 89.90">
                        <small class="admin-field-help">Opcional. Se preencher, este item usará esse preço final.</small>
                    </label>
                    ${variation.type === "color" ? `
                        <label class="admin-auth-field">
                            <span>Cor</span>
                            <input type="color" data-variation-item-field="colorHex" value="${escapeHtml(item.colorHex || "#d1d5db")}">
                        </label>
                    ` : `
                        <div class="admin-variation-item-image-tools">
                            <input type="file" id="${escapeHtml(imageInputId)}" data-variation-item-image-input="${escapeHtml(item.id)}" accept="image/*" hidden>
                            <label class="admin-secondary-button" for="${escapeHtml(imageInputId)}">Escolher imagem</label>
                            <button type="button" class="admin-variation-item-remove-image" data-remove-variation-item-image="${variationIndex}:${itemIndex}" ${item.imageUrl || variationItemUploadFiles.has(item.id) ? "" : "hidden"}>Remover imagem</button>
                        </div>
                    `}
                    <div class="admin-variation-item-product-preview-block">
                        <span class="admin-field-help">Imagem para trocar a prévia do produto quando este item for selecionado.</span>
                        <div class="admin-variation-item-image-tools">
                            <div class="admin-variation-item-preview admin-variation-item-preview-secondary">
                                ${getVariationItemProductPreviewMarkup(item)}
                            </div>
                            <div class="admin-variation-item-image-actions">
                                <input type="file" id="${escapeHtml(`${imageInputId}-preview`)}" data-variation-item-preview-input="${escapeHtml(item.id)}" accept="image/*" hidden>
                                <label class="admin-secondary-button" for="${escapeHtml(`${imageInputId}-preview`)}">Escolher imagem da prévia</label>
                                <button type="button" class="admin-variation-item-remove-image" data-remove-variation-item-preview-image="${variationIndex}:${itemIndex}" ${item.previewImageUrl || variationItemPreviewFiles.has(item.id) ? "" : "hidden"}>Remover imagem da prévia</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <button type="button" class="admin-variation-item-remove" data-remove-variation-item="${variationIndex}:${itemIndex}">Remover item</button>
        </div>
    `;
}

function getVariationRowMarkup(variation = {}, index = 0) {
    const normalizedVariation = normalizeVariationInput(variation);
    const shouldHideNameField = normalizedVariation.type === "color";

    return `
        <div class="admin-variation-row" data-variation-index="${index}" data-variation-id="${escapeHtml(normalizedVariation.id)}">
            <div class="admin-variation-row-top">
                <strong>${normalizedVariation.type === "color" ? "Variação de cor" : "Variação personalizável"} ${index + 1}</strong>
                <button type="button" class="admin-variation-remove" data-remove-variation="${index}">Remover</button>
            </div>

            <div class="admin-form-grid admin-variation-grid">
                <label class="admin-auth-field">
                    <span>Tipo de variação</span>
                    <select data-variation-field="type">
                        <option value="color" ${normalizedVariation.type === "color" ? "selected" : ""}>Cor</option>
                        <option value="custom" ${normalizedVariation.type === "custom" ? "selected" : ""}>Personalizável</option>
                    </select>
                </label>

                <label class="admin-auth-field" data-variation-name-wrap ${shouldHideNameField ? "hidden" : ""}>
                    <span>Nome do campo</span>
                    <input type="text" data-variation-field="name" value="${escapeHtml(normalizedVariation.name)}" placeholder="Ex: Tamanhos">
                </label>
            </div>

            <div class="admin-variation-items">
                <div class="admin-variation-items-header">
                    <strong>Itens da variação</strong>
                    <span>${normalizedVariation.type === "color" ? "Cadastre as cores que aparecerão no site." : "Cadastre os itens. Se não enviar foto, o nome aparecerá dentro do quadrado."}</span>
                </div>
                <div class="admin-variation-item-stack">
                    ${normalizedVariation.items.map((item, itemIndex) => getVariationItemRowMarkup(normalizedVariation, item, index, itemIndex)).join("")}
                </div>
                <button type="button" class="admin-secondary-button" data-add-variation-item="${index}">Adicionar item</button>
            </div>
        </div>
    `;
}

function renderProductVariations(variations = []) {
    if (!productVariationsList) {
        return;
    }

    if (!variations.length) {
        productVariationsList.innerHTML = `
            <div class="admin-variation-empty">
                Nenhuma variação cadastrada para este produto.
            </div>
        `;
        return;
    }

    productVariationsList.innerHTML = variations.map((variation, index) => getVariationRowMarkup(variation, index)).join("");
}

function readProductVariations({ includeEmpty = false } = {}) {
    if (!productVariationsList) {
        return [];
    }

    return Array.from(productVariationsList.querySelectorAll("[data-variation-index]"))
        .map((row) => {
            const readValue = (field) => String(row.querySelector(`[data-variation-field="${field}"]`)?.value || "").trim();
            const type = readValue("type") === "color" ? "color" : "custom";
            const name = type === "color" ? "Cor" : readValue("name");
            const items = Array.from(row.querySelectorAll("[data-variation-item-index]"))
                .map((itemRow) => {
                    const readItemValue = (field) => String(itemRow.querySelector(`[data-variation-item-field="${field}"]`)?.value || "").trim();
                    const label = readItemValue("label");

                    if (!label && !includeEmpty) {
                        return null;
                    }

                    return {
                        id: String(itemRow.dataset.variationItemId || createVariationClientId("variation-item")).trim(),
                        label,
                        colorHex: type === "color" ? normalizeVariationColorHex(readItemValue("colorHex")) : "",
                        price: readItemValue("price"),
                        imageUrl: type === "custom" ? String(itemRow.dataset.variationItemImageUrl || "").trim() : "",
                        imagePublicId: type === "custom" ? String(itemRow.dataset.variationItemImagePublicId || "").trim() : "",
                        previewImageUrl: String(itemRow.dataset.variationItemPreviewImageUrl || "").trim(),
                        previewImagePublicId: String(itemRow.dataset.variationItemPreviewImagePublicId || "").trim()
                    };
                })
                .filter((item) => includeEmpty ? item !== null : Boolean(item));

            if ((!name && type !== "color") || (!items.length && !includeEmpty)) {
                return null;
            }

            return {
                id: String(row.dataset.variationId || createVariationClientId("variation")).trim(),
                type,
                name,
                items
            };
        })
        .filter((variation) => includeEmpty ? variation !== null : Boolean(variation));
}

function syncVariationTypeFields(row) {
    if (!(row instanceof HTMLElement)) {
        return;
    }

    const type = String(row.querySelector('[data-variation-field="type"]')?.value || "custom");
    const nameWrap = row.querySelector("[data-variation-name-wrap]");
    const nameInput = row.querySelector('[data-variation-field="name"]');

    if (nameWrap) {
        nameWrap.hidden = type === "color";
    }

    if (nameInput && type === "color") {
        nameInput.value = "Cor";
    }
}

function getSelectedStatusValue() {
    return productStatusInput?.value || "active";
}

function setStatusDropdownOpen(isOpen) {
    if (!productStatusDropdown || !productStatusTrigger || !productStatusHintList) {
        return;
    }

    productStatusDropdown.classList.toggle("is-open", isOpen);
    productStatusTrigger.setAttribute("aria-expanded", String(isOpen));
    productStatusHintList.hidden = !isOpen;
}

function updateStatusHintSelection() {
    if (!productStatusHintList || !productStatusInput) {
        return;
    }

    const selectedValue = getSelectedStatusValue();
    const selectedMeta = getStatusMeta(selectedValue);

    if (productStatusTriggerLabel) {
        productStatusTriggerLabel.textContent = selectedMeta.label;
    }

    productStatusHintList.querySelectorAll("[data-status-option]").forEach((item) => {
        const isSelected = item.dataset.statusOption === selectedValue;
        item.classList.toggle("is-active", isSelected);
        item.setAttribute("aria-selected", String(isSelected));
    });
}

function getProductStockInfo(product) {
    const stockMode = product.stock?.mode === "limited" ? "limited" : "unlimited";
    const stockQuantity = stockMode === "limited" ? Number(product.stock?.quantity || 0) : null;

    return {
        mode: stockMode,
        quantity: stockQuantity
    };
}

function getProductImages(product) {
    if (Array.isArray(product?.images) && product.images.length) {
        return product.images.filter((image) => image?.imageUrl);
    }

    if (product?.imageUrl) {
        return [{ imageUrl: product.imageUrl }];
    }

    return [];
}

function getPublicProductUrl(product) {
    const slug = String(product?.slug || "").trim();

    if (!slug) {
        return "";
    }

    return `${window.location.origin}/produto/${encodeURIComponent(slug)}`;
}

function findMatchingCategoryId(product) {
    if (!product) {
        return "";
    }

    const directCategoryId = String(product.categoryId || "").trim();

    if (directCategoryId && categoriesState.some((category) => String(category._id) === directCategoryId)) {
        return directCategoryId;
    }

    const categorySlug = String(product.categorySlug || "").trim();
    const categoryName = String(product.category || "").trim().toLowerCase();

    const matchedCategory = categoriesState.find((category) => {
        return String(category.slug || "").trim() === categorySlug
            || String(category.name || "").trim().toLowerCase() === categoryName;
    });

    return matchedCategory ? String(matchedCategory._id) : "";
}

function renderCategoryOptions(selectedCategoryId = "") {
    if (!productCategorySelect) {
        return;
    }

    if (!categoriesState.length) {
        productCategorySelect.innerHTML = `
            <option value="">Nenhuma categoria cadastrada</option>
        `;
        productCategorySelect.disabled = true;
        return;
    }

    productCategorySelect.disabled = false;
    productCategorySelect.innerHTML = [
        '<option value="">Selecione uma categoria</option>',
        ...categoriesState.map((category) => `
            <option value="${escapeHtml(String(category._id || ""))}">
                ${escapeHtml(category.name || "")}
            </option>
        `)
    ].join("");

    productCategorySelect.value = selectedCategoryId || "";
}

function syncDescriptionInput() {
    if (!descriptionEditor || !descriptionInput) {
        return;
    }

    descriptionInput.value = descriptionEditor.innerHTML.trim();
}

function createDefaultPersonalizationPreviewItem(overrides = {}) {
    return {
        name: "Prévia",
        enabled: Boolean(productForm?.elements.personalizationPreviewEnabled?.checked),
        allowCustomerAdjust: false,
        showSampleTextInPreview: true,
        imageUrl: "",
        imagePublicId: "",
        sampleText: "Maria",
        positionXPercent: 50,
        positionYPercent: 50,
        widthPercent: 60,
        fontSizePx: 28,
        referenceWidthPx: 0,
        textColor: "#ffffff",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        fontWeight: "700",
        letterSpacingEm: 0.04,
        rotationDeg: 0,
        textTransform: "uppercase",
        textShadow: "0 2px 10px rgba(0, 0, 0, 0.35)",
        selectedFile: null,
        ...overrides
    };
}

function getNormalizedPersonalizationPreviewItems(product = {}) {
    const previews = Array.isArray(product.personalization?.previews) && product.personalization.previews.length
        ? product.personalization.previews
        : (product.personalization?.preview ? [product.personalization.preview] : []);

    if (!previews.length) {
        return [createDefaultPersonalizationPreviewItem()];
    }

    return previews.map((preview, index) => createDefaultPersonalizationPreviewItem({
        name: String(preview.name || preview.label || `Prévia ${index + 1}`).trim() || `Prévia ${index + 1}`,
        enabled: Boolean(preview.enabled),
        allowCustomerAdjust: Boolean(preview.allowCustomerAdjust),
        showSampleTextInPreview: preview.showSampleTextInPreview !== false,
        imageUrl: String(preview.imageUrl || ""),
        imagePublicId: String(preview.imagePublicId || ""),
        sampleText: String(preview.sampleText || "Maria"),
        positionXPercent: Number(preview.positionXPercent ?? 50),
        positionYPercent: Number(preview.positionYPercent ?? 50),
        widthPercent: Number(preview.widthPercent ?? 60),
        fontSizePx: Number(preview.fontSizePx ?? 28),
        referenceWidthPx: Number(preview.referenceWidthPx ?? 0),
        textColor: String(preview.textColor || "#ffffff"),
        fontFamily: String(preview.fontFamily || "'Georgia', 'Times New Roman', serif"),
        fontWeight: String(preview.fontWeight || "700"),
        letterSpacingEm: Number(preview.letterSpacingEm ?? 0.04),
        rotationDeg: Number(preview.rotationDeg ?? 0),
        textTransform: preview.textTransform === "none" ? "none" : "uppercase",
        textShadow: String(preview.textShadow || "0 2px 10px rgba(0, 0, 0, 0.35)")
    }));
}

function renderPersonalizationPreviewItemTabs() {
    if (!personalizationPreviewItems) {
        return;
    }

    personalizationPreviewItems.innerHTML = personalizationPreviewItemsState.map((item, index) => `
        <button
            type="button"
            class="admin-preview-item-button${index === activeAdminPersonalizationPreviewIndex ? " is-active" : ""}"
            data-preview-item-index="${index}"
        >${escapeHtml(item.name || `Prévia ${index + 1}`)}</button>
    `).join("");

    if (removePersonalizationPreviewButton) {
        removePersonalizationPreviewButton.disabled = personalizationPreviewItemsState.length <= 1;
    }
}

function getActivePersonalizationPreviewItem() {
    if (!personalizationPreviewItemsState.length) {
        personalizationPreviewItemsState = [createDefaultPersonalizationPreviewItem()];
    }

    if (activeAdminPersonalizationPreviewIndex < 0 || activeAdminPersonalizationPreviewIndex >= personalizationPreviewItemsState.length) {
        activeAdminPersonalizationPreviewIndex = 0;
    }

    return personalizationPreviewItemsState[activeAdminPersonalizationPreviewIndex];
}

function applyActivePreviewItemToForm() {
    if (!productForm) {
        return;
    }

    const item = getActivePersonalizationPreviewItem();
    selectedPreviewImageFile = item.selectedFile || null;
    existingPreviewImage = item.imageUrl
        ? { imageUrl: item.imageUrl, imagePublicId: item.imagePublicId || "" }
        : null;

    if (personalizationPreviewNameInput) {
        personalizationPreviewNameInput.value = item.name || "Prévia";
    }

    productForm.elements.personalizationPreviewAllowCustomerAdjust.checked = Boolean(item.allowCustomerAdjust);
    productForm.elements.personalizationPreviewShowSampleText.checked = item.showSampleTextInPreview !== false;
    productForm.elements.personalizationPreviewSampleText.value = item.sampleText || "Maria";
    productForm.elements.personalizationPreviewPositionXPercent.value = item.positionXPercent ?? 50;
    productForm.elements.personalizationPreviewPositionYPercent.value = item.positionYPercent ?? 50;
    productForm.elements.personalizationPreviewWidthPercent.value = item.widthPercent ?? 60;
    productForm.elements.personalizationPreviewFontSizePx.value = item.fontSizePx ?? 28;
    productForm.elements.personalizationPreviewReferenceWidthPx.value = item.referenceWidthPx ?? 0;
    productForm.elements.personalizationPreviewTextColor.value = item.textColor || "#ffffff";
    productForm.elements.personalizationPreviewFontFamily.value = item.fontFamily || "'Georgia', 'Times New Roman', serif";
    productForm.elements.personalizationPreviewFontWeight.value = item.fontWeight || "700";
    productForm.elements.personalizationPreviewLetterSpacingEm.value = item.letterSpacingEm ?? 0.04;
    productForm.elements.personalizationPreviewRotationDeg.value = item.rotationDeg ?? 0;
    productForm.elements.personalizationPreviewTextTransform.value = item.textTransform || "uppercase";
    productForm.elements.personalizationPreviewTextShadow.value = item.textShadow || "0 2px 10px rgba(0, 0, 0, 0.35)";

    if (productPreviewImageInput) {
        productPreviewImageInput.value = "";
    }

    renderPersonalizationPreviewItemTabs();
    renderPreviewImageUploadState();
}

function syncActivePreviewItemFromForm() {
    if (!productForm || !personalizationPreviewItemsState.length) {
        return;
    }

    const currentItem = personalizationPreviewItemsState[activeAdminPersonalizationPreviewIndex] || createDefaultPersonalizationPreviewItem();
    personalizationPreviewItemsState[activeAdminPersonalizationPreviewIndex] = {
        ...currentItem,
        name: String(personalizationPreviewNameInput?.value || currentItem.name || "Prévia").trim() || "Prévia",
        enabled: Boolean(productForm.elements.personalizationPreviewEnabled?.checked),
        allowCustomerAdjust: Boolean(productForm.elements.personalizationPreviewAllowCustomerAdjust?.checked),
        showSampleTextInPreview: Boolean(productForm.elements.personalizationPreviewShowSampleText?.checked),
        imageUrl: existingPreviewImage?.imageUrl || "",
        imagePublicId: existingPreviewImage?.imagePublicId || "",
        sampleText: productForm.elements.personalizationPreviewSampleText?.value || "Maria",
        positionXPercent: Number(productForm.elements.personalizationPreviewPositionXPercent?.value || 50),
        positionYPercent: Number(productForm.elements.personalizationPreviewPositionYPercent?.value || 50),
        widthPercent: Number(productForm.elements.personalizationPreviewWidthPercent?.value || 60),
        fontSizePx: Number(productForm.elements.personalizationPreviewFontSizePx?.value || 28),
        referenceWidthPx: Number(productForm.elements.personalizationPreviewReferenceWidthPx?.value || 0),
        textColor: productForm.elements.personalizationPreviewTextColor?.value || "#ffffff",
        fontFamily: productForm.elements.personalizationPreviewFontFamily?.value || "'Georgia', 'Times New Roman', serif",
        fontWeight: productForm.elements.personalizationPreviewFontWeight?.value || "700",
        letterSpacingEm: Number(productForm.elements.personalizationPreviewLetterSpacingEm?.value || 0.04),
        rotationDeg: Number(productForm.elements.personalizationPreviewRotationDeg?.value || 0),
        textTransform: productForm.elements.personalizationPreviewTextTransform?.value === "none" ? "none" : "uppercase",
        textShadow: productForm.elements.personalizationPreviewTextShadow?.value || "0 2px 10px rgba(0, 0, 0, 0.35)",
        selectedFile: selectedPreviewImageFile || null
    };

    renderPersonalizationPreviewItemTabs();
}

function selectPersonalizationPreviewItem(index) {
    syncActivePreviewItemFromForm();
    activeAdminPersonalizationPreviewIndex = Math.max(0, Math.min(index, personalizationPreviewItemsState.length - 1));
    applyActivePreviewItemToForm();
    updateAdminPersonalizationPreview();
    updateSubmitButtonState();
}

function serializeProductFormState() {
    if (!productForm) {
        return null;
    }

    syncActivePreviewItemFromForm();
    syncDescriptionInput();
    syncActivePreviewItemFromForm();

    return JSON.stringify({
        name: productForm.elements.name.value.trim(),
        categoryId: productForm.elements.categoryId.value,
        price: productForm.elements.price.value,
        compareAtPrice: productForm.elements.compareAtPrice.value,
        installmentQuantity: productForm.elements.installmentQuantity.value,
        installmentValue: productForm.elements.installmentValue.value,
        shippingAllowMotoboy: productForm.elements.shippingAllowMotoboy.value,
        shippingProductionDays: productForm.elements.shippingProductionDays.value,
        shippingWeightKg: productForm.elements.shippingWeightKg.value,
        shippingLengthCm: productForm.elements.shippingLengthCm.value,
        shippingWidthCm: productForm.elements.shippingWidthCm.value,
        shippingHeightCm: productForm.elements.shippingHeightCm.value,
        stockMode: productForm.elements.stockMode.value,
        stockQuantity: productForm.elements.stockQuantity.value,
        variations: readProductVariations(),
        status: productForm.elements.status.value,
        description: descriptionInput?.value || "",
        isFeatured: Boolean(productForm.elements.isFeatured.checked),
        showInMoreOptions: Boolean(productForm.elements.showInMoreOptions.checked),
        personalizationShowNameInput: Boolean(productForm.elements.personalizationShowNameInput?.checked),
        personalizationRequireName: Boolean(productForm.elements.personalizationRequireName?.checked),
        personalizationPreviewEnabled: Boolean(productForm.elements.personalizationPreviewEnabled?.checked),
        personalizationPreviews: personalizationPreviewItemsState.map((item) => ({
            name: item.name,
            enabled: item.enabled,
            allowCustomerAdjust: item.allowCustomerAdjust,
            showSampleTextInPreview: item.showSampleTextInPreview,
            imageUrl: item.imageUrl,
            imagePublicId: item.imagePublicId,
            sampleText: item.sampleText,
            positionXPercent: item.positionXPercent,
            positionYPercent: item.positionYPercent,
            widthPercent: item.widthPercent,
            fontSizePx: item.fontSizePx,
            referenceWidthPx: item.referenceWidthPx,
            textColor: item.textColor,
            fontFamily: item.fontFamily,
            fontWeight: item.fontWeight,
            letterSpacingEm: item.letterSpacingEm,
            rotationDeg: item.rotationDeg,
            textTransform: item.textTransform,
            textShadow: item.textShadow,
            previewImageName: item.selectedFile?.name || item.imageUrl || ""
        })),
        personalizationImageOverlayAllowOptionImages: Boolean(productForm.elements.personalizationImageOverlayAllowOptionImages?.checked),
        personalizationImageOverlayRequireSelection: Boolean(productForm.elements.personalizationImageOverlayRequireSelection?.checked),
        personalizationImageOverlayAllowCustomerUpload: Boolean(productForm.elements.personalizationImageOverlayAllowCustomerUpload?.checked),
        personalizationImageOverlayAllowCustomerAdjust: Boolean(productForm.elements.personalizationImageOverlayAllowCustomerAdjust?.checked),
        personalizationImageOverlayPositionXPercent: productForm.elements.personalizationImageOverlayPositionXPercent?.value || "50",
        personalizationImageOverlayPositionYPercent: productForm.elements.personalizationImageOverlayPositionYPercent?.value || "50",
        personalizationImageOverlayMaxWidthPercent: productForm.elements.personalizationImageOverlayMaxWidthPercent?.value || "34",
        personalizationImageOverlayMaxHeightPercent: productForm.elements.personalizationImageOverlayMaxHeightPercent?.value || "34",
        personalizationImageOverlayIsRound: Boolean(productForm.elements.personalizationImageOverlayIsRound?.checked),
        personalizationImageOverlayRotationDeg: productForm.elements.personalizationImageOverlayRotationDeg?.value || "0",
        overlayOptionImageNames: selectedOverlayOptionImageFiles.map((file) => file.name),
        retainedOverlayOptionImages: existingOverlayOptionImages.map((image) => ({
            imageUrl: image.imageUrl || "",
            imagePublicId: image.imagePublicId || ""
        })),
        retainedImages: existingProductImages.map((image) => ({
            imageUrl: image.imageUrl || "",
            imagePublicId: image.imagePublicId || ""
        })),
        selectedImageNames: selectedProductImageFiles.map((file) => file.name)
    });
}

function updateSubmitButtonState() {
    if (!submitButton) {
        return;
    }

    if (!editingProductId) {
        submitButton.disabled = false;
        return;
    }

    const currentSnapshot = serializeProductFormState();
    submitButton.disabled = currentSnapshot === originalProductSnapshot;
}

function setDescriptionContent(value = "") {
    if (!descriptionEditor || !descriptionInput) {
        return;
    }

    descriptionEditor.innerHTML = value || "";
    syncDescriptionInput();
}

function focusDescriptionEditor() {
    if (!descriptionEditor) {
        return;
    }

    descriptionEditor.focus();
}

function applyDescriptionCommand(command, value = null) {
    if (!descriptionEditor) {
        return;
    }

    focusDescriptionEditor();

    if (command === "formatBlock" && value) {
        document.execCommand(command, false, value);
        syncDescriptionInput();
        return;
    }

    if (command === "createLink") {
        const linkUrl = window.prompt("Digite a URL do link:");

        if (!linkUrl) {
            return;
        }

        document.execCommand(command, false, linkUrl.trim());
        syncDescriptionInput();
        return;
    }

    if (command === "foreColor" && value) {
        document.execCommand(command, false, value);
        syncDescriptionInput();
        return;
    }

    document.execCommand(command, false, null);
    syncDescriptionInput();
}

function renderProductMediaPreview() {
    if (!productMediaPreview) {
        return;
    }

    const previewImages = [
        ...existingProductImages.map((image, index) => ({
            imageUrl: image.imageUrl,
            source: "existing",
            index
        })),
        ...selectedProductImageFiles.map((file, index) => ({
            imageUrl: URL.createObjectURL(file),
            source: "selected",
            index
        }))
    ];

    if (!previewImages.length) {
        productMediaPreview.innerHTML = "";
        renderPreviewImageUploadState();
        renderOverlayOptionImages();
        updateAdminPersonalizationPreview();
        return;
    }

    productMediaPreview.innerHTML = previewImages.map((image, index) => `
        <div class="admin-media-thumb ${index === 0 ? "is-cover" : ""}">
            <button
                type="button"
                class="admin-media-remove"
                data-image-index="${image.index}"
                data-image-source="${image.source}"
                aria-label="Remover imagem ${index + 1}"
            >
                x
            </button>
            <img src="${escapeHtml(image.imageUrl)}" alt="Imagem ${index + 1}">
            ${index === 0 ? '<span class="admin-media-badge">Capa</span>' : ""}
        </div>
    `).join("");

    renderPreviewImageUploadState();
    renderOverlayOptionImages();
    updateAdminPersonalizationPreview();
}

function mergeSelectedProductImageFiles(nextFiles = []) {
    const existingFileKeys = new Set(
        selectedProductImageFiles.map((file) => `${file.name}|${file.size}|${file.lastModified}`)
    );

    nextFiles.forEach((file) => {
        const fileKey = `${file.name}|${file.size}|${file.lastModified}`;

        if (existingFileKeys.has(fileKey)) {
            return;
        }

        existingFileKeys.add(fileKey);
        selectedProductImageFiles.push(file);
    });
}

function renderPreviewImageUploadState() {
    if (!adminPreviewImageCard || !adminPreviewImageCardImage) {
        return;
    }

    const previewImageUrl = selectedPreviewImageFile
        ? URL.createObjectURL(selectedPreviewImageFile)
        : existingPreviewImage?.imageUrl || "";

    if (!previewImageUrl) {
        adminPreviewImageCard.hidden = true;
        adminPreviewImageCardImage.removeAttribute("src");
        return;
    }

    adminPreviewImageCard.hidden = false;
    adminPreviewImageCardImage.src = previewImageUrl;
}

function getPersonalizationPreviewConfig(product = null) {
    const preview = product?.personalization?.preview || {};

    return {
        enabled: Boolean(preview.enabled),
        imageUrl: String(preview.imageUrl || ""),
        imagePublicId: String(preview.imagePublicId || ""),
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
        textShadow: String(preview.textShadow || "0 2px 10px rgba(0, 0, 0, 0.35)"),
        showSampleTextInPreview: preview.showSampleTextInPreview !== false
    };
}

function getPersonalizationImageOverlayConfig(product = null) {
    const overlay = product?.personalization?.imageOverlay || {};

    return {
        enabled: Boolean(overlay.enabled),
        allowOptionImages: Boolean(overlay.allowOptionImages),
        requireSelection: Boolean(overlay.requireSelection),
        allowCustomerUpload: Boolean(overlay.allowCustomerUpload),
        optionImages: Array.isArray(overlay.optionImages) ? overlay.optionImages.filter((image) => image?.imageUrl) : [],
        positionXPercent: Number(overlay.positionXPercent ?? 50),
        positionYPercent: Number(overlay.positionYPercent ?? 50),
        maxWidthPercent: Number(overlay.maxWidthPercent ?? overlay.widthPercent ?? 34),
        maxHeightPercent: Number(overlay.maxHeightPercent ?? overlay.widthPercent ?? 34),
        isRound: Boolean(overlay.isRound),
        allowCustomerAdjust: Boolean(overlay.allowCustomerAdjust),
        rotationDeg: Number(overlay.rotationDeg ?? 0)
    };
}

function renderOverlayOptionImages() {
    if (!adminOverlayOptionsGrid || !productForm?.elements.personalizationImageOverlayAllowOptionImages?.checked) {
        if (adminOverlayOptionsGrid) {
            adminOverlayOptionsGrid.innerHTML = "";
        }
        return;
    }

    const optionImages = selectedOverlayOptionImageFiles.length
        ? selectedOverlayOptionImageFiles.map((file) => ({
            imageUrl: URL.createObjectURL(file)
        }))
        : existingOverlayOptionImages;

    if (!optionImages.length) {
        adminOverlayOptionsGrid.innerHTML = "";
        return;
    }

    adminOverlayOptionsGrid.innerHTML = optionImages.map((image, index) => `
        <div class="admin-overlay-option-thumb">
            <button
                type="button"
                class="admin-media-remove"
                data-overlay-image-index="${index}"
                aria-label="Remover imagem de aplicação ${index + 1}"
            >
                x
            </button>
            <img src="${escapeHtml(image.imageUrl)}" alt="Imagem de aplicação ${index + 1}">
        </div>
    `).join("");
}

function updatePersonalizationPreviewVisibility() {
    if (!personalizationPreviewFields || !productForm) {
        return;
    }

    if (productForm.elements.personalizationRequireName?.checked && productForm.elements.personalizationShowNameInput) {
        productForm.elements.personalizationShowNameInput.checked = true;
    }

    const previewEnabled = Boolean(productForm.elements.personalizationPreviewEnabled?.checked);
    const overlayEnabled = Boolean(
        productForm.elements.personalizationImageOverlayAllowOptionImages?.checked ||
        productForm.elements.personalizationImageOverlayAllowCustomerUpload?.checked
    );
    personalizationPreviewFields.hidden = !previewEnabled;

    if (adminImageOverlayFields) {
        adminImageOverlayFields.hidden = !overlayEnabled;
    }

    if (adminOverlayOptionImagesField) {
        const allowOptionImages = Boolean(productForm.elements.personalizationImageOverlayAllowOptionImages?.checked);
        adminOverlayOptionImagesField.hidden = !(overlayEnabled && allowOptionImages);
    }
}

function updateAdminPersonalizationPreview() {
    if (!productForm || !adminPersonalizationPreviewImage || !adminPersonalizationPreviewText) {
        return;
    }

    const previewImageUrl = selectedPreviewImageFile
        ? URL.createObjectURL(selectedPreviewImageFile)
        : existingPreviewImage?.imageUrl || "";
    const sampleText = String(productForm.elements.personalizationPreviewSampleText?.value || "Maria").trim() || "Maria";
    const textTransform = productForm.elements.personalizationPreviewTextTransform?.value === "none" ? "none" : "uppercase";

    adminPersonalizationPreviewImage.src = previewImageUrl || "/img/tabua-produto01.webp";
    adminPersonalizationPreviewText.textContent = textTransform === "uppercase" ? sampleText.toUpperCase() : sampleText;

    const applyPreviewTextScale = () => {
        const currentWidth = adminPersonalizationPreviewImage.clientWidth || adminPersonalizationPreviewImage.parentElement?.clientWidth || 0;
        const storedReferenceWidth = Number(productForm.elements.personalizationPreviewReferenceWidthPx?.value || 0);
        const referenceWidth = storedReferenceWidth > 0 ? storedReferenceWidth : (currentWidth || 1);
        const baseFontSize = Number(productForm.elements.personalizationPreviewFontSizePx?.value || 28);
        const scaledFontSize = baseFontSize * ((currentWidth || referenceWidth) / referenceWidth);

        if (productForm.elements.personalizationPreviewReferenceWidthPx && storedReferenceWidth <= 0 && currentWidth > 0) {
            productForm.elements.personalizationPreviewReferenceWidthPx.value = String(Math.round(currentWidth));
        }

        adminPersonalizationPreviewText.style.left = `${productForm.elements.personalizationPreviewPositionXPercent?.value || 50}%`;
        adminPersonalizationPreviewText.style.top = `${productForm.elements.personalizationPreviewPositionYPercent?.value || 50}%`;
        adminPersonalizationPreviewText.style.width = `${productForm.elements.personalizationPreviewWidthPercent?.value || 60}%`;
        adminPersonalizationPreviewText.style.fontSize = `${scaledFontSize}px`;
        adminPersonalizationPreviewText.style.color = productForm.elements.personalizationPreviewTextColor?.value || "#ffffff";
        adminPersonalizationPreviewText.style.fontFamily = productForm.elements.personalizationPreviewFontFamily?.value || "'Georgia', 'Times New Roman', serif";
        adminPersonalizationPreviewText.style.fontWeight = productForm.elements.personalizationPreviewFontWeight?.value || "700";
        adminPersonalizationPreviewText.style.letterSpacing = `${productForm.elements.personalizationPreviewLetterSpacingEm?.value || 0.04}em`;
        adminPersonalizationPreviewText.style.textTransform = textTransform;
        adminPersonalizationPreviewText.style.textShadow = productForm.elements.personalizationPreviewTextShadow?.value || "0 2px 10px rgba(0, 0, 0, 0.35)";
        adminPersonalizationPreviewText.style.transform = `translate(-50%, -50%) rotate(${productForm.elements.personalizationPreviewRotationDeg?.value || 0}deg)`;
    };

    if (adminPersonalizationPreviewImage.complete) {
        applyPreviewTextScale();
    } else {
        adminPersonalizationPreviewImage.onload = applyPreviewTextScale;
    }

    if (adminPersonalizationOverlayImage) {
        const overlayImages = selectedOverlayOptionImageFiles.length
            ? selectedOverlayOptionImageFiles.map((file) => ({ imageUrl: URL.createObjectURL(file) }))
            : existingOverlayOptionImages;
        const overlayEnabled = Boolean(
            productForm.elements.personalizationImageOverlayAllowOptionImages?.checked ||
            productForm.elements.personalizationImageOverlayAllowCustomerUpload?.checked
        );
        const overlayImageUrl = overlayImages[0]?.imageUrl || "";

        if (!overlayEnabled || !overlayImageUrl) {
            adminPersonalizationOverlayImage.hidden = true;
            adminPersonalizationOverlayImage.removeAttribute("src");
        } else {
            adminPersonalizationOverlayImage.hidden = false;
            adminPersonalizationOverlayImage.src = overlayImageUrl;
            adminPersonalizationOverlayImage.style.left = `${productForm.elements.personalizationImageOverlayPositionXPercent?.value || 50}%`;
            adminPersonalizationOverlayImage.style.top = `${productForm.elements.personalizationImageOverlayPositionYPercent?.value || 50}%`;
            adminPersonalizationOverlayImage.style.width = "auto";
            adminPersonalizationOverlayImage.style.height = "auto";
            adminPersonalizationOverlayImage.style.maxWidth = `${productForm.elements.personalizationImageOverlayMaxWidthPercent?.value || 34}%`;
            adminPersonalizationOverlayImage.style.maxHeight = `${productForm.elements.personalizationImageOverlayMaxHeightPercent?.value || 34}%`;
            adminPersonalizationOverlayImage.style.borderRadius = productForm.elements.personalizationImageOverlayIsRound?.checked ? "50%" : "0";
            adminPersonalizationOverlayImage.style.transform = `translate(-50%, -50%) rotate(${productForm.elements.personalizationImageOverlayRotationDeg?.value || 0}deg)`;
        }
    }
}

function resetProductForm() {
    if (!productForm) {
        return;
    }

    productForm.reset();
    renderCategoryOptions("");
    productForm.elements.installmentQuantity.value = 1;
    productForm.elements.installmentValue.value = 0;
    productForm.elements.shippingAllowMotoboy.value = "true";
    productForm.elements.shippingProductionDays.value = "";
    productForm.elements.shippingWeightKg.value = "";
    productForm.elements.shippingLengthCm.value = "";
    productForm.elements.shippingWidthCm.value = "";
    productForm.elements.shippingHeightCm.value = "";
    productForm.elements.stockMode.value = "unlimited";
    productForm.elements.stockQuantity.value = "";
    productForm.elements.status.value = "active";
    productForm.elements.isFeatured.checked = false;
    productForm.elements.showInMoreOptions.checked = false;
    productForm.elements.personalizationShowNameInput.checked = false;
    productForm.elements.personalizationRequireName.checked = false;
    productForm.elements.personalizationPreviewEnabled.checked = false;
    productForm.elements.personalizationPreviewAllowCustomerAdjust.checked = false;
    productForm.elements.personalizationImageOverlayAllowOptionImages.checked = false;
    productForm.elements.personalizationImageOverlayRequireSelection.checked = false;
    productForm.elements.personalizationImageOverlayAllowCustomerUpload.checked = false;
    productForm.elements.personalizationImageOverlayAllowCustomerAdjust.checked = false;
    productForm.elements.personalizationImageOverlayPositionXPercent.value = 50;
    productForm.elements.personalizationImageOverlayPositionYPercent.value = 50;
    productForm.elements.personalizationImageOverlayMaxWidthPercent.value = 34;
    productForm.elements.personalizationImageOverlayMaxHeightPercent.value = 34;
    productForm.elements.personalizationImageOverlayIsRound.checked = false;
    productForm.elements.personalizationImageOverlayRotationDeg.value = 0;
    productForm.elements.personalizationPreviewSampleText.value = "Maria";
    productForm.elements.personalizationPreviewPositionXPercent.value = 50;
    productForm.elements.personalizationPreviewPositionYPercent.value = 50;
    productForm.elements.personalizationPreviewWidthPercent.value = 60;
    productForm.elements.personalizationPreviewFontSizePx.value = 28;
    productForm.elements.personalizationPreviewReferenceWidthPx.value = 0;
    productForm.elements.personalizationPreviewTextColor.value = "#ffffff";
    productForm.elements.personalizationPreviewFontFamily.value = "'Georgia', 'Times New Roman', serif";
    productForm.elements.personalizationPreviewFontWeight.value = "700";
    productForm.elements.personalizationPreviewLetterSpacingEm.value = 0.04;
    productForm.elements.personalizationPreviewRotationDeg.value = 0;
    productForm.elements.personalizationPreviewTextTransform.value = "uppercase";
    productForm.elements.personalizationPreviewTextShadow.value = "0 2px 10px rgba(0, 0, 0, 0.35)";
    setDescriptionContent("");
    selectedProductImageFiles = [];
    existingProductImages = [];
    personalizationPreviewItemsState = [createDefaultPersonalizationPreviewItem()];
    activeAdminPersonalizationPreviewIndex = 0;
    selectedPreviewImageFile = null;
    existingPreviewImage = null;
    selectedOverlayOptionImageFiles = [];
    existingOverlayOptionImages = [];
    productVariationsState = [];
    clearVariationUploadState();
    originalProductSnapshot = null;
    editingProductId = null;
    formTitle.textContent = "Adicionar produto";
    submitButton.textContent = "Salvar produto";
    submitButton.disabled = false;
    if (editorStatusBadge) {
        editorStatusBadge.textContent = "Novo";
    }
    updateStockQuantityFieldVisibility();
    updateStatusHintSelection();
    applyActivePreviewItemToForm();
    renderProductMediaPreview();
    renderProductVariations(productVariationsState);
    updatePersonalizationPreviewVisibility();
    updateAdminPersonalizationPreview();
    if (productImageHelp) {
        productImageHelp.textContent = "Adicione várias imagens. A primeira imagem enviada será a capa do produto.";
    }
    if (productPreviewImageHelp) {
        productPreviewImageHelp.textContent = "Envie uma imagem separada apenas para a simulação da gravação.";
    }
    if (productOverlayOptionImagesHelp) {
        productOverlayOptionImagesHelp.textContent = "Envie uma ou mais imagens para o cliente escolher.";
    }
}

function populateProductForm(product) {
    if (!productForm) {
        return;
    }

    editingProductId = product._id;
    formTitle.textContent = "Editar produto";
    submitButton.textContent = "Salvar alterações";
    const statusMeta = getStatusMeta(product.status);
    const previewConfig = getPersonalizationPreviewConfig(product);
    const overlayConfig = getPersonalizationImageOverlayConfig(product);
    if (editorStatusBadge) {
        editorStatusBadge.textContent = statusMeta.label;
    }
    selectedProductImageFiles = [];
    existingProductImages = getProductImages(product);
    selectedPreviewImageFile = null;
    existingPreviewImage = previewConfig.imageUrl
        ? {
            imageUrl: previewConfig.imageUrl,
            imagePublicId: previewConfig.imagePublicId
        }
        : null;
    selectedOverlayOptionImageFiles = [];
    existingOverlayOptionImages = overlayConfig.optionImages;
    clearVariationUploadState();
    productVariationsState = Array.isArray(product.variations)
        ? product.variations.map((variation) => normalizeVariationInput({
            id: variation.id,
            type: variation.type,
            name: variation.name,
            items: variation.items
        }))
        : [];

    productForm.elements.name.value = product.name || "";
    renderCategoryOptions(findMatchingCategoryId(product));
    productForm.elements.price.value = product.price ?? "";
    productForm.elements.compareAtPrice.value = product.compareAtPrice ?? "";
    productForm.elements.installmentQuantity.value = product.installments?.quantity ?? 1;
    productForm.elements.installmentValue.value = product.installments?.value ?? 0;
    productForm.elements.shippingAllowMotoboy.value = product.shipping?.allowMotoboy === false ? "false" : "true";
    productForm.elements.shippingProductionDays.value = product.shipping?.productionDays ?? "";
    productForm.elements.shippingWeightKg.value = product.shipping?.weightKg ?? "";
    productForm.elements.shippingLengthCm.value = product.shipping?.lengthCm ?? "";
    productForm.elements.shippingWidthCm.value = product.shipping?.widthCm ?? "";
    productForm.elements.shippingHeightCm.value = product.shipping?.heightCm ?? "";
    productForm.elements.stockMode.value = getProductStockInfo(product).mode;
    productForm.elements.stockQuantity.value = getProductStockInfo(product).quantity ?? "";
    productForm.elements.status.value = statusMeta.value;
    setDescriptionContent(product.description || "");
    productForm.elements.isFeatured.checked = Boolean(product.isFeatured);
    productForm.elements.showInMoreOptions.checked = Boolean(product.showInMoreOptions);
    productForm.elements.personalizationShowNameInput.checked = Boolean(
        product.personalization?.showNameInput
        ?? product.personalization?.requireName
        ?? product.personalization?.enabled
    );
    productForm.elements.personalizationRequireName.checked = Boolean(product.personalization?.requireName);
    productForm.elements.personalizationPreviewEnabled.checked = previewConfig.enabled;
    productForm.elements.personalizationImageOverlayAllowOptionImages.checked = overlayConfig.allowOptionImages;
    productForm.elements.personalizationImageOverlayRequireSelection.checked = overlayConfig.requireSelection;
    productForm.elements.personalizationImageOverlayAllowCustomerUpload.checked = overlayConfig.allowCustomerUpload;
    productForm.elements.personalizationImageOverlayAllowCustomerAdjust.checked = overlayConfig.allowCustomerAdjust;
    productForm.elements.personalizationImageOverlayPositionXPercent.value = overlayConfig.positionXPercent;
    productForm.elements.personalizationImageOverlayPositionYPercent.value = overlayConfig.positionYPercent;
    productForm.elements.personalizationImageOverlayMaxWidthPercent.value = overlayConfig.maxWidthPercent;
    productForm.elements.personalizationImageOverlayMaxHeightPercent.value = overlayConfig.maxHeightPercent;
    productForm.elements.personalizationImageOverlayIsRound.checked = overlayConfig.isRound;
    productForm.elements.personalizationImageOverlayRotationDeg.value = overlayConfig.rotationDeg;
    personalizationPreviewItemsState = getNormalizedPersonalizationPreviewItems(product);
    activeAdminPersonalizationPreviewIndex = 0;
    applyActivePreviewItemToForm();
    updateStockQuantityFieldVisibility();
    updateStatusHintSelection();
    renderProductMediaPreview();
    renderProductVariations(productVariationsState);
    updatePersonalizationPreviewVisibility();
    updateAdminPersonalizationPreview();
    originalProductSnapshot = serializeProductFormState();
    updateSubmitButtonState();

    if (productImageHelp) {
        productImageHelp.textContent = existingProductImages.length
            ? "As imagens atuais estao sendo exibidas. Novas imagens serao adicionadas a galeria atual."
            : "Este produto ainda não tem imagens. Adicione uma ou mais imagens para criar a galeria.";
    }
    if (productPreviewImageHelp) {
        productPreviewImageHelp.textContent = existingPreviewImage
            ? "A imagem exclusiva da prévia atual esta sendo exibida. Se enviar outra, ela substitui a atual."
            : "Envie uma imagem separada apenas para a simulação da gravação.";
    }
    if (productOverlayOptionImagesHelp) {
        productOverlayOptionImagesHelp.textContent = existingOverlayOptionImages.length
            ? "As imagens atuais de aplicação estão sendo exibidas. Se enviar novas, elas substituem as atuais."
            : "Envie uma ou mais imagens para o cliente escolher.";
    }
}

function getFilteredProducts(products) {
    switch (activeFilter) {
        case "active":
            return products.filter((product) => getStatusMeta(product.status).value === "active");
        case "draft":
            return products.filter((product) => getStatusMeta(product.status).value === "draft");
        case "unlisted":
            return products.filter((product) => getStatusMeta(product.status).value === "unlisted");
        default:
            return products;
    }
}

function renderProducts(products) {
    if (!tableBody) {
        return;
    }

    const filteredProducts = getFilteredProducts(products);

    if (!filteredProducts.length) {
        tableBody.innerHTML = "";
        emptyState.hidden = false;
        tableWrap.hidden = true;
        return;
    }

    emptyState.hidden = true;
    tableWrap.hidden = false;

    tableBody.innerHTML = filteredProducts.map((product) => {
        const imageUrl = escapeHtml(getProductImages(product)[0]?.imageUrl || "/img/tabua-produto01.webp");
        const name = escapeHtml(product.name || "");
        const category = escapeHtml(product.category || "");
        const stockInfo = getProductStockInfo(product);
        const variationCount = Array.isArray(product.variations) ? product.variations.length : 0;
        const stockText = variationCount
            ? `${variationCount} variação(ões)`
            : (stockInfo.mode === "unlimited"
                ? "Estoque ilimitado"
                : `${stockInfo.quantity} em estoque`);
        const statusMeta = getStatusMeta(product.status);
        const publicProductUrl = getPublicProductUrl(product);
        const copyLinkButton = statusMeta.value === "unlisted" && publicProductUrl
            ? `<button type="button" class="admin-table-action" data-action="copy-link" data-id="${product._id}">Copiar link</button>`
            : "";
        return `
            <tr>
                <td class="admin-products-checkbox-cell" data-label="">
                    <input type="checkbox" aria-label="Selecionar ${name}">
                </td>
                <td data-label="Produto">
                    <div class="admin-product-main">
                        <img src="${imageUrl}" alt="${name}" class="admin-product-thumb">
                        <div>
                            <div class="admin-product-name">${name}</div>
                        </div>
                    </div>
                </td>
                <td data-label="Status">
                    <span class="admin-products-status-pill ${statusMeta.pillClass}">${statusMeta.label}</span>
                </td>
                <td data-label="Estoque">
                    <span class="admin-stock-text">${stockText}</span>
                </td>
                <td data-label="Categoria">${category}</td>
                <td data-label="Ações">
                    <div class="admin-table-actions">
                        <button type="button" class="admin-table-action" data-action="edit" data-id="${product._id}">Editar</button>
                        ${copyLinkButton}
                        <button type="button" class="admin-table-action delete" data-action="delete" data-id="${product._id}">Excluir</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

async function fetchAdminProducts() {
    const response = await fetch("/api/admin/products", {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return [];
    }

    if (!response.ok) {
        throw new Error("Não foi possível carregar os produtos.");
    }

    return response.json();
}

async function fetchAdminCategories() {
    const response = await fetch("/api/admin/categories", {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return [];
    }

    if (!response.ok) {
        throw new Error("Não foi possível carregar as categorias.");
    }

    return response.json();
}

async function loadCategories() {
    const categories = await fetchAdminCategories();
    categoriesState = Array.isArray(categories) ? categories : [];

    const selectedCategoryId = editingProductId
        ? findMatchingCategoryId(productsState.find((product) => product._id === editingProductId))
        : "";

    renderCategoryOptions(selectedCategoryId);
}

async function loadProducts() {
    try {
        const products = await fetchAdminProducts();
        productsState = products;
        renderProducts(products);
        renderAdminRoute();
    } catch (error) {
        showFeedback(error.message, "error");
    }
}

function getFormPayload(form) {
    syncActivePreviewItemFromForm();

    const formData = new FormData();
    const variations = readProductVariations();
    const variationItemUploadMap = [];
    const variationItemPreviewUploadMap = [];

    formData.append("name", form.elements.name.value.trim());
    formData.append("categoryId", form.elements.categoryId.value);
    formData.append("price", form.elements.price.value);
    formData.append("compareAtPrice", form.elements.compareAtPrice.value);
    formData.append("installmentQuantity", form.elements.installmentQuantity.value);
    formData.append("installmentValue", form.elements.installmentValue.value);
    formData.append("shippingAllowMotoboy", form.elements.shippingAllowMotoboy.value);
    formData.append("shippingProductionDays", form.elements.shippingProductionDays.value);
    formData.append("shippingWeightKg", form.elements.shippingWeightKg.value);
    formData.append("shippingLengthCm", form.elements.shippingLengthCm.value);
    formData.append("shippingWidthCm", form.elements.shippingWidthCm.value);
    formData.append("shippingHeightCm", form.elements.shippingHeightCm.value);
    formData.append("stockMode", form.elements.stockMode.value);
    formData.append("stockQuantity", form.elements.stockQuantity.value);
    formData.append("variations", JSON.stringify(variations));
    formData.append("status", form.elements.status.value);
    syncDescriptionInput();
    formData.append("description", descriptionInput?.value || "");
    formData.append("isFeatured", String(form.elements.isFeatured.checked));
    formData.append("showInMoreOptions", String(form.elements.showInMoreOptions.checked));
    formData.append("personalizationShowNameInput", String(form.elements.personalizationShowNameInput.checked));
    formData.append("personalizationRequireName", String(form.elements.personalizationRequireName.checked));
    formData.append("personalizationPreviewEnabled", String(form.elements.personalizationPreviewEnabled.checked));
    formData.append("personalizationImageOverlayAllowOptionImages", String(form.elements.personalizationImageOverlayAllowOptionImages.checked));
    formData.append("personalizationImageOverlayRequireSelection", String(form.elements.personalizationImageOverlayRequireSelection.checked));
    formData.append("personalizationImageOverlayAllowCustomerUpload", String(form.elements.personalizationImageOverlayAllowCustomerUpload.checked));
    formData.append("personalizationImageOverlayAllowCustomerAdjust", String(form.elements.personalizationImageOverlayAllowCustomerAdjust.checked));
    formData.append("personalizationImageOverlayPositionXPercent", form.elements.personalizationImageOverlayPositionXPercent.value);
    formData.append("personalizationImageOverlayPositionYPercent", form.elements.personalizationImageOverlayPositionYPercent.value);
    formData.append("personalizationImageOverlayMaxWidthPercent", form.elements.personalizationImageOverlayMaxWidthPercent.value);
    formData.append("personalizationImageOverlayMaxHeightPercent", form.elements.personalizationImageOverlayMaxHeightPercent.value);
    formData.append("personalizationImageOverlayIsRound", String(form.elements.personalizationImageOverlayIsRound.checked));
    formData.append("personalizationImageOverlayRotationDeg", form.elements.personalizationImageOverlayRotationDeg.value);
    const serializedPersonalizationPreviews = personalizationPreviewItemsState.map((item, index) => {
        const hasSelectedFile = item.selectedFile instanceof File;

        if (hasSelectedFile) {
            formData.append("previewImages", item.selectedFile);
        }

        return {
            name: item.name,
            enabled: Boolean(form.elements.personalizationPreviewEnabled.checked),
            allowCustomerAdjust: item.allowCustomerAdjust,
            imageUrl: hasSelectedFile ? "" : (item.imageUrl || ""),
            imagePublicId: hasSelectedFile ? "" : (item.imagePublicId || ""),
            positionXPercent: item.positionXPercent,
            positionYPercent: item.positionYPercent,
            widthPercent: item.widthPercent,
            fontSizePx: item.fontSizePx,
            referenceWidthPx: item.referenceWidthPx,
            sampleText: item.sampleText,
            textColor: item.textColor,
            fontFamily: item.fontFamily,
            fontWeight: item.fontWeight,
            letterSpacingEm: item.letterSpacingEm,
            rotationDeg: item.rotationDeg,
            textTransform: item.textTransform,
            textShadow: item.textShadow,
            uploadIndex: hasSelectedFile ? index : undefined
        };
    });
    formData.append("personalizationPreviews", JSON.stringify(serializedPersonalizationPreviews));
    formData.append("retainedOverlayOptionImages", JSON.stringify(existingOverlayOptionImages));
    formData.append("retainedImages", JSON.stringify(existingProductImages));
    selectedProductImageFiles.forEach((file) => {
        formData.append("images", file);
    });
    selectedOverlayOptionImageFiles.forEach((file) => {
        formData.append("overlayOptionImages", file);
    });
    variations.forEach((variation) => {
        variation.items.forEach((item) => {
            const file = variationItemUploadFiles.get(item.id);
            const previewFile = variationItemPreviewFiles.get(item.id);

            if (!file) {
                if (previewFile) {
                    formData.append("variationItemPreviewImages", previewFile);
                    variationItemPreviewUploadMap.push({ itemId: item.id });
                }
                return;
            }

            formData.append("variationItemImages", file);
            variationItemUploadMap.push({ itemId: item.id });

            if (previewFile) {
                formData.append("variationItemPreviewImages", previewFile);
                variationItemPreviewUploadMap.push({ itemId: item.id });
            }
        });
    });
    formData.append("variationItemUploadMap", JSON.stringify(variationItemUploadMap));
    formData.append("variationItemPreviewUploadMap", JSON.stringify(variationItemPreviewUploadMap));

    return formData;
}

async function saveProduct(payload) {
    const isEditing = Boolean(editingProductId);
    const response = await fetch(isEditing ? `/api/admin/products/${editingProductId}` : "/api/admin/products", {
        method: isEditing ? "PUT" : "POST",
        credentials: "same-origin",
        body: payload
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || result.message || "Não foi possível salvar o produto.");
    }

    return result;
}

async function removeProduct(productId) {
    const response = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível excluir o produto.");
    }
}

async function copyProductLink(product) {
    const productUrl = getPublicProductUrl(product);

    if (!productUrl) {
        throw new Error("Esse produto ainda não possui um link público disponível.");
    }

    try {
        await navigator.clipboard.writeText(productUrl);
        showFeedback("Link do produto copiado com sucesso.", "success");
    } catch (_error) {
        throw new Error(`Não foi possível copiar automaticamente. Link: ${productUrl}`);
    }
}

if (openCreateProductButton) {
    openCreateProductButton.addEventListener("click", () => {
        navigateAdmin("/admin/products/new");
    });
}

if (cancelEditButton) {
    cancelEditButton.addEventListener("click", () => {
        navigateAdmin("/admin");
    });
}

adminProductTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        activeFilter = tab.dataset.filter;

        adminProductTabs.forEach((button) => {
            button.classList.toggle("active", button === tab);
        });

        renderProducts(productsState);
    });
});

if (productForm) {
    (async () => {
        try {
            await loadCategories();
            await loadProducts();
        } catch (error) {
            showFeedback(error.message, "error");
        }
    })();
    updateStockQuantityFieldVisibility();
    renderProductMediaPreview();
    renderProductVariations(productVariationsState);
    updatePersonalizationPreviewVisibility();
    updateAdminPersonalizationPreview();

    if (addProductVariationButton) {
        addProductVariationButton.addEventListener("click", () => {
            productVariationsState = [...readProductVariations({ includeEmpty: true }), normalizeVariationInput()];
            renderProductVariations(productVariationsState);
            updateSubmitButtonState();
        });
    }

    if (productVariationsList) {
        productVariationsList.addEventListener("click", (event) => {
            const addItemButton = event.target.closest("[data-add-variation-item]");
            const removeButton = event.target.closest("[data-remove-variation]");
            const removeItemButton = event.target.closest("[data-remove-variation-item]");
            const removeImageButton = event.target.closest("[data-remove-variation-item-image]");
            const removePreviewImageButton = event.target.closest("[data-remove-variation-item-preview-image]");

            if (addItemButton) {
                const variationIndex = Number(addItemButton.dataset.addVariationItem);

                if (Number.isNaN(variationIndex)) {
                    return;
                }

                productVariationsState = readProductVariations({ includeEmpty: true });
                const variation = productVariationsState[variationIndex];

                if (!variation) {
                    return;
                }

                variation.items = [...(variation.items || []), normalizeVariationItemInput({}, variation.type)];
                renderProductVariations(productVariationsState);
                updateSubmitButtonState();
                return;
            }

            if (removeItemButton) {
                const [variationIndex, itemIndex] = String(removeItemButton.dataset.removeVariationItem || "").split(":").map((value) => Number(value));

                if (Number.isNaN(variationIndex) || Number.isNaN(itemIndex)) {
                    return;
                }

                productVariationsState = readProductVariations({ includeEmpty: true });
                const variation = productVariationsState[variationIndex];
                const removedItem = variation?.items?.[itemIndex];

                if (!variation || !removedItem) {
                    return;
                }

                const previewUrl = variationItemUploadPreviewUrls.get(removedItem.id);
                const previewProductUrl = variationItemPreviewPreviewUrls.get(removedItem.id);

                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                }
                if (previewProductUrl) {
                    URL.revokeObjectURL(previewProductUrl);
                }

                variationItemUploadFiles.delete(removedItem.id);
                variationItemUploadPreviewUrls.delete(removedItem.id);
                variationItemPreviewFiles.delete(removedItem.id);
                variationItemPreviewPreviewUrls.delete(removedItem.id);
                variation.items = variation.items.filter((_, index) => index !== itemIndex);
                renderProductVariations(productVariationsState.filter((entry) => (entry.items || []).length));
                updateSubmitButtonState();
                return;
            }

            if (removeImageButton) {
                const [variationIndex, itemIndex] = String(removeImageButton.dataset.removeVariationItemImage || "").split(":").map((value) => Number(value));
                const itemRow = event.target.closest("[data-variation-item-index]");

                if (Number.isNaN(variationIndex) || Number.isNaN(itemIndex) || !itemRow) {
                    return;
                }

                const itemId = String(itemRow.dataset.variationItemId || "");
                const previewUrl = variationItemUploadPreviewUrls.get(itemId);

                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                }

                variationItemUploadFiles.delete(itemId);
                variationItemUploadPreviewUrls.delete(itemId);
                itemRow.dataset.variationItemImageUrl = "";
                itemRow.dataset.variationItemImagePublicId = "";
                renderProductVariations(readProductVariations({ includeEmpty: true }));
                updateSubmitButtonState();
                return;
            }

            if (removePreviewImageButton) {
                const [variationIndex, itemIndex] = String(removePreviewImageButton.dataset.removeVariationItemPreviewImage || "").split(":").map((value) => Number(value));
                const itemRow = event.target.closest("[data-variation-item-index]");

                if (Number.isNaN(variationIndex) || Number.isNaN(itemIndex) || !itemRow) {
                    return;
                }

                const itemId = String(itemRow.dataset.variationItemId || "");
                const previewUrl = variationItemPreviewPreviewUrls.get(itemId);

                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                }

                variationItemPreviewFiles.delete(itemId);
                variationItemPreviewPreviewUrls.delete(itemId);
                itemRow.dataset.variationItemPreviewImageUrl = "";
                itemRow.dataset.variationItemPreviewImagePublicId = "";
                renderProductVariations(readProductVariations({ includeEmpty: true }));
                updateSubmitButtonState();
                return;
            }

            if (removeButton) {
                const variationIndex = Number(removeButton.dataset.removeVariation);

                if (Number.isNaN(variationIndex)) {
                    return;
                }

                const currentVariations = readProductVariations({ includeEmpty: true });
                const removedVariation = currentVariations[variationIndex];

                (removedVariation?.items || []).forEach((item) => {
                    const previewUrl = variationItemUploadPreviewUrls.get(item.id);

                    if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                    }
                    const previewProductUrl = variationItemPreviewPreviewUrls.get(item.id);
                    if (previewProductUrl) {
                        URL.revokeObjectURL(previewProductUrl);
                    }

                    variationItemUploadFiles.delete(item.id);
                    variationItemUploadPreviewUrls.delete(item.id);
                    variationItemPreviewFiles.delete(item.id);
                    variationItemPreviewPreviewUrls.delete(item.id);
                });

                productVariationsState = currentVariations.filter((_, index) => index !== variationIndex);
                renderProductVariations(productVariationsState);
                updateSubmitButtonState();
            }
        });

        productVariationsList.addEventListener("change", (event) => {
            const row = event.target.closest("[data-variation-index]");

            if (!row) {
                return;
            }

            if (event.target.matches('[data-variation-field="type"]')) {
                const nextType = event.target.value === "color" ? "color" : "custom";
                const currentVariations = readProductVariations({ includeEmpty: true });
                const variationIndex = Number(row.dataset.variationIndex || -1);
                const currentVariation = currentVariations[variationIndex];

                if (!currentVariation) {
                    return;
                }

                currentVariation.type = nextType;
                currentVariation.name = nextType === "color" ? "Cor" : "";
                currentVariation.items = (currentVariation.items || []).map((item) => ({
                    ...item,
                    colorHex: nextType === "color" ? normalizeVariationColorHex(item.colorHex) : "",
                    imageUrl: nextType === "custom" ? item.imageUrl : "",
                    imagePublicId: nextType === "custom" ? item.imagePublicId : ""
                }));

                if (nextType === "color") {
                    currentVariation.items.forEach((item) => {
                        const previewUrl = variationItemUploadPreviewUrls.get(item.id);

                        if (previewUrl) {
                            URL.revokeObjectURL(previewUrl);
                        }

                        variationItemUploadFiles.delete(item.id);
                        variationItemUploadPreviewUrls.delete(item.id);
                    });
                }

                renderProductVariations(currentVariations);
                updateSubmitButtonState();
                return;
            }

            if (event.target.matches("[data-variation-item-image-input]")) {
                const itemId = String(event.target.dataset.variationItemImageInput || "");
                const nextFile = event.target.files?.[0] || null;
                const previousPreviewUrl = variationItemUploadPreviewUrls.get(itemId);

                if (previousPreviewUrl) {
                    URL.revokeObjectURL(previousPreviewUrl);
                }

                if (nextFile) {
                    variationItemUploadFiles.set(itemId, nextFile);
                    variationItemUploadPreviewUrls.set(itemId, URL.createObjectURL(nextFile));
                } else {
                    variationItemUploadFiles.delete(itemId);
                    variationItemUploadPreviewUrls.delete(itemId);
                }

                renderProductVariations(readProductVariations({ includeEmpty: true }));
                updateSubmitButtonState();
                return;
            }

            if (event.target.matches("[data-variation-item-preview-input]")) {
                const itemId = String(event.target.dataset.variationItemPreviewInput || "");
                const nextFile = event.target.files?.[0] || null;
                const previousPreviewUrl = variationItemPreviewPreviewUrls.get(itemId);

                if (previousPreviewUrl) {
                    URL.revokeObjectURL(previousPreviewUrl);
                }

                if (nextFile) {
                    variationItemPreviewFiles.set(itemId, nextFile);
                    variationItemPreviewPreviewUrls.set(itemId, URL.createObjectURL(nextFile));
                } else {
                    variationItemPreviewFiles.delete(itemId);
                    variationItemPreviewPreviewUrls.delete(itemId);
                }

                renderProductVariations(readProductVariations({ includeEmpty: true }));
                updateSubmitButtonState();
            }
        });
    }

    if (productStockMode) {
        productStockMode.addEventListener("change", updateStockQuantityFieldVisibility);
    }

    if (personalizationPreviewEnabledInput) {
        personalizationPreviewEnabledInput.addEventListener("change", () => {
            updatePersonalizationPreviewVisibility();
            updateAdminPersonalizationPreview();
        });
    }

    if (productStatusDropdown && productStatusTrigger && productStatusHintList && productStatusInput) {
        productStatusTrigger.addEventListener("click", () => {
            setStatusDropdownOpen(!productStatusDropdown.classList.contains("is-open"));
        });

        productStatusHintList.addEventListener("click", (event) => {
            const option = event.target.closest("[data-status-option]");

            if (!option) {
                return;
            }

            productStatusInput.value = option.dataset.statusOption || "active";

            if (editorStatusBadge && editingProductId) {
                editorStatusBadge.textContent = getStatusMeta(productStatusInput.value).label;
            }

            updateStatusHintSelection();
            setStatusDropdownOpen(false);
            updateSubmitButtonState();
        });

        document.addEventListener("click", (event) => {
            if (!productStatusDropdown.contains(event.target)) {
                setStatusDropdownOpen(false);
            }
        });

        updateStatusHintSelection();
    }

    if (productImageInput) {
        productImageInput.addEventListener("change", () => {
            mergeSelectedProductImageFiles(Array.from(productImageInput.files || []));
            productImageInput.value = "";
            renderProductMediaPreview();
            updateSubmitButtonState();
        });
    }

    if (productPreviewImageInput) {
        productPreviewImageInput.addEventListener("change", () => {
            selectedPreviewImageFile = productPreviewImageInput.files?.[0] || null;
            syncActivePreviewItemFromForm();
            renderPreviewImageUploadState();
            updateAdminPersonalizationPreview();
            updateSubmitButtonState();
        });
    }

    if (addPersonalizationPreviewButton) {
        addPersonalizationPreviewButton.addEventListener("click", () => {
            syncActivePreviewItemFromForm();
            personalizationPreviewItemsState.push(createDefaultPersonalizationPreviewItem({
                enabled: Boolean(productForm?.elements.personalizationPreviewEnabled?.checked),
                name: `Prévia ${personalizationPreviewItemsState.length + 1}`
            }));
            activeAdminPersonalizationPreviewIndex = personalizationPreviewItemsState.length - 1;
            applyActivePreviewItemToForm();
            renderPreviewImageUploadState();
            updateAdminPersonalizationPreview();
            updateSubmitButtonState();
        });
    }

    if (removePersonalizationPreviewButton) {
        removePersonalizationPreviewButton.addEventListener("click", () => {
            if (personalizationPreviewItemsState.length <= 1) {
                return;
            }

            personalizationPreviewItemsState.splice(activeAdminPersonalizationPreviewIndex, 1);
            activeAdminPersonalizationPreviewIndex = Math.max(0, activeAdminPersonalizationPreviewIndex - 1);
            applyActivePreviewItemToForm();
            updateAdminPersonalizationPreview();
            updateSubmitButtonState();
        });
    }

    if (personalizationPreviewItems) {
        personalizationPreviewItems.addEventListener("click", (event) => {
            const button = event.target.closest("[data-preview-item-index]");

            if (!button) {
                return;
            }

            selectPersonalizationPreviewItem(Number(button.dataset.previewItemIndex || 0));
            renderPreviewImageUploadState();
        });
    }

    if (productOverlayOptionImagesInput) {
        productOverlayOptionImagesInput.addEventListener("change", () => {
            selectedOverlayOptionImageFiles = Array.from(productOverlayOptionImagesInput.files || []);
            renderOverlayOptionImages();
            updateAdminPersonalizationPreview();
            updateSubmitButtonState();
        });
    }

    if (descriptionEditor) {
        descriptionEditor.addEventListener("input", syncDescriptionInput);
        descriptionEditor.addEventListener("blur", syncDescriptionInput);
    }

    if (descriptionToolbar) {
        descriptionToolbar.addEventListener("click", (event) => {
            const button = event.target.closest("[data-command]");

            if (!button) {
                return;
            }

            applyDescriptionCommand(button.dataset.command);
        });
    }

    if (descriptionBlockType) {
        descriptionBlockType.addEventListener("change", () => {
            const blockMap = {
                p: "P",
                h2: "H2",
                h3: "H3",
                blockquote: "BLOCKQUOTE"
            };

            applyDescriptionCommand("formatBlock", blockMap[descriptionBlockType.value] || "P");
        });
    }

    if (descriptionTextColor) {
        descriptionTextColor.addEventListener("input", () => {
            applyDescriptionCommand("foreColor", descriptionTextColor.value);
        });
    }

    if (productMediaPreview) {
        productMediaPreview.addEventListener("click", (event) => {
            const removeButton = event.target.closest(".admin-media-remove");

            if (!removeButton) {
                return;
            }

            const imageIndex = Number(removeButton.dataset.imageIndex);
            const imageSource = removeButton.dataset.imageSource;

            if (Number.isNaN(imageIndex)) {
                return;
            }

            if (imageSource === "selected") {
                selectedProductImageFiles = selectedProductImageFiles.filter((_, index) => index !== imageIndex);
            } else if (imageSource === "existing") {
                existingProductImages = existingProductImages.filter((_, index) => index !== imageIndex);
            }

            renderProductMediaPreview();
            updateSubmitButtonState();
        });
    }

    if (adminOverlayOptionsGrid) {
        adminOverlayOptionsGrid.addEventListener("click", (event) => {
            const removeButton = event.target.closest("[data-overlay-image-index]");

            if (!removeButton) {
                return;
            }

            const imageIndex = Number(removeButton.dataset.overlayImageIndex);

            if (Number.isNaN(imageIndex)) {
                return;
            }

            if (selectedOverlayOptionImageFiles.length) {
                selectedOverlayOptionImageFiles = selectedOverlayOptionImageFiles.filter((_, index) => index !== imageIndex);
            } else {
                existingOverlayOptionImages = existingOverlayOptionImages.filter((_, index) => index !== imageIndex);
            }

            renderOverlayOptionImages();
            updateAdminPersonalizationPreview();
            updateSubmitButtonState();
        });
    }

    productForm.addEventListener("input", (event) => {
        if (
            event.target.closest("#personalizationPreviewCard")
            || event.target.name === "personalizationRequireName"
            || event.target.name === "personalizationShowNameInput"
        ) {
            syncActivePreviewItemFromForm();
            updatePersonalizationPreviewVisibility();
            updateAdminPersonalizationPreview();
        }
    });

    productForm.addEventListener("change", (event) => {
        if (
            event.target.closest("#personalizationPreviewCard")
            || event.target.name === "personalizationRequireName"
            || event.target.name === "personalizationShowNameInput"
        ) {
            syncActivePreviewItemFromForm();
            updatePersonalizationPreviewVisibility();
            updateAdminPersonalizationPreview();
        }
    });

    productForm.addEventListener("input", updateSubmitButtonState);
    productForm.addEventListener("change", updateSubmitButtonState);

    productForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (productSaveRequestInFlight) {
            return;
        }

        clearFeedback();
        productSaveRequestInFlight = true;
        setButtonLoading(submitButton, true, editingProductId ? "Salvando..." : "Criando...");

        try {
            const wasEditing = Boolean(editingProductId);
            const payload = getFormPayload(productForm);
            await saveProduct(payload);
            productSaveRequestInFlight = false;
            setButtonLoading(submitButton, false, wasEditing ? "Salvando..." : "Criando...");
            showFeedback(wasEditing ? "Produto atualizado com sucesso." : "Produto criado com sucesso.", "success");
            await loadProducts();
            navigateAdmin("/admin", { replace: true });
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            if (productSaveRequestInFlight) {
                productSaveRequestInFlight = false;
                setButtonLoading(submitButton, false, editingProductId ? "Salvando..." : "Criando...");
            }
        }
    });

    tableBody.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action]");

        if (!button) {
            return;
        }

        const { action, id } = button.dataset;
        const selectedProduct = productsState.find((product) => product._id === id);

        if (!selectedProduct) {
            return;
        }

        if (action === "edit") {
            navigateAdmin(`/admin/products/${selectedProduct._id}/edit`);
            return;
        }

        if (action === "copy-link") {
            try {
                await copyProductLink(selectedProduct);
            } catch (error) {
                showFeedback(error.message, "error");
            }
            return;
        }

        if (action === "delete") {
            if (productDeleteRequestInFlight) {
                return;
            }

            const shouldDelete = window.confirm(`Deseja excluir o produto "${selectedProduct.name}"?`);

            if (!shouldDelete) {
                return;
            }

            try {
                productDeleteRequestInFlight = true;
                setButtonLoading(button, true, "Excluindo...");
                await removeProduct(id);
                showFeedback("Produto excluído com sucesso.", "success");

                if (editingProductId === id) {
                    navigateAdmin("/admin", { replace: true });
                }

                await loadProducts();
            } catch (error) {
                showFeedback(error.message, "error");
            } finally {
                productDeleteRequestInFlight = false;
                setButtonLoading(button, false, "Excluindo...");
            }
        }
    });
}
