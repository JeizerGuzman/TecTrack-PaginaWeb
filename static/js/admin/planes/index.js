(() => {
    "use strict";

    const state = {
        planesOriginales: [],
        planEditandoId: null,
        cargando: false,
        timer: null,

        confirmacionEstado: {
            callback: null
        }
    };

    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            configurarEventosPlanes();


            await cargarPlanes();


            const intervaloMs =
                await TrackConfig.obtenerAdminMs(
                    "planes",
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

                        cargarPlanes({
                            silencioso: true
                        });

                    },
                    intervaloMs
                );

        }
    );

    function configurarEventosPlanes() {
        document.getElementById("btnAbrirModalPlan")?.addEventListener("click", abrirModalNuevoPlan);
        document.getElementById("btnCerrarModalPlan")?.addEventListener("click", cerrarModalPlan);
        document.getElementById("btnCancelarPlan")?.addEventListener("click", cerrarModalPlan);
        document.getElementById("formPlan")?.addEventListener("submit", guardarPlan);
        document.getElementById("filtroBusquedaPlan")?.addEventListener("input", aplicarFiltrosPlanes);
        document.getElementById("filtroEstadoPlan")?.addEventListener("change", aplicarFiltrosPlanes);
        document.getElementById("planTieneEvidencia")?.addEventListener("change", actualizarCampoRetencionEvidencias);
        document.getElementById("planesLista")?.addEventListener("click", manejarAccionTarjetaPlan);
        document
            .getElementById("btnCerrarModalEstado")
            ?.addEventListener(
                "click",
                cerrarModalEstado
            );

        document
            .getElementById("btnCancelarModalEstado")
            ?.addEventListener(
                "click",
                cerrarModalEstado
            );

        document
            .getElementById("btnConfirmarModalEstado")
            ?.addEventListener(
                "click",
                ejecutarConfirmacionEstado
    );
    }

    async function cargarPlanes({ silencioso = false } = {}) {
        if (state.cargando) return;
        state.cargando = true;

        try {
            const response = await TrackAPI.obtenerAdminPlanes();
            state.planesOriginales = Array.isArray(response.planes) ? response.planes : [];
            actualizarEstadisticasPlanes();
            aplicarFiltrosPlanes();
        } catch (error) {
            if (!silencioso) mostrarToastPlanes(error.message || "No se pudieron cargar los planes.", "error");
        } finally {
            state.cargando = false;
        }
    }

    function actualizarEstadisticasPlanes() {
        const total = state.planesOriginales.length;
        const activos = state.planesOriginales.filter(plan => plan.activo).length;
        const inactivos = total - activos;
        const tarifasActivas = state.planesOriginales.reduce(
            (acumulado, plan) => acumulado + Number(plan.tarifas_activas || 0), 0
        );

        asignarTexto("statPlanesTotal", total);
        asignarTexto("statPlanesActivos", activos);
        asignarTexto("statPlanesInactivos", inactivos);
        asignarTexto("statTarifasActivas", tarifasActivas);
    }

    function aplicarFiltrosPlanes() {
        const busqueda = normalizarTexto(document.getElementById("filtroBusquedaPlan")?.value);
        const estado = document.getElementById("filtroEstadoPlan")?.value || "todos";

        const filtrados = state.planesOriginales.filter(plan => {
            const coincideBusqueda = !busqueda
                || normalizarTexto(plan.nombre).includes(busqueda)
                || normalizarTexto(plan.descripcion).includes(busqueda);

            const coincideEstado = estado === "todos"
                || (estado === "activo" && plan.activo)
                || (estado === "inactivo" && !plan.activo);

            return coincideBusqueda && coincideEstado;
        });

        renderizarPlanes(filtrados);
    }

    function renderizarPlanes(planes) {
        const contenedor = document.getElementById("planesLista");
        const vacio = document.getElementById("planesEstadoVacio");
        if (!contenedor || !vacio) return;

        if (!planes.length) {
            contenedor.innerHTML = "";
            vacio.hidden = false;
            return;
        }

        vacio.hidden = true;
        contenedor.innerHTML = planes.map(crearHtmlTarjetaPlan).join("");
    }

    function crearHtmlTarjetaPlan(plan) {
        const caracteristicas = [
            ["GPS", plan.tiene_gps],
            ["Vibración", plan.tiene_sensor_vibracion],
            ["Puerta", plan.tiene_sensor_puerta],
            ["Pánico", plan.tiene_boton_panico],
            ["Sirena", plan.tiene_sirena],
            ["Dashboard", plan.tiene_dashboard_web],
            ["App móvil", plan.tiene_app_movil],
            ["FPGA", plan.tiene_fpga],
            ["Cámara", plan.tiene_camara],
            ["Evidencia automática", plan.tiene_captura_evidencia]
        ];

        const featuresHtml = caracteristicas.map(([nombre, incluido]) => `
            <span class="plan-feature-chip ${incluido ? "is-included" : "is-excluded"}">
                ${iconoFeature(incluido)}${escapeHtml(nombre)}
            </span>
        `).join("");

        return `
            <article class="card plan-card ${plan.activo ? "" : "is-inactive"}" data-plan-id="${plan.id}">
                <header class="plan-card-header">
                    <div>
                        <span class="status-badge ${plan.activo ? "status-active" : "status-inactive"}">${plan.activo ? "Activo" : "Inactivo"}</span>
                        <h2>${escapeHtml(plan.nombre || "Sin nombre")}</h2>
                    </div>
                    <div class="plan-card-tarifas-count"><strong>${Number(plan.tarifas_activas || 0)}</strong><span>tarifas activas</span></div>
                </header>

                <p class="plan-card-description">${escapeHtml(plan.descripcion || "Sin descripción")}</p>

                <section class="plan-card-section">
                    <h3>Características</h3>
                    <div class="plan-features-list">${featuresHtml}</div>
                </section>

                <section class="plan-card-section">
                    <h3>Retención</h3>
                    <div class="plan-retention-summary">
                        <div><span>GPS</span><strong>${formatearDias(plan.dias_retencion_gps)}</strong></div>
                        <div><span>Alertas</span><strong>${formatearDias(plan.dias_retencion_alertas)}</strong></div>
                        <div><span>Evidencias</span><strong>${formatearDias(plan.dias_retencion_evidencias)}</strong></div>
                    </div>
                </section>

                <footer class="plan-card-actions">
                    <button type="button" class="btn btn-secondary" data-action="editar" data-plan-id="${plan.id}">Editar</button>
                    <button type="button" class="btn btn-outline-primary" data-action="tarifas" data-plan-id="${plan.id}">Administrar tarifas</button>
                    <button type="button" class="btn ${plan.activo ? "btn-danger-soft" : "btn-success-soft"}" data-action="${plan.activo ? "desactivar" : "reactivar"}" data-plan-id="${plan.id}">${plan.activo ? "Desactivar" : "Reactivar"}</button>
                </footer>
            </article>
        `;
    }

    async function manejarAccionTarjetaPlan(event) {
        const boton = event.target.closest("[data-action][data-plan-id]");
        if (!boton) return;

        const planId = Number(boton.dataset.planId);
        const action = boton.dataset.action;
        if (!planId) return;

        if (action === "editar") return abrirModalEditarPlan(planId);
        if (action === "tarifas") return window.PlanesTarifas?.abrir(planId);
        if (action === "desactivar") return cambiarEstadoPlan(planId, false);
        if (action === "reactivar") return cambiarEstadoPlan(planId, true);
    }

    function abrirModalNuevoPlan() {
        state.planEditandoId = null;
        document.getElementById("modalPlanTitulo").textContent = "Nuevo plan";
        document.getElementById("formPlan").reset();
        establecerValoresDefaultPlan();
        actualizarCampoRetencionEvidencias();
        mostrarModal("modalPlan");
    }

    async function abrirModalEditarPlan(planId) {
        try {
            const response = await TrackAPI.obtenerAdminPlan(planId);
            const plan = response.plan;
            if (!plan) throw new Error("No se encontró la información del plan.");

            state.planEditandoId = plan.id;
            document.getElementById("modalPlanTitulo").textContent = `Editar ${plan.nombre}`;
            document.getElementById("planNombre").value = plan.nombre || "";
            document.getElementById("planDescripcion").value = plan.descripcion || "";
            document.getElementById("planTieneGps").checked = Boolean(plan.tiene_gps);
            document.getElementById("planTieneVibracion").checked = Boolean(plan.tiene_sensor_vibracion);
            document.getElementById("planTienePuerta").checked = Boolean(plan.tiene_sensor_puerta);
            document.getElementById("planTienePanico").checked = Boolean(plan.tiene_boton_panico);
            document.getElementById("planTieneSirena").checked = Boolean(plan.tiene_sirena);
            document.getElementById("planTieneDashboard").checked = Boolean(plan.tiene_dashboard_web);
            document.getElementById("planTieneApp").checked = Boolean(plan.tiene_app_movil);
            document.getElementById("planTieneFpga").checked = Boolean(plan.tiene_fpga);
            document.getElementById("planTieneCamara").checked = Boolean(plan.tiene_camara);
            document.getElementById("planTieneEvidencia").checked = Boolean(plan.tiene_captura_evidencia);
            document.getElementById("planRetencionGps").value = plan.dias_retencion_gps ?? "";
            document.getElementById("planRetencionAlertas").value = plan.dias_retencion_alertas ?? "";
            document.getElementById("planRetencionEvidencias").value = plan.dias_retencion_evidencias ?? "";

            actualizarCampoRetencionEvidencias();
            mostrarModal("modalPlan");
        } catch (error) {
            mostrarToastPlanes(error.message || "No se pudo cargar el plan.", "error");
        }
    }

    async function guardarPlan(event) {
        event.preventDefault();

        const nombre = document.getElementById("planNombre").value.trim();
        const diasGps = Number(document.getElementById("planRetencionGps").value);
        const diasAlertas = Number(document.getElementById("planRetencionAlertas").value);
        const tieneEvidencia = document.getElementById("planTieneEvidencia").checked;
        const valorEvidencias = document.getElementById("planRetencionEvidencias").value;

        if (!nombre) return mostrarToastPlanes("Escribe el nombre del plan.", "error");
        if (!Number.isInteger(diasGps) || diasGps < 1) return mostrarToastPlanes("La retención GPS debe ser de al menos 1 día.", "error");
        if (!Number.isInteger(diasAlertas) || diasAlertas < 1) return mostrarToastPlanes("La retención de alertas debe ser de al menos 1 día.", "error");

        let diasEvidencias = null;
        if (tieneEvidencia) {
            diasEvidencias = Number(valorEvidencias);
            if (!Number.isInteger(diasEvidencias) || diasEvidencias < 1) {
                return mostrarToastPlanes("La retención de evidencias debe ser de al menos 1 día.", "error");
            }
        }

        const data = {
            nombre,
            descripcion: document.getElementById("planDescripcion").value.trim(),
            tiene_gps: document.getElementById("planTieneGps").checked,
            tiene_sensor_vibracion: document.getElementById("planTieneVibracion").checked,
            tiene_sensor_puerta: document.getElementById("planTienePuerta").checked,
            tiene_boton_panico: document.getElementById("planTienePanico").checked,
            tiene_sirena: document.getElementById("planTieneSirena").checked,
            tiene_dashboard_web: document.getElementById("planTieneDashboard").checked,
            tiene_app_movil: document.getElementById("planTieneApp").checked,
            tiene_fpga: document.getElementById("planTieneFpga").checked,
            tiene_camara: document.getElementById("planTieneCamara").checked,
            tiene_captura_evidencia: tieneEvidencia,
            dias_retencion_gps: diasGps,
            dias_retencion_alertas: diasAlertas,
            dias_retencion_evidencias: diasEvidencias
        };

        const boton = document.getElementById("btnGuardarPlan");
        bloquearBoton(boton, true, "Guardando...");

        try {
            const response = state.planEditandoId
                ? await TrackAPI.editarAdminPlan(state.planEditandoId, data)
                : await TrackAPI.crearAdminPlan(data);

            mostrarToastPlanes(response.mensaje || "Plan guardado correctamente.", "success");
            cerrarModalPlan();
            await cargarPlanes({ silencioso: true });
        } catch (error) {
            mostrarToastPlanes(error.message || "No se pudo guardar el plan.", "error");
        } finally {
            bloquearBoton(boton, false, "Guardar plan");
        }
    }

    function cambiarEstadoPlan(planId, activar) {
        const plan = state.planesOriginales.find(
            item => Number(item.id) === Number(planId)
        );

        if (!plan) {
            mostrarToastPlanes(
                "No se encontró la información del plan.",
                "error"
            );

            return;
        }


        abrirModalEstado({

            titulo: activar
                ? "Reactivar plan"
                : "Desactivar plan",

            kicker: activar
                ? "Activación de plan"
                : "Desactivación de plan",

            mensaje: activar
                ? `¿Estás seguro de que deseas reactivar el plan ${plan.nombre}?`
                : `¿Estás seguro de que deseas desactivar el plan ${plan.nombre}?`,

            detalle: activar
                ? (
                    "El plan volverá a estar disponible "
                    + "para nuevas asignaciones."
                )
                : (
                    "El plan dejará de estar disponible para "
                    + "nuevas asignaciones. Las empresas que ya "
                    + "lo tengan conservarán su información actual."
                ),

            accion: activar
                ? "reactivar"
                : "desactivar",

            textoBoton: activar
                ? "Reactivar plan"
                : "Desactivar plan",

            callback: async () => {

                const response = activar
                    ? await TrackAPI.reactivarAdminPlan(
                        planId
                    )
                    : await TrackAPI.desactivarAdminPlan(
                        planId
                    );


                mostrarToastPlanes(
                    response.mensaje
                        || "Estado actualizado correctamente.",
                    "success"
                );


                await cargarPlanes({
                    silencioso: true
                });
            }
        });
    }

    function cerrarModalPlan() {
        ocultarModal("modalPlan");
        state.planEditandoId = null;
    }

    function establecerValoresDefaultPlan() {
        ["planTieneGps", "planTieneVibracion", "planTienePuerta", "planTienePanico", "planTieneSirena", "planTieneDashboard", "planTieneApp"]
            .forEach(id => document.getElementById(id).checked = true);

        ["planTieneFpga", "planTieneCamara", "planTieneEvidencia"]
            .forEach(id => document.getElementById(id).checked = false);

        document.getElementById("planRetencionGps").value = 30;
        document.getElementById("planRetencionAlertas").value = 180;
        document.getElementById("planRetencionEvidencias").value = "";
    }

    function actualizarCampoRetencionEvidencias() {
        const activo = document.getElementById("planTieneEvidencia")?.checked;
        const grupo = document.getElementById("grupoRetencionEvidencias");
        const input = document.getElementById("planRetencionEvidencias");
        if (!grupo || !input) return;

        grupo.classList.toggle("is-disabled", !activo);
        input.disabled = !activo;
        if (!activo) input.value = "";
    }

    function abrirModalEstado({
        titulo = "Confirmar acción",
        kicker = "Confirmación",
        mensaje = "",
        detalle = "",
        accion = "confirmar",
        textoBoton = "Confirmar",
        callback = null
    }) {
        const modal = document.getElementById(
            "modalEstadoPlanTarifa"
        );

        const tituloElemento = document.getElementById(
            "modalEstadoTitulo"
        );

        const kickerElemento = document.getElementById(
            "modalEstadoKicker"
        );

        const mensajeElemento = document.getElementById(
            "modalEstadoMensaje"
        );

        const detalleElemento = document.getElementById(
            "modalEstadoDetalle"
        );

        const icono = document.getElementById(
            "modalEstadoIcon"
        );

        const botonConfirmar = document.getElementById(
            "btnConfirmarModalEstado"
        );

        if (
            !modal
            || !tituloElemento
            || !mensajeElemento
            || !detalleElemento
            || !icono
            || !botonConfirmar
        ) {
            return;
        }


        state.confirmacionEstado.callback =
            typeof callback === "function"
                ? callback
                : null;


        tituloElemento.textContent = titulo;

        kickerElemento.textContent = kicker;

        mensajeElemento.textContent = mensaje;

        botonConfirmar.textContent = textoBoton;


        icono.classList.remove(
            "is-danger",
            "is-success"
        );


        botonConfirmar.classList.remove(
            "btn-primary",
            "btn-danger-soft",
            "btn-success-soft"
        );


        if (accion === "desactivar") {

            icono.classList.add("is-danger");

            botonConfirmar.classList.add(
                "btn-danger-soft"
            );

        } else if (accion === "reactivar") {

            icono.classList.add("is-success");

            botonConfirmar.classList.add(
                "btn-success-soft"
            );

        } else {

            botonConfirmar.classList.add(
                "btn-primary"
            );
        }


        if (detalle) {

            detalleElemento.textContent = detalle;

            detalleElemento.hidden = false;

        } else {

            detalleElemento.textContent = "";

            detalleElemento.hidden = true;
        }


        mostrarModal("modalEstadoPlanTarifa");
    }

    function cerrarModalEstado() {
        ocultarModal("modalEstadoPlanTarifa");

        state.confirmacionEstado.callback = null;
    }

    async function ejecutarConfirmacionEstado() {
        const callback = state.confirmacionEstado.callback;

        if (typeof callback !== "function") {
            cerrarModalEstado();
            return;
        }

        const boton = document.getElementById(
            "btnConfirmarModalEstado"
        );

        const textoOriginal = boton?.textContent || "Confirmar";

        bloquearBoton(
            boton,
            true,
            "Procesando..."
        );

        try {

            await callback();

            cerrarModalEstado();

        } catch (error) {

            mostrarToastPlanes(
                error.message
                    || "No se pudo realizar la acción.",
                "error"
            );

        } finally {

            bloquearBoton(
                boton,
                false,
                textoOriginal
            );
        }
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
        if (!document.querySelector(".modal-backdrop.show")) document.body.classList.remove("modal-open");
    }

    function iconoFeature(incluido) {
        return incluido
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"></path></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12"></path><path d="m18 6-12 12"></path></svg>`;
    }

    function formatearDias(valor) {
        if (valor === null || valor === undefined || valor === "") return "No aplica";
        const numero = Number(valor);
        return `${numero} ${numero === 1 ? "día" : "días"}`;
    }

    function normalizarTexto(valor) {
        return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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
        if (elemento) elemento.textContent = valor;
    }

    function bloquearBoton(boton, bloquear, texto) {
        if (!boton) return;
        boton.disabled = bloquear;
        boton.textContent = texto;
    }

    function mostrarToastPlanes(mensaje, tipo = "info") {
        if (typeof window.mostrarToast === "function") {
            window.mostrarToast(mensaje, tipo);
            return;
        }

        const contenedor = document.getElementById("planesToastContainer");
        if (!contenedor) return;

        const toast = document.createElement("div");
        toast.className = `planes-toast toast-${tipo}`;
        toast.textContent = mensaje;
        contenedor.appendChild(toast);

        window.setTimeout(() => {
            toast.classList.add("is-hiding");
            window.setTimeout(() => toast.remove(), 250);
        }, 3500);
    }

    window.PlanesAdmin = {
        recargar: () => cargarPlanes({
            silencioso: true
        }),

        mostrarToast: mostrarToastPlanes,

        mostrarModal,

        ocultarModal,

        abrirModalEstado,

        escapar: escapeHtml
    };
})();
