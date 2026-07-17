/* ============================================================
   MONITOREO DEL SUPERVISOR - TrackSecurity
   ============================================================ */


let monitoreoVehiculos = [];

let monitoreoVehiculoSeleccionadoId = null;

let monitoreoCargando = false;

let monitoreoIntervaloId = null;


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        if (
            window.TrackGuards
                ?.requireAuth
        ) {

            const autorizado =
                await TrackGuards.requireAuth(
                    "supervisor"
                );


            if (!autorizado) {
                return;
            }

        }


        configurarEventosMonitoreo();


        await cargarMonitoreo(
            true
        );


        iniciarAutoActualizacionMonitoreo();

    }
);


/* ============================================================
   EVENTOS
   ============================================================ */

function configurarEventosMonitoreo() {

    document
        .getElementById(
            "buscarVehiculoMonitoreo"
        )
        ?.addEventListener(
            "input",
            renderVehiculosMonitoreo
        );


    document
        .getElementById(
            "filtroEstadoMonitoreo"
        )
        ?.addEventListener(
            "change",
            renderVehiculosMonitoreo
        );


    document
        .getElementById(
            "btnActualizarMonitoreo"
        )
        ?.addEventListener(
            "click",
            () => {

                cargarMonitoreo(
                    true
                );

            }
        );

}


/* ============================================================
   CARGAR MONITOREO
   ============================================================ */

async function cargarMonitoreo(
        mostrarCarga = false
    ) {

    if (monitoreoCargando) {
        return;
    }


    monitoreoCargando = true;


    if (mostrarCarga) {

        establecerEstadoCargaMonitoreo(
            true
        );

    }


    try {

        const respuesta =
            await TrackAPI.obtenerEstado();


        monitoreoVehiculos =
            Array.isArray(
                respuesta?.vehiculos
            )
                ? respuesta.vehiculos
                : [];


        pintarMetricasMonitoreo();


        renderVehiculosMonitoreo();


        mantenerSeleccionMonitoreo();


        actualizarUltimaActualizacionMonitoreo();


    } catch (error) {

        console.error(
            "Error cargando monitoreo:",
            error
        );


        const contenedor =
            document.getElementById(
                "listaVehiculosMonitoreo"
            );


        if (contenedor) {

            contenedor.innerHTML = `

                <div class="empty-state">

                    <strong>
                        No se pudo cargar el monitoreo
                    </strong>

                    <p>
                        ${escapeHtmlMonitoreo(
                            error.message ||
                            "Ocurrió un error al consultar la flota."
                        )}
                    </p>

                </div>

            `;

        }


    } finally {

        monitoreoCargando = false;


        if (mostrarCarga) {

            establecerEstadoCargaMonitoreo(
                false
            );

        }

    }

}


/* ============================================================
   AUTOACTUALIZACIÓN
   ============================================================ */

async function iniciarAutoActualizacionMonitoreo() {

    if (monitoreoIntervaloId) {

        clearInterval(
            monitoreoIntervaloId
        );

        monitoreoIntervaloId = null;

    }


    let segundos = 3;


    try {

        if (
            window.TrackConfig
                ?.obtenerIntervaloOperacion
        ) {

            segundos =
                Number(
                    TrackConfig.obtenerIntervaloOperacion(
                        "monitoreo"
                    )
                ) || 3;

        }

    } catch (error) {

        console.warn(
            "No se pudo obtener el intervalo de monitoreo:",
            error
        );

    }


    segundos =
        Math.max(
            1,
            segundos
        );


    monitoreoIntervaloId =
        setInterval(
            () => {

                cargarMonitoreo(
                    false
                );

            },

            segundos * 1000
        );

}


/* ============================================================
   MÉTRICAS
   ============================================================ */

function pintarMetricasMonitoreo() {

    const total =
        monitoreoVehiculos.length;


    const activos =
        monitoreoVehiculos.filter(
            (vehiculo) =>
                vehiculo.online === true
        ).length;

    const alertas =
        monitoreoVehiculos.filter(
            (vehiculo) => {

                const estado =
                    obtenerEstadoMonitoreo(
                        vehiculo
                    );


                return [
                    "alerta",
                    "panico",
                ].includes(estado);

            }
        ).length;


    const sinSenal =
        monitoreoVehiculos.filter(
            (vehiculo) =>
                obtenerEstadoMonitoreo(
                    vehiculo
                ) === "sin_senal"
        ).length;


    asignarTextoMonitoreo(
        "statMonitoreoTotal",
        total
    );


    asignarTextoMonitoreo(
        "statMonitoreoActivos",
        activos
    );


    asignarTextoMonitoreo(
        "statMonitoreoAlertas",
        alertas
    );


    asignarTextoMonitoreo(
        "statMonitoreoSinSenal",
        sinSenal
    );

}


