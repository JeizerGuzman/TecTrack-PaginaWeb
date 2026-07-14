(() => {
    "use strict";

    const state = {
        programados: [],
        historial: [],
        tabActiva: "programados",
        cargando: false,
        timer: null,
        servicioEstadoId: null
    };


    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            configurarEventosServicios();


            await cargarServicios();


            const intervaloMs =
                await TrackConfig.obtenerAdminMs(
                    "servicios",
                    30
                );


            if (state.timer) {
                window.clearInterval(
                    state.timer
                );
            }


            state.timer =
                window.setInterval(
                    () => {

                        cargarServicios({
                            silencioso: true
                        });

                    },
                    intervaloMs
                );

        }
    );


    function configurarEventosServicios() {
        document
            .getElementById("btnAbrirModalServicio")
            ?.addEventListener("click", () => {
                window.ServiciosFormulario?.abrirNuevo();
            });

        document
            .querySelectorAll(".servicios-tab")
            .forEach(boton => {
                boton.addEventListener("click", () => {
                    cambiarTab(boton.dataset.tab);
                });
            });

        [
            "filtroBusquedaServicio",
            "filtroTipoServicio",
            "filtroEstadoServicio"
        ].forEach(id => {
            const elemento = document.getElementById(id);

            elemento?.addEventListener(
                id === "filtroBusquedaServicio" ? "input" : "change",
                aplicarFiltrosServicios
            );
        });

        document
            .getElementById("serviciosProgramadosLista")
            ?.addEventListener("click", manejarAccionProgramado);

        document
            .getElementById("serviciosHistorialLista")
            ?.addEventListener("click", manejarAccionHistorial);

        document
            .getElementById("btnCerrarModalDetalleServicio")
            ?.addEventListener("click", cerrarModalDetalleServicio);

        document
            .getElementById("btnCerrarDetalleServicioFooter")
            ?.addEventListener("click", cerrarModalDetalleServicio);

        document
            .getElementById("btnCerrarModalEstadoServicio")
            ?.addEventListener("click", cerrarModalEstadoServicio);

        document
            .getElementById("btnCancelarModalEstadoServicio")
            ?.addEventListener("click", cerrarModalEstadoServicio);

        document
            .getElementById("btnConfirmarEstadoServicio")
            ?.addEventListener("click", confirmarCambioEstado);

        document
            .getElementById("nuevoEstadoServicio")
            ?.addEventListener("change", actualizarDetalleEstado);
    }


    async function cargarServicios({ silencioso = false } = {}) {
        if (state.cargando) return;

        state.cargando = true;

        try {
            const response = await TrackAPI.obtenerAdminServicios();

            state.programados = Array.isArray(
                response.servicios_programados
            )
                ? response.servicios_programados
                : [];

            state.historial = Array.isArray(
                response.historial_real
            )
                ? response.historial_real
                : [];

            actualizarEstadisticas();
            cargarFiltroTipos();
            aplicarFiltrosServicios();

        } catch (error) {
            if (!silencioso) {
                mostrarToastServicios(
                    error.message || "No se pudieron cargar los servicios.",
                    "error"
                );
            }

        } finally {
            state.cargando = false;
        }
    }


    function cambiarTab(tab) {
        state.tabActiva = tab === "historial"
            ? "historial"
            : "programados";

        document
            .querySelectorAll(".servicios-tab")
            .forEach(boton => {
                boton.classList.toggle(
                    "active",
                    boton.dataset.tab === state.tabActiva
                );
            });

        document
            .getElementById("panelServiciosProgramados")
            ?.classList.toggle(
                "active",
                state.tabActiva === "programados"
            );

        document
            .getElementById("panelServiciosHistorial")
            ?.classList.toggle(
                "active",
                state.tabActiva === "historial"
            );

        document
            .getElementById("grupoFiltroEstadoServicio")
            ?.classList.toggle(
                "is-hidden",
                state.tabActiva === "historial"
            );

        aplicarFiltrosServicios();
    }


    function actualizarEstadisticas() {
        const total = state.programados.length;

        const pendientes = state.programados.filter(item =>
            ["pendiente", "asignado"].includes(item.estado)
        ).length;

        const proceso = state.programados.filter(
            item => item.estado === "en_proceso"
        ).length;

        const realizados = state.programados.filter(
            item => item.estado === "realizado"
        ).length;

        asignarTexto("statServiciosTotal", total);
        asignarTexto("statServiciosPendientes", pendientes);
        asignarTexto("statServiciosProceso", proceso);
        asignarTexto("statServiciosRealizados", realizados);
    }


    function cargarFiltroTipos() {
        const select = document.getElementById("filtroTipoServicio");
        if (!select) return;

        const valorActual = select.value || "todos";

        const tipos = new Set();

        [...state.programados, ...state.historial].forEach(item => {
            if (item.tipo) tipos.add(item.tipo);
        });

        select.innerHTML = `
            <option value="todos">Todos los tipos</option>
            ${Array.from(tipos)
                .sort()
                .map(tipo => `
                    <option value="${escapeHtml(tipo)}">
                        ${escapeHtml(formatearTipo(tipo))}
                    </option>
                `)
                .join("")}
        `;

        const existe = Array
            .from(select.options)
            .some(option => option.value === valorActual);

        select.value = existe
            ? valorActual
            : "todos";
    }


    function aplicarFiltrosServicios() {
        const busqueda = normalizarTexto(
            document.getElementById("filtroBusquedaServicio")?.value
        );

        const tipo = (
            document.getElementById("filtroTipoServicio")?.value
            || "todos"
        );

        const estado = (
            document.getElementById("filtroEstadoServicio")?.value
            || "todos"
        );

        if (state.tabActiva === "programados") {
            const filtrados = state.programados.filter(item => {
                const coincideBusqueda =
                    !busqueda
                    || normalizarTexto(item.empresa_nombre).includes(busqueda)
                    || normalizarTexto(item.vehiculo_nombre).includes(busqueda)
                    || normalizarTexto(item.vehiculo_placa).includes(busqueda)
                    || normalizarTexto(item.dispositivo_serie).includes(busqueda)
                    || normalizarTexto(item.tecnico_nombre).includes(busqueda)
                    || normalizarTexto(item.tipo).includes(busqueda);

                const coincideTipo =
                    tipo === "todos"
                    || item.tipo === tipo;

                const coincideEstado =
                    estado === "todos"
                    || item.estado === estado;

                return (
                    coincideBusqueda
                    && coincideTipo
                    && coincideEstado
                );
            });

            renderizarProgramados(filtrados);

        } else {
            const filtrados = state.historial.filter(item => {
                const coincideBusqueda =
                    !busqueda
                    || normalizarTexto(item.empresa_nombre).includes(busqueda)
                    || normalizarTexto(item.vehiculo_nombre).includes(busqueda)
                    || normalizarTexto(item.vehiculo_placa).includes(busqueda)
                    || normalizarTexto(item.dispositivo_serie).includes(busqueda)
                    || normalizarTexto(item.tipo).includes(busqueda);

                const coincideTipo =
                    tipo === "todos"
                    || item.tipo === tipo;

                return coincideBusqueda && coincideTipo;
            });

            renderizarHistorial(filtrados);
        }
    }


    function renderizarProgramados(items) {
        const contenedor = document.getElementById(
            "serviciosProgramadosLista"
        );

        const vacio = document.getElementById(
            "serviciosProgramadosVacio"
        );

        if (!contenedor || !vacio) return;

        if (!items.length) {
            contenedor.innerHTML = "";
            vacio.hidden = false;
            return;
        }

        vacio.hidden = true;

        contenedor.innerHTML = items
            .map(item => crearHtmlProgramado(item))
            .join("");
    }


    function renderizarHistorial(items) {
        const contenedor = document.getElementById(
            "serviciosHistorialLista"
        );

        const vacio = document.getElementById(
            "serviciosHistorialVacio"
        );

        if (!contenedor || !vacio) return;

        if (!items.length) {
            contenedor.innerHTML = "";
            vacio.hidden = false;
            return;
        }

        vacio.hidden = true;

        contenedor.innerHTML = items
            .map(item => crearHtmlHistorial(item))
            .join("");
    }


    function crearHtmlProgramado(item) {
        return `
            <article class="card servicio-card">

                <header class="servicio-card-header">

                    <div>
                        <span class="status-badge ${claseEstado(item.estado)}">
                            ${escapeHtml(formatearEstado(item.estado))}
                        </span>

                        <h2>${escapeHtml(formatearTipo(item.tipo))}</h2>

                        <p>${escapeHtml(item.empresa_nombre || "Empresa no disponible")}</p>
                    </div>

                    <div class="servicio-card-date">
                        <span>Programado</span>
                        <strong>${escapeHtml(formatearFecha(item.fecha_programada))}</strong>
                    </div>

                </header>


                <section class="servicio-card-info-grid">

                    <div>
                        <span>Vehículo</span>
                        <strong>
                            ${escapeHtml(item.vehiculo_nombre || "No asignado")}
                        </strong>
                    </div>

                    <div>
                        <span>Dispositivo</span>
                        <strong>
                            ${escapeHtml(item.dispositivo_serie || "No asignado")}
                        </strong>
                    </div>

                    <div>
                        <span>Técnico</span>
                        <strong>
                            ${escapeHtml(item.tecnico_nombre || "Sin técnico")}
                        </strong>
                    </div>

                    <div>
                        <span>Costo estimado</span>
                        <strong>${formatearMoneda(item.costo_estimado)}</strong>
                    </div>

                </section>


                <footer class="servicio-card-actions">

                    <button type="button"
                            class="btn btn-secondary"
                            data-action="detalle"
                            data-servicio-id="${item.id}">
                        Ver detalle
                    </button>

                    <button type="button"
                            class="btn btn-secondary"
                            data-action="editar"
                            data-servicio-id="${item.id}">
                        Editar
                    </button>

                    <button type="button"
                            class="btn btn-outline-primary"
                            data-action="estado"
                            data-servicio-id="${item.id}">
                        Cambiar estado
                    </button>

                </footer>

            </article>
        `;
    }


    function crearHtmlHistorial(item) {
        return `
            <article class="card servicio-card historial-card">

                <header class="servicio-card-header">

                    <div>
                        <span class="status-badge ${claseEstado(item.estado)}">
                            ${escapeHtml(formatearEstado(item.estado))}
                        </span>

                        <h2>${escapeHtml(formatearTipo(item.tipo))}</h2>

                        <p>${escapeHtml(item.empresa_nombre || "Empresa no disponible")}</p>
                    </div>

                    <div class="servicio-card-date">
                        <span>Registrado</span>
                        <strong>${escapeHtml(formatearFecha(item.timestamp))}</strong>
                    </div>

                </header>


                <section class="servicio-card-info-grid">

                    <div>
                        <span>Vehículo</span>
                        <strong>
                            ${escapeHtml(item.vehiculo_nombre || "No asignado")}
                        </strong>
                    </div>

                    <div>
                        <span>Dispositivo</span>
                        <strong>
                            ${escapeHtml(item.dispositivo_serie || "No asignado")}
                        </strong>
                    </div>

                    <div class="servicio-info-wide">
                        <span>Descripción</span>
                        <strong>
                            ${escapeHtml(item.descripcion || "Sin descripción")}
                        </strong>
                    </div>

                    <div>
                        <span>Costo</span>
                        <strong>${formatearMoneda(item.costo)}</strong>
                    </div>

                </section>

            </article>
        `;
    }


    async function manejarAccionProgramado(event) {
        const boton = event.target.closest(
            "[data-action][data-servicio-id]"
        );

        if (!boton) return;

        const servicioId = Number(boton.dataset.servicioId);
        const action = boton.dataset.action;

        if (!servicioId) return;

        if (action === "detalle") {
            abrirDetalleServicio(servicioId);
            return;
        }

        if (action === "editar") {
            await window.ServiciosFormulario?.abrirEditar(servicioId);
            return;
        }

        if (action === "estado") {
            abrirModalEstadoServicio(servicioId);
        }
    }


    function manejarAccionHistorial() {
        // El historial técnico es de solo consulta.
    }


    function abrirDetalleServicio(servicioId) {
        const item = state.programados.find(
            servicio => Number(servicio.id) === Number(servicioId)
        );

        if (!item) return;

        asignarTexto(
            "detalleServicioTipo",
            formatearTipo(item.tipo)
        );

        asignarTexto(
            "detalleServicioDescripcion",
            item.descripcion || "Sin descripción"
        );

        asignarTexto(
            "detalleServicioEmpresa",
            item.empresa_nombre || "-"
        );

        asignarTexto(
            "detalleServicioVehiculo",
            item.vehiculo_nombre || "-"
        );

        asignarTexto(
            "detalleServicioDispositivo",
            item.dispositivo_serie || "-"
        );

        asignarTexto(
            "detalleServicioTecnico",
            item.tecnico_nombre || "Sin técnico asignado"
        );

        asignarTexto(
            "detalleServicioFechaProgramada",
            formatearFecha(item.fecha_programada)
        );

        asignarTexto(
            "detalleServicioFechaInicio",
            formatearFecha(item.fecha_inicio)
        );

        asignarTexto(
            "detalleServicioFechaFinalizacion",
            formatearFecha(item.fecha_finalizacion)
        );

        asignarTexto(
            "detalleServicioCosto",
            formatearMoneda(item.costo_estimado)
        );

        const badge = document.getElementById(
            "detalleServicioEstado"
        );

        if (badge) {
            badge.className = (
                `status-badge ${claseEstado(item.estado)}`
            );

            badge.textContent = formatearEstado(item.estado);
        }

        mostrarModal("modalDetalleServicio");
    }


    function cerrarModalDetalleServicio() {
        ocultarModal("modalDetalleServicio");
    }


    function abrirModalEstadoServicio(servicioId) {
        const item = state.programados.find(
            servicio => Number(servicio.id) === Number(servicioId)
        );

        if (!item) {
            mostrarToastServicios(
                "No se encontró el servicio programado.",
                "error"
            );

            return;
        }

        state.servicioEstadoId = item.id;

        asignarTexto(
            "modalEstadoServicioMensaje",
            `${formatearTipo(item.tipo)} · ${item.empresa_nombre || "Sin empresa"}`
        );

        const select = document.getElementById(
            "nuevoEstadoServicio"
        );

        if (select) {
            select.value = item.estado || "pendiente";
        }

        actualizarDetalleEstado();
        mostrarModal("modalEstadoServicio");
    }


    function actualizarDetalleEstado() {
        const estado = document.getElementById(
            "nuevoEstadoServicio"
        )?.value;

        const detalle = document.getElementById(
            "modalEstadoServicioDetalle"
        );

        const icono = document.getElementById(
            "modalEstadoServicioIcon"
        );

        if (!detalle || !icono) return;

        icono.classList.remove(
            "is-success",
            "is-warning",
            "is-danger",
            "is-info"
        );

        const textos = {
            pendiente: (
                "El servicio quedará pendiente de asignación o preparación."
            ),

            asignado: (
                "El servicio quedará asignado. Debe tener un técnico seleccionado."
            ),

            en_proceso: (
                "El servicio comenzará su ejecución y se registrará la fecha de inicio."
            ),

            realizado: (
                "El servicio quedará finalizado y se registrará la fecha de finalización."
            ),

            cancelado: (
                "El servicio quedará cancelado y se conservará en el historial administrativo."
            )
        };

        detalle.textContent = textos[estado] || "";

        if (estado === "realizado") {
            icono.classList.add("is-success");
        } else if (estado === "cancelado") {
            icono.classList.add("is-danger");
        } else if (
            estado === "pendiente"
            || estado === "asignado"
        ) {
            icono.classList.add("is-warning");
        } else {
            icono.classList.add("is-info");
        }
    }


    async function confirmarCambioEstado() {
        const servicioId = state.servicioEstadoId;

        const estado = document.getElementById(
            "nuevoEstadoServicio"
        )?.value;

        if (!servicioId || !estado) return;

        const boton = document.getElementById(
            "btnConfirmarEstadoServicio"
        );

        bloquearBoton(
            boton,
            true,
            "Actualizando..."
        );

        try {
            const response = await TrackAPI.cambiarEstadoAdminServicioProgramado(
                servicioId,
                estado
            );

            mostrarToastServicios(
                response.mensaje || "Estado actualizado correctamente.",
                "success"
            );

            cerrarModalEstadoServicio();
            await cargarServicios({ silencioso: true });

        } catch (error) {
            mostrarToastServicios(
                error.message || "No se pudo actualizar el estado.",
                "error"
            );

        } finally {
            bloquearBoton(
                boton,
                false,
                "Actualizar estado"
            );
        }
    }


    function cerrarModalEstadoServicio() {
        ocultarModal("modalEstadoServicio");
        state.servicioEstadoId = null;
    }


    function formatearTipo(tipo) {
        const mapa = {
            instalacion: "Instalación",
            mantenimiento: "Mantenimiento",
            reparacion: "Reparación",
            cambio_dispositivo: "Cambio de dispositivo",
            retiro_dispositivo: "Retiro de dispositivo",
            diagnostico: "Diagnóstico",
            otro: "Otro"
        };

        return mapa[tipo] || capitalizar(
            String(tipo || "").replaceAll("_", " ")
        );
    }


    function formatearEstado(estado) {
        const mapa = {
            pendiente: "Pendiente",
            asignado: "Asignado",
            en_proceso: "En proceso",
            realizado: "Realizado",
            cancelado: "Cancelado",
            disponible: "Disponible",
            mantenimiento: "Mantenimiento",
            desactivado: "Desactivado"
        };

        return mapa[estado] || capitalizar(estado);
    }


    function claseEstado(estado) {
        const mapa = {
            pendiente: "status-warning",
            asignado: "status-blue",
            en_proceso: "status-purple",
            realizado: "status-active",
            cancelado: "status-danger",
            disponible: "status-blue",
            mantenimiento: "status-warning",
            desactivado: "status-gray"
        };

        return mapa[estado] || "status-gray";
    }


    function formatearFecha(timestamp) {
        const numero = Number(timestamp);

        if (!numero) return "-";

        const fecha = new Date(numero * 1000);

        if (Number.isNaN(fecha.getTime())) return "-";

        return new Intl.DateTimeFormat("es-MX", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(fecha);
    }


    function formatearMoneda(valor) {
        const numero = Number(valor || 0);

        return new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 2
        }).format(numero);
    }


    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }


    function capitalizar(valor) {
        const texto = String(valor || "");
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }


    function escapeHtml(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function asignarTexto(id, valor) {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = valor;
        }
    }


    function bloquearBoton(boton, bloquear, texto) {
        if (!boton) return;

        boton.disabled = bloquear;
        boton.textContent = texto;
    }


    function mostrarModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }


    function ocultarModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;

        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");

        if (!document.querySelector(".modal-backdrop.show")) {
            document.body.classList.remove("modal-open");
        }
    }


    function mostrarToastServicios(mensaje, tipo = "info") {
        const contenedor = document.getElementById(
            "serviciosToastContainer"
        );

        if (!contenedor) return;

        const toast = document.createElement("div");

        toast.className = `servicios-toast toast-${tipo}`;
        toast.textContent = mensaje;

        contenedor.appendChild(toast);

        window.setTimeout(() => {
            toast.classList.add("is-hiding");

            window.setTimeout(() => {
                toast.remove();
            }, 250);
        }, 3500);
    }


    window.ServiciosAdmin = {
        recargar: () => cargarServicios({
            silencioso: true
        }),
        mostrarToast: mostrarToastServicios,
        mostrarModal,
        ocultarModal,
        escapar: escapeHtml,
        moneda: formatearMoneda
    };
})();
