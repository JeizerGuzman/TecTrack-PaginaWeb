let dispositivosOriginales = [];
let planesModelo = [];
let dispositivosTimer = null;
let dispositivosCargando = false;
let dispositivoEditandoId = null;
let dispositivoEstadoSeleccionado = null;


document.addEventListener("DOMContentLoaded", async () => {

    if (window.TrackGuards?.requireAuth) {
        const autorizado = await TrackGuards.requireAuth("admin");

        if (!autorizado) {
            return;
        }
    }


    configurarEventosDispositivos();


    await cargarPlanesModelo();

    await cargarDispositivos();


    const intervaloMs =
        await TrackConfig.obtenerAdminMs(
            "dispositivos",
            10
        );


    if (dispositivosTimer) {
        clearInterval(
            dispositivosTimer
        );
    }


    dispositivosTimer = setInterval(
        cargarDispositivos,
        intervaloMs
    );

});

function configurarEventosDispositivos() {
    document.getElementById("buscarDispositivo")?.addEventListener("input", aplicarFiltrosDispositivos);
    document.getElementById("filtroEstadoDispositivo")?.addEventListener("change", aplicarFiltrosDispositivos);

    document.getElementById("btnAbrirModalDispositivo")?.addEventListener("click", abrirModalNuevoDispositivo);
    document.getElementById("btnCerrarModalDispositivo")?.addEventListener("click", cerrarModalDispositivo);
    document.getElementById("btnCancelarDispositivo")?.addEventListener("click", cerrarModalDispositivo);
    document.getElementById("btnRegenerarDatosDispositivo")?.addEventListener("click", generarDatosDispositivo);
    document.getElementById("formDispositivo")?.addEventListener("submit", guardarDispositivo);

    document.getElementById("btnCerrarModalEstadoDispositivo")?.addEventListener("click", cerrarModalEstadoDispositivo);
    document.getElementById("btnCancelarEstadoDispositivo")?.addEventListener("click", cerrarModalEstadoDispositivo);
    document.getElementById("btnConfirmarEstadoDispositivo")?.addEventListener("click", confirmarCambioEstadoDispositivo);

    // Importante:
    // No agregamos evento al backdrop.
    // El modal NO debe cerrarse al hacer clic fuera.
}

async function cargarPlanesModelo() {
    const select = document.getElementById("dispositivoModelo");
    if (!select) return;

    try {
        const data = await TrackAPI.obtenerAdminPlanesOpciones();

        planesModelo = data.planes || [];

        if (!planesModelo.length) {
            select.innerHTML = `
                <option value="">No hay planes disponibles</option>
            `;
            return;
        }

        select.innerHTML = `
            <option value="">Selecciona un modelo</option>
            ${planesModelo.map(plan => `
                <option value="${escapeHtml(plan.nombre)}">
                    ${escapeHtml(plan.nombre)}
                </option>
            `).join("")}
        `;

    } catch (error) {
        console.error("Error cargando planes/modelos:", error);

        select.innerHTML = `
            <option value="">Error al cargar modelos</option>
        `;

        mostrarToastDispositivos(
            "No se pudieron cargar los modelos desde planes.",
            "error"
        );
    }
}

async function cargarDispositivos() {
    if (dispositivosCargando) return;

    dispositivosCargando = true;

    try {
        const data = await TrackAPI.obtenerAdminDispositivos();

        dispositivosOriginales = data.dispositivos || [];

        actualizarStatsDispositivos(dispositivosOriginales);
        aplicarFiltrosDispositivos();
        actualizarTextoActualizacion();

    } catch (error) {
        console.error("Error cargando dispositivos:", error);

        const listado = document.getElementById("dispositivosListado");

        if (listado) {
            listado.innerHTML = `
                <div class="empty-state">
                    <strong>No se pudieron cargar los dispositivos</strong>
                    <p>${escapeHtml(error.message || "Error desconocido")}</p>
                </div>
            `;
        }
    } finally {
        dispositivosCargando = false;
    }
}

