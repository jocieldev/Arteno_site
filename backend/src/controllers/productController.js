const Product = require("../models/Product");
const Category = require("../models/Category");
const { cloudinary, ensureCloudinaryConfig } = require("../config/cloudinary");

function slugify(value = "") {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizeCurrencyNumber(value, fallback = 0) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    const normalized = Number(String(value).replace(",", "."));
    return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizeIntegerNumber(value, fallback = 0) {
    const normalized = normalizeCurrencyNumber(value, fallback);
    return Number.isFinite(normalized) ? Math.max(0, Math.floor(normalized)) : fallback;
}

function normalizePositiveDecimal(value, fallback = 0) {
    const normalized = normalizeCurrencyNumber(value, fallback);
    return Number.isFinite(normalized) ? Math.max(0, normalized) : fallback;
}

function normalizeBoolean(value) {
    return value === true || value === "true" || value === "on" || value === "1";
}

function normalizeClampedNumber(value, { fallback = 0, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
    const normalized = normalizeCurrencyNumber(value, fallback);

    if (!Number.isFinite(normalized)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, normalized));
}

function normalizeStockMode(value) {
    return value === "limited" ? "limited" : "unlimited";
}

function createFallbackId(prefix = "id") {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeHexColor(value, fallback = "#d1d5db") {
    const normalized = String(value || "").trim();

    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
        return normalized.length === 4
            ? `#${normalized.slice(1).split("").map((character) => `${character}${character}`).join("")}`.toLowerCase()
            : normalized.toLowerCase();
    }

    return fallback;
}

function parseProductVariations(value) {
    if (!value) {
        return [];
    }

    let parsedValue = value;

    if (typeof value === "string") {
        try {
            parsedValue = JSON.parse(value);
        } catch (_error) {
            return [];
        }
    }

    if (!Array.isArray(parsedValue)) {
        return [];
    }

    return parsedValue
        .map((variation = {}) => {
            const variationType = variation.type === "color" ? "color" : "custom";
            const variationName = variationType === "color"
                ? "Cor"
                : String(variation.name || "").trim();

            if (!variationName) {
                throw new Error("Informe o nome do campo da variação personalizável.");
            }

            const items = Array.isArray(variation.items)
                ? variation.items
                    .map((item = {}) => {
                        const label = String(item.label || item.name || "").trim();

                        if (!label) {
                            return null;
                        }

                        return {
                            id: String(item.id || createFallbackId("variation-item")).trim(),
                            label,
                            colorHex: variationType === "color"
                                ? normalizeHexColor(item.colorHex || item.color || item.value)
                                : "",
                            price: item.price === "" || item.price === null || item.price === undefined
                                ? null
                                : normalizeCurrencyNumber(item.price, null),
                            imageUrl: variationType === "custom" ? String(item.imageUrl || "").trim() : "",
                            imagePublicId: variationType === "custom" ? String(item.imagePublicId || "").trim() : "",
                            previewImageUrl: String(item.previewImageUrl || "").trim(),
                            previewImagePublicId: String(item.previewImagePublicId || "").trim()
                        };
                    })
                    .filter(Boolean)
                : [];

            if (!items.length) {
                throw new Error(`Adicione pelo menos um item na variação "${variationName}".`);
            }

            return {
                id: String(variation.id || createFallbackId("variation")).trim(),
                type: variationType,
                name: variationName,
                items
            };
        })
        .filter(Boolean);
}

function normalizeProductStatus(value, fallback = "active") {
    if (value === "active" || value === "draft" || value === "unlisted") {
        return value;
    }

    return fallback;
}

function normalizePersonalizationPreviewEntry(data = {}) {
    const normalizedUploadIndex = data.uploadIndex === null || data.uploadIndex === ""
        ? null
        : (Number.isInteger(Number(data.uploadIndex)) ? Number(data.uploadIndex) : undefined);

    return {
        name: String(data.name || data.label || "Prévia").trim() || "Prévia",
        enabled: normalizeBoolean(data.enabled ?? data.personalizationPreviewEnabled),
        uploadIndex: normalizedUploadIndex,
        imageUrl: String((data.imageUrl ?? data.personalizationPreviewImageUrl) || "").trim(),
        imagePublicId: String((data.imagePublicId ?? data.personalizationPreviewImagePublicId) || "").trim(),
        positionXPercent: normalizeClampedNumber(data.positionXPercent ?? data.personalizationPreviewPositionXPercent, { fallback: 50, min: 0, max: 100 }),
        positionYPercent: normalizeClampedNumber(data.positionYPercent ?? data.personalizationPreviewPositionYPercent, { fallback: 50, min: 0, max: 100 }),
        widthPercent: normalizeClampedNumber(data.widthPercent ?? data.personalizationPreviewWidthPercent, { fallback: 60, min: 10, max: 100 }),
        allowCustomerAdjust: normalizeBoolean(data.allowCustomerAdjust ?? data.personalizationPreviewAllowCustomerAdjust),
        fontSizePx: normalizeClampedNumber(data.fontSizePx ?? data.personalizationPreviewFontSizePx, { fallback: 28, min: 8, max: 120 }),
        referenceWidthPx: normalizeClampedNumber(data.referenceWidthPx ?? data.personalizationPreviewReferenceWidthPx, { fallback: 0, min: 0, max: 4000 }),
        sampleText: String((data.sampleText ?? data.personalizationPreviewSampleText) || "Maria").trim() || "Maria",
        textColor: String((data.textColor ?? data.personalizationPreviewTextColor) || "#ffffff").trim() || "#ffffff",
        fontFamily: String((data.fontFamily ?? data.personalizationPreviewFontFamily) || "'Georgia', 'Times New Roman', serif").trim() || "'Georgia', 'Times New Roman', serif",
        fontWeight: String((data.fontWeight ?? data.personalizationPreviewFontWeight) || "700").trim() || "700",
        letterSpacingEm: normalizeClampedNumber(data.letterSpacingEm ?? data.personalizationPreviewLetterSpacingEm, { fallback: 0.04, min: -0.2, max: 1 }),
        rotationDeg: normalizeClampedNumber(data.rotationDeg ?? data.personalizationPreviewRotationDeg, { fallback: 0, min: -180, max: 180 }),
        textTransform: (data.textTransform ?? data.personalizationPreviewTextTransform) === "none" ? "none" : "uppercase",
        textShadow: String((data.textShadow ?? data.personalizationPreviewTextShadow) || "0 2px 10px rgba(0, 0, 0, 0.35)").trim() || "0 2px 10px rgba(0, 0, 0, 0.35)",
        showSampleTextInPreview: normalizeBoolean(data.showSampleTextInPreview ?? data.personalizationPreviewShowSampleText)
    };
}

function normalizePersonalizationPreview(data) {
    return normalizePersonalizationPreviewEntry(data);
}

function parsePersonalizationPreviews(value) {
    if (!value) {
        return [];
    }

    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function normalizePersonalizationPreviews(data = {}) {
    const parsedPreviews = parsePersonalizationPreviews(data.personalizationPreviews)
        .map((preview) => normalizePersonalizationPreviewEntry(preview))
        .filter((preview) => preview.enabled || preview.imageUrl);

    if (parsedPreviews.length) {
        return parsedPreviews;
    }

    const legacyPreview = normalizePersonalizationPreview(data);
    return legacyPreview.enabled || legacyPreview.imageUrl ? [legacyPreview] : [];
}

function normalizePersonalizationImageOverlay(data) {
    const allowOptionImages = normalizeBoolean(data.personalizationImageOverlayAllowOptionImages);
    const allowCustomerUpload = normalizeBoolean(data.personalizationImageOverlayAllowCustomerUpload);

    return {
        enabled: allowOptionImages || allowCustomerUpload,
        allowOptionImages,
        requireSelection: normalizeBoolean(data.personalizationImageOverlayRequireSelection),
        allowCustomerUpload,
        optionImages: [],
        positionXPercent: normalizeClampedNumber(data.personalizationImageOverlayPositionXPercent, { fallback: 50, min: 0, max: 100 }),
        positionYPercent: normalizeClampedNumber(data.personalizationImageOverlayPositionYPercent, { fallback: 50, min: 0, max: 100 }),
        maxWidthPercent: normalizeClampedNumber(data.personalizationImageOverlayMaxWidthPercent ?? data.personalizationImageOverlayWidthPercent, { fallback: 34, min: 5, max: 100 }),
        maxHeightPercent: normalizeClampedNumber(data.personalizationImageOverlayMaxHeightPercent, { fallback: 34, min: 5, max: 100 }),
        isRound: normalizeBoolean(data.personalizationImageOverlayIsRound),
        allowCustomerAdjust: normalizeBoolean(data.personalizationImageOverlayAllowCustomerAdjust),
        rotationDeg: normalizeClampedNumber(data.personalizationImageOverlayRotationDeg, { fallback: 0, min: -180, max: 180 })
    };
}

function normalizePersonalizationShowNameInput(data = {}) {
    if (data.personalizationShowNameInput !== undefined) {
        return normalizeBoolean(data.personalizationShowNameInput);
    }

    if (data.personalizationRequireName !== undefined) {
        return normalizeBoolean(data.personalizationRequireName);
    }

    return normalizeBoolean(data.personalizationEnabled);
}

function normalizePersonalizationRequireName(data = {}) {
    return normalizeBoolean(data.personalizationRequireName);
}

function getProductStatus(product = {}) {
    if (product.status === "active" || product.status === "draft" || product.status === "unlisted") {
        return product.status;
    }

    return product.isActive ? "active" : "draft";
}

function parseCategoryIdsInput(data = {}) {
    const parsedIds = [];
    const rawCategoryIds = data.categoryIds;

    if (Array.isArray(rawCategoryIds)) {
        parsedIds.push(...rawCategoryIds);
    } else if (typeof rawCategoryIds === "string" && rawCategoryIds.trim()) {
        try {
            const parsedValue = JSON.parse(rawCategoryIds);

            if (Array.isArray(parsedValue)) {
                parsedIds.push(...parsedValue);
            }
        } catch (_error) {
            parsedIds.push(rawCategoryIds);
        }
    }

    const rawCategoryId = String(data.categoryId || "").trim();
    if (rawCategoryId) {
        parsedIds.unshift(rawCategoryId);
    }

    return [...new Set(parsedIds.map((value) => String(value || "").trim()).filter(Boolean))];
}

async function resolveProductCategories(data) {
    const requestedCategoryIds = parseCategoryIdsInput(data);
    const rawCategory = String(data.category || "").trim();
    let categories = [];

    if (requestedCategoryIds.length) {
        categories = await Category.find({
            _id: { $in: requestedCategoryIds }
        });

        if (categories.length !== requestedCategoryIds.length) {
            throw new Error("Uma ou mais categorias selecionadas nao foram encontradas.");
        }

        const categoriesById = new Map(categories.map((category) => [String(category._id), category]));
        categories = requestedCategoryIds.map((categoryId) => categoriesById.get(categoryId)).filter(Boolean);
    } else if (rawCategory) {
        const normalizedSlug = slugify(rawCategory);
        const category = await Category.findOne({
            $or: [
                { slug: normalizedSlug },
                { name: rawCategory }
            ]
        });

        if (category) {
            categories = [category];
        }
    }

    if (!categories.length) {
        throw new Error("Selecione pelo menos uma categoria disponivel.");
    }

    return {
        primaryCategory: categories[0],
        categories
    };
}

async function resolveProductCategory(data) {
    const rawCategoryId = String(data.categoryId || "").trim();
    const rawCategory = String(data.category || "").trim();

    if (rawCategoryId) {
        const category = await Category.findById(rawCategoryId);

        if (!category) {
            throw new Error("Categoria selecionada não foi encontrada.");
        }

        return {
            category: category.name,
            categorySlug: category.slug,
            categoryId: category._id
        };
    }

    if (rawCategory) {
        const normalizedSlug = slugify(rawCategory);
        const category = await Category.findOne({
            $or: [
                { slug: normalizedSlug },
                { name: rawCategory }
            ]
        });

        if (category) {
            return {
                category: category.name,
                categorySlug: category.slug,
                categoryId: category._id
            };
        }
    }

    throw new Error("Selecione uma categoria disponível.");
}

async function buildProductPayload(data) {
    const resolvedCategories = await resolveProductCategories(data);
    const name = String(data.name || "").trim();
    const generatedSlug = slugify(data.slug || name);
    const installmentQuantity = normalizeCurrencyNumber(data.installmentQuantity, 1);
    const installmentValue = normalizeCurrencyNumber(data.installmentValue, 0);
    const compareAtPrice = data.compareAtPrice === "" ? null : normalizeCurrencyNumber(data.compareAtPrice, null);
    const stockMode = normalizeStockMode(data.stockMode);
    const status = normalizeProductStatus(
        data.status,
        data.isActive === undefined ? "active" : (normalizeBoolean(data.isActive) ? "active" : "draft")
    );
    const stockQuantity = stockMode === "limited"
        ? normalizeIntegerNumber(data.stockQuantity, 0)
        : null;

    const payload = {
        name,
        slug: generatedSlug,
        description: String(data.description || "").trim(),
        category: resolvedCategories.primaryCategory.name,
        categorySlug: resolvedCategories.primaryCategory.slug,
        categoryId: resolvedCategories.primaryCategory._id,
        categories: resolvedCategories.categories.map((category) => category.name),
        categorySlugs: resolvedCategories.categories.map((category) => category.slug),
        categoryIds: resolvedCategories.categories.map((category) => category._id),
        imageUrl: String(data.imageUrl || "").trim(),
        imagePublicId: String(data.imagePublicId || "").trim(),
        images: [],
        price: normalizeCurrencyNumber(data.price, 0),
        compareAtPrice,
        variations: parseProductVariations(data.variations),
        installments: {
            quantity: installmentQuantity,
            value: installmentValue
        },
        personalization: {
            enabled: false,
            showNameInput: normalizePersonalizationShowNameInput(data),
            requireName: normalizePersonalizationRequireName(data),
            imageOverlay: normalizePersonalizationImageOverlay(data),
            preview: normalizePersonalizationPreview(data),
            previews: normalizePersonalizationPreviews(data)
        },
        shipping: {
            allowMotoboy: data.shippingAllowMotoboy === undefined
                ? true
                : normalizeBoolean(data.shippingAllowMotoboy),
            productionDays: normalizeIntegerNumber(data.shippingProductionDays, 0),
            weightKg: normalizePositiveDecimal(data.shippingWeightKg, 0),
            lengthCm: normalizePositiveDecimal(data.shippingLengthCm, 0),
            widthCm: normalizePositiveDecimal(data.shippingWidthCm, 0),
            heightCm: normalizePositiveDecimal(data.shippingHeightCm, 0)
        },
        stock: {
            mode: stockMode,
            quantity: stockQuantity
        },
        isFeatured: normalizeBoolean(data.isFeatured),
        showInMoreOptions: normalizeBoolean(data.showInMoreOptions),
        status,
        isActive: status === "active"
    };

    if (payload.personalization.previews.length) {
        payload.personalization.preview = payload.personalization.previews[0];
    }

    if (payload.personalization.requireName) {
        payload.personalization.showNameInput = true;
    }

    payload.personalization.enabled = Boolean(
        payload.personalization.showNameInput ||
        payload.personalization.requireName ||
        payload.personalization.previews.some((preview) => preview.enabled) ||
        payload.personalization.preview.enabled ||
        payload.personalization.imageOverlay.enabled
    );

    return payload;
}

async function syncProductCategoryAssignment(productId, categoryId) {
    const normalizedCategoryIds = [...new Set(
        (Array.isArray(categoryId) ? categoryId : [categoryId])
            .map((value) => String(value || "").trim())
            .filter(Boolean)
    )];

    await Category.updateMany(
        {
            products: productId,
            ...(normalizedCategoryIds.length ? { _id: { $nin: normalizedCategoryIds } } : {})
        },
        {
            $pull: {
                products: productId
            }
        }
    );

    if (normalizedCategoryIds.length) {
        await Category.updateMany(
            {
                _id: { $in: normalizedCategoryIds }
            },
            {
                $addToSet: {
                    products: productId
                }
            }
        );
    }
}

async function uploadImagesToCloudinary(files = []) {
    if (!files.length) {
        return [];
    }

    ensureCloudinaryConfig();

    const uploads = files.map(async (file) => {
        const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: "arteno/products"
        });

        return {
            imageUrl: result.secure_url,
            imagePublicId: result.public_id
        };
    });

    return Promise.all(uploads);
}

