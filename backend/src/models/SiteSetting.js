const mongoose = require("mongoose");

const siteBannerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            default: "",
            trim: true
        },
        linkUrl: {
            type: String,
            default: "",
            trim: true
        },
        desktopImageUrl: {
            type: String,
            default: "",
            trim: true
        },
        desktopImagePublicId: {
            type: String,
            default: "",
            trim: true
        },
        mobileImageUrl: {
            type: String,
            default: "",
            trim: true
        },
        mobileImagePublicId: {
            type: String,
            default: "",
            trim: true
        },
        imageUrl: {
            type: String,
            required: true,
            trim: true
        },
        imagePublicId: {
            type: String,
            default: "",
            trim: true
        }
    },
    {
        timestamps: true
    }
);

const siteSettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        contact: {
            whatsappNumber: {
                type: String,
                default: "",
                trim: true
            },
            email: {
                type: String,
                default: "",
                trim: true
            },
            instagramUrl: {
                type: String,
                default: "",
                trim: true
            }
        },
        banners: {
            type: [siteBannerSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("SiteSetting", siteSettingSchema);
