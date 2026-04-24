const Product = require("../models/Product");
const { quoteShipmentByProducts } = require("../services/melhorEnvioService");
const { quoteMotoboyOptionDetailed } = require("../services/motoboyService");
const { getMelhorEnvioOAuthConfig } = require("../services/melhorEnvioOAuthService");
const { getMotoboySettings } = require("../services/motoboySettingsService");
const { createCheckoutShippingQuoteToken } = require("../services/shippingQuoteService");

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

function allowsMotoboyShipping(product) {
    return product?.shipping?.allowMotoboy !== false;
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
    const normalizedDispatchDays = normalizeQuantity(option.dispatchDays, 0);

    return {
        ...option,
        productionDays: normalizedProductionDays,
        dispatchDays: normalizedDispatchDays,
        totalDeliveryDays: normalizedProductionDays + normalizedDispatchDays + normalizedDeliveryTime
    };
}

async function resolveOriginZipCodes() {
    const zipCodes = new Set();
    const melhorEnvioConfig = getMelhorEnvioOAuthConfig();

    if (melhorEnvioConfig?.fromPostalCode) {
        zipCodes.add(normalizeZipCode(melhorEnvioConfig.fromPostalCode));
    }

    try {
        const motoboySettings = await getMotoboySettings();

        if (motoboySettings?.origin?.zipCode) {
            zipCodes.add(normalizeZipCode(motoboySettings.origin.zipCode));
        }
    } catch (_error) {
        // Ignora falhas ao consultar o CEP de origem do motoboy.
    }

    return zipCodes;
}

async function isOriginZipCode(zipCode) {
    const normalizedZipCode = normalizeZipCode(zipCode);
    const originZipCodes = await resolveOriginZipCodes();
    return originZipCodes.has(normalizedZipCode);
}

async function buildMotoboyOption(zipCode, orderSubtotal, productionDays) {
    try {
        const result = await quoteMotoboyOptionDetailed({
            zipCode,
            orderSubtotal
        });

        return {
            option: result.option ? enrichShippingOption(result.option, productionDays) : null,
            diagnostics: result.diagnostics || null
        };
    } catch (error) {
        console.error("Motoboy indisponivel nesta consulta:", error.message);
        return {
            option: null,
            diagnostics: {
                available: false,
                reasonCode: "motoboy_internal_error",
                message: error.message || "Nao foi possivel calcular o motoboy."
            }
        };
    }
}

