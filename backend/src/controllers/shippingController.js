const Product = require("../models/Product");
const { quoteShipmentByProducts } = require("../services/melhorEnvioService");

function normalizeZipCode(value = "") {
    return String(value).replace(/\D/g, "").slice(0, 8);
}

function normalizePositiveNumber(value, fallback = 0) {
    const normalized = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizeQuantity(value, fallback = 1) {
    const normalized = Number.parseInt(value, 10);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function getProductShippingProfile(product) {
    const shipping = product?.shipping || {};

    return {
        weightKg: normalizePositiveNumber(shipping.weightKg),
        lengthCm: normalizePositiveNumber(shipping.lengthCm),
        widthCm: normalizePositiveNumber(shipping.widthCm),
        heightCm: normalizePositiveNumber(shipping.heightCm)
    };
}

function getProductProductionDays(product) {
    return normalizeQuantity(product?.shipping?.productionDays, 0);
}

function hasValidShippingProfile(profile) {
    return Boolean(
        profile.weightKg
        && profile.lengthCm
        && profile.widthCm
        && profile.heightCm
    );
}

function buildProductsPayload(product, quantity) {
    const shippingProfile = getProductShippingProfile(product);

    return {
        shippingProfile,
        products: [
            {
                id: String(product._id),
                width: shippingProfile.widthCm,
                height: shippingProfile.heightCm,
                length: shippingProfile.lengthCm,
                weight: shippingProfile.weightKg,
                insurance_value: Number(product.price || 0),
                quantity
            }
        ]
    };
}

function isCorreiosPacOrSedex(service = {}) {
    const serviceName = String(service.name || service.service || "").toLowerCase();
    const companyName = String(service.company?.name || service.company?.company_name || "").toLowerCase();
    const appearsToBeCorreios = companyName.includes("correios") || serviceName.includes("correios");

    return appearsToBeCorreios && (serviceName.includes("sedex") || serviceName.includes("pac"));
}

function mapShippingOption(service = {}) {
    const price = Number(service.custom_price ?? service.price ?? 0);
    const deliveryTime = Number(service.custom_delivery_time ?? service.delivery_time ?? 0);

    return {
        serviceId: String(service.id || service.service || service.name || ""),
        name: String(service.name || service.service || "Frete"),
        company: String(service.company?.name || "Correios"),
        price,
        deliveryTime,
        currency: "BRL"
    };
}

function enrichShippingOption(option = {}, productionDays = 0) {
    const normalizedProductionDays = normalizeQuantity(productionDays, 0);
    const normalizedDeliveryTime = normalizeQuantity(option.deliveryTime, 0);

    return {
        ...option,
        productionDays: normalizedProductionDays,
        totalDeliveryDays: normalizedProductionDays + normalizedDeliveryTime
    };
}

function shouldUseDemoShippingMode() {
    return process.env.SHIPPING_DEMO_MODE !== "false";
}

function buildDemoShippingOptions({ zipCode, quantity, product }) {
    const zipSeed = Number.parseInt(zipCode.slice(-3), 10) || 0;
    const quantityMultiplier = Math.max(1, quantity);
    const basePrice = Number(product?.price || 0);
    const pacPrice = Number(((18 + (zipSeed % 7) + quantityMultiplier * 1.75) + basePrice * 0.012).toFixed(2));
    const sedexPrice = Number(((31 + (zipSeed % 11) + quantityMultiplier * 2.4) + basePrice * 0.018).toFixed(2));
    const pacDays = 6 + (zipSeed % 4);
    const sedexDays = 2 + (zipSeed % 3);

    return [
        {
            serviceId: "demo-pac",
            name: "PAC",
            company: "Correios",
            price: pacPrice,
            deliveryTime: pacDays,
            currency: "BRL"
        },
        {
            serviceId: "demo-sedex",
            name: "SEDEX",
            company: "Correios",
            price: sedexPrice,
            deliveryTime: sedexDays,
            currency: "BRL"
        }
    ].map((option) => enrichShippingOption(option, getProductProductionDays(product)));
}

function normalizeCheckoutItems(items = []) {
    return (Array.isArray(items) ? items : [])
        .map((item = {}) => ({
            productId: String(item?.productId || item?._id || "").trim(),
            slug: String(item?.slug || "").trim(),
            name: String(item?.name || "").trim(),
            quantity: normalizeQuantity(item?.quantity, 1)
        }))
        .filter((item) => item.productId || item.slug);
}

async function resolveCheckoutProducts(items = []) {
    const normalizedItems = normalizeCheckoutItems(items);
    const productIds = Array.from(new Set(normalizedItems.map((item) => item.productId).filter(Boolean)));
    const slugs = Array.from(new Set(normalizedItems.map((item) => item.slug).filter(Boolean)));

    if (!productIds.length && !slugs.length) {
        const error = new Error("Seu carrinho não possui produtos válidos para calcular o frete.");
        error.status = 400;
        throw error;
    }

    const filters = [];

    if (productIds.length) {
        filters.push({ _id: { $in: productIds } });
    }

    if (slugs.length) {
        filters.push({ slug: { $in: slugs } });
    }

    const products = await Product.find(filters.length === 1 ? filters[0] : { $or: filters });
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const productBySlug = new Map(products.map((product) => [product.slug, product]));

    return normalizedItems.map((item) => {
        const product = (item.productId && productById.get(item.productId)) || (item.slug && productBySlug.get(item.slug));

        if (!product) {
            const error = new Error(`Não encontrei o produto "${item.name || item.slug || "Produto"}" para calcular o frete.`);
            error.status = 404;
            throw error;
        }

        return {
            product,
            quantity: item.quantity
        };
    });
}

async function buildCheckoutProductsPayload(items = []) {
    const resolvedItems = await resolveCheckoutProducts(items);
    const groupedProducts = new Map();
    const payloadProducts = [];
    let totalQuantity = 0;
    let referencePrice = 0;
    let productionDays = 0;

    for (const { product, quantity } of resolvedItems) {
        const productId = String(product._id);
        const existingProduct = groupedProducts.get(productId);

        if (existingProduct) {
            existingProduct.quantity += quantity;
            continue;
        }

        groupedProducts.set(productId, {
            product,
            quantity
        });
    }

    for (const { product, quantity } of groupedProducts.values()) {
        const { shippingProfile, products: itemProducts } = buildProductsPayload(product, quantity);

        if (!hasValidShippingProfile(shippingProfile)) {
            const error = new Error(`O produto "${product.name}" ainda não tem peso e dimensões completos para calcular o frete.`);
            error.status = 400;
            throw error;
        }

        payloadProducts.push(...itemProducts);
        totalQuantity += quantity;
        referencePrice += Number(product.price || 0) * quantity;
        productionDays = Math.max(productionDays, getProductProductionDays(product));
    }

    return {
        payloadProducts,
        totalQuantity,
        referencePrice: Number(referencePrice.toFixed(2)),
        productionDays
    };
}

async function quoteShipping(req, res) {
    try {
        const zipCode = normalizeZipCode(req.body.zipCode || req.body.cep);
        const productId = String(req.body.productId || "").trim();
        const quantity = normalizeQuantity(req.body.quantity, 1);

        if (zipCode.length !== 8) {
            return res.status(400).json({
                message: "Informe um CEP válido com 8 números."
            });
        }

        if (!productId) {
            return res.status(400).json({
                message: "Produto não informado para o cálculo de frete."
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                message: "Produto não encontrado para calcular o frete."
            });
        }

        const { shippingProfile, products } = buildProductsPayload(product, quantity);

        if (!hasValidShippingProfile(shippingProfile)) {
            return res.status(400).json({
                message: "Este produto ainda não tem peso e dimensões completos para calcular o frete."
            });
        }

        if (shouldUseDemoShippingMode()) {
            const productionDays = getProductProductionDays(product);
            return res.json({
                zipCode,
                productId,
                quantity,
                isDemo: true,
                productionDays,
                options: buildDemoShippingOptions({
                    zipCode,
                    quantity,
                    product
                })
            });
        }

        const services = await quoteShipmentByProducts({
            toPostalCode: zipCode,
            products
        });
        const filteredOptions = services
            .filter((service) => !service.error)
            .filter(isCorreiosPacOrSedex)
            .map(mapShippingOption)
            .map((option) => enrichShippingOption(option, getProductProductionDays(product)))
            .sort((left, right) => left.price - right.price);

        return res.json({
            zipCode,
            productId,
            quantity,
            isDemo: false,
            productionDays: getProductProductionDays(product),
            options: filteredOptions
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Não foi possível calcular o frete."
        });
    }
}

async function quoteCheckoutShipping(req, res) {
    try {
        const zipCode = normalizeZipCode(req.body.zipCode || req.body.cep);
        const items = Array.isArray(req.body.items) ? req.body.items : [];

        if (zipCode.length !== 8) {
            return res.status(400).json({
                message: "Informe um CEP válido com 8 números."
            });
        }

        if (!items.length) {
            return res.status(400).json({
                message: "Seu carrinho está vazio para calcular o frete."
            });
        }

        const { payloadProducts, totalQuantity, referencePrice, productionDays } = await buildCheckoutProductsPayload(items);

        if (shouldUseDemoShippingMode()) {
            return res.json({
                zipCode,
                isDemo: true,
                productionDays,
                options: buildDemoShippingOptions({
                    zipCode,
                    quantity: totalQuantity,
                    product: {
                        price: referencePrice,
                        shipping: { productionDays }
                    }
                })
            });
        }

        const services = await quoteShipmentByProducts({
            toPostalCode: zipCode,
            products: payloadProducts
        });
        const filteredOptions = services
            .filter((service) => !service.error)
            .filter(isCorreiosPacOrSedex)
            .map(mapShippingOption)
            .map((option) => enrichShippingOption(option, productionDays))
            .sort((left, right) => left.price - right.price);

        return res.json({
            zipCode,
            isDemo: false,
            productionDays,
            options: filteredOptions
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Não foi possível calcular o frete do pedido."
        });
    }
}

module.exports = {
    quoteShipping,
    quoteCheckoutShipping
};
