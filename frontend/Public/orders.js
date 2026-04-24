const menuIcon = document.querySelector(".menu-icon");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");
const produtos = document.getElementById("abrir-submenu");
const cartCount = document.getElementById("cart-count");
const desktopCategoriesMenu = document.getElementById("desktopCategoriesMenu");
const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");
const footerCategoriesMenu = document.getElementById("footerCategoriesMenu");
const accountFeedback = document.getElementById("accountFeedback");
const accountOrdersList = document.getElementById("accountOrdersList");
const accountOrdersEmpty = document.getElementById("accountOrdersEmpty");
const accountOrderFilters = Array.from(document.querySelectorAll("[data-order-filter]"));

const ORDER_STATUS_META = {
    payment_pending: { label: "A pagar", pillClass: "pending" },
    payment_confirmed: { label: "Pagamento confirmado", pillClass: "confirmed" },
    preparing: { label: "Em produção", pillClass: "preparing" },
    shipped: { label: "Enviado", pillClass: "shipped" },
    delivered: { label: "Finalizado", pillClass: "delivered" },
    cancelled: { label: "Cancelado", pillClass: "cancelled" }
};

let allOrders = [];
let activeOrderFilter = "all";

if (menuIcon && sideMenu && overlay) {
    menuIcon.addEventListener("click", () => {
        sideMenu.classList.add("active");
        overlay.classList.add("active");
    });
}

function closeSideMenu() {
    if (!sideMenu || !overlay) {
        return;
    }

    sideMenu.classList.remove("active");
    overlay.classList.remove("active");
}

if (closeMenu) {
    closeMenu.addEventListener("click", closeSideMenu);
}

if (overlay) {
    overlay.addEventListener("click", closeSideMenu);
}

if (produtos) {
    produtos.addEventListener("click", () => {
        produtos.classList.toggle("ativo");
    });
}