async function buildSameZipMotoboyOption(orderSubtotal, productionDays) {
    try {
        const settings = await getMotoboySettings();

        if (!settings?.isReady) {
            return {
                option: null,
                diagnostics: {
                    available: false,
                    reasonCode: "motoboy_not_ready",
                    message: "A configuracao do motoboy ainda nao esta pronta para uso."
                }
            };
        }

        const normalizedSubtotal = Number(orderSubtotal || 0);
        const minimumOrderSubtotal = Number(settings.minimumOrderSubtotal || 0);

        if (normalizedSubtotal < minimumOrderSubtotal) {
            return {
                option: null,
                diagnostics: {
                    available: false,
                    reasonCode: "below_minimum_order_subtotal",
                    message: "O subtotal do pedido ficou abaixo do minimo configurado para o motoboy."
                }
            };
        }

        return {
            option: enrichShippingOption({
                provider: "motoboy",
                serviceId: "motoboy-local",
                name: settings.serviceName || "Motoboy",
                company: settings.companyName || "Entrega local",
                price: Number(Number(settings.minimumFee || 0).toFixed(2)),
                currency: "BRL",
                deliveryTime: Math.max(1, Number(settings.transitDays || 1)),
                dispatchDays: Math.max(0, Number(settings.dispatchDaysAfterReady || 0)),
                distanceKm: 0,
                distanceSource: "same_zip_origin",
                estimatedDurationMinutes: 0,
                deliveryWindowLabel: settings.sameDayEnabled && settings.sameDayCutoffTime
                    ? `Pedidos finalizados ate ${settings.sameDayCutoffTime} podem sair no mesmo dia util depois de prontos.`
                    : "",
                originLabel: settings.originLabel || ""
            }, productionDays),
            diagnostics: {
                available: true,
                reasonCode: "same_zip_origin",
                message: "Motoboy disponivel por CEP igual ao da origem.",
                distanceKm: 0,
                distanceSource: "same_zip_origin"
            }
        };
    } catch (error) {
        console.error("Motoboy indisponivel para CEP igual ao da origem:", error.message);
        return {
            option: null,
            diagnostics: {
                available: false,
                reasonCode: "motoboy_same_zip_error",
                message: error.message || "Nao foi possivel calcular o motoboy para CEP igual ao da origem."
            }
        };
    }
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

function attachCheckoutQuoteTokens(options = [], { zipCode = "", items = [], expiresAt = "" } = {}) {
    return (Array.isArray(options) ? options : []).map((option = {}) => ({
        ...option,
        quoteExpiresAt: expiresAt,
        quoteToken: createCheckoutShippingQuoteToken({
            zipCode,
            items,
            option,
            expiresAt
        })
    }));
}

async function resolveCheckoutProducts(items = []) {
    const normalizedItems = normalizeCheckoutItems(items);
    const productIds = Array.from(new Set(normalizedItems.map((item) => item.productId).filter(Boolean)));
    const slugs = Array.from(new Set(normalizedItems.map((item) => item.slug).filter(Boolean)));

    if (!productIds.length && !slugs.length) {
        const error = new Error("Seu carrinho nao possui produtos validos para calcular o frete.");
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
            const error = new Error(`Nao encontrei o produto "${item.name || item.slug || "Produto"}" para calcular o frete.`);
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
    const warnings = [];
    let totalQuantity = 0;
    let referencePrice = 0;
    let productionDays = 0;
    let allowMotoboy = true;
    let canQuoteCorreios = true;

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
            canQuoteCorreios = false;
            warnings.push(`O produto "${product.name}" ainda nao tem peso e dimensoes completos para cotar Correios.`);
        } else {
            payloadProducts.push(...itemProducts);
        }

        totalQuantity += quantity;
        referencePrice += Number(product.price || 0) * quantity;
        productionDays = Math.max(productionDays, getProductProductionDays(product));
        allowMotoboy = allowMotoboy && allowsMotoboyShipping(product);
    }

    return {
        payloadProducts,
        totalQuantity,
        referencePrice: Number(referencePrice.toFixed(2)),
        productionDays,
        allowMotoboy,
        canQuoteCorreios,
        warnings
    };
}

function buildCorreiosDiagnostics({ available, reasonCode, message }) {
    return {
        available: Boolean(available),
        reasonCode: String(reasonCode || ""),
        message: String(message || "")
    };
}

async function quoteCorreiosOptions({ zipCode, products, productionDays, canQuoteCorreios }) {
    if (!canQuoteCorreios) {
        return {
            options: [],
            diagnostics: buildCorreiosDiagnostics({
                available: false,
                reasonCode: "missing_shipping_dimensions",
                message: "Ainda faltam peso e dimensoes para cotar Correios."
            })
        };
    }

    try {
        const services = await quoteShipmentByProducts({
            toPostalCode: zipCode,
            products
        });
        const options = services
            .filter((service) => !service.error)
            .filter(isCorreiosPacOrSedex)
            .map(mapShippingOption)
            .map((option) => enrichShippingOption(option, productionDays))
            .sort((left, right) => left.price - right.price);

        return {
            options,
            diagnostics: buildCorreiosDiagnostics({
                available: true,
                reasonCode: "available",
                message: options.length
                    ? "Correios disponivel para esta consulta."
                    : "Nenhuma opcao de Correios foi retornada para este CEP."
            })
        };
    } catch (error) {
        console.error("Correios indisponivel nesta consulta:", error.message);
        return {
            options: [],
            diagnostics: buildCorreiosDiagnostics({
                available: false,
                reasonCode: "correios_quote_failed",
                message: error.message || "Nao foi possivel consultar os Correios nesta tentativa."
            })
        };
    }
}

