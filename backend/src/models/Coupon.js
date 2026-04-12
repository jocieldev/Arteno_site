const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: "",
            trim: true
        },
        percentageOff: {
            type: Number,
            required: true,
            min: 1,
            max: 100
        },
        isActive: {
            type: Boolean,
            default: true
        },
        startsAt: {
            type: Date,
            default: null
        },
        endsAt: {
            type: Date,
            default: null
        },
        rules: {
            minSubtotal: {
                type: Number,
                default: 0,
                min: 0
            },
            maxUsesTotal: {
                type: Number,
                default: 0,
                min: 0
            }
        },
        usageCount: {
            type: Number,
            default: 0,
            min: 0
        },
        lastUsedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Coupon", couponSchema);
