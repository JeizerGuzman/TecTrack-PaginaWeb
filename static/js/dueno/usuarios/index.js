let usuariosOriginales = [];

document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const ok = await TrackGuards.requireAuth("dueno");
        if (!ok) return;
    }

    await cargarUsuarios();
    configurarModalDesactivar();
    configurarModalReactivar();
    configurarModalResetPassword();

    document.getElementById("buscarUsuario")?.addEventListener("input", renderConFiltros);
    document.getElementById("filtroTipoUsuario")?.addEventListener("change", renderConFiltros);
    document.getElementById("filtroEstadoUsuario")?.addEventListener("change", renderConFiltros);
});

async function cargarUsuarios() {
    const listado = document.getElementById("usuariosListado");

    try {
        const response = await TrackAPI.obtenerUsuarios();
        usuariosOriginales = response.usuarios || [];

        renderStats(usuariosOriginales);
        renderConFiltros();

    } catch (error) {
        console.error("Error cargando usuarios:", error);

        listado.innerHTML = `
            <div class="empty-state">
                <strong>No se pudieron cargar los usuarios</strong>
                <p>${escapeHtml(error.message || "Ocurrió un error al consultar usuarios.")}</p>
            </div>
        `;
    }
}

function renderStats(usuarios) {
    const total = usuarios.length;
    const choferes = usuarios.filter(u => u.tipo === "chofer").length;
    const supervisores = usuarios.filter(u => u.tipo === "supervisor").length;
    const activos = usuarios.filter(u => Boolean(u.activo)).length;

    setText("statUsuariosTotal", total);
    setText("statUsuariosChoferes", choferes);
    setText("statUsuariosSupervisores", supervisores);
    setText("statUsuariosActivos", activos);
}

function renderConFiltros() {
    const texto = normalizar(document.getElementById("buscarUsuario")?.value || "");
    const tipo = document.getElementById("filtroTipoUsuario")?.value || "todos";
    const estado = document.getElementById("filtroEstadoUsuario")?.value || "todos";

    let filtrados = [...usuariosOriginales];

    if (texto) {
        filtrados = filtrados.filter(u => {
            const contenido = normalizar(`${u.nombre || ""} ${u.correo || ""}`);
            return contenido.includes(texto);
        });
    }

    if (tipo !== "todos") {
        filtrados = filtrados.filter(u => u.tipo === tipo);
    }

    if (estado === "activo") {
        filtrados = filtrados.filter(u => Boolean(u.activo));
    }

    if (estado === "inactivo") {
        filtrados = filtrados.filter(u => !u.activo);
    }

    renderUsuarios(filtrados);
}

function renderUsuarios(usuarios) {
    const listado = document.getElementById("usuariosListado");

    if (!usuarios.length) {
        listado.innerHTML = `
            <div class="empty-state">
                <strong>No hay usuarios para mostrar</strong>
                <p>No se encontraron usuarios con los filtros seleccionados.</p>
            </div>
        `;
        return;
    }

    listado.innerHTML = usuarios.map(usuario => {
        const activo = Boolean(usuario.activo);
        const inicial = obtenerInicial(usuario.nombre);

        return `
            <article class="usuario-card ${activo ? "" : "usuario-inactivo"}">
                <div class="usuario-avatar">
                    ${escapeHtml(inicial)}
                </div>

                <div class="usuario-main">
                    <div class="usuario-title-row">
                        <div>
                            <h3>${escapeHtml(usuario.nombre || "Usuario sin nombre")}</h3>
                            <p>${escapeHtml(usuario.correo || "Sin correo")}</p>
                        </div>

                        <div class="usuario-badges">
                            <span class="usuario-badge tipo-${usuario.tipo}">
                                ${formatearTipo(usuario.tipo)}
                            </span>

                            <span class="usuario-badge ${activo ? "estado-activo" : "estado-inactivo"}">
                                ${activo ? "Activo" : "Inactivo"}
                            </span>
                        </div>
                    </div>
                    <div class="usuario-meta">
                        <span>Usuario activo en la empresa</span>
                    </div>
                </div>

                <div class="usuario-actions">
                    <a href="/dueno/usuarios/${usuario.id}/editar" class="btn btn-outline btn-sm">
                        Editar
                    </a>
                    <button class="btn btn-outline btn-sm btn-reset-password" data-id="${usuario.id}">
                        Contraseña
                    </button>

                    ${
                        activo
                            ? `<button class="btn btn-danger-outline btn-sm btn-desactivar-usuario" data-id="${usuario.id}">
                                    Desactivar
                            </button>`
                            : `<button class="btn btn-primary btn-sm btn-reactivar-usuario" data-id="${usuario.id}">
                                    Reactivar
                            </button>`
                    }
                </div>
            </article>
        `;
    }).join("");

    bindDesactivar();
    bindReactivar();
    bindResetPassword();
}

