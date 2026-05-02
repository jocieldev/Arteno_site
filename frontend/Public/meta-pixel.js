window.trackMetaPixelEvent = function (eventName, params = {}) {
    try {
        if (typeof window.fbq !== "function") {
            return false;
        }

        const safeParams = { ...params };

        if (safeParams.currency != null) {
            safeParams.currency = String(safeParams.currency).toUpperCase();
        }

        if (safeParams.value != null) {
            safeParams.value = Number(safeParams.value);
        }

        window.fbq("track", eventName, safeParams);
        return true;
    } catch (_error) {
        console.debug(`Pixel tracking error for ${eventName}:`, _error);
        return false;
    }
};

window.trackMetaPixelEventOnce = function (storageKey, eventName, params = {}) {
    try {
        if (!storageKey) {
            return window.trackMetaPixelEvent(eventName, params);
        }

        const normalizedKey = `meta_pixel:${String(storageKey).trim()}`;

        if (window.sessionStorage?.getItem(normalizedKey) === "1") {
            return false;
        }

        const tracked = window.trackMetaPixelEvent(eventName, params);

        if (tracked) {
            window.sessionStorage?.setItem(normalizedKey, "1");
        }

        return tracked;
    } catch (_error) {
        return window.trackMetaPixelEvent(eventName, params);
    }
};
