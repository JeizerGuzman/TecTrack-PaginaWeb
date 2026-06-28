document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const ok = await TrackGuards.requireAuth("dueno");
        if (!ok) return;
    }

    const page = document.querySelector(".usuario-form-page");
    const usuarioId = Number(page?.dataset.usuarioId || 0);

    const form = document.getElementById("formEditarUsuario");
    const btnGuardar = document.getElementById("btnGuardarCambios");
    const mensaje = document.getElementById("mensajeEditarUsuario");

    if (!usuarioId) {
        setMensaje("No se encontró el usuario.", "error");
        return;
    }

    await cargarUsuario();

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            nombre: document.getElementById("nombre").value.trim(),
            correo: document.getElementById("correo").value.trim().toLowerCase(),
            telefono: document.getElementById("telefono").value.trim(),
            tipo: document.getElementById("tipo").value
        };

        setMensaje("", "");

        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";

        try {
            await TrackAPI.editarUsuario(usuarioId, payload);

            setMensaje("Usuario actualizado correctamente. Redirigiendo...", "success");

            setTimeout(() => {
                window.location.href = "/dueno/usuarios";
            }, 700);

        } catch (error) {
            console.error("Error editando usuario:", error);
            setMensaje(error.message || "No se pudo actualizar el usuario.", "error");
        } finally {
            btnGuardar.disabled = false;
            btnGuardar.textContent = "Guardar cambios";
        }
    });

    async function cargarUsuario() {
        try {
            const response = await TrackAPI.obtenerUsuario(usuarioId);
            const usuario = response.usuario;

            document.getElementById("nombre").value = usuario.nombre || "";
            document.getElementById("correo").value = usuario.correo || "";
            document.getElementById("telefono").value = usuario.telefono || "";
            document.getElementById("tipo").value = usuario.tipo || "chofer";

        } catch (error) {
            console.error("Error cargando usuario:", error);
            setMensaje(error.message || "No se pudo cargar el usuario.", "error");
        }
    }

    function setMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = "form-message";
        if (tipo) mensaje.classList.add(tipo);
    }
});