function actualizarStatsDispositivos(dispositivos) {
    const total = dispositivos.length;

    const disponibles = dispositivos.filter(d => d.estado === "disponible").length;

    const instalados = dispositivos.filter(d => {
        return d.estado === "activo" || d.estado === "instalado";
    }).length;

    const mantenimiento = dispositivos.filter(d => d.estado === "mantenimiento").length;

    setText("statDispositivosTotal", total);
    setText("statDispositivosDisponibles", disponibles);
    setText("statDispositivosInstalados", instalados);
    setText("statDispositivosMantenimiento", mantenimiento);
}

function aplicarFiltrosDispositivos() {
    const texto = normalizar(document.getElementById("buscarDispositivo")?.value || "");
    const estado = document.getElementById("filtroEstadoDispositivo")?.value || "todos";

    let filtrados = [...dispositivosOriginales];

    if (texto) {
        filtrados = filtrados.filter(dispositivo => {
            const base = normalizar([
                dispositivo.serie,
                dispositivo.imei,
                dispositivo.modelo,
                dispositivo.firmware,
                dispositivo.estado,
                dispositivo.empresa_nombre,
                dispositivo.vehiculo_nombre,
                dispositivo.vehiculo_identificador
            ].join(" "));

            return base.includes(texto);
        });
    }

    if (estado !== "todos") {
        filtrados = filtrados.filter(d => d.estado === estado);
    }

    renderDispositivos(filtrados);
}

function renderDispositivos(dispositivos) {
    const listado = document.getElementById("dispositivosListado");
    if (!listado) return;

    if (!dispositivos.length) {
        listado.innerHTML = `
            <div class="empty-state">
                <strong>No hay dispositivos para mostrar</strong>
                <p>No se encontraron dispositivos con los filtros seleccionados.</p>
            </div>
        `;
        return;
    }

    listado.innerHTML = dispositivos.map(dispositivo => {
        const estado = dispositivo.estado || "sin_estado";

        return `
            <article class="dispositivo-card ${estado === "desactivado" ? "desactivado" : ""}">
                <div class="dispositivo-main">
                    <div class="dispositivo-title-row">
                        <div>
                            <h3>${escapeHtml(dispositivo.serie || "Sin serie")}</h3>
                            <p>PIN: ${escapeHtml(dispositivo.pin_activacion || "Sin PIN")}</p>
                        </div>

                        <div class="dispositivo-badges">
                            <span class="badge ${claseBadgeEstado(estado)}">
                                ${escapeHtml(formatearEstadoDispositivo(estado))}
                            </span>

                            <span class="badge badge-muted">
                                ${escapeHtml(dispositivo.modelo || "Sin modelo")}
                            </span>
                        </div>
                    </div>

                    <div class="dispositivo-meta">
                        <span>IMEI: ${escapeHtml(dispositivo.imei || "No registrado")}</span>
                        <span>Firmware: ${escapeHtml(dispositivo.firmware || "Sin firmware")}</span>
                        <span>Empresa: ${escapeHtml(dispositivo.empresa_nombre || "Sin empresa")}</span>
                        <span>Vehículo: ${escapeHtml(dispositivo.vehiculo_nombre || "Sin vehículo")}</span>
                    </div>
                </div>

                <div class="dispositivo-actions">
                    <button type="button" class="btn btn-outline btn-sm btn-editar-dispositivo" data-id="${dispositivo.id}">
                        Editar
                    </button>

                    <button type="button" class="btn btn-primary btn-sm btn-estado-dispositivo" data-id="${dispositivo.id}">
                        Estado
                    </button>
                </div>
            </article>
        `;
    }).join("");

    bindAccionesDispositivos();
}

function bindAccionesDispositivos() {
    document.querySelectorAll(".btn-editar-dispositivo").forEach(btn => {
        btn.addEventListener("click", () => {
            abrirModalEditarDispositivo(Number(btn.dataset.id));
        });
    });

    document.querySelectorAll(".btn-estado-dispositivo").forEach(btn => {
        btn.addEventListener("click", () => {
            abrirModalEstadoDispositivo(Number(btn.dataset.id));
        });
    });
}

