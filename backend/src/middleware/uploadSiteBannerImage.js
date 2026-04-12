const multer = require("multer");

const storage = multer.memoryStorage();

module.exports = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 2
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Envie apenas arquivos de imagem."));
            return;
        }

        cb(null, true);
    }
}).fields([
    { name: "desktopImage", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 }
]);
