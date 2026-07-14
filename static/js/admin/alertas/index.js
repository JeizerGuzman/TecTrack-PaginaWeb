(() => {
    "use strict";

    const state = {
        alertasOriginales: [],
        cargando: false,
        timer: null,
        alertaAtenderId: null
    };


    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            configurarEventosAlertas();


            await cargarAlertas();


            const intervaloMs =
                await TrackConfig.obtenerAdminMs(
                    "alertas",
                    5
                );


            if (state.timer) {
                window.clearInterval(
                    state.timer
                );
            }


            state.timer =
                window.setInterval(
                    () => {

                        cargarAlertas({
                            silencioso: true
                        });

                    },
                    intervaloMs
                );

        }
    );


    function configurarEventosAlertas() {
        [
            "filtroBusquedaAlerta",
            "filtroTipoAlerta",
            "filtroNivelAlerta",
            "filtroEstadoAlerta"
        ].forEach(id => {
            const elemento = document.getElementById(id);

            elemento?.addEventListener(
                id === "filtroBusquedaAlerta" ? "input" : "change",
                aplicarFiltrosAlertas
            );
        });

        document
            .getElementById("alertasLista")
            ?.addEventListener("click", manejarAccionAlerta);

        document
            .getElementById("btnCerrarModalDetalleAlerta")
            ?.addEventListener("click", cerrarModalDetalleAlerta);

        document
            .getElementById("btnCerrarDetalleAlertaFooter")
            ?.addEventListener("click", cerrarModalDetalleAlerta);

        document
            .getElementById("btnCerrarModalAtenderAlerta")
            ?.addEventListener("click", cerrarModalAtenderAlerta);

        document
            .getElementById("btnCancelarModalAtenderAlerta")
            ?.addEventListener("click", cerrarModalAtenderAlerta);

        document
            .getElementById("btnConfirmarAtenderAlerta")
            ?.addEventListener("click", confirmarAtenderAlerta);
    }


    async function cargarAlertas({ silencioso = false } = {}) {
        if (state.cargando) return;

        state.cargando = true;

        try {
            const response = await TrackAPI.obtenerAdminAlertas();

            state.alertasOriginales = Array.isArray(response.alertas)
                ? response.alertas
                : [];

            actualizarEstadisticas();
            cargarFiltroTipos();
            aplicarFiltrosAlertas();

        } catch (error) {
            if (!silencioso) {
                mostrarToastAlertas(
                    error.message || "No se pudieron cargar las alertas.",
                    "error"
                );
            }

        } finally {
            state.cargando = false;
        }
    }


    function actualizarEstadisticas() {
        const total = state.alertasOriginales.length;

        const pendientes = state.alertasOriginales.filter(
            item => !item.atendida
        ).length;

        const criticas = state.alertasOriginales.filter(
            item => item.nivel === "critico"
        ).length;

        const atendidas = state.alertasOriginales.filter(
            item => item.atendida
        ).length;

        asignarTexto("statAlertasTotal", total);
        asignarTexto("statAlertasPendientes", pendientes);
        asignarTexto("statAlertasCriticas", criticas);
        asignarTexto("statAlertasAtendidas", atendidas);
    }


    function cargarFiltroTipos() {
        const select = document.getElementById("filtroTipoAlerta");
        if (!select) return;

        const valorActual = select.value || "todos";

        const tipos = Array.from(
            new Set(
                state.alertasOriginales
                    .map(item => item.tipo)
                    .filter(Boolean)
            )
        ).sort();

        select.innerHTML = `
            <option value="todos">Todos los tipos</option>

            ${tipos.map(tipo => `
                <option value="${escapeHtml(tipo)}">
                    ${escapeHtml(formatearTipo(tipo))}
                </option>
            `).join("")}
        `;

        const existe = Array
            .from(select.options)
            .some(option => option.value === valorActual);

        select.value = existe
            ? valorActual
            : "todos";
    }


    function aplicarFiltrosAlertas() {
        const busqueda = normalizarTexto(
            document.getElementById("filtroBusquedaAlerta")?.value
        );

        const tipo = (
            document.getElementById("filtroTipoAlerta")?.value
            || "todos"
        );

        const nivel = (
            document.getElementById("filtroNivelAlerta")?.value
            || "todos"
        );

        const estado = (
            document.getElementById("filtroEstadoAlerta")?.value
            || "todos"
        );

        const filtradas = state.alertasOriginales.filter(item => {
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

            const coincideNivel =
                nivel === "todos"
                || item.nivel === nivel;

            const coincideEstado =
                estado === "todos"
                || (
                    estado === "atendida"
                    && item.atendida
                )
                || (
                    estado === "pendiente"
                    && !item.atendida
                );

            return (
                coincideBusqueda
                && coincideTipo
                && coincideNivel
                && coincideEstado
            );
        });

        renderizarAlertas(filtradas);
    }


    function renderizarAlertas(alertas) {
        const contenedor = document.getElementById("alertasLista");
        const vacio = document.getElementById("alertasEstadoVacio");

        if (!contenedor || !vacio) return;

        if (!alertas.length) {
            contenedor.innerHTML = "";
            vacio.hidden = false;
            return;
        }

        vacio.hidden = true;

        contenedor.innerHTML = alertas
            .map(item => crearHtmlAlerta(item))
            .join("");
    }


    function crearHtmlAlerta(item) {
        const estadoClase = item.atendida
            ? "status-active"
            : "status-warning";

        return `
            <article class="card alerta-card">

                <header class="alerta-card-header">

                    <div>
                        <div class="alerta-card-badges">
                            <span class="status-badge ${estadoClase}">
                                ${item.atendida ? "Atendida" : "Pendiente"}
                            </span>

                            <span class="status-badge ${claseNivel(item.nivel)}">
                                ${escapeHtml(formatearNivel(item.nivel))}
                            </span>
                        </div>

                        <h2>${escapeHtml(formatearTipo(item.tipo))}</h2>

                        <p>
                            ${escapeHtml(item.descripcion || "Sin descripción")}
                        </p>
                    </div>

                    <div class="alerta-card-date">
                        <span>Generada</span>
                        <strong>
                            ${escapeHtml(formatearFecha(item.timestamp))}
                        </strong>
                    </div>

                </header>


                <section class="alerta-card-info-grid">

                    <div>
                        <span>Empresa</span>
                        <strong>
                            ${escapeHtml(item.empresa_nombre || "No disponible")}
                        </strong>
                    </div>

                    <div>
                        <span>Vehículo</span>
                        <strong>
                            ${escapeHtml(item.vehiculo_nombre || "No disponible")}
                        </strong>
                    </div>

                    <div>
                        <span>Placa</span>
                        <strong>
                            ${escapeHtml(item.vehiculo_placa || "-")}
                        </strong>
                    </div>

                    <div>
                        <span>Dispositivo</span>
                        <strong>
                            ${escapeHtml(item.dispositivo_serie || "-")}
                        </strong>
                    </div>

                </section>


                <footer class="alerta-card-actions">

                    <button type="button"
                            class="btn btn-secondary"
                            data-action="detalle"
                            data-alerta-id="${item.id}">
                        Ver detalle
                    </button>

                    <a href="/admin/vehiculos/${item.vehiculo_id}"
                       class="btn btn-secondary">
                        Ver vehículo
                    </a>

                    ${
                        item.atendida
                            ? `
                                <button type="button"
                                        class="btn btn-success-soft"
                                        disabled>
                                    Atendida
                                </button>
                            `
                            : `
                                <button type="button"
                                        class="btn btn-primary"
                                        data-action="atender"
                                        data-alerta-id="${item.id}">
                                    Atender
                                </button>
                            `
                    }

                </footer>

            </article>
        `;
    }


    async function manejarAccionAlerta(event) {
        const boton = event.target.closest(
            "[data-action][data-alerta-id]"
        );

        if (!boton) return;

        const alertaId = Number(boton.dataset.alertaId);
        const action = boton.dataset.action;

        if (!alertaId) return;

        if (action === "detalle") {
            abrirDetalleAlerta(alertaId);
            return;
        }

        if (action === "atender") {
            abrirModalAtenderAlerta(alertaId);
        }
    }


    function abrirDetalleAlerta(alertaId) {
        const alerta = state.alertasOriginales.find(
            item => Number(item.id) === Number(alertaId)
        );

        if (!alerta) return;

        asignarTexto(
            "detalleAlertaTipo",
            formatearTipo(alerta.tipo)
        );

        asignarTexto(
            "detalleAlertaDescripcion",
            alerta.descripcion || "Sin descripción"
        );

        asignarTexto(
            "detalleAlertaEmpresa",
            alerta.empresa_nombre || "-"
        );

        asignarTexto(
            "detalleAlertaVehiculo",
            alerta.vehiculo_nombre || "-"
        );

        asignarTexto(
            "detalleAlertaPlaca",
            alerta.vehiculo_placa || "-"
        );

        asignarTexto(
            "detalleAlertaDispositivo",
            alerta.dispositivo_serie || "-"
        );

        asignarTexto(
            "detalleAlertaFecha",
            formatearFecha(alerta.timestamp)
        );

        asignarTexto(
            "detalleAlertaUltimaActualizacion",
            formatearFecha(alerta.ultima_actualizacion)
        );

        asignarTexto(
            "detalleAlertaAtendidaPor",
            alerta.atendida_por_nombre || "-"
        );

        asignarTexto(
            "detalleAlertaFechaAtencion",
            formatearFecha(alerta.fecha_atencion)
        );

        asignarTexto(
            "detalleAlertaUbicacion",
            formatearUbicacion(alerta.lat, alerta.lng)
        );

        const estado = document.getElementById("detalleAlertaEstado");
        const nivel = document.getElementById("detalleAlertaNivel");

        if (estado) {
            estado.className = (
                `status-badge ${
                    alerta.atendida
                        ? "status-active"
                        : "status-warning"
                }`
            );

            estado.textContent = alerta.atendida
                ? "Atendida"
                : "Pendiente";
        }

        if (nivel) {
            nivel.className = (
                `status-badge ${claseNivel(alerta.nivel)}`
            );

            nivel.textContent = formatearNivel(alerta.nivel);
        }

        mostrarModal("modalDetalleAlerta");
    }


    function cerrarModalDetalleAlerta() {
        ocultarModal("modalDetalleAlerta");
    }


    function abrirModalAtenderAlerta(alertaId) {
        const alerta = state.alertasOriginales.find(
            item => Number(item.id) === Number(alertaId)
        );

        if (!alerta) {
            mostrarToastAlertas(
                "No se encontró la alerta.",
                "error"
            );

            return;
        }

        if (alerta.atendida) {
            mostrarToastAlertas(
                "La alerta ya se encuentra atendida.",
                "info"
            );

            return;
        }

        state.alertaAtenderId = alerta.id;

        asignarTexto(
            "modalAtenderAlertaMensaje",
            `¿Estás seguro de que deseas atender la alerta de ${formatearTipo(alerta.tipo)}?`
        );

        asignarTexto(
            "modalAtenderAlertaDetalle",
            `${alerta.empresa_nombre || "Empresa no disponible"} · ${alerta.vehiculo_nombre || "Vehículo no disponible"}`
        );

        mostrarModal("modalAtenderAlerta");
    }


    async function confirmarAtenderAlerta() {
        const alertaId = state.alertaAtenderId;

        if (!alertaId) return;

        const boton = document.getElementById(
            "btnConfirmarAtenderAlerta"
        );

        bloquearBoton(
            boton,
            true,
            "Atendiendo..."
        );

        try {
            const response = await TrackAPI.atenderAdminAlerta(
                alertaId
            );

            mostrarToastAlertas(
                response.mensaje || "Alerta atendida correctamente.",
                "success"
            );

            cerrarModalAtenderAlerta();
            await cargarAlertas({ silencioso: true });

        } catch (error) {
            mostrarToastAlertas(
                error.message || "No se pudo atender la alerta.",
                "error"
            );

        } finally {
            bloquearBoton(
                boton,
                false,
                "Atender alerta"
            );
        }
    }


    function cerrarModalAtenderAlerta() {
        ocultarModal("modalAtenderAlerta");
        state.alertaAtenderId = null;
    }


    function formatearTipo(tipo) {
        const mapa = {
            panico: "Pánico",
            puerta_abierta: "Puerta abierta",
            vibracion: "Vibración",
            sin_senal: "Sin señal",
            gps_perdido: "GPS perdido"
        };

        return mapa[tipo] || capitalizar(
            String(tipo || "").replaceAll("_", " ")
        );
    }


    function formatearNivel(nivel) {
        const mapa = {
            bajo: "Bajo",
            medio: "Medio",
            alto: "Alto",
            critico: "Crítico"
        };

        return mapa[nivel] || capitalizar(nivel);
    }


    function claseNivel(nivel) {
        const mapa = {
            bajo: "status-blue",
            medio: "status-warning",
            alto: "status-orange",
            critico: "status-danger"
        };

        return mapa[nivel] || "status-gray";
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


    function formatearUbicacion(lat, lng) {
        const latitud = Number(lat);
        const longitud = Number(lng);

        if (
            !Number.isFinite(latitud)
            || !Number.isFinite(longitud)
        ) {
            return "Sin ubicación disponible";
        }

        return `${latitud.toFixed(6)}, ${longitud.toFixed(6)}`;
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


    function mostrarToastAlertas(mensaje, tipo = "info") {
        const contenedor = document.getElementById(
            "alertasToastContainer"
        );

        if (!contenedor) return;

        const toast = document.createElement("div");

        toast.className = `alertas-toast toast-${tipo}`;
        toast.textContent = mensaje;

        contenedor.appendChild(toast);

        window.setTimeout(() => {
            toast.classList.add("is-hiding");

            window.setTimeout(() => {
                toast.remove();
            }, 250);
        }, 3500);
    }
})();
