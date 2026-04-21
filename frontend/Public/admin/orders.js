const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const ordersFeedbackBox = document.getElementById("adminOrdersFeedback");
const ordersEmptyState = document.getElementById("adminOrdersEmptyState");
const ordersTableWrap = document.getElementById("adminOrdersTableWrap");
const ordersTableBody = document.getElementById("adminOrdersTableBody");
let deleteOrderRequestInFlight = false;

const ORDER_STATUS_META = {
    payment_pending: { label: "Pagamento pendente", pillClass: "inactive" },
    payment_confirmed: { label: "Pagamento confirmado", pillClass: "" },
    preparing: { label: "Em preparação", pillClass: "" },
    shipped: { label: "Enviado", pillClass: "unlisted" },
    delivered: { label: "Entregue", pillClass: "" },
    cancelled: { label: "Cancelado", pillClass: "inactive" }
};

function openAdminSidebar() {
    document.body.classList.add("sidebar-open");
}

function closeAdminSidebar() {
    document.body.classList.remove("sidebar-open");
}

function clearFeedback() {
    if (!ordersFeedbackBox) {
        return;
    }

    ordersFeedbackBox.hidden = true;
    ordersFeedbackBox.textContent = "";
    ordersFeedbackBox.className = "admin-feedback admin-products-feedback";
}

function showFeedback(message, type = "success") {
    if (!ordersFeedbackBox) {
        return;
    }

    ordersFeedbackBox.hidden = false;
    ordersFeedbackBox.textContent = message;
    ordersFeedbackBox.className = `admin-feedback admin-products-feedback ${type}`;
}

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(value || 0));
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

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getOrderStatusMeta(value = "payment_confirmed") {
    return ORDER_STATUS_META[value] || ORDER_STATUS_META.payment_confirmed;
}

function renderOrders(orders) {
    if (!ordersTableBody || !ordersEmptyState || !ordersTableWrap) {
        return;
    }

    if (!orders.length) {
        ordersTableBody.innerHTML = "";
        ordersEmptyState.hidden = false;
        ordersTableWrap.hidden = true;
        return;
    }

    ordersEmptyState.hidden = true;
    ordersTableWrap.hidden = false;

    ordersTableBody.innerHTML = orders.map((order) => {
        const statusMeta = getOrderStatusMeta(order.orderStatus);
        const paymentStatus = escapeHtml(order.payment?.status || "approved");
        const customerName = escapeHtml(order.customer?.name || "-");
        const customerEmail = escapeHtml(order.customer?.email || "-");

        return `
            <tr data-order-id="${escapeHtml(order._id || "")}">
                <td data-label="Pedido">
                    <div class="admin-product-name">${escapeHtml(order.orderNumber || "-")}</div>
                    <div class="admin-product-desc">${Number(order.items?.length || 0)} item(ns)</div>
                </td>
                <td data-label="Cliente">
                    <div class="admin-product-name">${customerName}</div>
                    <div class="admin-product-desc">${customerEmail}</div>
                </td>
                <td data-label="Pagamento">
                    <span class="admin-products-status-pill ${paymentStatus === "approved" ? "" : "inactive"}">${paymentStatus === "approved" ? "Confirmado" : paymentStatus === "pending" ? "Pendente" : paymentStatus}</span>
                </td>
                <td data-label="Status do pedido">
                    <span class="admin-products-status-pill ${statusMeta.pillClass}">${statusMeta.label}</span>
                </td>
                <td data-label="Total">${formatCurrency(order.totals?.total || 0)}</td>
                <td data-label="Data">${escapeHtml(formatDateTime(order.createdAt))}</td>
                <td data-label="Detalhes">
                    <div class="admin-table-actions">
                        <a href="/admin/orders/${escapeHtml(order._id || "")}" class="admin-table-action">Ver detalhes</a>
                        <button type="button" class="admin-secondary-button admin-order-delete-button" data-delete-order-id="${escapeHtml(order._id || "")}">Excluir</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

async function fetchOrders() {
    const response = await fetch("/api/admin/orders", {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return [];
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar os pedidos.");
    }

    return Array.isArray(result) ? result : [];
}

async function deleteOrder(orderId) {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "DELETE",
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível excluir o pedido.");
    }

    return result;
}

async function loadOrders() {
    clearFeedback();

    try {
        const orders = await fetchOrders();
        renderOrders(orders);
    } catch (error) {
        showFeedback(error.message, "error");
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

if (ordersTableBody) {
    ordersTableBody.addEventListener("click", async (event) => {
        const deleteButton = event.target.closest("[data-delete-order-id]");

        if (!deleteButton || deleteOrderRequestInFlight) {
            return;
        }

        const orderId = String(deleteButton.getAttribute("data-delete-order-id") || "").trim();

        if (!orderId) {
            return;
        }

        const confirmed = window.confirm("Deseja excluir este pedido permanentemente? Esta ação remove as informações e as imagens vinculadas.");

        if (!confirmed) {
            return;
        }

        deleteOrderRequestInFlight = true;
        deleteButton.disabled = true;
        clearFeedback();

        try {
            const result = await deleteOrder(orderId);
            showFeedback(result.message || "Pedido excluído com sucesso.", "success");
            await loadOrders();
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            deleteOrderRequestInFlight = false;
        }
    });
}

loadOrders();
