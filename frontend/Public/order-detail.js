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
const accountOrderDetailTitle = document.getElementById("accountOrderDetailTitle");
const accountOrderDetailContent = document.getElementById("accountOrderDetailContent");
let currentOrder = null;
let paymentActionRequestInFlight = false;

const ORDER_STATUS_META = {
    payment_pending: { label: "A pagar", pillClass: "pending", progressIndex: 1 },
    payment_confirmed: { label: "Pagamento confirmado", pillClass: "confirmed", progressIndex: 2 },
    preparing: { label: "Em produção", pillClass: "preparing", progressIndex: 3 },
    shipped: { label: "Enviado", pillClass: "shipped", progressIndex: 4 },
    delivered: { label: "Finalizado", pillClass: "delivered", progressIndex: 5 },
    cancelled: { label: "Cancelado", pillClass: "cancelled", progressIndex: 0 }
};

const ORDER_PROGRESS_STEPS = [
    { label: "Pagamento" },
    { label: "Confirmação" },
    { label: "Produção" },
    { label: "Envio" },
    { label: "Entrega" }
];

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

function showOrderDetailError(message) {
    if (window.showSiteToast) {
        window.showSiteToast(message, "error", {
            duration: 5200
        });
    }

    if (!accountFeedback) {
        return;
    }

    accountFeedback.hidden = false;
    accountFeedback.textContent = message;
}

function hideOrderDetailError() {
    if (!accountFeedback) {
        return;
    }

    accountFeedback.hidden = true;
    accountFeedback.textContent = "";
}

function getOrderStatusMeta(status) {
    return ORDER_STATUS_META[status] || ORDER_STATUS_META.payment_confirmed;
}

function renderProgressSteps(order) {
    const statusMeta = getOrderStatusMeta(order.orderStatus);

    return ORDER_PROGRESS_STEPS.map((step, index) => {
        const stepIndex = index + 1;
        const isDone = statusMeta.progressIndex > stepIndex;
        const isCurrent = statusMeta.progressIndex === stepIndex;
        const isActive = statusMeta.progressIndex >= stepIndex;

        return `
            <div class="account-order-progress-step ${isActive ? "active" : ""} ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}">
                <div class="account-order-progress-marker">
                    <span>${isDone ? "✓" : stepIndex}</span>
                </div>
                <div class="account-order-progress-text">
                    <small>Etapa ${stepIndex}</small>
                    <strong>${escapeHtml(step.label)}</strong>
                </div>
            </div>
        `;
    }).join("");
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

            return `<span>${escapeHtml(preview.name)}: ${escapeHtml(details.join(" | ") || "Personalizado")}</span>`;
        }).join("");
    }

    if (item.personalizationName) {
        return `<span>Personalização: ${escapeHtml(item.personalizationName)}</span>`;
    }

    return "";
}

function renderOrderItems(items = []) {
    return items.map((item) => `
        <article class="account-order-item">
            <img src="${escapeHtml(item.imageUrl || "/img/tabua-produto01.webp")}" alt="${escapeHtml(item.name || "Produto")}">
            <div>
                <strong>${escapeHtml(item.name || "Produto")}</strong>
                ${Array.isArray(item.selectedVariations) ? item.selectedVariations.map((variation) => `<span>${escapeHtml(variation.variationName || "Variação")}: ${escapeHtml(variation.itemLabel || "-")}${variation.price !== null && variation.price !== undefined ? ` (${escapeHtml(formatCurrency(variation.price))})` : ""}</span>`).join("") : ""}
                <span>Quantidade: ${Number(item.quantity || 1)}</span>
                <span>Preço unitário: ${escapeHtml(formatCurrency(item.price || 0))}</span>
                ${item.personalizationName ? `<span>Personalização: ${escapeHtml(item.personalizationName)}</span>` : ""}
            </div>
        </article>
    `).join("");
}

function renderOrderHistory(history = []) {
    if (!history.length) {
        return '<div class="account-order-history-entry"><strong>Pedido criado</strong><span>Aguardando novas atualizações.</span></div>';
    }

    return history
        .slice()
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .map((entry) => `
            <div class="account-order-history-entry">
                <strong>${escapeHtml(entry.label || "Atualização")}</strong>
                <span>${escapeHtml(formatDateTime(entry.createdAt))}</span>
                ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
            </div>
        `).join("");
}

