const express = require("express");
const {
    getMelhorEnvioStatus,
    startMelhorEnvioConnection,
    handleMelhorEnvioCallback,
    disconnectMelhorEnvioConnection
} = require("../controllers/adminIntegrationController");

const router = express.Router();

router.get("/melhor-envio/status", getMelhorEnvioStatus);
router.get("/melhor-envio/connect", startMelhorEnvioConnection);
router.get("/melhor-envio/callback", handleMelhorEnvioCallback);
router.delete("/melhor-envio/disconnect", disconnectMelhorEnvioConnection);

module.exports = router;
