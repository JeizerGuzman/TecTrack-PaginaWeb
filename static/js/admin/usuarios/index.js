let usuariosOriginales = [];
let empresasUsuarios = [];

let usuariosTimer = null;
let usuariosCargando = false;

let usuarioEditandoId = null;
let usuarioEstadoSeleccionado = null;
let usuarioPasswordSeleccionado = null;

/* ============================================================
   INICIO
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

    if (window.TrackGuards?.requireAuth) {
        const autorizado = await TrackGuards.requireAuth("admin");

        if (!autorizado) {
            return;
        }
    }


    configurarEventosUsuarios();


    await cargarEmpresasUsuarios();

    await cargarUsuarios();


    const intervaloMs =
        await TrackConfig.obtenerAdminMs(
            "usuarios",
            30
        );


    if (usuariosTimer) {
        clearInterval(usuariosTimer);
    }


    usuariosTimer = setInterval(
        cargarUsuarios,
        intervaloMs
    );

});


window.addEventListener("beforeunload", () => {

    if (usuariosTimer) {
        clearInterval(usuariosTimer);
    }
});


/* ============================================================
   EVENTOS
   ============================================================ */

function configurarEventosUsuarios() {

    document
        .querySelectorAll(".password-toggle-btn")
        .forEach(boton => {

            boton.addEventListener("click", () => {

                const targetId = boton.dataset.passwordTarget;

                const input = document.getElementById(targetId);

                if (!input) return;


                const estaVisible =
                    input.type === "text";


                input.type = estaVisible
                    ? "password"
                    : "text";


                boton.classList.toggle(
                    "is-visible",
                    !estaVisible
                );


                boton.setAttribute(
                    "aria-label",
                    estaVisible
                        ? "Mostrar contraseña"
                        : "Ocultar contraseña"
                );


                boton.setAttribute(
                    "title",
                    estaVisible
                        ? "Mostrar contraseña"
                        : "Ocultar contraseña"
                );
            });
        });

    /* --------------------------------------------------------
       BOTÓN NUEVO USUARIO
       -------------------------------------------------------- */

    document
        .getElementById("btnAbrirModalUsuario")
        ?.addEventListener("click", abrirModalCrearUsuario);


    /* --------------------------------------------------------
       MODAL CREAR / EDITAR
       -------------------------------------------------------- */

    document
        .getElementById("btnCerrarModalUsuario")
        ?.addEventListener("click", cerrarModalUsuario);


    document
        .getElementById("btnCancelarUsuario")
        ?.addEventListener("click", cerrarModalUsuario);


    document
        .getElementById("formUsuario")
        ?.addEventListener("submit", guardarUsuario);


    document
        .getElementById("usuarioTipo")
        ?.addEventListener("change", actualizarCampoEmpresaUsuario);


    /* --------------------------------------------------------
       FILTROS GENERALES
       -------------------------------------------------------- */

    document
        .getElementById("buscarUsuario")
        ?.addEventListener("input", aplicarFiltrosUsuarios);


    document
        .getElementById("filtroRolUsuario")
        ?.addEventListener("change", aplicarFiltrosUsuarios);


    document
        .getElementById("filtroEstadoUsuario")
        ?.addEventListener("change", aplicarFiltrosUsuarios);


        
    /* --------------------------------------------------------
       COMBOBOX FILTRO EMPRESA
       -------------------------------------------------------- */

    document
        .getElementById("btnToggleFiltroEmpresaUsuario")
        ?.addEventListener("click", event => {

            event.stopPropagation();

            renderizarMenuFiltroEmpresas();

            alternarMenuEmpresa(
                "comboboxFiltroEmpresaUsuario"
            );
        });


    document
        .getElementById("filtroEmpresaUsuario")
        ?.addEventListener("input", () => {

            renderizarMenuFiltroEmpresas();

            document
                .getElementById("comboboxFiltroEmpresaUsuario")
                ?.classList.add("open");

            aplicarFiltrosUsuarios();
        });


    document
        .getElementById("filtroEmpresaUsuario")
        ?.addEventListener("focus", () => {

            renderizarMenuFiltroEmpresas();

            document
                .getElementById("comboboxFiltroEmpresaUsuario")
                ?.classList.add("open");
        });


    document
        .getElementById("menuFiltroEmpresaUsuario")
        ?.addEventListener("click", event => {

            const opcion = event.target.closest(
                ".empresa-combobox-option"
            );

            if (!opcion) return;

            seleccionarEmpresaFiltro(
                opcion.dataset.empresaId || "",
                opcion.dataset.empresaNombre || ""
            );
        });


    /* --------------------------------------------------------
       COMBOBOX EMPRESA DEL MODAL
       -------------------------------------------------------- */

    document
        .getElementById("btnToggleUsuarioEmpresa")
        ?.addEventListener("click", event => {

            event.stopPropagation();

            renderizarMenuUsuarioEmpresas();

            alternarMenuEmpresa(
                "comboboxUsuarioEmpresa"
            );
        });


    document
        .getElementById("usuarioEmpresaBusqueda")
        ?.addEventListener("input", () => {

            actualizarEmpresaSeleccionadaUsuario();

            renderizarMenuUsuarioEmpresas();

            document
                .getElementById("comboboxUsuarioEmpresa")
                ?.classList.add("open");
        });


    document
        .getElementById("usuarioEmpresaBusqueda")
        ?.addEventListener("focus", () => {

            renderizarMenuUsuarioEmpresas();

            document
                .getElementById("comboboxUsuarioEmpresa")
                ?.classList.add("open");
        });


    document
        .getElementById("menuUsuarioEmpresa")
        ?.addEventListener("click", event => {

            const opcion = event.target.closest(
                ".empresa-combobox-option"
            );

            if (!opcion) return;

            seleccionarEmpresaUsuario(
                opcion.dataset.empresaId,
                opcion.dataset.empresaNombre
            );
        });


    /* --------------------------------------------------------
       MODAL CAMBIO DE ESTADO
       -------------------------------------------------------- */

    document
        .getElementById("btnCerrarModalEstadoUsuario")
        ?.addEventListener("click", cerrarModalEstadoUsuario);


    document
        .getElementById("btnCancelarEstadoUsuario")
        ?.addEventListener("click", cerrarModalEstadoUsuario);


    document
        .getElementById("btnConfirmarEstadoUsuario")
        ?.addEventListener("click", confirmarCambioEstadoUsuario);


    /* --------------------------------------------------------
       MODAL CONTRASEÑA
       -------------------------------------------------------- */

    document
        .getElementById("btnCerrarModalPasswordUsuario")
        ?.addEventListener("click", cerrarModalPasswordUsuario);


    document
        .getElementById("btnCancelarPasswordUsuario")
        ?.addEventListener("click", cerrarModalPasswordUsuario);


    document
        .getElementById("btnConfirmarPasswordUsuario")
        ?.addEventListener("click", confirmarPasswordUsuario);


    /* --------------------------------------------------------
       CERRAR COMBOBOX AL HACER CLIC FUERA
       -------------------------------------------------------- */

    document.addEventListener("click", event => {

        const dentroCombobox = event.target.closest(
            ".empresa-combobox"
        );

        if (!dentroCombobox) {
            cerrarTodosLosMenusEmpresa();
        }
    });
}


