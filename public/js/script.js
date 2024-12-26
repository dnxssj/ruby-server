// script.js
// Deshabilitar clic derecho
document.addEventListener("contextmenu", function(event) {
    event.preventDefault();
}, false);

// Deshabilitar las teclas F12, Ctrl+Shift+I (inspección)
document.addEventListener("keydown", function(event) {
    if (event.keyCode === 123 || (event.ctrlKey && event.shiftKey && (event.keyCode === 73 || event.keyCode === 67))) {
        event.preventDefault();
    }
}, false);
