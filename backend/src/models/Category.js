const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        imageUrl: {
            type: String,
            default: ""
        },
        imagePublicId: {
            type: String,
            default: ""
        },
        products: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product"
            }
        ]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Category", categorySchema);