/* ============================================================
   CARGAR EMPRESAS
   ============================================================ */

async function cargarEmpresasUsuarios() {

    try {

        const data = await TrackAPI.obtenerAdminEmpresas();

        empresasUsuarios = data.empresas || [];

        renderizarOpcionesEmpresasUsuarios();

    } catch (error) {

        console.error(
            "Error cargando empresas para usuarios:",
            error
        );

        mostrarToastUsuarios(
            error.message ||
            "No se pudieron cargar las empresas.",
            "error"
        );
    }
}


/* ============================================================
   COMBOBOX EMPRESAS
   ============================================================ */

function renderizarOpcionesEmpresasUsuarios() {

    renderizarMenuFiltroEmpresas();
    renderizarMenuUsuarioEmpresas();
}


/* ============================================================
   MENÚ DE EMPRESAS PARA FILTRO
   ============================================================ */

function renderizarMenuFiltroEmpresas() {

    const menu = document.getElementById(
        "menuFiltroEmpresaUsuario"
    );

    const input = document.getElementById(
        "filtroEmpresaUsuario"
    );

    if (!menu || !input) return;


    const busqueda = input.value
        .trim()
        .toLowerCase();


    const empresasFiltradas = empresasUsuarios.filter(empresa => {

        const nombre = String(
            empresa.nombre || ""
        )
            .trim()
            .toLowerCase();

        return (
            !busqueda ||
            nombre.includes(busqueda)
        );
    });


    let html = `
        <button
            type="button"
            class="empresa-combobox-option"
            data-empresa-id=""
            data-empresa-nombre="">

            <span>Todas las empresas</span>
        </button>
    `;


    if (!empresasFiltradas.length) {

        html += `
            <div class="empresa-combobox-empty">
                No se encontraron empresas
            </div>
        `;

    } else {

        html += empresasFiltradas.map(empresa => `
            <button
                type="button"
                class="empresa-combobox-option"
                data-empresa-id="${escapeHtmlUsuario(empresa.id)}"
                data-empresa-nombre="${escapeHtmlUsuario(empresa.nombre)}">

                <span>
                    ${escapeHtmlUsuario(empresa.nombre)}
                </span>
            </button>
        `).join("");
    }


    menu.innerHTML = html;
}


