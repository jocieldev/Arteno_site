const express = require("express");
const { quoteShipping, quoteCheckoutShipping } = require("../controllers/shippingController");

const router = express.Router();

router.post("/quote", quoteShipping);
router.post("/checkout-quote", quoteCheckoutShipping);

module.exports = router;
