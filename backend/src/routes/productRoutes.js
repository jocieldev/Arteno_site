const express = require("express");

const {
    listProducts,
    getFeaturedProducts,
    getProductBySlug
} = require("../controllers/productController");

const router = express.Router();

router.get("/", listProducts);
router.get("/featured", getFeaturedProducts);
router.get("/:slug", getProductBySlug);

module.exports = router;
