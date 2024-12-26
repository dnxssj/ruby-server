const express = require("express");
const path = require("path");
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
