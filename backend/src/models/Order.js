const mongoose = require("mongoose");

const orderStatusHistorySchema = new mongoose.Schema(
    {
        status: {
            type: String,
            default: "payment_confirmed",
            trim: true
        },
        label: {
            type: String,
            default: "Pagamento confirmado",
            trim: true
        },
        note: {
            type: String,
            default: "",
            trim: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    { _id: false }
);

const orderItemSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            default: "",
            trim: true
        },
        selectedVariations: {
            type: [
                new mongoose.Schema(
                    {
                        variationId: {
                            type: String,
                            default: "",
                            trim: true
                        },
                        variationType: {
                            type: String,
                            default: "",
                            trim: true
                        },
                        variationName: {
                            type: String,
                            default: "",
                            trim: true
                        },
                        itemId: {
                            type: String,
                            default: "",
                            trim: true
                        },
                        itemLabel: {
                            type: String,
                            default: "",
                            trim: true
                        },
                        colorHex: {
                            type: String,
                            default: "",
                            trim: true
                        },
                        price: {
                            type: Number,
                            default: null
                        },
                        imageUrl: {
                            type: String,
                            default: ""
                        },
                        previewImageUrl: {
                            type: String,
                            default: ""
                        }
                    },
                    { _id: false }
                )
            ],
            default: []
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        personalizationName: {
            type: String,
            default: "",
            trim: true
        },
        personalizationImageUrl: {
            type: String,
            default: ""
        },
        personalizationImagePublicId: {
            type: String,
            default: "",
            trim: true
        },
        personalizationImageKind: {
            type: String,
            default: "",
            trim: true
        },
        personalizationPreviewImageUrl: {
            type: String,
            default: ""
        },
        personalizationPreviewTextBaseXPercent: {
            type: Number,
            default: 50
        },
        personalizationPreviewTextBaseYPercent: {
            type: Number,
            default: 50
        },
        personalizationPreviewTextWidthPercent: {
            type: Number,
            default: 60
        },
        personalizationPreviewTextFontSizePx: {
            type: Number,
            default: 28
        },
        personalizationPreviewReferenceWidthPx: {
            type: Number,
            default: 0
        },
        personalizationPreviewTextColor: {
            type: String,
            default: "#ffffff"
        },
        personalizationPreviewTextFontFamily: {
            type: String,
            default: "'Georgia', 'Times New Roman', serif"
        },
        personalizationPreviewTextFontWeight: {
            type: String,
            default: "700"
        },
        personalizationPreviewTextTransform: {
            type: String,
            default: "uppercase"
        },
        personalizationPreviewLetterSpacingEm: {
            type: Number,
            default: 0.04
        },
        personalizationPreviewTextShadow: {
            type: String,
            default: "0 2px 10px rgba(0, 0, 0, 0.35)"
        },
        personalizationPreviewTextRotationDeg: {
            type: Number,
            default: 0
        },
        personalizationImageBaseXPercent: {
            type: Number,
            default: 50
        },
        personalizationImageBaseYPercent: {
            type: Number,
            default: 50
        },
        personalizationImageBaseMaxWidthPercent: {
            type: Number,
            default: 34
        },
        personalizationImageBaseMaxHeightPercent: {
            type: Number,
            default: 34
        },
        personalizationImageBaseRotationDeg: {
            type: Number,
            default: 0
        },
        personalizationImageIsRound: {
            type: Boolean,
            default: false
        },
        personalizationTextOffsetXPercent: {
            type: Number,
            default: 0
        },
        personalizationTextOffsetYPercent: {
            type: Number,
            default: 0
        },
        personalizationTextScalePercent: {
            type: Number,
            default: 100
        },
        personalizationImageOffsetXPercent: {
            type: Number,
            default: 0
        },
        personalizationImageOffsetYPercent: {
            type: Number,
            default: 0
        },
        personalizationImageScalePercent: {
            type: Number,
            default: 100
        },
        imageUrl: {
            type: String,
            default: ""
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        customer: {
            name: {
                type: String,
                required: true,
                trim: true
            },
            email: {
                type: String,
                required: true,
                trim: true,
                lowercase: true
            },
            phone: {
                type: String,
                default: "",
                trim: true
            }
        },
        shippingAddress: {
            zipCode: {
                type: String,
                default: "",
                trim: true
            },
            street: {
                type: String,
                default: "",
                trim: true
            },
            number: {
                type: String,
                default: "",
                trim: true
            },
            neighborhood: {
                type: String,
                default: "",
                trim: true
            },
            city: {
                type: String,
                default: "",
                trim: true
            },
            state: {
                type: String,
                default: "",
                trim: true
            },
            complement: {
                type: String,
                default: "",
                trim: true
            }
        },
        items: {
            type: [orderItemSchema],
            default: []
        },
        coupon: {
            couponId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Coupon",
                default: null
            },
            code: {
                type: String,
                default: "",
                trim: true
            },
            name: {
                type: String,
                default: "",
                trim: true
            },
            percentageOff: {
                type: Number,
                default: 0,
                min: 0
            },
            discountAmount: {
                type: Number,
                default: 0,
                min: 0
            },
            appliedAt: {
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
            }
        },
        totals: {
            subtotal: {
                type: Number,
                default: 0,
                min: 0
            },
            discount: {
                type: Number,
                default: 0,
                min: 0
            },
            shipping: {
                type: Number,
                default: 0,
                min: 0
            },
            total: {
                type: Number,
                default: 0,
                min: 0
            }
        },
        payment: {
            provider: {
                type: String,
                default: "mercado_pago",
                trim: true
            },
            mode: {
                type: String,
                default: "development",
                trim: true
            },
            method: {
                type: String,
                enum: ["pix", "card", "boleto"],
                required: true
            },
            status: {
                type: String,
                default: "pending",
                trim: true
            },
            details: {
                type: mongoose.Schema.Types.Mixed,
                default: {}
            }
        },
        orderStatus: {
            type: String,
            default: "payment_confirmed",
            trim: true
        },
        tracking: {
            code: {
                type: String,
                default: "",
                trim: true
            },
            carrier: {
                type: String,
                default: "Correios",
                trim: true
            },
            shippedAt: {
                type: Date,
                default: null
            },
            deliveredAt: {
                type: Date,
                default: null
            },
            lastEvent: {
                type: String,
                default: "",
                trim: true
            }
        },
        shippingIntegration: {
            provider: {
                type: String,
                default: "",
                trim: true
            },
            serviceId: {
                type: String,
                default: "",
                trim: true
            },
            serviceName: {
                type: String,
                default: "",
                trim: true
            },
            companyName: {
                type: String,
                default: "",
                trim: true
            },
            quotePrice: {
                type: Number,
                default: 0
            },
            deliveryTime: {
                type: Number,
                default: 0
            },
            melhorEnvioCartId: {
                type: String,
                default: "",
                trim: true
            },
            melhorEnvioOrderId: {
                type: String,
                default: "",
                trim: true
            },
            melhorEnvioProtocol: {
                type: String,
                default: "",
                trim: true
            },
            status: {
                type: String,
                default: "",
                trim: true
            },
            purchasedAt: {
                type: Date,
                default: null
            },
            labelGeneratedAt: {
                type: Date,
                default: null
            },
            payload: {
                type: mongoose.Schema.Types.Mixed,
                default: {}
            }
        },
        statusHistory: {
            type: [orderStatusHistorySchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Order", orderSchema);
