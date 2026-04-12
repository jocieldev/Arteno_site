const express = require("express");
const {
    listAdminOrders,
    getAdminOrderById,
    updateAdminOrderStatus,
    purchaseAdminOrderShipping,
    downloadAdminOrderLabel
} = require("../controllers/adminOrderController");

const router = express.Router();

router.get("/", listAdminOrders);
router.get("/:id", getAdminOrderById);
router.get("/:id/melhor-envio/label", downloadAdminOrderLabel);
router.post("/:id/melhor-envio/purchase", purchaseAdminOrderShipping);
router.patch("/:id/status", updateAdminOrderStatus);

module.exports = router;
