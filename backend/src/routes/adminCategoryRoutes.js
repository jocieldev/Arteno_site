const express = require("express");

const {
    listAdminCategories,
    createCategory,
    updateCategory,
    deleteCategory
} = require("../controllers/categoryController");
const uploadCategoryImage = require("../middleware/uploadCategoryImage");

const router = express.Router();

router.get("/", listAdminCategories);
router.post("/", uploadCategoryImage, createCategory);
router.put("/:id", uploadCategoryImage, updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