/* ============================================================
   MENÚ DE EMPRESAS PARA CREAR / EDITAR
   ============================================================ */

function renderizarMenuUsuarioEmpresas() {

    const menu = document.getElementById(
        "menuUsuarioEmpresa"
    );

    const input = document.getElementById(
        "usuarioEmpresaBusqueda"
    );

    if (!menu || !input) return;


    const busqueda = input.value
        .trim()
        .toLowerCase();


    const empresasFiltradas = empresasUsuarios

        .filter(empresa => empresa.activo !== false)

        .filter(empresa => {

            const nombre = String(
                empresa.nombre || ""
            )
                .trim()
                .toLowerCase();

            return (
                !busqueda ||
                nombre.includes(busqueda)
            );
        });


    if (!empresasFiltradas.length) {

        menu.innerHTML = `
            <div class="empresa-combobox-empty">
                No se encontraron empresas
            </div>
        `;

        return;
    }


    menu.innerHTML = empresasFiltradas.map(empresa => `
        <button
            type="button"
            class="empresa-combobox-option"
            data-empresa-id="${escapeHtmlUsuario(empresa.id)}"
            data-empresa-nombre="${escapeHtmlUsuario(empresa.nombre)}">

            <span>
                ${escapeHtmlUsuario(empresa.nombre)}
            </span>
        </button>
    `).join("");
}


/* ============================================================
   SELECCIONAR EMPRESA EN FILTRO
   ============================================================ */

function seleccionarEmpresaFiltro(
    empresaId,
    empresaNombre
) {

    const input = document.getElementById(
        "filtroEmpresaUsuario"
    );

    if (!input) return;


    input.value = empresaId
        ? empresaNombre
        : "";


    cerrarMenuEmpresa(
        "comboboxFiltroEmpresaUsuario"
    );


    aplicarFiltrosUsuarios();
}


/* ============================================================
   SELECCIONAR EMPRESA EN MODAL
   ============================================================ */

function seleccionarEmpresaUsuario(
    empresaId,
    empresaNombre
) {

    const input = document.getElementById(
        "usuarioEmpresaBusqueda"
    );

    const hidden = document.getElementById(
        "usuarioEmpresa"
    );


    if (!input || !hidden) return;


    input.value = empresaNombre;

    hidden.value = empresaId;


    cerrarMenuEmpresa(
        "comboboxUsuarioEmpresa"
    );
}


/* ============================================================
   SINCRONIZAR NOMBRE DE EMPRESA CON SU ID
   ============================================================ */

function actualizarEmpresaSeleccionadaUsuario() {

    const input = document.getElementById(
        "usuarioEmpresaBusqueda"
    );

    const hidden = document.getElementById(
        "usuarioEmpresa"
    );

    if (!input || !hidden) return;


    const nombreEscrito = input.value
        .trim()
        .toLowerCase();


    const empresaEncontrada = empresasUsuarios.find(
        empresa => {

            const nombreEmpresa = String(
                empresa.nombre || ""
            )
                .trim()
                .toLowerCase();

            return (
                empresa.activo !== false &&
                nombreEmpresa === nombreEscrito
            );
        }
    );


    hidden.value = empresaEncontrada
        ? empresaEncontrada.id
        : "";
}


/* ============================================================
   ABRIR / CERRAR COMBOBOX
   ============================================================ */

function alternarMenuEmpresa(comboboxId) {

    const combobox = document.getElementById(
        comboboxId
    );

    if (!combobox) return;


    const yaAbierto = combobox.classList.contains(
        "open"
    );


    cerrarTodosLosMenusEmpresa();


    if (!yaAbierto) {
        combobox.classList.add("open");
    }
}


function cerrarMenuEmpresa(comboboxId) {

    const combobox = document.getElementById(
        comboboxId
    );

    if (combobox) {
        combobox.classList.remove("open");
    }
}


function cerrarTodosLosMenusEmpresa() {

    document
        .querySelectorAll(".empresa-combobox.open")
        .forEach(combobox => {

            combobox.classList.remove("open");
        });
}


/* ============================================================
   CARGAR USUARIOS
   ============================================================ */

