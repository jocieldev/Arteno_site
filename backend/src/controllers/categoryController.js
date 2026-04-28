const Category = require("../models/Category");
const Product = require("../models/Product");
const { cloudinary, ensureCloudinaryConfig } = require("../config/cloudinary");
const { buildProductListingQueryOptions } = require("./productController");

function slugify(value = "") {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizeProductIds(value) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

async function uploadImageToCloudinary(file) {
    if (!file) {
        return null;
    }

    ensureCloudinaryConfig();

    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
        folder: "arteno/categories"
    });

    return {
        imageUrl: result.secure_url,
        imagePublicId: result.public_id
    };
}

async function destroyCloudinaryImage(publicId) {
    if (!publicId) {
        return;
    }

    ensureCloudinaryConfig();
    await cloudinary.uploader.destroy(publicId);
}

function serializeCategory(category) {
    if (!category) {
        return category;
    }

    const plainCategory = typeof category.toObject === "function" ? category.toObject() : { ...category };
    const products = Array.isArray(plainCategory.products) ? plainCategory.products : [];

    return {
        ...plainCategory,
        products,
        productsCount: products.length
    };
}

function getProductCategoryEntries(product = {}) {
    const categoryIds = Array.isArray(product.categoryIds) && product.categoryIds.length
        ? product.categoryIds.map((item) => String(item || "").trim())
        : [];
    const categoryNames = Array.isArray(product.categories) && product.categories.length
        ? product.categories.map((item) => String(item || "").trim())
        : [];
    const categorySlugs = Array.isArray(product.categorySlugs) && product.categorySlugs.length
        ? product.categorySlugs.map((item) => String(item || "").trim())
        : [];

    const entries = categoryIds.map((categoryEntryId, index) => ({
        id: categoryEntryId,
        name: categoryNames[index] || "",
        slug: categorySlugs[index] || ""
    })).filter((entry) => entry.id);

    if (!entries.length && product.categoryId) {
        entries.push({
            id: String(product.categoryId || "").trim(),
            name: String(product.category || "").trim(),
            slug: String(product.categorySlug || "").trim()
        });
    }

    return entries.filter((entry, index, array) => {
        return array.findIndex((candidate) => candidate.id === entry.id) === index;
    });
}

async function persistProductCategoryEntries(product, entries = []) {
    const normalizedEntries = entries.filter((entry) => entry?.id);
    const primaryEntry = normalizedEntries[0] || null;

    await Product.findByIdAndUpdate(product._id, {
        $set: {
            category: primaryEntry?.name || "",
            categorySlug: primaryEntry?.slug || "",
            categoryId: primaryEntry?.id || null,
            categories: normalizedEntries.map((entry) => entry.name || ""),
            categorySlugs: normalizedEntries.map((entry) => entry.slug || ""),
            categoryIds: normalizedEntries.map((entry) => entry.id)
        }
    });
}

async function syncCategoryProducts({ categoryId, name, slug, productIds }) {
    const normalizedCategoryId = String(categoryId || "").trim();
    const selectedProductIds = new Set(productIds.map((productId) => String(productId || "").trim()));
    const relatedProducts = await Product.find({
        $or: [
            { categoryIds: normalizedCategoryId },
            { categoryId: normalizedCategoryId },
            { _id: { $in: [...selectedProductIds] } }
        ]
    }).select({
        category: 1,
        categorySlug: 1,
        categoryId: 1,
        categories: 1,
        categorySlugs: 1,
        categoryIds: 1
    });

    for (const product of relatedProducts) {
        const productId = String(product._id || "").trim();
        const currentEntries = getProductCategoryEntries(product);
        const shouldIncludeCategory = selectedProductIds.has(productId);
        const nextEntries = currentEntries
            .filter((entry) => shouldIncludeCategory || entry.id !== normalizedCategoryId)
            .map((entry) => {
                if (entry.id !== normalizedCategoryId) {
                    return entry;
                }

                return {
                    id: normalizedCategoryId,
                    name,
                    slug
                };
            });

        if (shouldIncludeCategory && !nextEntries.some((entry) => entry.id === normalizedCategoryId)) {
            nextEntries.push({
                id: normalizedCategoryId,
                name,
                slug
            });
        }

        await persistProductCategoryEntries(product, nextEntries);
    }
}