async function abrirModalNuevoDispositivo() {
    dispositivoEditandoId = null;

    setText("modalDispositivoTitulo", "Nuevo dispositivo");
    setText("modalDispositivoSubtitulo", "Genera un dispositivo disponible para instalación.");
    setText("btnGuardarDispositivo", "Guardar dispositivo");

    limpiarFormularioDispositivo();

    document.getElementById("dispositivoSerie").disabled = false;
    document.getElementById("dispositivoModelo").disabled = false;
    document.getElementById("btnRegenerarDatosDispositivo").style.display = "inline-flex";

    document.getElementById("modalDispositivo")?.classList.add("visible");

    await generarDatosDispositivo();
}

function abrirModalEditarDispositivo(dispositivoId) {
    const dispositivo = dispositivosOriginales.find(d => Number(d.id) === Number(dispositivoId));

    if (!dispositivo) {
        mostrarToastDispositivos("No se encontró el dispositivo seleccionado.", "error");
        return;
    }

    dispositivoEditandoId = dispositivo.id;

    setText("modalDispositivoTitulo", "Editar dispositivo");
    setText("modalDispositivoSubtitulo", "Actualiza los datos técnicos del dispositivo.");
    setText("btnGuardarDispositivo", "Guardar cambios");

    document.getElementById("dispositivoId").value = dispositivo.id;
    document.getElementById("dispositivoSerie").value = dispositivo.serie || "";
    document.getElementById("dispositivoPin").value = dispositivo.pin_activacion || "";
    const selectModelo = document.getElementById("dispositivoModelo");
    selectModelo.value = dispositivo.modelo || "";

    if (dispositivo.modelo && selectModelo.value !== dispositivo.modelo) {
        const option = document.createElement("option");
        option.value = dispositivo.modelo;
        option.textContent = `${dispositivo.modelo} (modelo anterior)`;
        option.selected = true;
        selectModelo.appendChild(option);
    }
    document.getElementById("dispositivoFirmware").value = dispositivo.firmware || "";
    document.getElementById("dispositivoImei").value = dispositivo.imei || "";

    // La serie no se edita para evitar inconsistencias con ESP32.
    document.getElementById("dispositivoSerie").disabled = true;
    document.getElementById("btnRegenerarDatosDispositivo").style.display = "none";

    document.getElementById("modalDispositivo")?.classList.add("visible");
}

async function generarDatosDispositivo() {
    if (dispositivoEditandoId) return;

    try {
        const data = await TrackAPI.generarAdminDispositivo();

        document.getElementById("dispositivoSerie").value = data.serie || "";
        document.getElementById("dispositivoPin").value = data.pin_activacion || "";

    } catch (error) {
        console.error("Error generando datos:", error);
        mostrarToastDispositivos(error.message || "No se pudieron generar serie y PIN.", "error");
    }
}

function cerrarModalDispositivo() {
    dispositivoEditandoId = null;
    limpiarFormularioDispositivo();

    const modal = document.getElementById("modalDispositivo");
    const btn = document.getElementById("btnGuardarDispositivo");

    if (modal) modal.classList.remove("visible");

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar dispositivo";
    }
}

function limpiarFormularioDispositivo() {
    document.getElementById("dispositivoId").value = "";
    document.getElementById("dispositivoSerie").value = "";
    document.getElementById("dispositivoPin").value = "";
    document.getElementById("dispositivoModelo").value = "";
    document.getElementById("dispositivoFirmware").value = "";
    document.getElementById("dispositivoImei").value = "";
}

