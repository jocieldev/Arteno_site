const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const feedbackBox = document.getElementById("adminOrderDetailFeedback");
const detailShell = document.getElementById("adminOrderDetailShell");
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
const orderItemsList = document.getElementById("adminOrderItemsList");
let orderStatusSaveRequestInFlight = false;
let orderPurchaseShippingRequestInFlight = false;

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

function renderPersonalizationDetails(item = {}) {
    const details = [];
    const hasPreviewCanvas = Boolean(item.personalizationPreviewImageUrl);
    const hasPersonalizationImage = Boolean(item.personalizationImageUrl);
    const personalizationImageLabel = item.personalizationImageKind === "upload"
        ? "Imagem enviada pelo cliente"
        : "Imagem escolhida na personalizacao";
    const previewText = item.personalizationName
        ? (item.personalizationPreviewTextTransform === "none" ? item.personalizationName : item.personalizationName.toUpperCase())
        : "";
    const previewTextLeft = Number(item.personalizationPreviewTextBaseXPercent || 50) + Number(item.personalizationTextOffsetXPercent || 0);
    const previewTextTop = Number(item.personalizationPreviewTextBaseYPercent || 50) + Number(item.personalizationTextOffsetYPercent || 0);
    const previewImageLeft = Number(item.personalizationImageBaseXPercent || 50) + Number(item.personalizationImageOffsetXPercent || 0);
    const previewImageTop = Number(item.personalizationImageBaseYPercent || 50) + Number(item.personalizationImageOffsetYPercent || 0);
    const previewImageWidth = Number(item.personalizationImageBaseMaxWidthPercent || 34) * (Number(item.personalizationImageScalePercent || 100) / 100);
    const previewImageHeight = Number(item.personalizationImageBaseMaxHeightPercent || 34) * (Number(item.personalizationImageScalePercent || 100) / 100);

    if (hasPreviewCanvas) {
        details.push(`
            <div class="admin-order-preview-canvas">
                <img src="${escapeHtml(item.personalizationPreviewImageUrl)}" alt="Prévia do produto personalizado" class="admin-order-preview-base">
                ${hasPersonalizationImage ? `
                    <img
                        src="${escapeHtml(item.personalizationImageUrl)}"
                        alt="Imagem escolhida na personalização"
                        class="admin-order-preview-overlay"
                        style="
                            left:${previewImageLeft}%;
                            top:${previewImageTop}%;
                            max-width:${previewImageWidth}%;
                            max-height:${previewImageHeight}%;
                            border-radius:${item.personalizationImageIsRound ? "50%" : "0"};
                            transform:translate(-50%, -50%) rotate(${Number(item.personalizationImageBaseRotationDeg || 0)}deg);
                        "
                    >
                ` : ""}
                ${previewText ? `
                    <div
                        class="admin-order-preview-text"
                        style="
                            left:${previewTextLeft}%;
                            top:${previewTextTop}%;
                            width:${Number(item.personalizationPreviewTextWidthPercent || 60)}%;
                            color:${escapeHtml(item.personalizationPreviewTextColor || "#ffffff")};
                            font-family:${escapeHtml(item.personalizationPreviewTextFontFamily || "'Georgia', 'Times New Roman', serif")};
                            font-weight:${escapeHtml(item.personalizationPreviewTextFontWeight || "700")};
                            text-transform:${escapeHtml(item.personalizationPreviewTextTransform || "uppercase")};
                            text-shadow:${escapeHtml(item.personalizationPreviewTextShadow || "0 2px 10px rgba(0, 0, 0, 0.35)")};
                            transform:translate(-50%, -50%) rotate(${Number(item.personalizationPreviewTextRotationDeg || 0)}deg);
                        "
                        data-base-font-size="${Number(item.personalizationPreviewTextFontSizePx || 28)}"
                        data-reference-width="${Number(item.personalizationPreviewReferenceWidthPx || 0)}"
                        data-scale-percent="${Number(item.personalizationTextScalePercent || 100)}"
                        data-letter-spacing-em="${Number(item.personalizationPreviewLetterSpacingEm ?? 0.04)}"
                    >${escapeHtml(previewText)}</div>
                ` : ""}
            </div>
        `);
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
        orderShipmentInfoElement.innerHTML = [
            renderListItem("Status da etiqueta", order.shippingIntegration?.status || "Ainda não gerada"),
            renderListItem("Serviço", order.shippingIntegration?.serviceName || "-"),
            renderListItem("Transportadora", order.shippingIntegration?.companyName || "-"),
            renderListItem("Custo do frete", formatCurrency(order.shippingIntegration?.quotePrice || 0)),
            renderListItem("Prazo estimado", order.shippingIntegration?.deliveryTime ? `${Number(order.shippingIntegration.deliveryTime)} dia(s)` : "-"),
            renderListItem("ID Melhor Envio", order.shippingIntegration?.melhorEnvioCartId || "-")
        ].join("");
    }

    if (orderPurchaseShippingButton) {
        orderPurchaseShippingButton.disabled = !order.shippingIntegration?.serviceId;
    }

    if (orderDownloadLabelButton) {
        const hasGeneratedLabel = Boolean(order.shippingIntegration?.melhorEnvioCartId || order.shippingIntegration?.melhorEnvioOrderId);
        orderDownloadLabelButton.disabled = !hasGeneratedLabel;
    }

    if (orderItemsList) {
        orderItemsList.innerHTML = (order.items || []).map((item) => `
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
                    ${renderPersonalizationDetails(item) || '<div class="admin-order-detail-note">Sem personalização registrada para este item.</div>'}
                </div>
            </article>
        `).join("");

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

window.addEventListener("resize", syncPreviewTextScale);

loadOrderDetails();
