const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const messagesFeedbackBox = document.getElementById("adminMessagesFeedback");
const messagesEmptyState = document.getElementById("adminMessagesEmptyState");
const messagesTableWrap = document.getElementById("adminMessagesTableWrap");
const messagesTableBody = document.getElementById("adminMessagesTableBody");
const messageModal = document.getElementById("adminMessageModal");
const messageModalOverlay = document.getElementById("adminMessageModalOverlay");
const messageModalClose = document.getElementById("adminMessageModalClose");
const messageModalTitle = document.getElementById("adminMessageModalTitle");
const messageModalEmail = document.getElementById("adminMessageModalEmail");
const messageModalDate = document.getElementById("adminMessageModalDate");
const messageModalStatus = document.getElementById("adminMessageModalStatus");
const messageModalBody = document.getElementById("adminMessageModalBody");
const messageToggleReadButton = document.getElementById("adminMessageToggleReadButton");

let messageDeleteRequestInFlight = false;
let messageStatusRequestInFlight = false;
let selectedMessageId = "";
let messagesState = [];

if (messageModalOverlay) {
    messageModalOverlay.hidden = true;
}

if (messageModal) {
    messageModal.setAttribute("aria-hidden", "true");
}

function openAdminSidebar() {
    document.body.classList.add("sidebar-open");
}

function closeAdminSidebar() {
    document.body.classList.remove("sidebar-open");
}

function clearFeedback() {
    if (!messagesFeedbackBox) {
        return;
    }

    messagesFeedbackBox.hidden = true;
    messagesFeedbackBox.textContent = "";
    messagesFeedbackBox.className = "admin-feedback admin-products-feedback";
}

function showFeedback(message, type = "success") {
    if (!messagesFeedbackBox) {
        return;
    }

    messagesFeedbackBox.hidden = false;
    messagesFeedbackBox.textContent = message;
    messagesFeedbackBox.className = `admin-feedback admin-products-feedback ${type}`;
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(date);
}

function getMessageStatusMeta(status) {
    return status === "read"
        ? { label: "Lida", className: "read" }
        : { label: "Nova", className: "new" };
}

function renderStatusBadge(status) {
    const statusMeta = getMessageStatusMeta(status);
    return `<span class="admin-message-status-badge ${statusMeta.className}">${statusMeta.label}</span>`;
}

function updateUnreadBadge() {
    window.dispatchEvent(new CustomEvent("admin:messages-updated"));
}

