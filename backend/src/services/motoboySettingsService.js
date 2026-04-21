const IntegrationSetting = require("../models/IntegrationSetting");

const MOTObOY_PROVIDER = "motoboy-local";
const DEFAULT_OPERATING_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"];
const VALID_OPERATING_DAYS = new Set(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeZipCode(value = "") {
    return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function normalizeNumber(value, fallback = 0) {
    const normalized = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizePositiveNumber(value, fallback = 0) {
    const normalized = normalizeNumber(value, fallback);
    return normalized > 0 ? normalized : fallback;
}

function normalizeNonNegativeInteger(value, fallback = 0) {
    const normalized = Number.parseInt(value, 10);
    return Number.isInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function normalizeTime(value = "") {
    const normalized = normalizeText(value);
    return /^\d{2}:\d{2}$/.test(normalized) ? normalized : "";
}

function normalizeOperatingDays(value) {
    const source = Array.isArray(value) ? value : [];
    const normalized = source
        .map((entry) => normalizeText(entry).toLowerCase())
        .filter((entry) => VALID_OPERATING_DAYS.has(entry));

    return normalized.length ? Array.from(new Set(normalized)) : [...DEFAULT_OPERATING_DAYS];
}

function normalizeCoordinates(value = {}) {
    const latitude = normalizeNumber(value.latitude, 0);
    const longitude = normalizeNumber(value.longitude, 0);

    if (!latitude || !longitude) {
        return {
            latitude: 0,
            longitude: 0,
            resolvedAddress: "",
            resolvedAt: null
        };
    }

    return {
        latitude,
        longitude,
        resolvedAddress: normalizeText(value.resolvedAddress),
        resolvedAt: value.resolvedAt ? new Date(value.resolvedAt) : null
    };
}

function buildOriginLabel(origin = {}) {
    const parts = [
        normalizeText(origin.street),
        normalizeText(origin.number),
        normalizeText(origin.neighborhood),
        normalizeText(origin.city),
        normalizeText(origin.state)
    ].filter(Boolean);

    return parts.join(", ");
}

function getDefaultMotoboySettings() {
    return {
        enabled: false,
        serviceName: "Motoboy",
        companyName: "Entrega local",
        origin: {
            zipCode: "",
            street: "",
            number: "",
            neighborhood: "",
            city: "",
            state: ""
        },
        originLabel: "",
        pricePerKm: 0,
        minimumFee: 0,
        maxDistanceKm: 0,
        dispatchDaysAfterReady: 0,
        transitDays: 1,
        minimumOrderSubtotal: 0,
        sameDayEnabled: false,
        sameDayCutoffTime: "",
        estimatedDeliveryHours: 4,
        operatingDays: [...DEFAULT_OPERATING_DAYS],
        coordinates: {
            latitude: 0,
            longitude: 0,
            resolvedAddress: "",
            resolvedAt: null
        },
        updatedAt: null
    };
}

function normalizeMotoboySettingsPayload(payload = {}) {
    const defaults = getDefaultMotoboySettings();
    const origin = payload.origin && typeof payload.origin === "object" ? payload.origin : {};
    const coordinates = payload.coordinates && typeof payload.coordinates === "object" ? payload.coordinates : {};
    const normalizedOrigin = {
        zipCode: normalizeZipCode(origin.zipCode),
        street: normalizeText(origin.street),
        number: normalizeText(origin.number),
        neighborhood: normalizeText(origin.neighborhood),
        city: normalizeText(origin.city),
        state: normalizeText(origin.state).toUpperCase().slice(0, 2)
    };

    return {
        ...defaults,
        enabled: Boolean(payload.enabled),
        serviceName: normalizeText(payload.serviceName) || defaults.serviceName,
        companyName: normalizeText(payload.companyName) || defaults.companyName,
        origin: normalizedOrigin,
        originLabel: buildOriginLabel(normalizedOrigin),
        pricePerKm: Number(normalizePositiveNumber(payload.pricePerKm, 0).toFixed(2)),
        minimumFee: Number(normalizePositiveNumber(payload.minimumFee, 0).toFixed(2)),
        maxDistanceKm: Number(normalizePositiveNumber(payload.maxDistanceKm, 0).toFixed(2)),
        dispatchDaysAfterReady: normalizeNonNegativeInteger(payload.dispatchDaysAfterReady, 0),
        transitDays: Math.max(1, normalizeNonNegativeInteger(payload.transitDays, 1)),
        minimumOrderSubtotal: Number(normalizePositiveNumber(payload.minimumOrderSubtotal, 0).toFixed(2)),
        sameDayEnabled: Boolean(payload.sameDayEnabled),
        sameDayCutoffTime: normalizeTime(payload.sameDayCutoffTime),
        estimatedDeliveryHours: Math.max(1, normalizeNonNegativeInteger(payload.estimatedDeliveryHours, 4)),
        operatingDays: normalizeOperatingDays(payload.operatingDays),
        coordinates: normalizeCoordinates(coordinates)
    };
}

function serializeMotoboySettings(setting) {
    const defaults = getDefaultMotoboySettings();
    const metadata = setting?.metadata && typeof setting.metadata === "object" ? setting.metadata : {};
    const normalized = normalizeMotoboySettingsPayload(metadata);

    return {
        ...defaults,
        ...normalized,
        updatedAt: setting?.updatedAt || null,
        isReady:
            normalized.enabled
            && Boolean(normalized.origin.zipCode)
            && Boolean(normalized.origin.city)
            && Boolean(normalized.origin.state)
            && Boolean(normalized.coordinates.latitude)
            && Boolean(normalized.coordinates.longitude)
            && normalized.pricePerKm > 0
            && normalized.maxDistanceKm > 0
    };
}

async function getStoredMotoboySetting() {
    return IntegrationSetting.findOne({ provider: MOTObOY_PROVIDER });
}

async function getMotoboySettings() {
    const setting = await getStoredMotoboySetting();
    return serializeMotoboySettings(setting);
}

async function saveMotoboySettings(payload = {}) {
    const normalized = normalizeMotoboySettingsPayload(payload);
    const setting = await IntegrationSetting.findOneAndUpdate(
        { provider: MOTObOY_PROVIDER },
        {
            $set: {
                provider: MOTObOY_PROVIDER,
                metadata: normalized
            }
        },
        {
            upsert: true,
            returnDocument: "after",
            setDefaultsOnInsert: true
        }
    );

    return serializeMotoboySettings(setting);
}

module.exports = {
    MOTObOY_PROVIDER,
    buildOriginLabel,
    getDefaultMotoboySettings,
    getMotoboySettings,
    getStoredMotoboySetting,
    normalizeMotoboySettingsPayload,
    saveMotoboySettings,
    serializeMotoboySettings
};