async function cargarUsuarios() {

    if (usuariosCargando) return;

    usuariosCargando = true;


    try {

        const data = await TrackAPI.obtenerAdminUsuarios();

        usuariosOriginales = data.usuarios || [];

        actualizarEstadisticasUsuarios();
        aplicarFiltrosUsuarios();
        actualizarTextoActualizacionUsuarios();

    } catch (error) {

        console.error(
            "Error cargando usuarios:",
            error
        );

        mostrarToastUsuarios(
            error.message ||
            "No se pudieron cargar los usuarios.",
            "error"
        );

    } finally {

        usuariosCargando = false;
    }
}


/* ============================================================
   ESTADÍSTICAS
   ============================================================ */

function actualizarEstadisticasUsuarios() {

    const total = usuariosOriginales.length;

    const admins = usuariosOriginales.filter(
        usuario => usuario.tipo === "admin"
    ).length;

    const duenos = usuariosOriginales.filter(
        usuario => usuario.tipo === "dueno"
    ).length;


    const supervisores = usuariosOriginales.filter(
        usuario => usuario.tipo === "supervisor"
    ).length;


    const choferes = usuariosOriginales.filter(
        usuario => usuario.tipo === "chofer"
    ).length;


    const tecnicos = usuariosOriginales.filter(
        usuario => usuario.tipo === "tecnico"
    ).length;


    asignarTextoUsuario(
        "statUsuariosTotal",
        total
    );

    asignarTextoUsuario(
        "statUsuariosAdmins",
        admins
    );

    asignarTextoUsuario(
        "statUsuariosDuenos",
        duenos
    );


    asignarTextoUsuario(
        "statUsuariosSupervisores",
        supervisores
    );


    asignarTextoUsuario(
        "statUsuariosChoferes",
        choferes
    );


    asignarTextoUsuario(
        "statUsuariosTecnicos",
        tecnicos
    );
}


/* ============================================================
   FILTROS
   ============================================================ */

