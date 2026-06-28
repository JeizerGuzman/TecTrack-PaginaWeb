document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const ok = await TrackGuards.requireAuth("dueno");
        if (!ok) return;
    }

    await cargarDatos();

    document.getElementById("formPerfilDueno")?.addEventListener("submit", guardarPerfil);
    document.getElementById("formEmpresaDueno")?.addEventListener("submit", guardarEmpresa);
});

async function cargarDatos() {
    try {
        const data = await TrackAPI.obtenerConfiguracionDueno();

        const usuario = data.usuario || {};
        const empresa = data.empresa || {};

        setValue("perfilNombre", usuario.nombre || "");
        setValue("perfilTelefono", usuario.telefono || "");

        setValue("empresaNombre", empresa.nombre || "");
        setValue("empresaCorreo", empresa.correo || "");
        setValue("empresaTelefono", empresa.telefono || "");
        setValue("empresaDireccion", empresa.direccion || "");

    } catch (error) {
        console.error("Error cargando datos:", error);
        mostrarMensaje("mensajePerfil", error.message || "No se pudieron cargar los datos.", "error");
    }
}

async function guardarPerfil(event) {
    event.preventDefault();

    const btn = document.getElementById("btnGuardarPerfil");

    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
        await TrackAPI.actualizarPerfilDueno({
            nombre: document.getElementById("perfilNombre").value.trim(),
            telefono: document.getElementById("perfilTelefono").value.trim()
        });

        mostrarMensaje("mensajePerfil", "Perfil actualizado correctamente.", "success");

    } catch (error) {
        mostrarMensaje("mensajePerfil", error.message || "No se pudo actualizar el perfil.", "error");

    } finally {
        btn.disabled = false;
        btn.textContent = "Guardar perfil";
    }
}

async function guardarEmpresa(event) {
    event.preventDefault();

    const btn = document.getElementById("btnGuardarEmpresa");

    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
        await TrackAPI.actualizarEmpresaDueno({
            nombre: document.getElementById("empresaNombre").value.trim(),
            correo: document.getElementById("empresaCorreo").value.trim().toLowerCase(),
            telefono: document.getElementById("empresaTelefono").value.trim(),
            direccion: document.getElementById("empresaDireccion").value.trim()
        });

        mostrarMensaje("mensajeEmpresa", "Empresa actualizada correctamente.", "success");

    } catch (error) {
        mostrarMensaje("mensajeEmpresa", error.message || "No se pudo actualizar la empresa.", "error");

    } finally {
        btn.disabled = false;
        btn.textContent = "Guardar empresa";
    }
}

function mostrarMensaje(id, texto, tipo) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent = texto;
    el.className = "form-message";
    if (tipo) el.classList.add(tipo);
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}