function getStoredCartItems() {
    try {
        const rawValue = window.localStorage.getItem("arteno-cart");
        const parsedValue = JSON.parse(rawValue || "[]");
        return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (_error) {
        return [];
    }
}

function setStoredCartItems(items) {
    window.localStorage.setItem("arteno-cart", JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cart:updated"));
}

function updateCartCount() {
    if (!cartCount) {
        return;
    }

    const totalItems = getStoredCartItems().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    cartCount.textContent = String(totalItems);
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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

function getCategoryUrl(category) {
    return `/categoria/${encodeURIComponent(category.slug || "")}`;
}

function buildCategoryLinkMarkup(category) {
    const categoryUrl = escapeHtml(getCategoryUrl(category));
    const categoryName = escapeHtml(category.name || "Categoria");
    return `<a href="${categoryUrl}">${categoryName}</a>`;
}

function buildMobileCategoryItemMarkup(category) {
    const categoryUrl = escapeHtml(getCategoryUrl(category));
    const categoryName = escapeHtml(category.name || "Categoria");
    return `<a href="${categoryUrl}" class="mobile-category-link">${categoryName}</a>`;
}

function buildFooterCategoryItemMarkup(category) {
    const categoryUrl = escapeHtml(getCategoryUrl(category));
    const categoryName = escapeHtml(category.name || "Categoria");
    return `<li><a href="${categoryUrl}">${categoryName}</a></li>`;
}

function renderSharedCategories(categories) {
    if (desktopCategoriesMenu) {
        desktopCategoriesMenu.innerHTML = categories.map((category) => buildCategoryLinkMarkup(category)).join("");
    }

    if (mobileCategoriesMenu) {
        mobileCategoriesMenu.innerHTML = categories.map((category) => buildMobileCategoryItemMarkup(category)).join("");
    }

    if (footerCategoriesMenu) {
        footerCategoriesMenu.innerHTML = categories.map((category) => buildFooterCategoryItemMarkup(category)).join("");
    }
}

async function loadSharedCategories() {
    try {
        const response = await fetch("/api/categories");

        if (!response.ok) {
            throw new Error("Não foi possível carregar as categorias.");
        }

        const categories = await response.json();
        renderSharedCategories(categories);
    } catch (error) {
        console.error("Erro ao carregar categorias compartilhadas:", error);
    }
}

function showOrdersError(message, type = "error") {
    if (window.showSiteToast) {
        window.showSiteToast(message, type, {
            duration: 5200
        });
    }

    if (!accountFeedback) {
        return;
    }

    accountFeedback.hidden = false;
    accountFeedback.textContent = message;
}

function hideOrdersError() {
    if (accountFeedback) {
        accountFeedback.hidden = true;
        accountFeedback.textContent = "";
    }
}

function getOrderStatusMeta(status) {
    return ORDER_STATUS_META[status] || ORDER_STATUS_META.payment_confirmed;
}

function getOrderItemsCount(order) {
    return (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getNormalizedPersonalizationPreviews(item = {}) {
    return (Array.isArray(item.personalizationPreviews) ? item.personalizationPreviews : [])
        .map((preview = {}, index) => ({
            name: String(preview.name || `Prévia ${index + 1}`).trim() || `Prévia ${index + 1}`,
            textValue: String(preview.textValue || item.personalizationName || "").trim(),
            overlayImageKind: String(preview.overlayImageKind || "").trim(),
            overlayImageUrl: String(preview.overlayImageUrl || "").trim(),
            overlayImageStorageKey: String(preview.overlayImageStorageKey || "").trim()
        }))
        .filter((preview) => (
            preview.textValue
            || preview.overlayImageKind
            || preview.overlayImageUrl
            || preview.overlayImageStorageKey
        ));
}

function renderPersonalizationSummary(item = {}) {
    const previews = getNormalizedPersonalizationPreviews(item);

    if (previews.length) {
        return previews.map((preview) => {
            const details = [];

            if (preview.textValue) {
                details.push(`Texto: ${preview.textValue}`);
            }

            if (preview.overlayImageKind) {
                details.push(`Imagem: ${preview.overlayImageKind === "upload" ? "enviada pelo cliente" : "selecionada"}`);
            }

            return `<p>${escapeHtml(preview.name)}: ${escapeHtml(details.join(" | ") || "Personalizado")}</p>`;
        }).join("");
    }

    if (item.personalizationName) {
        return `<p>Personalização: ${escapeHtml(item.personalizationName)}</p>`;
    }

    return "";
}

function buildOrderItemRowMarkup(item = {}) {
    return `
        <div class="account-order-inline-item">
            <img src="${escapeHtml(item.imageUrl || "/img/tabua-produto01.webp")}" alt="${escapeHtml(item.name || "Produto")}">
            <div class="account-order-inline-item-content">
                <strong>${escapeHtml(item.name || "Produto")}</strong>
                ${Array.isArray(item.selectedVariations) ? item.selectedVariations.map((variation) => `<p>${escapeHtml(variation.variationName || "Variação")}: ${escapeHtml(variation.itemLabel || "-")}${variation.price !== null && variation.price !== undefined ? ` (${escapeHtml(formatCurrency(variation.price))})` : ""}</p>`).join("") : ""}
                <div class="account-order-inline-item-meta">
                    <span>${escapeHtml(formatCurrency(item.price || 0))}</span>
                    <span>Qtd. ${escapeHtml(Number(item.quantity || 1))}</span>
                </div>
                ${renderPersonalizationSummary(item)}
            </div>
        </div>
    `;
}

function buildOrderPreviewItemMarkup(item = {}) {
    return `
        <div class="account-order-inline-item" data-order-open="true">
            <img src="${escapeHtml(item.imageUrl || "/img/tabua-produto01.webp")}" alt="${escapeHtml(item.name || "Produto")}">
            <div class="account-order-inline-item-content">
                <strong>${escapeHtml(item.name || "Produto")}</strong>
                ${Array.isArray(item.selectedVariations) ? item.selectedVariations.map((variation) => `<p>${escapeHtml(variation.variationName || "Variação")}: ${escapeHtml(variation.itemLabel || "-")}${variation.price !== null && variation.price !== undefined ? ` (${escapeHtml(formatCurrency(variation.price))})` : ""}</p>`).join("") : ""}
                <div class="account-order-inline-item-meta">
                    <span>${escapeHtml(formatCurrency(item.price || 0))}</span>
                    <span>Qtd. ${escapeHtml(Number(item.quantity || 1))}</span>
                </div>
                ${renderPersonalizationSummary(item)}
            </div>
        </div>
    `;
}

function buildOrderCardMarkup(order) {
    const statusMeta = getOrderStatusMeta(order.orderStatus);
    const items = Array.isArray(order.items) ? order.items : [];
    const previewItem = items[0] || {};
    const extraItems = items.slice(1);
    const hasExtraItems = extraItems.length > 0;
    const itemCount = getOrderItemsCount(order);

    return `
        <article class="account-order-summary-card">
            <div class="account-order-summary-header">
                <div class="account-order-summary-heading">
                    <div class="account-order-meta">
                        <span>${escapeHtml(formatDateTime(order.createdAt))}</span>
                    </div>
                </div>
                <span class="account-order-status-pill ${escapeHtml(statusMeta.pillClass)}">${escapeHtml(statusMeta.label)}</span>
            </div>

            <div class="account-order-products">
                ${buildOrderPreviewItemMarkup(previewItem)}
            </div>

            ${hasExtraItems ? `
                <div class="account-order-extra">
                    <div class="account-order-extra-items" data-order-extra-items="${escapeHtml(order._id || "")}" hidden>
                        ${extraItems.map((item) => buildOrderItemRowMarkup(item)).join("")}
                    </div>
                    <button type="button" class="account-order-expand-button" data-order-expand="${escapeHtml(order._id || "")}" aria-expanded="false">
                        <span>Ver mais</span>
                        <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                    </button>
                </div>
            ` : ""}

            <div class="account-order-summary-link-row">
                <a href="/meus-pedidos/${encodeURIComponent(order._id || "")}" class="account-order-summary-link">Ver mais informações</a>
                ${order.paymentAction?.canPayNow ? `
                    <a href="/meus-pedidos/${encodeURIComponent(order._id || "")}?pay=1" class="account-order-summary-link account-order-pay-link">Pagar agora</a>
                ` : ""}
            </div>

            <div class="account-order-summary-footer">
                <div class="account-order-summary-totals">
                    <span>Total de ${escapeHtml(itemCount)} item(ns)</span>
                    <strong>${escapeHtml(formatCurrency(order.totals?.total || 0))}</strong>
                </div>
                <button type="button" class="account-order-rebuy-button" data-order-rebuy="${escapeHtml(order._id || "")}">
                    Comprar novamente
                </button>
            </div>
        </article>
    `;
}

function getFilteredOrders() {
    if (activeOrderFilter === "all") {
        return allOrders;
    }

    return allOrders.filter((order) => String(order.orderStatus || "") === activeOrderFilter);
}

function renderOrders() {
    if (!accountOrdersList || !accountOrdersEmpty) {
        return;
    }

    const filteredOrders = getFilteredOrders();

    if (!filteredOrders.length) {
        accountOrdersList.innerHTML = "";
        accountOrdersEmpty.hidden = false;
        accountOrdersEmpty.textContent = activeOrderFilter === "all"
            ? "Você ainda não tem pedidos vinculados a esta conta."
            : "Nenhum pedido encontrado para este filtro.";
        return;
    }

    accountOrdersEmpty.hidden = true;
    accountOrdersList.innerHTML = filteredOrders.map((order) => buildOrderCardMarkup(order)).join("");
}

function setActiveFilter(filterValue) {
    activeOrderFilter = filterValue;

    accountOrderFilters.forEach((button) => {
        button.classList.toggle("active", button.dataset.orderFilter === filterValue);
    });

    renderOrders();
}

function animateOrderExtraItems(extraItems, expandButton, shouldOpen) {
    if (!extraItems || !expandButton) {
        return;
    }

    const transitionDurationMs = 180;

    if (extraItems.dataset.animating === "true") {
        return;
    }

    if (shouldOpen) {
        extraItems.dataset.animating = "true";
        extraItems.hidden = false;
        extraItems.classList.add("is-animating");

        window.requestAnimationFrame(() => {
            extraItems.classList.add("is-open");
        });

        window.setTimeout(() => {
            extraItems.classList.remove("is-animating");
            extraItems.dataset.animating = "false";
        }, transitionDurationMs);
        expandButton.setAttribute("aria-expanded", "true");
        expandButton.classList.add("is-open");
        expandButton.querySelector("span").textContent = "Ver menos";
        return;
    }

    extraItems.dataset.animating = "true";
    extraItems.classList.add("is-animating");
    extraItems.classList.remove("is-open");

    window.setTimeout(() => {
        extraItems.hidden = true;
        extraItems.classList.remove("is-animating");
        extraItems.dataset.animating = "false";
    }, transitionDurationMs);
    expandButton.setAttribute("aria-expanded", "false");
    expandButton.classList.remove("is-open");
    expandButton.querySelector("span").textContent = "Ver mais";
}

async function loadOrders() {
    try {
        hideOrdersError();
        const response = await fetch("/api/auth/orders");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Não foi possível carregar seus pedidos.");
        }

        allOrders = Array.isArray(result.orders) ? result.orders : [];
        renderOrders();
    } catch (error) {
        showOrdersError(error.message);
        window.setTimeout(() => {
            window.location.href = "/entrar";
        }, 800);
    }
}

accountOrderFilters.forEach((button) => {
    button.addEventListener("click", () => {
        setActiveFilter(button.dataset.orderFilter || "all");
    });
});

if (accountOrdersList) {
    accountOrdersList.addEventListener("click", (event) => {
        const expandButton = event.target.closest("[data-order-expand]");

        if (expandButton) {
            event.preventDefault();
            const card = expandButton.closest(".account-order-summary-card");
            const extraItems = card?.querySelector("[data-order-extra-items]");

            if (!card || !extraItems) {
                return;
            }

            const shouldOpen = extraItems.hidden;
            animateOrderExtraItems(extraItems, expandButton, shouldOpen);
            return;
        }

        const rebuyButton = event.target.closest("[data-order-rebuy]");

        if (rebuyButton) {
            event.preventDefault();
            const orderId = rebuyButton.dataset.orderRebuy || "";
            const order = allOrders.find((entry) => String(entry._id || "") === orderId);

            if (!order) {
                return;
            }

            const firstItemSlug = String(order.items?.[0]?.slug || "").trim();

            if (!firstItemSlug) {
                showOrdersError("Nao foi possivel abrir o produto deste pedido.");
                return;
            }

            window.location.href = `/produto/${encodeURIComponent(firstItemSlug)}`;
            return;
        }

        if (event.target.closest("button")) {
            return;
        }

        const previewCard = event.target.closest("[data-order-open='true']");

        if (previewCard) {
            const detailLink = previewCard
                .closest(".account-order-summary-card")
                ?.querySelector(".account-order-summary-link");

            if (detailLink instanceof HTMLAnchorElement) {
                window.location.href = detailLink.href;
            }
        }

    });
}

loadSharedCategories();
updateCartCount();
loadOrders();