/* ============================================================
   RENDER LISTA
   ============================================================ */

function renderVehiculosMonitoreo() {

    const contenedor =
        document.getElementById(
            "listaVehiculosMonitoreo"
        );


    if (!contenedor) {
        return;
    }


    const busqueda =
        normalizarMonitoreo(
            document
                .getElementById(
                    "buscarVehiculoMonitoreo"
                )
                ?.value || ""
        );


    const estadoFiltro =
        document
            .getElementById(
                "filtroEstadoMonitoreo"
            )
            ?.value || "";


    let vehiculos = [
        ...monitoreoVehiculos
    ];


    if (busqueda) {

        vehiculos =
            vehiculos.filter(
                (vehiculo) => {

                    const contenido =
                        normalizarMonitoreo(
                            [
                                vehiculo.nombre,
                                vehiculo.placa,
                                vehiculo.identificador,
                            ]
                                .filter(Boolean)
                                .join(" ")
                        );


                    return contenido.includes(
                        busqueda
                    );

                }
            );

    }


    if (estadoFiltro) {

        vehiculos =
            vehiculos.filter(
                (vehiculo) =>
                    obtenerEstadoMonitoreo(
                        vehiculo
                    ) === estadoFiltro
            );

    }


    actualizarCantidadVehiculosMonitoreo(
        vehiculos.length
    );


    if (!vehiculos.length) {

        contenedor.innerHTML = `

            <div class="empty-state">

                <strong>
                    No hay vehículos para mostrar
                </strong>

                <p>
                    No se encontraron vehículos con los filtros seleccionados.
                </p>

            </div>

        `;


        return;

    }


    contenedor.innerHTML =
        vehiculos
            .map(
                crearTarjetaVehiculoMonitoreo
            )
            .join("");


    contenedor
        .querySelectorAll(
            "[data-monitoreo-vehiculo]"
        )
        .forEach((boton) => {

            boton.addEventListener(
                "click",
                () => {

                    const vehiculoId =
                        Number(
                            boton.dataset
                                .monitoreoVehiculo
                        );


                    seleccionarVehiculoMonitoreo(
                        vehiculoId
                    );

                }
            );

        });

}


/* ============================================================
   TARJETA VEHÍCULO
   ============================================================ */

function crearTarjetaVehiculoMonitoreo(
    vehiculo
) {

    const estado =
        obtenerEstadoMonitoreo(
            vehiculo
        );


    const seleccionado =
        Number(
            vehiculo.id
        ) ===
        Number(
            monitoreoVehiculoSeleccionadoId
        );


    return `

        <button
            type="button"
            class="
                monitoreo-vehicle-item
                monitoreo-vehicle-${estado}
                ${seleccionado ? "selected" : ""}
            "
            data-monitoreo-vehiculo="${Number(
                vehiculo.id
            )}"
        >

            <span class="
                monitoreo-vehicle-status-dot
            "></span>


            <span class="
                monitoreo-vehicle-main
            ">

                <strong>
                    ${escapeHtmlMonitoreo(
                        vehiculo.nombre ||
                        "Vehículo"
                    )}
                    
                </strong>


                <small>

                    ${escapeHtmlMonitoreo(
                        vehiculo.placa ||
                        vehiculo.identificador ||
                        "Sin identificador"
                    )}

                </small>

            </span>


            <span class="
                monitoreo-vehicle-status
            ">

                ${escapeHtmlMonitoreo(
                    formatearEstadoMonitoreo(
                        estado
                    )
                )}

            </span>

        </button>

    `;

}


/* ============================================================
   SELECCIONAR VEHÍCULO
   ============================================================ */

function seleccionarVehiculoMonitoreo(
    vehiculoId
) {

    monitoreoVehiculoSeleccionadoId =
        Number(vehiculoId);


    renderVehiculosMonitoreo();


    pintarDetalleVehiculoMonitoreo();

}


/* ============================================================
   MANTENER SELECCIÓN
   ============================================================ */

function mantenerSeleccionMonitoreo() {

    if (
        !monitoreoVehiculos.length
    ) {

        monitoreoVehiculoSeleccionadoId =
            null;


        pintarDetalleVehiculoMonitoreo();


        return;

    }


    const existeSeleccion =
        monitoreoVehiculos.some(
            (vehiculo) =>
                Number(
                    vehiculo.id
                ) ===
                Number(
                    monitoreoVehiculoSeleccionadoId
                )
        );


    if (!existeSeleccion) {

        monitoreoVehiculoSeleccionadoId =
            Number(
                monitoreoVehiculos[0].id
            );

    }


    renderVehiculosMonitoreo();


    pintarDetalleVehiculoMonitoreo();

}


/* ============================================================
   DETALLE DEL VEHÍCULO
   ============================================================ */

