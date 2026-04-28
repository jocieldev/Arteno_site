const adminMobileMenuButton = document.getElementById("adminMobileMenuButton");
const adminSidebarClose = document.getElementById("adminSidebarClose");
const adminMobileOverlay = document.getElementById("adminMobileOverlay");
const adminSidebarLinks = document.querySelectorAll(".admin-sidebar-link, .admin-sidebar-secondary");

const categoryForm = document.getElementById("categoryForm");
const categoryTableBody = document.getElementById("adminCategoriesTableBody");
const categoryFeedbackBox = document.getElementById("adminCategoryFeedback");
const categoryEmptyState = document.getElementById("adminCategoryEmptyState");
const categoryTableWrap = document.getElementById("adminCategoryTableWrap");
const categoryFormTitle = document.getElementById("categoryFormTitle");
const cancelCategoryEditButton = document.getElementById("cancelCategoryEditButton");
const categorySubmitButton = document.getElementById("categorySubmitButton");
const openCreateCategoryButton = document.getElementById("openCreateCategoryButton");
const adminCategoryEditorPage = document.getElementById("adminCategoryEditorPage");
const categoryImageInput = document.getElementById("categoryImageInput");
const categoryImagePreview = document.getElementById("categoryImagePreview");
const categoryProductsPicker = document.getElementById("categoryProductsPicker");

let categoriesState = [];
let productsState = [];
let editingCategoryId = null;
let selectedCategoryImageFile = null;
let existingCategoryImageUrl = "";
let categorySaveRequestInFlight = false;
let categoryDeleteRequestInFlight = false;

function setButtonLoading(button, isLoading, loadingText) {
    if (!(button instanceof HTMLElement)) {
        return;
    }

    if (isLoading) {
        if (!button.dataset.originalHtml) {
            button.dataset.originalHtml = button.innerHTML;
        }

        if (!button.dataset.originalDisabled) {
            button.dataset.originalDisabled = button.disabled ? "true" : "false";
        }

        button.classList.add("site-button-loading");
        button.disabled = true;
        button.innerHTML = `
            <span class="site-button-spinner" aria-hidden="true"></span>
            <span class="site-button-loading-label">${loadingText}</span>
        `;
        return;
    }

    button.classList.remove("site-button-loading");
    button.disabled = button.dataset.originalDisabled === "true";

    if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
    }

    delete button.dataset.originalDisabled;
}

function getAdminRouteState(pathname = window.location.pathname) {
    const newRoute = /^\/admin\/categories\/new\/?$/;
    const editRoute = /^\/admin\/categories\/([^/]+)\/edit\/?$/;

    if (newRoute.test(pathname)) {
        return { page: "create", categoryId: null };
    }

    const editMatch = pathname.match(editRoute);

    if (editMatch) {
        return { page: "edit", categoryId: decodeURIComponent(editMatch[1]) };
    }

    return { page: "list", categoryId: null };
}

function navigateAdmin(pathname, { replace = false } = {}) {
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({}, "", pathname);
    renderAdminRoute();
}

function openAdminSidebar() {
    document.body.classList.add("sidebar-open");
}

function closeAdminSidebar() {
    document.body.classList.remove("sidebar-open");
}

