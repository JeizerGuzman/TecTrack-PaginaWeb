/* ============================================================
   HISTORIAL DEL DUEÑO - TrackSecurity
   ============================================================ */


let historialCargando = false;

let historialRegistros = [];

let historialVehiculos = [];

let historialCategoriaActual = "todos";


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
                )

            if (!autorizado) {
                return;
            }

        }


        configurarEventosHistorial();


        await cargarHistorial();

    }
);


/* ============================================================
   CONFIGURAR EVENTOS
   ============================================================ */

function configurarEventosHistorial() {

    document
        .querySelectorAll(
            "[data-historial-categoria]"
        )
        .forEach((boton) => {

            boton.addEventListener(
                "click",
                async () => {

                    const categoria =
                        boton.dataset
                            .historialCategoria
                        || "todos";


                    historialCategoriaActual =
                        categoria;


                    document
                        .querySelectorAll(
                            "[data-historial-categoria]"
                        )
                        .forEach((item) => {

                            item.classList.remove(
                                "active"
                            );

                        });


                    boton.classList.add(
                        "active"
                    );


                    actualizarTituloCategoria();


                    await cargarHistorial();

                }
            );

        });


    document
        .getElementById(
            "buscarHistorial"
        )
        ?.addEventListener(
            "input",
            renderHistorialFiltrado
        );


    document
        .getElementById(
            "filtroHistorialVehiculo"
        )
        ?.addEventListener(
            "change",
            cargarHistorial
        );


    document
        .getElementById(
            "filtroHistorialDesde"
        )
        ?.addEventListener(
            "change",
            cargarHistorial
        );


    document
        .getElementById(
            "filtroHistorialHasta"
        )
        ?.addEventListener(
            "change",
            cargarHistorial
        );


    document
        .getElementById(
            "btnActualizarHistorial"
        )
        ?.addEventListener(
            "click",
            cargarHistorial
        );


    document
        .getElementById(
            "btnLimpiarHistorial"
        )
        ?.addEventListener(
            "click",
            limpiarFiltrosHistorial
        );

}


/* ============================================================
   CARGAR HISTORIAL
   ============================================================ */

async function cargarHistorial() {

    if (historialCargando) {
        return;
    }


    historialCargando = true;


    mostrarEstadoCargaHistorial(
        true
    );


    try {

        const parametros =
            obtenerParametrosHistorial();


        const respuesta =
            await TrackAPI
                .obtenerHistorialDueno(
                    parametros
                );


        historialRegistros =
            Array.isArray(
                respuesta?.registros
            )
                ? respuesta.registros
                : [];


        historialVehiculos =
            Array.isArray(
                respuesta?.vehiculos
            )
                ? respuesta.vehiculos
                : [];


        pintarMetricasHistorial(
            respuesta?.metricas || {}
        );


        pintarVehiculosHistorial();


        renderHistorialFiltrado();


        actualizarUltimaActualizacionHistorial();


    } catch (error) {

        console.error(
            "Error cargando historial:",
            error
        );


        const contenedor =
            document.getElementById(
                "historialListado"
            );


        if (contenedor) {

            contenedor.innerHTML = `

                <div class="empty-state">

                    <strong>
                        No se pudo cargar el historial
                    </strong>

                    <p>
                        ${escapeHtmlHistorial(
                            error.message ||
                            "Ocurrió un error al consultar la actividad."
                        )}
                    </p>

                </div>

            `;

        }


    } finally {

        historialCargando = false;


        mostrarEstadoCargaHistorial(
            false
        );

    }

}


/* ============================================================
   OBTENER PARÁMETROS
   ============================================================ */

function obtenerParametrosHistorial() {

    const vehiculoId =
        document
            .getElementById(
                "filtroHistorialVehiculo"
            )
            ?.value || "";


    const fechaDesde =
        document
            .getElementById(
                "filtroHistorialDesde"
            )
            ?.value || "";


    const fechaHasta =
        document
            .getElementById(
                "filtroHistorialHasta"
            )
            ?.value || "";


    const parametros = {

        categoria:
            historialCategoriaActual,

        limite:
            historialCategoriaActual === "gps"
                ? 500
                : 200,

    };


    if (vehiculoId) {

        parametros.vehiculo_id =
            vehiculoId;

    }


    if (fechaDesde) {

        parametros.fecha_desde =
            convertirFechaInicioTimestamp(
                fechaDesde
            );

    }


    if (fechaHasta) {

        parametros.fecha_hasta =
            convertirFechaFinTimestamp(
                fechaHasta
            );

    }


    return parametros;

}