let usuarioSeleccionado = null;
let usuarioReactivarSeleccionado = null;

function bindDesactivar() {
    document.querySelectorAll(".btn-desactivar-usuario").forEach(btn => {
        btn.addEventListener("click", () => {
            const usuarioId = Number(btn.dataset.id);
            const usuario = usuariosOriginales.find(u => Number(u.id) === usuarioId);

            if (!usuario) {
                alert("No se encontró el usuario seleccionado.");
                return;
            }

            abrirModalDesactivar(usuario);
        });
    });
}

function configurarModalDesactivar() {
    document.getElementById("btnCerrarModalUsuario")?.addEventListener("click", cerrarModalDesactivar);
    document.getElementById("btnCancelarDesactivarUsuario")?.addEventListener("click", cerrarModalDesactivar);

    document.getElementById("modalDesactivarUsuario")?.addEventListener("click", (event) => {
        if (event.target.id === "modalDesactivarUsuario") {
            cerrarModalDesactivar();
        }
    });

    document.getElementById("btnConfirmarDesactivarUsuario")?.addEventListener("click", confirmarDesactivarUsuario);
}

function abrirModalDesactivar(usuario) {
    usuarioSeleccionado = usuario;

    document.getElementById("modalUsuarioNombre").textContent = usuario.nombre || "Usuario";
    document.getElementById("modalUsuarioCorreo").textContent = usuario.correo || "Sin correo";
    document.getElementById("modalDesactivarUsuario").classList.add("visible");
}

function cerrarModalDesactivar() {
    usuarioSeleccionado = null;

    const modal = document.getElementById("modalDesactivarUsuario");
    const btn = document.getElementById("btnConfirmarDesactivarUsuario");

    if (modal) modal.classList.remove("visible");

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Desactivar usuario";
    }
}

async function confirmarDesactivarUsuario() {
    if (!usuarioSeleccionado) return;

    const btn = document.getElementById("btnConfirmarDesactivarUsuario");

    btn.disabled = true;
    btn.textContent = "Desactivando...";

    try {
        await TrackAPI.desactivarUsuario(usuarioSeleccionado.id);
        cerrarModalDesactivar();
        await cargarUsuarios();
        mostrarToastUsuario("Usuario desactivado correctamente.", "success");
    } catch (error) {
        console.error("Error desactivando usuario:", error);
        mostrarToastUsuario(error.message || "No se pudo desactivar el usuario.", "error");

        btn.disabled = false;
        btn.textContent = "Desactivar usuario";
    }
}

function mostrarToastUsuario(mensaje, tipo = "info") {
    let toast = document.getElementById("usuariosToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "usuariosToast";
        toast.className = "usuarios-toast";
        document.body.appendChild(toast);
    }

    toast.textContent = mensaje;
    toast.className = `usuarios-toast ${tipo} visible`;

    setTimeout(() => {
        toast.classList.remove("visible");
    }, 3000);
}

function formatearTipo(tipo) {
    const mapa = {
        dueno: "Dueño",
        chofer: "Chofer",
        supervisor: "Supervisor",
        admin: "Admin"
    };

    return mapa[tipo] || "Usuario";
}

function obtenerInicial(nombre) {
    return String(nombre || "U").trim().charAt(0).toUpperCase();
}

function normalizar(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function bindReactivar() {
    document.querySelectorAll(".btn-reactivar-usuario").forEach(btn => {
        btn.addEventListener("click", () => {
            const usuarioId = Number(btn.dataset.id);
            const usuario = usuariosOriginales.find(u => Number(u.id) === usuarioId);

            if (!usuario) {
                alert("No se encontró el usuario seleccionado.");
                return;
            }

            abrirModalReactivar(usuario);
        });
    });
}

function configurarModalReactivar() {
    document.getElementById("btnCerrarModalReactivarUsuario")?.addEventListener("click", cerrarModalReactivar);
    document.getElementById("btnCancelarReactivarUsuario")?.addEventListener("click", cerrarModalReactivar);

    document.getElementById("modalReactivarUsuario")?.addEventListener("click", (event) => {
        if (event.target.id === "modalReactivarUsuario") {
            cerrarModalReactivar();
        }
    });

    document.getElementById("btnConfirmarReactivarUsuario")?.addEventListener("click", confirmarReactivarUsuario);
}

function abrirModalReactivar(usuario) {
    usuarioReactivarSeleccionado = usuario;

    document.getElementById("modalReactivarUsuarioNombre").textContent = usuario.nombre || "Usuario";
    document.getElementById("modalReactivarUsuarioCorreo").textContent = usuario.correo || "Sin correo";
    document.getElementById("modalReactivarUsuario").classList.add("visible");
}

function cerrarModalReactivar() {
    usuarioReactivarSeleccionado = null;

    const modal = document.getElementById("modalReactivarUsuario");
    const btn = document.getElementById("btnConfirmarReactivarUsuario");

    if (modal) modal.classList.remove("visible");

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Reactivar usuario";
    }
}

