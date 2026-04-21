const { geocodeMotoboyOrigin } = require("../services/motoboyGeoService");
const {
    getMotoboySettings,
    normalizeMotoboySettingsPayload,
    saveMotoboySettings
} = require("../services/motoboySettingsService");

async function getAdminMotoboySettings(_req, res) {
    try {
        const settings = await getMotoboySettings();
        return res.json(settings);
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Nao foi possivel carregar as configuracoes do motoboy."
        });
    }
}

async function updateAdminMotoboySettings(req, res) {
    try {
        const normalizedPayload = normalizeMotoboySettingsPayload(req.body || {});
        let coordinates = normalizedPayload.coordinates;

        if (normalizedPayload.originLabel) {
            coordinates = await geocodeMotoboyOrigin(normalizedPayload.origin);
        }

        const savedSettings = await saveMotoboySettings({
            ...normalizedPayload,
            coordinates
        });

        return res.json({
            ok: true,
            message: "Configuracoes do motoboy salvas com sucesso.",
            settings: savedSettings
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || "Nao foi possivel salvar as configuracoes do motoboy."
        });
    }
}

module.exports = {
    getAdminMotoboySettings,
    updateAdminMotoboySettings
};
