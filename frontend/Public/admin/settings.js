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

let bannersState = [];
let editingBanner = null;
let bannerSaveRequestInFlight = false;
let bannerDeleteRequestInFlight = false;
let contactSaveRequestInFlight = false;

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

Promise.all([loadSiteContact(), loadBanners()]).catch((error) => {
    showFeedback(error.message, "error");
});

updateBannerPreviews();
