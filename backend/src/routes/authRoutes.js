const express = require("express");
const {
    registerUser,
    loginUser,
    getCurrentUser,
    logoutUser,
    getAccountDetails,
    requestPasswordResetCode,
    verifyPasswordResetCode,
    resetPasswordWithCode
} = require("../controllers/authController");
const { getCustomerOrderById, listCustomerOrders } = require("../controllers/customerOrderController");
const requireUserAuth = require("../middleware/requireUserAuth");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", requestPasswordResetCode);
router.post("/verify-reset-code", verifyPasswordResetCode);
router.post("/reset-password", resetPasswordWithCode);
router.get("/me", getCurrentUser);
router.post("/logout", logoutUser);
router.get("/account", requireUserAuth, getAccountDetails);
router.get("/orders", requireUserAuth, listCustomerOrders);
router.get("/orders/:id", requireUserAuth, getCustomerOrderById);

module.exports = router;
