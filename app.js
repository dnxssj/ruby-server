const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require('uuid');
const mongoose = require("mongoose");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, "public")));

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Reemplaza con tu cadena de conexión desde MongoDB Atlas
const uri = "mongodb+srv://elconserjehk:UNKC34CfqDi6Ims@messagingruby.w254p.mongodb.net/";

// Conectar a MongoDB
mongoose.connect(uri)
    .then(() => console.log("Conexión exitosa a MongoDB"))
    .catch(err => console.error("Error al conectar a MongoDB:", err));

// Define el esquema y modelo para comentarios
const commentSchema = new mongoose.Schema({
    name: String,
    text: String,
    date: { type: Date, default: Date.now }
});

const Comment = mongoose.model("Comment", commentSchema);

// Ruta para mostrar el guestbook
app.get('/guestbook', async (req, res) => {
    try {
        if (!req.cookies.userId) {
            res.cookie('userId', uuidv4(), { httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 año
        }
        const messages = await Comment.find().sort({ date: -1 });
        res.render('guestbook', { messages, cookies: req.cookies });
    } catch (error) {
        console.error("Error al cargar comentarios:", error);
        res.status(500).send("Error al cargar comentarios.");
    }
});


// Ruta para agregar un comentario
app.post('/guestbook', async (req, res) => {
    const { message, name } = req.body;
    try {
        const newComment = new Comment({ name, text: message });
        await newComment.save();
        res.redirect('/guestbook');
    } catch (error) {
        console.error("Error al guardar comentario:", error);
        res.status(500).send("Error al guardar el comentario.");
    }
});

// Ruta para editar un comentario (placeholder para futuros cambios con autenticación)
app.post("/guestbook/edit/:id", async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    try {
        await Comment.findByIdAndUpdate(id, { text: message });
        res.redirect("/guestbook");
    } catch (error) {
        console.error("Error al editar comentario:", error);
        res.status(500).send("Error al editar comentario.");
    }
});

// Ruta para eliminar un comentario (placeholder para futuros cambios con autenticación)
app.post("/guestbook/delete/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await Comment.findByIdAndDelete(id);
        res.redirect("/guestbook");
    } catch (error) {
        console.error("Error al eliminar comentario:", error);
        res.status(500).send("Error al eliminar comentario.");
    }
});

// Middleware for serving static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
    res.render("index", { title: "Inicio" });
});

app.get("/jugadores", (req, res) => {
    res.render("jugadores", { title: "Top Jugadores" });
});

app.get("/clanes", (req, res) => {
    res.render("clanes", { title: "Top Clanes" });
});

app.get("/actual", (req, res) => {
    res.render("actual", { title: "Top Actual" });
});

app.get("/hemeroteca", (req, res) => {
    res.render("hemeroteca", { title: "Hemeroteca" });
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