function renderTrackingValue(order) {
    if (order.shippingIntegration?.provider === "motoboy") {
        if (order.orderStatus === "delivered") {
            return "Entrega local concluida.";
        }

        if (order.orderStatus === "shipped") {
            return "Saiu para entrega com motoboy.";
        }

        return "Entrega local por motoboy.";
    }

    if (order.orderStatus === "cancelled") {
        return "Pedido cancelado";
    }

    if (order.tracking?.code) {
        return order.tracking.code;
    }

    if (order.orderStatus === "shipped") {
        return "Seu pedido foi enviado. O código será adicionado em breve.";
    }

    return "Ainda não disponível";
}

function getPaymentMethodLabel(method = "") {
    const value = String(method || "").trim();

    if (value === "pix") {
        return "Pix";
    }

    if (value === "boleto") {
        return "Boleto";
    }

    if (value === "card") {
        return "Cartão";
    }

    return value || "-";
}

function getOrderIdFromPath() {
    const match = window.location.pathname.match(/^\/meus-pedidos\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
}

function shouldAutoOpenPaymentArea() {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("pay") === "1";
}

function getPaymentExpiration(order = {}) {
    const expiresAt = String(order.payment?.details?.expiresAt || "").trim();

    if (!expiresAt) {
        return {
            expiresAt: "",
            isExpired: false
        };
    }

    const timestamp = new Date(expiresAt).getTime();

    if (!Number.isFinite(timestamp)) {
        return {
            expiresAt,
            isExpired: false
        };
    }

    return {
        expiresAt,
        isExpired: timestamp <= Date.now()
    };
}

function getAvailablePaymentMethods(order = {}) {
    const fromApi = Array.isArray(order.paymentAction?.availableMethods)
        ? order.paymentAction.availableMethods
        : [];
    const normalized = fromApi
        .map((method) => String(method || "").trim().toLowerCase())
        .filter((method) => ["pix", "boleto", "card"].includes(method));

    if (normalized.length) {
        return normalized;
    }

    return ["pix", "boleto"];
}

function buildPaymentInstructionsMarkup(order = {}) {
    const details = order.payment?.details || {};
    const paymentMethod = String(order.payment?.method || "").trim().toLowerCase();
    const { expiresAt, isExpired } = getPaymentExpiration(order);

    if (paymentMethod === "pix") {
        const qrCode = String(details.qrCode || "").trim();
        const qrCodeBase64 = String(details.qrCodeBase64 || "").trim();

        if (!qrCode && !qrCodeBase64) {
            return "";
        }

        return `
            <div class="account-payment-instructions ${isExpired ? "is-expired" : ""}">
                <p class="account-payment-instructions-title">Instrucoes do Pix</p>
                ${expiresAt ? `<p class="account-payment-instructions-note">Validade: ${escapeHtml(formatDateTime(expiresAt))}${isExpired ? " (expirado)" : ""}</p>` : ""}
                ${qrCodeBase64 ? `<img src="data:image/png;base64,${escapeHtml(qrCodeBase64)}" alt="QR Code Pix" class="account-payment-qr-image">` : ""}
                ${qrCode ? `
                    <div class="account-payment-copy-box">
                        <textarea id="orderPixCode" readonly>${escapeHtml(qrCode)}</textarea>
                        <button type="button" class="account-payment-copy-button" data-copy-payment-target="orderPixCode">Copiar chave Pix</button>
                    </div>
                ` : ""}
            </div>
        `;
    }

    if (paymentMethod === "boleto") {
        const boletoLine = String(details.boletoLine || details.ticketUrl || "").trim();

        if (!boletoLine) {
            return "";
        }

        return `
            <div class="account-payment-instructions ${isExpired ? "is-expired" : ""}">
                <p class="account-payment-instructions-title">Instrucoes do boleto</p>
                ${expiresAt ? `<p class="account-payment-instructions-note">Validade: ${escapeHtml(formatDateTime(expiresAt))}${isExpired ? " (expirado)" : ""}</p>` : ""}
                <div class="account-payment-copy-box">
                    <textarea id="orderBoletoLine" readonly>${escapeHtml(boletoLine)}</textarea>
                    <button type="button" class="account-payment-copy-button" data-copy-payment-target="orderBoletoLine">Copiar linha digitavel</button>
                </div>
            </div>
        `;
    }

    return "";
}

function buildPendingPaymentActionMarkup(order = {}) {
    if (!order.paymentAction?.canPayNow) {
        return "";
    }

    const availableMethods = getAvailablePaymentMethods(order);
    const currentMethod = String(order.payment?.method || "").trim().toLowerCase();
    const selectedMethod = availableMethods.includes(currentMethod) ? currentMethod : availableMethods[0];
    const { expiresAt, isExpired } = getPaymentExpiration(order);

    return `
        <div class="account-payment-actions" id="accountPaymentActions">
            <p>${isExpired
                ? "Este pagamento venceu. Gere um novo codigo para continuar."
                : "Voce pode ver as instrucoes atuais, trocar a forma de pagamento ou gerar um novo codigo."}</p>
            ${expiresAt ? `<p class="account-payment-actions-expiration">Validade atual: ${escapeHtml(formatDateTime(expiresAt))}${isExpired ? " (expirado)" : ""}</p>` : ""}
            <div class="account-payment-actions-controls">
                <select data-order-payment-method>
                    ${availableMethods.map((method) => `
                        <option value="${escapeHtml(method)}" ${method === selectedMethod ? "selected" : ""}>${escapeHtml(getPaymentMethodLabel(method))}</option>
                    `).join("")}
                </select>
                <button type="button" class="account-order-pay-now-button" data-order-pay-now="true">Pagar agora</button>
            </div>
        </div>
    `;
}

function maybeAutoOpenPaymentArea() {
    if (!shouldAutoOpenPaymentArea()) {
        return;
    }

    const paymentPanel = document.getElementById("accountPaymentPanel");

    if (!paymentPanel) {
        return;
    }

    paymentPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderOrderDetail(order) {
    if (!accountOrderDetailContent) {
        return;
    }

    currentOrder = order;
    const statusMeta = getOrderStatusMeta(order.orderStatus);

    if (accountOrderDetailTitle) {
        accountOrderDetailTitle.textContent = order.orderNumber || "Detalhes do pedido";
    }

    accountOrderDetailContent.innerHTML = `
        <article class="account-order-card">
            <div class="account-order-top">
                <div>
                    <p class="account-order-number">${escapeHtml(order.orderNumber || "Pedido")}</p>
                    <div class="account-order-meta">
                        <span>Feito em ${escapeHtml(formatDateTime(order.createdAt))}</span>
                        <span>${escapeHtml(formatCurrency(order.totals?.total || 0))}</span>
                        <span>${escapeHtml((order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0))} item(ns)</span>
                    </div>
                </div>
                <span class="account-order-status-pill ${escapeHtml(statusMeta.pillClass)}">${escapeHtml(statusMeta.label)}</span>
            </div>

            ${order.orderStatus === "cancelled" ? "" : `
                <div class="account-order-progress">
                    ${renderProgressSteps(order)}
                </div>
            `}

            <div class="account-order-detail-grid">
                <section class="account-order-panel">
                    <h3>Produtos</h3>
                    <div class="account-order-items">
                        ${renderOrderItems(order.items || [])}
                    </div>
                </section>

                <section class="account-order-panel">
                    <h3>Resumo</h3>
                    <div class="account-order-detail-list">
                        <div class="account-order-detail-row">
                            <strong>Subtotal</strong>
                            <span>${escapeHtml(formatCurrency(order.totals?.subtotal || 0))}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Frete</strong>
                            <span>${escapeHtml(formatCurrency(order.totals?.shipping || 0))}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Total</strong>
                            <span>${escapeHtml(formatCurrency(order.totals?.total || 0))}</span>
                        </div>
                    </div>
                </section>

                <section class="account-order-panel">
                    <h3>Entrega</h3>
                    <div class="account-order-detail-list">
                        <div class="account-order-detail-row">
                            <strong>Status</strong>
                            <span>${escapeHtml(statusMeta.label)}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>${escapeHtml(order.shippingIntegration?.provider === "motoboy" ? "Entrega local" : "Codigo de rastreio")}</strong>
                            <span>${escapeHtml(renderTrackingValue(order))}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Transportadora</strong>
                            <span>${escapeHtml(order.shippingIntegration?.companyName || order.tracking?.carrier || "-")}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Endereco</strong>
                            <span>${escapeHtml(`${order.shippingAddress?.street || "-"}, ${order.shippingAddress?.number || "-"}`)}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Bairro</strong>
                            <span>${escapeHtml(order.shippingAddress?.neighborhood || "-")}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Cidade/UF</strong>
                            <span>${escapeHtml(`${order.shippingAddress?.city || "-"} / ${order.shippingAddress?.state || "-"}`)}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>CEP</strong>
                            <span>${escapeHtml(order.shippingAddress?.zipCode || "-")}</span>
                        </div>
                    </div>
                </section>

                <section class="account-order-panel" id="accountPaymentPanel">
                    <h3>Pagamento</h3>
                    <div class="account-order-detail-list">
                        <div class="account-order-detail-row">
                            <strong>Metodo</strong>
                            <span>${escapeHtml(getPaymentMethodLabel(order.payment?.method))}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Status</strong>
                            <span>${escapeHtml(order.payment?.status || "-")}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Fornecedor</strong>
                            <span>${escapeHtml(order.payment?.provider || "-")}</span>
                        </div>
                    </div>
                    ${buildPendingPaymentActionMarkup(order)}
                    ${buildPaymentInstructionsMarkup(order)}
                </section>

                <section class="account-order-panel">
                    <h3>Cliente</h3>
                    <div class="account-order-detail-list">
                        <div class="account-order-detail-row">
                            <strong>Nome</strong>
                            <span>${escapeHtml(order.customer?.name || "-")}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Email</strong>
                            <span>${escapeHtml(order.customer?.email || "-")}</span>
                        </div>
                        <div class="account-order-detail-row">
                            <strong>Telefone</strong>
                            <span>${escapeHtml(order.customer?.phone || "-")}</span>
                        </div>
                    </div>
                </section>

                <section class="account-order-panel">
                    <h3>Historico do pedido</h3>
                    <div class="account-order-history">
                        ${renderOrderHistory(order.statusHistory || [])}
                    </div>
                </section>
            </div>
        </article>
    `;

    maybeAutoOpenPaymentArea();
}

async function fetchOrderDetail(orderId) {
    const response = await fetch(`/api/auth/orders/${encodeURIComponent(orderId)}`);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Nao foi possivel carregar os detalhes do pedido.");
    }

    return result.order || {};
}

async function requestOrderPayment(orderId, paymentMethod) {
    const response = await fetch(`/api/auth/orders/${encodeURIComponent(orderId)}/pay`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ paymentMethod })
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Nao foi possivel iniciar o pagamento deste pedido.");
    }

    return result;
}

