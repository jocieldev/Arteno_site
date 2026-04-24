const crypto = require("node:crypto");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeEmail(value = "") {
    return normalizeText(value).toLowerCase();
}

function normalizePrice(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function normalizeInteger(value, fallback = 1) {
    const normalized = Number.parseInt(value, 10);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizeDocumentNumber(value = "") {
    return String(value || "").replace(/\D/g, "");
}

function splitCustomerName(name = "") {
    const parts = normalizeText(name).split(/\s+/).filter(Boolean);

    if (!parts.length) {
        return {
            firstName: "",
            lastName: ""
        };
    }

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(" ")
    };
}

function inferMercadoPagoMode(accessToken = "") {
    return normalizeText(accessToken).startsWith("APP_USR-") ? "production" : "sandbox";
}

function getMercadoPagoConfig() {
    const accessToken = normalizeText(process.env.MERCADO_PAGO_ACCESS_TOKEN);
    const publicKey = normalizeText(process.env.MERCADO_PAGO_PUBLIC_KEY);
    const webhookSecret = normalizeText(process.env.MERCADO_PAGO_WEBHOOK_SECRET);
    const notificationUrl = normalizeText(process.env.MERCADO_PAGO_NOTIFICATION_URL);
    const statementDescriptor = normalizeText(process.env.MERCADO_PAGO_STATEMENT_DESCRIPTOR || "ARTENO").slice(0, 13);

    return {
        accessToken,
        publicKey,
        webhookSecret,
        notificationUrl,
        statementDescriptor,
        isConfigured: Boolean(accessToken && publicKey),
        mode: inferMercadoPagoMode(accessToken),
        timeoutMs: 15000
    };
}

function isMercadoPagoReady() {
    return getMercadoPagoConfig().isConfigured;
}

async function requestMercadoPago(pathname, { method = "GET", body, headers = {} } = {}) {
    const config = getMercadoPagoConfig();

    if (!config.accessToken) {
        const error = new Error("Configure MERCADO_PAGO_ACCESS_TOKEN no backend para ativar o checkout real.");
        error.status = 503;
        throw error;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
        const response = await fetch(`https://api.mercadopago.com${pathname}`, {
            method,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "application/json",
                ...headers
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal
        });

        const responseText = await response.text();
        let parsedResponse = null;

        try {
            parsedResponse = responseText ? JSON.parse(responseText) : null;
        } catch (_error) {
            parsedResponse = null;
        }

        if (!response.ok) {
            const error = new Error(
                parsedResponse?.message
                || parsedResponse?.error
                || parsedResponse?.cause?.[0]?.description
                || "Não foi possível processar o pagamento no Mercado Pago."
            );
            error.status = response.status || 502;
            error.details = parsedResponse || responseText;
            throw error;
        }

        return parsedResponse;
    } finally {
        clearTimeout(timeoutId);
    }
}

function buildMercadoPagoPayer({ customer = {}, shippingAddress = {}, formData = {} }) {
    const { firstName, lastName } = splitCustomerName(customer.name);
    const formPayer = formData.payer && typeof formData.payer === "object" ? formData.payer : {};
    const identification = formPayer.identification && typeof formPayer.identification === "object"
        ? formPayer.identification
        : {};

    return {
        email: normalizeEmail(formPayer.email || customer.email),
        first_name: normalizeText(formPayer.first_name || firstName),
        last_name: normalizeText(formPayer.last_name || lastName),
        identification: {
            type: normalizeText(identification.type || "CPF"),
            number: normalizeDocumentNumber(identification.number || customer.documentNumber)
        },
        address: {
            zip_code: normalizeText(shippingAddress.zipCode),
            street_name: normalizeText(shippingAddress.street),
            street_number: normalizeText(shippingAddress.number),
            neighborhood: normalizeText(shippingAddress.neighborhood),
            city: normalizeText(shippingAddress.city),
            federal_unit: normalizeText(shippingAddress.state).toUpperCase()
        }
    };
}

function buildAdditionalInfo({ items = [], customer = {}, shippingAddress = {} }) {
    return {
        items: items.map((item = {}) => ({
            id: normalizeText(item.productId || item.slug || item.cartKey),
            title: normalizeText(item.name || "Produto"),
            description: normalizeText(item.personalizationName),
            quantity: normalizeInteger(item.quantity, 1),
            unit_price: normalizePrice(item.price),
            picture_url: normalizeText(item.imageUrl)
        })),
        payer: {
            first_name: splitCustomerName(customer.name).firstName,
            last_name: splitCustomerName(customer.name).lastName,
            phone: {
                number: normalizeText(customer.phone)
            },
            address: {
                zip_code: normalizeText(shippingAddress.zipCode),
                street_name: normalizeText(shippingAddress.street),
                street_number: normalizeText(shippingAddress.number)
            }
        },
        shipments: {
            receiver_address: {
                zip_code: normalizeText(shippingAddress.zipCode),
                street_name: normalizeText(shippingAddress.street),
                street_number: normalizeText(shippingAddress.number),
                floor: normalizeText(shippingAddress.complement),
                apartment: normalizeText(shippingAddress.complement),
                neighborhood: normalizeText(shippingAddress.neighborhood),
                city_name: normalizeText(shippingAddress.city),
                state_name: normalizeText(shippingAddress.state).toUpperCase()
            }
        }
    };
}

function buildMercadoPagoPaymentBody({ amount, description, customer, shippingAddress, items, orderNumber, formData = {} }) {
    const config = getMercadoPagoConfig();
    const payer = buildMercadoPagoPayer({ customer, shippingAddress, formData });
    const paymentMethodId = normalizeText(formData.payment_method_id || formData.paymentMethodId);
    const transactionAmount = normalizePrice(amount, amount);
    const installments = normalizeInteger(formData.installments, 1);
    const token = normalizeText(formData.token);
    const issuerId = normalizeText(formData.issuer_id || formData.issuerId);
    const body = {
        transaction_amount: transactionAmount,
        description: normalizeText(description || `Pedido ${orderNumber}`),
        payment_method_id: paymentMethodId,
        installments,
        payer,
        external_reference: orderNumber,
        additional_info: buildAdditionalInfo({ items, customer, shippingAddress }),
        binary_mode: false
    };

    if (config.notificationUrl) {
        body.notification_url = config.notificationUrl;
    }

    if (config.statementDescriptor) {
        body.statement_descriptor = config.statementDescriptor;
    }

    if (token) {
        body.token = token;
    }

    if (issuerId) {
        body.issuer_id = issuerId;
    }

    if (paymentMethodId === "pix") {
        body.date_of_expiration = new Date(Date.now() + (30 * 60 * 1000)).toISOString();
    }

    if (paymentMethodId.startsWith("bol")) {
        body.date_of_expiration = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toISOString();
    }

    return body;
}

async function createMercadoPagoPayment({ amount, description, customer, shippingAddress, items, orderNumber, formData }) {
    return requestMercadoPago("/v1/payments", {
        method: "POST",
        body: buildMercadoPagoPaymentBody({
            amount,
            description,
            customer,
            shippingAddress,
            items,
            orderNumber,
            formData
        }),
        headers: {
            "X-Idempotency-Key": crypto.randomUUID()
        }
    });
}

async function getMercadoPagoPayment(paymentId) {
    const normalizedPaymentId = normalizeText(paymentId);

    if (!normalizedPaymentId) {
        const error = new Error("Identificador de pagamento do Mercado Pago inválido.");
        error.status = 400;
        throw error;
    }

    return requestMercadoPago(`/v1/payments/${encodeURIComponent(normalizedPaymentId)}`);
}

function parseMercadoPagoSignature(signature = "") {
    return String(signature || "")
        .split(",")
        .map((part) => part.trim())
        .reduce((accumulator, part) => {
            const [key, value] = part.split("=");

            if (key && value) {
                accumulator[key.trim()] = value.trim();
            }

            return accumulator;
        }, {});
}

function verifyMercadoPagoWebhookSignature(req) {
    const config = getMercadoPagoConfig();

    if (!config.webhookSecret) {
        return true;
    }

    const signature = parseMercadoPagoSignature(req.headers["x-signature"] || "");
    const requestId = normalizeText(req.headers["x-request-id"]);
    const dataId = normalizeText(
        req.query?.["data.id"]
        || req.query?.id
        || req.body?.data?.id
        || req.body?.id
    ).toLowerCase();
    const manifest = `id:${dataId};request-id:${requestId};ts:${normalizeText(signature.ts)};`;
    const generated = crypto
        .createHmac("sha256", config.webhookSecret)
        .update(manifest)
        .digest("hex");
    const received = normalizeText(signature.v1);

    if (!received || received.length !== generated.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(received));
}

function mapMercadoPagoStatusToOrderStatus(status = "") {
    const normalizedStatus = normalizeText(status).toLowerCase();

    if (normalizedStatus === "approved") {
        return "payment_confirmed";
    }

    if ([
        "pending",
        "in_process",
        "authorized",
        "in_mediation"
    ].includes(normalizedStatus)) {
        return "payment_pending";
    }

    if ([
        "rejected",
        "cancelled",
        "refunded",
        "charged_back"
    ].includes(normalizedStatus)) {
        return "cancelled";
    }

    return "payment_pending";
}

function buildMercadoPagoPublicConfig() {
    const config = getMercadoPagoConfig();

    return {
        provider: "mercado_pago",
        checkout: "payment_brick",
        publicKey: config.publicKey,
        hasPublicKey: Boolean(config.publicKey),
        isConfigured: config.isConfigured,
        isDevelopmentMode: !config.isConfigured,
        mode: config.mode,
        hasWebhookSecret: Boolean(config.webhookSecret)
    };
}

module.exports = {
    buildMercadoPagoPublicConfig,
    createMercadoPagoPayment,
    getMercadoPagoConfig,
    getMercadoPagoPayment,
    isMercadoPagoReady,
    mapMercadoPagoStatusToOrderStatus,
    verifyMercadoPagoWebhookSignature
};
