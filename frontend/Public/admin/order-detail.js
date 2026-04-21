const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const feedbackBox = document.getElementById("adminOrderDetailFeedback");
const detailShell = document.getElementById("adminOrderDetailShell");
const orderDeleteButton = document.getElementById("adminOrderDeleteButton");
const orderNumberElement = document.getElementById("adminOrderNumber");
const orderMetaElement = document.getElementById("adminOrderMeta");
const orderStatusPill = document.getElementById("adminOrderStatusPill");
const orderStatusSelect = document.getElementById("adminOrderStatusSelect");
const orderTrackingCodeInput = document.getElementById("adminOrderTrackingCode");
const orderStatusSaveButton = document.getElementById("adminOrderStatusSaveButton");
const orderCustomerElement = document.getElementById("adminOrderCustomer");
const orderShippingElement = document.getElementById("adminOrderShipping");
const orderShipmentInfoElement = document.getElementById("adminOrderShipmentInfo");
const orderPurchaseShippingButton = document.getElementById("adminOrderPurchaseShippingButton");
const orderDownloadLabelButton = document.getElementById("adminOrderDownloadLabelButton");
const orderLocalDeliveryCard = document.getElementById("adminOrderLocalDeliveryCard");
const orderMarkOutForDeliveryButton = document.getElementById("adminOrderMarkOutForDeliveryButton");
const orderMarkDeliveredButton = document.getElementById("adminOrderMarkDeliveredButton");
const orderItemsList = document.getElementById("adminOrderItemsList");
let orderStatusSaveRequestInFlight = false;
let orderPurchaseShippingRequestInFlight = false;
let orderDeleteRequestInFlight = false;
let currentOrder = null;

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

function getOrderIdFromPath() {
    const match = window.location.pathname.match(/^\/admin\/orders\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
}

function getStatusMeta(value = "payment_confirmed") {
    return ORDER_STATUS_META[value] || ORDER_STATUS_META.payment_confirmed;
}

function buildPersonalizationImageFileName(item = {}, itemIndex = 0) {
    const safeOrderNumber = String(currentOrder?.orderNumber || "pedido")
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "pedido";
    const safeItemName = String(item.name || `item-${itemIndex + 1}`)
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || `item-${itemIndex + 1}`;
    const url = String(item.personalizationImageUrl || "");
    const extensionMatch = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "png";

    return `${safeOrderNumber}-${safeItemName}-personalizacao.${extension}`;
}

function renderListItem(label, value) {
    return `
        <div class="admin-order-detail-row">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value || "-")}</span>
        </div>
    `;
}

function syncPreviewTextScale() {
    document.querySelectorAll(".admin-order-preview-canvas").forEach((canvas) => {
        const textElement = canvas.querySelector(".admin-order-preview-text");

        if (!textElement) {
            return;
        }

        const currentWidth = canvas.clientWidth || 0;
        const baseFontSize = Number(textElement.dataset.baseFontSize || 28);
        const referenceWidth = Number(textElement.dataset.referenceWidth || 0) || currentWidth || 1;
        const scalePercent = Number(textElement.dataset.scalePercent || 100) || 100;
        const scaledFontSize = baseFontSize * ((currentWidth || referenceWidth) / referenceWidth) * (scalePercent / 100);

        textElement.style.fontSize = `${scaledFontSize}px`;
        textElement.style.letterSpacing = `${Number(textElement.dataset.letterSpacingEm || 0.04)}em`;
    });
}

async function downloadPersonalizationImage(imageUrl, fileName) {
    if (!imageUrl) {
        throw new Error("Esta imagem de personalizacao nao esta disponivel para download.");
    }

    const response = await fetch(imageUrl, {
        credentials: "omit"
    });

    if (!response.ok) {
        throw new Error("Nao foi possivel baixar a imagem da personalizacao.");
    }

    const imageBlob = await response.blob();
    const objectUrl = window.URL.createObjectURL(imageBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = objectUrl;
    downloadLink.download = fileName || "personalizacao.png";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
    }, 1000);
}