async function listCategories(_req, res) {
    try {
        const categories = await Category.find().sort({ createdAt: -1 }).populate({
            path: "products",
            match: {
                $or: [
                    { status: "active" },
                    { status: { $exists: false }, isActive: true }
                ]
            },
            options: { sort: { createdAt: -1 } }
        });

        res.json(categories.map((category) => serializeCategory(category)));
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar categorias" });
    }
}

async function getCategoryBySlug(req, res) {
    try {
        const { filters, sortOptions } = buildProductListingQueryOptions(req.query, {
            categorySlug: req.params.slug
        });
        const category = await Category.findOne({ slug: req.params.slug }).populate({
            path: "products",
            match: filters,
            options: { sort: sortOptions }
        });

        if (!category) {
            return res.status(404).json({ message: "Categoria não encontrada" });
        }

        return res.json(serializeCategory(category));
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar categoria" });
    }
}

async function listAdminCategories(_req, res) {
    try {
        const categories = await Category.find().sort({ createdAt: -1 }).populate({
            path: "products",
            options: { sort: { createdAt: -1 } }
        });

        res.json(categories.map((category) => serializeCategory(category)));
    } catch (error) {
        res.status(500).json({ message: "Erro ao listar categorias no painel" });
    }
}

async function createCategory(req, res) {
    try {
        const name = String(req.body.name || "").trim();
        const slug = slugify(req.body.slug || name);
        const productIds = normalizeProductIds(req.body.productIds);
        const uploadedImage = await uploadImageToCloudinary(req.file);

        const category = await Category.create({
            name,
            slug,
            imageUrl: uploadedImage?.imageUrl || "",
            imagePublicId: uploadedImage?.imagePublicId || "",
            products: productIds
        });

        await syncCategoryProducts({
            categoryId: category._id,
            name,
            slug,
            productIds
        });

        const populatedCategory = await Category.findById(category._id).populate("products");
        res.status(201).json(serializeCategory(populatedCategory));
    } catch (error) {
        res.status(400).json({
            message: "Erro ao criar categoria",
            error: error.message
        });
    }
}

async function updateCategory(req, res) {
    try {
        const existingCategory = await Category.findById(req.params.id);

        if (!existingCategory) {
            return res.status(404).json({ message: "Categoria não encontrada" });
        }

        const name = String(req.body.name || "").trim();
        const slug = slugify(req.body.slug || name);
        const productIds = normalizeProductIds(req.body.productIds);
        let imageUrl = existingCategory.imageUrl || "";
        let imagePublicId = existingCategory.imagePublicId || "";

        if (req.file) {
            const uploadedImage = await uploadImageToCloudinary(req.file);
            await destroyCloudinaryImage(existingCategory.imagePublicId);
            imageUrl = uploadedImage?.imageUrl || "";
            imagePublicId = uploadedImage?.imagePublicId || "";
        }

        const category = await Category.findByIdAndUpdate(
            req.params.id,
            {
                name,
                slug,
                imageUrl,
                imagePublicId,
                products: productIds
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        ).populate("products");

        await syncCategoryProducts({
            categoryId: category._id,
            name,
            slug,
            productIds
        });

        const refreshedCategory = await Category.findById(category._id).populate("products");
        return res.json(serializeCategory(refreshedCategory));
    } catch (error) {
        return res.status(400).json({
            message: "Erro ao atualizar categoria",
            error: error.message
        });
    }
}

async function deleteCategory(req, res) {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);

        if (!category) {
            return res.status(404).json({ message: "Categoria não encontrada" });
        }

        const relatedProducts = await Product.find({
            $or: [
                { categoryIds: String(category._id || "").trim() },
                { categoryId: category._id }
            ]
        }).select({
            category: 1,
            categorySlug: 1,
            categoryId: 1,
            categories: 1,
            categorySlugs: 1,
            categoryIds: 1
        });

        for (const product of relatedProducts) {
            const nextEntries = getProductCategoryEntries(product).filter((entry) => {
                return entry.id !== String(category._id || "").trim();
            });

            await persistProductCategoryEntries(product, nextEntries);
        }

        await destroyCloudinaryImage(category.imagePublicId);

        return res.json({ message: "Categoria removida com sucesso" });
    } catch (error) {
        return res.status(400).json({
            message: "Erro ao remover categoria",
            error: error.message
        });
    }
}

module.exports = {
    listCategories,
    getCategoryBySlug,
    listAdminCategories,
    createCategory,
    updateCategory,
    deleteCategory
};
