const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const LOGO_PATH = path.join(__dirname, "..", "..", "..", "frontend", "img", "logo.png");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function buildRecipientAddressFields(order = {}) {
    const shippingAddress = order.shippingAddress || {};
    const street = [normalizeText(shippingAddress.street), normalizeText(shippingAddress.number)]
        .filter(Boolean)
        .join(", ");

    return [
        {
            label: "Rua:",
            value: street
        },
        {
            label: "Bairro:",
            value: normalizeText(shippingAddress.neighborhood)
        },
        {
            label: "Cidade:",
            value: normalizeText(shippingAddress.city)
        },
        {
            label: "UF:",
            value: normalizeText(shippingAddress.state).toUpperCase()
        },
        {
            label: "CEP:",
            value: normalizeText(shippingAddress.zipCode)
        },
        {
            label: "Complemento:",
            value: normalizeText(shippingAddress.complement)
        }
    ].filter((field) => field.value);
}

function drawFieldBlock(document, top, label, value, options = {}) {
    const pageWidth = document.page.width;
    const left = 28;
    const width = options.width || (pageWidth - 56);
    const x = options.x || left;
    const blockTop = top;
    const height = options.height || 46;

    document
        .save()
        .roundedRect(x, blockTop, width, height, 10)
        .lineWidth(1)
        .strokeColor("#d9d4cc")
        .stroke()
        .restore();

    document
        .fillColor("#7a7066")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(label, x + 12, blockTop + 8, {
            width: width - 24
        });

    document
        .fillColor("#171717")
        .font("Helvetica")
        .fontSize(11)
        .text(value, x + 12, blockTop + 20, {
            width: width - 24,
            lineGap: 1
        });
}

function drawBottomNote(document, orderNumber) {
    const text = normalizeText(orderNumber)
        ? `Pedido ${normalizeText(orderNumber)}`
        : "Arteno";

    document
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#8b837a")
        .text(text, 28, document.page.height - 42, {
            width: document.page.width - 56,
            align: "center"
        });
}

async function buildMotoboyLabelPdf(order = {}) {
    const recipientName = normalizeText(order.customer?.name) || "Destinatario";
    const addressFields = buildRecipientAddressFields(order);

    if (!addressFields.length) {
        const error = new Error("Este pedido nao possui endereco suficiente para gerar o PDF do motoboy.");
        error.status = 400;
        throw error;
    }

    return new Promise((resolve, reject) => {
        const document = new PDFDocument({
            size: "A5",
            margin: 28
        });
        const chunks = [];

        document.on("data", (chunk) => chunks.push(chunk));
        document.on("end", () => resolve(Buffer.concat(chunks)));
        document.on("error", reject);

        if (fs.existsSync(LOGO_PATH)) {
            document.image(LOGO_PATH, 28, 22, {
                fit: [52, 52],
                align: "left",
                valign: "center"
            });
        }

        document
            .font("Helvetica-Bold")
            .fontSize(24)
            .fillColor("#1f1f1f")
            .text("Arteno", 94, 28, {
                width: 260
            });

        document
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#7f756b")
            .text("Entrega local", 94, 56, {
                width: 260
            });

        document
            .moveTo(28, 94)
            .lineTo(document.page.width - 28, 94)
            .lineWidth(1)
            .strokeColor("#d9d4cc")
            .stroke();

        const contentWidth = document.page.width - 56;
        const halfWidth = Math.floor((contentWidth - 10) / 2);

        document
            .font("Helvetica-Bold")
            .fontSize(8)
            .fillColor("#8a8177")
            .text("DESTINATARIO", 28, 112);

        document
            .font("Helvetica-Bold")
            .fontSize(20)
            .fillColor("#111111")
            .text(recipientName, 28, 126, {
                width: contentWidth
            });

        const recipientHeight = document.heightOfString(recipientName, {
            width: contentWidth,
            align: "left"
        });
        const dividerTop = 126 + recipientHeight + 14;

        document
            .moveTo(28, dividerTop)
            .lineTo(document.page.width - 28, dividerTop)
            .lineWidth(1)
            .strokeColor("#ece7df")
            .stroke();

        let currentTop = dividerTop + 16;
        const cityField = addressFields.find((field) => field.label === "Cidade:");
        const stateField = addressFields.find((field) => field.label === "UF:");
        const zipCodeField = addressFields.find((field) => field.label === "CEP:");
        const renderedLabels = new Set(["Cidade:", "UF:", "CEP:"]);

        addressFields
            .filter((field) => !renderedLabels.has(field.label))
            .forEach((field) => {
                drawFieldBlock(document, currentTop, field.label, field.value);
                currentTop += 56;
            });

        if (cityField) {
            drawFieldBlock(document, currentTop, cityField.label, cityField.value);
            currentTop += 56;
        }

        if (stateField || zipCodeField) {
            if (stateField) {
                drawFieldBlock(document, currentTop, stateField.label, stateField.value, {
                    x: 28,
                    width: halfWidth
                });
            }

            if (zipCodeField) {
                drawFieldBlock(document, currentTop, zipCodeField.label, zipCodeField.value, {
                    x: 28 + halfWidth + 10,
                    width: halfWidth
                });
            }
        }

        drawBottomNote(document, order.orderNumber);

        document.end();
    });
}

module.exports = {
    buildMotoboyLabelPdf
};
