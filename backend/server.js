const dns = require("node:dns");
const path = require("path");

// Força servidores DNS confiáveis
if (process.env.NODE_ENV !== "production") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = require("./src/app");
const connectToDatabase = require("./src/config/db");

const port = process.env.PORT || 3000;

async function startServer() {
    app.listen(port, async () => {
        console.log(`Servidor rodando em http://localhost:${port}`);

        try {
            await connectToDatabase();
        } catch (error) {
            console.error("Banco indisponível no momento. O site local continuará funcionando sem MongoDB.");
            console.error(`Detalhe da conexão: ${error.message}`);
        }
    });
}

startServer();
