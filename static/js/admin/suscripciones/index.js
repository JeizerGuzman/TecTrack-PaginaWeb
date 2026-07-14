(() => {
    "use strict";

    const state = {
        suscripcionesOriginales: [],
        planes: [],
        cargando: false,
        timer: null,
        suscripcionEstadoId: null
    };


    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            configurarEventosSuscripciones();


            await cargarSuscripciones();


            const intervaloMs =
                await TrackConfig.obtenerAdminMs(
                    "suscripciones",
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

                        cargarSuscripciones({
                            silencioso: true
                        });

                    },
                    intervaloMs
                );

        }
    );


    function configurarEventosSuscripciones() {
        document
            .getElementById("btnAbrirModalSuscripcion")
            ?.addEventListener("click", () => {
                window.SuscripcionesFormulario?.abrirNueva();
            });

        document
            .getElementById("filtroBusquedaSuscripcion")
            ?.addEventListener("input", aplicarFiltrosSuscripciones);

        document
            .getElementById("filtroPlanSuscripcion")
            ?.addEventListener("change", aplicarFiltrosSuscripciones);

        document
            .getElementById("filtroEstadoSuscripcion")
            ?.addEventListener("change", aplicarFiltrosSuscripciones);

        document
            .getElementById("suscripcionesLista")
            ?.addEventListener("click", manejarAccionSuscripcion);

        document
            .getElementById("btnCerrarModalEstadoSuscripcion")
            ?.addEventListener("click", cerrarModalEstadoSuscripcion);

        document
            .getElementById("btnCancelarModalEstadoSuscripcion")
            ?.addEventListener("click", cerrarModalEstadoSuscripcion);

        document
            .getElementById("btnConfirmarEstadoSuscripcion")
            ?.addEventListener("click", confirmarCambioEstadoSuscripcion);

        document
            .getElementById("nuevoEstadoSuscripcion")
            ?.addEventListener("change", actualizarDetalleEstado);
    }


    async function cargarSuscripciones({ silencioso = false } = {}) {
        if (state.cargando) return;

        state.cargando = true;

        try {
            const response = await TrackAPI.obtenerAdminSuscripciones();

            state.suscripcionesOriginales = Array.isArray(response.suscripciones)
                ? response.suscripciones
                : [];

            cargarOpcionesFiltroPlanes();
            actualizarEstadisticasSuscripciones();
            aplicarFiltrosSuscripciones();

        } catch (error) {
            if (!silencioso) {
                mostrarToastSuscripciones(
                    error.message || "No se pudieron cargar las suscripciones.",
                    "error"
                );
            }

        } finally {
            state.cargando = false;
        }
    }


    function cargarOpcionesFiltroPlanes() {
        const select = document.getElementById("filtroPlanSuscripcion");
        if (!select) return;

        const valorActual = select.value || "todos";

        const planesMap = new Map();

        state.suscripcionesOriginales.forEach(suscripcion => {
            if (suscripcion.plan_id && suscripcion.plan_nombre) {
                planesMap.set(
                    String(suscripcion.plan_id),
                    suscripcion.plan_nombre
                );
            }
        });

        const opciones = Array
            .from(planesMap.entries())
            .sort((a, b) => a[1].localeCompare(b[1], "es"));

        select.innerHTML = `
            <option value="todos">Todos los planes</option>
            ${opciones.map(([id, nombre]) => `
                <option value="${id}">
                    ${escapeHtml(nombre)}
                </option>
            `).join("")}
        `;

        const sigueDisponible = Array
            .from(select.options)
            .some(option => option.value === valorActual);

        select.value = sigueDisponible
            ? valorActual
            : "todos";
    }


    function actualizarEstadisticasSuscripciones() {
        const total = state.suscripcionesOriginales.length;

        const activas = state.suscripcionesOriginales.filter(
            item => item.estado === "activa"
        );

        const noActivas = total - activas.length;

        const montoMensual = activas.reduce(
            (acumulado, item) =>
                acumulado + Number(item.monto_mensual || 0),
            0
        );

        asignarTexto("statSuscripcionesTotal", total);
        asignarTexto("statSuscripcionesActivas", activas.length);
        asignarTexto("statSuscripcionesNoActivas", noActivas);
        asignarTexto("statMontoMensual", formatearMoneda(montoMensual));
    }


    function aplicarFiltrosSuscripciones() {
        const busqueda = normalizarTexto(
            document.getElementById("filtroBusquedaSuscripcion")?.value
        );

        const plan = (
            document.getElementById("filtroPlanSuscripcion")?.value
            || "todos"
        );

        const estado = (
            document.getElementById("filtroEstadoSuscripcion")?.value
            || "todos"
        );

        const filtradas = state.suscripcionesOriginales.filter(item => {
            const coincideBusqueda =
                !busqueda
                || normalizarTexto(item.empresa_nombre).includes(busqueda)
                || normalizarTexto(item.plan_nombre).includes(busqueda);

            const coincidePlan =
                plan === "todos"
                || String(item.plan_id) === plan;

            const coincideEstado =
                estado === "todos"
                || item.estado === estado;

            return (
                coincideBusqueda
                && coincidePlan
                && coincideEstado
            );
        });

        renderizarSuscripciones(filtradas);
    }


    function renderizarSuscripciones(suscripciones) {
        const contenedor = document.getElementById("suscripcionesLista");
        const vacio = document.getElementById("suscripcionesEstadoVacio");

        if (!contenedor || !vacio) return;

        if (!suscripciones.length) {
            contenedor.innerHTML = "";
            vacio.hidden = false;
            return;
        }

        vacio.hidden = true;

        contenedor.innerHTML = suscripciones
            .map(item => crearHtmlSuscripcion(item))
            .join("");
    }


    function crearHtmlSuscripcion(item) {
        const estadoClase = obtenerClaseEstado(item.estado);

        const tarifaTexto = item.tarifa_referencia?.rango_texto
            || "Sin tarifa vinculada";

        return `
            <article class="card suscripcion-card"
                     data-suscripcion-id="${item.id}">

                <header class="suscripcion-card-header">
                    <div>
                        <span class="status-badge ${estadoClase}">
                            ${escapeHtml(capitalizar(item.estado))}
                        </span>

                        <h2>
                            ${escapeHtml(item.empresa_nombre || "Empresa no disponible")}
                        </h2>

                        <p>
                            ${escapeHtml(item.plan_nombre || "Sin plan")}
                        </p>
                    </div>

                    <div class="suscripcion-card-vehiculos">
                        <strong>${Number(item.cantidad_vehiculos || 0)}</strong>
                        <span>vehículos</span>
                    </div>
                </header>


                <section class="suscripcion-card-summary">

                    <div>
                        <span>Tarifa de referencia</span>
                        <strong>${escapeHtml(tarifaTexto)}</strong>
                    </div>

                    <div>
                        <span>Mensualidad total</span>
                        <strong>${formatearMoneda(item.monto_mensual)}</strong>
                    </div>

                </section>


                <section class="suscripcion-card-section">
                    <h3>Precios acordados por unidad</h3>

                    <div class="suscripcion-precios-grid">

                        ${crearPrecio(
                            "Dispositivo",
                            item.precio_dispositivo_unitario
                        )}

                        ${crearPrecio(
                            "Instalación",
                            item.costo_instalacion_unitario
                        )}

                        ${crearPrecio(
                            "Mensualidad",
                            item.mensualidad_unitaria
                        )}

                        ${crearPrecio(
                            "Mantenimiento",
                            item.costo_mantenimiento_unitario
                        )}

                    </div>
                </section>


                <section class="suscripcion-card-section">
                    <h3>Totales</h3>

                    <div class="suscripcion-totales-resumen">

                        ${crearTotal(
                            "Dispositivos",
                            item.monto_dispositivos_total
                        )}

                        ${crearTotal(
                            "Instalación",
                            item.monto_instalacion_total
                        )}

                        ${crearTotal(
                            "Mensualidad",
                            item.monto_mensual
                        )}

                        ${crearTotal(
                            "Mantenimiento",
                            item.monto_mantenimiento_total
                        )}

                    </div>
                </section>


                <footer class="suscripcion-card-actions">

                    <button type="button"
                            class="btn btn-secondary"
                            data-action="editar"
                            data-suscripcion-id="${item.id}">
                        Editar
                    </button>

                    <button type="button"
                            class="btn btn-outline-primary"
                            data-action="estado"
                            data-suscripcion-id="${item.id}">
                        Cambiar estado
                    </button>

                </footer>

            </article>
        `;
    }


    function crearPrecio(etiqueta, valor) {
        return `
            <div class="suscripcion-precio">
                <span>${escapeHtml(etiqueta)}</span>
                <strong>${formatearMoneda(valor)}</strong>
                <small>por unidad</small>
            </div>
        `;
    }


    function crearTotal(etiqueta, valor) {
        return `
            <div>
                <span>${escapeHtml(etiqueta)}</span>
                <strong>${formatearMoneda(valor)}</strong>
            </div>
        `;
    }


    async function manejarAccionSuscripcion(event) {
        const boton = event.target.closest(
            "[data-action][data-suscripcion-id]"
        );

        if (!boton) return;

        const suscripcionId = Number(
            boton.dataset.suscripcionId
        );

        const action = boton.dataset.action;

        if (!suscripcionId) return;

        if (action === "editar") {
            await window.SuscripcionesFormulario?.abrirEditar(
                suscripcionId
            );

            return;
        }

        if (action === "estado") {
            abrirModalEstadoSuscripcion(suscripcionId);
        }
    }


    function abrirModalEstadoSuscripcion(suscripcionId) {
        const suscripcion = state.suscripcionesOriginales.find(
            item => Number(item.id) === Number(suscripcionId)
        );

        if (!suscripcion) {
            mostrarToastSuscripciones(
                "No se encontró la suscripción.",
                "error"
            );

            return;
        }

        state.suscripcionEstadoId = suscripcion.id;

        document
            .getElementById("modalEstadoSuscripcionTitulo")
            .textContent = "Cambiar estado de suscripción";

        document
            .getElementById("modalEstadoSuscripcionMensaje")
            .textContent = (
                `Empresa: ${suscripcion.empresa_nombre || "Sin nombre"}`
            );

        const select = document.getElementById(
            "nuevoEstadoSuscripcion"
        );

        select.value = suscripcion.estado || "activa";

        actualizarDetalleEstado();
        mostrarModal("modalEstadoSuscripcion");
    }


    function actualizarDetalleEstado() {
        const estado = document.getElementById(
            "nuevoEstadoSuscripcion"
        )?.value;

        const detalle = document.getElementById(
            "modalEstadoSuscripcionDetalle"
        );

        const icono = document.getElementById(
            "modalEstadoSuscripcionIcon"
        );

        if (!detalle || !icono) return;

        icono.classList.remove(
            "is-success",
            "is-warning",
            "is-danger"
        );

        const textos = {
            activa: (
                "La suscripción quedará vigente y el plan se sincronizará "
                + "como plan actual de la empresa."
            ),

            suspendida: (
                "La suscripción dejará de estar activa temporalmente. "
                + "La empresa no tendrá una suscripción vigente mientras permanezca suspendida."
            ),

            vencida: (
                "La suscripción quedará marcada como vencida y dejará de considerarse activa."
            ),

            cancelada: (
                "La suscripción quedará cancelada. Esta acción conserva el historial comercial."
            )
        };

        detalle.textContent = textos[estado] || "";

        if (estado === "activa") {
            icono.classList.add("is-success");
        } else if (estado === "suspendida" || estado === "vencida") {
            icono.classList.add("is-warning");
        } else if (estado === "cancelada") {
            icono.classList.add("is-danger");
        }
    }


    async function confirmarCambioEstadoSuscripcion() {
        const suscripcionId = state.suscripcionEstadoId;

        const nuevoEstado = document.getElementById(
            "nuevoEstadoSuscripcion"
        )?.value;

        if (!suscripcionId || !nuevoEstado) return;

        const boton = document.getElementById(
            "btnConfirmarEstadoSuscripcion"
        );

        bloquearBoton(
            boton,
            true,
            "Actualizando..."
        );

        try {
            const response = await TrackAPI.cambiarEstadoAdminSuscripcion(
                suscripcionId,
                nuevoEstado
            );

            mostrarToastSuscripciones(
                response.mensaje || "Estado actualizado correctamente.",
                "success"
            );

            cerrarModalEstadoSuscripcion();
            await cargarSuscripciones({ silencioso: true });

        } catch (error) {
            mostrarToastSuscripciones(
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


    function cerrarModalEstadoSuscripcion() {
        ocultarModal("modalEstadoSuscripcion");
        state.suscripcionEstadoId = null;
    }


    function obtenerClaseEstado(estado) {
        const mapa = {
            activa: "status-active",
            suspendida: "status-warning",
            vencida: "status-gray",
            cancelada: "status-danger"
        };

        return mapa[estado] || "status-gray";
    }


    function formatearMoneda(valor) {
        const numero = Number(valor || 0);

        return new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 2
        }).format(numero);
    }


    function capitalizar(valor) {
        const texto = String(valor || "");
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }


    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
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


    function mostrarToastSuscripciones(mensaje, tipo = "info") {
        const contenedor = document.getElementById(
            "suscripcionesToastContainer"
        );

        if (!contenedor) return;

        const toast = document.createElement("div");

        toast.className = (
            `suscripciones-toast toast-${tipo}`
        );

        toast.textContent = mensaje;

        contenedor.appendChild(toast);

        window.setTimeout(() => {
            toast.classList.add("is-hiding");

            window.setTimeout(() => {
                toast.remove();
            }, 250);
        }, 3500);
    }


    window.SuscripcionesAdmin = {
        recargar: () => cargarSuscripciones({
            silencioso: true
        }),

        mostrarToast: mostrarToastSuscripciones,
        mostrarModal,
        ocultarModal,
        escapar: escapeHtml,
        moneda: formatearMoneda
    };
})();
