/* ============================================================
   REPORTES DEL DUEÑO - TrackSecurity
   ============================================================ */


window.TrackReportesState = {

    tipoActual:
        "resumen",

    cargando:
        false,

    vehiculos:
        [],

    registros:
        [],

    columnas:
        [],

};


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


        configurarEventosReportes();


        TrackReportesFiltros
            .actualizarFiltroEstado(
                TrackReportesState
                    .tipoActual
            );


        await cargarReporte();

    }
);


/* ============================================================
   CONFIGURAR EVENTOS
   ============================================================ */

function configurarEventosReportes() {

    document
        .querySelectorAll(
            "[data-reporte-tipo]"
        )
        .forEach((boton) => {

            boton.addEventListener(
                "click",
                async () => {

                    const tipo =
                        boton.dataset
                            .reporteTipo
                        || "resumen";


                    TrackReportesState
                        .tipoActual =
                        tipo;


                    document
                        .querySelectorAll(
                            "[data-reporte-tipo]"
                        )
                        .forEach((item) => {

                            item.classList.remove(
                                "active"
                            );

                        });


                    boton.classList.add(
                        "active"
                    );


                    TrackReportesRender
                        .actualizarTitulo(
                            tipo
                        );


                    TrackReportesFiltros
                        .actualizarFiltroEstado(
                            tipo
                        );


                    await cargarReporte();

                }
            );

        });


    document
        .getElementById(
            "btnGenerarReporte"
        )
        ?.addEventListener(
            "click",
            cargarReporte
        );


    document
        .getElementById(
            "btnActualizarReporte"
        )
        ?.addEventListener(
            "click",
            cargarReporte
        );


    document
        .getElementById(
            "btnLimpiarFiltrosReporte"
        )
        ?.addEventListener(
            "click",
            async () => {

                TrackReportesFiltros
                    .limpiar();


                await cargarReporte();

            }
        );


    document
        .getElementById(
            "btnExportarReporte"
        )
        ?.addEventListener(
            "click",
            () => {

                TrackReportesExportacion
                    .exportarCSV(

                        TrackReportesState
                            .registros,

                        TrackReportesState
                            .columnas,

                        TrackReportesState
                            .tipoActual
                    );

            }
        );


    document
        .getElementById(
            "btnCerrarModalDetalleReporte"
        )
        ?.addEventListener(
            "click",
            () => {

                TrackReportesRender
                    .cerrarModalDetalle();

            }
        );


    document
        .getElementById(
            "btnCancelarModalDetalleReporte"
        )
        ?.addEventListener(
            "click",
            () => {

                TrackReportesRender
                    .cerrarModalDetalle();

            }
        );

}


/* ============================================================
   CARGAR REPORTE
   ============================================================ */

async function cargarReporte() {

    if (
        TrackReportesState
            .cargando
    ) {
        return;
    }


    TrackReportesState
        .cargando = true;


    establecerCargandoReporte(
        true
    );


    TrackReportesRender
        .mostrarCargando();


    try {

        const parametros =
            TrackReportesFiltros
                .obtenerParametros();


        const respuesta =
            await TrackAPI
                .obtenerReportesDueno(
                    parametros
                );


        TrackReportesState
            .registros =
            Array.isArray(
                respuesta?.registros
            )
                ? respuesta.registros
                : [];


        TrackReportesState
            .columnas =
            Array.isArray(
                respuesta?.columnas
            )
                ? respuesta.columnas
                : [];


        TrackReportesState
            .vehiculos =
            Array.isArray(
                respuesta?.vehiculos
            )
                ? respuesta.vehiculos
                : [];


        TrackReportesRender
            .pintarMetricas(
                respuesta?.metricas || {}
            );


        TrackReportesFiltros
            .pintarVehiculos(
                TrackReportesState
                    .vehiculos
            );


        TrackReportesRender
            .pintarReporte(
                respuesta
            );


        actualizarUltimaActualizacionReporte();


    } catch (error) {

        console.error(
            "Error cargando reporte:",
            error
        );


        TrackReportesRender
            .mostrarError(
                error.message ||
                "No se pudo generar el reporte."
            );


    } finally {

        TrackReportesState
            .cargando = false;


        establecerCargandoReporte(
            false
        );

    }

}


/* ============================================================
   ESTADO DE CARGA
   ============================================================ */

function establecerCargandoReporte(
    cargando
) {

    const botones = [

        document.getElementById(
            "btnGenerarReporte"
        ),

        document.getElementById(
            "btnActualizarReporte"
        ),

    ];


    botones.forEach((boton) => {

        if (!boton) {
            return;
        }


        boton.disabled =
            cargando;

    });


    const botonExportar =
        document.getElementById(
            "btnExportarReporte"
        );


    if (botonExportar) {

        botonExportar.disabled =
            cargando ||
            !TrackReportesState
                .registros
                .length;

    }

}


/* ============================================================
   ÚLTIMA ACTUALIZACIÓN
   ============================================================ */

function actualizarUltimaActualizacionReporte() {

    const elemento =
        document.getElementById(
            "ultimaActualizacionReportes"
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
                hour:
                    "2-digit",

                minute:
                    "2-digit",
            }
        )}`;

}