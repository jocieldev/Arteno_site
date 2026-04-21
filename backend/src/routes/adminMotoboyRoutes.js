const express = require("express");
const {
    getAdminMotoboySettings,
    updateAdminMotoboySettings
} = require("../controllers/adminMotoboyController");

const router = express.Router();

router.get("/settings", getAdminMotoboySettings);
router.put("/settings", updateAdminMotoboySettings);

module.exports = router;
