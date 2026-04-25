const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const feedbackBox = document.getElementById("siteSettingsFeedback");
const siteBannerForm = document.getElementById("siteBannerForm");
const siteContactForm = document.getElementById("siteContactForm");
const siteBannersGrid = document.getElementById("siteBannersGrid");
const siteBannersEmptyState = document.getElementById("siteBannersEmptyState");
const siteBannerIdInput = document.getElementById("siteBannerId");
const siteBannerNameInput = document.getElementById("siteBannerName");
const siteBannerDesktopImageInput = document.getElementById("siteBannerDesktopImage");
const siteBannerMobileImageInput = document.getElementById("siteBannerMobileImage");
const siteBannerDesktopPreview = document.getElementById("siteBannerDesktopPreview");
const siteBannerMobilePreview = document.getElementById("siteBannerMobilePreview");
const siteBannerLinkUrlInput = document.getElementById("siteBannerLinkUrl");
const siteBannerSubmitButton = document.getElementById("siteBannerSubmitButton");
const siteBannerCancelButton = document.getElementById("siteBannerCancelButton");
const siteWhatsappNumberInput = document.getElementById("siteWhatsappNumber");
const siteContactEmailInput = document.getElementById("siteContactEmail");
const siteInstagramUrlInput = document.getElementById("siteInstagramUrl");
const siteContactSubmitButton = document.getElementById("siteContactSubmitButton");
const siteCardSettingsForm = document.getElementById("siteCardSettingsForm");
const cardSettingsEnabledInput = document.getElementById("cardSettingsEnabled");
const cardSettingsMaxInstallmentsInput = document.getElementById("cardSettingsMaxInstallments");
const cardSettingsDefaultInterestFreeInstallmentsInput = document.getElementById("cardSettingsDefaultInterestFreeInstallments");
const cardPromoRulesList = document.getElementById("cardPromoRulesList");
const cardPromoAddRuleButton = document.getElementById("cardPromoAddRuleButton");
const siteCardSettingsSubmitButton = document.getElementById("siteCardSettingsSubmitButton");

let bannersState = [];
let editingBanner = null;
let bannerSaveRequestInFlight = false;
let bannerDeleteRequestInFlight = false;
let contactSaveRequestInFlight = false;
let cardSettingsSaveRequestInFlight = false;
let cardPromoRulesState = [];

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

function openAdminSidebar() {
    document.body.classList.add("sidebar-open");
}

function closeAdminSidebar() {
    document.body.classList.remove("sidebar-open");
}

if (adminMobileMenuButton) {
    adminMobileMenuButton.addEventListener("click", openAdminSidebar);
}

if (adminSidebarClose) {
    adminSidebarClose.addEventListener("click", closeAdminSidebar);
}

if (adminMobileOverlay) {
    adminMobileOverlay.addEventListener("click", closeAdminSidebar);
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

    feedbackBox.hidden = false;
    feedbackBox.textContent = message;
    feedbackBox.className = `admin-feedback admin-products-feedback ${type}`;
}

function clearFeedback() {
    if (!feedbackBox) {
        return;
    }

    feedbackBox.hidden = true;
    feedbackBox.textContent = "";
    feedbackBox.className = "admin-feedback admin-products-feedback";
}

function normalizeCurrency(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? Number(normalized.toFixed(2)) : fallback;
}

function normalizePositiveInteger(value, fallback = 1, min = 1, max = 24) {
    const normalized = Number.parseInt(value, 10);

    if (!Number.isInteger(normalized)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, normalized));
}

function createEmptyCardPromoRule(index = 0) {
    return {
        id: `rule-${Date.now()}-${index}`,
        name: "",
        enabled: true,
        minimumAmount: 0,
        maximumAmount: 0,
        interestFreeInstallments: 1
    };
}

