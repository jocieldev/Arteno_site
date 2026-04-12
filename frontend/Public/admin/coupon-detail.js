const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const couponDetailFeedbackBox = document.getElementById("adminCouponDetailFeedback");
const couponDetailShell = document.getElementById("adminCouponDetailShell");
const couponCodeElement = document.getElementById("adminCouponCode");
const couponMetaElement = document.getElementById("adminCouponMeta");
const couponMetricsElement = document.getElementById("adminCouponMetrics");
const couponDescriptionElement = document.getElementById("adminCouponDescription");
const couponRulesElement = document.getElementById("adminCouponRules");
const couponOrdersEmptyState = document.getElementById("adminCouponOrdersEmptyState");
const couponOrdersTableWrap = document.getElementById("adminCouponOrdersTableWrap");
const couponOrdersTableBody = document.getElementById("adminCouponOrdersTableBody");
const couponEditLink = document.getElementById("adminCouponEditLink");

const couponId = window.location.pathname.split("/").pop();

function openAdminSidebar() {
    document.body.classList.add("sidebar-open");
}

function closeAdminSidebar() {
    document.body.classList.remove("sidebar-open");
}

function showFeedback(message, type = "error") {
    if (!couponDetailFeedbackBox) {
        return;
    }

    couponDetailFeedbackBox.hidden = false;
    couponDetailFeedbackBox.textContent = message;
    couponDetailFeedbackBox.className = `admin-feedback admin-products-feedback ${type}`;
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

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("pt-BR", {
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

function renderCouponDetails(coupon = {}, usage = {}) {
    couponDetailShell.hidden = false;
    couponCodeElement.textContent = coupon.code || "-";
    couponMetaElement.innerHTML = `
        <span class="admin-products-status-pill ${coupon.isActive ? "" : "inactive"}">${coupon.isActive ? "Ativo" : "Inativo"}</span>
        <span>${escapeHtml(coupon.name || "-")}</span>
        <span>${escapeHtml(formatDateTime(coupon.createdAt))}</span>
    `;
    couponMetricsElement.innerHTML = `
        <div class="admin-coupon-metric-card"><span>Desconto</span><strong>${escapeHtml(String(coupon.percentageOff || 0))}%</strong></div>
        <div class="admin-coupon-metric-card"><span>Compras com cupom</span><strong>${Number(coupon.usageCount || usage.orderCount || 0)}</strong></div>
        <div class="admin-coupon-metric-card"><span>Último uso</span><strong>${escapeHtml(formatDateTime(coupon.lastUsedAt))}</strong></div>
    `;
    couponDescriptionElement.innerHTML = `<span>${escapeHtml(coupon.description || "Sem descrição cadastrada.")}</span>`;
    couponRulesElement.innerHTML = [
        Number(coupon.rules?.minSubtotal || 0) > 0 ? `Compra mínima de ${formatCurrency(coupon.rules.minSubtotal)}` : "Sem valor mínimo de compra",
        Number(coupon.rules?.maxUsesTotal || 0) > 0 ? `Limite total de ${Number(coupon.rules.maxUsesTotal)} uso(s)` : "Uso total ilimitado",
        coupon.startsAt ? `Início: ${formatDateTime(coupon.startsAt)}` : "Sem data inicial",
        coupon.endsAt ? `Fim: ${formatDateTime(coupon.endsAt)}` : "Sem data final"
    ].map((rule) => `<div class="admin-coupon-rule-item">${escapeHtml(rule)}</div>`).join("");

    if (couponEditLink) {
        couponEditLink.href = `/admin/coupons/${encodeURIComponent(coupon._id || couponId)}/edit`;
    }

    const orders = Array.isArray(usage.orders) ? usage.orders : [];

    if (!orders.length) {
        couponOrdersEmptyState.hidden = false;
        couponOrdersTableWrap.hidden = true;
        couponOrdersTableBody.innerHTML = "";
        return;
    }

    couponOrdersEmptyState.hidden = true;
    couponOrdersTableWrap.hidden = false;
    couponOrdersTableBody.innerHTML = orders.map((order) => `
        <tr>
            <td data-label="Pedido">
                <div class="admin-product-name">${escapeHtml(order.orderNumber || "-")}</div>
                <div class="admin-product-desc">${escapeHtml(order.orderStatus || "-")}</div>
            </td>
            <td data-label="Cliente">
                <div class="admin-product-name">${escapeHtml(order.customerName || "-")}</div>
                <div class="admin-product-desc">${escapeHtml(order.customerEmail || "-")}</div>
            </td>
            <td data-label="Desconto">${formatCurrency(order.discount || 0)}</td>
            <td data-label="Total">${formatCurrency(order.total || 0)}</td>
            <td data-label="Data">${escapeHtml(formatDateTime(order.createdAt))}</td>
        </tr>
    `).join("");
}

async function loadCoupon() {
    const response = await fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar o cupom.");
    }

    renderCouponDetails(result.coupon || {}, result.usage || {});
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

loadCoupon().catch((error) => {
    showFeedback(error.message, "error");
});
