const express = require("express");

const {
    listAdminProducts,
    createProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");
const uploadProductImage = require("../middleware/uploadProductImage");

const router = express.Router();

router.get("/", listAdminProducts);
router.post("/", uploadProductImage, createProduct);
router.put("/:id", uploadProductImage, updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