async function handlePayNowAction(buttonElement) {
    const orderId = getOrderIdFromPath();

    if (!orderId || paymentActionRequestInFlight) {
        return;
    }

    const paymentMethodSelect = accountOrderDetailContent?.querySelector("[data-order-payment-method]");
    const paymentMethod = String(paymentMethodSelect?.value || currentOrder?.payment?.method || "pix").trim().toLowerCase();

    paymentActionRequestInFlight = true;
    buttonElement.disabled = true;
    const previousLabel = buttonElement.textContent;
    buttonElement.textContent = "Processando...";

    try {
        hideOrderDetailError();
        const result = await requestOrderPayment(orderId, paymentMethod);
        renderOrderDetail(result.order || currentOrder || {});

        if (window.showSiteToast) {
            window.showSiteToast(result.message || "Pagamento atualizado com sucesso.", "success", {
                duration: 4600
            });
        }
    } catch (error) {
        showOrderDetailError(error.message);
        buttonElement.disabled = false;
        buttonElement.textContent = previousLabel;
    } finally {
        paymentActionRequestInFlight = false;
    }
}

async function handleCopyPaymentValue(targetId) {
    const target = document.getElementById(targetId);

    if (!(target instanceof HTMLTextAreaElement)) {
        return;
    }

    const value = target.value || "";

    if (!value) {
        return;
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
        } else {
            target.focus();
            target.select();
            document.execCommand("copy");
        }

        if (window.showSiteToast) {
            window.showSiteToast("Conteudo copiado com sucesso.", "success", {
                duration: 2600
            });
        }
    } catch (_error) {
        showOrderDetailError("Nao foi possivel copiar o conteudo agora.");
    }
}

if (accountOrderDetailContent) {
    accountOrderDetailContent.addEventListener("click", async (event) => {
        const payNowButton = event.target.closest("[data-order-pay-now]");

        if (payNowButton instanceof HTMLButtonElement) {
            event.preventDefault();
            await handlePayNowAction(payNowButton);
            return;
        }

        const copyButton = event.target.closest("[data-copy-payment-target]");

        if (copyButton instanceof HTMLButtonElement) {
            event.preventDefault();
            const targetId = copyButton.getAttribute("data-copy-payment-target") || "";
            await handleCopyPaymentValue(targetId);
        }
    });
}

async function loadOrderDetail() {
    const orderId = getOrderIdFromPath();

    if (!orderId) {
        showOrderDetailError("Pedido invalido.");
        return;
    }

    try {
        hideOrderDetailError();
        const order = await fetchOrderDetail(orderId);
        renderOrderDetail(order);
    } catch (error) {
        showOrderDetailError(error.message);
        window.setTimeout(() => {
            window.location.href = "/meus-pedidos";
        }, 1200);
    }
}
loadSharedCategories();
updateCartCount();
loadOrderDetail();
