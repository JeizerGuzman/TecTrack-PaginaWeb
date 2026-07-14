/* ============================================================
   CONFIGURACIÓN ADMIN - TrackSecurity
   ============================================================ */


let configuracionOriginal = null;

let configuracionCargando = false;

let configuracionGuardando = false;

let configToastTimer = null;


/* ============================================================
   ELEMENTOS
   ============================================================ */

const configLoading = document.getElementById(
    "configLoading"
);

const configContent = document.getElementById(
    "configContent"
);

const btnGuardarConfiguracion = document.getElementById(
    "btnGuardarConfiguracion"
);

const configSaveStatus = document.getElementById(
    "configSaveStatus"
);

const configToast = document.getElementById(
    "configToast"
);


/* ============================================================
   CAMPOS
   ============================================================ */

const camposConfiguracion = {

    general: {
        nombre_plataforma:
            document.getElementById(
                "configNombrePlataforma"
            ),

        correo_soporte:
            document.getElementById(
                "configCorreoSoporte"
            ),

        telefono_soporte:
            document.getElementById(
                "configTelefonoSoporte"
            ),
    },


    monitoreo: {
        segundos_sin_senal:
            document.getElementById(
                "configSegundosSinSenal"
            ),
    },

    alertas: {
        segundos_separacion_alertas:
            document.getElementById(
                "configSegundosSeparacionAlertas"
            ),
    },

    panel_admin: {
        dashboard:
            document.getElementById(
                "configAdminDashboard"
            ),

        empresas:
            document.getElementById(
                "configAdminEmpresas"
            ),

        suscripciones:
            document.getElementById(
                "configAdminSuscripciones"
            ),

        planes:
            document.getElementById(
                "configAdminPlanes"
            ),

        usuarios:
            document.getElementById(
                "configAdminUsuarios"
            ),

        vehiculos:
            document.getElementById(
                "configAdminVehiculos"
            ),

        detalle_vehiculo:
            document.getElementById(
                "configAdminDetalleVehiculo"
            ),

        dispositivos:
            document.getElementById(
                "configAdminDispositivos"
            ),

        servicios:
            document.getElementById(
                "configAdminServicios"
            ),

        alertas:
            document.getElementById(
                "configAdminAlertas"
            ),
    },


    panel_operacion: {
        dashboard:
            document.getElementById(
                "configOperacionDashboard"
            ),

        vehiculos:
            document.getElementById(
                "configOperacionVehiculos"
            ),

        detalle_vehiculo:
            document.getElementById(
                "configOperacionDetalleVehiculo"
            ),

        alertas:
            document.getElementById(
                "configOperacionAlertas"
            ),

        monitoreo:
            document.getElementById(
                "configOperacionMonitoreo"
            ),
    },


    telemetria: {
        ubicacion_actual_segundos:
            document.getElementById(
                "configUbicacionActual"
            ),

        historial_gps_segundos:
            document.getElementById(
                "configHistorialGps"
            ),

        guardar_gps_inmediato_alerta:
            document.getElementById(
                "configGuardarGpsAlerta"
            ),
    },

};


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        configurarTabs();

        configurarEventosFormulario();

        await cargarConfiguracion();

    }
);


/* ============================================================
   TABS
   ============================================================ */

function configurarTabs() {

    const tabs = document.querySelectorAll(
        "[data-config-tab]"
    );

    const panels = document.querySelectorAll(
        "[data-config-panel]"
    );


    tabs.forEach((tab) => {

        tab.addEventListener(
            "click",
            () => {

                const nombreTab =
                    tab.dataset.configTab;


                tabs.forEach((item) => {
                    item.classList.remove(
                        "active"
                    );
                });


                panels.forEach((panel) => {
                    panel.classList.remove(
                        "active"
                    );
                });


                tab.classList.add(
                    "active"
                );


                const panelActivo =
                    document.querySelector(
                        `[data-config-panel="${nombreTab}"]`
                    );


                panelActivo?.classList.add(
                    "active"
                );

            }
        );

    });

}


/* ============================================================
   EVENTOS DEL FORMULARIO
   ============================================================ */