async function destroyCloudinaryImages(publicIds = []) {
    const validPublicIds = publicIds.filter(Boolean);

    if (!validPublicIds.length) {
        return;
    }

    ensureCloudinaryConfig();
    await Promise.all(validPublicIds.map((publicId) => cloudinary.uploader.destroy(publicId)));
}

function normalizeProductImages(product) {
    if (Array.isArray(product.images) && product.images.length) {
        return product.images.filter((image) => image?.imageUrl);
    }

    if (product.imageUrl) {
        return [
            {
                imageUrl: product.imageUrl,
                imagePublicId: product.imagePublicId || ""
            }
        ];
    }

    return [];
}

function applyProductImages(payload, images = []) {
    payload.images = images;
    payload.imageUrl = images[0]?.imageUrl || "";
    payload.imagePublicId = images[0]?.imagePublicId || "";
}

function extractUploadedFiles(requestFiles) {
    if (!requestFiles) {
        return [];
    }

    if (Array.isArray(requestFiles)) {
        return requestFiles;
    }

    return [
        ...(requestFiles.images || []),
        ...(requestFiles.image || [])
    ];
}

function extractPreviewImageFiles(requestFiles) {
    if (!requestFiles) {
        return [];
    }

    const legacyPreviewFile = Array.isArray(requestFiles.previewImage) ? requestFiles.previewImage.slice(0, 1) : [];
    const multiplePreviewFiles = Array.isArray(requestFiles.previewImages) ? requestFiles.previewImages : [];

    return [...legacyPreviewFile, ...multiplePreviewFiles];
}

