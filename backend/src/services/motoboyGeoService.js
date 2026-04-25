const { buildOriginLabel } = require("./motoboySettingsService");

const GEOCODE_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const ROUTE_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";
const VIACEP_ENDPOINT = "https://viacep.com.br/ws";
const USER_AGENT = "ArtenoMotoboyDelivery/1.0";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const geocodeCache = new Map();
const routeCache = new Map();
const GEODESIC_FALLBACK_SPEED_KMH = 28;
const SUSPICIOUS_ROUTE_DISTANCE_RATIO = 6;
const SUSPICIOUS_ROUTE_ABSOLUTE_KM = 250;

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

function formatZipCode(value = "") {
    const normalized = normalizeZipCode(value);
    return normalized.length === 8
        ? `${normalized.slice(0, 5)}-${normalized.slice(5)}`
        : normalized;
}

function joinAddressParts(parts = []) {
    return parts
        .map((part) => normalizeText(part))
        .filter(Boolean)
        .join(", ");
}

function buildParsedGeocodeResult(rawResult = {}) {
    return {
        latitude: Number(rawResult.lat),
        longitude: Number(rawResult.lon),
        resolvedAddress: normalizeText(rawResult.display_name),
        resolvedAt: new Date()
    };
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

function normalizeCoordinate(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
}

function toRadians(value) {
    return (Number(value || 0) * Math.PI) / 180;
}

function calculateGeodesicDistanceKm(origin = {}, destination = {}) {
    const originLat = normalizeCoordinate(origin.latitude);
    const originLon = normalizeCoordinate(origin.longitude);
    const destinationLat = normalizeCoordinate(destination.latitude);
    const destinationLon = normalizeCoordinate(destination.longitude);

    if (!originLat || !originLon || !destinationLat || !destinationLon) {
        const error = new Error("Nao foi possivel calcular a distancia geografica do motoboy.");
        error.status = 400;
        throw error;
    }

    const earthRadiusKm = 6371;
    const deltaLat = toRadians(destinationLat - originLat);
    const deltaLon = toRadians(destinationLon - originLon);
    const lat1 = toRadians(originLat);
    const lat2 = toRadians(destinationLat);
    const haversine =
        Math.sin(deltaLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return earthRadiusKm * centralAngle;
}

function buildGeodesicFallbackRoute(origin = {}, destination = {}) {
    const directDistanceKm = calculateGeodesicDistanceKm(origin, destination);
    const adjustedDistanceKm = Number((directDistanceKm * 1.2).toFixed(2));
    const estimatedDurationMinutes = Math.max(
        1,
        Math.round((adjustedDistanceKm / GEODESIC_FALLBACK_SPEED_KMH) * 60)
    );

    return {
        distanceKm: adjustedDistanceKm,
        durationMinutes: estimatedDurationMinutes,
        distanceSource: "geodesic_fallback"
    };
}

async function geocodeStructuredAddress(params = {}, notFoundMessage) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        const normalizedValue = normalizeText(value);

        if (normalizedValue) {
            searchParams.set(key, normalizedValue);
        }
    });

    if (!searchParams.toString()) {
        return null;
    }

    searchParams.set("format", "jsonv2");
    searchParams.set("limit", "1");
    searchParams.set("countrycodes", "br");

    const cacheKey = `structured:${searchParams.toString().toLowerCase()}`;
    const cached = getCachedValue(geocodeCache, cacheKey);

    if (cached) {
        return cached;
    }

    const url = new URL(GEOCODE_ENDPOINT);
    searchParams.forEach((value, key) => {
        url.searchParams.set(key, value);
    });

    const results = await fetchJson(url.toString());
    const [firstResult] = Array.isArray(results) ? results : [];

    if (!firstResult?.lat || !firstResult?.lon) {
        if (notFoundMessage) {
            const error = new Error(notFoundMessage);
            error.status = 400;
            throw error;
        }

        return null;
    }

    const parsed = buildParsedGeocodeResult(firstResult);

    setCachedValue(geocodeCache, cacheKey, parsed);
    return parsed;
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

    const parsed = buildParsedGeocodeResult(firstResult);

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