function configurarEventosFormulario() {

    const campos = document.querySelectorAll(
        ".admin-config-page input"
    );


    campos.forEach((campo) => {

        const evento = (
            campo.type === "checkbox"
        )
            ? "change"
            : "input";


        campo.addEventListener(
            evento,
            marcarCambiosPendientes
        );

    });


    btnGuardarConfiguracion?.addEventListener(
        "click",
        guardarConfiguracion
    );

}


/* ============================================================
   CARGAR CONFIGURACIÓN
   ============================================================ */

async function cargarConfiguracion() {

    if (configuracionCargando) {
        return;
    }


    configuracionCargando = true;


    mostrarCargando(true);


    try {

        const respuesta =
            await TrackAPI
                .obtenerAdminConfiguracionSistema();


        const configuracion =
            respuesta?.configuracion;


        if (!configuracion) {

            throw new Error(
                "No se recibió la configuración del sistema"
            );

        }


        configuracionOriginal =
            JSON.parse(
                JSON.stringify(configuracion)
            );


        pintarConfiguracion(
            configuracion
        );


        actualizarEstadoGuardado(
            "saved",
            "Configuración cargada"
        );


        setTimeout(() => {

            actualizarEstadoGuardado(
                "",
                "Sin cambios pendientes"
            );

        }, 1800);


    } catch (error) {

        console.error(
            "Error cargando configuración:",
            error
        );


        mostrarToast(
            error.message ||
            "No se pudo cargar la configuración",
            "error"
        );

    } finally {

        configuracionCargando = false;

        mostrarCargando(false);

    }

}


/* ============================================================
   PINTAR CONFIGURACIÓN
   ============================================================ */

function pintarConfiguracion(configuracion) {

    const general =
        configuracion.general || {};

    const monitoreo =
        configuracion.monitoreo || {};

    const alertas =
        configuracion.alertas || {};

    const panelAdmin =
        configuracion.panel_admin || {};

    const panelOperacion =
        configuracion.panel_operacion || {};

    const telemetria =
        configuracion.telemetria || {};


    asignarValor(
        camposConfiguracion
            .general
            .nombre_plataforma,

        general.nombre_plataforma
    );


    asignarValor(
        camposConfiguracion
            .general
            .correo_soporte,

        general.correo_soporte || ""
    );


    asignarValor(
        camposConfiguracion
            .general
            .telefono_soporte,

        general.telefono_soporte || ""
    );


    asignarValor(
        camposConfiguracion
            .monitoreo
            .segundos_sin_senal,

        monitoreo.segundos_sin_senal
    );

    asignarValor(
        camposConfiguracion
            .alertas
            .segundos_separacion_alertas,

        alertas.segundos_separacion_alertas
    );

    Object.entries(
        camposConfiguracion.panel_admin
    ).forEach(([clave, elemento]) => {

        asignarValor(
            elemento,
            panelAdmin[clave]
        );

    });


    Object.entries(
        camposConfiguracion.panel_operacion
    ).forEach(([clave, elemento]) => {

        asignarValor(
            elemento,
            panelOperacion[clave]
        );

    });


    asignarValor(
        camposConfiguracion
            .telemetria
            .ubicacion_actual_segundos,

        telemetria.ubicacion_actual_segundos
    );


    asignarValor(
        camposConfiguracion
            .telemetria
            .historial_gps_segundos,

        telemetria.historial_gps_segundos
    );


    if (
        camposConfiguracion
            .telemetria
            .guardar_gps_inmediato_alerta
    ) {

        camposConfiguracion
            .telemetria
            .guardar_gps_inmediato_alerta
            .checked =
                Boolean(
                    telemetria
                        .guardar_gps_inmediato_alerta
                );

    }


    pintarUltimaActualizacion(
        configuracion.ultima_actualizacion
    );

}


/* ============================================================
   ASIGNAR VALOR
   ============================================================ */

function asignarValor(
    elemento,
    valor
) {

    if (!elemento) {
        return;
    }


    elemento.value = (
        valor === null ||
        valor === undefined
    )
        ? ""
        : valor;

}


/* ============================================================
   OBTENER DATOS DEL FORMULARIO
   ============================================================ */

