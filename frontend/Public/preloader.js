const sitePreloader = document.getElementById("sitePreloader");

if (sitePreloader) {
    const preloaderBody = document.body;
    const preloaderTitle = sitePreloader.querySelector(".site-preloader-title");
    const preloaderStartTime = window.performance?.now?.() || Date.now();
    const minimumPreloaderDuration = 420;
    const fallbackPreloaderDuration = 5200;
    const readySelector = (preloaderBody.dataset.preloaderReady || "")
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);

    let preloaderHidden = false;
    let preloaderObserver = null;

    preloaderBody.classList.add("site-preloader-active");

    if (preloaderTitle) {
        preloaderTitle.textContent = "Carregando informações";
    }

    function isReadyBySelector() {
        if (!readySelector.length) {
            return document.readyState !== "loading";
        }

        return readySelector.some((selector) => {
            try {
                return Boolean(document.querySelector(selector));
            } catch (_error) {
                return false;
            }
        });
    }

    function disconnectPreloaderObserver() {
        if (preloaderObserver) {
            preloaderObserver.disconnect();
            preloaderObserver = null;
        }
    }

    function hidePreloader() {
        if (preloaderHidden) {
            return;
        }

        preloaderHidden = true;
        disconnectPreloaderObserver();

        const elapsedTime = (window.performance?.now?.() || Date.now()) - preloaderStartTime;
        const remainingTime = Math.max(0, minimumPreloaderDuration - elapsedTime);

        window.setTimeout(() => {
            sitePreloader.classList.add("is-hidden");
            preloaderBody.classList.remove("site-preloader-active");

            window.setTimeout(() => {
                sitePreloader.remove();
            }, 460);
        }, remainingTime);
    }

    function tryHidePreloader() {
        if (isReadyBySelector()) {
            hidePreloader();
        }
    }

    function startWatchingReadiness() {
        if (!readySelector.length) {
            return;
        }

        preloaderObserver = new MutationObserver(() => {
            tryHidePreloader();
        });

        preloaderObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "hidden", "style", "aria-hidden"]
        });

        tryHidePreloader();
    }

    document.addEventListener("DOMContentLoaded", () => {
        startWatchingReadiness();

        if (!readySelector.length) {
            tryHidePreloader();
        }
    }, { once: true });

    window.addEventListener("load", () => {
        tryHidePreloader();
    }, { once: true });

    window.setTimeout(() => {
        hidePreloader();
    }, fallbackPreloaderDuration);
}