function appendPersonalizationDownloadButtons(items = []) {
    if (!(orderItemsList instanceof HTMLElement)) {
        return;
    }

    const personalizationBlocks = orderItemsList.querySelectorAll(".admin-order-detail-personalization-media");

    personalizationBlocks.forEach((block, itemIndex) => {
        const item = Array.isArray(items) ? items[itemIndex] : null;

        if (!item?.personalizationImageUrl || block.querySelector(".admin-order-download-personalization-button")) {
            return;
        }

        const downloadButton = document.createElement("button");
        downloadButton.type = "button";
        downloadButton.className = "admin-secondary-button admin-order-download-personalization-button";
        downloadButton.dataset.personalizationImageUrl = String(item.personalizationImageUrl || "");
        downloadButton.dataset.personalizationImageName = buildPersonalizationImageFileName(item, itemIndex);
        downloadButton.textContent = item.personalizationImageKind === "upload"
            ? "Baixar imagem enviada pelo cliente"
            : "Baixar imagem da personalizacao";
        block.appendChild(downloadButton);
    });
}

function renderPersonalizationDetails(item = {}, itemIndex = 0) {
    const details = [];
    const hasPersonalizationImage = Boolean(item.personalizationImageUrl);
    const personalizationImageLabel = item.personalizationImageKind === "upload"
        ? "Imagem enviada pelo cliente"
        : "Imagem escolhida na personalizacao";
    const personalizationPreviews = Array.isArray(item.personalizationPreviews) && item.personalizationPreviews.length
        ? item.personalizationPreviews
        : (item.personalizationPreviewImageUrl ? [{
            name: "Prévia",
            imageUrl: item.personalizationPreviewImageUrl,
            textBaseXPercent: item.personalizationPreviewTextBaseXPercent,
            textBaseYPercent: item.personalizationPreviewTextBaseYPercent,
            textWidthPercent: item.personalizationPreviewTextWidthPercent,
            textFontSizePx: item.personalizationPreviewTextFontSizePx,
            referenceWidthPx: item.personalizationPreviewReferenceWidthPx,
            textColor: item.personalizationPreviewTextColor,
            textFontFamily: item.personalizationPreviewTextFontFamily,
            textFontWeight: item.personalizationPreviewTextFontWeight,
            textTransform: item.personalizationPreviewTextTransform,
            letterSpacingEm: item.personalizationPreviewLetterSpacingEm,
            textShadow: item.personalizationPreviewTextShadow,
            textRotationDeg: item.personalizationPreviewTextRotationDeg,
            textOffsetXPercent: item.personalizationTextOffsetXPercent,
            textOffsetYPercent: item.personalizationTextOffsetYPercent,
            textScalePercent: item.personalizationTextScalePercent,
            overlayImageUrl: item.personalizationImageUrl,
            overlayImagePublicId: item.personalizationImagePublicId,
            overlayImageKind: item.personalizationImageKind,
            overlayBaseXPercent: item.personalizationImageBaseXPercent,
            overlayBaseYPercent: item.personalizationImageBaseYPercent,
            overlayBaseMaxWidthPercent: item.personalizationImageBaseMaxWidthPercent,
            overlayBaseMaxHeightPercent: item.personalizationImageBaseMaxHeightPercent,
            overlayBaseRotationDeg: item.personalizationImageBaseRotationDeg,
            overlayImageIsRound: item.personalizationImageIsRound,
            overlayImageOffsetXPercent: item.personalizationImageOffsetXPercent,
            overlayImageOffsetYPercent: item.personalizationImageOffsetYPercent,
            overlayImageScalePercent: item.personalizationImageScalePercent
        }] : []);

    if (personalizationPreviews.length) {
        details.push(personalizationPreviews.map((preview) => `
            ${preview.name ? `<strong>${escapeHtml(preview.name)}</strong>` : ""}
            <div class="admin-order-preview-canvas">
                <img src="${escapeHtml(preview.imageUrl)}" alt="Prévia do produto personalizado" class="admin-order-preview-base">
                ${preview.overlayImageUrl ? `
                    <img
                        src="${escapeHtml(preview.overlayImageUrl)}"
                        alt="Imagem escolhida na personalização"
                        class="admin-order-preview-overlay"
                        style="
                            left:${Number(preview.overlayBaseXPercent || 50) + Number(preview.overlayImageOffsetXPercent || 0)}%;
                            top:${Number(preview.overlayBaseYPercent || 50) + Number(preview.overlayImageOffsetYPercent || 0)}%;
                            max-width:${Number(preview.overlayBaseMaxWidthPercent || 34) * (Number(preview.overlayImageScalePercent || 100) / 100)}%;
                            max-height:${Number(preview.overlayBaseMaxHeightPercent || 34) * (Number(preview.overlayImageScalePercent || 100) / 100)}%;
                            border-radius:${preview.overlayImageIsRound ? "50%" : "0"};
                            transform:translate(-50%, -50%) rotate(${Number(preview.overlayBaseRotationDeg || 0)}deg);
                        "
                    >
                ` : ""}
                ${item.personalizationName ? `
                    <div
                        class="admin-order-preview-text"
                        style="
                            left:${Number(preview.textBaseXPercent || 50) + Number(preview.textOffsetXPercent || 0)}%;
                            top:${Number(preview.textBaseYPercent || 50) + Number(preview.textOffsetYPercent || 0)}%;
                            width:${Number(preview.textWidthPercent || 60)}%;
                            color:${escapeHtml(preview.textColor || "#ffffff")};
                            font-family:${escapeHtml(preview.textFontFamily || "'Georgia', 'Times New Roman', serif")};
                            font-weight:${escapeHtml(preview.textFontWeight || "700")};
                            text-transform:${escapeHtml(preview.textTransform || "uppercase")};
                            text-shadow:${escapeHtml(preview.textShadow || "0 2px 10px rgba(0, 0, 0, 0.35)")};
                            transform:translate(-50%, -50%) rotate(${Number(preview.textRotationDeg || 0)}deg);
                        "
                        data-base-font-size="${Number(preview.textFontSizePx || 28)}"
                        data-reference-width="${Number(preview.referenceWidthPx || 0)}"
                        data-scale-percent="${Number(preview.textScalePercent || 100)}"
                        data-letter-spacing-em="${Number(preview.letterSpacingEm ?? 0.04)}"
                    >${escapeHtml(preview.textTransform === "none" ? item.personalizationName : item.personalizationName.toUpperCase())}</div>
                ` : ""}
            </div>
        `).join(""));
    }

    if (item.personalizationName) {
        details.push(renderListItem("Nome da gravação", item.personalizationName));
        details.push(renderListItem("Posicao do nome", `X ${Number(item.personalizationTextOffsetXPercent || 0)}% | Y ${Number(item.personalizationTextOffsetYPercent || 0)}%`));
        details.push(renderListItem("Tamanho do nome", `${Number(item.personalizationTextScalePercent || 100)}%`));
    }

    if (Array.isArray(item.selectedVariations)) {
        item.selectedVariations.forEach((variation) => {
            details.push(renderListItem(
                variation.variationName || "Variação",
                `${variation.itemLabel || "-"}${variation.price !== null && variation.price !== undefined ? ` (${formatCurrency(variation.price)})` : ""}`
            ));
        });
    }

    if (hasPersonalizationImage) {
        details.push(`
            <div class="admin-order-detail-personalization-media">
                <strong>${escapeHtml(personalizationImageLabel)}</strong>
                <img src="${escapeHtml(item.personalizationImageUrl)}" alt="Imagem escolhida na personalização">
            </div>
        `);
        details.push(renderListItem("Posicao da imagem", `X ${Number(item.personalizationImageOffsetXPercent || 0)}% | Y ${Number(item.personalizationImageOffsetYPercent || 0)}%`));
        details.push(renderListItem("Tamanho da imagem", `${Number(item.personalizationImageScalePercent || 100)}%`));
    } else if (item.personalizationImageKind === "upload") {
        details.push(`
            <div class="admin-order-detail-note">
                Imagem enviada pelo cliente. Solicite o arquivo pelo WhatsApp para finalizar a personalização.
            </div>
        `);
    }

    return details.join("");
}

