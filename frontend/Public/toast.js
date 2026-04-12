(function initSiteToast() {
    const DEFAULT_DURATION = 4500;
    const MAX_TOASTS = 4;
    const TYPE_META = {
        success: {
            title: "Sucesso",
            icon: "check"
        },
        error: {
            title: "Erro",
            icon: "error"
        },
        warning: {
            title: "Atencao",
            icon: "warning"
        },
        info: {
            title: "Aviso",
            icon: "info"
        }
    };

    let toastContainer = null;

    function setButtonLoading(button, isLoading, options = {}) {
        if (!(button instanceof HTMLElement)) {
            return;
        }

        const loadingText = String(options.loadingText || "Carregando...");

        if (isLoading) {
            if (!button.dataset.originalHtml) {
                button.dataset.originalHtml = button.innerHTML;
            }

            if (!button.dataset.originalDisabled) {
                button.dataset.originalDisabled = button.disabled ? "true" : "false";
            }

            if (!button.dataset.originalMinWidth) {
                button.dataset.originalMinWidth = button.style.minWidth || "";
                button.style.minWidth = `${Math.ceil(button.getBoundingClientRect().width)}px`;
            }

            button.classList.add("site-button-loading");
            button.setAttribute("aria-busy", "true");
            button.disabled = true;
            button.innerHTML = `
                <span class="site-button-spinner" aria-hidden="true"></span>
                <span class="site-button-loading-label">${loadingText}</span>
            `;
            return;
        }

        button.classList.remove("site-button-loading");
        button.removeAttribute("aria-busy");
        button.disabled = button.dataset.originalDisabled === "true";

        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        }

        delete button.dataset.originalDisabled;

        if (Object.prototype.hasOwnProperty.call(button.dataset, "originalMinWidth")) {
            button.style.minWidth = button.dataset.originalMinWidth;
            delete button.dataset.originalMinWidth;
        }
    }

    function ensureContainer() {
        if (toastContainer && document.body?.contains(toastContainer)) {
            return toastContainer;
        }

        if (!document.body) {
            return null;
        }

        toastContainer = document.createElement("div");
        toastContainer.className = "site-toast-stack";
        toastContainer.setAttribute("aria-live", "polite");
        toastContainer.setAttribute("aria-atomic", "false");
        document.body.appendChild(toastContainer);
        return toastContainer;
    }

    function removeOldestToastIfNeeded(container) {
        const activeToasts = Array.from(container.children);

        if (activeToasts.length < MAX_TOASTS) {
            return;
        }

        const oldestToast = activeToasts[0];
        oldestToast?.dispatchEvent(new CustomEvent("toast:close"));
    }

    function getToastIconMarkup(type) {
        switch (type) {
            case "success":
                return `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 6 9 17l-5-5"></path>
                    </svg>
                `;
            case "error":
                return `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="9"></circle>
                        <path d="M9 9l6 6"></path>
                        <path d="M15 9l-6 6"></path>
                    </svg>
                `;
            case "warning":
                return `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 3 21 19H3L12 3z"></path>
                        <path d="M12 9v4"></path>
                        <path d="M12 17h.01"></path>
                    </svg>
                `;
            default:
                return `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="9"></circle>
                        <path d="M12 10v6"></path>
                        <path d="M12 7h.01"></path>
                    </svg>
                `;
        }
    }

    function showSiteToast(message, type = "info", options = {}) {
        const container = ensureContainer();

        if (!container || !message) {
            return null;
        }

        removeOldestToastIfNeeded(container);

        const safeType = TYPE_META[type] ? type : "info";
        const duration = Math.max(1800, Number(options.duration || DEFAULT_DURATION));
        const toast = document.createElement("section");
        const body = document.createElement("div");
        const iconWrap = document.createElement("div");
        const content = document.createElement("div");
        const title = document.createElement("strong");
        const description = document.createElement("p");
        const closeButton = document.createElement("button");
        const progress = document.createElement("span");
        let removeTimeoutId = null;

        toast.className = `site-toast site-toast--${safeType}`;
        toast.style.setProperty("--toast-duration", `${duration}ms`);
        toast.setAttribute("role", safeType === "error" ? "alert" : "status");

        body.className = "site-toast-body";
        iconWrap.className = "site-toast-icon";
        iconWrap.setAttribute("aria-hidden", "true");
        iconWrap.innerHTML = getToastIconMarkup(safeType);

        content.className = "site-toast-content";

        title.className = "site-toast-title";
        title.textContent = String(options.title || TYPE_META[safeType].title);

        description.className = "site-toast-message";
        description.textContent = String(message);

        closeButton.type = "button";
        closeButton.className = "site-toast-close";
        closeButton.setAttribute("aria-label", "Fechar aviso");
        closeButton.textContent = "X";

        progress.className = "site-toast-progress";

        function removeToast() {
            if (!toast.isConnected) {
                return;
            }

            window.clearTimeout(removeTimeoutId);
            toast.classList.add("is-closing");

            window.setTimeout(() => {
                if (toast.isConnected) {
                    toast.remove();
                }
            }, 220);
        }

        toast.addEventListener("toast:close", removeToast, { once: true });
        closeButton.addEventListener("click", removeToast);

        content.appendChild(title);
        content.appendChild(description);
        body.appendChild(iconWrap);
        body.appendChild(content);

        toast.appendChild(closeButton);
        toast.appendChild(body);
        toast.appendChild(progress);
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("is-visible");
        });

        removeTimeoutId = window.setTimeout(removeToast, duration);
        return toast;
    }

    window.siteToast = {
        show: showSiteToast
    };

    window.showSiteToast = showSiteToast;
    window.siteUi = {
        setButtonLoading
    };
})();
