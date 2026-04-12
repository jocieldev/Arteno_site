const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const couponsFeedbackBox = document.getElementById("adminCouponsFeedback");
const couponsEmptyState = document.getElementById("adminCouponsEmptyState");
const couponsTableWrap = document.getElementById("adminCouponsTableWrap");
const couponsTableBody = document.getElementById("adminCouponsTableBody");

function openAdminSidebar() {
    document.body.classList.add("sidebar-open");
}

function closeAdminSidebar() {
    document.body.classList.remove("sidebar-open");
}

function clearFeedback() {
    if (!couponsFeedbackBox) {
        return;
    }

    couponsFeedbackBox.hidden = true;
    couponsFeedbackBox.textContent = "";
    couponsFeedbackBox.className = "admin-feedback admin-products-feedback";
}

function showFeedback(message, type = "success") {
    if (!couponsFeedbackBox) {
        return;
    }

    couponsFeedbackBox.hidden = false;
    couponsFeedbackBox.textContent = message;
    couponsFeedbackBox.className = `admin-feedback admin-products-feedback ${type}`;
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

function buildCouponRulesLabel(coupon = {}) {
    const rules = [];

    if (Number(coupon.rules?.minSubtotal || 0) > 0) {
        rules.push(`Min. ${formatCurrency(coupon.rules.minSubtotal)}`);
    }

    if (Number(coupon.rules?.maxUsesTotal || 0) > 0) {
        rules.push(`Até ${Number(coupon.rules.maxUsesTotal)} uso(s)`);
    }

    if (coupon.startsAt || coupon.endsAt) {
        rules.push("Com validade");
    }

    return rules.length ? rules.join(" • ") : "Sem regras extras";
}

function renderCoupons(coupons = []) {
    if (!couponsTableBody || !couponsEmptyState || !couponsTableWrap) {
        return;
    }

    if (!coupons.length) {
        couponsTableBody.innerHTML = "";
        couponsEmptyState.hidden = false;
        couponsTableWrap.hidden = true;
        return;
    }

    couponsEmptyState.hidden = true;
    couponsTableWrap.hidden = false;

    couponsTableBody.innerHTML = coupons.map((coupon) => `
        <tr>
            <td data-label="Cupom">
                <div class="admin-product-name">${escapeHtml(coupon.code || "-")}</div>
                <div class="admin-product-desc">${escapeHtml(coupon.name || "-")}</div>
            </td>
            <td data-label="Desconto">${escapeHtml(String(coupon.percentageOff || 0))}%</td>
            <td data-label="Regras">${escapeHtml(buildCouponRulesLabel(coupon))}</td>
            <td data-label="Usos">
                <div class="admin-product-name">${Number(coupon.usageCount || 0)} compra(s)</div>
                <div class="admin-product-desc">${escapeHtml(formatDateTime(coupon.lastUsedAt))}</div>
            </td>
            <td data-label="Status">
                <span class="admin-products-status-pill ${coupon.isActive ? "" : "inactive"}">${coupon.isActive ? "Ativo" : "Inativo"}</span>
            </td>
            <td data-label="Detalhes">
                <div class="admin-table-actions">
                    <a href="/admin/coupons/${escapeHtml(coupon._id || "")}" class="admin-table-action">Ver detalhes</a>
                </div>
            </td>
        </tr>
    `).join("");
}

async function fetchCoupons() {
    const response = await fetch("/api/admin/coupons", {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return [];
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar os cupons.");
    }

    return Array.isArray(result) ? result : [];
}

async function loadCoupons() {
    clearFeedback();

    try {
        const coupons = await fetchCoupons();
        renderCoupons(coupons);
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

loadCoupons();
