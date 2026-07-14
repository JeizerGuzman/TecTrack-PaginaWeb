(() => {
    "use strict";

    const state = {
        planId: null,
        planNombre: "",
        tarifas: [],
        tarifaEditandoId: null
    };

    document.addEventListener("DOMContentLoaded", configurarEventosTarifas);

    function configurarEventosTarifas() {
        document.getElementById("btnCerrarModalTarifas")?.addEventListener("click", cerrarModalTarifas);
        document.getElementById("btnCerrarTarifasFooter")?.addEventListener("click", cerrarModalTarifas);
        document.getElementById("btnNuevaTarifa")?.addEventListener("click", abrirEditorNuevaTarifa);
        document.getElementById("btnCancelarTarifa")?.addEventListener("click", cerrarEditorTarifa);
        document.getElementById("formTarifa")?.addEventListener("submit", guardarTarifa);
        document.getElementById("tarifasLista")?.addEventListener("click", manejarAccionTarifa);
    }

    async function abrir(planId) {
        state.planId = Number(planId);
        state.tarifaEditandoId = null;
        cerrarEditorTarifa();
        PlanesAdmin.mostrarModal("modalTarifasPlan");
        await cargarTarifas();
    }

    async function cargarTarifas() {
        if (!state.planId) return;

        try {
            const response = await TrackAPI.obtenerAdminTarifasPlan(state.planId);
            state.planNombre = response.plan?.nombre || "";
            state.tarifas = Array.isArray(response.tarifas) ? response.tarifas : [];

            document.getElementById("modalTarifasTitulo").textContent = "Tarifas del plan";
            document.getElementById("modalTarifasSubtitulo").textContent = state.planNombre ? `Plan ${state.planNombre}` : "";
            renderizarTarifas();
        } catch (error) {
            PlanesAdmin.mostrarToast(error.message || "No se pudieron cargar las tarifas.", "error");
        }
    }

    function renderizarTarifas() {
        const lista = document.getElementById("tarifasLista");
        const vacio = document.getElementById("tarifasEstadoVacio");
        if (!lista || !vacio) return;

        if (!state.tarifas.length) {
            lista.innerHTML = "";
            vacio.hidden = false;
            return;
        }

        vacio.hidden = true;
        lista.innerHTML = state.tarifas.map(crearHtmlTarifa).join("");
    }

    function crearHtmlTarifa(tarifa) {
        return `
            <article class="tarifa-card ${tarifa.activo ? "" : "is-inactive"}" data-tarifa-id="${tarifa.id}">
                <div class="tarifa-card-main">
                    <div class="tarifa-range">
                        <span class="status-badge ${tarifa.activo ? "status-active" : "status-inactive"}">${tarifa.activo ? "Activa" : "Inactiva"}</span>
                        <strong>${escapeHtml(textoRango(tarifa))}</strong><span>vehículos</span>
                    </div>
                    <div class="tarifa-values-grid">
                        ${crearValorTarifa("Dispositivo", tarifa.precio_dispositivo)}
                        ${crearValorTarifa("Instalación", tarifa.costo_instalacion)}
                        ${crearValorTarifa("Mensualidad", tarifa.mensualidad)}
                        ${crearValorTarifa("Mantenimiento", tarifa.costo_mantenimiento)}
                    </div>
                </div>
                <div class="tarifa-card-actions">
                    <button type="button" class="btn btn-secondary btn-small" data-action="editar" data-tarifa-id="${tarifa.id}">Editar</button>
                    <button type="button" class="btn ${tarifa.activo ? "btn-danger-soft" : "btn-success-soft"} btn-small" data-action="${tarifa.activo ? "desactivar" : "reactivar"}" data-tarifa-id="${tarifa.id}">${tarifa.activo ? "Desactivar" : "Reactivar"}</button>
                </div>
            </article>
        `;
    }

    function crearValorTarifa(etiqueta, valor) {
        return `<div class="tarifa-value"><span>${escapeHtml(etiqueta)}</span><strong>${formatearMoneda(valor)}</strong><small>por unidad</small></div>`;
    }

    async function manejarAccionTarifa(event) {
        const boton = event.target.closest("[data-action][data-tarifa-id]");
        if (!boton) return;

        const tarifaId = Number(boton.dataset.tarifaId);
        const tarifa = state.tarifas.find(item => Number(item.id) === tarifaId);
        if (!tarifa) return;

        if (boton.dataset.action === "editar") return abrirEditorEditarTarifa(tarifa);
        if (boton.dataset.action === "desactivar") return cambiarEstadoTarifa(tarifa, false);
        if (boton.dataset.action === "reactivar") return cambiarEstadoTarifa(tarifa, true);
    }

    function abrirEditorNuevaTarifa() {
        state.tarifaEditandoId = null;
        document.getElementById("tarifaEditorTitulo").textContent = "Nueva tarifa";
        document.getElementById("formTarifa").reset();
        ["tarifaPrecioDispositivo", "tarifaCostoInstalacion", "tarifaMensualidad", "tarifaMantenimiento"]
            .forEach(id => document.getElementById(id).value = "0");
        mostrarEditorTarifa();
    }

    function abrirEditorEditarTarifa(tarifa) {
        state.tarifaEditandoId = tarifa.id;
        document.getElementById("tarifaEditorTitulo").textContent = `Editar tarifa: ${textoRango(tarifa)} vehículos`;
        document.getElementById("tarifaCantidadMinima").value = tarifa.cantidad_minima ?? "";
        document.getElementById("tarifaCantidadMaxima").value = tarifa.cantidad_maxima ?? "";
        document.getElementById("tarifaPrecioDispositivo").value = tarifa.precio_dispositivo ?? 0;
        document.getElementById("tarifaCostoInstalacion").value = tarifa.costo_instalacion ?? 0;
        document.getElementById("tarifaMensualidad").value = tarifa.mensualidad ?? 0;
        document.getElementById("tarifaMantenimiento").value = tarifa.costo_mantenimiento ?? 0;
        mostrarEditorTarifa();
    }

    function mostrarEditorTarifa() {
        const editor = document.getElementById("tarifaEditor");
        if (!editor) return;
        editor.hidden = false;
        window.setTimeout(() => editor.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }

    function cerrarEditorTarifa() {
        const editor = document.getElementById("tarifaEditor");
        if (!editor) return;
        editor.hidden = true;
        state.tarifaEditandoId = null;
        document.getElementById("formTarifa")?.reset();
    }

    async function guardarTarifa(event) {
        event.preventDefault();
        if (!state.planId) return;

        const cantidadMinima = Number(document.getElementById("tarifaCantidadMinima").value);
        const maxTexto = document.getElementById("tarifaCantidadMaxima").value.trim();
        const cantidadMaxima = maxTexto ? Number(maxTexto) : null;

        if (!Number.isInteger(cantidadMinima) || cantidadMinima < 1) {
            return PlanesAdmin.mostrarToast("La cantidad mínima debe ser al menos 1.", "error");
        }

        if (cantidadMaxima !== null && (!Number.isInteger(cantidadMaxima) || cantidadMaxima < cantidadMinima)) {
            return PlanesAdmin.mostrarToast("La cantidad máxima debe ser igual o mayor que la mínima.", "error");
        }

        const data = {
            cantidad_minima: cantidadMinima,
            cantidad_maxima: cantidadMaxima,
            precio_dispositivo: leerPrecio("tarifaPrecioDispositivo"),
            costo_instalacion: leerPrecio("tarifaCostoInstalacion"),
            mensualidad: leerPrecio("tarifaMensualidad"),
            costo_mantenimiento: leerPrecio("tarifaMantenimiento")
        };

        if (Object.values(data).some(valor => valor === "__INVALIDO__")) {
            return PlanesAdmin.mostrarToast("Todos los precios deben ser números válidos y no negativos.", "error");
        }

        const boton = document.getElementById("btnGuardarTarifa");
        bloquearBoton(boton, true, "Guardando...");

        try {
            const response = state.tarifaEditandoId
                ? await TrackAPI.editarAdminTarifaPlan(state.tarifaEditandoId, data)
                : await TrackAPI.crearAdminTarifaPlan(state.planId, data);

            PlanesAdmin.mostrarToast(response.mensaje || "Tarifa guardada correctamente.", "success");
            cerrarEditorTarifa();
            await cargarTarifas();
            await PlanesAdmin.recargar();
        } catch (error) {
            PlanesAdmin.mostrarToast(error.message || "No se pudo guardar la tarifa.", "error");
        } finally {
            bloquearBoton(boton, false, "Guardar tarifa");
        }
    }

    function cambiarEstadoTarifa(tarifa, activar) {

        const rango = textoRango(tarifa);


        PlanesAdmin.abrirModalEstado({

            titulo: activar
                ? "Reactivar tarifa"
                : "Desactivar tarifa",

            kicker: activar
                ? "Activación de tarifa"
                : "Desactivación de tarifa",

            mensaje: activar
                ? (
                    `¿Estás seguro de que deseas reactivar `
                    + `la tarifa de ${rango} vehículos?`
                )
                : (
                    `¿Estás seguro de que deseas desactivar `
                    + `la tarifa de ${rango} vehículos?`
                ),

            detalle: activar
                ? (
                    "La tarifa volverá a estar disponible "
                    + "como referencia para nuevas suscripciones."
                )
                : (
                    "La tarifa dejará de estar disponible para "
                    + "nuevas suscripciones. Las suscripciones "
                    + "existentes conservarán sus precios."
                ),

            accion: activar
                ? "reactivar"
                : "desactivar",

            textoBoton: activar
                ? "Reactivar tarifa"
                : "Desactivar tarifa",

            callback: async () => {

                const response = activar
                    ? await TrackAPI.reactivarAdminTarifaPlan(
                        tarifa.id
                    )
                    : await TrackAPI.desactivarAdminTarifaPlan(
                        tarifa.id
                    );


                PlanesAdmin.mostrarToast(
                    response.mensaje
                        || "Estado actualizado correctamente.",
                    "success"
                );


                await cargarTarifas();

                await PlanesAdmin.recargar();
            }
        });
    }

    function cerrarModalTarifas() {
        cerrarEditorTarifa();
        PlanesAdmin.ocultarModal("modalTarifasPlan");
        state.planId = null;
        state.planNombre = "";
        state.tarifas = [];
    }

    function leerPrecio(id) {
        const valor = Number(document.getElementById(id).value);
        return Number.isFinite(valor) && valor >= 0 ? valor : "__INVALIDO__";
    }

    function textoRango(tarifa) {
        const minimo = Number(tarifa.cantidad_minima);
        if (tarifa.cantidad_maxima === null || tarifa.cantidad_maxima === undefined || tarifa.cantidad_maxima === "") return `${minimo} o más`;
        const maximo = Number(tarifa.cantidad_maxima);
        return minimo === maximo ? String(minimo) : `${minimo} a ${maximo}`;
    }

    function formatearMoneda(valor) {
        return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(Number(valor || 0));
    }

    function escapeHtml(valor) {
        return window.PlanesAdmin?.escapar ? PlanesAdmin.escapar(valor) : String(valor ?? "");
    }

    function bloquearBoton(boton, bloquear, texto) {
        if (!boton) return;
        boton.disabled = bloquear;
        boton.textContent = texto;
    }

    window.PlanesTarifas = { abrir };
})();
