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

async function quoteMotoboyOption({ zipCode, orderSubtotal = 0 }) {
    const settings = await getMotoboySettings();

    if (!settings.isReady) {
        console.info("Motoboy ignorado: configuracao ainda nao esta pronta para uso.");
        return null;
    }

    if (normalizeCurrency(orderSubtotal, 0) < normalizeCurrency(settings.minimumOrderSubtotal, 0)) {
        console.info(`Motoboy ignorado: subtotal ${orderSubtotal} abaixo do minimo ${settings.minimumOrderSubtotal}.`);
        return null;
    }

    const destinationCoordinates = await geocodePostalCode(zipCode);
    const route = await getRoadDistanceBetweenPoints(settings.coordinates, destinationCoordinates);

    if (!route.distanceKm || route.distanceKm > normalizeCurrency(settings.maxDistanceKm, 0)) {
        console.info(`Motoboy ignorado: distancia ${route.distanceKm || 0} km acima do maximo ${settings.maxDistanceKm} km.`);
        return null;
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
        provider: "motoboy",
        serviceId: "motoboy-local",
        name: settings.serviceName || "Motoboy",
        company: settings.companyName || "Entrega local",
        price: Number(calculatedPrice.toFixed(2)),
        currency: "BRL",
        deliveryTime: Math.max(1, Number(settings.transitDays || 1)),
        dispatchDays: Math.max(0, Number(settings.dispatchDaysAfterReady || 0)),
        distanceKm: route.distanceKm,
        estimatedDurationMinutes: route.durationMinutes,
        operatingDaysLabel,
        deliveryWindowLabel,
        originLabel: settings.originLabel || "",
        notes: settings.notes || ""
    };
}

module.exports = {
    quoteMotoboyOption
};
