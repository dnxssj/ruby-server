const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();

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
    const commentsPath = path.join(__dirname, 'comments.json');
    let comments = [];
    if (fs.existsSync(commentsPath)) {
        comments = JSON.parse(fs.readFileSync(commentsPath, 'utf8'));
    }
    res.render('guestbook', { comments });
});

// Ruta para agregar un comentario
app.post('/guestbook', (req, res) => {
    const { comment, name } = req.body;
    const newComment = { text: comment, name };
    const commentsPath = path.join(__dirname, 'comments.json');
    let comments = [];
    if (fs.existsSync(commentsPath)) {
        comments = JSON.parse(fs.readFileSync(commentsPath, 'utf8'));
    }
    comments.push(newComment);
    fs.writeFileSync(commentsPath, JSON.stringify(comments, null, 2));
    res.redirect('/guestbook');
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
