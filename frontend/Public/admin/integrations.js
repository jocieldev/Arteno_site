const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const feedbackBox = document.getElementById("integrationFeedback");
const connectButton = document.getElementById("melhorEnvioConnectButton");
const disconnectButton = document.getElementById("melhorEnvioDisconnectButton");
let disconnectRequestInFlight = false;

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

function setChecklistState(elementId, isReady) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.classList.toggle("is-ready", Boolean(isReady));
    element.classList.toggle("is-missing", !isReady);
}

function renderStatus(status) {
    document.getElementById("melhorEnvioEnvironment").textContent = status.useSandbox ? "Sandbox" : "Produção";
    document.getElementById("melhorEnvioConnectionState").textContent = status.isConnected ? "Conectado" : "Não conectado";
    document.getElementById("melhorEnvioAccountInfo").textContent = status.connectedAccountEmail || status.connectedAccountName || "-";
    document.getElementById("melhorEnvioOriginZip").textContent = status.fromPostalCode || "-";
    document.getElementById("melhorEnvioRedirectUri").textContent = status.redirectUri || "-";
    document.getElementById("melhorEnvioWebhookUrl").textContent = status.webhookUrl || `${window.location.origin}/api/integrations/melhor-envio/webhook`;
    document.getElementById("melhorEnvioScope").textContent = status.scope || "-";
    document.getElementById("melhorEnvioExpiresAt").textContent = formatDateTime(status.expiresAt);

    setChecklistState("melhorEnvioClientCheck", status.hasClientCredentials);
    setChecklistState("melhorEnvioRedirectCheck", status.hasRedirectUri);
    setChecklistState("melhorEnvioOriginCheck", status.hasOriginPostalCode);
    setChecklistState("melhorEnvioScopeCheck", status.hasRequiredScopes);
    setChecklistState("melhorEnvioWebhookCheck", status.hasWebhookSecret || Boolean(status.webhookUrl));

    const canConnect = status.hasClientCredentials && status.hasRedirectUri && status.hasOriginPostalCode;

    if (connectButton) {
        connectButton.classList.toggle("is-disabled", !canConnect);
        connectButton.setAttribute("aria-disabled", String(!canConnect));
    }

    if (disconnectButton) {
        disconnectButton.disabled = !status.isConnected;
    }
}

async function loadStatus() {
    clearFeedback();

    const response = await fetch("/api/admin/integrations/melhor-envio/status", {
        credentials: "same-origin"
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar a integração.");
    }

    renderStatus(result);
}

if (connectButton) {
    connectButton.addEventListener("click", (event) => {
        if (connectButton.getAttribute("aria-disabled") === "true") {
            event.preventDefault();
            showFeedback("Preencha primeiro Client ID, Secret, Redirect URI e CEP de origem no .env.", "error");
        }
    });
}

if (disconnectButton) {
    disconnectButton.addEventListener("click", async () => {
        if (disconnectRequestInFlight) {
            return;
        }

        disconnectRequestInFlight = true;
        setButtonLoading(disconnectButton, true, "Desconectando...");

        try {
            const response = await fetch("/api/admin/integrations/melhor-envio/disconnect", {
                method: "DELETE",
                credentials: "same-origin"
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível desconectar.");
            }

            disconnectRequestInFlight = false;
            setButtonLoading(disconnectButton, false, "Desconectando...");
            showFeedback(result.message || "Integração desconectada.", "success");
            await loadStatus();
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            if (disconnectRequestInFlight) {
                disconnectRequestInFlight = false;
                setButtonLoading(disconnectButton, false, "Desconectando...");
            }
        }
    });
}

const params = new URLSearchParams(window.location.search);

if (params.get("success") === "connected") {
    showFeedback("Conta do Melhor Envio conectada com sucesso. Se alterou escopos, reconecte para renovar as permissoes.", "success");
} else if (params.get("error")) {
    showFeedback(decodeURIComponent(params.get("error")), "error");
}

loadStatus().catch((error) => showFeedback(error.message, "error"));