function applyUploadedPreviewImages(previews = [], uploadedImages = []) {
    let uploadCursor = 0;

    return previews.map((preview) => {
        const nextPreview = { ...preview };

        if (typeof preview.uploadIndex === "number") {
            const uploadedImage = uploadedImages[uploadCursor];
            uploadCursor += 1;

            nextPreview.imageUrl = uploadedImage?.imageUrl || "";
            nextPreview.imagePublicId = uploadedImage?.imagePublicId || "";
        }

        delete nextPreview.uploadIndex;
        return nextPreview;
    });
}

function getExistingPersonalizationPreviews(product = {}) {
    const previews = Array.isArray(product.personalization?.previews)
        ? product.personalization.previews.filter((preview) => preview?.imageUrl || preview?.enabled)
        : [];

    if (previews.length) {
        return previews.map((preview) => normalizePersonalizationPreviewEntry(preview));
    }

    const legacyPreview = normalizePersonalizationPreviewEntry(product.personalization?.preview || {});
    return legacyPreview.imageUrl || legacyPreview.enabled ? [legacyPreview] : [];
}

function extractOverlayOptionFiles(requestFiles) {
    if (!requestFiles || !Array.isArray(requestFiles.overlayOptionImages)) {
        return [];
    }

    return requestFiles.overlayOptionImages;
}