async function quoteShipping(req, res) {
    try {
        const zipCode = normalizeZipCode(req.body.zipCode || req.body.cep);
        const productId = String(req.body.productId || "").trim();
        const quantity = normalizeQuantity(req.body.quantity, 1);

        if (zipCode.length !== 8) {
            return res.status(400).json({
                message: "Informe um CEP valido com 8 numeros."
            });
        }

        if (!productId) {
            return res.status(400).json({
                message: "Produto nao informado para o calculo de frete."
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                message: "Produto nao encontrado para calcular o frete."
            });
        }

        const { shippingProfile, products } = buildProductsPayload(product, quantity);
        const canUseMotoboy = allowsMotoboyShipping(product);
        const canQuoteCorreios = hasValidShippingProfile(shippingProfile);
        const warnings = [];
        const productionDays = getProductProductionDays(product);
        const orderSubtotal = Number(product?.price || 0) * quantity;

        if (!canQuoteCorreios) {
            warnings.push("Este produto ainda nao tem peso e dimensoes completos para cotar Correios.");
        }

        if (shouldUseDemoShippingMode()) {
            if (await isOriginZipCode(zipCode)) {
                const sameZipMotoboyResult = canUseMotoboy
                    ? await buildSameZipMotoboyOption(orderSubtotal, productionDays)
                    : { option: null, diagnostics: null };

                return res.json({
                    zipCode,
                    productId,
                    quantity,
                    isDemo: true,
                    productionDays,
                    options: sameZipMotoboyResult.option ? [sameZipMotoboyResult.option] : [],
                    warnings,
                    diagnostics: {
                        motoboy: sameZipMotoboyResult.diagnostics,
                        correios: buildCorreiosDiagnostics({
                            available: false,
                            reasonCode: "demo_same_zip_only",
                            message: "No modo atual, para CEP igual ao da origem apenas o motoboy local e avaliado."
                        })
                    }
                });
            }

            const motoboyResult = canUseMotoboy
                ? await buildMotoboyOption(zipCode, orderSubtotal, productionDays)
                : { option: null, diagnostics: null };

            return res.json({
                zipCode,
                productId,
                quantity,
                isDemo: true,
                productionDays,
                options: [
                    ...(motoboyResult.option ? [motoboyResult.option] : []),
                    ...buildDemoShippingOptions({
                        zipCode,
                        quantity,
                        product
                    })
                ].sort((left, right) => left.price - right.price),
                warnings,
                diagnostics: {
                    motoboy: motoboyResult.diagnostics
                }
            });
        }

        if (await isOriginZipCode(zipCode)) {
            const sameZipMotoboyResult = canUseMotoboy
                ? await buildSameZipMotoboyOption(orderSubtotal, productionDays)
                : { option: null, diagnostics: null };

            return res.json({
                zipCode,
                productId,
                quantity,
                isDemo: false,
                productionDays,
                options: sameZipMotoboyResult.option ? [sameZipMotoboyResult.option] : [],
                warnings,
                diagnostics: {
                    motoboy: sameZipMotoboyResult.diagnostics,
                    correios: buildCorreiosDiagnostics({
                        available: false,
                        reasonCode: "same_zip_only",
                        message: "Para CEP igual ao da origem, o frete exibido e somente o motoboy local."
                    })
                }
            });
        }

        const correiosResult = await quoteCorreiosOptions({
            zipCode,
            products,
            productionDays,
            canQuoteCorreios
        });
        const motoboyResult = canUseMotoboy
            ? await buildMotoboyOption(zipCode, orderSubtotal, productionDays)
            : {
                option: null,
                diagnostics: {
                    available: false,
                    reasonCode: "motoboy_disabled_for_product",
                    message: "Este produto nao permite entrega por motoboy."
                }
            };

        return res.json({
            zipCode,
            productId,
            quantity,
            isDemo: false,
            productionDays,
            options: [
                ...(motoboyResult.option ? [motoboyResult.option] : []),
                ...correiosResult.options
            ].sort((left, right) => left.price - right.price),
            warnings,
            diagnostics: {
                motoboy: motoboyResult.diagnostics,
                correios: correiosResult.diagnostics
            }
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Nao foi possivel calcular o frete."
        });
    }
}

