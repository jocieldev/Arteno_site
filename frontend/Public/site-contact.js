(function initSiteContact() {
    const topBars = Array.from(document.querySelectorAll(".top-bar"));

    function normalizeText(value = "") {
        return String(value || "").trim();
    }

    function formatWhatsappDisplay(number = "") {
        const digits = String(number || "").replace(/\D/g, "");

        if (!digits) {
            return "";
        }

        if (digits.length === 13) {
            return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
        }

        if (digits.length === 12) {
            return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
        }

        return digits;
    }

    function hideElement(element) {
        if (!element) {
            return;
        }

        element.hidden = true;
        element.style.display = "none";
    }

    function showElement(element) {
        if (!element) {
            return;
        }

        element.hidden = false;
        element.style.removeProperty("display");
    }

    function setTopBarReady(isReady) {
        topBars.forEach((element) => {
            element.classList.toggle("site-contact-ready", isReady);
        });
    }

    function applyEmail(email = "") {
        const emailText = normalizeText(email);

        document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
            if (!emailText) {
                hideElement(link);
                return;
            }

            showElement(link);
            link.textContent = emailText;
            link.href = `mailto:${emailText}`;
        });

        document.querySelectorAll(".icon-email").forEach((icon) => {
            const item = icon.parentElement;
            const label = item?.querySelector("span");

            if (!label) {
                return;
            }

            if (!emailText) {
                hideElement(item);
                return;
            }

            showElement(item);
            label.textContent = emailText;
        });
    }

    function applyInstagram(instagramUrl = "") {
        const url = normalizeText(instagramUrl);

        document.querySelectorAll('a[href="#"]').forEach((link) => {
            if (!/instagram/i.test(link.textContent || "")) {
                return;
            }

            if (!url) {
                hideElement(link);
                return;
            }

            showElement(link);
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        });

        document.querySelectorAll(".top-right.contact-item").forEach((element) => {
            if (!element.querySelector(".fa-instagram")) {
                return;
            }

            if (!url) {
                hideElement(element);
                return;
            }

            showElement(element);
            element.style.cursor = "pointer";
            element.setAttribute("role", "link");
            element.tabIndex = 0;

            const openInstagram = () => {
                window.open(url, "_blank", "noopener,noreferrer");
            };

            element.onclick = openInstagram;
            element.onkeydown = (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openInstagram();
                }
            };
        });
    }

    function applyWhatsapp(whatsappNumber = "", whatsappUrl = "") {
        const displayText = formatWhatsappDisplay(whatsappNumber);

        document.querySelectorAll("a, .whatsapp-float, .contact-whatsapp-button").forEach((link) => {
            if (!(link instanceof HTMLAnchorElement)) {
                return;
            }

            const linkText = normalizeText(link.textContent || "");
            const shouldHandleWhatsappLink = link.href.includes("wa.me")
                || /whatsapp/i.test(linkText)
                || link.classList.contains("whatsapp-float")
                || link.classList.contains("contact-whatsapp-button");

            if (!shouldHandleWhatsappLink) {
                return;
            }

            if (!whatsappUrl) {
                hideElement(link);
                return;
            }

            showElement(link);
            link.href = whatsappUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            if (displayText && (!normalizeText(link.textContent) || /^whatsapp$/i.test(normalizeText(link.textContent)))) {
                link.textContent = displayText;
            }
        });

        document.querySelectorAll(".icon-wp").forEach((icon) => {
            const item = icon.parentElement;
            const label = item?.querySelector("span");

            if (!label) {
                return;
            }

            if (!displayText) {
                hideElement(item);
                return;
            }

            showElement(item);
            label.textContent = displayText;
        });

        document.querySelectorAll(".contact-whatsapp-panel small").forEach((label) => {
            if (!displayText) {
                hideElement(label);
                return;
            }

            showElement(label);
            label.textContent = displayText;
        });
    }

    async function loadSiteContact() {
        try {
            const response = await fetch("/api/site-settings/contact");
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível carregar os contatos do site.");
            }

            const contact = result.contact || {};
            applyWhatsapp(contact.whatsappNumber, contact.whatsappUrl);
            applyEmail(contact.email);
            applyInstagram(contact.instagramUrl);
            setTopBarReady(true);
        } catch (_error) {
            setTopBarReady(false);
        }
    }

    setTopBarReady(false);
    loadSiteContact();
})();