function extractVariationItemFiles(requestFiles) {
    if (!requestFiles || !Array.isArray(requestFiles.variationItemImages)) {
        return [];
    }

    return requestFiles.variationItemImages;
}

function extractVariationItemPreviewFiles(requestFiles) {
    if (!requestFiles || !Array.isArray(requestFiles.variationItemPreviewImages)) {
        return [];
    }

    return requestFiles.variationItemPreviewImages;
}

function parseVariationItemUploadMap(value) {
    if (!value) {
        return [];
    }

    try {
        const parsedValue = JSON.parse(value);

        if (!Array.isArray(parsedValue)) {
            return [];
        }

        return parsedValue.map((item = {}) => ({
            itemId: String(item.itemId || "").trim()
        })).filter((item) => item.itemId);
    } catch (_error) {
        return [];
    }
}

function getVariationItems(variations = []) {
    return variations.flatMap((variation = {}) => Array.isArray(variation.items) ? variation.items : []);
}

async function applyVariationItemUploads(variations, files = [], uploadMap = []) {
    if (!Array.isArray(variations) || !variations.length || !files.length || !uploadMap.length) {
        return variations;
    }

    const uploadedImages = await uploadImagesToCloudinary(files);
    const uploadsByItemId = new Map();

    uploadMap.forEach((entry, index) => {
        const uploadedImage = uploadedImages[index];

        if (entry.itemId && uploadedImage) {
            uploadsByItemId.set(entry.itemId, uploadedImage);
        }
    });

    return variations.map((variation) => ({
        ...variation,
        items: variation.items.map((item) => {
            const uploadedImage = uploadsByItemId.get(item.id);

            if (!uploadedImage) {
                return item;
            }

            return {
                ...item,
                imageUrl: uploadedImage.imageUrl,
                imagePublicId: uploadedImage.imagePublicId
            };
        })
    }));
}

