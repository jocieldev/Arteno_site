const express = require("express");

const { listPublicSiteBanners, getPublicSiteContact } = require("../controllers/siteSettingController");

const router = express.Router();

router.get("/banners", listPublicSiteBanners);
router.get("/contact", getPublicSiteContact);

module.exports = router;
