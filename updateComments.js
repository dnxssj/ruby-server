const defaultUserId = "6775ab0586f8e10669004493"; // Reemplaza con un ID válido de tu colección `users`

async function assignDefaultAuthor() {
    try {
        await Comment.updateMany(
            { author: { $exists: false } }, // Busca comentarios sin autor
            { $set: { author: defaultUserId } } // Asigna un autor predeterminado
        );
        console.log("Comentarios actualizados con autor predeterminado.");
    } catch (error) {
        console.error("Error al actualizar comentarios:", error);
    }
}

assignDefaultAuthor();