async function applyVariationItemPreviewUploads(variations, files = [], uploadMap = []) {
    if (!Array.isArray(variations) || !variations.length || !files.length || !uploadMap.length) {
        return variations;
    }

    const uploadedImages = await uploadImagesToCloudinary(files);
    const uploadsByItemId = new Map();

    uploadMap.forEach((entry, index) => {
        const uploadedImage = uploadedImages[index];

        if (entry.itemId && uploadedImage) {
            uploadsByItemId.set(entry.itemId, uploadedImage);
        }
    });

    return variations.map((variation) => ({
        ...variation,
        items: variation.items.map((item) => {
            const uploadedImage = uploadsByItemId.get(item.id);

            if (!uploadedImage) {
                return item;
            }

            return {
                ...item,
                previewImageUrl: uploadedImage.imageUrl,
                previewImagePublicId: uploadedImage.imagePublicId
            };
        })
    }));
}

function parseRetainedImages(value) {
    if (!value) {
        return null;
    }

    try {
        const parsedValue = JSON.parse(value);

        if (!Array.isArray(parsedValue)) {
            return null;
        }

        return parsedValue
            .filter((image) => image && typeof image.imageUrl === "string")
            .map((image) => ({
                imageUrl: String(image.imageUrl || "").trim(),
                imagePublicId: String(image.imagePublicId || "").trim()
            }))
            .filter((image) => image.imageUrl);
    } catch (_error) {
        return null;
    }
}

