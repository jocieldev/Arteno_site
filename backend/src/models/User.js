const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        phone: {
            type: String,
            default: "",
            trim: true
        },
        passwordHash: {
            type: String,
            required: true
        },
        passwordSalt: {
            type: String,
            required: true
        },
        sessionTokenHash: {
            type: String,
            default: ""
        },
        passwordResetCodeHash: {
            type: String,
            default: ""
        },
        passwordResetExpiresAt: {
            type: Date,
            default: null
        },
        passwordResetRequestedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