async function fetchViaCepAddress(zipCode) {
    const normalizedZipCode = normalizeZipCode(zipCode);

    if (normalizedZipCode.length !== 8) {
        return null;
    }

    try {
        const viaCepResponse = await fetchJson(`${VIACEP_ENDPOINT}/${normalizedZipCode}/json/`);

        if (viaCepResponse?.erro) {
            return null;
        }

        return viaCepResponse;
    } catch (_error) {
        return null;
    }
}

async function geocodeFromViaCep(zipCode, extraAddress = {}, notFoundMessage, providedViaCepAddress = null) {
    const normalizedZipCode = normalizeZipCode(zipCode);
    const formattedZipCode = formatZipCode(normalizedZipCode);

    if (normalizedZipCode.length !== 8) {
        return null;
    }

    try {
        const viaCepResponse = providedViaCepAddress || await fetchViaCepAddress(normalizedZipCode);

        if (!viaCepResponse || viaCepResponse?.erro) {
            return null;
        }

        const street = normalizeText(extraAddress.street) || normalizeText(viaCepResponse.logradouro);
        const number = normalizeText(extraAddress.number);
        const neighborhood = normalizeText(extraAddress.neighborhood) || normalizeText(viaCepResponse.bairro);
        const city = normalizeText(extraAddress.city) || normalizeText(viaCepResponse.localidade);
        const state = normalizeText(extraAddress.state) || normalizeText(viaCepResponse.uf);

        const structuredCandidates = [
            {
                street: joinAddressParts([street, number]),
                city,
                state,
                postalcode: formattedZipCode,
                country: "Brasil"
            },
            {
                street,
                city,
                state,
                postalcode: formattedZipCode,
                country: "Brasil"
            },
            {
                city,
                state,
                postalcode: formattedZipCode,
                country: "Brasil"
            }
        ];

        for (const candidate of structuredCandidates) {
            try {
                const structuredResult = await geocodeStructuredAddress(candidate);

                if (structuredResult) {
                    return structuredResult;
                }
            } catch (_error) {
                // Continua tentando os demais formatos.
            }
        }

        return tryGeocodeCandidates([
            joinAddressParts([street, number, neighborhood, city, state, formattedZipCode, "Brasil"]),
            joinAddressParts([street, neighborhood, city, state, formattedZipCode, "Brasil"]),
            joinAddressParts([street, city, state, formattedZipCode, "Brasil"]),
            joinAddressParts([neighborhood, city, state, formattedZipCode, "Brasil"]),
            joinAddressParts([street, city, state, "Brasil"]),
            joinAddressParts([neighborhood, city, state, "Brasil"]),
            joinAddressParts([city, state, formattedZipCode, "Brasil"]),
            joinAddressParts([`CEP ${formattedZipCode}`, city, state, "Brasil"]),
            joinAddressParts([formattedZipCode, city, state, "Brasil"]),
            joinAddressParts([city, state, "Brasil"])
        ], notFoundMessage);
    } catch (_error) {
        return null;
    }
}

function isLikelyMatchingViaCepAddress(result = {}, expectedAddress = {}) {
    const displayName = normalizeText(result.display_name || result.resolvedAddress).toLowerCase();
    const city = normalizeText(expectedAddress.city).toLowerCase();
    const state = normalizeText(expectedAddress.state).toLowerCase();
    const street = normalizeText(expectedAddress.street).toLowerCase();
    const neighborhood = normalizeText(expectedAddress.neighborhood).toLowerCase();

    if (!displayName || !city || !state) {
        return false;
    }

    if (!displayName.includes(city) || !displayName.includes(state)) {
        return false;
    }

    if (street && displayName.includes(street)) {
        return true;
    }

    if (neighborhood && displayName.includes(neighborhood)) {
        return true;
    }

    return displayName.includes(city) && displayName.includes(state);
}