function serializeProduct(product) {
    if (!product) {
        return product;
    }

    const plainProduct = typeof product.toObject === "function" ? product.toObject() : { ...product };
    const images = normalizeProductImages(plainProduct);

    return {
        ...plainProduct,
        status: getProductStatus(plainProduct),
        isActive: getProductStatus(plainProduct) === "active",
        categories: Array.isArray(plainProduct.categories) && plainProduct.categories.length
            ? plainProduct.categories
            : (plainProduct.category ? [plainProduct.category] : []),
        categorySlugs: Array.isArray(plainProduct.categorySlugs) && plainProduct.categorySlugs.length
            ? plainProduct.categorySlugs
            : (plainProduct.categorySlug ? [plainProduct.categorySlug] : []),
        categoryIds: Array.isArray(plainProduct.categoryIds) && plainProduct.categoryIds.length
            ? plainProduct.categoryIds
            : (plainProduct.categoryId ? [plainProduct.categoryId] : []),
        images,
        imageUrl: images[0]?.imageUrl || plainProduct.imageUrl || "",
        imagePublicId: images[0]?.imagePublicId || plainProduct.imagePublicId || ""
    };
}

function escapeRegex(value = "") {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildActiveProductsFilter() {
    return {
        $or: [
            { status: "active" },
            { status: { $exists: false }, isActive: true }
        ]
    };
}

function parseBooleanQueryValue(value) {
    if (value === true || value === "true" || value === "1" || value === "on") {
        return true;
    }

    if (value === false || value === "false" || value === "0" || value === "off") {
        return false;
    }

    return null;
}

function parsePositiveQueryNumber(value) {
    const rawValue = String(value ?? "").trim();

    if (!rawValue) {
        return null;
    }

    const normalized = Number(rawValue.replace(",", "."));
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
}

function buildProductListingQueryOptions(query = {}, { categorySlug = "" } = {}) {
    const filters = {
        ...buildActiveProductsFilter()
    };
    const searchTerm = String(query.q || query.search || "").trim();
    const selectedCategory = String(categorySlug || query.category || "").trim();
    const minPrice = parsePositiveQueryNumber(query.minPrice);
    const maxPrice = parsePositiveQueryNumber(query.maxPrice);
    const onSale = parseBooleanQueryValue(query.onSale);
    const personalizable = parseBooleanQueryValue(query.personalizable);
    const sort = String(query.sort || "").trim();
    const andFilters = [];

    if (searchTerm) {
        const safeRegex = new RegExp(escapeRegex(searchTerm), "i");
        andFilters.push({
            $or: [
                { name: safeRegex },
                { description: safeRegex },
                { category: safeRegex }
            ]
        });
    }

    if (selectedCategory) {
        andFilters.push({
            $or: [
                { categorySlug: selectedCategory },
                { categorySlugs: selectedCategory },
                { category: new RegExp(`^${escapeRegex(selectedCategory)}$`, "i") },
                { categories: new RegExp(`^${escapeRegex(selectedCategory)}$`, "i") }
            ]
        });
    }

    if (minPrice !== null || maxPrice !== null) {
        const priceFilter = {};

        if (minPrice !== null) {
            priceFilter.$gte = minPrice;
        }

        if (maxPrice !== null) {
            priceFilter.$lte = maxPrice;
        }

        andFilters.push({ price: priceFilter });
    }

    if (onSale === true) {
        andFilters.push({
            compareAtPrice: {
                $ne: null,
                $gt: 0
            }
        });
    }

    if (personalizable === true) {
        andFilters.push({
            $or: [
                { "personalization.enabled": true },
                { "personalization.showNameInput": true },
                { "personalization.requireName": true },
                { "personalization.preview.enabled": true },
                { "personalization.imageOverlay.enabled": true }
            ]
        });
    }

    if (andFilters.length) {
        filters.$and = andFilters;
    }

    let sortOptions = { createdAt: -1 };

    if (sort === "price_asc") {
        sortOptions = { price: 1, createdAt: -1 };
    } else if (sort === "price_desc") {
        sortOptions = { price: -1, createdAt: -1 };
    }

    return {
        filters,
        sortOptions
    };
}

async function listProducts(req, res) {
    try {
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const { filters, sortOptions } = buildProductListingQueryOptions(req.query);

        let query = Product.find(filters).sort(sortOptions);

        if (Number.isInteger(requestedLimit) && requestedLimit > 0) {
            query = query.limit(requestedLimit);
        }

        const products = await query;
        res.json(products.map((product) => serializeProduct(product)));
    } catch (_error) {
        res.status(500).json({ message: "Erro ao buscar produtos" });
    }
}

async function getFeaturedProducts(_req, res) {
    try {
        const products = await Product.find({
            ...buildActiveProductsFilter(),
            isFeatured: true
        }).sort({ createdAt: -1 });

        res.json(products.map((product) => serializeProduct(product)));
    } catch (_error) {
        res.status(500).json({ message: "Erro ao buscar produtos em destaque" });
    }
}

async function getProductBySlug(req, res) {
    try {
        const product = await Product.findOne({
            slug: req.params.slug,
            $or: [
                { status: "active" },
                { status: "unlisted" },
                { status: { $exists: false }, isActive: true }
            ]
        });

        if (!product) {
            return res.status(404).json({ message: "Produto não encontrado" });
        }

        return res.json(serializeProduct(product));
    } catch (_error) {
        return res.status(500).json({ message: "Erro ao buscar produto" });
    }
}

async function listAdminProducts(_req, res) {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products.map((product) => serializeProduct(product)));
    } catch (_error) {
        res.status(500).json({ message: "Erro ao listar produtos no painel" });
    }
}

