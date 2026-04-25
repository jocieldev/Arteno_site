const express = require("express");
const {
    createCheckoutOrder,
    getCheckoutPublicConfig,
    getCheckoutCardInstallments,
    previewCheckoutCoupon,
    uploadCheckoutPersonalizationImage
} = require("../controllers/checkoutMercadoPagoController");
const attachCurrentUser = require("../middleware/attachCurrentUser");
const uploadPersonalizationImage = require("../middleware/uploadPersonalizationImage");

const router = express.Router();

router.get("/config", getCheckoutPublicConfig);
router.get("/card-installments", getCheckoutCardInstallments);
router.post("/coupon-preview", attachCurrentUser, previewCheckoutCoupon);
router.post("/personalization-image", attachCurrentUser, uploadPersonalizationImage, uploadCheckoutPersonalizationImage);
router.post("/orders", attachCurrentUser, createCheckoutOrder);

module.exports = router;