async function geocodeMotoboyOrigin(origin = {}) {
    const notFoundMessage = "Nao foi possivel localizar o endereco de origem do motoboy no mapa. Revise CEP, rua, numero, cidade e UF.";
    const originLabel = buildOriginLabel(origin);
    const viaCepAddress = await fetchViaCepAddress(origin.zipCode);
    const resolvedByZipCode = await geocodeFromViaCep(origin.zipCode, {
        street: origin.street,
        number: origin.number,
        neighborhood: origin.neighborhood,
        city: origin.city,
        state: origin.state
    }, notFoundMessage, viaCepAddress);

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
    const formattedZipCode = formatZipCode(normalizedZipCode);
    const notFoundMessage = "Nao foi possivel localizar o CEP de destino no mapa para calcular o motoboy.";

    if (normalizedZipCode.length !== 8) {
        const error = new Error("Informe um CEP valido para consultar a entrega por motoboy.");
        error.status = 400;
        throw error;
    }

    const viaCepAddress = await fetchViaCepAddress(normalizedZipCode);
    const resolvedByZipCode = await geocodeFromViaCep(normalizedZipCode, {}, notFoundMessage, viaCepAddress);

    if (resolvedByZipCode) {
        return resolvedByZipCode;
    }

    try {
        const structuredResult = await geocodeStructuredAddress({
            postalcode: formattedZipCode,
            country: "Brasil"
        });

        if (
            structuredResult
            && isLikelyMatchingViaCepAddress(structuredResult, {
                street: viaCepAddress?.logradouro,
                neighborhood: viaCepAddress?.bairro,
                city: viaCepAddress?.localidade,
                state: viaCepAddress?.uf
            })
        ) {
            return structuredResult;
        }
    } catch (_error) {
        // Continua tentando os demais formatos.
    }

    return tryGeocodeCandidates([
        joinAddressParts([`CEP ${formattedZipCode}`, "Brasil"]),
        joinAddressParts([formattedZipCode, "Brasil"]),
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

    try {
        const result = await fetchJson(url.toString());
        const route = Array.isArray(result?.routes) ? result.routes[0] : null;

        if (!route?.distance) {
            const error = new Error("Nao foi possivel calcular a distancia da entrega por motoboy.");
            error.status = 502;
            throw error;
        }

        const parsed = {
            distanceKm: Number((Number(route.distance || 0) / 1000).toFixed(2)),
            durationMinutes: Math.max(1, Math.round(Number(route.duration || 0) / 60)),
            distanceSource: "road_route"
        };

        const geodesicRoute = buildGeodesicFallbackRoute(origin, destination);
        const isSuspiciousRoute =
            parsed.distanceKm > SUSPICIOUS_ROUTE_ABSOLUTE_KM
            && geodesicRoute.distanceKm > 0
            && parsed.distanceKm >= Number((geodesicRoute.distanceKm * SUSPICIOUS_ROUTE_DISTANCE_RATIO).toFixed(2));

        if (isSuspiciousRoute) {
            console.warn(
                "Motoboy route fallback ativado por distancia suspeita:",
                `${parsed.distanceKm}km rota vs ${geodesicRoute.distanceKm}km geodesica`
            );
            setCachedValue(routeCache, cacheKey, geodesicRoute);
            return geodesicRoute;
        }

        setCachedValue(routeCache, cacheKey, parsed);
        return parsed;
    } catch (error) {
        const fallbackRoute = buildGeodesicFallbackRoute(origin, destination);
        console.warn("Motoboy route fallback ativado:", error.message);
        setCachedValue(routeCache, cacheKey, fallbackRoute);
        return fallbackRoute;
    }
}

module.exports = {
    geocodeMotoboyOrigin,
    geocodePostalCode,
    getRoadDistanceBetweenPoints
};