async function quoteCheckoutShipping(req, res) {
    try {
        const zipCode = normalizeZipCode(req.body.zipCode || req.body.cep);
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        const quoteExpiresAt = new Date(Date.now() + (15 * 60 * 1000)).toISOString();

        if (zipCode.length !== 8) {
            return res.status(400).json({
                message: "Informe um CEP valido com 8 numeros."
            });
        }

        if (!items.length) {
            return res.status(400).json({
                message: "Seu carrinho esta vazio para calcular o frete."
            });
        }

        const {
            payloadProducts,
            totalQuantity,
            referencePrice,
            productionDays,
            allowMotoboy,
            canQuoteCorreios,
            warnings
        } = await buildCheckoutProductsPayload(items);

        if (shouldUseDemoShippingMode()) {
            if (await isOriginZipCode(zipCode)) {
                const sameZipMotoboyResult = allowMotoboy
                    ? await buildSameZipMotoboyOption(referencePrice, productionDays)
                    : { option: null, diagnostics: null };
                const options = sameZipMotoboyResult.option ? [sameZipMotoboyResult.option] : [];

                return res.json({
                    zipCode,
                    isDemo: true,
                    productionDays,
                    quoteExpiresAt,
                    options: attachCheckoutQuoteTokens(options, {
                        zipCode,
                        items,
                        expiresAt: quoteExpiresAt
                    }),
                    warnings,
                    diagnostics: {
                        motoboy: sameZipMotoboyResult.diagnostics
                    }
                });
            }

            const motoboyResult = allowMotoboy
                ? await buildMotoboyOption(zipCode, referencePrice, productionDays)
                : { option: null, diagnostics: null };
            const options = [
                ...(motoboyResult.option ? [motoboyResult.option] : []),
                ...buildDemoShippingOptions({
                    zipCode,
                    quantity: totalQuantity,
                    product: {
                        price: referencePrice,
                        shipping: { productionDays }
                    }
                })
            ].sort((left, right) => left.price - right.price);

            return res.json({
                zipCode,
                isDemo: true,
                productionDays,
                quoteExpiresAt,
                options: attachCheckoutQuoteTokens(options, {
                    zipCode,
                    items,
                    expiresAt: quoteExpiresAt
                }),
                warnings,
                diagnostics: {
                    motoboy: motoboyResult.diagnostics
                }
            });
        }

        if (await isOriginZipCode(zipCode)) {
            const sameZipMotoboyResult = allowMotoboy
                ? await buildSameZipMotoboyOption(referencePrice, productionDays)
                : { option: null, diagnostics: null };
            const options = sameZipMotoboyResult.option ? [sameZipMotoboyResult.option] : [];

            return res.json({
                zipCode,
                isDemo: false,
                productionDays,
                quoteExpiresAt,
                options: attachCheckoutQuoteTokens(options, {
                    zipCode,
                    items,
                    expiresAt: quoteExpiresAt
                }),
                warnings,
                diagnostics: {
                    motoboy: sameZipMotoboyResult.diagnostics
                }
            });
        }

        const correiosResult = await quoteCorreiosOptions({
            zipCode,
            products: payloadProducts,
            productionDays,
            canQuoteCorreios
        });
        const motoboyResult = allowMotoboy
            ? await buildMotoboyOption(zipCode, referencePrice, productionDays)
            : {
                option: null,
                diagnostics: {
                    available: false,
                    reasonCode: "motoboy_disabled_for_cart",
                    message: "Um ou mais produtos do carrinho nao permitem entrega por motoboy."
                }
            };
        const options = [
            ...(motoboyResult.option ? [motoboyResult.option] : []),
            ...correiosResult.options
        ].sort((left, right) => left.price - right.price);

        return res.json({
            zipCode,
            isDemo: false,
            productionDays,
            quoteExpiresAt,
            options: attachCheckoutQuoteTokens(options, {
                zipCode,
                items,
                expiresAt: quoteExpiresAt
            }),
            warnings,
            diagnostics: {
                motoboy: motoboyResult.diagnostics,
                correios: correiosResult.diagnostics
            }
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Nao foi possivel calcular o frete do pedido."
        });
    }
}

module.exports = {
    quoteShipping,
    quoteCheckoutShipping
};