function obtenerDatosFormulario() {

    return {

        general: {

            nombre_plataforma:
                obtenerTexto(
                    camposConfiguracion
                        .general
                        .nombre_plataforma
                ),

            correo_soporte:
                obtenerTexto(
                    camposConfiguracion
                        .general
                        .correo_soporte
                ),

            telefono_soporte:
                obtenerTexto(
                    camposConfiguracion
                        .general
                        .telefono_soporte
                ),

        },


        monitoreo: {

            segundos_sin_senal:
                obtenerEntero(
                    camposConfiguracion
                        .monitoreo
                        .segundos_sin_senal
                ),

        },

        alertas: {

            segundos_separacion_alertas:
                obtenerEntero(
                    camposConfiguracion
                        .alertas
                        .segundos_separacion_alertas
                ),

        },


        panel_admin: {

            dashboard:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .dashboard
                ),

            empresas:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .empresas
                ),

            suscripciones:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .suscripciones
                ),

            planes:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .planes
                ),

            usuarios:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .usuarios
                ),

            vehiculos:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .vehiculos
                ),

            detalle_vehiculo:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .detalle_vehiculo
                ),

            dispositivos:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .dispositivos
                ),

            servicios:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .servicios
                ),

            alertas:
                obtenerEntero(
                    camposConfiguracion
                        .panel_admin
                        .alertas
                ),

        },


        panel_operacion: {

            dashboard:
                obtenerEntero(
                    camposConfiguracion
                        .panel_operacion
                        .dashboard
                ),

            vehiculos:
                obtenerEntero(
                    camposConfiguracion
                        .panel_operacion
                        .vehiculos
                ),

            detalle_vehiculo:
                obtenerEntero(
                    camposConfiguracion
                        .panel_operacion
                        .detalle_vehiculo
                ),

            alertas:
                obtenerEntero(
                    camposConfiguracion
                        .panel_operacion
                        .alertas
                ),

            monitoreo:
                obtenerEntero(
                    camposConfiguracion
                        .panel_operacion
                        .monitoreo
                ),

        },


        telemetria: {

            ubicacion_actual_segundos:
                obtenerEntero(
                    camposConfiguracion
                        .telemetria
                        .ubicacion_actual_segundos
                ),

            historial_gps_segundos:
                obtenerEntero(
                    camposConfiguracion
                        .telemetria
                        .historial_gps_segundos
                ),

            guardar_gps_inmediato_alerta:
                Boolean(
                    camposConfiguracion
                        .telemetria
                        .guardar_gps_inmediato_alerta
                        ?.checked
                ),

        },

    };

}


/* ============================================================
   GUARDAR CONFIGURACIÓN
   ============================================================ */

async function guardarConfiguracion() {

    if (configuracionGuardando) {
        return;
    }


    try {

        const datos =
            obtenerDatosFormulario();


        validarConfiguracion(
            datos
        );


        configuracionGuardando = true;


        btnGuardarConfiguracion.disabled = true;

        btnGuardarConfiguracion.textContent =
            "Guardando...";


        actualizarEstadoGuardado(
            "has-changes",
            "Guardando cambios..."
        );


        const respuesta =
            await TrackAPI
                .actualizarAdminConfiguracionSistema(
                    datos
                );
            
        if (
            typeof TrackConfig !== "undefined" &&
            typeof TrackConfig.limpiarCache === "function"
        ) {
            TrackConfig.limpiarCache();
        }

        const configuracion =
            respuesta?.configuracion;


        if (!configuracion) {

            throw new Error(
                "No se recibió la configuración actualizada"
            );

        }


        configuracionOriginal =
            JSON.parse(
                JSON.stringify(configuracion)
            );


        pintarConfiguracion(
            configuracion
        );


        actualizarEstadoGuardado(
            "saved",
            "Cambios guardados"
        );


        mostrarToast(
            respuesta.mensaje ||
            "Configuración actualizada correctamente",
            "success"
        );


        setTimeout(() => {

            actualizarEstadoGuardado(
                "",
                "Sin cambios pendientes"
            );

        }, 2200);


    } catch (error) {

        console.error(
            "Error guardando configuración:",
            error
        );


        actualizarEstadoGuardado(
            "has-changes",
            "Cambios pendientes"
        );


        mostrarToast(
            error.message ||
            "No se pudo guardar la configuración",
            "error"
        );


    } finally {

        configuracionGuardando = false;


        btnGuardarConfiguracion.disabled = false;

        btnGuardarConfiguracion.textContent =
            "Guardar cambios";

    }

}


/* ============================================================
   VALIDACIONES FRONTEND
   ============================================================ */

