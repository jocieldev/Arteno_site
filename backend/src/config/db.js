const mongoose = require("mongoose");

const connectToDatabase = async () => {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("A variável MONGODB_URI não foi definida no arquivo .env");
    }

    await mongoose.connect(mongoUri, {
        family: 4
    });

    console.log("MongoDB conectado com sucesso");
};

module.exports = connectToDatabase;