function renderOrder(order) {
    currentOrder = order;
    const statusMeta = getStatusMeta(order.orderStatus);

    if (orderNumberElement) {
        orderNumberElement.textContent = order.orderNumber || "-";
    }

    if (orderMetaElement) {
        orderMetaElement.innerHTML = `
            <div class="admin-order-detail-row">
                <strong>Data</strong>
                <span>${escapeHtml(formatDateTime(order.createdAt))}</span>
            </div>
            <div class="admin-order-detail-row">
                <strong>Total</strong>
                <span>${escapeHtml(formatCurrency(order.totals?.total || 0))}</span>
            </div>
            <div class="admin-order-detail-row">
                <strong>Pagamento</strong>
                <span>${escapeHtml(order.payment?.status === "approved" ? "Confirmado" : order.payment?.status || "-")}</span>
            </div>
        `;
    }

    if (orderStatusPill) {
        orderStatusPill.textContent = statusMeta.label;
        orderStatusPill.className = `admin-products-status-pill ${statusMeta.pillClass}`.trim();
    }

    if (orderStatusSelect) {
        orderStatusSelect.innerHTML = Object.entries(ORDER_STATUS_META).map(([value, meta]) => `
            <option value="${escapeHtml(value)}" ${order.orderStatus === value ? "selected" : ""}>${escapeHtml(meta.label)}</option>
        `).join("");
    }

    if (orderTrackingCodeInput) {
        orderTrackingCodeInput.value = order.tracking?.code || "";
    }

    if (orderCustomerElement) {
        orderCustomerElement.innerHTML = [
            renderListItem("Nome", order.customer?.name),
            renderListItem("Email", order.customer?.email),
            renderListItem("Telefone", order.customer?.phone)
        ].join("");
    }

    if (orderShippingElement) {
        const shipping = order.shippingAddress || {};
        orderShippingElement.innerHTML = [
            renderListItem("CEP", shipping.zipCode),
            renderListItem("Endereço", `${shipping.street || "-"}, ${shipping.number || "-"}`),
            renderListItem("Bairro", shipping.neighborhood),
            renderListItem("Cidade/UF", `${shipping.city || "-"} / ${shipping.state || "-"}`),
            renderListItem("Complemento", shipping.complement || "-"),
            renderListItem("Rastreio", order.tracking?.code || "-")
        ].join("");
    }

    if (orderShipmentInfoElement) {
        const isMotoboy = order.shippingIntegration?.provider === "motoboy";
        orderShipmentInfoElement.innerHTML = [
            renderListItem(isMotoboy ? "Status da entrega local" : "Status da etiqueta", order.shippingIntegration?.status || "Ainda não gerada"),
            renderListItem("Provider", isMotoboy ? "Motoboy" : "Melhor Envio"),
            renderListItem("Serviço", order.shippingIntegration?.serviceName || "-"),
            renderListItem("Transportadora", order.shippingIntegration?.companyName || "-"),
            renderListItem("Custo do frete", formatCurrency(order.shippingIntegration?.quotePrice || 0)),
            renderListItem("Prazo estimado", order.shippingIntegration?.deliveryTime ? `${Number(order.shippingIntegration.deliveryTime)} dia(s)` : "-"),
            renderListItem("Distância", order.shippingIntegration?.distanceKm ? `${Number(order.shippingIntegration.distanceKm).toFixed(2)} km` : "-"),
            renderListItem("Origem", order.shippingIntegration?.originLabel || "-"),
            renderListItem(isMotoboy ? "Janela operacional" : "ID Melhor Envio", isMotoboy ? (order.shippingIntegration?.deliveryWindowLabel || order.shippingIntegration?.payload?.notes || "-") : (order.shippingIntegration?.melhorEnvioCartId || "-"))
        ].join("");
    }

    if (orderPurchaseShippingButton) {
        const isMotoboy = order.shippingIntegration?.provider === "motoboy";
        orderPurchaseShippingButton.disabled = !order.shippingIntegration?.serviceId || isMotoboy;
        orderPurchaseShippingButton.hidden = isMotoboy;
    }

    if (orderDownloadLabelButton) {
        const isMotoboy = order.shippingIntegration?.provider === "motoboy";
        const hasGeneratedLabel = Boolean(order.shippingIntegration?.melhorEnvioCartId || order.shippingIntegration?.melhorEnvioOrderId);
        orderDownloadLabelButton.disabled = isMotoboy ? false : !hasGeneratedLabel;
        orderDownloadLabelButton.hidden = false;
        orderDownloadLabelButton.textContent = isMotoboy
            ? "Baixar PDF do motoboy"
            : "Baixar / imprimir PDF da etiqueta";
    }

    if (orderLocalDeliveryCard) {
        const isMotoboy = order.shippingIntegration?.provider === "motoboy";
        orderLocalDeliveryCard.hidden = !isMotoboy;
    }

    if (orderItemsList) {
        orderItemsList.innerHTML = (order.items || []).map((item, itemIndex) => `
            <article class="admin-order-item-card">
                <div class="admin-order-item-main">
                    <img src="${escapeHtml(item.imageUrl || "/img/tabua-produto01.webp")}" alt="${escapeHtml(item.name || "Produto")}" class="admin-order-item-image">
                    <div>
                        <div class="admin-product-name">${escapeHtml(item.name || "Produto")}</div>
                        ${Array.isArray(item.selectedVariations) ? item.selectedVariations.map((variation) => `<div class="admin-product-desc">${escapeHtml(variation.variationName || "Variação")}: ${escapeHtml(variation.itemLabel || "-")}${variation.price !== null && variation.price !== undefined ? ` (${escapeHtml(formatCurrency(variation.price))})` : ""}</div>`).join("") : ""}
                        <div class="admin-product-desc">Quantidade: ${Number(item.quantity || 0)} | Valor: ${escapeHtml(formatCurrency(item.price || 0))}</div>
                    </div>
                </div>
                <div class="admin-order-item-details">
                    ${renderPersonalizationDetails(item, itemIndex) || '<div class="admin-order-detail-note">Sem personalização registrada para este item.</div>'}
                </div>
            </article>
        `).join("");

        appendPersonalizationDownloadButtons(order.items || []);
        syncPreviewTextScale();
    }

    if (detailShell) {
        detailShell.hidden = false;
    }
}

