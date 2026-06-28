document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const ok = await TrackGuards.requireAuth("dueno");
        if (!ok) return;
    }

    await cargarConfiguracion();
    configurarModalPassword();
    configurarPasswordToggles();
});

async function cargarConfiguracion() {
    try {
        const data = await TrackAPI.obtenerConfiguracionDueno();

        const usuario = data.usuario || {};
        const empresa = data.empresa || {};
        const suscripcion = data.suscripcion || {};
        const plan = data.plan || {};

        setText("configUsuarioNombre", usuario.nombre || "--");
        setText("configUsuarioCorreo", usuario.correo || "--");
        setText("configUsuarioTelefono", usuario.telefono || "No registrado");
        setText("configUsuarioTipo", formatearTipo(usuario.tipo));

        setText("configEmpresaNombre", empresa.nombre || "--");
        setText("configEmpresaCorreo", empresa.correo || "No registrado");
        setText("configEmpresaTelefono", empresa.telefono || "No registrado");
        setText("configEmpresaDireccion", empresa.direccion || "No registrada");

        setText("configPlanNombre", plan.nombre || "--");
        setText("configSuscripcionEstado", formatearEstado(suscripcion.estado));
        setText("configVehiculosPermitidos", suscripcion.cantidad_vehiculos ?? 0);
        setText("configMontoMensual", formatoMoneda(suscripcion.monto_mensual || 0));

    } catch (error) {
        console.error("Error cargando configuración:", error);
    }
}

function configurarModalPassword() {
    const modal = document.getElementById("modalPasswordDueno");
    const btnAbrir = document.getElementById("btnAbrirModalPassword");
    const btnCerrar = document.getElementById("btnCerrarModalPassword");
    const btnCancelar = document.getElementById("btnCancelarPassword");
    const form = document.getElementById("formPasswordDueno");

    btnAbrir?.addEventListener("click", () => {
        modal.classList.add("visible");
    });

    btnCerrar?.addEventListener("click", cerrarModalPassword);
    btnCancelar?.addEventListener("click", cerrarModalPassword);

    // para salir del modal con cualquier click fuera de este 
    // modal?.addEventListener("click", (event) => {
    //     if (event.target.id === "modalPasswordDueno") {
    //         cerrarModalPassword();
    //     }
    // });

    form?.addEventListener("submit", cambiarPassword);
}

function cerrarModalPassword() {
    const modal = document.getElementById("modalPasswordDueno");
    const form = document.getElementById("formPasswordDueno");
    const mensaje = document.getElementById("mensajePassword");
    const btn = document.getElementById("btnGuardarPassword");

    if (modal) modal.classList.remove("visible");
    if (form) form.reset();

    if (mensaje) {
        mensaje.textContent = "";
        mensaje.className = "form-message";
    }

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar contraseña";
    }

    document.querySelectorAll(".btn-password-toggle").forEach(btn => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);

    if (input) input.type = "password";
    btn.classList.remove("is-visible");
    btn.setAttribute("aria-label", "Mostrar contraseña");
    });
}

async function cambiarPassword(event) {
    event.preventDefault();

    const mensaje = document.getElementById("mensajePassword");
    const btn = document.getElementById("btnGuardarPassword");

    const passwordActual = document.getElementById("passwordActual").value.trim();
    const passwordNueva = document.getElementById("passwordNueva").value.trim();
    const passwordConfirmar = document.getElementById("passwordConfirmar").value.trim();

    mensaje.textContent = "";
    mensaje.className = "form-message";

    if (passwordNueva.length < 6) {
        mensaje.textContent = "La nueva contraseña debe tener al menos 6 caracteres.";
        mensaje.classList.add("error");
        return;
    }

    if (passwordNueva !== passwordConfirmar) {
        mensaje.textContent = "La confirmación no coincide con la nueva contraseña.";
        mensaje.classList.add("error");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
        await TrackAPI.cambiarPasswordDueno({
            password_actual: passwordActual,
            password_nueva: passwordNueva
        });

        mensaje.textContent = "Contraseña actualizada correctamente.";
        mensaje.className = "form-message success";

        setTimeout(cerrarModalPassword, 900);

    } catch (error) {
        mensaje.textContent = error.message || "No se pudo cambiar la contraseña.";
        mensaje.className = "form-message error";

        btn.disabled = false;
        btn.textContent = "Guardar contraseña";
    }
}

function formatearTipo(tipo) {
    const mapa = {
        dueno: "Dueño",
        admin: "Administrador",
        supervisor: "Supervisor",
        chofer: "Chofer"
    };

    return mapa[tipo] || "Usuario";
}

function formatearEstado(estado) {
    const mapa = {
        activa: "Activa",
        vencida: "Vencida",
        cancelada: "Cancelada",
        suspendida: "Suspendida"
    };

    return mapa[estado] || estado || "Sin suscripción";
}

function formatoMoneda(valor) {
    return Number(valor || 0).toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN"
    });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function configurarPasswordToggles() {
    document.querySelectorAll(".btn-password-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);

            if (!input) return;

            const visible = input.type === "text";
            input.type = visible ? "password" : "text";

            btn.classList.toggle("is-visible", !visible);
            btn.setAttribute(
                "aria-label",
                visible ? "Mostrar contraseña" : "Ocultar contraseña"
            );
        });
    });
}