async function guardarDispositivo(event) {
    event.preventDefault();

    const btn = document.getElementById("btnGuardarDispositivo");

    const data = {
        serie: document.getElementById("dispositivoSerie")?.value.trim(),
        pin_activacion: document.getElementById("dispositivoPin")?.value.trim(),
        modelo: document.getElementById("dispositivoModelo")?.value.trim(),
        firmware: document.getElementById("dispositivoFirmware")?.value.trim(),
        imei: document.getElementById("dispositivoImei")?.value.trim(),
    };

    if (!data.serie) {
        mostrarToastDispositivos("La serie es requerida.", "error");
        return;
    }

    if (!data.pin_activacion) {
        mostrarToastDispositivos("El PIN de activación es requerido.", "error");
        return;
    }

    btn.disabled = true;
    btn.textContent = dispositivoEditandoId ? "Guardando..." : "Creando...";

    try {
        if (dispositivoEditandoId) {
            await TrackAPI.editarAdminDispositivo(dispositivoEditandoId, data);
            mostrarToastDispositivos("Dispositivo actualizado correctamente.", "success");
        } else {
            await TrackAPI.crearAdminDispositivo(data);
            mostrarToastDispositivos("Dispositivo creado correctamente.", "success");
        }

        cerrarModalDispositivo();
        await cargarDispositivos();

    } catch (error) {
        console.error("Error guardando dispositivo:", error);
        mostrarToastDispositivos(error.message || "No se pudo guardar el dispositivo.", "error");

        btn.disabled = false;
        btn.textContent = dispositivoEditandoId ? "Guardar cambios" : "Guardar dispositivo";
    }
}

function abrirModalEstadoDispositivo(dispositivoId) {
    const dispositivo = dispositivosOriginales.find(d => Number(d.id) === Number(dispositivoId));

    if (!dispositivo) {
        mostrarToastDispositivos("No se encontró el dispositivo seleccionado.", "error");
        return;
    }

    dispositivoEstadoSeleccionado = dispositivo;

    setText(
        "modalEstadoDispositivoDescripcion",
        `Cambia el estado del dispositivo ${dispositivo.serie}.`
    );

    document.getElementById("nuevoEstadoDispositivo").value = dispositivo.estado || "disponible";
    document.getElementById("modalEstadoDispositivo")?.classList.add("visible");
}

function cerrarModalEstadoDispositivo() {
    dispositivoEstadoSeleccionado = null;

    const modal = document.getElementById("modalEstadoDispositivo");
    const btn = document.getElementById("btnConfirmarEstadoDispositivo");

    if (modal) modal.classList.remove("visible");

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar estado";
    }
}

async function confirmarCambioEstadoDispositivo() {
    if (!dispositivoEstadoSeleccionado) return;

    const btn = document.getElementById("btnConfirmarEstadoDispositivo");
    const estado = document.getElementById("nuevoEstadoDispositivo")?.value;

    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
        await TrackAPI.cambiarEstadoAdminDispositivo(
            dispositivoEstadoSeleccionado.id,
            estado
        );

        mostrarToastDispositivos("Estado actualizado correctamente.", "success");

        cerrarModalEstadoDispositivo();
        await cargarDispositivos();

    } catch (error) {
        console.error("Error cambiando estado:", error);
        mostrarToastDispositivos(error.message || "No se pudo cambiar el estado.", "error");

        btn.disabled = false;
        btn.textContent = "Guardar estado";
    }
}

function actualizarTextoActualizacion() {
    const ahora = new Date();

    setText("dispositivosActualizacion", `Actualizado ${ahora.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })}`);
}

function claseBadgeEstado(estado) {
    if (estado === "disponible") return "badge-success";
    if (estado === "activo" || estado === "instalado") return "badge-primary";
    if (estado === "mantenimiento") return "badge-warning";
    if (estado === "desactivado") return "badge-muted";

    return "badge-muted";
}

function formatearEstadoDispositivo(estado) {
    const mapa = {
        disponible: "Disponible",
        activo: "Activo",
        instalado: "Instalado",
        mantenimiento: "Mantenimiento",
        desactivado: "Desactivado",
        sin_estado: "Sin estado",
    };

    return mapa[estado] || "Sin estado";
}

function mostrarToastDispositivos(mensaje, tipo = "info") {
    let toast = document.getElementById("dispositivosToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "dispositivosToast";
        toast.className = "dispositivos-toast";
        document.body.appendChild(toast);
    }

    toast.textContent = mensaje;
    toast.className = `dispositivos-toast ${tipo} visible`;

    setTimeout(() => {
        toast.classList.remove("visible");
    }, 3000);
}

function normalizar(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(valor) {
    return String(valor ?? "")
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

window.addEventListener("beforeunload", () => {
    if (dispositivosTimer) {
        clearInterval(dispositivosTimer);
    }
});