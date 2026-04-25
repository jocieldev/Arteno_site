const express = require("express");

const {
    listAdminSiteBanners,
    getAdminSiteContact,
    getAdminCardSettings,
    updateSiteContact,
    updateAdminCardSettings,
    createSiteBanner,
    updateSiteBanner,
    deleteSiteBanner
} = require("../controllers/siteSettingController");
const uploadSiteBannerImage = require("../middleware/uploadSiteBannerImage");

const router = express.Router();

router.get("/banners", listAdminSiteBanners);
router.get("/contact", getAdminSiteContact);
router.get("/card-settings", getAdminCardSettings);
router.put("/contact", express.json(), updateSiteContact);
router.put("/card-settings", express.json(), updateAdminCardSettings);
router.post("/banners", uploadSiteBannerImage, createSiteBanner);
router.put("/banners/:id", uploadSiteBannerImage, updateSiteBanner);
router.delete("/banners/:id", deleteSiteBanner);

module.exports = router;