async function fetchOrder(orderId) {
    const response = await fetch(`/api/admin/orders/${orderId}`, {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível carregar o pedido.");
    }

    return result;
}

async function updateOrderStatus(orderId, orderStatus, trackingCode) {
    const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            orderStatus,
            trackingCode
        })
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível atualizar o pedido.");
    }

    return result;
}

async function saveLocalDeliveryStatus(nextStatus, successMessage, loadingButton, loadingText) {
    if (!currentOrderId || orderStatusSaveRequestInFlight) {
        return;
    }

    orderStatusSaveRequestInFlight = true;
    setButtonLoading(loadingButton, true, loadingText);

    try {
        const updatedOrder = await updateOrderStatus(
            currentOrderId,
            nextStatus,
            orderTrackingCodeInput ? orderTrackingCodeInput.value : ""
        );
        renderOrder(updatedOrder);
        showFeedback(successMessage, "success");
    } catch (error) {
        showFeedback(error.message, "error");
    } finally {
        orderStatusSaveRequestInFlight = false;
        setButtonLoading(loadingButton, false, loadingText);
    }
}

async function purchaseOrderShipping(orderId) {
    const response = await fetch(`/api/admin/orders/${orderId}/melhor-envio/purchase`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Não foi possível comprar o frete deste pedido.");
    }

    return result;
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
        throw new Error(result.message || "Não foi possível excluir este pedido.");
    }

    return result;
}

