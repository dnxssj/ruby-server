const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, "public")));

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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

// Ruta para mostrar el guestbook
app.get('/guestbook', (req, res) => {
    const messagesPath = path.join('/tmp', 'messages.json');
    let messages = [];
    if (fs.existsSync(messagesPath)) {
        messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    }
    res.render('guestbook', { messages });
});

// Ruta para agregar un comentario
app.post('/guestbook', (req, res) => {
    const { message, name } = req.body;
    const newMessage = { text: message, name };
    const messagesPath = path.join('/tmp', 'messages.json');
    let messages = [];
    if (fs.existsSync(messagesPath)) {
        messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    }
    messages.push(newMessage);
    fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2));
    res.redirect('/guestbook');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