function validarConfiguracion(datos) {

    const nombre =
        datos.general.nombre_plataforma;


    if (!nombre) {

        activarTab(
            "general"
        );

        throw new Error(
            "El nombre de la plataforma es obligatorio"
        );

    }


    validarRango(
        datos.monitoreo.segundos_sin_senal,
        15,
        600,
        "El tiempo sin señal"
    );

    validarRango(
        datos.alertas
            .segundos_separacion_alertas,

        1,
        300,

        "El tiempo mínimo entre alertas del mismo tipo"
    );


    Object.entries(
        datos.panel_admin
    ).forEach(([clave, valor]) => {

        validarRango(
            valor,
            2,
            300,
            `El intervalo de administrador "${clave}"`
        );

    });


    Object.entries(
        datos.panel_operacion
    ).forEach(([clave, valor]) => {

        validarRango(
            valor,
            2,
            300,
            `El intervalo de operación "${clave}"`
        );

    });


    validarRango(
        datos.telemetria
            .ubicacion_actual_segundos,

        1,
        300,

        "La actualización de ubicación actual"
    );


    validarRango(
        datos.telemetria
            .historial_gps_segundos,

        5,
        3600,

        "El guardado del historial GPS"
    );

}


/* ============================================================
   VALIDAR RANGO
   ============================================================ */

function validarRango(
    valor,
    minimo,
    maximo,
    nombre
) {

    if (
        !Number.isInteger(valor) ||
        valor < minimo ||
        valor > maximo
    ) {

        throw new Error(
            `${nombre} debe estar entre ` +
            `${minimo} y ${maximo} segundos`
        );

    }

}


/* ============================================================
   CAMBIOS PENDIENTES
   ============================================================ */

function marcarCambiosPendientes() {

    if (!configuracionOriginal) {
        return;
    }


    actualizarEstadoGuardado(
        "has-changes",
        "Cambios pendientes"
    );

}


/* ============================================================
   ESTADO DE GUARDADO
   ============================================================ */

function actualizarEstadoGuardado(
    clase,
    texto
) {

    if (!configSaveStatus) {
        return;
    }


    configSaveStatus.classList.remove(
        "has-changes",
        "saved"
    );


    if (clase) {

        configSaveStatus.classList.add(
            clase
        );

    }


    configSaveStatus.textContent = texto;

}


/* ============================================================
   ACTIVAR TAB
   ============================================================ */

function activarTab(nombre) {

    const tab =
        document.querySelector(
            `[data-config-tab="${nombre}"]`
        );


    tab?.click();

}


/* ============================================================
   ÚLTIMA ACTUALIZACIÓN
   ============================================================ */

function pintarUltimaActualizacion(timestamp) {

    const elemento =
        document.getElementById(
            "configUltimaActualizacion"
        );


    if (!elemento) {
        return;
    }


    const numero = Number(timestamp);


    if (!Number.isFinite(numero) || numero <= 0) {

        elemento.textContent = "--";

        return;

    }


    const fecha =
        new Date(numero * 1000);


    elemento.textContent =
        fecha.toLocaleString(
            "es-MX",
            {
                dateStyle: "medium",
                timeStyle: "short",
            }
        );

}


/* ============================================================
   HELPERS
   ============================================================ */

function obtenerTexto(elemento) {

    return String(
        elemento?.value || ""
    ).trim();

}


function obtenerEntero(elemento) {

    return Number.parseInt(
        elemento?.value,
        10
    );

}


/* ============================================================
   MOSTRAR / OCULTAR CARGA
   ============================================================ */

function mostrarCargando(cargando) {

    if (configLoading) {

        configLoading.hidden =
            !cargando;

    }


    if (configContent) {

        configContent.hidden =
            cargando;

    }

}


/* ============================================================
   TOAST
   ============================================================ */

function mostrarToast(
    mensaje,
    tipo = "success"
) {

    if (!configToast) {
        return;
    }


    if (configToastTimer) {

        clearTimeout(
            configToastTimer
        );

    }


    configToast.textContent =
        mensaje;


    configToast.classList.remove(
        "success",
        "error"
    );


    configToast.classList.add(
        tipo,
        "show"
    );


    configToastTimer =
        setTimeout(
            () => {

                configToast.classList.remove(
                    "show"
                );

            },
            3500
        );

}