function downloadOrderLabel(orderId) {
    window.open(`/api/admin/orders/${encodeURIComponent(orderId)}/melhor-envio/label`, "_blank", "noopener");
}

let currentOrderId = "";

async function loadOrderDetails() {
    clearFeedback();
    currentOrderId = getOrderIdFromPath();

    if (!currentOrderId) {
        showFeedback("Pedido inválido.", "error");
        return;
    }

    try {
        const order = await fetchOrder(currentOrderId);

        if (!order) {
            return;
        }

        renderOrder(order);
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

if (orderStatusSaveButton) {
    orderStatusSaveButton.addEventListener("click", async () => {
        if (!currentOrderId || !orderStatusSelect || orderStatusSaveRequestInFlight) {
            return;
        }

        orderStatusSaveRequestInFlight = true;
        setButtonLoading(orderStatusSaveButton, true, "Salvando...");

        try {
            const updatedOrder = await updateOrderStatus(
                currentOrderId,
                orderStatusSelect.value,
                orderTrackingCodeInput ? orderTrackingCodeInput.value : ""
            );
            orderStatusSaveRequestInFlight = false;
            setButtonLoading(orderStatusSaveButton, false, "Salvando...");
            renderOrder(updatedOrder);
            showFeedback("Pedido atualizado com sucesso.", "success");
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            if (orderStatusSaveRequestInFlight) {
                orderStatusSaveRequestInFlight = false;
                setButtonLoading(orderStatusSaveButton, false, "Salvando...");
            }
        }
    });
}

if (orderPurchaseShippingButton) {
    orderPurchaseShippingButton.addEventListener("click", async () => {
        if (!currentOrderId || orderPurchaseShippingRequestInFlight) {
            return;
        }

        orderPurchaseShippingRequestInFlight = true;
        setButtonLoading(orderPurchaseShippingButton, true, "Gerando...");

        try {
            const result = await purchaseOrderShipping(currentOrderId);
            orderPurchaseShippingRequestInFlight = false;
            setButtonLoading(orderPurchaseShippingButton, false, "Gerando...");

            if (result?.order) {
                renderOrder(result.order);
            }

            showFeedback(result.message || "Etiqueta gerada com sucesso.", "success");
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            if (orderPurchaseShippingRequestInFlight) {
                orderPurchaseShippingRequestInFlight = false;
                setButtonLoading(orderPurchaseShippingButton, false, "Gerando...");
            }
        }
    });
}

if (orderDownloadLabelButton) {
    orderDownloadLabelButton.addEventListener("click", () => {
        if (!currentOrderId || orderDownloadLabelButton.disabled) {
            return;
        }

        downloadOrderLabel(currentOrderId);
    });
}

if (orderDeleteButton) {
    orderDeleteButton.addEventListener("click", async () => {
        if (!currentOrderId || orderDeleteRequestInFlight) {
            return;
        }

        const confirmed = window.confirm("Deseja excluir este pedido permanentemente? Esta ação remove as informações e as imagens vinculadas.");

        if (!confirmed) {
            return;
        }

        orderDeleteRequestInFlight = true;
        setButtonLoading(orderDeleteButton, true, "Excluindo...");

        try {
            const result = await deleteOrder(currentOrderId);
            showFeedback(result.message || "Pedido excluído com sucesso.", "success");
            window.location.href = "/admin/orders";
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            orderDeleteRequestInFlight = false;
            setButtonLoading(orderDeleteButton, false, "Excluindo...");
        }
    });
}

if (orderMarkOutForDeliveryButton) {
    orderMarkOutForDeliveryButton.addEventListener("click", async () => {
        await saveLocalDeliveryStatus(
            "shipped",
            "Pedido marcado como saiu para entrega.",
            orderMarkOutForDeliveryButton,
            "Atualizando..."
        );
    });
}

if (orderMarkDeliveredButton) {
    orderMarkDeliveredButton.addEventListener("click", async () => {
        await saveLocalDeliveryStatus(
            "delivered",
            "Pedido marcado como entregue.",
            orderMarkDeliveredButton,
            "Salvando..."
        );
    });
}

if (orderItemsList) {
    orderItemsList.addEventListener("click", async (event) => {
        const downloadButton = event.target instanceof Element
            ? event.target.closest(".admin-order-download-personalization-button")
            : null;

        if (!(downloadButton instanceof HTMLButtonElement)) {
            return;
        }

        const imageUrl = downloadButton.dataset.personalizationImageUrl || "";
        const fileName = downloadButton.dataset.personalizationImageName || "personalizacao.png";

        try {
            setButtonLoading(downloadButton, true, "Baixando...");
            await downloadPersonalizationImage(imageUrl, fileName);
        } catch (error) {
            showFeedback(error.message || "Nao foi possivel baixar a imagem da personalizacao.", "error");
        } finally {
            setButtonLoading(downloadButton, false, "Baixando...");
        }
    });
}

window.addEventListener("resize", syncPreviewTextScale);

loadOrderDetails();
