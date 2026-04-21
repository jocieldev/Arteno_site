const { buildOriginLabel } = require("./motoboySettingsService");

const GEOCODE_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const ROUTE_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";
const VIACEP_ENDPOINT = "https://viacep.com.br/ws";
const USER_AGENT = "ArtenoMotoboyDelivery/1.0";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const geocodeCache = new Map();
const routeCache = new Map();

function now() {
    return Date.now();
}

function getCachedValue(cache, key) {
    const entry = cache.get(key);

    if (!entry) {
        return null;
    }

    if (entry.expiresAt <= now()) {
        cache.delete(key);
        return null;
    }

    return entry.value;
}

function setCachedValue(cache, key, value) {
    cache.set(key, {
        value,
        expiresAt: now() + CACHE_TTL_MS
    });
}

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeZipCode(value = "") {
    return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function joinAddressParts(parts = []) {
    return parts
        .map((part) => normalizeText(part))
        .filter(Boolean)
        .join(", ");
}

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": USER_AGENT
        }
    });

    if (!response.ok) {
        const error = new Error("Nao foi possivel consultar o servico de geolocalizacao do motoboy.");
        error.status = response.status || 502;
        throw error;
    }

    return response.json();
}

async function geocodeQuery(query, notFoundMessage = "Nao foi possivel localizar este endereco no mapa.") {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
        const error = new Error("Informe um endereco valido para localizar a origem do motoboy.");
        error.status = 400;
        throw error;
    }

    const cacheKey = normalizedQuery.toLowerCase();
    const cached = getCachedValue(geocodeCache, cacheKey);

    if (cached) {
        return cached;
    }

    const url = new URL(GEOCODE_ENDPOINT);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("q", normalizedQuery);

    const results = await fetchJson(url.toString());
    const [firstResult] = Array.isArray(results) ? results : [];

    if (!firstResult?.lat || !firstResult?.lon) {
        const error = new Error(notFoundMessage);
        error.status = 400;
        throw error;
    }

    const parsed = {
        latitude: Number(firstResult.lat),
        longitude: Number(firstResult.lon),
        resolvedAddress: normalizeText(firstResult.display_name),
        resolvedAt: new Date()
    };

    setCachedValue(geocodeCache, cacheKey, parsed);
    return parsed;
}

async function tryGeocodeCandidates(candidates = [], notFoundMessage) {
    const normalizedCandidates = Array.from(new Set(
        (Array.isArray(candidates) ? candidates : [])
            .map((candidate) => normalizeText(candidate))
            .filter(Boolean)
    ));

    for (const candidate of normalizedCandidates) {
        try {
            return await geocodeQuery(candidate, notFoundMessage);
        } catch (_error) {
            // Continua tentando o próximo formato de endereço.
        }
    }

    const error = new Error(notFoundMessage);
    error.status = 400;
    throw error;
}

async function geocodeFromViaCep(zipCode, extraAddress = {}, notFoundMessage) {
    const normalizedZipCode = normalizeZipCode(zipCode);

    if (normalizedZipCode.length !== 8) {
        return null;
    }

    try {
        const viaCepResponse = await fetchJson(`${VIACEP_ENDPOINT}/${normalizedZipCode}/json/`);

        if (viaCepResponse?.erro) {
            return null;
        }

        const street = normalizeText(extraAddress.street) || normalizeText(viaCepResponse.logradouro);
        const number = normalizeText(extraAddress.number);
        const neighborhood = normalizeText(extraAddress.neighborhood) || normalizeText(viaCepResponse.bairro);
        const city = normalizeText(extraAddress.city) || normalizeText(viaCepResponse.localidade);
        const state = normalizeText(extraAddress.state) || normalizeText(viaCepResponse.uf);

        return tryGeocodeCandidates([
            joinAddressParts([street, number, neighborhood, city, state, normalizedZipCode, "Brasil"]),
            joinAddressParts([street, neighborhood, city, state, normalizedZipCode, "Brasil"]),
            joinAddressParts([street, city, state, normalizedZipCode, "Brasil"]),
            joinAddressParts([neighborhood, city, state, normalizedZipCode, "Brasil"]),
            joinAddressParts([city, state, normalizedZipCode, "Brasil"]),
            joinAddressParts([city, state, "Brasil"])
        ], notFoundMessage);
    } catch (_error) {
        return null;
    }
}

