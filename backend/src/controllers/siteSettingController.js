const SiteSetting = require("../models/SiteSetting");
const { cloudinary, ensureCloudinaryConfig } = require("../config/cloudinary");

const SITE_SETTINGS_KEY = "site-home";

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeWhatsappNumber(value = "") {
    const digits = String(value || "").replace(/\D/g, "").trim();

    if (digits.length === 10 || digits.length === 11) {
        return `55${digits}`;
    }

    return digits;
}

function serializeSiteContact(contact = {}) {
    const whatsappNumber = normalizeWhatsappNumber(contact.whatsappNumber || "");
    const email = normalizeText(contact.email);
    const instagramUrl = normalizeText(contact.instagramUrl);

    return {
        whatsappNumber,
        whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : "",
        email,
        emailUrl: email ? `mailto:${email}` : "",
        instagramUrl
    };
}

async function getSiteSettingsDocument() {
    let setting = await SiteSetting.findOne({ key: SITE_SETTINGS_KEY });

    if (!setting) {
        setting = await SiteSetting.create({
            key: SITE_SETTINGS_KEY,
            banners: []
        });
    }

    return setting;
}

function serializeBanner(banner) {
    const desktopImageUrl = banner.desktopImageUrl || banner.imageUrl || "";
    const desktopImagePublicId = banner.desktopImagePublicId || banner.imagePublicId || "";

    return {
        id: String(banner._id),
        name: banner.name || "",
        linkUrl: banner.linkUrl || "",
        imageUrl: desktopImageUrl,
        imagePublicId: desktopImagePublicId,
        desktopImageUrl,
        desktopImagePublicId,
        mobileImageUrl: banner.mobileImageUrl || "",
        mobileImagePublicId: banner.mobileImagePublicId || "",
        createdAt: banner.createdAt || null,
        updatedAt: banner.updatedAt || null
    };
}

async function uploadBannerImage(file, folderSuffix = "desktop") {
    if (!file) {
        throw new Error("Selecione uma imagem para o banner.");
    }

    ensureCloudinaryConfig();
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
        folder: `arteno/site-banners/${folderSuffix}`
    });

    return {
        imageUrl: result.secure_url,
        imagePublicId: result.public_id
    };
}

async function destroyBannerImage(publicId = "") {
    if (!publicId) {
        return;
    }

    ensureCloudinaryConfig();
    await cloudinary.uploader.destroy(publicId);
}

async function listAdminSiteBanners(_req, res) {
    try {
        const setting = await getSiteSettingsDocument();

        return res.json({
            contact: serializeSiteContact(setting.contact || {}),
            banners: setting.banners.map((banner) => serializeBanner(banner))
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Não foi possível carregar as configurações do site."
        });
    }
}

async function listPublicSiteBanners(_req, res) {
    try {
        const setting = await getSiteSettingsDocument();

        return res.json({
            contact: serializeSiteContact(setting.contact || {}),
            banners: setting.banners.map((banner) => serializeBanner(banner))
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Não foi possível carregar os banners do site."
        });
    }
}

async function getAdminSiteContact(_req, res) {
    try {
        const setting = await getSiteSettingsDocument();

        return res.json({
            contact: serializeSiteContact(setting.contact || {})
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Não foi possível carregar os contatos do site."
        });
    }
}

async function getPublicSiteContact(_req, res) {
    try {
        const setting = await getSiteSettingsDocument();

        return res.json({
            contact: serializeSiteContact(setting.contact || {})
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Não foi possível carregar os contatos do site."
        });
    }
}

async function updateSiteContact(req, res) {
    try {
        const setting = await getSiteSettingsDocument();

        setting.contact = {
            whatsappNumber: normalizeWhatsappNumber(req.body.whatsappNumber),
            email: normalizeText(req.body.email),
            instagramUrl: normalizeText(req.body.instagramUrl)
        };

        await setting.save();

        return res.json({
            message: "Contatos do site atualizados com sucesso.",
            contact: serializeSiteContact(setting.contact || {})
        });
    } catch (error) {
        return res.status(400).json({
            message: error.message || "Não foi possível atualizar os contatos do site."
        });
    }
}

