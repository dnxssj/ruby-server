const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");

const app = express();

// Variables de entorno
const uri = process.env.MONGO_URI;
const sessionSecret = process.env.SESSION_SECRET;

// Configuración de almacenamiento para imágenes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads"); // Carpeta donde se guardarán las imágenes
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Conexión a MongoDB
mongoose.connect(uri)
    .then(() => console.log("Conexión exitosa a MongoDB"))
    .catch(err => console.error("Error al conectar a MongoDB:", err));

// Configuración de sesión
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: uri }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 día
}));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(async (req, res, next) => {
    try {
        if (req.session.userId) {
            const user = await User.findById(req.session.userId);
            res.locals.user = user; // Hacemos que `user` esté disponible en todas las vistas
        } else {
            res.locals.user = null;
        }
        next();
    } catch (error) {
        console.error("Error al obtener el usuario autenticado:", error);
        res.locals.user = null;
        next();
    }
});

// Configuración de vistas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Modelos
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: "/images/default-profile.png" },
    bio: { type: String, default: "" }
});
const User = mongoose.model("User", userSchema);

const commentSchema = new mongoose.Schema({
    text: String,
    date: { type: Date, default: Date.now },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" } // Referencia al usuario
});
const Comment = mongoose.model("Comment", commentSchema);


// Middleware de autenticación
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }
    next();
}

// Rutas de autenticación
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            password: hashedPassword,
            profilePicture: "/images/default-profile.png",
            bio: ""
        });
        await newUser.save();
        res.redirect("/login");
    } catch (error) {
        console.error("Error al registrar usuario:", error);
        res.status(500).send("Error al registrar usuario.");
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id;
            res.redirect("/dashboard");
        } else {
            res.status(401).send("Credenciales inválidas.");
        }
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        res.status(500).send("Error al iniciar sesión.");
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Error al cerrar sesión:", err);
            return res.status(500).send("Error al cerrar sesión.");
        }
        res.redirect("/login");
    });
});

// Rutas del Guestbook
app.get("/guestbook", requireAuth, async (req, res) => {
    try {
        const messages = await Comment.find()
            .sort({ date: -1 })
            .populate("author", "username profilePicture");
        res.render("guestbook", { messages });
    } catch (error) {
        console.error("Error al cargar comentarios:", error);
        res.status(500).send("Error al cargar comentarios.");
    }
});

app.post("/guestbook", requireAuth, async (req, res) => {
    const { message } = req.body;
    try {
        const newComment = new Comment({
            text: message,
            author: req.session.userId
        });
        await newComment.save();
        res.redirect("/guestbook");
    } catch (error) {
        console.error("Error al guardar comentario:", error);
        res.status(500).send("Error al guardar el comentario.");
    }
});

app.post("/guestbook/edit/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    try {
        const comment = await Comment.findById(id);
        if (comment.author.toString() !== req.session.userId) {
            return res.status(403).send("No tienes permiso para editar este comentario.");
        }
        comment.text = message;
        await comment.save();
        res.redirect("/guestbook");
    } catch (error) {
        console.error("Error al editar comentario:", error);
        res.status(500).send("Error al editar comentario.");
    }
});

const defaultUserId = "6775ab0586f8e10669004493"; // Reemplaza con un ID válido
async function assignDefaultAuthor() {
    try {
        await Comment.updateMany(
            { author: { $exists: false } },
            { $set: { author: defaultUserId } }
        );
        console.log("Comentarios actualizados con autor predeterminado.");
    } catch (error) {
        console.error("Error al actualizar comentarios:", error);
    }
}
assignDefaultAuthor();

app.post("/guestbook/delete/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const comment = await Comment.findById(id);
        if (comment.author.toString() !== req.session.userId) {
            return res.status(403).send("No tienes permiso para eliminar este comentario.");
        }
        await comment.remove();
        res.redirect("/guestbook");
    } catch (error) {
        console.error("Error al eliminar comentario:", error);
        res.status(500).send("Error al eliminar comentario.");
    }
});

// Dashboard
app.post("/dashboard", requireAuth, async (req, res) => {
    const { bio, profilePicture } = req.body;
    try {
        // Actualiza solo el documento del usuario
        const updates = { bio };
        if (profilePicture) {
            updates.profilePicture = profilePicture;
        }
        await User.findByIdAndUpdate(req.session.userId, updates);

        res.redirect("/dashboard?success=true");
    } catch (error) {
        console.error("Error al actualizar el perfil:", error);
        res.status(500).send("Error al actualizar el perfil.");
    }
});




// Rutas estáticas
app.get("/", (req, res) => res.render("index", { title: "Inicio" }));
app.get("/jugadores", (req, res) => res.render("jugadores", { title: "Top Jugadores" }));
app.get("/clanes", (req, res) => res.render("clanes", { title: "Top Clanes" }));
app.get("/actual", (req, res) => res.render("actual", { title: "Top Actual" }));
app.get("/hemeroteca", (req, res) => res.render("hemeroteca", { title: "Hemeroteca" }));
app.get("/register", (req, res) => res.render("register", { title: "Registro" }));
app.get("/login", (req, res) => res.render("login", { title: "Login" }));
app.get("/guestbook", requireAuth, async (req, res) => {
    try {
        const messages = await Comment.find()
            .sort({ date: -1 })
            .populate("author", "username profilePicture"); // Incluye los campos necesarios
        res.render("guestbook", { messages });
    } catch (error) {
        console.error("Error al cargar comentarios:", error);
        res.status(500).send("Error al cargar comentarios.");
    }
});
app.get("/dashboard", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.render("dashboard", { user, success: false }); // success inicialmente es false
    } catch (error) {
        console.error("Error al cargar el dashboard:", error);
        res.status(500).send("Error al cargar el dashboard.");
    }
});


// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
