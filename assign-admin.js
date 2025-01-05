const mongoose = require("mongoose");
require("dotenv").config();

// Conexión a MongoDB
const uri = process.env.MONGO_URI;
mongoose.connect(uri)
    .then(() => console.log("Conexión exitosa a MongoDB"))
    .catch(err => console.error("Error al conectar a MongoDB:", err));

// Esquema de Usuario
const userSchema = new mongoose.Schema({
    username: String,
    role: String
});
const User = mongoose.model("User", userSchema);

// Asignar rol de admin
const assignAdmin = async (username) => {
    try {
        const user = await User.findOneAndUpdate(
            { username }, // Condición: usuario con este username
            { role: "admin" }, // Actualización: asignar rol admin
            { new: true } // Devolver el documento actualizado
        );

        if (!user) {
            console.log(`Usuario "${username}" no encontrado.`);
        } else {
            console.log(`Usuario "${username}" ahora es admin.`);
        }
        process.exit(0); // Finalizar proceso
    } catch (error) {
        console.error("Error al asignar rol:", error);
        process.exit(1);
    }
};

// Llama a la función con tu username
assignAdmin("Ryoma");