async function createProduct(req, res) {
    try {
        const payload = await buildProductPayload(req.body);
        const uploadedImages = await uploadImagesToCloudinary(extractUploadedFiles(req.files));
        const previewImageFiles = extractPreviewImageFiles(req.files);
        const uploadedPreviewImages = await uploadImagesToCloudinary(previewImageFiles);
        const uploadedOverlayOptionImages = await uploadImagesToCloudinary(extractOverlayOptionFiles(req.files));
        const variationItemFiles = extractVariationItemFiles(req.files);
        const variationItemPreviewFiles = extractVariationItemPreviewFiles(req.files);
        const variationItemUploadMap = parseVariationItemUploadMap(req.body.variationItemUploadMap);
        const variationItemPreviewUploadMap = parseVariationItemUploadMap(req.body.variationItemPreviewUploadMap);

        applyProductImages(payload, uploadedImages);
        payload.personalization.previews = applyUploadedPreviewImages(payload.personalization.previews, uploadedPreviewImages);
        payload.personalization.preview = payload.personalization.previews[0] || payload.personalization.preview;
        payload.personalization.imageOverlay.optionImages = payload.personalization.imageOverlay.allowOptionImages
            ? uploadedOverlayOptionImages
            : [];
        payload.variations = await applyVariationItemUploads(payload.variations, variationItemFiles, variationItemUploadMap);
        payload.variations = await applyVariationItemPreviewUploads(payload.variations, variationItemPreviewFiles, variationItemPreviewUploadMap);

        const product = await Product.create(payload);
        await syncProductCategoryAssignment(product._id, product.categoryIds);

        res.status(201).json(serializeProduct(product));
    } catch (error) {
        res.status(400).json({
            message: "Erro ao criar produto",
            error: error.message
        });
    }
}

