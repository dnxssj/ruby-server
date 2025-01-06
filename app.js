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
const sanitizeHtml = require("sanitize-html");

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
    backgroundImage: { type: String, default: "images/default-background.jpg" },
    bio: { type: String, default: "" },
    role: { type: String, default: "user" } // "admin", "mod" o "user"
});
const User = mongoose.model("User", userSchema);

const commentSchema = new mongoose.Schema({
    text: String,
    date: { type: Date, default: Date.now },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" } // Referencia al usuario
});
const Comment = mongoose.model("Comment", commentSchema);


// Middleware de autenticación
async function requireAuth(req, res, next) {
    try {
        if (!req.session.userId) {
            return res.redirect("/login");
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect("/login");
        }

        res.locals.user = user; // Hacemos que `user` esté disponible en todas las vistas
        next();
    } catch (error) {
        console.error("Error al obtener el usuario autenticado:", error);
        res.locals.user = null;
        next();
    }
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
    const { name, message } = req.body;

    // Limpiar el mensaje (permitir HTML seguro)
    const cleanMessage = sanitizeHtml(message, {
        allowedTags: [ 'b', 'i', 'u', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li' ],
        allowedAttributes: {
            '*': ['class', 'style'],
            'a': ['href', 'target']
        }
    });

    const newComment = new Comment({
        author: req.session.userId,
        text: cleanMessage
    });

    try {
        await newComment.save();
        res.redirect("/guestbook");
    } catch (error) {
        console.error("Error al guardar el comentario:", error);
        res.status(500).send("Error al guardar el comentario.");
    }
});

app.post("/guestbook/edit/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    try {
        const comment = await Comment.findById(id);

        if (!comment) {
            return res.status(404).send("Comentario no encontrado.");
        }

        const user = await User.findById(req.session.userId);

        // Permitir que el autor y el admin puedan editar
        if (comment.author.toString() !== req.session.userId && user.role !== "admin") {
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

        if (!comment) {
            return res.status(404).send("Comentario no encontrado.");
        }

        const user = res.locals.user; // Usamos res.locals.user aquí

        // Asegúrate de que comment.author esté presente
        if (!comment.author) {
            return res.status(500).send("El comentario no tiene autor.");
        }

        // Verificación de permiso para eliminar
        if (comment.author._id.toString() !== user._id.toString() && !["admin", "mod"].includes(user.role)) {
            return res.status(403).send("No tienes permiso para eliminar este comentario.");
        }

        const result = await comment.deleteOne();  // Eliminar el comentario
        console.log(result);  // Esto debería mostrar el resultado de la eliminación
        res.redirect("/guestbook");  // Redirigir a la página del guestbook después de la eliminación
    } catch (error) {
        console.error("Error al eliminar comentario:", error);
        res.status(500).send("Error al eliminar comentario.");
    }
});



// Dashboard
app.post("/dashboard", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        // Guardar biografía (si existe)
        if (req.body.bio) {
            user.bio = req.body.bio; // Ya se recibe en formato HTML desde el editor
        }

        // Guardar foto de perfil (si existe)
        if (req.body.profilePicture) {
            user.profilePicture = req.body.profilePicture;
        }

        // Guardar imagen de fondo (si existe)
        if (req.body.backgroundImage === 'none') {
            user.backgroundImage = 'none';  // Ningún fondo
        } else if (req.body.backgroundImage) {
            user.backgroundImage = req.body.backgroundImage;  // Fondo seleccionado
        }

        await user.save();

        // Renderizar la misma vista con un mensaje de éxito
        res.render("dashboard", { user, success: true });
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        res.render("dashboard", { user, success: false });
    }
});



//Housekeeping
app.post("/housekeeping/users/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    try {
        const currentUser = await User.findById(req.session.userId);

        if (currentUser.role !== "admin") {
            return res.status(403).send("No tienes permisos para realizar esta acción.");
        }

        await User.findByIdAndUpdate(id, { role });
        res.redirect("/housekeeping/users");
    } catch (error) {
        console.error("Error al actualizar el rol del usuario:", error);
        res.status(500).send("Error al actualizar el rol del usuario.");
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
            .populate("author", "username profilePicture");

        // Sanitizar los mensajes antes de pasarlos a la vista
        messages.forEach(msg => {
            msg.text = sanitizeHtml(msg.text, {
                allowedTags: [ 'b', 'i', 'u', 'a', 'p', 'br' ], // Permitir solo etiquetas HTML seguras
                allowedAttributes: {
                    'a': ['href']
                }
            });
        });

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
app.get("/user/:id", requireAuth, async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send("Usuario no encontrado");
        }

        res.render("profile", {
            title: `Perfil de ${user.username}`,
            username: user.username,
            profilePicture: user.profilePicture,
            bio: user.bio
        });
    } catch (error) {
        console.error("Error al cargar el perfil público:", error);
        res.status(500).send("Error al cargar el perfil público");
    }
});
app.get("/housekeeping", requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.userId);

        if (currentUser.role !== "admin") {
            return res.status(403).send("No tienes permisos para acceder a esta página.");
        }

        const users = await User.find({}, "username role profilePicture");
        res.render('housekeeping', { title: "Housekeeping" });  // Asegúrate de que la vista "housekeeping.ejs" esté presente
    } catch (error) {
        console.error("Error al cargar Housekeeping:", error);
        res.status(500).send("Error al cargar Housekeeping.");
    }
});

app.get("/housekeeping/users", requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.userId);

        if (currentUser.role !== "admin") {
            return res.status(403).send("No tienes permisos para acceder a esta página.");
        }

        const users = await User.find({}, "username role profilePicture"); // Obtén datos clave de los usuarios
        res.render("users-management", { title: "Gestión de Usuarios", users });
    } catch (error) {
        console.error("Error al cargar la gestión de usuarios:", error);
        res.status(500).send("Error al cargar la gestión de usuarios.");
    }
});

app.get("/profile", requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);

    /*
    let backgroundClass = 'background-none'; // Predeterminado a 'ningún fondo'

    if (user.backgroundImage === "/images/background1.jpeg") {
        backgroundClass = 'background-background1jpeg';
    } else if (user.backgroundImage === "/images/background2.jpeg") {
        backgroundClass = 'background-background2jpeg';
    }


    console.log(backgroundClass);  // Verifica el valor de backgroundClass
    res.render("profile", { user, backgroundClass }); */
});






// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
