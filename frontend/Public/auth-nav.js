(function initAuthNav() {
    let logoutRequestInFlight = false;
    const MOBILE_ACCOUNT_CLOSE_DELAY = 300;

    function clearMobileAccountCloseTimer(submenu) {
        const timeoutId = Number(submenu?.dataset.closeTimeoutId || 0);

        if (timeoutId) {
            window.clearTimeout(timeoutId);
            delete submenu.dataset.closeTimeoutId;
        }
    }

    function escapeHtml(value = "") {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getUserInitial(name = "") {
        return String(name || "").trim().charAt(0).toUpperCase() || "A";
    }

    function closeMobileAccountSubmenus() {
        document.querySelectorAll(".menu-top").forEach((element) => {
            const submenu = element.querySelector(".menu-enter-submenu");

            if (!submenu || (submenu.hidden && !element.classList.contains("is-account-open"))) {
                element.classList.remove("is-account-open", "is-account-closing");
                return;
            }

            clearMobileAccountCloseTimer(submenu);
            element.classList.remove("is-account-open");
            element.classList.add("is-account-closing");

            const timeoutId = window.setTimeout(() => {
                if (!element.classList.contains("is-account-open")) {
                    submenu.hidden = true;
                    element.classList.remove("is-account-closing");
                }
                delete submenu.dataset.closeTimeoutId;
            }, MOBILE_ACCOUNT_CLOSE_DELAY);

            submenu.dataset.closeTimeoutId = String(timeoutId);
        });
    }

    function openMobileAccountSubmenu(menuTop, submenu) {
        clearMobileAccountCloseTimer(submenu);
        submenu.hidden = false;
        menuTop.classList.remove("is-account-closing");

        window.requestAnimationFrame(() => {
            menuTop.classList.add("is-account-open");
        });
    }

    function renderMobileAccountLink(isLoggedIn, user = null) {
        const menuEnterLinks = document.querySelectorAll(".menu-enter");

        menuEnterLinks.forEach((link) => {
            const menuTop = link.closest(".menu-top");
            const existingSubmenu = menuTop?.querySelector(".menu-enter-submenu");

            if (isLoggedIn) {
                const name = String(user?.name || "Minha conta").trim() || "Minha conta";
                const initial = escapeHtml(getUserInitial(name));

                link.setAttribute("href", "/minha-conta");
                link.dataset.mobileAccountToggle = "true";
                link.innerHTML = `
                    <span class="menu-enter-avatar" aria-hidden="true">${initial}</span>
                    <span>Minha conta</span>
                    <i class="fa-solid fa-chevron-down menu-enter-chevron" aria-hidden="true"></i>
                `;

                if (menuTop && !existingSubmenu) {
                    menuTop.insertAdjacentHTML("beforeend", `
                        <div class="menu-enter-submenu" hidden>
                            <a href="/minha-conta" class="menu-enter-submenu-link">Minha conta</a>
                            <a href="/meus-pedidos" class="menu-enter-submenu-link">Meus pedidos</a>
                            <button type="button" class="menu-enter-submenu-link menu-enter-submenu-action" data-account-action="logout">Sair</button>
                        </div>
                    `);
                }

                return;
            }

            if (menuTop) {
                menuTop.classList.remove("is-account-open", "is-account-closing");
            }

            if (existingSubmenu) {
                existingSubmenu.remove();
            }

            link.setAttribute("href", "/entrar");
            delete link.dataset.mobileAccountToggle;
            link.innerHTML = `
                <svg class="login-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M14 4h4v16h-4" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M4 12h9" stroke="white" stroke-width="2.8" stroke-linecap="round" />
                    <path d="M10 8l4 4-4 4" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>Entrar</span>
            `;
        });
    }

    function buildLoggedInAccountMarkup(user = {}) {
        const name = String(user.name || "Minha conta").trim() || "Minha conta";
        const initial = escapeHtml(getUserInitial(name));
        const safeName = escapeHtml(name);

        return `
            <div class="account-menu">
                <button type="button" class="account-menu-trigger" aria-label="Abrir menu da conta">
                    <span class="account-avatar" aria-hidden="true">${initial}</span>
                    <span class="account-menu-label">Minha conta</span>
                    <i class="fa-solid fa-chevron-down account-menu-chevron" aria-hidden="true"></i>
                </button>
                <div class="account-dropdown" role="menu" aria-label="Menu da conta">
                    <div class="account-dropdown-header">${safeName}</div>
                    <a href="/minha-conta" class="account-dropdown-link" role="menuitem">Minha conta</a>
                    <a href="/meus-pedidos" class="account-dropdown-link" role="menuitem">Meus pedidos</a>
                    <button type="button" class="account-dropdown-link account-dropdown-action" data-account-action="logout" role="menuitem">Sair</button>
                </div>
            </div>
        `;
    }

    function buildLoggedOutAccountMarkup() {
        return `
            <i class="fa-regular fa-circle-user"></i>
            <span><a href="/entrar">Cadastre-se</a></span>
            <span style="cursor: default;">|</span>
            <span><a href="/entrar">Fazer Login</a></span>
        `;
    }

    async function renderAuthState() {
        const accountContainers = document.querySelectorAll(".account");

        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("Não foi possível verificar a sessão.");
            }

            const result = await response.json();
            const user = result?.user || null;

            if (!user) {
                accountContainers.forEach((container) => {
                    container.innerHTML = buildLoggedOutAccountMarkup();
                });

                renderMobileAccountLink(false);
                return;
            }

            accountContainers.forEach((container) => {
                container.innerHTML = buildLoggedInAccountMarkup(user);
            });

            renderMobileAccountLink(true, user);
        } catch (_error) {
            accountContainers.forEach((container) => {
                container.innerHTML = buildLoggedOutAccountMarkup();
            });

            renderMobileAccountLink(false);
        }
    }

    document.addEventListener("click", (event) => {
        const mobileAccountToggle = event.target.closest(".menu-enter[data-mobile-account-toggle='true']");

        if (mobileAccountToggle) {
            event.preventDefault();
            const menuTop = mobileAccountToggle.closest(".menu-top");

            if (!menuTop) {
                return;
            }

            const shouldOpen = !menuTop.classList.contains("is-account-open");
            const submenu = menuTop.querySelector(".menu-enter-submenu");

            if (submenu) {
                if (shouldOpen) {
                    closeMobileAccountSubmenus();
                    openMobileAccountSubmenu(menuTop, submenu);
                } else {
                    closeMobileAccountSubmenus();
                }
            }
            return;
        }

        if (!event.target.closest(".menu-top")) {
            closeMobileAccountSubmenus();
        }
    });

    document.addEventListener("click", async (event) => {
        const logoutButton = event.target.closest("[data-account-action='logout']");

        if (!logoutButton) {
            return;
        }

        event.preventDefault();

        if (logoutRequestInFlight) {
            return;
        }

        logoutRequestInFlight = true;

        if (window.siteUi?.setButtonLoading) {
            window.siteUi.setButtonLoading(logoutButton, true, {
                loadingText: "Saindo..."
            });
        }

        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("Não foi possível sair da conta agora.");
            }

            closeMobileAccountSubmenus();
            window.dispatchEvent(new CustomEvent("auth:updated"));
            window.location.href = "/";
        } catch (_error) {
            logoutRequestInFlight = false;

            if (window.siteUi?.setButtonLoading) {
                window.siteUi.setButtonLoading(logoutButton, false, {
                    loadingText: "Saindo..."
                });
            }

            window.showSiteToast?.("Não foi possível sair da conta agora.", "error");
        }
    });

    renderAuthState();
    window.addEventListener("auth:updated", renderAuthState);
})();
