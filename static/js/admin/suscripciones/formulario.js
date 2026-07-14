(() => {
    "use strict";

    const state = {
        empresas: [],
        planes: [],
        suscripcionEditandoId: null,
        tarifaDetectada: null,
        timerDeteccion: null
    };


    document.addEventListener("DOMContentLoaded", () => {
        configurarEventosFormulario();
    });


    function configurarEventosFormulario() {
        document
            .getElementById("btnCerrarModalSuscripcion")
            ?.addEventListener("click", cerrarModalSuscripcion);

        document
            .getElementById("btnCancelarSuscripcion")
            ?.addEventListener("click", cerrarModalSuscripcion);

        document
            .getElementById("formSuscripcion")
            ?.addEventListener("submit", guardarSuscripcion);

        document
            .getElementById("suscripcionPlan")
            ?.addEventListener("change", programarDeteccionTarifa);

        document
            .getElementById("suscripcionCantidadVehiculos")
            ?.addEventListener("input", () => {
                programarDeteccionTarifa();
                recalcularTotales();
            });

        [
            "suscripcionPrecioDispositivo",
            "suscripcionCostoInstalacion",
            "suscripcionMensualidad",
            "suscripcionMantenimiento"
        ].forEach(id => {
            document
                .getElementById(id)
                ?.addEventListener("input", recalcularTotales);
        });

        document
            .getElementById("suscripcionEmpresaBusqueda")
            ?.addEventListener("input", filtrarMenuEmpresas);

        document
            .getElementById("suscripcionEmpresaBusqueda")
            ?.addEventListener("focus", () => {
                renderizarMenuEmpresas(
                    document.getElementById(
                        "suscripcionEmpresaBusqueda"
                    ).value
                );
                abrirMenuEmpresas();
            });

        document
            .getElementById("btnToggleSuscripcionEmpresa")
            ?.addEventListener("click", toggleMenuEmpresas);

        document
            .getElementById("menuSuscripcionEmpresa")
            ?.addEventListener("click", seleccionarEmpresaDesdeMenu);

        document.addEventListener("click", event => {
            const combobox = document.getElementById(
                "comboboxSuscripcionEmpresa"
            );

            if (
                combobox
                && !combobox.contains(event.target)
            ) {
                cerrarMenuEmpresas();
            }
        });
    }


    async function abrirNueva() {
        state.suscripcionEditandoId = null;
        state.tarifaDetectada = null;

        document.getElementById("modalSuscripcionTitulo").textContent =
            "Nueva suscripción";

        document.getElementById("formSuscripcion").reset();
        limpiarEmpresaSeleccionada();
        limpiarTarifaDetectada();
        ponerPreciosEnCero();
        recalcularTotales();

        try {
            await cargarCatalogos();

            SuscripcionesAdmin.mostrarModal(
                "modalSuscripcion"
            );

        } catch (error) {
            SuscripcionesAdmin.mostrarToast(
                error.message || "No se pudieron cargar los catálogos.",
                "error"
            );
        }
    }


    async function abrirEditar(suscripcionId) {
        state.suscripcionEditandoId = Number(suscripcionId);
        state.tarifaDetectada = null;

        try {
            const [catalogos, response] = await Promise.all([
                cargarCatalogos(),
                TrackAPI.obtenerAdminSuscripcion(suscripcionId)
            ]);

            void catalogos;

            const suscripcion = response.suscripcion;

            if (!suscripcion) {
                throw new Error(
                    "No se encontró la información de la suscripción."
                );
            }

            document.getElementById("modalSuscripcionTitulo").textContent =
                `Editar suscripción de ${suscripcion.empresa_nombre || "empresa"}`;

            seleccionarEmpresa(
                suscripcion.empresa_id,
                suscripcion.empresa_nombre
            );

            document.getElementById("suscripcionPlan").value =
                String(suscripcion.plan_id || "");

            document.getElementById(
                "suscripcionCantidadVehiculos"
            ).value = suscripcion.cantidad_vehiculos ?? "";

            document.getElementById(
                "suscripcionPrecioDispositivo"
            ).value = suscripcion.precio_dispositivo_unitario ?? 0;

            document.getElementById(
                "suscripcionCostoInstalacion"
            ).value = suscripcion.costo_instalacion_unitario ?? 0;

            document.getElementById(
                "suscripcionMensualidad"
            ).value = suscripcion.mensualidad_unitaria ?? 0;

            document.getElementById(
                "suscripcionMantenimiento"
            ).value = suscripcion.costo_mantenimiento_unitario ?? 0;

            mostrarTarifaDesdeSuscripcion(suscripcion);
            recalcularTotales();

            SuscripcionesAdmin.mostrarModal(
                "modalSuscripcion"
            );

        } catch (error) {
            SuscripcionesAdmin.mostrarToast(
                error.message || "No se pudo cargar la suscripción.",
                "error"
            );
        }
    }


    async function cargarCatalogos() {
        const [empresasResponse, planesResponse] = await Promise.all([
            TrackAPI.obtenerAdminEmpresas(),
            TrackAPI.obtenerAdminPlanesOpciones()
        ]);

        state.empresas = Array.isArray(empresasResponse.empresas)
            ? empresasResponse.empresas.filter(item => item.activo)
            : [];

        state.planes = Array.isArray(planesResponse.planes)
            ? planesResponse.planes
            : [];

        renderizarOpcionesPlanes();
        renderizarMenuEmpresas("");
    }


    function renderizarOpcionesPlanes() {
        const select = document.getElementById("suscripcionPlan");

        if (!select) return;

        const valorActual = select.value;

        select.innerHTML = `
            <option value="">Selecciona un plan</option>

            ${state.planes.map(plan => `
                <option value="${plan.id}">
                    ${escapeHtml(plan.nombre)}
                </option>
            `).join("")}
        `;

        const existeActual = state.planes.some(
            plan => String(plan.id) === String(valorActual)
        );

        if (existeActual) {
            select.value = valorActual;
        }
    }


    function programarDeteccionTarifa() {
        window.clearTimeout(state.timerDeteccion);

        state.timerDeteccion = window.setTimeout(() => {
            detectarTarifa();
        }, 350);
    }


    async function detectarTarifa() {
        const planId = Number(
            document.getElementById("suscripcionPlan").value
        );

        const cantidad = Number(
            document.getElementById(
                "suscripcionCantidadVehiculos"
            ).value
        );

        if (
            !planId
            || !Number.isInteger(cantidad)
            || cantidad < 1
        ) {
            state.tarifaDetectada = null;
            limpiarTarifaDetectada();
            return;
        }

        try {
            const response = await TrackAPI.detectarAdminTarifaSuscripcion(
                planId,
                cantidad
            );

            const tarifa = response.tarifa;

            if (!tarifa) {
                throw new Error(
                    "No se encontró una tarifa para esa cantidad."
                );
            }

            state.tarifaDetectada = tarifa;

            mostrarTarifaDetectada(tarifa);

            document.getElementById(
                "suscripcionPrecioDispositivo"
            ).value = tarifa.precio_dispositivo ?? 0;

            document.getElementById(
                "suscripcionCostoInstalacion"
            ).value = tarifa.costo_instalacion ?? 0;

            document.getElementById(
                "suscripcionMensualidad"
            ).value = tarifa.mensualidad ?? 0;

            document.getElementById(
                "suscripcionMantenimiento"
            ).value = tarifa.costo_mantenimiento ?? 0;

            recalcularTotales();

        } catch (error) {
            state.tarifaDetectada = null;
            limpiarTarifaDetectada();

            SuscripcionesAdmin.mostrarToast(
                error.message || "No se pudo detectar una tarifa.",
                "error"
            );
        }
    }


    function mostrarTarifaDetectada(tarifa) {
        const vacia = document.getElementById(
            "tarifaDetectadaVacia"
        );

        const contenido = document.getElementById(
            "tarifaDetectadaContenido"
        );

        vacia.hidden = true;
        contenido.hidden = false;

        asignarTexto(
            "tarifaDetectadaRango",
            `${tarifa.rango_texto || "-"} vehículos`
        );

        asignarTexto(
            "tarifaSugeridaDispositivo",
            SuscripcionesAdmin.moneda(
                tarifa.precio_dispositivo
            )
        );

        asignarTexto(
            "tarifaSugeridaInstalacion",
            SuscripcionesAdmin.moneda(
                tarifa.costo_instalacion
            )
        );

        asignarTexto(
            "tarifaSugeridaMensualidad",
            SuscripcionesAdmin.moneda(
                tarifa.mensualidad
            )
        );

        asignarTexto(
            "tarifaSugeridaMantenimiento",
            SuscripcionesAdmin.moneda(
                tarifa.costo_mantenimiento
            )
        );
    }


    function mostrarTarifaDesdeSuscripcion(suscripcion) {
        const tarifa = suscripcion.tarifa_referencia;

        if (!tarifa) {
            limpiarTarifaDetectada();
            return;
        }

        state.tarifaDetectada = tarifa;
        mostrarTarifaDetectada(tarifa);
    }


    function limpiarTarifaDetectada() {
        const vacia = document.getElementById(
            "tarifaDetectadaVacia"
        );

        const contenido = document.getElementById(
            "tarifaDetectadaContenido"
        );

        if (vacia) vacia.hidden = false;
        if (contenido) contenido.hidden = true;
    }


    function recalcularTotales() {
        const cantidad = Number(
            document.getElementById(
                "suscripcionCantidadVehiculos"
            )?.value || 0
        );

        const dispositivo = leerPrecio(
            "suscripcionPrecioDispositivo"
        );

        const instalacion = leerPrecio(
            "suscripcionCostoInstalacion"
        );

        const mensualidad = leerPrecio(
            "suscripcionMensualidad"
        );

        const mantenimiento = leerPrecio(
            "suscripcionMantenimiento"
        );

        asignarTexto(
            "totalSuscripcionDispositivos",
            SuscripcionesAdmin.moneda(
                cantidad * dispositivo
            )
        );

        asignarTexto(
            "totalSuscripcionInstalacion",
            SuscripcionesAdmin.moneda(
                cantidad * instalacion
            )
        );

        asignarTexto(
            "totalSuscripcionMensualidad",
            SuscripcionesAdmin.moneda(
                cantidad * mensualidad
            )
        );

        asignarTexto(
            "totalSuscripcionMantenimiento",
            SuscripcionesAdmin.moneda(
                cantidad * mantenimiento
            )
        );
    }


    async function guardarSuscripcion(event) {
        event.preventDefault();

        const empresaId = Number(
            document.getElementById("suscripcionEmpresa").value
        );

        const planId = Number(
            document.getElementById("suscripcionPlan").value
        );

        const cantidad = Number(
            document.getElementById(
                "suscripcionCantidadVehiculos"
            ).value
        );

        if (!empresaId) {
            SuscripcionesAdmin.mostrarToast(
                "Selecciona una empresa.",
                "error"
            );
            return;
        }

        if (!planId) {
            SuscripcionesAdmin.mostrarToast(
                "Selecciona un plan.",
                "error"
            );
            return;
        }

        if (!Number.isInteger(cantidad) || cantidad < 1) {
            SuscripcionesAdmin.mostrarToast(
                "La cantidad de vehículos debe ser al menos 1.",
                "error"
            );
            return;
        }

        if (!state.tarifaDetectada) {
            SuscripcionesAdmin.mostrarToast(
                "No hay una tarifa válida detectada para esa cantidad.",
                "error"
            );
            return;
        }

        const data = {
            empresa_id: empresaId,
            plan_id: planId,
            cantidad_vehiculos: cantidad,

            precio_dispositivo_unitario: leerPrecio(
                "suscripcionPrecioDispositivo"
            ),

            costo_instalacion_unitario: leerPrecio(
                "suscripcionCostoInstalacion"
            ),

            mensualidad_unitaria: leerPrecio(
                "suscripcionMensualidad"
            ),

            costo_mantenimiento_unitario: leerPrecio(
                "suscripcionMantenimiento"
            )
        };

        const precios = [
            data.precio_dispositivo_unitario,
            data.costo_instalacion_unitario,
            data.mensualidad_unitaria,
            data.costo_mantenimiento_unitario
        ];

        if (
            precios.some(
                valor => !Number.isFinite(valor) || valor < 0
            )
        ) {
            SuscripcionesAdmin.mostrarToast(
                "Todos los precios deben ser válidos y no negativos.",
                "error"
            );
            return;
        }

        const boton = document.getElementById(
            "btnGuardarSuscripcion"
        );

        bloquearBoton(
            boton,
            true,
            "Guardando..."
        );

        try {
            const response = state.suscripcionEditandoId
                ? await TrackAPI.editarAdminSuscripcion(
                    state.suscripcionEditandoId,
                    data
                )
                : await TrackAPI.crearAdminSuscripcion(
                    data
                );

            SuscripcionesAdmin.mostrarToast(
                response.mensaje || "Suscripción guardada correctamente.",
                "success"
            );

            cerrarModalSuscripcion();
            await SuscripcionesAdmin.recargar();

        } catch (error) {
            SuscripcionesAdmin.mostrarToast(
                error.message || "No se pudo guardar la suscripción.",
                "error"
            );

        } finally {
            bloquearBoton(
                boton,
                false,
                "Guardar suscripción"
            );
        }
    }


    function renderizarMenuEmpresas(busqueda = "") {
        const menu = document.getElementById(
            "menuSuscripcionEmpresa"
        );

        if (!menu) return;

        const termino = normalizarTexto(busqueda);

        const filtradas = state.empresas.filter(empresa => {
            return (
                !termino
                || normalizarTexto(empresa.nombre).includes(termino)
                || normalizarTexto(empresa.correo).includes(termino)
            );
        });

        if (!filtradas.length) {
            menu.innerHTML = `
                <div class="empresa-combobox-empty">
                    No se encontraron empresas
                </div>
            `;
            return;
        }

        menu.innerHTML = filtradas.map(empresa => `
            <button type="button"
                    class="empresa-combobox-option"
                    data-empresa-id="${empresa.id}"
                    data-empresa-nombre="${escapeAttr(empresa.nombre)}">

                <strong>${escapeHtml(empresa.nombre)}</strong>

                <span>
                    ${escapeHtml(empresa.correo || "Sin correo")}
                </span>

            </button>
        `).join("");
    }


    function filtrarMenuEmpresas() {
        const input = document.getElementById(
            "suscripcionEmpresaBusqueda"
        );

        document.getElementById(
            "suscripcionEmpresa"
        ).value = "";

        renderizarMenuEmpresas(input.value);
        abrirMenuEmpresas();
    }


    function seleccionarEmpresaDesdeMenu(event) {
        const opcion = event.target.closest(
            "[data-empresa-id]"
        );

        if (!opcion) return;

        seleccionarEmpresa(
            Number(opcion.dataset.empresaId),
            opcion.dataset.empresaNombre
        );

        cerrarMenuEmpresas();
    }


    function seleccionarEmpresa(id, nombre) {
        document.getElementById(
            "suscripcionEmpresa"
        ).value = String(id || "");

        document.getElementById(
            "suscripcionEmpresaBusqueda"
        ).value = nombre || "";
    }


    function limpiarEmpresaSeleccionada() {
        seleccionarEmpresa("", "");
    }


    function toggleMenuEmpresas() {
        const menu = document.getElementById(
            "menuSuscripcionEmpresa"
        );

        if (!menu) return;

        if (menu.classList.contains("show")) {
            cerrarMenuEmpresas();
        } else {
            const valor = document.getElementById(
                "suscripcionEmpresaBusqueda"
            ).value;

            renderizarMenuEmpresas(valor);
            abrirMenuEmpresas();
        }
    }


    function abrirMenuEmpresas() {
        document.getElementById(
            "menuSuscripcionEmpresa"
        )?.classList.add("show");
    }


    function cerrarMenuEmpresas() {
        document.getElementById(
            "menuSuscripcionEmpresa"
        )?.classList.remove("show");
    }


    function ponerPreciosEnCero() {
        [
            "suscripcionPrecioDispositivo",
            "suscripcionCostoInstalacion",
            "suscripcionMensualidad",
            "suscripcionMantenimiento"
        ].forEach(id => {
            document.getElementById(id).value = "0";
        });
    }


    function cerrarModalSuscripcion() {
        SuscripcionesAdmin.ocultarModal(
            "modalSuscripcion"
        );

        state.suscripcionEditandoId = null;
        state.tarifaDetectada = null;

        cerrarMenuEmpresas();
    }


    function leerPrecio(id) {
        const numero = Number(
            document.getElementById(id)?.value || 0
        );

        return Number.isFinite(numero)
            ? numero
            : NaN;
    }


    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }


    function escapeHtml(valor) {
        return SuscripcionesAdmin?.escapar
            ? SuscripcionesAdmin.escapar(valor)
            : String(valor ?? "");
    }


    function escapeAttr(valor) {
        return escapeHtml(valor);
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


    window.SuscripcionesFormulario = {
        abrirNueva,
        abrirEditar
    };
})();
