function getBrevoConfig() {
    return {
        apiKey: String(process.env.BREVO_API_KEY || "").trim(),
        senderEmail: String(process.env.BREVO_SENDER_EMAIL || "").trim(),
        senderName: String(process.env.BREVO_SENDER_NAME || "Arteno").trim(),
        replyToEmail: String(process.env.BREVO_REPLY_TO_EMAIL || "").trim()
    };
}

function isBrevoConfigured() {
    const config = getBrevoConfig();
    return Boolean(config.apiKey && config.senderEmail);
}

async function sendTransactionalEmail({ toEmail, toName, subject, htmlContent, textContent = "" }) {
    const config = getBrevoConfig();

    if (!config.apiKey || !config.senderEmail) {
        console.log("[emailService] Brevo não configurado. Email simulado:", {
            toEmail,
            subject,
            textContent
        });
        return {
            ok: true,
            simulated: true
        };
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "api-key": config.apiKey
        },
        body: JSON.stringify({
            sender: {
                email: config.senderEmail,
                name: config.senderName
            },
            to: [
                {
                    email: String(toEmail || "").trim(),
                    name: String(toName || "").trim()
                }
            ],
            replyTo: config.replyToEmail ? { email: config.replyToEmail } : undefined,
            subject,
            htmlContent,
            textContent
        })
    });

    const responseText = await response.text();
    let parsedResponse = null;

    try {
        parsedResponse = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
        parsedResponse = null;
    }

    if (!response.ok) {
        const error = new Error(parsedResponse?.message || "Não foi possível enviar o email transacional.");
        error.status = response.status || 502;
        error.details = parsedResponse || responseText;
        throw error;
    }

    return {
        ok: true,
        simulated: false,
        data: parsedResponse || {}
    };
}

async function sendPasswordResetCodeEmail({ toEmail, toName, code }) {
    const safeCode = String(code || "").trim();
    const safeName = String(toName || "cliente").trim();
    const subject = "Código para redefinir sua senha";
    const htmlContent = `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1b1713;">
            <h2 style="margin-bottom:12px;">Redefinicao de senha</h2>
            <p>Oi, ${safeName}.</p>
            <p>Use o código abaixo para criar uma nova senha na sua conta Arteno:</p>
            <div style="margin:20px 0;padding:16px 20px;border-radius:14px;background:#f6efe6;border:1px solid #e7d6c4;font-size:28px;font-weight:700;letter-spacing:0.2em;text-align:center;">
                ${safeCode}
            </div>
            <p>Esse código expira em 15 minutos.</p>
            <p>Se você não pediu a redefinição, pode ignorar este email.</p>
        </div>
    `;
    const textContent = [
        "Redefinicao de senha",
        `Use este código para criar uma nova senha: ${safeCode}`,
        "Esse código expira em 15 minutos.",
        "Se você não pediu a redefinição, ignore este email."
    ].join("\n");

    return sendTransactionalEmail({
        toEmail,
        toName,
        subject,
        htmlContent,
        textContent
    });
}

async function sendPixPaymentInstructionsEmail({ toEmail, toName, orderNumber, amount, qrCode = "", qrCodeBase64 = "", expiresAt = "" }) {
    const safeName = String(toName || "cliente").trim();
    const safeOrderNumber = String(orderNumber || "").trim();
    const safeAmount = Number(amount || 0).toFixed(2).replace(".", ",");
    const safeQrCode = String(qrCode || "").trim();
    const safeExpiresAt = String(expiresAt || "").trim();
    const qrImageMarkup = qrCodeBase64
        ? `<img src="data:image/png;base64,${qrCodeBase64}" alt="QR Code Pix" style="display:block;width:220px;max-width:100%;padding:10px;border-radius:18px;border:1px solid #e7d6c4;background:#ffffff;">`
        : "";
    const subject = `Pix do pedido ${safeOrderNumber}`;
    const htmlContent = `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1b1713;">
            <h2 style="margin-bottom:12px;">Pix gerado com sucesso</h2>
            <p>Oi, ${safeName}.</p>
            <p>Seu pedido <strong>${safeOrderNumber}</strong> foi criado e esta aguardando pagamento.</p>
            <p><strong>Total:</strong> R$ ${safeAmount}</p>
            ${safeExpiresAt ? `<p><strong>Validade:</strong> ${safeExpiresAt}</p>` : ""}
            ${qrImageMarkup}
            <p style="margin-top:20px;">Use a chave Pix abaixo, que ja inclui o valor da compra:</p>
            <div style="margin:16px 0;padding:14px;border-radius:14px;background:#f6efe6;border:1px solid #e7d6c4;word-break:break-all;font-size:13px;">
                ${safeQrCode}
            </div>
        </div>
    `;
    const textContent = [
        "Pix gerado com sucesso",
        `Pedido: ${safeOrderNumber}`,
        `Total: R$ ${safeAmount}`,
        safeExpiresAt ? `Validade: ${safeExpiresAt}` : "",
        "Use a chave Pix abaixo:",
        safeQrCode
    ].filter(Boolean).join("\n");

    return sendTransactionalEmail({
        toEmail,
        toName,
        subject,
        htmlContent,
        textContent
    });
}

async function sendOrderPaymentConfirmedEmail(_payload) {
    return { ok: true, skipped: true };
}

async function sendOrderShippedEmail(_payload) {
    return { ok: true, skipped: true };
}

module.exports = {
    getBrevoConfig,
    isBrevoConfigured,
    sendTransactionalEmail,
    sendPasswordResetCodeEmail,
    sendPixPaymentInstructionsEmail,
    sendOrderPaymentConfirmedEmail,
    sendOrderShippedEmail
};