function openCategoryEditor() {
    document.body.classList.add("editor-open");
    adminCategoryEditorPage?.removeAttribute("hidden");
    adminCategoryEditorPage?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeCategoryEditor() {
    document.body.classList.remove("editor-open");
    adminCategoryEditorPage?.setAttribute("hidden", "");
}

function clearFeedback() {
    if (!categoryFeedbackBox) {
        return;
    }

    categoryFeedbackBox.hidden = true;
    categoryFeedbackBox.textContent = "";
    categoryFeedbackBox.className = "admin-feedback admin-products-feedback";
}

function showFeedback(message, type = "success") {
    if (!categoryFeedbackBox) {
        return;
    }

    categoryFeedbackBox.textContent = message;
    categoryFeedbackBox.className = `admin-feedback admin-products-feedback ${type}`;
    categoryFeedbackBox.hidden = false;
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getProductImageUrl(product) {
    return product.images?.[0]?.imageUrl || product.imageUrl || "/img/tabua-produto01.webp";
}

function renderCategoryImagePreview() {
    if (!categoryImagePreview) {
        return;
    }

    const imageUrl = selectedCategoryImageFile
        ? URL.createObjectURL(selectedCategoryImageFile)
        : existingCategoryImageUrl;

    if (!imageUrl) {
        categoryImagePreview.innerHTML = "";
        return;
    }

    categoryImagePreview.innerHTML = `
        <div class="admin-category-image-card">
            <img src="${escapeHtml(imageUrl)}" alt="Imagem da categoria">
        </div>
    `;
}

function renderProductsPicker(selectedIds = []) {
    if (!categoryProductsPicker) {
        return;
    }

    if (!productsState.length) {
        categoryProductsPicker.innerHTML = `<p class="admin-picker-empty">Cadastre produtos antes de montar uma categoria.</p>`;
        return;
    }

    const selectedSet = new Set(selectedIds.map((item) => String(item)));

    categoryProductsPicker.innerHTML = productsState.map((product) => `
        <label class="admin-picker-item">
            <input type="checkbox" name="productIds" value="${product._id}" ${selectedSet.has(String(product._id)) ? "checked" : ""}>
            <img src="${escapeHtml(getProductImageUrl(product))}" alt="${escapeHtml(product.name || "Produto")}">
            <div>
                <strong>${escapeHtml(product.name || "Produto sem nome")}</strong>
                <span>${escapeHtml(
                    (Array.isArray(product.categories) && product.categories.length
                        ? product.categories.join(", ")
                        : (product.category || "Sem categoria"))
                )}</span>
            </div>
        </label>
    `).join("");
}

function resetCategoryForm() {
    if (!categoryForm) {
        return;
    }

    categoryForm.reset();
    editingCategoryId = null;
    selectedCategoryImageFile = null;
    existingCategoryImageUrl = "";
    categoryFormTitle.textContent = "Adicionar categoria";
    categorySubmitButton.textContent = "Salvar categoria";
    renderCategoryImagePreview();
    renderProductsPicker([]);
}

function populateCategoryForm(category) {
    if (!categoryForm) {
        return;
    }

    editingCategoryId = category._id;
    selectedCategoryImageFile = null;
    existingCategoryImageUrl = category.imageUrl || "";
    categoryForm.elements.name.value = category.name || "";
    categoryFormTitle.textContent = "Editar categoria";
    categorySubmitButton.textContent = "Salvar alterações";
    renderCategoryImagePreview();
    renderProductsPicker((category.products || []).map((product) => product._id || product));
}

function renderAdminRoute() {
    const routeState = getAdminRouteState();

    if (routeState.page === "create") {
        clearFeedback();
        resetCategoryForm();
        openCategoryEditor();
        return;
    }

    if (routeState.page === "edit") {
        const selectedCategory = categoriesState.find((category) => category._id === routeState.categoryId);

        if (!selectedCategory) {
            closeCategoryEditor();
            return;
        }

        clearFeedback();
        populateCategoryForm(selectedCategory);
        openCategoryEditor();
        return;
    }

    clearFeedback();
    resetCategoryForm();
    closeCategoryEditor();
}

function renderCategories(categories) {
    if (!categoryTableBody) {
        return;
    }

    if (!categories.length) {
        categoryTableBody.innerHTML = "";
        categoryEmptyState.hidden = false;
        categoryTableWrap.hidden = true;
        return;
    }

    categoryEmptyState.hidden = true;
    categoryTableWrap.hidden = false;

    categoryTableBody.innerHTML = categories.map((category) => `
        <tr>
            <td data-label="Categoria">
                <div class="admin-product-main">
                    <img src="${escapeHtml(category.imageUrl || "/img/categoria1-img.webp")}" alt="${escapeHtml(category.name || "Categoria")}" class="admin-product-thumb">
                    <div>
                        <div class="admin-product-name">${escapeHtml(category.name || "Categoria")}</div>
                    </div>
                </div>
            </td>
            <td data-label="Produtos">${Number(category.productsCount || category.products?.length || 0)}</td>
            <td data-label="Ações">
                <div class="admin-table-actions">
                    <button type="button" class="admin-table-action" data-action="edit" data-id="${category._id}">Editar</button>
                    <button type="button" class="admin-table-action delete" data-action="delete" data-id="${category._id}">Excluir</button>
                </div>
            </td>
        </tr>
    `).join("");
}

async function fetchAdminProducts() {
    const response = await fetch("/api/admin/products", {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return [];
    }

    if (!response.ok) {
        throw new Error("Não foi possível carregar os produtos.");
    }

    return response.json();
}

async function fetchAdminCategories() {
    const response = await fetch("/api/admin/categories", {
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return [];
    }

    if (!response.ok) {
        throw new Error("Não foi possível carregar as categorias.");
    }

    return response.json();
}

async function loadAdminData() {
    try {
        const [products, categories] = await Promise.all([
            fetchAdminProducts(),
            fetchAdminCategories()
        ]);

        productsState = products;
        categoriesState = categories;
        renderCategories(categories);
        renderAdminRoute();
    } catch (error) {
        showFeedback(error.message, "error");
    }
}

function getFormPayload(form) {
    const formData = new FormData();
    const selectedProductIds = Array.from(form.querySelectorAll('input[name="productIds"]:checked')).map((input) => input.value);

    formData.append("name", form.elements.name.value.trim());
    selectedProductIds.forEach((productId) => {
        formData.append("productIds", productId);
    });

    if (selectedCategoryImageFile) {
        formData.append("image", selectedCategoryImageFile);
    }

    return formData;
}

async function saveCategory(payload) {
    const isEditing = Boolean(editingCategoryId);
    const response = await fetch(isEditing ? `/api/admin/categories/${editingCategoryId}` : "/api/admin/categories", {
        method: isEditing ? "PUT" : "POST",
        credentials: "same-origin",
        body: payload
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || result.message || "Não foi possível salvar a categoria.");
    }

    return result;
}

async function removeCategory(categoryId) {
    const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "DELETE",
        credentials: "same-origin"
    });

    if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || result.message || "Não foi possível excluir a categoria.");
    }
}

