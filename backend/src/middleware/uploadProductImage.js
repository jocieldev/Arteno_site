const multer = require("multer");

const storage = multer.memoryStorage();

const uploadProductImage = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 8
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Envie apenas arquivos de imagem."));
            return;
        }

        cb(null, true);
    }
});

module.exports = uploadProductImage.fields([
    { name: "images", maxCount: 8 },
    { name: "image", maxCount: 8 },
    { name: "previewImage", maxCount: 1 },
    { name: "overlayOptionImages", maxCount: 8 },
    { name: "variationItemImages", maxCount: 40 },
    { name: "variationItemPreviewImages", maxCount: 40 }
]);
