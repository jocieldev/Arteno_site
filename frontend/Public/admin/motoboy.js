const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const feedbackBox = document.getElementById("motoboyFeedback");
const motoboyForm = document.getElementById("motoboyForm");
const saveButton = document.getElementById("motoboySaveButton");
const sameDayEnabledInput = document.getElementById("motoboySameDayEnabled");
const sameDayCutoffTimeInput = document.getElementById("motoboySameDayCutoffTime");
const originStateInput = document.getElementById("motoboyOriginState");
let saveRequestInFlight = false;

function setButtonLoading(button, isLoading, loadingText) {
    if (!(button instanceof HTMLElement)) {
        return;
    }

    if (isLoading) {
        if (!button.dataset.originalHtml) {
            button.dataset.originalHtml = button.innerHTML;
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
    button.disabled = false;

    if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
    }
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

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(value || 0));
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(parsedDate);
}

function normalizeZipCode(value = "") {
    return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function applyZipMask(value = "") {
    const digits = normalizeZipCode(value);
    return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function getCheckedOperatingDays() {
    return Array.from(document.querySelectorAll('.motoboy-day-pill input[type="checkbox"]:checked'))
        .map((input) => input.value);
}

function syncSameDayControls() {
    if (!(sameDayCutoffTimeInput instanceof HTMLInputElement) || !(sameDayEnabledInput instanceof HTMLInputElement)) {
        return;
    }

    sameDayCutoffTimeInput.disabled = !sameDayEnabledInput.checked;

    if (!sameDayEnabledInput.checked) {
        sameDayCutoffTimeInput.value = "";
    }
}

function renderStatus(settings) {
    document.getElementById("motoboyStatusLabel").textContent = settings.enabled
        ? (settings.isReady ? "Ativo e pronto" : "Ativo, aguardando origem válida")
        : "Desativado";
    document.getElementById("motoboyOriginResolved").textContent = settings.coordinates?.resolvedAddress || settings.originLabel || "-";
    document.getElementById("motoboyCoordinates").textContent = settings.coordinates?.latitude && settings.coordinates?.longitude
        ? `${Number(settings.coordinates.latitude).toFixed(5)}, ${Number(settings.coordinates.longitude).toFixed(5)}`
        : "-";
    document.getElementById("motoboyMaxDistance").textContent = settings.maxDistanceKm ? `${Number(settings.maxDistanceKm).toFixed(1)} km` : "-";
    document.getElementById("motoboyPricePerKmStatus").textContent = formatCurrency(settings.pricePerKm || 0);
    document.getElementById("motoboyUpdatedAt").textContent = formatDateTime(settings.updatedAt);
}

function fillForm(settings) {
    document.getElementById("motoboyEnabled").checked = Boolean(settings.enabled);
    document.getElementById("motoboyServiceName").value = settings.serviceName || "";
    document.getElementById("motoboyCompanyName").value = settings.companyName || "";
    document.getElementById("motoboyOriginZipCode").value = applyZipMask(settings.origin?.zipCode || "");
    document.getElementById("motoboyOriginStreet").value = settings.origin?.street || "";
    document.getElementById("motoboyOriginNumber").value = settings.origin?.number || "";
    document.getElementById("motoboyOriginNeighborhood").value = settings.origin?.neighborhood || "";
    document.getElementById("motoboyOriginCity").value = settings.origin?.city || "";
    document.getElementById("motoboyOriginState").value = settings.origin?.state || "";
    document.getElementById("motoboyPricePerKm").value = settings.pricePerKm || 0;
    document.getElementById("motoboyMinimumFee").value = settings.minimumFee || 0;
    document.getElementById("motoboyMaxDistanceKm").value = settings.maxDistanceKm || 0;
    document.getElementById("motoboyMinimumOrderSubtotal").value = settings.minimumOrderSubtotal || 0;
    document.getElementById("motoboyDispatchDays").value = settings.dispatchDaysAfterReady || 0;
    document.getElementById("motoboyTransitDays").value = settings.transitDays || 1;
    document.getElementById("motoboyEstimatedHours").value = settings.estimatedDeliveryHours || 4;
    document.getElementById("motoboySameDayEnabled").checked = Boolean(settings.sameDayEnabled);
    document.getElementById("motoboySameDayCutoffTime").value = settings.sameDayCutoffTime || "";

    const enabledDays = new Set(Array.isArray(settings.operatingDays) ? settings.operatingDays : []);
    document.querySelectorAll('.motoboy-day-pill input[type="checkbox"]').forEach((input) => {
        input.checked = enabledDays.has(input.value);
    });

    syncSameDayControls();
}

function buildPayload() {
    return {
        enabled: document.getElementById("motoboyEnabled").checked,
        serviceName: document.getElementById("motoboyServiceName").value.trim(),
        companyName: document.getElementById("motoboyCompanyName").value.trim(),
        origin: {
            zipCode: normalizeZipCode(document.getElementById("motoboyOriginZipCode").value),
            street: document.getElementById("motoboyOriginStreet").value.trim(),
            number: document.getElementById("motoboyOriginNumber").value.trim(),
            neighborhood: document.getElementById("motoboyOriginNeighborhood").value.trim(),
            city: document.getElementById("motoboyOriginCity").value.trim(),
            state: document.getElementById("motoboyOriginState").value.trim().toUpperCase()
        },
        pricePerKm: document.getElementById("motoboyPricePerKm").value,
        minimumFee: document.getElementById("motoboyMinimumFee").value,
        maxDistanceKm: document.getElementById("motoboyMaxDistanceKm").value,
        minimumOrderSubtotal: document.getElementById("motoboyMinimumOrderSubtotal").value,
        dispatchDaysAfterReady: document.getElementById("motoboyDispatchDays").value,
        transitDays: document.getElementById("motoboyTransitDays").value,
        estimatedDeliveryHours: document.getElementById("motoboyEstimatedHours").value,
        sameDayEnabled: document.getElementById("motoboySameDayEnabled").checked,
        sameDayCutoffTime: document.getElementById("motoboySameDayCutoffTime").value,
        operatingDays: getCheckedOperatingDays()
    };
}

async function loadMotoboySettings() {
    clearFeedback();

    const response = await fetch("/api/admin/motoboy/settings", {
        credentials: "same-origin"
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar a configuração do motoboy.");
    }

    fillForm(result);
    renderStatus(result);
}

async function saveMotoboySettings(event) {
    event.preventDefault();

    if (saveRequestInFlight) {
        return;
    }

    saveRequestInFlight = true;
    setButtonLoading(saveButton, true, "Salvando...");
    clearFeedback();

    try {
        const response = await fetch("/api/admin/motoboy/settings", {
            method: "PUT",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(buildPayload())
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Não foi possível salvar o motoboy.");
        }

        fillForm(result.settings);
        renderStatus(result.settings);
        showFeedback(result.message || "Configuração salva com sucesso.", "success");
    } catch (error) {
        showFeedback(error.message || "Não foi possível salvar o motoboy.", "error");
    } finally {
        saveRequestInFlight = false;
        setButtonLoading(saveButton, false, "Salvando...");
    }
}

if (motoboyForm) {
    motoboyForm.addEventListener("submit", saveMotoboySettings);
}

const zipInput = document.getElementById("motoboyOriginZipCode");

if (zipInput) {
    zipInput.addEventListener("input", () => {
        zipInput.value = applyZipMask(zipInput.value);
    });
}

if (sameDayEnabledInput) {
    sameDayEnabledInput.addEventListener("change", syncSameDayControls);
}

if (originStateInput) {
    originStateInput.addEventListener("input", () => {
        originStateInput.value = String(originStateInput.value || "").toUpperCase().slice(0, 2);
    });
}

loadMotoboySettings().catch((error) => showFeedback(error.message, "error"));
