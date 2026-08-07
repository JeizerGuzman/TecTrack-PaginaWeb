document.addEventListener("DOMContentLoaded", async () => {
    if (
        window.TrackGuards?.requireAuth &&
        !(await window.TrackGuards.requireAuth())
    ) {
        return;
    }

    const $ = (id) => document.getElementById(id);

    const listado = $("vehiculosListado");
    const buscarInput = $("buscarVehiculo");
    const filtroEstado = $("filtroEstadoVehiculo");

    let vehiculos = [];
    let seleccionadoDesactivar = null;
    let seleccionadoReactivar = null;
    let cargando = false;
    let intervalo = null;

    configurarModales();
    configurarFormularios();

    buscarInput?.addEventListener("input", aplicarFiltros);
    filtroEstado?.addEventListener("change", aplicarFiltros);

    $("btnAbrirModalNuevoVehiculo")?.addEventListener(
        "click",
        abrirModalNuevo
    );

    $("btnConfirmarDesactivarVehiculo")?.addEventListener(
        "click",
        confirmarDesactivar
    );

    $("btnConfirmarReactivarVehiculo")?.addEventListener(
        "click",
        confirmarReactivar
    );

    await cargarVehiculos();

    abrirModalDesdeURL();
    iniciarActualizacion();

    // ============================================================
    // CARGAR VEHÍCULOS
    // ============================================================

    async function cargarVehiculos(silencioso = false) {
        if (cargando) return;

        cargando = true;

        try {
            const response = await TrackAPI.obtenerVehiculos({
                incluirDesactivados: true
            });

            vehiculos = response.vehiculos || [];

            renderStats();
            aplicarFiltros();
        } catch (error) {
            console.error("Error cargando vehículos:", error);

            if (!silencioso && listado) {
                listado.innerHTML = estadoVacio(
                    "No se pudieron cargar los vehículos",
                    error.message ||
                        "Ocurrió un error al consultar la flota."
                );
            }
        } finally {
            cargando = false;
        }
    }

    // ============================================================
    // FILTROS
    // ============================================================

    function aplicarFiltros() {
        const texto = (buscarInput?.value || "")
            .trim()
            .toLowerCase();

        const estado = filtroEstado?.value || "todos";

        const filtrados = vehiculos.filter((vehiculo) => {
            const valoresBusqueda = [
                vehiculo.nombre,
                vehiculo.identificador,
                vehiculo.placa,
                vehiculo.marca,
                vehiculo.modelo,
                vehiculo.chofer_nombre
            ];

            const coincideTexto =
                !texto ||
                valoresBusqueda.some((valor) =>
                    String(valor || "")
                        .toLowerCase()
                        .includes(texto)
                );

            const coincideEstado =
                estado === "todos" ||
                normalizarEstado(vehiculo) === estado;

            return coincideTexto && coincideEstado;
        });

        renderVehiculos(filtrados);

        const contador = $("contadorVehiculos");

        if (contador) {
            contador.textContent =
                `${filtrados.length} de ${vehiculos.length} unidades`;
        }
    }

    // ============================================================
    // ESTADÍSTICAS
    // ============================================================

    function renderStats() {
        const total = vehiculos.length;

        const activos = vehiculos.filter(
            (vehiculo) =>
                normalizarEstado(vehiculo) === "activo"
        ).length;

        const alertas = vehiculos.filter(
            (vehiculo) =>
                normalizarEstado(vehiculo) === "alerta"
        ).length;

        const pendientes = vehiculos.filter((vehiculo) =>
            ["sin_senal", "sin_dispositivo"].includes(
                normalizarEstado(vehiculo)
            )
        ).length;

        const statTotal = $("statVehiculosTotal");
        const statActivos = $("statVehiculosActivos");
        const statAlertas = $("statVehiculosAlerta");
        const statPendientes = $("statVehiculosPendientes");

        if (statTotal) statTotal.textContent = total;
        if (statActivos) statActivos.textContent = activos;
        if (statAlertas) statAlertas.textContent = alertas;
        if (statPendientes) statPendientes.textContent = pendientes;
    }

    // ============================================================
    // RENDERIZAR TARJETAS
    // ============================================================

    function renderVehiculos(items) {
        if (!listado) return;

        if (!items.length) {
            listado.innerHTML = estadoVacio(
                "No hay vehículos para mostrar",
                "Prueba con otros filtros o registra una nueva unidad."
            );

            return;
        }

        listado.innerHTML = items
            .map((vehiculo) => {
                const estado = normalizarEstado(vehiculo);
                const etiquetaEstado = formatearEstado(estado);

                return `
                    <article class="vehiculo-card">

                        <div class="vehiculo-card-header">
                            <div>
                                <h3>
                                    ${escapeHtml(
                                        vehiculo.nombre ||
                                        "Vehículo sin nombre"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHtml(
                                        vehiculo.identificador ||
                                        "Sin identificador"
                                    )}
                                    · Chofer:
                                    ${escapeHtml(
                                        vehiculo.chofer_nombre ||
                                        "Sin asignar"
                                    )}
                                </p>
                            </div>

                            <span class="badge badge-${estado}">
                                ${etiquetaEstado}
                            </span>
                        </div>

                        <div class="vehiculo-card-body">
                            ${crearDatoVehiculo(
                                "Marca",
                                vehiculo.marca || "Sin registrar"
                            )}

                            ${crearDatoVehiculo(
                                "Modelo",
                                vehiculo.modelo || "Sin registrar"
                            )}

                            ${crearDatoVehiculo(
                                "Año",
                                vehiculo.anio || "—"
                            )}

                            ${crearDatoVehiculo(
                                "Placa",
                                vehiculo.placa || "Sin placa"
                            )}
                        </div>

                        <div class="vehiculo-card-footer">

                            <a
                                class="btn btn-outline btn-sm"
                                href="/dueno/vehiculos/${encodeURIComponent(
                                    vehiculo.id
                                )}"
                            >
                                Ver detalle
                            </a>

                            <button
                                type="button"
                                class="btn btn-outline btn-sm btn-editar"
                                data-action="editar"
                                data-id="${escapeHtml(vehiculo.id)}"
                            >
                                Editar
                            </button>

                            ${
                                vehiculo.activo === false
                                    ? `
                                        <button
                                            type="button"
                                            class="btn btn-primary btn-sm btn-reactivar-vehiculo"
                                            data-action="reactivar"
                                            data-id="${escapeHtml(
                                                vehiculo.id
                                            )}"
                                        >
                                            Reactivar
                                        </button>
                                    `
                                    : `
                                        <button
                                            type="button"
                                            class="btn btn-danger-outline btn-sm btn-desactivar-vehiculo"
                                            data-action="desactivar"
                                            data-id="${escapeHtml(
                                                vehiculo.id
                                            )}"
                                        >
                                            Desactivar
                                        </button>
                                    `
                            }

                        </div>
                    </article>
                `;
            })
            .join("");

        configurarEventosTarjetas();
    }

    function configurarEventosTarjetas() {
        listado
            .querySelectorAll("[data-action]")
            .forEach((boton) => {
                boton.addEventListener("click", () => {
                    const vehiculoId = Number(boton.dataset.id);

                    const vehiculo = vehiculos.find(
                        (item) =>
                            Number(item.id) === vehiculoId
                    );

                    if (!vehiculo) {
                        mostrarToast(
                            "No se encontró el vehículo seleccionado.",
                            "error"
                        );

                        return;
                    }

                    const accion = boton.dataset.action;

                    if (accion === "editar") {
                        abrirModalEditar(vehiculo.id);
                        return;
                    }

                    if (accion === "desactivar") {
                        abrirConfirmacionDesactivar(vehiculo);
                        return;
                    }

                    if (accion === "reactivar") {
                        abrirConfirmacionReactivar(vehiculo);
                    }
                });
            });
    }

    // ============================================================
    // CONFIGURACIÓN DE MODALES
    // ============================================================

    function configurarModales() {
        document
            .querySelectorAll("[data-close-modal]")
            .forEach((boton) => {
                boton.addEventListener("click", () => {
                    cerrarModal(boton.dataset.closeModal);
                });
            });

        document
            .querySelectorAll(".modal-vehiculo-overlay")
            .forEach((modal) => {
                modal.addEventListener("mousedown", (evento) => {
                    if (evento.target === modal) {
                        cerrarModal(modal.id);
                    }
                });
            });

        document.addEventListener("keydown", (evento) => {
            if (evento.key !== "Escape") return;

            document
                .querySelectorAll(
                    ".modal-vehiculo-overlay.visible"
                )
                .forEach((modal) => {
                    cerrarModal(modal.id);
                });
        });
    }

    function abrirModal(id) {
        const modal = $(id);

        if (!modal) return;

        modal.classList.add("visible");
        modal.setAttribute("aria-hidden", "false");

        document.body.classList.add("modal-open");

        setTimeout(() => {
            modal
                .querySelector(
                    "input:not([type='hidden']), select, textarea, button"
                )
                ?.focus();
        }, 30);
    }

    function cerrarModal(id) {
        const modal = $(id);

        if (!modal) return;

        modal.classList.remove("visible");
        modal.setAttribute("aria-hidden", "true");

        const existenModalesAbiertos = document.querySelector(
            ".modal-vehiculo-overlay.visible"
        );

        if (!existenModalesAbiertos) {
            document.body.classList.remove("modal-open");
        }

        limpiarQueryModal();
    }

    // ============================================================
    // MODAL NUEVO VEHÍCULO
    // ============================================================

    async function abrirModalNuevo() {
        const formulario = $("formNuevoVehiculo");

        formulario?.reset();

        establecerMensaje(
            "mensajeVehiculoNuevo",
            "",
            ""
        );

        await cargarChoferes(
            $("nuevo_chofer_id")
        );

        abrirModal("modalNuevoVehiculo");
    }

    // ============================================================
    // MODAL EDITAR VEHÍCULO
    // ============================================================

    async function abrirModalEditar(id) {
        const formulario = $("formEditarVehiculo");

        formulario?.reset();

        establecerMensaje(
            "mensajeVehiculoEditar",
            "Cargando información...",
            ""
        );

        abrirModal("modalEditarVehiculo");

        try {
            const response =
                await TrackAPI.obtenerVehiculoDetalle(id);

            const vehiculo = response.vehiculo || {};

            const campoId = $("editar_vehiculo_id");

            if (campoId) {
                campoId.value = id;
            }

            const campos = [
                "nombre",
                "identificador",
                "placa",
                "marca",
                "modelo",
                "anio"
            ];

            campos.forEach((campo) => {
                const input = $(`editar_${campo}`);

                if (input) {
                    input.value =
                        vehiculo[campo] ?? "";
                }
            });

            await cargarChoferes(
                $("editar_chofer_id"),
                vehiculo.chofer_id,
                id
            );

            const botonDetalle =
                $("btnDetalleDesdeEditar");

            if (botonDetalle) {
                botonDetalle.href =
                    `/dueno/vehiculos/${id}`;
            }

            establecerMensaje(
                "mensajeVehiculoEditar",
                "",
                ""
            );
        } catch (error) {
            console.error(
                "Error cargando vehículo:",
                error
            );

            establecerMensaje(
                "mensajeVehiculoEditar",
                error.message ||
                    "No se pudo cargar el vehículo.",
                "error"
            );
        }
    }

    // ============================================================
    // FORMULARIOS
    // ============================================================

    function configurarFormularios() {
        $("formNuevoVehiculo")?.addEventListener(
            "submit",
            async (evento) => {
                evento.preventDefault();

                const boton = $("btnGuardarVehiculo");

                bloquearBoton(
                    boton,
                    true,
                    "Guardando..."
                );

                establecerMensaje(
                    "mensajeVehiculoNuevo",
                    "",
                    ""
                );

                try {
                    await TrackAPI.crearVehiculo(
                        crearPayload("nuevo")
                    );

                    cerrarModal(
                        "modalNuevoVehiculo"
                    );

                    await cargarVehiculos();

                    mostrarToast(
                        "Vehículo creado correctamente.",
                        "success"
                    );
                } catch (error) {
                    console.error(
                        "Error creando vehículo:",
                        error
                    );

                    establecerMensaje(
                        "mensajeVehiculoNuevo",
                        error.message ||
                            "No se pudo crear el vehículo.",
                        "error"
                    );
                } finally {
                    bloquearBoton(
                        boton,
                        false,
                        "Guardar vehículo"
                    );
                }
            }
        );

        $("formEditarVehiculo")?.addEventListener(
            "submit",
            async (evento) => {
                evento.preventDefault();

                const id = Number(
                    $("editar_vehiculo_id")?.value
                );

                const boton =
                    $("btnGuardarCambiosVehiculo");

                if (!id) {
                    establecerMensaje(
                        "mensajeVehiculoEditar",
                        "No se encontró el identificador del vehículo.",
                        "error"
                    );

                    return;
                }

                bloquearBoton(
                    boton,
                    true,
                    "Guardando..."
                );

                establecerMensaje(
                    "mensajeVehiculoEditar",
                    "",
                    ""
                );

                try {
                    await TrackAPI.editarVehiculo(
                        id,
                        crearPayload("editar")
                    );

                    cerrarModal(
                        "modalEditarVehiculo"
                    );

                    await cargarVehiculos();

                    mostrarToast(
                        "Vehículo actualizado correctamente.",
                        "success"
                    );
                } catch (error) {
                    console.error(
                        "Error editando vehículo:",
                        error
                    );

                    establecerMensaje(
                        "mensajeVehiculoEditar",
                        error.message ||
                            "No se pudo actualizar el vehículo.",
                        "error"
                    );
                } finally {
                    bloquearBoton(
                        boton,
                        false,
                        "Guardar cambios"
                    );
                }
            }
        );
    }

    function crearPayload(prefijo) {
        const obtenerValor = (campo) => {
            return $(`${prefijo}_${campo}`)
                ?.value
                ?.trim() || "";
        };

        const anio = parseInt(
            obtenerValor("anio") || "0",
            10
        );

        const choferId = parseInt(
            obtenerValor("chofer_id") || "0",
            10
        );

        return {
            nombre: obtenerValor("nombre"),
            identificador:
                obtenerValor("identificador"),
            placa: obtenerValor("placa"),
            marca: obtenerValor("marca"),
            modelo: obtenerValor("modelo"),
            anio: anio || null,
            chofer_id: choferId || null
        };
    }

    // ============================================================
    // CHOFERES
    // ============================================================

    async function cargarChoferes(
        select,
        seleccionado = null,
        vehiculoId = null
    ) {
        if (!select) return;

        select.innerHTML =
            '<option value="">Sin asignar</option>';

        if (!TrackAPI.obtenerChoferes) {
            return;
        }

        try {
            const response =
                await TrackAPI.obtenerChoferes(
                    vehiculoId
                );

            const choferes =
                response.choferes || [];

            choferes.forEach((chofer) => {
                const option =
                    document.createElement("option");

                option.value = chofer.id;

                option.textContent =
                    chofer.correo
                        ? `${chofer.nombre} · ${chofer.correo}`
                        : chofer.nombre;

                option.selected =
                    Number(chofer.id) ===
                    Number(seleccionado);

                select.appendChild(option);
            });
        } catch (error) {
            console.error(
                "Error cargando choferes:",
                error
            );

            select.innerHTML =
                '<option value="">No disponibles</option>';
        }
    }

    // ============================================================
    // DESACTIVAR VEHÍCULO
    // ============================================================

    function abrirConfirmacionDesactivar(vehiculo) {
        seleccionadoDesactivar = vehiculo;

        const nombre = $("modalVehiculoNombre");
        const placa = $("modalVehiculoPlaca");

        if (nombre) {
            nombre.textContent =
                vehiculo.nombre || "Vehículo";
        }

        if (placa) {
            placa.textContent =
                vehiculo.placa ||
                "Placa no registrada";
        }

        abrirModal("modalDesactivarVehiculo");
    }

    async function confirmarDesactivar() {
        if (!seleccionadoDesactivar) return;

        const boton =
            $("btnConfirmarDesactivarVehiculo");

        bloquearBoton(
            boton,
            true,
            "Desactivando..."
        );

        try {
            await TrackAPI.desactivarVehiculo(
                seleccionadoDesactivar.id
            );

            cerrarModal(
                "modalDesactivarVehiculo"
            );

            seleccionadoDesactivar = null;

            await cargarVehiculos();

            mostrarToast(
                "Vehículo desactivado.",
                "success"
            );
        } catch (error) {
            console.error(
                "Error desactivando vehículo:",
                error
            );

            mostrarToast(
                error.message ||
                    "No se pudo desactivar.",
                "error"
            );
        } finally {
            bloquearBoton(
                boton,
                false,
                "Desactivar"
            );
        }
    }

    // ============================================================
    // REACTIVAR VEHÍCULO
    // ============================================================

    function abrirConfirmacionReactivar(vehiculo) {
        seleccionadoReactivar = vehiculo;

        const nombre =
            $("modalReactivarVehiculoNombre");

        const placa =
            $("modalReactivarVehiculoPlaca");

        if (nombre) {
            nombre.textContent =
                vehiculo.nombre || "Vehículo";
        }

        if (placa) {
            placa.textContent =
                vehiculo.placa ||
                "Placa no registrada";
        }

        abrirModal("modalReactivarVehiculo");
    }

    async function confirmarReactivar() {
        if (!seleccionadoReactivar) return;

        const boton =
            $("btnConfirmarReactivarVehiculo");

        bloquearBoton(
            boton,
            true,
            "Reactivando..."
        );

        try {
            await TrackAPI.reactivarVehiculo(
                seleccionadoReactivar.id
            );

            cerrarModal(
                "modalReactivarVehiculo"
            );

            seleccionadoReactivar = null;

            await cargarVehiculos();

            mostrarToast(
                "Vehículo reactivado.",
                "success"
            );
        } catch (error) {
            console.error(
                "Error reactivando vehículo:",
                error
            );

            mostrarToast(
                error.message ||
                    "No se pudo reactivar.",
                "error"
            );
        } finally {
            bloquearBoton(
                boton,
                false,
                "Reactivar"
            );
        }
    }

    // ============================================================
    // MODALES MEDIANTE URL
    // ============================================================

    function abrirModalDesdeURL() {
        const parametros =
            new URLSearchParams(
                window.location.search
            );

        if (parametros.get("nuevo") === "1") {
            abrirModalNuevo();
        }

        const editarId =
            Number(parametros.get("editar"));

        if (editarId) {
            abrirModalEditar(editarId);
        }
    }

    function limpiarQueryModal() {
        if (!window.location.search) return;

        window.history.replaceState(
            {},
            "",
            window.location.pathname
        );
    }

    // ============================================================
    // ACTUALIZACIÓN AUTOMÁTICA
    // ============================================================

    async function iniciarActualizacion() {
        let intervaloMs = 5000;

        try {
            if (
                window.TrackConfig
                    ?.obtenerOperacionMs
            ) {
                intervaloMs =
                    await TrackConfig.obtenerOperacionMs(
                        "vehiculos",
                        5
                    );
            }
        } catch (error) {
            console.warn(
                "No se pudo obtener el intervalo de actualización:",
                error
            );
        }

        clearInterval(intervalo);

        intervalo = setInterval(() => {
            const modalAbierto =
                document.querySelector(
                    ".modal-vehiculo-overlay.visible"
                );

            if (!modalAbierto) {
                cargarVehiculos(true);
            }
        }, intervaloMs);
    }

    // ============================================================
    // ESTADOS
    // ============================================================

    function normalizarEstado(vehiculo) {
        if (vehiculo.activo === false) {
            return "desactivado";
        }

        if (
            !vehiculo.dispositivo_id &&
            !vehiculo.dispositivo_serie
        ) {
            return "sin_dispositivo";
        }

        const estado = String(
            vehiculo.estado || ""
        ).toLowerCase();

        const tieneAlerta =
            Number(vehiculo.alerta) === 1;

        const tieneVibracion =
            Number(vehiculo.vibracion) === 1;

        const puertaAbierta =
            String(
                vehiculo.puerta || ""
            ).toLowerCase() === "abierta";

        const estadoAlerta =
            /alert|panic|panico/.test(estado);

        if (
            tieneAlerta ||
            tieneVibracion ||
            puertaAbierta ||
            estadoAlerta
        ) {
            return "alerta";
        }

        if (/sin|off/.test(estado)) {
            return "sin_senal";
        }

        return "activo";
    }

    function formatearEstado(estado) {
        const estados = {
            activo: "Activo",
            alerta: "Con alerta",
            sin_senal: "Sin señal",
            sin_dispositivo: "Sin dispositivo",
            desactivado: "Desactivado"
        };

        return estados[estado] || "Activo";
    }

    // ============================================================
    // ELEMENTOS HTML AUXILIARES
    // ============================================================

    function crearDatoVehiculo(
        etiqueta,
        valor
    ) {
        return `
            <div class="vehiculo-info">
                <span>${escapeHtml(etiqueta)}</span>

                <strong>
                    ${escapeHtml(String(valor))}
                </strong>
            </div>
        `;
    }

    function estadoVacio(titulo, mensaje) {
        return `
            <div class="empty-state">
                <strong>
                    ${escapeHtml(titulo)}
                </strong>

                <p>
                    ${escapeHtml(mensaje)}
                </p>
            </div>
        `;
    }

    function bloquearBoton(
        boton,
        bloqueado,
        texto
    ) {
        if (!boton) return;

        boton.disabled = bloqueado;
        boton.textContent = texto;
    }

    function establecerMensaje(
        id,
        texto,
        tipo
    ) {
        const elemento = $(id);

        if (!elemento) return;

        elemento.textContent = texto;

        elemento.className =
            `form-message${tipo ? ` ${tipo}` : ""}`;
    }

    function mostrarToast(
        texto,
        tipo = "info"
    ) {
        const toast =
            document.createElement("div");

        /*
         * Se colocan las dos clases para mantener
         * compatibilidad con ambas versiones del CSS.
         */
        toast.className =
            `vehiculo-toast vehiculos-toast ${tipo}`;

        toast.textContent = texto;

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("visible");
        });

        setTimeout(() => {
            toast.classList.remove("visible");

            setTimeout(() => {
                toast.remove();
            }, 220);
        }, 2600);
    }

    function escapeHtml(valor) {
        const elemento =
            document.createElement("div");

        elemento.textContent =
            valor ?? "";

        return elemento.innerHTML;
    }

    // ============================================================
    // FUNCIONES GLOBALES
    // ============================================================

    window.abrirModalVehiculo =
        abrirModalNuevo;

    window.abrirModalEditarVehiculo =
        abrirModalEditar;

    // ============================================================
    // LIMPIEZA
    // ============================================================

    window.addEventListener(
        "beforeunload",
        () => {
            if (intervalo) {
                clearInterval(intervalo);
            }
        }
    );
});