/* ============================================================
   PINTAR MÉTRICAS
   ============================================================ */

function pintarMetricasHistorial(
    metricas
) {

    asignarTextoHistorial(
        "statHistorialTotal",
        Number(
            metricas.total_actividad || 0
        )
    );


    asignarTextoHistorial(
        "statHistorialAlertas",
        Number(
            metricas.alertas || 0
        )
    );


    asignarTextoHistorial(
        "statHistorialEventos",
        Number(
            metricas.eventos || 0
        )
    );


    asignarTextoHistorial(
        "statHistorialServicios",
        Number(
            metricas.servicios || 0
        )
    );

}


/* ============================================================
   PINTAR VEHÍCULOS
   ============================================================ */

function pintarVehiculosHistorial() {

    const select =
        document.getElementById(
            "filtroHistorialVehiculo"
        );


    if (!select) {
        return;
    }


    const valorActual =
        select.value;


    select.innerHTML = `

        <option value="">
            Todos los vehículos
        </option>

        ${historialVehiculos
            .map((vehiculo) => `

                <option
                    value="${Number(
                        vehiculo.id
                    )}"
                >
                    ${escapeHtmlHistorial(
                        vehiculo.nombre ||
                        "Vehículo"
                    )}
                    ${
                        vehiculo.placa
                            ? ` · ${escapeHtmlHistorial(
                                vehiculo.placa
                            )}`
                            : ""
                    }
                </option>

            `)
            .join("")}

    `;


    const existeValor = (
        [...select.options]
            .some(
                (opcion) =>
                    opcion.value ===
                    valorActual
            )
    );


    if (existeValor) {

        select.value =
            valorActual;

    }

}


/* ============================================================
   RENDER CON FILTRO DE BÚSQUEDA
   ============================================================ */