window.addEventListener("popstate", renderAdminRoute);

if (adminMobileMenuButton) {
    adminMobileMenuButton.addEventListener("click", openAdminSidebar);
}

if (adminSidebarClose) {
    adminSidebarClose.addEventListener("click", closeAdminSidebar);
}

if (adminMobileOverlay) {
    adminMobileOverlay.addEventListener("click", closeAdminSidebar);
}

adminSidebarLinks.forEach((link) => {
    link.addEventListener("click", closeAdminSidebar);
});

if (openCreateCategoryButton) {
    openCreateCategoryButton.addEventListener("click", () => {
        navigateAdmin("/admin/categories/new");
    });
}

if (cancelCategoryEditButton) {
    cancelCategoryEditButton.addEventListener("click", () => {
        navigateAdmin("/admin/categories");
    });
}

if (categoryImageInput) {
    categoryImageInput.addEventListener("change", () => {
        selectedCategoryImageFile = categoryImageInput.files?.[0] || null;
        renderCategoryImagePreview();
    });
}

if (categoryForm) {
    loadAdminData();

    categoryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (categorySaveRequestInFlight) {
            return;
        }

        clearFeedback();
        categorySaveRequestInFlight = true;
        setButtonLoading(categorySubmitButton, true, editingCategoryId ? "Salvando..." : "Criando...");

        try {
            const wasEditing = Boolean(editingCategoryId);
            const payload = getFormPayload(categoryForm);
            await saveCategory(payload);
            categorySaveRequestInFlight = false;
            setButtonLoading(categorySubmitButton, false, wasEditing ? "Salvando..." : "Criando...");
            showFeedback(wasEditing ? "Categoria atualizada com sucesso." : "Categoria criada com sucesso.", "success");
            await loadAdminData();
            navigateAdmin("/admin/categories", { replace: true });
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            if (categorySaveRequestInFlight) {
                categorySaveRequestInFlight = false;
                setButtonLoading(categorySubmitButton, false, editingCategoryId ? "Salvando..." : "Criando...");
            }
        }
    });

    categoryTableBody.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action]");

        if (!button) {
            return;
        }

        const selectedCategory = categoriesState.find((category) => category._id === button.dataset.id);

        if (!selectedCategory) {
            return;
        }

        if (button.dataset.action === "edit") {
            navigateAdmin(`/admin/categories/${selectedCategory._id}/edit`);
            return;
        }

        if (categoryDeleteRequestInFlight) {
            return;
        }

        const shouldDelete = window.confirm(`Deseja excluir a categoria "${selectedCategory.name}"?`);

        if (!shouldDelete) {
            return;
        }

        try {
            categoryDeleteRequestInFlight = true;
            setButtonLoading(button, true, "Excluindo...");
            await removeCategory(selectedCategory._id);
            showFeedback("Categoria excluída com sucesso.", "success");

            if (editingCategoryId === selectedCategory._id) {
                navigateAdmin("/admin/categories", { replace: true });
            }

            await loadAdminData();
        } catch (error) {
            showFeedback(error.message, "error");
        } finally {
            categoryDeleteRequestInFlight = false;
            setButtonLoading(button, false, "Excluindo...");
        }
    });
}