function renderCardPromoRules() {
    if (!cardPromoRulesList) {
        return;
    }

    if (!cardPromoRulesState.length) {
        cardPromoRulesList.innerHTML = `
            <div class="admin-empty-state">
                Nenhuma regra cadastrada. Use "Adicionar regra" para criar promocoes por valor.
            </div>
        `;
        return;
    }

    cardPromoRulesList.innerHTML = cardPromoRulesState.map((rule, index) => `
        <article class="admin-card-rule-item" data-card-rule-id="${escapeHtml(rule.id)}">
            <div class="admin-card-rule-grid">
                <label class="admin-auth-field">
                    <span>Nome da regra</span>
                    <input type="text" data-card-rule-field="name" value="${escapeHtml(rule.name || `Regra ${index + 1}`)}" placeholder="Ex: Acima de R$ 200">
                </label>

                <label class="admin-auth-field">
                    <span>Valor minimo (R$)</span>
                    <input type="number" step="0.01" min="0" data-card-rule-field="minimumAmount" value="${escapeHtml(rule.minimumAmount || 0)}">
                </label>

                <label class="admin-auth-field">
                    <span>Valor maximo (R$)</span>
                    <input type="number" step="0.01" min="0" data-card-rule-field="maximumAmount" value="${escapeHtml(rule.maximumAmount || 0)}">
                    <small class="admin-field-help">Deixe 0 para sem limite maximo.</small>
                </label>

                <label class="admin-auth-field">
                    <span>Parcelas sem juros</span>
                    <input type="number" min="1" max="24" data-card-rule-field="interestFreeInstallments" value="${escapeHtml(rule.interestFreeInstallments || 1)}">
                </label>

                <button type="button" class="admin-secondary-button admin-card-rule-remove" data-card-rule-action="remove">Remover</button>
            </div>

            <label class="admin-auth-field admin-checkbox-field">
                <span>
                    <input type="checkbox" data-card-rule-field="enabled" ${rule.enabled !== false ? "checked" : ""}>
                    Regra ativa
                </span>
            </label>
        </article>
    `).join("");
}

function fillCardSettingsForm(cardSettings = {}) {
    if (cardSettingsEnabledInput) {
        cardSettingsEnabledInput.checked = cardSettings.enabled !== false;
    }

    if (cardSettingsMaxInstallmentsInput) {
        cardSettingsMaxInstallmentsInput.value = String(cardSettings.maxInstallments || 12);
    }

    if (cardSettingsDefaultInterestFreeInstallmentsInput) {
        cardSettingsDefaultInterestFreeInstallmentsInput.value = String(cardSettings.defaultInterestFreeInstallments || 1);
    }

    cardPromoRulesState = Array.isArray(cardSettings.promoRules)
        ? cardSettings.promoRules.map((rule = {}, index = 0) => ({
            id: String(rule.id || rule._id || `rule-${Date.now()}-${index}`),
            name: String(rule.name || ""),
            enabled: rule.enabled !== false,
            minimumAmount: normalizeCurrency(rule.minimumAmount, 0),
            maximumAmount: normalizeCurrency(rule.maximumAmount, 0),
            interestFreeInstallments: normalizePositiveInteger(rule.interestFreeInstallments, 1, 1, 24)
        }))
        : [];

    renderCardPromoRules();
}

function collectCardSettingsPayload() {
    return {
        enabled: Boolean(cardSettingsEnabledInput?.checked),
        maxInstallments: normalizePositiveInteger(cardSettingsMaxInstallmentsInput?.value, 12, 1, 24),
        defaultInterestFreeInstallments: normalizePositiveInteger(cardSettingsDefaultInterestFreeInstallmentsInput?.value, 1, 1, 24),
        promoRules: cardPromoRulesState.map((rule = {}, index = 0) => ({
            name: String(rule.name || `Regra ${index + 1}`).trim(),
            enabled: Boolean(rule.enabled !== false),
            minimumAmount: normalizeCurrency(rule.minimumAmount, 0),
            maximumAmount: normalizeCurrency(rule.maximumAmount, 0),
            interestFreeInstallments: normalizePositiveInteger(rule.interestFreeInstallments, 1, 1, 24)
        }))
    };
}

function renderPreview(previewElement, imageUrl, emptyLabel) {
    if (!previewElement) {
        return;
    }

    if (!imageUrl) {
        previewElement.innerHTML = `
            <div class="admin-site-banner-preview-empty">
                <i class="fa-regular fa-image"></i>
                <span>${emptyLabel}</span>
            </div>
        `;
        return;
    }

    previewElement.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(emptyLabel)}">`;
}

