const { getMotoboySettings } = require("./motoboySettingsService");
const { geocodePostalCode, getRoadDistanceBetweenPoints } = require("./motoboyGeoService");

function normalizeCurrency(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function buildOperatingDaysLabel(operatingDays = []) {
    const labels = {
        sun: "dom",
        mon: "seg",
        tue: "ter",
        wed: "qua",
        thu: "qui",
        fri: "sex",
        sat: "sab"
    };

    return (Array.isArray(operatingDays) ? operatingDays : [])
        .map((day) => labels[day] || "")
        .filter(Boolean)
        .join(", ");
}

function buildSettingsSummary(settings = {}) {
    return {
        enabled: Boolean(settings.enabled),
        isReady: Boolean(settings.isReady),
        originZipCode: String(settings.origin?.zipCode || ""),
        originLabel: String(settings.originLabel || ""),
        minimumOrderSubtotal: normalizeCurrency(settings.minimumOrderSubtotal, 0),
        minimumFee: normalizeCurrency(settings.minimumFee, 0),
        pricePerKm: normalizeCurrency(settings.pricePerKm, 0),
        maxDistanceKm: normalizeCurrency(settings.maxDistanceKm, 0)
    };
}

function buildMotoboyDiagnostics({
    available = false,
    reasonCode = "",
    message = "",
    settings = {},
    zipCode = "",
    orderSubtotal = 0,
    distanceKm = 0,
    distanceSource = ""
} = {}) {
    return {
        available: Boolean(available),
        reasonCode: String(reasonCode || ""),
        message: String(message || ""),
        zipCode: String(zipCode || ""),
        orderSubtotal: normalizeCurrency(orderSubtotal, 0),
        distanceKm: normalizeCurrency(distanceKm, 0),
        distanceSource: String(distanceSource || ""),
        settings: buildSettingsSummary(settings)
    };
}

async function quoteMotoboyOptionDetailed({ zipCode, orderSubtotal = 0 }) {
    const settings = await getMotoboySettings();
    const normalizedSubtotal = normalizeCurrency(orderSubtotal, 0);

    if (!settings.isReady) {
        console.info("Motoboy ignorado: configuracao ainda nao esta pronta para uso.");
        return {
            option: null,
            diagnostics: buildMotoboyDiagnostics({
                available: false,
                reasonCode: "motoboy_not_ready",
                message: "A configuracao do motoboy ainda nao esta pronta para uso.",
                settings,
                zipCode,
                orderSubtotal: normalizedSubtotal
            })
        };
    }

    if (normalizedSubtotal < normalizeCurrency(settings.minimumOrderSubtotal, 0)) {
        console.info(`Motoboy ignorado: subtotal ${orderSubtotal} abaixo do minimo ${settings.minimumOrderSubtotal}.`);
        return {
            option: null,
            diagnostics: buildMotoboyDiagnostics({
                available: false,
                reasonCode: "below_minimum_order_subtotal",
                message: "O subtotal do pedido ficou abaixo do minimo configurado para o motoboy.",
                settings,
                zipCode,
                orderSubtotal: normalizedSubtotal
            })
        };
    }

    let destinationCoordinates = null;

    try {
        destinationCoordinates = await geocodePostalCode(zipCode);
    } catch (error) {
        return {
            option: null,
            diagnostics: buildMotoboyDiagnostics({
                available: false,
                reasonCode: "destination_geocode_failed",
                message: error.message || "Nao foi possivel localizar o CEP de destino no mapa.",
                settings,
                zipCode,
                orderSubtotal: normalizedSubtotal
            })
        };
    }

    let route = null;

    try {
        route = await getRoadDistanceBetweenPoints(settings.coordinates, destinationCoordinates);
    } catch (error) {
        return {
            option: null,
            diagnostics: buildMotoboyDiagnostics({
                available: false,
                reasonCode: "route_distance_failed",
                message: error.message || "Nao foi possivel calcular a rota para o motoboy.",
                settings,
                zipCode,
                orderSubtotal: normalizedSubtotal
            })
        };
    }

    if (!route.distanceKm || route.distanceKm > normalizeCurrency(settings.maxDistanceKm, 0)) {
        console.info(`Motoboy ignorado: distancia ${route.distanceKm || 0} km acima do maximo ${settings.maxDistanceKm} km.`);
        return {
            option: null,
            diagnostics: buildMotoboyDiagnostics({
                available: false,
                reasonCode: "outside_max_distance",
                message: "O CEP informado esta fora do raio configurado para entrega por motoboy.",
                settings,
                zipCode,
                orderSubtotal: normalizedSubtotal,
                distanceKm: route.distanceKm,
                distanceSource: route.distanceSource || "road_route"
            })
        };
    }

    const calculatedPrice = Math.max(
        normalizeCurrency(settings.minimumFee, 0),
        Number((route.distanceKm * normalizeCurrency(settings.pricePerKm, 0)).toFixed(2))
    );
    const operatingDaysLabel = buildOperatingDaysLabel(settings.operatingDays);
    const deliveryWindowLabel = settings.sameDayEnabled && settings.sameDayCutoffTime
        ? `Pedidos finalizados ate ${settings.sameDayCutoffTime} podem sair no mesmo dia util depois de prontos.`
        : "";

    return {
        option: {
            provider: "motoboy",
            serviceId: "motoboy-local",
            name: settings.serviceName || "Motoboy",
            company: settings.companyName || "Entrega local",
            price: Number(calculatedPrice.toFixed(2)),
            currency: "BRL",
            deliveryTime: Math.max(1, Number(settings.transitDays || 1)),
            dispatchDays: Math.max(0, Number(settings.dispatchDaysAfterReady || 0)),
            distanceKm: route.distanceKm,
            distanceSource: route.distanceSource || "road_route",
            estimatedDurationMinutes: route.durationMinutes,
            operatingDaysLabel,
            deliveryWindowLabel,
            originLabel: settings.originLabel || ""
        },
        diagnostics: buildMotoboyDiagnostics({
            available: true,
            reasonCode: "available",
            message: "Motoboy disponivel para este CEP.",
            settings,
            zipCode,
            orderSubtotal: normalizedSubtotal,
            distanceKm: route.distanceKm,
            distanceSource: route.distanceSource || "road_route"
        })
    };
}

async function quoteMotoboyOption({ zipCode, orderSubtotal = 0 }) {
    const result = await quoteMotoboyOptionDetailed({ zipCode, orderSubtotal });
    return result.option;
}

module.exports = {
    quoteMotoboyOption,
    quoteMotoboyOptionDetailed
};