async function geocodeMotoboyOrigin(origin = {}) {
    const notFoundMessage = "Nao foi possivel localizar o endereco de origem do motoboy no mapa. Revise CEP, rua, numero, cidade e UF.";
    const originLabel = buildOriginLabel(origin);
    const resolvedByZipCode = await geocodeFromViaCep(origin.zipCode, {
        street: origin.street,
        number: origin.number,
        neighborhood: origin.neighborhood,
        city: origin.city,
        state: origin.state
    }, notFoundMessage);

    if (resolvedByZipCode) {
        return resolvedByZipCode;
    }

    return tryGeocodeCandidates([
        joinAddressParts([normalizeText(origin.street), normalizeText(origin.number), normalizeText(origin.neighborhood), normalizeText(origin.city), normalizeText(origin.state), normalizeZipCode(origin.zipCode), "Brasil"]),
        joinAddressParts([normalizeText(origin.street), normalizeText(origin.neighborhood), normalizeText(origin.city), normalizeText(origin.state), "Brasil"]),
        joinAddressParts([originLabel, normalizeZipCode(origin.zipCode), "Brasil"]),
        joinAddressParts([normalizeText(origin.city), normalizeText(origin.state), "Brasil"])
    ], notFoundMessage);
}

async function geocodePostalCode(zipCode = "") {
    const normalizedZipCode = String(zipCode || "").replace(/\D/g, "").slice(0, 8);
    const notFoundMessage = "Nao foi possivel localizar o CEP de destino no mapa para calcular o motoboy.";

    if (normalizedZipCode.length !== 8) {
        const error = new Error("Informe um CEP valido para consultar a entrega por motoboy.");
        error.status = 400;
        throw error;
    }

    const resolvedByZipCode = await geocodeFromViaCep(normalizedZipCode, {}, notFoundMessage);

    if (resolvedByZipCode) {
        return resolvedByZipCode;
    }

    return tryGeocodeCandidates([
        joinAddressParts([normalizedZipCode, "Brasil"])
    ], notFoundMessage);
}

async function getRoadDistanceBetweenPoints(origin, destination) {
    const originLat = Number(origin?.latitude || 0);
    const originLon = Number(origin?.longitude || 0);
    const destinationLat = Number(destination?.latitude || 0);
    const destinationLon = Number(destination?.longitude || 0);

    if (!originLat || !originLon || !destinationLat || !destinationLon) {
        const error = new Error("Nao foi possivel calcular a rota do motoboy.");
        error.status = 400;
        throw error;
    }

    const cacheKey = `${originLat},${originLon}:${destinationLat},${destinationLon}`;
    const cached = getCachedValue(routeCache, cacheKey);

    if (cached) {
        return cached;
    }

    const url = new URL(`${ROUTE_ENDPOINT}/${originLon},${originLat};${destinationLon},${destinationLat}`);
    url.searchParams.set("overview", "false");
    url.searchParams.set("alternatives", "false");
    url.searchParams.set("steps", "false");

    const result = await fetchJson(url.toString());
    const route = Array.isArray(result?.routes) ? result.routes[0] : null;

    if (!route?.distance) {
        const error = new Error("Nao foi possivel calcular a distancia da entrega por motoboy.");
        error.status = 502;
        throw error;
    }

    const parsed = {
        distanceKm: Number((Number(route.distance || 0) / 1000).toFixed(2)),
        durationMinutes: Math.max(1, Math.round(Number(route.duration || 0) / 60))
    };

    setCachedValue(routeCache, cacheKey, parsed);
    return parsed;
}

module.exports = {
    geocodeMotoboyOrigin,
    geocodePostalCode,
    getRoadDistanceBetweenPoints
};