function updateBannerPreviews() {
    const desktopFile = siteBannerDesktopImageInput?.files?.[0] || null;
    const mobileFile = siteBannerMobileImageInput?.files?.[0] || null;
    const desktopPreviewUrl = desktopFile
        ? URL.createObjectURL(desktopFile)
        : (editingBanner?.desktopImageUrl || editingBanner?.imageUrl || "");
    const mobilePreviewUrl = mobileFile
        ? URL.createObjectURL(mobileFile)
        : (editingBanner?.mobileImageUrl || editingBanner?.desktopImageUrl || editingBanner?.imageUrl || "");

    renderPreview(siteBannerDesktopPreview, desktopPreviewUrl, "Preview desktop");
    renderPreview(siteBannerMobilePreview, mobilePreviewUrl, "Preview mobile");
}

function resetBannerForm() {
    siteBannerForm.reset();
    siteBannerIdInput.value = "";
    editingBanner = null;
    siteBannerSubmitButton.textContent = "Adicionar banner";
    siteBannerDesktopImageInput.required = false;
    siteBannerMobileImageInput.required = false;
    siteBannerLinkUrlInput.value = "";
    siteBannerCancelButton.hidden = true;
    updateBannerPreviews();
}

function startBannerEdit(banner) {
    editingBanner = banner;
    siteBannerIdInput.value = banner.id || "";
    siteBannerNameInput.value = banner.name || "";
    siteBannerLinkUrlInput.value = banner.linkUrl || "";
    siteBannerSubmitButton.textContent = "Salvar banner";
    siteBannerDesktopImageInput.required = false;
    siteBannerMobileImageInput.required = false;
    siteBannerCancelButton.hidden = false;
    updateBannerPreviews();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderBanners() {
    if (!siteBannersGrid || !siteBannersEmptyState) {
        return;
    }

    if (!bannersState.length) {
        siteBannersGrid.innerHTML = "";
        siteBannersEmptyState.hidden = false;
        return;
    }

    siteBannersEmptyState.hidden = true;
    siteBannersGrid.innerHTML = bannersState.map((banner) => `
        <article class="admin-site-banner-card">
            <div class="admin-site-banner-thumbs">
                <img src="${escapeHtml(banner.desktopImageUrl || banner.imageUrl || "")}" alt="${escapeHtml(banner.name || "Banner desktop")}" class="admin-site-banner-image">
                <img src="${escapeHtml(banner.mobileImageUrl || banner.desktopImageUrl || banner.imageUrl || "")}" alt="${escapeHtml(banner.name || "Banner mobile")}" class="admin-site-banner-image admin-site-banner-image-mobile">
            </div>
            <div class="admin-site-banner-content">
                <strong>${escapeHtml(banner.name || "Banner sem nome")}</strong>
                <span>${escapeHtml(banner.linkUrl || "Sem link")}</span>
                <small>${banner.mobileImageUrl ? "Desktop + mobile configurados" : "Somente desktop configurado"}</small>
                <div class="admin-site-banner-actions">
                    <button type="button" class="admin-table-action" data-banner-action="edit" data-banner-id="${escapeHtml(banner.id || "")}">Editar</button>
                    <button type="button" class="admin-table-action delete" data-banner-action="delete" data-banner-id="${escapeHtml(banner.id || "")}">Excluir</button>
                </div>
            </div>
        </article>
    `).join("");
}

async function loadBanners() {
    clearFeedback();

    const response = await fetch("/api/admin/site-settings/banners", {
        credentials: "same-origin"
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar os banners.");
    }

    bannersState = Array.isArray(result.banners) ? result.banners : [];
    renderBanners();
}

function fillContactForm(contact = {}) {
    if (siteWhatsappNumberInput) {
        siteWhatsappNumberInput.value = contact.whatsappNumber || "";
    }

    if (siteContactEmailInput) {
        siteContactEmailInput.value = contact.email || "";
    }

    if (siteInstagramUrlInput) {
        siteInstagramUrlInput.value = contact.instagramUrl || "";
    }
}

async function loadSiteContact() {
    const response = await fetch("/api/admin/site-settings/contact", {
        credentials: "same-origin"
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar os contatos do site.");
    }

    fillContactForm(result.contact || {});
}

async function loadCardSettings() {
    const response = await fetch("/api/admin/site-settings/card-settings", {
        credentials: "same-origin"
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Nao foi possivel carregar as configuracoes de cartao.");
    }

    fillCardSettingsForm(result.cardSettings || {});
}

async function saveSiteContact(payload) {
    const response = await fetch("/api/admin/site-settings/contact", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível salvar os contatos do site.");
    }

    fillContactForm(result.contact || {});
    return result;
}

async function saveCardSettings(payload) {
    const response = await fetch("/api/admin/site-settings/card-settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Nao foi possivel salvar as configuracoes de cartao.");
    }

    fillCardSettingsForm(result.cardSettings || {});
    return result;
}

async function saveBanner(formData, bannerId) {
    const response = await fetch(bannerId ? `/api/admin/site-settings/banners/${encodeURIComponent(bannerId)}` : "/api/admin/site-settings/banners", {
        method: bannerId ? "PUT" : "POST",
        credentials: "same-origin",
        body: formData
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível salvar o banner.");
    }

    bannersState = Array.isArray(result.banners) ? result.banners : [];
    renderBanners();
    return result;
}

async function deleteBanner(bannerId) {
    const response = await fetch(`/api/admin/site-settings/banners/${encodeURIComponent(bannerId)}`, {
        method: "DELETE",
        credentials: "same-origin"
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível excluir o banner.");
    }

    bannersState = Array.isArray(result.banners) ? result.banners : [];
    renderBanners();
    return result;
}

if (siteBannerCancelButton) {
    siteBannerCancelButton.addEventListener("click", () => {
        resetBannerForm();
        clearFeedback();
    });
}

if (siteContactForm) {
    siteContactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (contactSaveRequestInFlight) {
            return;
        }

        clearFeedback();
        contactSaveRequestInFlight = true;
        setButtonLoading(siteContactSubmitButton, true, "Salvando...");

        try {
            const result = await saveSiteContact({
                whatsappNumber: siteWhatsappNumberInput?.value || "",
                email: siteContactEmailInput?.value || "",
                instagramUrl: siteInstagramUrlInput?.value || ""
            });

            contactSaveRequestInFlight = false;
            setButtonLoading(siteContactSubmitButton, false, "Salvando...");
            showFeedback(result.message || "Contatos atualizados com sucesso.", "success");
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            if (contactSaveRequestInFlight) {
                contactSaveRequestInFlight = false;
                setButtonLoading(siteContactSubmitButton, false, "Salvando...");
            }
        }
    });
}

if (cardPromoAddRuleButton) {
    cardPromoAddRuleButton.addEventListener("click", () => {
        cardPromoRulesState.push(createEmptyCardPromoRule(cardPromoRulesState.length));
        renderCardPromoRules();
    });
}

if (cardPromoRulesList) {
    cardPromoRulesList.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
            return;
        }

        const ruleElement = target.closest("[data-card-rule-id]");
        const ruleId = String(ruleElement?.getAttribute("data-card-rule-id") || "");
        const ruleIndex = cardPromoRulesState.findIndex((rule) => String(rule.id) === ruleId);

        if (ruleIndex === -1) {
            return;
        }

        const field = target.getAttribute("data-card-rule-field");

        if (field === "name") {
            cardPromoRulesState[ruleIndex].name = target.value;
            return;
        }

        if (field === "minimumAmount") {
            cardPromoRulesState[ruleIndex].minimumAmount = normalizeCurrency(target.value, 0);
            return;
        }

        if (field === "maximumAmount") {
            cardPromoRulesState[ruleIndex].maximumAmount = normalizeCurrency(target.value, 0);
            return;
        }

        if (field === "interestFreeInstallments") {
            cardPromoRulesState[ruleIndex].interestFreeInstallments = normalizePositiveInteger(target.value, 1, 1, 24);
        }
    });

    cardPromoRulesList.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
            return;
        }

        const ruleElement = target.closest("[data-card-rule-id]");
        const ruleId = String(ruleElement?.getAttribute("data-card-rule-id") || "");
        const ruleIndex = cardPromoRulesState.findIndex((rule) => String(rule.id) === ruleId);

        if (ruleIndex === -1) {
            return;
        }

        const field = target.getAttribute("data-card-rule-field");
        if (field === "enabled") {
            cardPromoRulesState[ruleIndex].enabled = target.checked;
        }
    });

    cardPromoRulesList.addEventListener("click", (event) => {
        const target = event.target.closest("[data-card-rule-action]");
        if (!target) {
            return;
        }

        const action = target.getAttribute("data-card-rule-action");
        if (action !== "remove") {
            return;
        }

        const ruleElement = target.closest("[data-card-rule-id]");
        const ruleId = String(ruleElement?.getAttribute("data-card-rule-id") || "");
        cardPromoRulesState = cardPromoRulesState.filter((rule) => String(rule.id) !== ruleId);
        renderCardPromoRules();
    });
}

