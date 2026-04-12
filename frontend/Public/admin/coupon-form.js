const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const couponFormFeedbackBox = document.getElementById("adminCouponFormFeedback");
const couponForm = document.getElementById("adminCouponForm");
const couponSubmitButton = document.getElementById("adminCouponSubmitButton");
const couponFormPageTitle = document.getElementById("adminCouponFormPageTitle");

const couponId = window.location.pathname.match(/\/admin\/coupons\/([^/]+)\/edit$/)?.[1] || "";

function openAdminSidebar() {
    document.body.classList.add("sidebar-open");
}

function closeAdminSidebar() {
    document.body.classList.remove("sidebar-open");
}

function clearFeedback() {
    if (!couponFormFeedbackBox) {
        return;
    }

    couponFormFeedbackBox.hidden = true;
    couponFormFeedbackBox.textContent = "";
    couponFormFeedbackBox.className = "admin-feedback admin-products-feedback";
}

function showFeedback(message, type = "success") {
    if (!couponFormFeedbackBox) {
        return;
    }

    couponFormFeedbackBox.hidden = false;
    couponFormFeedbackBox.textContent = message;
    couponFormFeedbackBox.className = `admin-feedback admin-products-feedback ${type}`;
}

function toDateTimeLocalValue(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildPayload() {
    const formData = new FormData(couponForm);

    return {
        name: String(formData.get("name") || "").trim(),
        code: String(formData.get("code") || "").trim().toUpperCase(),
        description: String(formData.get("description") || "").trim(),
        percentageOff: Number(formData.get("percentageOff") || 0),
        isActive: formData.get("isActive") === "on",
        minSubtotal: Number(formData.get("minSubtotal") || 0),
        maxUsesTotal: Number(formData.get("maxUsesTotal") || 0),
        startsAt: String(formData.get("startsAt") || "").trim() || null,
        endsAt: String(formData.get("endsAt") || "").trim() || null
    };
}

function fillForm(coupon = {}) {
    couponForm.elements.name.value = coupon.name || "";
    couponForm.elements.code.value = coupon.code || "";
    couponForm.elements.description.value = coupon.description || "";
    couponForm.elements.percentageOff.value = Number(coupon.percentageOff || 0) || "";
    couponForm.elements.isActive.checked = Boolean(coupon.isActive);
    couponForm.elements.minSubtotal.value = Number(coupon.rules?.minSubtotal || 0) || "";
    couponForm.elements.maxUsesTotal.value = Number(coupon.rules?.maxUsesTotal || 0) || "";
    couponForm.elements.startsAt.value = toDateTimeLocalValue(coupon.startsAt);
    couponForm.elements.endsAt.value = toDateTimeLocalValue(coupon.endsAt);
}

async function fetchCoupon() {
    const response = await fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar o cupom.");
    }

    return result.coupon || null;
}

async function loadCouponIfEditing() {
    if (!couponId) {
        return;
    }

    const coupon = await fetchCoupon();

    if (!coupon) {
        return;
    }

    fillForm(coupon);
    couponFormPageTitle.textContent = `Editar cupom ${coupon.code || ""}`;
    couponSubmitButton.textContent = "Salvar alterações";
}

async function handleSubmit(event) {
    event.preventDefault();
    clearFeedback();

    const response = await fetch(couponId ? `/api/admin/coupons/${encodeURIComponent(couponId)}` : "/api/admin/coupons", {
        method: couponId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload())
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível salvar o cupom.");
    }

    window.location.href = `/admin/coupons/${encodeURIComponent(result._id || couponId)}`;
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

couponForm.addEventListener("submit", async (event) => {
    try {
        await handleSubmit(event);
    } catch (error) {
        showFeedback(error.message, "error");
    }
});

loadCouponIfEditing().catch((error) => {
    showFeedback(error.message, "error");
});
