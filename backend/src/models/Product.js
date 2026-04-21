const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
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
        description: {
            type: String,
            default: ""
        },
        category: {
            type: String,
            required: true,
            trim: true
        },
        categorySlug: {
            type: String,
            default: "",
            trim: true
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null
        },
        imageUrl: {
            type: String,
            default: ""
        },
        imagePublicId: {
            type: String,
            default: ""
        },
        images: [
            {
                imageUrl: {
                    type: String,
                    default: ""
                },
                imagePublicId: {
                    type: String,
                    default: ""
                }
            }
        ],
        price: {
            type: Number,
            required: true,
            min: 0
        },
        compareAtPrice: {
            type: Number,
            default: null,
            min: 0
        },
        variations: [
            {
                id: {
                    type: String,
                    required: true,
                    trim: true
                },
                type: {
                    type: String,
                    enum: ["color", "custom"],
                    required: true,
                    trim: true
                },
                name: {
                    type: String,
                    required: true,
                    trim: true
                },
                items: [
                    {
                        id: {
                            type: String,
                            required: true,
                            trim: true
                        },
                        label: {
                            type: String,
                            required: true,
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
                        imagePublicId: {
                            type: String,
                            default: ""
                        },
                        previewImageUrl: {
                            type: String,
                            default: ""
                        },
                        previewImagePublicId: {
                            type: String,
                            default: ""
                        }
                    }
                ]
            }
        ],
        installments: {
            quantity: {
                type: Number,
                default: 1
            },
            value: {
                type: Number,
                default: 0
            }
        },
        personalization: {
            enabled: {
                type: Boolean,
                default: false
            },
            requireName: {
                type: Boolean,
                default: false
            },
            imageOverlay: {
                enabled: {
                    type: Boolean,
                    default: false
                },
                allowOptionImages: {
                    type: Boolean,
                    default: false
                },
                requireSelection: {
                    type: Boolean,
                    default: false
                },
                allowCustomerUpload: {
                    type: Boolean,
                    default: false
                },
                optionImages: [
                    {
                        imageUrl: {
                            type: String,
                            default: ""
                        },
                        imagePublicId: {
                            type: String,
                            default: ""
                        }
                    }
                ],
                positionXPercent: {
                    type: Number,
                    default: 50,
                    min: 0,
                    max: 100
                },
                positionYPercent: {
                    type: Number,
                    default: 50,
                    min: 0,
                    max: 100
                },
                maxWidthPercent: {
                    type: Number,
                    default: 34,
                    min: 5,
                    max: 100
                },
                maxHeightPercent: {
                    type: Number,
                    default: 34,
                    min: 5,
                    max: 100
                },
                isRound: {
                    type: Boolean,
                    default: false
                },
                allowCustomerAdjust: {
                    type: Boolean,
                    default: false
                },
                rotationDeg: {
                    type: Number,
                    default: 0,
                    min: -180,
                    max: 180
                }
            },
            preview: {
                enabled: {
                    type: Boolean,
                    default: false
                },
                imageUrl: {
                    type: String,
                    default: ""
                },
                imagePublicId: {
                    type: String,
                    default: ""
                },
                positionXPercent: {
                    type: Number,
                    default: 50,
                    min: 0,
                    max: 100
                },
                positionYPercent: {
                    type: Number,
                    default: 50,
                    min: 0,
                    max: 100
                },
                widthPercent: {
                    type: Number,
                    default: 60,
                    min: 10,
                    max: 100
                },
                allowCustomerAdjust: {
                    type: Boolean,
                    default: false
                },
                fontSizePx: {
                    type: Number,
                    default: 28,
                    min: 8,
                    max: 120
                },
                referenceWidthPx: {
                    type: Number,
                    default: 0,
                    min: 0
                },
                sampleText: {
                    type: String,
                    default: "Maria",
                    trim: true
                },
                textColor: {
                    type: String,
                    default: "#ffffff",
                    trim: true
                },
                fontFamily: {
                    type: String,
                    default: "'Georgia', 'Times New Roman', serif",
                    trim: true
                },
                fontWeight: {
                    type: String,
                    default: "700",
                    trim: true
                },
                letterSpacingEm: {
                    type: Number,
                    default: 0.04,
                    min: -0.2,
                    max: 1
                },
                rotationDeg: {
                    type: Number,
                    default: 0,
                    min: -180,
                    max: 180
                },
                textTransform: {
                    type: String,
                    enum: ["none", "uppercase"],
                    default: "uppercase"
                },
                textShadow: {
                    type: String,
                    default: "0 2px 10px rgba(0, 0, 0, 0.35)",
                    trim: true
                }
            },
            previews: [
                {
                    name: {
                        type: String,
                        default: "Prévia",
                        trim: true
                    },
                    enabled: {
                        type: Boolean,
                        default: false
                    },
                    imageUrl: {
                        type: String,
                        default: ""
                    },
                    imagePublicId: {
                        type: String,
                        default: ""
                    },
                    positionXPercent: {
                        type: Number,
                        default: 50,
                        min: 0,
                        max: 100
                    },
                    positionYPercent: {
                        type: Number,
                        default: 50,
                        min: 0,
                        max: 100
                    },
                    widthPercent: {
                        type: Number,
                        default: 60,
                        min: 10,
                        max: 100
                    },
                    allowCustomerAdjust: {
                        type: Boolean,
                        default: false
                    },
                    fontSizePx: {
                        type: Number,
                        default: 28,
                        min: 8,
                        max: 120
                    },
                    referenceWidthPx: {
                        type: Number,
                        default: 0,
                        min: 0
                    },
                    sampleText: {
                        type: String,
                        default: "Maria",
                        trim: true
                    },
                    textColor: {
                        type: String,
                        default: "#ffffff",
                        trim: true
                    },
                    fontFamily: {
                        type: String,
                        default: "'Georgia', 'Times New Roman', serif",
                        trim: true
                    },
                    fontWeight: {
                        type: String,
                        default: "700",
                        trim: true
                    },
                    letterSpacingEm: {
                        type: Number,
                        default: 0.04,
                        min: -0.2,
                        max: 1
                    },
                    rotationDeg: {
                        type: Number,
                        default: 0,
                        min: -180,
                        max: 180
                    },
                    textTransform: {
                        type: String,
                        enum: ["none", "uppercase"],
                        default: "uppercase"
                    },
                    textShadow: {
                        type: String,
                        default: "0 2px 10px rgba(0, 0, 0, 0.35)",
                        trim: true
                    }
                }
            ]
        },
        shipping: {
            allowMotoboy: {
                type: Boolean,
                default: true
            },
            productionDays: {
                type: Number,
                default: 0,
                min: 0
            },
            weightKg: {
                type: Number,
                default: 0,
                min: 0
            },
            lengthCm: {
                type: Number,
                default: 0,
                min: 0
            },
            widthCm: {
                type: Number,
                default: 0,
                min: 0
            },
            heightCm: {
                type: Number,
                default: 0,
                min: 0
            }
        },
        stock: {
            mode: {
                type: String,
                enum: ["limited", "unlimited"],
                default: "unlimited"
            },
            quantity: {
                type: Number,
                default: null,
                min: 0
            }
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        showInMoreOptions: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ["active", "draft", "unlisted"],
            default: "active"
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Product", productSchema);
