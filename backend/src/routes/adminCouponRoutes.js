const express = require("express");
const {
    listAdminCoupons,
    getAdminCouponById,
    createAdminCoupon,
    updateAdminCoupon
} = require("../controllers/adminCouponController");

const router = express.Router();

router.get("/", listAdminCoupons);
router.get("/:id", getAdminCouponById);
router.post("/", createAdminCoupon);
router.patch("/:id", updateAdminCoupon);

module.exports = router;
