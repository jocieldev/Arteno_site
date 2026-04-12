const mongoose = require("mongoose");

const integrationSettingSchema = new mongoose.Schema(
    {
        provider: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        accessToken: {
            type: String,
            default: ""
        },
        refreshToken: {
            type: String,
            default: ""
        },
        tokenType: {
            type: String,
            default: "Bearer"
        },
        scope: {
            type: String,
            default: ""
        },
        expiresAt: {
            type: Date,
            default: null
        },
        accountName: {
            type: String,
            default: ""
        },
        accountEmail: {
            type: String,
            default: ""
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("IntegrationSetting", integrationSettingSchema);