function pintarDetalleVehiculoMonitoreo() {

    const vehiculo =
        monitoreoVehiculos.find(
            (item) =>
                Number(item.id) ===
                Number(
                    monitoreoVehiculoSeleccionadoId
                )
        );


    const nombre =
        document.getElementById(
            "monitoreoDetalleNombre"
        );


    const subtitulo =
        document.getElementById(
            "monitoreoDetalleSubtitulo"
        );


    const contenido =
        document.getElementById(
            "monitoreoDetalleContenido"
        );


    const botonDetalle =
        document.getElementById(
            "btnVerDetalleVehiculoMonitoreo"
        );


    if (
        !nombre ||
        !subtitulo ||
        !contenido ||
        !botonDetalle
    ) {
        return;
    }


    if (!vehiculo) {

        nombre.textContent =
            "Ningún vehículo seleccionado";


        subtitulo.textContent =
            "Selecciona un vehículo para consultar su estado.";


        botonDetalle.hidden = true;

        contenido.innerHTML = `

            <div class="empty-state">

                <strong>
                    Selecciona un vehículo
                </strong>

                <p>
                    Aquí aparecerán sus sensores,
                    ubicación, velocidad y estado actual.
                </p>

            </div>

        `;


        return;

    }


    const estado =
        obtenerEstadoMonitoreo(
            vehiculo
        );

    const direccionHtml =
        window.TrackDireccion
            ? TrackDireccion.renderDireccion(
                vehiculo
            )
            : "";


    nombre.textContent =
        vehiculo.nombre ||
        "Vehículo";


    subtitulo.textContent =
        [
            vehiculo.placa,
            vehiculo.identificador,
        ]
            .filter(Boolean)
            .join(" · ")
        ||
        "Sin identificador";


    botonDetalle.hidden = false;


    botonDetalle.href =
        `/supervisor/vehiculos/${Number(
            vehiculo.id
        )}`;


    contenido.innerHTML = `

        <div class="monitoreo-detail-status-row">

            <span class="
                monitoreo-detail-status
                monitoreo-status-${estado}
            ">

                ${escapeHtmlMonitoreo(
                    formatearEstadoMonitoreo(
                        estado
                    )
                )}

            </span>


            <span class="monitoreo-detail-updated">

                ${
                    vehiculo.ultima_conexion
                        ? `Última conexión: ${
                            escapeHtmlMonitoreo(
                                formatearFechaMonitoreo(
                                    vehiculo.ultima_conexion
                                )
                            )
                        }`
                        : "Sin conexión registrada"
                }

            </span>

        </div>


        <div class="monitoreo-detail-grid">


            ${crearDatoDetalleMonitoreo(
                "Puerta",
                formatearTextoMonitoreo(
                    vehiculo.puerta ||
                    "sin_datos"
                )
            )}


            ${crearDatoDetalleMonitoreo(
                "Vibración",
                vehiculo.vibracion === null ||
                vehiculo.vibracion === undefined
                    ? "Sin datos"
                    : (
                        Number(
                            vehiculo.vibracion
                        ) === 1
                            ? "Detectada"
                            : "Normal"
                    )
            )}


            ${crearDatoDetalleMonitoreo(
                "Velocidad",
                formatearVelocidadMonitoreo(
                    vehiculo.velocidad
                )
            )}


            ${crearDatoDetalleMonitoreo(
                "GPS",
                tieneGpsValidoMonitoreo(
                    vehiculo
                )
                    ? "Disponible"
                    : "No disponible"
            )}

            ${crearDatoDetalleMonitoreo(
                "Latitud",
                formatearCoordenadaMonitoreo(
                    vehiculo.lat
                )
            )}


            ${crearDatoDetalleMonitoreo(
                "Longitud",
                formatearCoordenadaMonitoreo(
                    vehiculo.lng
                )
            )}


        </div>
        ${direccionHtml}
    `;

}


/* ============================================================
   CREAR DATO DEL DETALLE
   ============================================================ */

function crearDatoDetalleMonitoreo(
    etiqueta,
    valor
) {

    return `

        <div class="monitoreo-detail-field">

            <span>
                ${escapeHtmlMonitoreo(
                    etiqueta
                )}
            </span>

            <strong>
                ${escapeHtmlMonitoreo(
                    valor
                )}
            </strong>

        </div>

    `;

}


/* ============================================================
   ESTADO DEL VEHÍCULO
   ============================================================ */

function obtenerEstadoMonitoreo(
    vehiculo
) {

    const estado =
        normalizarMonitoreo(
            vehiculo?.estado_mostrado ||
            vehiculo?.estado ||
            "sin_senal"
        );


    if (
        estado === "modo_manual"
    ) {

        return "manual";

    }


    return estado;

}


