(function initAdminMessageBadge() {
    const badgeElements = document.querySelectorAll("[data-admin-message-badge]");

    function renderBadge(count) {
        const normalizedCount = Number(count || 0);
        const hasUnread = normalizedCount > 0;

        badgeElements.forEach((element) => {
            element.hidden = !hasUnread;
            element.textContent = hasUnread ? String(normalizedCount) : "";
            element.style.display = hasUnread ? "inline-flex" : "none";
        });
    }

    async function loadUnreadCount() {
        try {
            const response = await fetch("/api/admin/messages/unread-count", {
                credentials: "same-origin"
            });

            if (response.status === 401) {
                renderBadge(0);
                return;
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Não foi possível carregar as mensagens novas.");
            }

            renderBadge(result.unreadCount);
        } catch (_error) {
            renderBadge(0);
        }
    }

    window.addEventListener("admin:messages-updated", loadUnreadCount);
    loadUnreadCount();
})();