if (siteCardSettingsForm) {
    siteCardSettingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (cardSettingsSaveRequestInFlight) {
            return;
        }

        clearFeedback();
        cardSettingsSaveRequestInFlight = true;
        setButtonLoading(siteCardSettingsSubmitButton, true, "Salvando...");

        try {
            const result = await saveCardSettings(collectCardSettingsPayload());
            cardSettingsSaveRequestInFlight = false;
            setButtonLoading(siteCardSettingsSubmitButton, false, "Salvando...");
            showFeedback(result.message || "Configuracoes de cartao atualizadas com sucesso.", "success");
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            if (cardSettingsSaveRequestInFlight) {
                cardSettingsSaveRequestInFlight = false;
                setButtonLoading(siteCardSettingsSubmitButton, false, "Salvando...");
            }
        }
    });
}

if (siteBannerDesktopImageInput) {
    siteBannerDesktopImageInput.addEventListener("change", updateBannerPreviews);
}

if (siteBannerMobileImageInput) {
    siteBannerMobileImageInput.addEventListener("change", updateBannerPreviews);
}

if (siteBannerForm) {
    siteBannerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (bannerSaveRequestInFlight) {
            return;
        }

        clearFeedback();

        const bannerId = String(siteBannerIdInput.value || "").trim();
        const formData = new FormData(siteBannerForm);

        if (!bannerId && !siteBannerDesktopImageInput.files?.length) {
            showFeedback("Selecione a imagem desktop para criar o banner.", "error");
            return;
        }

        bannerSaveRequestInFlight = true;
        setButtonLoading(siteBannerSubmitButton, true, bannerId ? "Salvando..." : "Adicionando...");

        try {
            const result = await saveBanner(formData, bannerId);
            bannerSaveRequestInFlight = false;
            setButtonLoading(siteBannerSubmitButton, false, bannerId ? "Salvando..." : "Adicionando...");
            resetBannerForm();
            showFeedback(result.message || "Banner salvo com sucesso.", "success");
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            if (bannerSaveRequestInFlight) {
                bannerSaveRequestInFlight = false;
                setButtonLoading(siteBannerSubmitButton, false, bannerId ? "Salvando..." : "Adicionando...");
            }
        }
    });
}