function aplicarFiltrosUsuarios() {

    const busqueda = (
        document.getElementById("buscarUsuario")?.value || ""
    )
        .trim()
        .toLowerCase();


    const empresaBusqueda = (
        document.getElementById("filtroEmpresaUsuario")?.value || ""
    )
        .trim()
        .toLowerCase();


    const rol = (
        document.getElementById("filtroRolUsuario")?.value ||
        "todos"
    );


    const estado = (
        document.getElementById("filtroEstadoUsuario")?.value ||
        "todos"
    );


    const filtrados = usuariosOriginales.filter(usuario => {

        const texto = [
            usuario.nombre,
            usuario.correo,
            usuario.telefono,
            usuario.empresa_nombre,
            usuario.tipo
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        const coincideBusqueda =
            !busqueda ||
            texto.includes(busqueda);


        const nombreEmpresaUsuario = String(
            usuario.empresa_nombre || ""
        )
            .trim()
            .toLowerCase();


        const coincideEmpresa =
            !empresaBusqueda ||
            nombreEmpresaUsuario.includes(
                empresaBusqueda
            );


        const coincideRol =
            rol === "todos" ||
            usuario.tipo === rol;


        const coincideEstado =
            estado === "todos" ||

            (
                estado === "activo" &&
                usuario.activo === true
            ) ||

            (
                estado === "inactivo" &&
                usuario.activo === false
            );


        return (
            coincideBusqueda &&
            coincideEmpresa &&
            coincideRol &&
            coincideEstado
        );
    });


    renderizarUsuarios(filtrados);
}


/* ============================================================
   RENDERIZAR USUARIOS
   ============================================================ */

function renderizarUsuarios(usuarios) {

    const contenedor = document.getElementById(
        "usuariosListado"
    );

    if (!contenedor) return;


    if (!usuarios.length) {

        contenedor.innerHTML = `
            <div class="empty-state">
                <strong>No se encontraron usuarios</strong>

                <p>
                    No hay usuarios que coincidan con los filtros seleccionados.
                </p>
            </div>
        `;

        return;
    }


    contenedor.innerHTML = usuarios.map(usuario => {

        const estadoClase = usuario.activo
            ? "activo"
            : "inactivo";


        const estadoTexto = usuario.activo
            ? "Activo"
            : "Inactivo";


        const empresaNombre =
            usuario.empresa_nombre ||
            "Sin empresa";


        const iniciales = obtenerInicialesUsuario(
            usuario.nombre
        );


        return `
            <article class="usuario-item">

                <div class="usuario-main">

                    <div class="usuario-avatar">
                        ${escapeHtmlUsuario(iniciales)}
                    </div>

                    <div class="usuario-main-info">

                        <strong>
                            ${escapeHtmlUsuario(
                                usuario.nombre || "Sin nombre"
                            )}
                        </strong>

                        <span>
                            ${escapeHtmlUsuario(
                                usuario.correo || "Sin correo"
                            )}
                        </span>

                    </div>

                </div>


                <div class="usuario-empresa">

                    <strong>
                        ${escapeHtmlUsuario(empresaNombre)}
                    </strong>

                    <span>
                        ${escapeHtmlUsuario(
                            usuario.telefono || "Sin teléfono"
                        )}
                    </span>

                </div>


                <div class="usuario-rol">

                    <span class="usuario-role-badge ${obtenerClaseRolUsuario(usuario.tipo)}">

                        ${escapeHtmlUsuario(
                            obtenerNombreRolUsuario(usuario.tipo)
                        )}

                    </span>

                </div>


                <div class="usuario-estado-col">

                    <span class="usuario-status ${estadoClase}">
                        ${estadoTexto}
                    </span>

                </div>


                <div class="usuario-actions">

                    <button
                        type="button"
                        class="usuario-action-btn"
                        onclick="abrirModalEditarUsuario(${usuario.id})">

                        Editar

                    </button>


                    <button
                        type="button"
                        class="usuario-action-btn"
                        onclick="abrirModalPasswordUsuario(${usuario.id})">

                        Contraseña

                    </button>


                    <button
                        type="button"
                        class="usuario-action-btn ${usuario.activo ? "danger" : "success"}"
                        onclick="abrirModalEstadoUsuario(${usuario.id})">

                        ${usuario.activo
                            ? "Desactivar"
                            : "Reactivar"}

                    </button>

                </div>

            </article>
        `;

    }).join("");
}


/* ============================================================
   MODAL CREAR
   ============================================================ */

function abrirModalCrearUsuario() {

    usuarioEditandoId = null;

    cerrarTodosLosMenusEmpresa();


    document
        .getElementById("formUsuario")
        ?.reset();


    const usuarioId = document.getElementById(
        "usuarioId"
    );

    if (usuarioId) {
        usuarioId.value = "";
    }


    const empresaBusqueda = document.getElementById(
        "usuarioEmpresaBusqueda"
    );

    if (empresaBusqueda) {
        empresaBusqueda.value = "";
    }


    const empresaId = document.getElementById(
        "usuarioEmpresa"
    );

    if (empresaId) {
        empresaId.value = "";
    }


    asignarTextoUsuario(
        "modalUsuarioTitulo",
        "Nuevo usuario"
    );


    asignarTextoUsuario(
        "modalUsuarioSubtitulo",
        "Registra un usuario en TrackSecurity."
    );


    asignarTextoUsuario(
        "btnGuardarUsuario",
        "Guardar usuario"
    );


    const grupoPassword = document.getElementById(
        "grupoPasswordUsuario"
    );

    if (grupoPassword) {
        grupoPassword.style.display = "";
    }


    actualizarCampoEmpresaUsuario();

    renderizarMenuUsuarioEmpresas();

    abrirModalUsuarioPorId(
        "modalUsuario"
    );
}


/* ============================================================
   MODAL EDITAR
   ============================================================ */

function abrirModalEditarUsuario(usuarioId) {

    const usuario = usuariosOriginales.find(
        item => Number(item.id) === Number(usuarioId)
    );


    if (!usuario) {

        mostrarToastUsuarios(
            "No se encontró el usuario seleccionado.",
            "error"
        );

        return;
    }


    usuarioEditandoId = usuario.id;

    cerrarTodosLosMenusEmpresa();


    const inputId = document.getElementById(
        "usuarioId"
    );

    if (inputId) {
        inputId.value = usuario.id;
    }


    const inputNombre = document.getElementById(
        "usuarioNombre"
    );

    if (inputNombre) {
        inputNombre.value = usuario.nombre || "";
    }


    const inputCorreo = document.getElementById(
        "usuarioCorreo"
    );

    if (inputCorreo) {
        inputCorreo.value = usuario.correo || "";
    }


    const inputTelefono = document.getElementById(
        "usuarioTelefono"
    );

    if (inputTelefono) {
        inputTelefono.value = usuario.telefono || "";
    }


    const inputTipo = document.getElementById(
        "usuarioTipo"
    );

    if (inputTipo) {
        inputTipo.value = usuario.tipo || "";
    }


    const inputEmpresaId = document.getElementById(
        "usuarioEmpresa"
    );

    if (inputEmpresaId) {
        inputEmpresaId.value = usuario.empresa_id || "";
    }


    const inputEmpresaNombre = document.getElementById(
        "usuarioEmpresaBusqueda"
    );

    if (inputEmpresaNombre) {
        inputEmpresaNombre.value =
            usuario.empresa_nombre || "";
    }


    asignarTextoUsuario(
        "modalUsuarioTitulo",
        "Editar usuario"
    );


    asignarTextoUsuario(
        "modalUsuarioSubtitulo",
        "Actualiza los datos generales del usuario."
    );


    asignarTextoUsuario(
        "btnGuardarUsuario",
        "Guardar cambios"
    );


    const grupoPassword = document.getElementById(
        "grupoPasswordUsuario"
    );

    if (grupoPassword) {
        grupoPassword.style.display = "none";
    }


    actualizarCampoEmpresaUsuario();

    renderizarMenuUsuarioEmpresas();

    abrirModalUsuarioPorId(
        "modalUsuario"
    );
}


/* ============================================================
   EMPRESA SEGÚN ROL
   ============================================================ */

function actualizarCampoEmpresaUsuario() {

    const tipo = document.getElementById(
        "usuarioTipo"
    )?.value;


    const grupo = document.getElementById(
        "grupoEmpresaUsuario"
    );


    const empresaId = document.getElementById(
        "usuarioEmpresa"
    );


    const empresaBusqueda = document.getElementById(
        "usuarioEmpresaBusqueda"
    );


    if (
        !grupo ||
        !empresaId ||
        !empresaBusqueda
    ) {
        return;
    }


    if (
        tipo === "admin" ||
        tipo === "tecnico"
    ) {

        grupo.style.display = "none";

        empresaId.value = "";
        empresaBusqueda.value = "";

        cerrarMenuEmpresa(
            "comboboxUsuarioEmpresa"
        );

    } else {

        grupo.style.display = "";
    }
}


/* ============================================================
   GUARDAR USUARIO
   ============================================================ */

async function guardarUsuario(event) {

    event.preventDefault();


    const nombre = document
        .getElementById("usuarioNombre")
        .value
        .trim();


    const correo = document
        .getElementById("usuarioCorreo")
        .value
        .trim();


    const telefono = document
        .getElementById("usuarioTelefono")
        .value
        .trim();


    const tipo = document
        .getElementById("usuarioTipo")
        .value;


    const password = document
        .getElementById("usuarioPassword")
        .value;


    /* --------------------------------------------------------
       VALIDACIONES GENERALES
       -------------------------------------------------------- */

    if (!nombre) {

        mostrarToastUsuarios(
            "Ingresa el nombre del usuario.",
            "error"
        );

        return;
    }


    if (!correo) {

        mostrarToastUsuarios(
            "Ingresa el correo del usuario.",
            "error"
        );

        return;
    }


    if (!tipo) {

        mostrarToastUsuarios(
            "Selecciona un rol.",
            "error"
        );

        return;
    }


    /* --------------------------------------------------------
       SINCRONIZAR EMPRESA ESCRITA CON EMPRESA REAL
       -------------------------------------------------------- */

    actualizarEmpresaSeleccionadaUsuario();


    const empresaId = document
        .getElementById("usuarioEmpresa")
        .value;


    if (
        !["admin", "tecnico"].includes(tipo) &&
        !empresaId
    ) {

        mostrarToastUsuarios(
            "Selecciona una empresa válida de la lista.",
            "error"
        );

        return;
    }


    /* --------------------------------------------------------
       CONTRASEÑA SOLO AL CREAR
       -------------------------------------------------------- */

    if (
        !usuarioEditandoId &&
        password.length < 6
    ) {

        mostrarToastUsuarios(
            "La contraseña debe tener al menos 6 caracteres.",
            "error"
        );

        return;
    }


    const data = {
        nombre,
        correo,
        telefono,
        tipo,

        empresa_id:
            ["admin", "tecnico"].includes(tipo)
                ? null
                : Number(empresaId)
    };


    if (!usuarioEditandoId) {
        data.password = password;
    }


    const boton = document.getElementById(
        "btnGuardarUsuario"
    );


    if (boton) {
        boton.disabled = true;
    }


    try {

        if (usuarioEditandoId) {

            await TrackAPI.editarAdminUsuario(
                usuarioEditandoId,
                data
            );


            mostrarToastUsuarios(
                "Usuario actualizado correctamente.",
                "success"
            );

        } else {

            await TrackAPI.crearAdminUsuario(data);


            mostrarToastUsuarios(
                "Usuario creado correctamente.",
                "success"
            );
        }


        cerrarModalUsuario();

        await cargarUsuarios();


    } catch (error) {

        console.error(
            "Error guardando usuario:",
            error
        );


        mostrarToastUsuarios(
            obtenerMensajeErrorUsuario(
                error,
                "No se pudo guardar el usuario."
            ),
            "error"
        );

    } finally {

        if (boton) {
            boton.disabled = false;
        }
    }
}


/* ============================================================
   CAMBIO DE ESTADO
   ============================================================ */

function abrirModalEstadoUsuario(usuarioId) {

    const usuario = usuariosOriginales.find(
        item => Number(item.id) === Number(usuarioId)
    );

    if (!usuario) return;


    usuarioEstadoSeleccionado = usuario;


    const accion = usuario.activo
        ? "desactivar"
        : "reactivar";


    asignarTextoUsuario(
        "modalEstadoUsuarioTitulo",

        usuario.activo
            ? "Desactivar usuario"
            : "Reactivar usuario"
    );


    asignarTextoUsuario(
        "modalEstadoUsuarioDescripcion",

        `¿Deseas ${accion} a ${usuario.nombre}?`
    );


    asignarTextoUsuario(
        "btnConfirmarEstadoUsuario",

        usuario.activo
            ? "Desactivar"
            : "Reactivar"
    );


    abrirModalUsuarioPorId(
        "modalEstadoUsuario"
    );
}


async function confirmarCambioEstadoUsuario() {

    if (!usuarioEstadoSeleccionado) return;


    const boton = document.getElementById(
        "btnConfirmarEstadoUsuario"
    );


    if (boton) {
        boton.disabled = true;
    }


    try {

        if (usuarioEstadoSeleccionado.activo) {

            await TrackAPI.desactivarAdminUsuario(
                usuarioEstadoSeleccionado.id
            );


            mostrarToastUsuarios(
                "Usuario desactivado correctamente.",
                "success"
            );

        } else {

            await TrackAPI.reactivarAdminUsuario(
                usuarioEstadoSeleccionado.id
            );


            mostrarToastUsuarios(
                "Usuario reactivado correctamente.",
                "success"
            );
        }


        cerrarModalEstadoUsuario();

        await cargarUsuarios();


    } catch (error) {

        console.error(
            "Error cambiando estado del usuario:",
            error
        );


        mostrarToastUsuarios(
            obtenerMensajeErrorUsuario(
                error,
                "No se pudo cambiar el estado del usuario."
            ),
            "error"
        );

    } finally {

        if (boton) {
            boton.disabled = false;
        }
    }
}


/* ============================================================
   RESTABLECER CONTRASEÑA
   ============================================================ */

function abrirModalPasswordUsuario(usuarioId) {

    const usuario = usuariosOriginales.find(
        item => Number(item.id) === Number(usuarioId)
    );

    if (!usuario) return;


    usuarioPasswordSeleccionado = usuario;


    const nuevaPassword = document.getElementById(
        "nuevaPasswordUsuario"
    );

    if (nuevaPassword) {
        nuevaPassword.value = "";
    }


    const confirmarPassword = document.getElementById(
        "confirmarPasswordUsuario"
    );

    if (confirmarPassword) {
        confirmarPassword.value = "";
    }


    asignarTextoUsuario(
        "modalPasswordUsuarioDescripcion",

        `Ingresa una nueva contraseña para ${usuario.nombre}.`
    );


    abrirModalUsuarioPorId(
        "modalPasswordUsuario"
    );
}


async function confirmarPasswordUsuario() {

    if (!usuarioPasswordSeleccionado) return;


    const password = document
        .getElementById("nuevaPasswordUsuario")
        .value;


    const confirmacion = document
        .getElementById("confirmarPasswordUsuario")
        .value;


    if (password.length < 6) {

        mostrarToastUsuarios(
            "La contraseña debe tener al menos 6 caracteres.",
            "error"
        );

        return;
    }


    if (password !== confirmacion) {

        mostrarToastUsuarios(
            "Las contraseñas no coinciden.",
            "error"
        );

        return;
    }


    const boton = document.getElementById(
        "btnConfirmarPasswordUsuario"
    );


    if (boton) {
        boton.disabled = true;
    }


    try {

        await TrackAPI.resetPasswordAdminUsuario(
            usuarioPasswordSeleccionado.id,
            password
        );


        mostrarToastUsuarios(
            "Contraseña actualizada correctamente.",
            "success"
        );


        cerrarModalPasswordUsuario();


    } catch (error) {

        console.error(
            "Error restableciendo contraseña:",
            error
        );


        mostrarToastUsuarios(
            obtenerMensajeErrorUsuario(
                error,
                "No se pudo actualizar la contraseña."
            ),
            "error"
        );

    } finally {

        if (boton) {
            boton.disabled = false;
        }
    }
}


/* ============================================================
   CERRAR MODALES
   No se cierran al hacer clic en el backdrop.
   ============================================================ */

function cerrarModalUsuario() {

    cerrarTodosLosMenusEmpresa();

    cerrarModalUsuarioPorId(
        "modalUsuario"
    );

    usuarioEditandoId = null;
}


function cerrarModalEstadoUsuario() {

    cerrarModalUsuarioPorId(
        "modalEstadoUsuario"
    );

    usuarioEstadoSeleccionado = null;
}


function cerrarModalPasswordUsuario() {

    cerrarModalUsuarioPorId(
        "modalPasswordUsuario"
    );

    usuarioPasswordSeleccionado = null;
}


/* ============================================================
   UTILIDADES MODALES
   ============================================================ */

function abrirModalUsuarioPorId(id) {

    const modal = document.getElementById(id);

    if (!modal) return;


    modal.classList.add("show");

    document.body.style.overflow = "hidden";
}


function cerrarModalUsuarioPorId(id) {

    const modal = document.getElementById(id);

    if (!modal) return;


    modal.classList.remove("show");


    const hayOtroModalAbierto =
        document.querySelector(
            ".modal-backdrop.show"
        );


    if (!hayOtroModalAbierto) {
        document.body.style.overflow = "";
    }
}


/* ============================================================
   UTILIDADES
   ============================================================ */

function obtenerInicialesUsuario(nombre) {

    if (!nombre) return "US";


    return nombre
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(parte => parte.charAt(0))
        .join("")
        .toUpperCase();
}


function obtenerNombreRolUsuario(tipo) {

    const nombres = {
        admin: "Administrador",
        dueno: "Dueño",
        supervisor: "Supervisor",
        chofer: "Chofer",
        tecnico: "Técnico"
    };


    return nombres[tipo] ||
        tipo ||
        "Sin rol";
}


function obtenerClaseRolUsuario(tipo) {

    const clases = {
        dueno: "role-dueno",
        supervisor: "role-supervisor",
        chofer: "role-chofer",
        tecnico: "role-tecnico"
    };


    return clases[tipo] ||
        "role-tecnico";
}


function actualizarTextoActualizacionUsuarios() {

    const elemento = document.getElementById(
        "usuariosActualizacion"
    );

    if (!elemento) return;


    const ahora = new Date();


    elemento.textContent =
        `Actualizado ${ahora.toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        })}`;
}


function asignarTextoUsuario(id, valor) {

    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}


function escapeHtmlUsuario(valor) {

    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ============================================================
   OBTENER MENSAJE DE ERROR DEL BACKEND
   ============================================================ */

function obtenerMensajeErrorUsuario(
    error,
    mensajePredeterminado
) {

    if (!error) {
        return mensajePredeterminado;
    }


    if (
        typeof error.message === "string" &&
        error.message.trim()
    ) {
        return error.message.trim();
    }


    if (
        typeof error.error === "string" &&
        error.error.trim()
    ) {
        return error.error.trim();
    }


    return mensajePredeterminado;
}


/* ============================================================
   TOAST
   ============================================================ */

function mostrarToastUsuarios(
    mensaje,
    tipo = "success"
) {

    if (window.mostrarToast) {

        window.mostrarToast(
            mensaje,
            tipo
        );

        return;
    }


    const contenedor = document.getElementById(
        "usuariosToastContainer"
    );


    if (!contenedor) {

        console.log(
            `[${tipo}] ${mensaje}`
        );

        return;
    }


    const toast = document.createElement("div");


    toast.className = `
        usuarios-toast
        usuarios-toast-${tipo}
    `;


    toast.innerHTML = `
        <div class="usuarios-toast-icon">
            ${tipo === "error" ? "!" : "✓"}
        </div>

        <div class="usuarios-toast-content">

            <strong>
                ${
                    tipo === "error"
                        ? "No se pudo completar la acción"
                        : "Operación realizada"
                }
            </strong>

            <p>
                ${escapeHtmlUsuario(mensaje)}
            </p>

        </div>
    `;


    contenedor.appendChild(toast);


    requestAnimationFrame(() => {
        toast.classList.add("show");
    });


    setTimeout(() => {

        toast.classList.remove("show");


        setTimeout(() => {
            toast.remove();
        }, 250);

    }, 4500);
}