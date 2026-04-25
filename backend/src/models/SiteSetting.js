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
        },
        cardSettings: {
            enabled: {
                type: Boolean,
                default: true
            },
            maxInstallments: {
                type: Number,
                default: 12
            },
            defaultInterestFreeInstallments: {
                type: Number,
                default: 1
            },
            promoRules: {
                type: [{
                    name: {
                        type: String,
                        default: "",
                        trim: true
                    },
                    enabled: {
                        type: Boolean,
                        default: true
                    },
                    minimumAmount: {
                        type: Number,
                        default: 0
                    },
                    maximumAmount: {
                        type: Number,
                        default: 0
                    },
                    interestFreeInstallments: {
                        type: Number,
                        default: 1
                    }
                }],
                default: []
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("SiteSetting", siteSettingSchema);