async function updateProduct(req, res) {
    try {
        const payload = await buildProductPayload(req.body);
        const existingProduct = await Product.findById(req.params.id);
        const uploadedFiles = extractUploadedFiles(req.files);
        const previewImageFiles = extractPreviewImageFiles(req.files);
        const overlayOptionFiles = extractOverlayOptionFiles(req.files);
        const variationItemFiles = extractVariationItemFiles(req.files);
        const variationItemPreviewFiles = extractVariationItemPreviewFiles(req.files);
        const variationItemUploadMap = parseVariationItemUploadMap(req.body.variationItemUploadMap);
        const variationItemPreviewUploadMap = parseVariationItemUploadMap(req.body.variationItemPreviewUploadMap);

        if (!existingProduct) {
            return res.status(404).json({ message: "Produto não encontrado" });
        }

        const existingImages = normalizeProductImages(existingProduct);
        const retainedImages = parseRetainedImages(req.body.retainedImages);
        const retainedOverlayOptionImages = parseRetainedImages(req.body.retainedOverlayOptionImages);

        const baseImages = retainedImages ?? existingImages;
        const removedPublicIds = existingImages
            .filter((image) => !baseImages.some((nextImage) => nextImage.imagePublicId === image.imagePublicId))
            .map((image) => image.imagePublicId);

        await destroyCloudinaryImages(removedPublicIds);

        if (!uploadedFiles.length) {
            applyProductImages(payload, baseImages);
        } else {
            const uploadedImages = await uploadImagesToCloudinary(uploadedFiles);
            applyProductImages(payload, [...baseImages, ...uploadedImages]);
        }

        const existingPersonalizationPreviews = getExistingPersonalizationPreviews(existingProduct);
        const retainedPreviewPublicIds = payload.personalization.previews
            .map((preview) => preview.imagePublicId)
            .filter(Boolean);
        const removedPreviewPublicIds = existingPersonalizationPreviews
            .filter((preview) => preview.imagePublicId && !retainedPreviewPublicIds.includes(preview.imagePublicId))
            .map((preview) => preview.imagePublicId);

        await destroyCloudinaryImages(removedPreviewPublicIds);
        payload.personalization.previews = applyUploadedPreviewImages(
            payload.personalization.previews,
            await uploadImagesToCloudinary(previewImageFiles)
        );
        payload.personalization.preview = payload.personalization.previews[0] || normalizePersonalizationPreviewEntry(existingProduct.personalization?.preview || {});
        const existingOverlayOptionImages = Array.isArray(existingProduct.personalization?.imageOverlay?.optionImages)
            ? existingProduct.personalization.imageOverlay.optionImages.filter((image) => image?.imageUrl)
            : [];
        payload.personalization.imageOverlay.optionImages = payload.personalization.imageOverlay.allowOptionImages
            ? (retainedOverlayOptionImages ?? existingOverlayOptionImages)
            : [];

        const removedOverlayPublicIds = existingOverlayOptionImages
            .filter((image) => !payload.personalization.imageOverlay.optionImages.some((nextImage) => nextImage.imagePublicId === image.imagePublicId))
            .map((image) => image.imagePublicId);

        await destroyCloudinaryImages(removedOverlayPublicIds);

        if (payload.personalization.imageOverlay.allowOptionImages && overlayOptionFiles.length) {
            const uploadedOverlayOptionImages = await uploadImagesToCloudinary(overlayOptionFiles);
            const existingOverlayPublicIds = payload.personalization.imageOverlay.optionImages.map((image) => image.imagePublicId);

            await destroyCloudinaryImages(existingOverlayPublicIds);
            payload.personalization.imageOverlay.optionImages = uploadedOverlayOptionImages;
        }

        const existingVariationImagePublicIds = getVariationItems(existingProduct.variations || [])
            .flatMap((item) => [item.imagePublicId, item.previewImagePublicId])
            .filter(Boolean);

        payload.variations = await applyVariationItemUploads(payload.variations, variationItemFiles, variationItemUploadMap);
        payload.variations = await applyVariationItemPreviewUploads(payload.variations, variationItemPreviewFiles, variationItemPreviewUploadMap);

        const nextVariationImagePublicIds = getVariationItems(payload.variations)
            .flatMap((item) => [item.imagePublicId, item.previewImagePublicId])
            .filter(Boolean);
        const removedVariationImagePublicIds = existingVariationImagePublicIds
            .filter((publicId) => !nextVariationImagePublicIds.includes(publicId));

        await destroyCloudinaryImages(removedVariationImagePublicIds);

        const product = await Product.findByIdAndUpdate(req.params.id, payload, {
            returnDocument: "after",
            runValidators: true
        });
        await syncProductCategoryAssignment(product._id, product.categoryIds);

        return res.json(serializeProduct(product));
    } catch (error) {
        return res.status(400).json({
            message: "Erro ao atualizar produto",
            error: error.message
        });
    }
}

async function deleteProduct(req, res) {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Produto não encontrado" });
        }

        const images = normalizeProductImages(product);
        await destroyCloudinaryImages(images.map((image) => image.imagePublicId));
        await destroyCloudinaryImages([product.personalization?.preview?.imagePublicId]);
        await destroyCloudinaryImages(
            Array.isArray(product.personalization?.imageOverlay?.optionImages)
                ? product.personalization.imageOverlay.optionImages.map((image) => image.imagePublicId)
                : []
        );
        await destroyCloudinaryImages(
            getVariationItems(product.variations || [])
                .flatMap((item) => [item.imagePublicId, item.previewImagePublicId])
                .filter(Boolean)
        );
        await syncProductCategoryAssignment(product._id, null);

        return res.json({ message: "Produto removido com sucesso" });
    } catch (error) {
        return res.status(400).json({
            message: "Erro ao remover produto",
            error: error.message
        });
    }
}

module.exports = {
    buildProductListingQueryOptions,
    listProducts,
    getFeaturedProducts,
    getProductBySlug,
    listAdminProducts,
    createProduct,
    updateProduct,
    deleteProduct
};
