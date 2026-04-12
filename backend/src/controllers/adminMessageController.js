const ContactMessage = require("../models/ContactMessage");

function serializeMessage(message) {
    return {
        id: String(message._id),
        name: message.name || "",
        email: message.email || "",
        message: message.message || "",
        status: message.status === "read" ? "read" : "new",
        readAt: message.readAt || null,
        createdAt: message.createdAt || null
    };
}

async function listAdminMessages(_req, res) {
    try {
        const messages = await ContactMessage.find().sort({ createdAt: -1 });

        return res.json(messages.map((message) => serializeMessage(message)));
    } catch (_error) {
        return res.status(500).json({
            message: "Não foi possível carregar as mensagens."
        });
    }
}

async function getAdminMessageUnreadCount(_req, res) {
    try {
        const unreadCount = await ContactMessage.countDocuments({
            $or: [
                { status: "new" },
                { status: { $exists: false } },
                { status: null }
            ]
        });

        return res.json({
            ok: true,
            unreadCount
        });
    } catch (_error) {
        return res.status(500).json({
            message: "Não foi possível carregar a contagem de mensagens."
        });
    }
}

async function updateAdminMessageStatus(req, res) {
    try {
        const nextStatus = String(req.body.status || "").trim().toLowerCase();

        if (nextStatus !== "new" && nextStatus !== "read") {
            return res.status(400).json({
                message: "Status de mensagem inválido."
            });
        }

        const updatedMessage = await ContactMessage.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    status: nextStatus,
                    readAt: nextStatus === "read" ? new Date() : null
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedMessage) {
            return res.status(404).json({
                message: "Mensagem não encontrada."
            });
        }

        return res.json({
            ok: true,
            message: nextStatus === "read"
                ? "Mensagem marcada como lida."
                : "Mensagem marcada como nova.",
            item: serializeMessage(updatedMessage)
        });
    } catch (_error) {
        return res.status(400).json({
            message: "Não foi possível atualizar o status da mensagem."
        });
    }
}

async function deleteAdminMessage(req, res) {
    try {
        const deletedMessage = await ContactMessage.findByIdAndDelete(req.params.id);

        if (!deletedMessage) {
            return res.status(404).json({
                message: "Mensagem não encontrada."
            });
        }

        return res.json({
            ok: true,
            message: "Mensagem excluída com sucesso."
        });
    } catch (_error) {
        return res.status(400).json({
            message: "Não foi possível excluir a mensagem."
        });
    }
}

module.exports = {
    listAdminMessages,
    getAdminMessageUnreadCount,
    updateAdminMessageStatus,
    deleteAdminMessage
};
