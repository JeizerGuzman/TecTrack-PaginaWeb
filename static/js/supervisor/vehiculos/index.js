document.addEventListener("DOMContentLoaded", async () => {
    // ============================================================
    // VALIDAR SESIÓN
    // ============================================================

    if (
        window.TrackGuards?.requireAuth &&
        !(await window.TrackGuards.requireAuth())
    ) {
        return;
    }

    // ============================================================
    // REFERENCIAS DEL DOM
    // ============================================================

    const $ = (id) => document.getElementById(id);

    const listado = $("vehiculosListado");
    const buscarInput = $("buscarVehiculo");
    const filtroEstado = $("filtroEstadoVehiculo");

    const statTotal = $("statVehiculosTotal");
    const statActivos = $("statVehiculosActivos");
    const statAlertas = $("statVehiculosAlerta");
    const statPendientes = $("statVehiculosPendientes");

    const contadorVehiculos = $("contadorVehiculos");

    // ============================================================
    // ESTADO LOCAL
    // ============================================================

    let vehiculos = [];
    let cargando = false;
    let intervalo = null;

    // ============================================================
    // EVENTOS
    // ============================================================

    buscarInput?.addEventListener(
        "input",
        aplicarFiltros
    );

    filtroEstado?.addEventListener(
        "change",
        aplicarFiltros
    );

    // ============================================================
    // INICIALIZACIÓN
    // ============================================================

    await cargarVehiculos();

    await iniciarActualizacion();

    // ============================================================
    // CARGAR VEHÍCULOS
    // ============================================================

    async function cargarVehiculos(
        silencioso = false
    ) {
        if (cargando) return;

        cargando = true;

        try {
            const response =
                await TrackAPI.obtenerVehiculos({
                    incluirDesactivados: true
                });

            vehiculos =
                response?.vehiculos || [];

            renderStats();
            aplicarFiltros();

        } catch (error) {
            console.error(
                "Error cargando vehículos:",
                error
            );

            if (!silencioso && listado) {
                listado.innerHTML =
                    crearEstadoVacio(
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
        const texto =
            (buscarInput?.value || "")
                .trim()
                .toLowerCase();

        const estado =
            filtroEstado?.value || "todos";

        const filtrados =
            vehiculos.filter((vehiculo) => {

                // --------------------------------------------
                // Búsqueda por varios campos
                // --------------------------------------------

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
                    valoresBusqueda.some(
                        (valor) =>
                            String(valor || "")
                                .toLowerCase()
                                .includes(texto)
                    );

                // --------------------------------------------
                // Filtro de estado
                // --------------------------------------------

                const coincideEstado =
                    estado === "todos" ||
                    normalizarEstado(vehiculo) ===
                        estado;

                return (
                    coincideTexto &&
                    coincideEstado
                );
            });

        renderVehiculos(filtrados);

        if (contadorVehiculos) {
            contadorVehiculos.textContent =
                `${filtrados.length} de ${vehiculos.length} unidades`;
        }
    }

    // ============================================================
    // ESTADÍSTICAS
    // ============================================================

    function renderStats() {
        const total =
            vehiculos.length;

        const activos =
            vehiculos.filter(
                (vehiculo) =>
                    normalizarEstado(
                        vehiculo
                    ) === "activo"
            ).length;

        const alertas =
            vehiculos.filter(
                (vehiculo) =>
                    normalizarEstado(
                        vehiculo
                    ) === "alerta"
            ).length;

        const pendientes =
            vehiculos.filter(
                (vehiculo) => {
                    const estado =
                        normalizarEstado(
                            vehiculo
                        );

                    return [
                        "sin_senal",
                        "sin_dispositivo"
                    ].includes(estado);
                }
            ).length;

        if (statTotal) {
            statTotal.textContent =
                total;
        }

        if (statActivos) {
            statActivos.textContent =
                activos;
        }

        if (statAlertas) {
            statAlertas.textContent =
                alertas;
        }

        if (statPendientes) {
            statPendientes.textContent =
                pendientes;
        }
    }

    // ============================================================
    // RENDERIZAR VEHÍCULOS
    // ============================================================

    function renderVehiculos(items) {
        if (!listado) return;

        if (!items.length) {
            listado.innerHTML =
                crearEstadoVacio(
                    "No hay vehículos para mostrar",
                    "No se encontraron unidades con los filtros seleccionados."
                );

            return;
        }

        listado.innerHTML =
            items
                .map((vehiculo) => {

                    const estado =
                        normalizarEstado(
                            vehiculo
                        );

                    const etiquetaEstado =
                        formatearEstado(
                            estado
                        );

                    return `
                        <article class="vehiculo-card">

                            <!-- ============================== -->
                            <!-- ENCABEZADO DE LA TARJETA       -->
                            <!-- ============================== -->

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

                                <span
                                    class="badge badge-${estado}"
                                >
                                    ${escapeHtml(
                                        etiquetaEstado
                                    )}
                                </span>

                            </div>


                            <!-- ============================== -->
                            <!-- INFORMACIÓN DEL VEHÍCULO       -->
                            <!-- ============================== -->

                            <div class="vehiculo-card-body">

                                ${crearDatoVehiculo(
                                    "Marca",
                                    vehiculo.marca ||
                                        "Sin registrar"
                                )}

                                ${crearDatoVehiculo(
                                    "Modelo",
                                    vehiculo.modelo ||
                                        "Sin registrar"
                                )}

                                ${crearDatoVehiculo(
                                    "Año",
                                    vehiculo.anio ||
                                        "—"
                                )}

                                ${crearDatoVehiculo(
                                    "Placa",
                                    vehiculo.placa ||
                                        "Sin placa"
                                )}

                            </div>


                            <!-- ============================== -->
                            <!-- ÚNICA ACCIÓN DEL SUPERVISOR    -->
                            <!-- ============================== -->

                            <div class="vehiculo-card-footer">

                                <a
                                    class="btn btn-outline btn-sm"
                                    href="/supervisor/vehiculos/${encodeURIComponent(
                                        vehiculo.id
                                    )}"
                                >
                                    Ver detalle
                                </a>

                            </div>

                        </article>
                    `;
                })
                .join("");
    }

    // ============================================================
    // CREAR BLOQUE DE INFORMACIÓN
    // ============================================================

    function crearDatoVehiculo(
        etiqueta,
        valor
    ) {
        return `
            <div class="vehiculo-info">

                <span>
                    ${escapeHtml(etiqueta)}
                </span>

                <strong>
                    ${escapeHtml(
                        String(valor)
                    )}
                </strong>

            </div>
        `;
    }

    // ============================================================
    // NORMALIZAR ESTADO
    // ============================================================

    function normalizarEstado(
        vehiculo
    ) {
        // --------------------------------------------
        // Vehículo desactivado
        // --------------------------------------------

        if (
            vehiculo.activo === false
        ) {
            return "desactivado";
        }

        // --------------------------------------------
        // Sin dispositivo
        // --------------------------------------------

        if (
            !vehiculo.dispositivo_id &&
            !vehiculo.dispositivo_serie
        ) {
            return "sin_dispositivo";
        }

        const estado =
            String(
                vehiculo.estado || ""
            ).toLowerCase();

        const tieneAlerta =
            Number(
                vehiculo.alerta
            ) === 1;

        const tieneVibracion =
            Number(
                vehiculo.vibracion
            ) === 1;

        const puertaAbierta =
            String(
                vehiculo.puerta || ""
            ).toLowerCase() ===
            "abierta";

        const estadoAlerta =
            /alert|panic|panico/.test(
                estado
            );

        // --------------------------------------------
        // Estado de alerta
        // --------------------------------------------

        if (
            tieneAlerta ||
            tieneVibracion ||
            puertaAbierta ||
            estadoAlerta
        ) {
            return "alerta";
        }

        // --------------------------------------------
        // Sin señal
        // --------------------------------------------

        if (
            /sin|off/.test(
                estado
            )
        ) {
            return "sin_senal";
        }

        // --------------------------------------------
        // Estado normal
        // --------------------------------------------

        return "activo";
    }

    // ============================================================
    // TEXTO DEL ESTADO
    // ============================================================

    function formatearEstado(
        estado
    ) {
        const estados = {
            activo:
                "Activo",

            alerta:
                "Con alerta",

            sin_senal:
                "Sin señal",

            sin_dispositivo:
                "Sin dispositivo",

            desactivado:
                "Desactivado"
        };

        return (
            estados[estado] ||
            "Activo"
        );
    }

    // ============================================================
    // ESTADO VACÍO
    // ============================================================

    function crearEstadoVacio(
        titulo,
        mensaje
    ) {
        return `
            <div class="empty-state">

                <strong>
                    ${escapeHtml(
                        titulo
                    )}
                </strong>

                <p>
                    ${escapeHtml(
                        mensaje
                    )}
                </p>

            </div>
        `;
    }

    // ============================================================
    // ACTUALIZACIÓN AUTOMÁTICA
    // ============================================================

    async function iniciarActualizacion() {
        let intervaloMs =
            5000;

        try {
            if (
                window.TrackConfig
                    ?.obtenerOperacionMs
            ) {
                intervaloMs =
                    await TrackConfig
                        .obtenerOperacionMs(
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

        if (intervalo) {
            clearInterval(
                intervalo
            );
        }

        intervalo =
            setInterval(
                () => {
                    cargarVehiculos(
                        true
                    );
                },
                intervaloMs
            );
    }

    // ============================================================
    // SEGURIDAD PARA TEXTO HTML
    // ============================================================

    function escapeHtml(valor) {
        const elemento =
            document.createElement(
                "div"
            );

        elemento.textContent =
            valor ?? "";

        return elemento.innerHTML;
    }

    // ============================================================
    // LIMPIEZA
    // ============================================================

    window.addEventListener(
        "beforeunload",
        () => {
            if (intervalo) {
                clearInterval(
                    intervalo
                );
            }
        }
    );
});