async function createSiteBanner(req, res) {
    try {
        const setting = await getSiteSettingsDocument();
        const desktopImageFile = req.files?.desktopImage?.[0] || null;
        const mobileImageFile = req.files?.mobileImage?.[0] || null;

        if (!desktopImageFile) {
            throw new Error("Selecione a imagem do banner para desktop.");
        }

        const uploadedDesktopImage = await uploadBannerImage(desktopImageFile, "desktop");
        const uploadedMobileImage = mobileImageFile
            ? await uploadBannerImage(mobileImageFile, "mobile")
            : null;

        setting.banners.push({
            name: normalizeText(req.body.name || `Banner ${setting.banners.length + 1}`),
            linkUrl: normalizeText(req.body.linkUrl),
            imageUrl: uploadedDesktopImage.imageUrl,
            imagePublicId: uploadedDesktopImage.imagePublicId,
            desktopImageUrl: uploadedDesktopImage.imageUrl,
            desktopImagePublicId: uploadedDesktopImage.imagePublicId,
            mobileImageUrl: uploadedMobileImage?.imageUrl || "",
            mobileImagePublicId: uploadedMobileImage?.imagePublicId || ""
        });

        await setting.save();

        return res.status(201).json({
            message: "Banner criado com sucesso.",
            banners: setting.banners.map((banner) => serializeBanner(banner))
        });
    } catch (error) {
        return res.status(400).json({
            message: error.message || "Não foi possível criar o banner."
        });
    }
}

async function updateSiteBanner(req, res) {
    try {
        const setting = await getSiteSettingsDocument();
        const banner = setting.banners.id(req.params.id);
        const desktopImageFile = req.files?.desktopImage?.[0] || null;
        const mobileImageFile = req.files?.mobileImage?.[0] || null;

        if (!banner) {
            return res.status(404).json({
                message: "Banner não encontrado."
            });
        }

        const nextName = normalizeText(req.body.name || banner.name);
        const nextLinkUrl = normalizeText(req.body.linkUrl);

        if (desktopImageFile) {
            const uploadedDesktopImage = await uploadBannerImage(desktopImageFile, "desktop");
            await destroyBannerImage(banner.desktopImagePublicId || banner.imagePublicId);
            banner.imageUrl = uploadedDesktopImage.imageUrl;
            banner.imagePublicId = uploadedDesktopImage.imagePublicId;
            banner.desktopImageUrl = uploadedDesktopImage.imageUrl;
            banner.desktopImagePublicId = uploadedDesktopImage.imagePublicId;
        }

        if (mobileImageFile) {
            const uploadedMobileImage = await uploadBannerImage(mobileImageFile, "mobile");
            await destroyBannerImage(banner.mobileImagePublicId);
            banner.mobileImageUrl = uploadedMobileImage.imageUrl;
            banner.mobileImagePublicId = uploadedMobileImage.imagePublicId;
        }

        banner.name = nextName || banner.name || "Banner";
        banner.linkUrl = nextLinkUrl;
        banner.updatedAt = new Date();

        await setting.save();

        return res.json({
            message: "Banner atualizado com sucesso.",
            banners: setting.banners.map((currentBanner) => serializeBanner(currentBanner))
        });
    } catch (error) {
        return res.status(400).json({
            message: error.message || "Não foi possível atualizar o banner."
        });
    }
}

async function deleteSiteBanner(req, res) {
    try {
        const setting = await getSiteSettingsDocument();
        const banner = setting.banners.id(req.params.id);

        if (!banner) {
            return res.status(404).json({
                message: "Banner não encontrado."
            });
        }

        await destroyBannerImage(banner.desktopImagePublicId || banner.imagePublicId);
        await destroyBannerImage(banner.mobileImagePublicId);
        banner.deleteOne();
        await setting.save();

        return res.json({
            message: "Banner excluido com sucesso.",
            banners: setting.banners.map((currentBanner) => serializeBanner(currentBanner))
        });
    } catch (error) {
        return res.status(400).json({
            message: error.message || "Não foi possível excluir o banner."
        });
    }
}

module.exports = {
    listAdminSiteBanners,
    listPublicSiteBanners,
    getAdminSiteContact,
    getPublicSiteContact,
    updateSiteContact,
    createSiteBanner,
    updateSiteBanner,
    deleteSiteBanner
};
