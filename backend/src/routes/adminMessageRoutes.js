const express = require("express");
const {
    listAdminMessages,
    getAdminMessageUnreadCount,
    updateAdminMessageStatus,
    deleteAdminMessage
} = require("../controllers/adminMessageController");

const router = express.Router();

router.get("/", listAdminMessages);
router.get("/unread-count", getAdminMessageUnreadCount);
router.patch("/:id/status", updateAdminMessageStatus);
router.delete("/:id", deleteAdminMessage);

module.exports = router;