function renderHistorialFiltrado() {

    const busqueda =
        normalizarHistorial(
            document
                .getElementById(
                    "buscarHistorial"
                )
                ?.value || ""
        );


    let registros = [
        ...historialRegistros
    ];


    if (busqueda) {

        registros =
            registros.filter(
                (registro) => {

                    const contenido =
                        normalizarHistorial(
                            [
                                registro.titulo,
                                registro.descripcion,
                                registro.tipo,
                                registro.categoria,
                                registro.vehiculo,
                                registro.placa,
                                registro.estado,
                                registro.nivel,
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


    renderHistorial(
        registros
    );

}


/* ============================================================
   RENDER HISTORIAL
   ============================================================ */

function renderHistorial(
    registros
) {

    const contenedor =
        document.getElementById(
            "historialListado"
        );


    if (!contenedor) {
        return;
    }


    actualizarCantidadMostrada(
        registros.length
    );


    if (!registros.length) {

        contenedor.innerHTML = `

            <div class="empty-state">

                <strong>
                    No hay registros para mostrar
                </strong>

                <p>
                    No se encontró actividad con los filtros seleccionados.
                </p>

            </div>

        `;


        return;

    }


    contenedor.innerHTML =
        registros
            .map(
                crearTarjetaHistorial
            )
            .join("");

}


/* ============================================================
   CREAR TARJETA
   ============================================================ */

function crearTarjetaHistorial(
    registro
) {

    const categoria =
        normalizarHistorial(
            registro.categoria ||
            "evento"
        );


    const categoriaClase =
        obtenerClaseCategoria(
            categoria
        );


    return `

        <article
            class="
                historial-item
                historial-item-${categoriaClase}
            "
        >

            <div class="historial-item-icon">

                ${obtenerIconoHistorial(
                    categoria
                )}

            </div>


            <div class="historial-item-main">

                <div class="historial-item-title-row">

                    <div>

                        <div class="historial-item-category">

                            ${formatearCategoriaHistorial(
                                categoria
                            )}

                        </div>


                        <h3>

                            ${escapeHtmlHistorial(
                                registro.titulo ||
                                "Registro de actividad"
                            )}

                        </h3>

                    </div>


                    <span class="
                        historial-time-badge
                    ">

                        ${escapeHtmlHistorial(
                            tiempoRelativoHistorial(
                                registro.timestamp
                            )
                        )}

                    </span>

                </div>


                <p class="historial-item-description">

                    ${escapeHtmlHistorial(
                        registro.descripcion ||
                        "Sin descripción disponible."
                    )}

                </p>


                <div class="historial-item-meta">

                    <span>

                        Vehículo:
                        <strong>
                            ${escapeHtmlHistorial(
                                registro.vehiculo ||
                                "Sin vehículo"
                            )}
                        </strong>

                    </span>


                    ${
                        registro.placa
                            ? `

                                <span>

                                    Placa:
                                    <strong>
                                        ${escapeHtmlHistorial(
                                            registro.placa
                                        )}
                                    </strong>

                                </span>

                            `
                            : ""
                    }


                    <span>

                        Fecha:
                        <strong>
                            ${escapeHtmlHistorial(
                                formatearFechaHistorial(
                                    registro.timestamp
                                )
                            )}
                        </strong>

                    </span>


                    ${crearMetaEspecificaHistorial(
                        registro
                    )}

                </div>


                ${crearDetallesAdicionalesHistorial(
                    registro
                )}

            </div>

        </article>

    `;

}


/* ============================================================
   META ESPECÍFICA
   ============================================================ */

function crearMetaEspecificaHistorial(
    registro
) {

    const categoria =
        normalizarHistorial(
            registro.categoria
        );


    if (categoria === "alerta") {

        return `

            <span>

                Nivel:
                <strong>
                    ${escapeHtmlHistorial(
                        formatearTextoHistorial(
                            registro.nivel ||
                            "medio"
                        )
                    )}
                </strong>

            </span>


            <span>

                Estado:
                <strong>
                    ${
                        registro.atendida
                            ? "Atendida"
                            : "Pendiente"
                    }
                </strong>

            </span>

        `;

    }


    if (categoria === "servicio") {

        return `

            <span>

                Estado:
                <strong>
                    ${escapeHtmlHistorial(
                        formatearTextoHistorial(
                            registro.estado ||
                            "pendiente"
                        )
                    )}
                </strong>

            </span>

        `;

    }


    if (categoria === "gps") {

        return `

            <span>

                Velocidad:
                <strong>
                    ${formatearVelocidadHistorial(
                        registro.velocidad
                    )}
                </strong>

            </span>

        `;

    }


    return "";

}


/* ============================================================
   DETALLES ADICIONALES
   ============================================================ */

function crearDetallesAdicionalesHistorial(
    registro
) {

    const categoria =
        normalizarHistorial(
            registro.categoria
        );


    const tieneCoordenadas = (
        Number.isFinite(
            Number(registro.lat)
        )
        &&
        Number.isFinite(
            Number(registro.lng)
        )
    );


    if (categoria === "alerta") {

        return `

            <div class="historial-item-extra">

                ${
                    registro.condicion_activa
                        ? `
                            <span class="
                                historial-extra-chip
                                historial-extra-active
                            ">
                                Condición activa
                            </span>
                        `
                        : ""
                }


                ${
                    registro.atendida
                    && registro.atendida_por_nombre
                        ? `
                            <span class="
                                historial-extra-chip
                            ">
                                Atendida por:
                                ${escapeHtmlHistorial(
                                    registro.atendida_por_nombre
                                )}
                            </span>
                        `
                        : ""
                }


                ${
                    tieneCoordenadas
                        ? crearChipCoordenadas(
                            registro.lat,
                            registro.lng
                        )
                        : ""
                }

            </div>

        `;

    }


    if (categoria === "gps") {

        return `

            <div class="historial-item-extra">

                ${
                    tieneCoordenadas
                        ? crearChipCoordenadas(
                            registro.lat,
                            registro.lng
                        )
                        : `
                            <span class="
                                historial-extra-chip
                            ">
                                Sin coordenadas disponibles
                            </span>
                        `
                }

            </div>

        `;

    }


    if (categoria === "evento") {

        return tieneCoordenadas
            ? `

                <div class="historial-item-extra">

                    ${crearChipCoordenadas(
                        registro.lat,
                        registro.lng
                    )}

                </div>

            `
            : "";

    }


    if (categoria === "servicio") {

        const costo =
            Number(
                registro.costo || 0
            );


        if (costo <= 0) {
            return "";
        }


        return `

            <div class="historial-item-extra">

                <span class="
                    historial-extra-chip
                ">

                    Costo:
                    ${formatearMonedaHistorial(
                        costo
                    )}

                </span>

            </div>

        `;

    }


    return "";

}


/* ============================================================
   CHIP DE COORDENADAS
   ============================================================ */

function crearChipCoordenadas(
    lat,
    lng
) {

    return `

        <span class="
            historial-extra-chip
            historial-extra-location
        ">

            ${Number(lat).toFixed(5)},
            ${Number(lng).toFixed(5)}

        </span>

    `;

}


/* ============================================================
   LIMPIAR FILTROS
   ============================================================ */

async function limpiarFiltrosHistorial() {

    const buscar =
        document.getElementById(
            "buscarHistorial"
        );


    const vehiculo =
        document.getElementById(
            "filtroHistorialVehiculo"
        );


    const fechaDesde =
        document.getElementById(
            "filtroHistorialDesde"
        );


    const fechaHasta =
        document.getElementById(
            "filtroHistorialHasta"
        );


    if (buscar) {
        buscar.value = "";
    }


    if (vehiculo) {
        vehiculo.value = "";
    }


    if (fechaDesde) {
        fechaDesde.value = "";
    }


    if (fechaHasta) {
        fechaHasta.value = "";
    }


    historialCategoriaActual =
        "todos";


    document
        .querySelectorAll(
            "[data-historial-categoria]"
        )
        .forEach((boton) => {

            boton.classList.toggle(
                "active",
                boton.dataset
                    .historialCategoria ===
                    "todos"
            );

        });


    actualizarTituloCategoria();


    await cargarHistorial();

}


/* ============================================================
   TÍTULO DE CATEGORÍA
   ============================================================ */

function actualizarTituloCategoria() {

    const titulo =
        document.getElementById(
            "historialListadoTitulo"
        );


    const descripcion =
        document.getElementById(
            "historialListadoDescripcion"
        );


    const textos = {

        todos: {
            titulo:
                "Actividad reciente",

            descripcion:
                "Alertas, eventos y servicios registrados.",
        },


        alertas: {
            titulo:
                "Historial de alertas",

            descripcion:
                "Alertas registradas por sensores, pánico y otras condiciones.",
        },


        eventos: {
            titulo:
                "Historial de eventos",

            descripcion:
                "Cambios de estado y actividad operativa de los vehículos.",
        },


        gps: {
            titulo:
                "Historial GPS",

            descripcion:
                "Puntos históricos registrados por los dispositivos.",
        },


        servicios: {
            titulo:
                "Historial de servicios",

            descripcion:
                "Servicios técnicos y mantenimientos realizados.",
        },

    };


    const actual =
        textos[
            historialCategoriaActual
        ]
        ||
        textos.todos;


    if (titulo) {

        titulo.textContent =
            actual.titulo;

    }


    if (descripcion) {

        descripcion.textContent =
            actual.descripcion;

    }

}


/* ============================================================
   ESTADO DE CARGA
   ============================================================ */

function mostrarEstadoCargaHistorial(
    cargando
) {

    const estado =
        document.getElementById(
            "estadoCargaHistorial"
        );


    const boton =
        document.getElementById(
            "btnActualizarHistorial"
        );


    if (estado) {

        estado.textContent =
            cargando
                ? "Sincronizando..."
                : "Actualizado";


        estado.classList.toggle(
            "visible",
            cargando
        );

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

function actualizarUltimaActualizacionHistorial() {

    const elemento =
        document.getElementById(
            "ultimaActualizacionHistorial"
        );


    if (!elemento) {
        return;
    }


    const ahora =
        new Date();


    elemento.textContent =
        `Actualizado ${ahora.toLocaleTimeString(
            "es-MX",
            {
                hour: "2-digit",
                minute: "2-digit",
            }
        )}`;

}


/* ============================================================
   CANTIDAD MOSTRADA
   ============================================================ */

function actualizarCantidadMostrada(
    cantidad
) {

    const elemento =
        document.getElementById(
            "historialCantidadMostrada"
        );


    if (!elemento) {
        return;
    }


    elemento.textContent =
        cantidad === 1
            ? "1 registro"
            : `${cantidad} registros`;

}


/* ============================================================
   HELPERS DE CATEGORÍA
   ============================================================ */

function obtenerClaseCategoria(
    categoria
) {

    const clases = {

        alerta:
            "alerta",

        evento:
            "evento",

        gps:
            "gps",

        servicio:
            "servicio",

    };


    return clases[categoria]
        || "evento";

}


function formatearCategoriaHistorial(
    categoria
) {

    const textos = {

        alerta:
            "Alerta",

        evento:
            "Evento",

        gps:
            "GPS",

        servicio:
            "Servicio",

    };


    return textos[categoria]
        || "Actividad";

}


/* ============================================================
   ICONOS SVG
   ============================================================ */

function obtenerIconoHistorial(
    categoria
) {

    if (categoria === "alerta") {

        return `

            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M10.3 2.9a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 20H4a2 2 0 0 1-1.7-3.1z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>

        `;

    }


    if (categoria === "gps") {

        return `

            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>

        `;

    }


    if (categoria === "servicio") {

        return `

            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M14.7 6.3a4 4 0 0 0-5-5L7 4l3 3 2.7-2.7"></path>
                <path d="m5 8-3 3 11 11 3-3"></path>
                <path d="m14 15 5-5"></path>
                <path d="m17 8 3-3 2 2-3 3"></path>
            </svg>

        `;

    }


    return `

        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M4 4h16v16H4z"></path>
            <path d="M8 9h8"></path>
            <path d="M8 13h6"></path>
        </svg>

    `;

}


/* ============================================================
   FECHAS
   ============================================================ */

function convertirFechaInicioTimestamp(
    valor
) {

    const fecha =
        new Date(
            `${valor}T00:00:00`
        );


    return Math.floor(
        fecha.getTime() / 1000
    );

}


function convertirFechaFinTimestamp(
    valor
) {

    const fecha =
        new Date(
            `${valor}T23:59:59`
        );


    return Math.floor(
        fecha.getTime() / 1000
    );

}


function formatearFechaHistorial(
    timestamp
) {

    const numero =
        Number(timestamp);


    if (
        !Number.isFinite(numero)
        ||
        numero <= 0
    ) {

        return "Fecha no disponible";

    }


    const fecha =
        new Date(
            numero * 1000
        );


    return fecha.toLocaleString(
        "es-MX",
        {
            dateStyle:
                "medium",

            timeStyle:
                "short",
        }
    );

}


function tiempoRelativoHistorial(
    timestamp
) {

    const numero =
        Number(timestamp);


    if (
        !Number.isFinite(numero)
        ||
        numero <= 0
    ) {

        return "Sin fecha";

    }


    const diferencia =
        Math.max(
            0,
            Math.floor(
                Date.now() / 1000
            ) - numero
        );


    if (diferencia < 60) {

        return "Hace un momento";

    }


    if (diferencia < 3600) {

        const minutos =
            Math.floor(
                diferencia / 60
            );


        return `Hace ${minutos} min`;

    }


    if (diferencia < 86400) {

        const horas =
            Math.floor(
                diferencia / 3600
            );


        return `Hace ${horas} h`;

    }


    const dias =
        Math.floor(
            diferencia / 86400
        );


    return `Hace ${dias} d`;

}


/* ============================================================
   FORMATO
   ============================================================ */

function formatearVelocidadHistorial(
    valor
) {

    const numero =
        Number(valor);


    if (!Number.isFinite(numero)) {

        return "0 km/h";

    }


    return `${numero.toFixed(1)} km/h`;

}


function formatearMonedaHistorial(
    valor
) {

    const numero =
        Number(valor);


    if (!Number.isFinite(numero)) {

        return "$0.00";

    }


    return numero.toLocaleString(
        "es-MX",
        {
            style:
                "currency",

            currency:
                "MXN",

            minimumFractionDigits:
                2,
        }
    );

}


function formatearTextoHistorial(
    valor
) {

    return String(
        valor || ""
    )
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            (letra) =>
                letra.toUpperCase()
        );

}


function normalizarHistorial(
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


function asignarTextoHistorial(
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

function escapeHtmlHistorial(
    valor
) {

    return String(
        valor ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}