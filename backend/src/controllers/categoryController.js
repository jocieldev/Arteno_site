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

async function syncCategoryProducts({ categoryId, name, slug, productIds }) {
    await Category.updateMany(
        { _id: { $ne: categoryId } },
        { $pull: { products: { $in: productIds } } }
    );

    await Product.updateMany(
        {
            categoryId,
            _id: { $nin: productIds }
        },
        {
            $set: {
                category: "",
                categorySlug: "",
                categoryId: null
            }
        }
    );

    if (productIds.length) {
        await Product.updateMany(
            { _id: { $in: productIds } },
            {
                $set: {
                    category: name,
                    categorySlug: slug,
                    categoryId
                }
            }
        );
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

        await Product.updateMany(
            { categoryId: category._id },
            {
                $set: {
                    category: "",
                    categorySlug: "",
                    categoryId: null
                }
            }
        );

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