async function confirmarReactivarUsuario() {
    if (!usuarioReactivarSeleccionado) return;

    const btn = document.getElementById("btnConfirmarReactivarUsuario");

    btn.disabled = true;
    btn.textContent = "Reactivando...";

    try {
        await TrackAPI.reactivarUsuario(usuarioReactivarSeleccionado.id);
        cerrarModalReactivar();
        await cargarUsuarios();
        mostrarToastUsuario("Usuario reactivado correctamente.", "success");
    } catch (error) {
        console.error("Error reactivando usuario:", error);
        mostrarToastUsuario(error.message || "No se pudo reactivar el usuario.", "error");

        btn.disabled = false;
        btn.textContent = "Reactivar usuario";
    }
}

let usuarioResetSeleccionado = null;

function bindResetPassword() {
    document.querySelectorAll(".btn-reset-password").forEach(btn => {
        btn.addEventListener("click", () => {
            const usuarioId = Number(btn.dataset.id);
            const usuario = usuariosOriginales.find(u => Number(u.id) === usuarioId);

            if (!usuario) {
                alert("No se encontró el usuario seleccionado.");
                return;
            }

            abrirModalResetPassword(usuario);
        });
    });
}

function configurarModalResetPassword() {
    document.getElementById("btnCerrarModalResetPassword")?.addEventListener("click", cerrarModalResetPassword);
    document.getElementById("btnCancelarResetPassword")?.addEventListener("click", cerrarModalResetPassword);
    document.getElementById("btnConfirmarResetPassword")?.addEventListener("click", confirmarResetPassword);
    document.getElementById("btnCopiarNuevaPassword")?.addEventListener("click", copiarNuevaPassword);

    document.getElementById("modalResetPassword")?.addEventListener("click", (event) => {
        if (event.target.id === "modalResetPassword") {
            cerrarModalResetPassword();
        }
    });
}

function abrirModalResetPassword(usuario) {
    usuarioResetSeleccionado = usuario;

    document.getElementById("modalResetUsuarioNombre").textContent = usuario.nombre || "Usuario";
    document.getElementById("modalResetUsuarioCorreo").textContent = usuario.correo || "Sin correo";
    document.getElementById("nuevaPasswordUsuario").value = generarPasswordTemporal();

    document.getElementById("modalResetPassword").classList.add("visible");
}

function cerrarModalResetPassword() {
    usuarioResetSeleccionado = null;

    const modal = document.getElementById("modalResetPassword");
    const btn = document.getElementById("btnConfirmarResetPassword");

    if (modal) modal.classList.remove("visible");

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar contraseña";
    }
}

async function confirmarResetPassword() {
    if (!usuarioResetSeleccionado) return;

    const input = document.getElementById("nuevaPasswordUsuario");
    const password = input.value.trim();

    if (password.length < 6) {
        mostrarToastUsuario("La contraseña debe tener al menos 6 caracteres.", "error");
        return;
    }

    const btn = document.getElementById("btnConfirmarResetPassword");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
        await TrackAPI.resetPasswordUsuario(usuarioResetSeleccionado.id, password);

        copiarTextoFallback(`Correo: ${usuarioResetSeleccionado.correo}\nContraseña temporal: ${password}`);

        cerrarModalResetPassword();
        mostrarToastUsuario("Contraseña actualizada y copiada.", "success");

    } catch (error) {
        console.error("Error restableciendo contraseña:", error);
        mostrarToastUsuario(error.message || "No se pudo actualizar la contraseña.", "error");

        btn.disabled = false;
        btn.textContent = "Guardar contraseña";
    }
}

function copiarNuevaPassword() {
    const password = document.getElementById("nuevaPasswordUsuario")?.value || "";
    const correo = usuarioResetSeleccionado?.correo || "";

    if (!password) return;

    copiarTextoFallback(`Correo: ${correo}\nContraseña temporal: ${password}`);
    mostrarToastUsuario("Credenciales copiadas al portapapeles.", "success");
}

function generarPasswordTemporal() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let pass = "TS-";

    for (let i = 0; i < 8; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return pass;
}

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