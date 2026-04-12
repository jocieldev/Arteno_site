const express = require("express");

const {
    listAdminSiteBanners,
    getAdminSiteContact,
    updateSiteContact,
    createSiteBanner,
    updateSiteBanner,
    deleteSiteBanner
} = require("../controllers/siteSettingController");
const uploadSiteBannerImage = require("../middleware/uploadSiteBannerImage");

const router = express.Router();

router.get("/banners", listAdminSiteBanners);
router.get("/contact", getAdminSiteContact);
router.put("/contact", express.json(), updateSiteContact);
router.post("/banners", uploadSiteBannerImage, createSiteBanner);
router.put("/banners/:id", uploadSiteBannerImage, updateSiteBanner);
router.delete("/banners/:id", deleteSiteBanner);

module.exports = router;
