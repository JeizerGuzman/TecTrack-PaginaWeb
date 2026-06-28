document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const ok = await TrackGuards.requireAuth("dueno");
        if (!ok) return;
    }

    const form = document.getElementById("formNuevoUsuario");
    const btnGuardar = document.getElementById("btnGuardarUsuario");
    const mensaje = document.getElementById("mensajeUsuarioNuevo");
    const passwordInput = document.getElementById("password");
    const btnTogglePassword = document.getElementById("btnTogglePassword");

    let ultimasCredenciales = null;

    btnTogglePassword?.addEventListener("click", () => {
        const visible = passwordInput.type === "text";
        passwordInput.type = visible ? "password" : "text";
        btnTogglePassword.textContent = visible ? "Ver" : "Ocultar";
    });

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            nombre: document.getElementById("nombre").value.trim(),
            correo: document.getElementById("correo").value.trim().toLowerCase(),
            tipo: document.getElementById("tipo").value,
            password: passwordInput.value.trim()
        };

        setMensaje("", "");

        if (payload.password.length < 6) {
            setMensaje("La contraseña debe tener al menos 6 caracteres.", "error");
            return;
        }

        btnGuardar.disabled = true;
        btnGuardar.textContent = "Creando...";

        try {
            await TrackAPI.crearUsuario(payload);

            ultimasCredenciales = {
                correo: payload.correo,
                password: payload.password
            };

            mostrarModalCredenciales(ultimasCredenciales);

        } catch (error) {
            console.error("Error creando usuario:", error);
            setMensaje(error.message || "No se pudo crear el usuario.", "error");

        } finally {
            btnGuardar.disabled = false;
            btnGuardar.textContent = "Crear usuario";
        }
    });

    document.getElementById("btnCopiarCredenciales")?.addEventListener("click", async () => {
        if (!ultimasCredenciales) return;

        const texto = `Correo: ${ultimasCredenciales.correo}\nContraseña temporal: ${ultimasCredenciales.password}`;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(texto);
            } else {
                copiarTextoFallback(texto);
            }

            setMensaje("Credenciales copiadas al portapapeles.", "success");
        } catch (error) {
            console.error("Error copiando credenciales:", error);
            copiarTextoFallback(texto);
            setMensaje("Credenciales copiadas al portapapeles.", "success");
        }
    });

    document.getElementById("btnCerrarCredenciales")?.addEventListener("click", () => {
        window.location.href = "/dueno/usuarios";
    });

    function mostrarModalCredenciales(data) {
        document.getElementById("credencialCorreo").textContent = data.correo;
        document.getElementById("credencialPassword").textContent = data.password;
        document.getElementById("modalCredenciales").classList.add("visible");
    }

    function setMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = "form-message";
        if (tipo) mensaje.classList.add(tipo);
    }
});

function copiarTextoFallback(texto) {
    const textarea = document.createElement("textarea");
    textarea.value = texto;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    document.execCommand("copy");
    document.body.removeChild(textarea);
}