function renderMessages(messages) {
    if (!messagesTableBody || !messagesEmptyState || !messagesTableWrap) {
        return;
    }

    messagesState = Array.isArray(messages) ? messages : [];

    if (!messagesState.length) {
        messagesTableBody.innerHTML = "";
        messagesEmptyState.hidden = false;
        messagesTableWrap.hidden = true;
        updateUnreadBadge();
        return;
    }

    messagesEmptyState.hidden = true;
    messagesTableWrap.hidden = false;
    messagesTableBody.innerHTML = messagesState.map((message) => {
        const statusActionLabel = message.status === "read" ? "Marcar como nova" : "Marcar como lida";

        return `
            <tr data-message-id="${escapeHtml(message.id || "")}" class="${message.status === "read" ? "is-read" : "is-new"}">
                <td data-label="Nome">
                    <div class="admin-product-name">${escapeHtml(message.name || "-")}</div>
                </td>
                <td data-label="Email">
                    <div class="admin-product-desc">${escapeHtml(message.email || "-")}</div>
                </td>
                <td data-label="Data">${escapeHtml(formatDateTime(message.createdAt))}</td>
                <td data-label="Status">${renderStatusBadge(message.status)}</td>
                <td data-label="Ações">
                    <div class="admin-table-actions">
                        <button type="button" class="admin-table-action" data-action="view" data-id="${escapeHtml(message.id || "")}">Ver mensagem</button>
                        <button type="button" class="admin-table-action" data-action="toggle-status" data-id="${escapeHtml(message.id || "")}">${statusActionLabel}</button>
                        <button type="button" class="admin-table-action delete" data-action="delete" data-id="${escapeHtml(message.id || "")}">Excluir</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    updateUnreadBadge();
}

async function fetchMessages() {
    const response = await fetch("/api/admin/messages", {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return [];
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar as mensagens.");
    }

    return Array.isArray(result) ? result : [];
}

async function updateMessageStatus(messageId, status) {
    const response = await fetch(`/api/admin/messages/${encodeURIComponent(messageId)}/status`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ status })
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível atualizar a mensagem.");
    }

    return result.item || null;
}

async function deleteMessage(messageId) {
    const response = await fetch(`/api/admin/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return false;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível excluir a mensagem.");
    }

    return true;
}

function syncMessageInState(updatedMessage) {
    messagesState = messagesState.map((message) => (
        message.id === updatedMessage.id ? updatedMessage : message
    ));
}

function openMessageModal(message) {
    if (!messageModal || !messageModalOverlay || !messageModalBody) {
        return;
    }

    const statusMeta = getMessageStatusMeta(message.status);

    selectedMessageId = message.id || "";
    messageModalTitle.textContent = message.name || "Mensagem";
    messageModalEmail.textContent = message.email || "-";
    messageModalDate.textContent = formatDateTime(message.createdAt);
    messageModalBody.textContent = message.message || "-";

    if (messageModalStatus) {
        messageModalStatus.className = `admin-message-status-badge ${statusMeta.className}`;
        messageModalStatus.textContent = statusMeta.label;
    }

    if (messageToggleReadButton) {
        messageToggleReadButton.textContent = message.status === "read" ? "Marcar como nova" : "Marcar como lida";
        messageToggleReadButton.dataset.nextStatus = message.status === "read" ? "new" : "read";
    }

    messageModalOverlay.hidden = false;
    messageModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("admin-message-modal-open");
}

function closeMessageModal() {
    if (!messageModal || !messageModalOverlay) {
        return;
    }

    selectedMessageId = "";
    messageModalOverlay.hidden = true;
    messageModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-message-modal-open");
}

async function loadMessages() {
    clearFeedback();

    try {
        const messages = await fetchMessages();
        renderMessages(messages);
    } catch (error) {
        showFeedback(error.message, "error");
    }
}

async function handleToggleMessageStatus(messageId) {
    const message = messagesState.find((item) => item.id === messageId);

    if (!message || messageStatusRequestInFlight) {
        return;
    }

    try {
        messageStatusRequestInFlight = true;
        const nextStatus = message.status === "read" ? "new" : "read";
        const updatedMessage = await updateMessageStatus(messageId, nextStatus);

        if (!updatedMessage) {
            return;
        }

        syncMessageInState(updatedMessage);
        renderMessages(messagesState);

        if (selectedMessageId === messageId) {
            openMessageModal(updatedMessage);
        }

        showFeedback(
            nextStatus === "read" ? "Mensagem marcada como lida." : "Mensagem marcada como nova.",
            "success"
        );
    } catch (error) {
        showFeedback(error.message, "error");
    } finally {
        messageStatusRequestInFlight = false;
    }
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

if (messageModalClose) {
    messageModalClose.addEventListener("click", closeMessageModal);
}

if (messageModalOverlay) {
    messageModalOverlay.addEventListener("click", (event) => {
        if (event.target === messageModalOverlay) {
            closeMessageModal();
        }
    });
}

if (messageToggleReadButton) {
    messageToggleReadButton.addEventListener("click", async () => {
        if (!selectedMessageId) {
            return;
        }

        await handleToggleMessageStatus(selectedMessageId);
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !messageModalOverlay?.hidden) {
        closeMessageModal();
    }
});

if (messagesTableBody) {
    messagesTableBody.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action][data-id]");

        if (!button) {
            return;
        }

        const messageId = String(button.dataset.id || "");
        const action = String(button.dataset.action || "");
        const row = button.closest("tr");
        const name = row?.querySelector('[data-label="Nome"] .admin-product-name')?.textContent || "Mensagem";
        const email = row?.querySelector('[data-label="Email"] .admin-product-desc')?.textContent || "-";
        const date = row?.querySelector('[data-label="Data"]')?.textContent || "-";

        if (action === "view") {
            const message = messagesState.find((item) => item.id === messageId);

            if (!message) {
                showFeedback("Mensagem não encontrada.", "error");
                return;
            }

            if (message.status !== "read") {
                await handleToggleMessageStatus(messageId);
            }

            const updatedMessage = messagesState.find((item) => item.id === messageId) || message;
            openMessageModal({
                ...updatedMessage,
                name,
                email,
                createdAt: updatedMessage.createdAt || date
            });
            return;
        }

        if (action === "toggle-status") {
            await handleToggleMessageStatus(messageId);
            return;
        }

        if (action === "delete") {
            if (messageDeleteRequestInFlight) {
                return;
            }

            const shouldDelete = window.confirm(`Deseja excluir a mensagem de "${name}"?`);

            if (!shouldDelete) {
                return;
            }

            try {
                messageDeleteRequestInFlight = true;
                await deleteMessage(messageId);
                closeMessageModal();
                showFeedback("Mensagem excluída com sucesso.", "success");
                await loadMessages();
            } catch (error) {
                showFeedback(error.message, "error");
            } finally {
                messageDeleteRequestInFlight = false;
            }
        }
    });
}

loadMessages();