/* ============================================================
   ESTADO DE CARGA
   ============================================================ */

function establecerEstadoCargaMonitoreo(
    cargando
) {

    const estado =
        document.getElementById(
            "estadoActualizacionMonitoreo"
        );


    const boton =
        document.getElementById(
            "btnActualizarMonitoreo"
        );


    if (estado) {

        estado.textContent =
            cargando
                ? "Sincronizando..."
                : "En tiempo real";

    }


    if (boton) {

        boton.disabled =
            cargando;


        boton.textContent =
            cargando
                ? "Actualizando..."
                : "Actualizar";

    }

}


/* ============================================================
   ÚLTIMA ACTUALIZACIÓN
   ============================================================ */

function actualizarUltimaActualizacionMonitoreo() {

    const elemento =
        document.getElementById(
            "ultimaActualizacionMonitoreo"
        );


    if (!elemento) {
        return;
    }


    elemento.textContent =
        `Actualizado ${new Date().toLocaleTimeString(
            "es-MX",
            {
                hour: "2-digit",
                minute: "2-digit",
            }
        )}`;

}


/* ============================================================
   CANTIDAD DE VEHÍCULOS
   ============================================================ */

function actualizarCantidadVehiculosMonitoreo(
    cantidad
) {

    const elemento =
        document.getElementById(
            "cantidadVehiculosMonitoreo"
        );


    if (!elemento) {
        return;
    }


    elemento.textContent =
        cantidad === 1
            ? "1 vehículo"
            : `${cantidad} vehículos`;

}


/* ============================================================
   VALIDAR GPS
   ============================================================ */

function tieneGpsValidoMonitoreo(
    vehiculo
) {

    if (!vehiculo) {
        return false;
    }


    /*
     * Un vehículo sin señal no debe mostrarse
     * con GPS disponible en el monitoreo actual.
     */
    if (
        vehiculo.sin_senal === true
        ||
        vehiculo.online === false
    ) {
        return false;
    }


    /*
     * Validar que realmente existan coordenadas.
     */
    if (
        vehiculo.lat === null
        ||
        vehiculo.lat === undefined
        ||
        vehiculo.lng === null
        ||
        vehiculo.lng === undefined
    ) {
        return false;
    }


    const lat =
        Number(
            vehiculo.lat
        );


    const lng =
        Number(
            vehiculo.lng
        );


    if (
        !Number.isFinite(lat)
        ||
        !Number.isFinite(lng)
    ) {
        return false;
    }


    /*
     * En TrackSecurity, 0,0 representa ausencia
     * de una ubicación GPS válida.
     */
    if (
        lat === 0
        &&
        lng === 0
    ) {
        return false;
    }
    

    return true;

}

/* ============================================================
   FORMATO
   ============================================================ */

function formatearEstadoMonitoreo(
    estado
) {

    const textos = {

        activo:
            "Activo",

        alerta:
            "En alerta",

        panico:
            "Pánico",

        manual:
            "Modo manual",

        sin_senal:
            "Sin señal",

        apagado:
            "Apagado",

    };


    return textos[estado]
        ||
        formatearTextoMonitoreo(
            estado
        );

}


function formatearVelocidadMonitoreo(
    valor
) {

    const numero =
        Number(valor);


    if (!Number.isFinite(numero)) {

        return "0 km/h";

    }


    return `${numero.toFixed(1)} km/h`;

}


function formatearCoordenadaMonitoreo(
    valor
) {

    const numero =
        Number(valor);


    if (!Number.isFinite(numero)) {

        return "No disponible";

    }


    return numero.toFixed(6);

}


function formatearFechaMonitoreo(
    timestamp
) {

    const numero =
        Number(timestamp);


    if (
        !Number.isFinite(numero) ||
        numero <= 0
    ) {

        return "No disponible";

    }


    return new Date(
        numero * 1000
    ).toLocaleString(
        "es-MX",
        {
            dateStyle: "medium",
            timeStyle: "short",
        }
    );

}


function formatearTextoMonitoreo(
    valor
) {

    return String(
        valor || ""
    )
        .replaceAll(
            "_",
            " "
        )
        .replace(
            /\b\w/g,
            (letra) =>
                letra.toUpperCase()
        );

}


function normalizarMonitoreo(
    valor
) {

    return String(
        valor || ""
    )
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        );

}


function asignarTextoMonitoreo(
    id,
    valor
) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.textContent =
            valor;

    }

}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHtmlMonitoreo(
    valor
) {

    return String(
        valor ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* ============================================================
   LIMPIAR INTERVALO
   ============================================================ */

window.addEventListener(
    "beforeunload",
    () => {

        if (monitoreoIntervaloId) {

            clearInterval(
                monitoreoIntervaloId
            );

        }

    }
);