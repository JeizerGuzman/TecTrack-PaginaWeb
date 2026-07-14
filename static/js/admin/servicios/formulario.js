(() => {
    "use strict";

    const state = {
        catalogos: {
            empresas: [],
            tecnicos: []
        },
        servicioEditandoId: null,
        vehiculos: []
    };


    document.addEventListener("DOMContentLoaded", () => {
        configurarEventosFormulario();
    });


    function configurarEventosFormulario() {
        document
            .getElementById("btnCerrarModalServicio")
            ?.addEventListener("click", cerrarModalServicio);

        document
            .getElementById("btnCancelarServicio")
            ?.addEventListener("click", cerrarModalServicio);

        document
            .getElementById("formServicio")
            ?.addEventListener("submit", guardarServicio);

        document
            .getElementById("servicioEmpresa")
            ?.addEventListener("change", async () => {
                await cargarVehiculosEmpresa();
            });

        document
            .getElementById("servicioVehiculo")
            ?.addEventListener("change", async () => {
                await cargarDispositivoVehiculo();
            });
    }


    async function abrirNuevo() {
        state.servicioEditandoId = null;
        state.vehiculos = [];

        document.getElementById("modalServicioTitulo").textContent =
            "Nuevo servicio";

        document.getElementById("formServicio").reset();

        prepararVehiculosVacios();
        prepararDispositivoVacio();

        try {
            await cargarCatalogos();

            establecerFechaMinima();
            ServiciosAdmin.mostrarModal("modalServicio");

        } catch (error) {
            ServiciosAdmin.mostrarToast(
                error.message || "No se pudieron cargar los catálogos.",
                "error"
            );
        }
    }


    async function abrirEditar(servicioId) {
        state.servicioEditandoId = Number(servicioId);

        try {
            const [catalogos, response] = await Promise.all([
                cargarCatalogos(),
                TrackAPI.obtenerAdminServicioProgramado(servicioId)
            ]);

            void catalogos;

            const servicio = response.servicio;

            if (!servicio) {
                throw new Error(
                    "No se encontró la información del servicio."
                );
            }

            document.getElementById("modalServicioTitulo").textContent =
                "Editar servicio";

            document.getElementById("servicioEmpresa").value =
                String(servicio.empresa_id || "");

            await cargarVehiculosEmpresa({
                vehiculoSeleccionadoId: servicio.vehiculo_id
            });

            if (servicio.vehiculo_id) {
                await cargarDispositivoVehiculo({
                    dispositivoSeleccionadoId: servicio.dispositivo_id
                });
            } else {
                prepararDispositivoVacio();
            }

            document.getElementById("servicioTipo").value =
                servicio.tipo || "";

            document.getElementById("servicioTecnico").value =
                String(servicio.tecnico_id || "");

            document.getElementById("servicioFechaProgramada").value =
                timestampAInputDatetime(servicio.fecha_programada);

            document.getElementById("servicioDescripcion").value =
                servicio.descripcion || "";

            document.getElementById("servicioCostoEstimado").value =
                servicio.costo_estimado ?? 0;

            ServiciosAdmin.mostrarModal("modalServicio");

        } catch (error) {
            ServiciosAdmin.mostrarToast(
                error.message || "No se pudo cargar el servicio.",
                "error"
            );
        }
    }


    async function cargarCatalogos() {
        const response = await TrackAPI.obtenerAdminCatalogosServicios();

        state.catalogos.empresas = Array.isArray(response.empresas)
            ? response.empresas
            : [];

        state.catalogos.tecnicos = Array.isArray(response.tecnicos)
            ? response.tecnicos
            : [];

        renderizarEmpresas();
        renderizarTecnicos();
    }


    function renderizarEmpresas() {
        const select = document.getElementById("servicioEmpresa");
        if (!select) return;

        const valorActual = select.value;

        select.innerHTML = `
            <option value="">Selecciona una empresa</option>

            ${state.catalogos.empresas.map(empresa => `
                <option value="${empresa.id}">
                    ${escapeHtml(empresa.nombre)}
                </option>
            `).join("")}
        `;

        const existe = state.catalogos.empresas.some(
            empresa => String(empresa.id) === String(valorActual)
        );

        if (existe) {
            select.value = valorActual;
        }
    }


    function renderizarTecnicos() {
        const select = document.getElementById("servicioTecnico");
        if (!select) return;

        const valorActual = select.value;

        select.innerHTML = `
            <option value="">Sin técnico asignado</option>

            ${state.catalogos.tecnicos.map(tecnico => `
                <option value="${tecnico.id}">
                    ${escapeHtml(tecnico.nombre)}
                </option>
            `).join("")}
        `;

        const existe = state.catalogos.tecnicos.some(
            tecnico => String(tecnico.id) === String(valorActual)
        );

        if (existe) {
            select.value = valorActual;
        }
    }


    async function cargarVehiculosEmpresa({
        vehiculoSeleccionadoId = null
    } = {}) {
        const empresaId = Number(
            document.getElementById("servicioEmpresa")?.value
        );

        const select = document.getElementById("servicioVehiculo");

        if (!select) return;

        if (!empresaId) {
            state.vehiculos = [];
            prepararVehiculosVacios();
            prepararDispositivoVacio();
            return;
        }

        select.disabled = true;
        select.innerHTML = `
            <option value="">Cargando vehículos...</option>
        `;

        try {
            const response = await TrackAPI.obtenerAdminVehiculosEmpresaServicio(
                empresaId
            );

            state.vehiculos = Array.isArray(response.vehiculos)
                ? response.vehiculos
                : [];

            select.innerHTML = `
                <option value="">Sin vehículo asignado</option>

                ${state.vehiculos.map(vehiculo => `
                    <option value="${vehiculo.id}">
                        ${escapeHtml(vehiculo.nombre)}
                        ${vehiculo.placa
                            ? ` · ${escapeHtml(vehiculo.placa)}`
                            : ""}
                    </option>
                `).join("")}
            `;

            select.disabled = false;

            if (vehiculoSeleccionadoId) {
                select.value = String(vehiculoSeleccionadoId);
            }

        } catch (error) {
            prepararVehiculosVacios();

            ServiciosAdmin.mostrarToast(
                error.message || "No se pudieron cargar los vehículos.",
                "error"
            );
        }
    }


    async function cargarDispositivoVehiculo({
        dispositivoSeleccionadoId = null
    } = {}) {
        const vehiculoId = Number(
            document.getElementById("servicioVehiculo")?.value
        );

        const select = document.getElementById(
            "servicioDispositivo"
        );

        if (!select) return;

        if (!vehiculoId) {
            prepararDispositivoVacio();
            return;
        }

        select.disabled = true;
        select.innerHTML = `
            <option value="">Buscando dispositivo...</option>
        `;

        try {
            const response = await TrackAPI.obtenerAdminDispositivoVehiculoServicio(
                vehiculoId
            );

            const dispositivo = response.dispositivo;

            if (!dispositivo) {
                select.innerHTML = `
                    <option value="">
                        El vehículo no tiene dispositivo instalado
                    </option>
                `;

                select.disabled = true;
                return;
            }

            select.innerHTML = `
                <option value="${dispositivo.id}">
                    ${escapeHtml(dispositivo.serie)}
                </option>
            `;

            select.disabled = false;

            select.value = String(
                dispositivoSeleccionadoId || dispositivo.id
            );

        } catch (error) {
            prepararDispositivoVacio();

            ServiciosAdmin.mostrarToast(
                error.message || "No se pudo cargar el dispositivo.",
                "error"
            );
        }
    }


    async function guardarServicio(event) {
        event.preventDefault();

        const empresaId = Number(
            document.getElementById("servicioEmpresa").value
        );

        const tipo = document.getElementById(
            "servicioTipo"
        ).value;

        const tecnicoId = numeroNullable(
            document.getElementById("servicioTecnico").value
        );

        const vehiculoId = numeroNullable(
            document.getElementById("servicioVehiculo").value
        );

        const dispositivoId = numeroNullable(
            document.getElementById("servicioDispositivo").value
        );

        const fechaProgramada = inputDatetimeATimestamp(
            document.getElementById("servicioFechaProgramada").value
        );

        const descripcion = document.getElementById(
            "servicioDescripcion"
        ).value.trim();

        const costoEstimado = Number(
            document.getElementById("servicioCostoEstimado").value || 0
        );

        if (!empresaId) {
            mostrarError("Selecciona una empresa.");
            return;
        }

        if (!tipo) {
            mostrarError("Selecciona un tipo de servicio.");
            return;
        }

        if (!fechaProgramada) {
            mostrarError("Selecciona una fecha programada válida.");
            return;
        }

        if (!Number.isFinite(costoEstimado) || costoEstimado < 0) {
            mostrarError("El costo estimado debe ser válido y no negativo.");
            return;
        }

        const data = {
            empresa_id: empresaId,
            vehiculo_id: vehiculoId,
            dispositivo_id: dispositivoId,
            tecnico_id: tecnicoId,
            tipo,
            descripcion,
            costo_estimado: costoEstimado,
            fecha_programada: fechaProgramada
        };

        const boton = document.getElementById(
            "btnGuardarServicio"
        );

        bloquearBoton(
            boton,
            true,
            "Guardando..."
        );

        try {
            const response = state.servicioEditandoId
                ? await TrackAPI.editarAdminServicioProgramado(
                    state.servicioEditandoId,
                    data
                )
                : await TrackAPI.crearAdminServicioProgramado(
                    data
                );

            ServiciosAdmin.mostrarToast(
                response.mensaje || "Servicio guardado correctamente.",
                "success"
            );

            cerrarModalServicio();
            await ServiciosAdmin.recargar();

        } catch (error) {
            mostrarError(
                error.message || "No se pudo guardar el servicio."
            );

        } finally {
            bloquearBoton(
                boton,
                false,
                "Guardar servicio"
            );
        }
    }


    function prepararVehiculosVacios() {
        const select = document.getElementById("servicioVehiculo");

        if (!select) return;

        select.disabled = true;
        select.innerHTML = `
            <option value="">
                Selecciona primero una empresa
            </option>
        `;
    }


    function prepararDispositivoVacio() {
        const select = document.getElementById(
            "servicioDispositivo"
        );

        if (!select) return;

        select.disabled = true;
        select.innerHTML = `
            <option value="">
                Sin dispositivo seleccionado
            </option>
        `;
    }


    function cerrarModalServicio() {
        ServiciosAdmin.ocultarModal("modalServicio");

        state.servicioEditandoId = null;
        state.vehiculos = [];
    }


    function establecerFechaMinima() {
        const input = document.getElementById(
            "servicioFechaProgramada"
        );

        if (!input) return;

        const ahora = new Date();
        input.min = fechaAInputDatetime(ahora);
    }


    function inputDatetimeATimestamp(valor) {
        if (!valor) return null;

        const fecha = new Date(valor);

        if (Number.isNaN(fecha.getTime())) {
            return null;
        }

        return Math.floor(fecha.getTime() / 1000);
    }


    function timestampAInputDatetime(timestamp) {
        const numero = Number(timestamp);

        if (!numero) return "";

        const fecha = new Date(numero * 1000);

        if (Number.isNaN(fecha.getTime())) {
            return "";
        }

        return fechaAInputDatetime(fecha);
    }


    function fechaAInputDatetime(fecha) {
        const pad = valor => String(valor).padStart(2, "0");

        return [
            fecha.getFullYear(),
            "-",
            pad(fecha.getMonth() + 1),
            "-",
            pad(fecha.getDate()),
            "T",
            pad(fecha.getHours()),
            ":",
            pad(fecha.getMinutes())
        ].join("");
    }


    function numeroNullable(valor) {
        if (valor === "" || valor == null) {
            return null;
        }

        const numero = Number(valor);

        return Number.isInteger(numero)
            ? numero
            : null;
    }


    function escapeHtml(valor) {
        return ServiciosAdmin?.escapar
            ? ServiciosAdmin.escapar(valor)
            : String(valor ?? "");
    }


    function mostrarError(mensaje) {
        ServiciosAdmin.mostrarToast(
            mensaje,
            "error"
        );
    }


    function bloquearBoton(boton, bloquear, texto) {
        if (!boton) return;

        boton.disabled = bloquear;
        boton.textContent = texto;
    }


    window.ServiciosFormulario = {
        abrirNuevo,
        abrirEditar
    };
})();
