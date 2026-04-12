(function initHeaderSearch() {
    const searchContainers = document.querySelectorAll(".search-container");

    if (!searchContainers.length) {
        return;
    }

    function escapeHtml(value = "") {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getProductUrl(product) {
        return `/produto/${encodeURIComponent(product.slug || "")}`;
    }

    function getProductImageUrl(product) {
        return product.images?.[0]?.imageUrl || product.imageUrl || "/img/tabua-produto01.webp";
    }

    function submitSearch(rawValue) {
        const value = String(rawValue || "").trim();

        if (!value) {
            return;
        }

        const params = new URLSearchParams({ q: value });
        window.location.href = `/busca?${params.toString()}`;
    }

    searchContainers.forEach((container) => {
        const input = container.querySelector("input");
        const trigger = container.querySelector(".search-icon");

        if (!input) {
            return;
        }

        const suggestions = document.createElement("div");
        suggestions.className = "search-suggestions";
        suggestions.hidden = true;
        container.appendChild(suggestions);

        let debounceTimer = null;
        let latestQuery = "";

        function hideSuggestions() {
            suggestions.hidden = true;
            suggestions.innerHTML = "";
            container.classList.remove("suggestions-open");
        }

        function showSuggestions(items, query) {
            if (!items.length) {
                suggestions.innerHTML = `
                    <div class="search-suggestion-empty">
                        Nenhum produto encontrado para "${escapeHtml(query)}".
                    </div>
                `;
            } else {
                suggestions.innerHTML = items.map((product) => {
                    const productUrl = escapeHtml(getProductUrl(product));
                    const imageUrl = escapeHtml(getProductImageUrl(product));
                    const name = escapeHtml(product.name || "Produto");

                    return `
                        <a href="${productUrl}" class="search-suggestion-item">
                            <img src="${imageUrl}" alt="${name}">
                            <span>${name}</span>
                        </a>
                    `;
                }).join("");
            }

            suggestions.hidden = false;
            container.classList.add("suggestions-open");
        }

        async function loadSuggestions(rawValue) {
            const value = String(rawValue || "").trim();
            latestQuery = value;

            if (value.length < 2) {
                hideSuggestions();
                return;
            }

            try {
                const response = await fetch(`/api/products?q=${encodeURIComponent(value)}&limit=5`);

                if (!response.ok) {
                    throw new Error("Não foi possível buscar sugestões.");
                }

                const products = await response.json();

                if (latestQuery !== value) {
                    return;
                }

                showSuggestions(products, value);
            } catch (_error) {
                hideSuggestions();
            }
        }

        input.addEventListener("input", () => {
            window.clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                loadSuggestions(input.value);
            }, 180);
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                hideSuggestions();
                submitSearch(input.value);
            }

            if (event.key === "Escape") {
                hideSuggestions();
            }
        });

        input.addEventListener("blur", () => {
            window.setTimeout(hideSuggestions, 120);
        });

        input.addEventListener("focus", () => {
            if (input.value.trim().length >= 2) {
                loadSuggestions(input.value);
            }
        });

        if (trigger) {
            trigger.style.cursor = "pointer";
            trigger.addEventListener("click", () => {
                hideSuggestions();
                submitSearch(input.value);
            });
        }
    });
})();
