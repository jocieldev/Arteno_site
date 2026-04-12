const Product = require("../models/Product");
const { quoteShipmentByProducts, requestMelhorEnvio, requestMelhorEnvioRaw } = require("./melhorEnvioService");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizePhone(value = "") {
    return String(value || "").replace(/\D/g, "");
}

function normalizePostalCode(value = "") {
    return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function normalizeNumber(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
}

function getSenderConfig() {
    const nonCommercial = process.env.MELHOR_ENVIO_NON_COMMERCIAL !== "false";

    return {
        name: normalizeText(process.env.MELHOR_ENVIO_SENDER_NAME),
        phone: normalizePhone(process.env.MELHOR_ENVIO_SENDER_PHONE),
        email: normalizeText(process.env.MELHOR_ENVIO_SENDER_EMAIL),
        document: normalizeText(process.env.MELHOR_ENVIO_SENDER_DOCUMENT),
        companyDocument: normalizeText(process.env.MELHOR_ENVIO_SENDER_COMPANY_DOCUMENT),
        stateRegister: normalizeText(process.env.MELHOR_ENVIO_SENDER_STATE_REGISTER || "ISENTO"),
        address: normalizeText(process.env.MELHOR_ENVIO_SENDER_ADDRESS),
        number: normalizeText(process.env.MELHOR_ENVIO_SENDER_NUMBER),
        complement: normalizeText(process.env.MELHOR_ENVIO_SENDER_COMPLEMENT),
        district: normalizeText(process.env.MELHOR_ENVIO_SENDER_DISTRICT),
        city: normalizeText(process.env.MELHOR_ENVIO_SENDER_CITY),
        postalCode: normalizePostalCode(process.env.MELHOR_ENVIO_FROM_POSTAL_CODE),
        stateAbbr: normalizeText(process.env.MELHOR_ENVIO_SENDER_STATE).toUpperCase(),
        nonCommercial
    };
}

function assertSenderConfig() {
    const sender = getSenderConfig();
    const missingFields = [
        ["MELHOR_ENVIO_SENDER_NAME", sender.name],
        ["MELHOR_ENVIO_SENDER_PHONE", sender.phone],
        ["MELHOR_ENVIO_SENDER_EMAIL", sender.email],
        ["MELHOR_ENVIO_FROM_POSTAL_CODE", sender.postalCode],
        ["MELHOR_ENVIO_SENDER_ADDRESS", sender.address],
        ["MELHOR_ENVIO_SENDER_NUMBER", sender.number],
        ["MELHOR_ENVIO_SENDER_DISTRICT", sender.district],
        ["MELHOR_ENVIO_SENDER_CITY", sender.city],
        ["MELHOR_ENVIO_SENDER_STATE", sender.stateAbbr]
    ]
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (!sender.nonCommercial && !sender.companyDocument && !sender.document) {
        missingFields.push("MELHOR_ENVIO_SENDER_COMPANY_DOCUMENT ou MELHOR_ENVIO_SENDER_DOCUMENT");
    }

    if (missingFields.length) {
        const error = new Error(`Preencha no .env os dados do remetente para comprar a etiqueta: ${missingFields.join(", ")}.`);
        error.status = 503;
        throw error;
    }

    return sender;
}

async function buildOrderProductsPayload(order) {
    const slugs = Array.from(
        new Set(
            (order.items || [])
                .map((item) => normalizeText(item.slug))
                .filter(Boolean)
        )
    );

    if (!slugs.length) {
        const error = new Error("Este pedido não possui slugs de produto salvos para gerar a etiqueta.");
        error.status = 400;
        throw error;
    }

    const products = await Product.find({ slug: { $in: slugs } });
    const productBySlug = new Map(products.map((product) => [product.slug, product]));
    const missingProducts = [];
    const payloadProducts = [];
    const orderItemsPayload = [];

    for (const item of order.items || []) {
        const slug = normalizeText(item.slug);
        const product = productBySlug.get(slug);

        if (!product) {
            missingProducts.push(item.name || slug || "Produto");
            continue;
        }

        const shipping = product.shipping || {};
        const width = normalizeNumber(shipping.widthCm);
        const height = normalizeNumber(shipping.heightCm);
        const length = normalizeNumber(shipping.lengthCm);
        const weight = normalizeNumber(shipping.weightKg);

        if (!width || !height || !length || !weight) {
            const error = new Error(`O produto "${product.name}" ainda não tem peso e dimensões completos para gerar a etiqueta.`);
            error.status = 400;
            throw error;
        }

        const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
        const unitaryValue = normalizeNumber(item.price || product.price, 0);

        payloadProducts.push({
            id: String(product._id),
            width,
            height,
            length,
            weight,
            insurance_value: unitaryValue,
            quantity
        });

        orderItemsPayload.push({
            id: String(product._id),
            name: item.name || product.name,
            quantity,
            unitary_value: unitaryValue
        });
    }

    if (missingProducts.length) {
        const error = new Error(`Não encontrei no catálogo os produtos deste pedido: ${missingProducts.join(", ")}.`);
        error.status = 400;
        throw error;
    }

    return {
        quoteProducts: payloadProducts,
        orderItemsPayload
    };
}

function mapQuoteOption(service = {}) {
    const serviceId = String(service.id || service.service || service.name || "").trim();

    return {
        serviceId,
        serviceName: normalizeText(service.name || service.service || "Frete"),
        companyName: normalizeText(service.company?.name || service.company?.company_name || "Transportadora"),
        price: normalizeNumber(service.custom_price ?? service.price),
        deliveryTime: normalizeNumber(service.custom_delivery_time ?? service.delivery_time),
        packages: Array.isArray(service.packages) ? service.packages : [],
        raw: service
    };
}

function buildRecipientPayload(order) {
    const shipping = order.shippingAddress || {};
    const customer = order.customer || {};

    return {
        name: normalizeText(customer.name),
        phone: normalizePhone(customer.phone),
        email: normalizeText(customer.email),
        address: normalizeText(shipping.street),
        number: normalizeText(shipping.number),
        complement: normalizeText(shipping.complement),
        district: normalizeText(shipping.neighborhood),
        city: normalizeText(shipping.city),
        postal_code: normalizePostalCode(shipping.zipCode),
        state_abbr: normalizeText(shipping.state).toUpperCase()
    };
}

function buildSenderPayload(sender) {
    return {
        name: sender.name,
        phone: sender.phone,
        email: sender.email,
        document: sender.document || undefined,
        company_document: sender.companyDocument || undefined,
        state_register: sender.stateRegister || undefined,
        address: sender.address,
        number: sender.number,
        complement: sender.complement || undefined,
        district: sender.district,
        city: sender.city,
        postal_code: sender.postalCode,
        state_abbr: sender.stateAbbr
    };
}

function buildVolumes(option = {}) {
    const packages = Array.isArray(option.packages) ? option.packages : [];

    if (!packages.length) {
        const error = new Error("A cotação escolhida não retornou os volumes necessários para gerar a etiqueta.");
        error.status = 400;
        throw error;
    }

    return packages.map((item) => ({
        height: normalizeNumber(item.dimensions?.height),
        width: normalizeNumber(item.dimensions?.width),
        length: normalizeNumber(item.dimensions?.length),
        weight: normalizeNumber(item.weight),
        insurance_value: normalizeNumber(item.insurance_value),
        products: Array.isArray(item.products)
            ? item.products.map((product) => ({
                id: String(product.id),
                quantity: Math.max(1, Number.parseInt(product.quantity, 10) || 1)
            }))
            : undefined
    }));
}

async function quoteOrderShipping(order) {
    const { quoteProducts } = await buildOrderProductsPayload(order);
    const recipient = buildRecipientPayload(order);

    if (!recipient.postal_code) {
        const error = new Error("Este pedido não possui CEP de entrega válido para cotação.");
        error.status = 400;
        throw error;
    }

    const services = await quoteShipmentByProducts({
        toPostalCode: recipient.postal_code,
        products: quoteProducts
    });

    return services
        .filter((service) => !service.error)
        .map(mapQuoteOption)
        .filter((option) => option.serviceId);
}

async function purchaseLabelForOrder(order, serviceId) {
    const sender = assertSenderConfig();
    const requestedServiceId = String(serviceId || "").trim();
    const savedServiceId = normalizeText(order.shippingIntegration?.serviceId);
    const options = await quoteOrderShipping(order);
    const selectedOption = options.find((option) => option.serviceId === requestedServiceId || option.serviceId === savedServiceId);

    if (!selectedOption) {
        const error = new Error("A opção de frete escolhida pelo cliente não foi encontrada na cotação atual.");
        error.status = 400;
        throw error;
    }

    const recipient = buildRecipientPayload(order);
    const { orderItemsPayload } = await buildOrderProductsPayload(order);
    const volumes = buildVolumes(selectedOption);

    if (selectedOption.companyName.toLowerCase().includes("correios") && volumes.length > 1) {
        const error = new Error("Esta cotação retornou múltiplos volumes para os Correios. Separe os itens em pedidos menores ou ajuste as dimensões antes de gerar a etiqueta.");
        error.status = 400;
        throw error;
    }

    const cartPayload = {
        from: buildSenderPayload(sender),
        to: recipient,
        products: orderItemsPayload,
        volumes,
        options: {
            receipt: false,
            own_hand: false,
            reverse: false,
            non_commercial: sender.nonCommercial,
            insurance_value: normalizeNumber(order.totals?.subtotal || order.totals?.total)
        },
        service: Number.parseInt(selectedOption.serviceId, 10) || selectedOption.serviceId
    };

    const cartõesponse = await requestMelhorEnvio("/api/v2/me/cart", {
        method: "POST",
        body: cartPayload
    });
    const cartOrderId = String(cartõesponse?.id || cartõesponse?.order?.id || "").trim();

    if (!cartOrderId) {
        const error = new Error("O Melhor Envio não retornou o identificador do frete inserido no carrinho.");
        error.status = 502;
        throw error;
    }

    const checkoutResponse = await requestMelhorEnvio("/api/v2/me/shipment/checkout", {
        method: "POST",
        body: {
            orders: [cartOrderId]
        }
    });
    const generateResponse = await requestMelhorEnvio("/api/v2/me/shipment/generate", {
        method: "POST",
        body: {
            orders: [cartOrderId]
        }
    });

    return {
        selectedOption,
        cartOrderId,
        cartõesponse,
        checkoutResponse,
        generateResponse
    };
}

function extractPrintUrl(payload) {
    if (!payload) {
        return "";
    }

    if (typeof payload === "string" && /^https?:\/\//i.test(payload)) {
        return payload;
    }

    const directCandidates = [
        payload.url,
        payload.link,
        payload.path,
        payload.pdf,
        payload.pdf_url,
        payload.label_url,
        payload.redirect
    ];
    const directMatch = directCandidates.find((value) => typeof value === "string" && value.trim());

    if (directMatch) {
        return directMatch.trim();
    }

    if (Array.isArray(payload.data)) {
        for (const item of payload.data) {
            const nested = extractPrintUrl(item);

            if (nested) {
                return nested;
            }
        }
    }

    if (payload.data && typeof payload.data === "object") {
        const nested = extractPrintUrl(payload.data);

        if (nested) {
            return nested;
        }
    }

    return "";
}

async function getLabelPdfForOrder(order) {
    const melhorEnvioOrderId = normalizeText(order.shippingIntegration?.melhorEnvioCartId || order.shippingIntegration?.melhorEnvioOrderId);

    if (!melhorEnvioOrderId) {
        const error = new Error("Este pedido ainda não possui uma etiqueta gerada no Melhor Envio.");
        error.status = 400;
        throw error;
    }

    let printResponsePayload = null;

    try {
        printResponsePayload = await requestMelhorEnvio("/api/v2/me/shipment/print", {
            method: "POST",
            body: {
                mode: "private",
                orders: [melhorEnvioOrderId]
            }
        });
    } catch (firstError) {
        printResponsePayload = await requestMelhorEnvio("/api/v2/me/shipment/print", {
            method: "POST",
            body: {
                orders: [melhorEnvioOrderId]
            }
        }).catch(() => {
            throw firstError;
        });
    }

    const printUrl = extractPrintUrl(printResponsePayload);

    if (!printUrl) {
        const error = new Error("O Melhor Envio não retornou a URL do PDF da etiqueta.");
        error.status = 502;
        error.details = printResponsePayload;
        throw error;
    }

    const response = /^https?:\/\//i.test(printUrl)
        ? await fetch(printUrl)
        : await requestMelhorEnvioRaw(printUrl.startsWith("/") ? printUrl : `/${printUrl}`, {
            method: "GET",
            headers: {
                Accept: "application/pdf"
            }
        });

    if (!response.ok) {
        const error = new Error("Não foi possível baixar o PDF da etiqueta no Melhor Envio.");
        error.status = response.status || 502;
        throw error;
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
        buffer: Buffer.from(arrayBuffer),
        printUrl,
        printResponsePayload
    };
}

module.exports = {
    quoteOrderShipping,
    purchaseLabelForOrder,
    getLabelPdfForOrder
};