if (siteBannersGrid) {
    siteBannersGrid.addEventListener("click", async (event) => {
        const actionButton = event.target.closest("[data-banner-action]");

        if (!actionButton) {
            return;
        }

        const bannerId = String(actionButton.dataset.bannerId || "");
        const action = actionButton.dataset.bannerAction;
        const selectedBanner = bannersState.find((banner) => banner.id === bannerId);

        if (!selectedBanner) {
            return;
        }

        if (action === "edit") {
            startBannerEdit(selectedBanner);
            return;
        }

        if (action === "delete") {
            if (bannerDeleteRequestInFlight) {
                return;
            }

            const shouldDelete = window.confirm(`Deseja excluir o banner "${selectedBanner.name || "Banner"}"?`);

            if (!shouldDelete) {
                return;
            }

            try {
                bannerDeleteRequestInFlight = true;
                setButtonLoading(actionButton, true, "Excluindo...");
                const result = await deleteBanner(bannerId);
                if (siteBannerIdInput.value === bannerId) {
                    resetBannerForm();
                }
                showFeedback(result.message || "Banner excluído com sucesso.", "success");
            } catch (error) {
                showFeedback(error.message, "error");
            } finally {
                bannerDeleteRequestInFlight = false;
                setButtonLoading(actionButton, false, "Excluindo...");
            }
        }
    });
}

Promise.all([loadSiteContact(), loadCardSettings(), loadBanners()]).catch((error) => {
    showFeedback(error.message, "error");
});

updateBannerPreviews();
