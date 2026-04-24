const dns = require("node:dns");
const path = require("path");

// Força servidores DNS confiáveis
if (process.env.NODE_ENV !== "production") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = require("./src/app");
const connectToDatabase = require("./src/config/db");
const { cleanupExpiredPendingOrders } = require("./src/services/orderPaymentCleanupService");

const port = process.env.PORT || 3000;
const EXPIRED_ORDER_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

function startExpiredOrderCleanupLoop() {
    cleanupExpiredPendingOrders().catch((error) => {
        console.error("Falha ao limpar pedidos com pagamento expirado:", error.message);
    });

    setInterval(() => {
        cleanupExpiredPendingOrders().catch((error) => {
            console.error("Falha ao limpar pedidos com pagamento expirado:", error.message);
        });
    }, EXPIRED_ORDER_CLEANUP_INTERVAL_MS);
}

async function startServer() {
    app.listen(port, async () => {
        console.log(`Servidor rodando em http://localhost:${port}`);

        try {
            await connectToDatabase();
            startExpiredOrderCleanupLoop();
        } catch (error) {
            console.error("Banco indisponível no momento. O site local continuará funcionando sem MongoDB.");
            console.error(`Detalhe da conexão: ${error.message}`);
        }
    });
}

startServer();
