(function () {
    const DUENO_TOUR_CONFIG = [
        {
            key: "dashboard",
            path: "/dueno/dashboard",
            welcomeTitle: "Bienvenido a TecTrack Security",
            welcomeDescription: "Te mostraremos rápidamente las partes más importantes del dashboard para que te ubiques desde el inicio.",
            steps: [
                {
                    selector: ".sidebar",
                    title: "Navegación principal",
                    description: "Desde este menú accedes a las secciones del sistema y a los ajustes de tu cuenta.",
                    side: "right",
                    align: "start"
                },
                {
                    selector: ".dashboard-metricas-grid",
                    title: "Resumen operativo",
                    description: "Estas tarjetas concentran los indicadores principales de tu flota en una sola vista.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".dashboard-map-card",
                    title: "Mapa de monitoreo",
                    description: "Aquí visualizas la ubicación actual y la última ubicación conocida de cada vehículo.",
                    side: "left",
                    align: "center"
                },
                {
                    selector: ".dashboard-side-card",
                    title: "Alertas de hoy",
                    description: "Este panel agrupa las alertas registradas durante la jornada para revisarlas rápido.",
                    side: "left",
                    align: "start"
                },
                {
                    selector: ".dashboard-eventos-card",
                    title: "Últimos eventos",
                    description: "La bitácora muestra la actividad reciente más relevante de los vehículos.",
                    side: "top",
                    align: "start"
                }
            ]
        },
        {
            key: "alertas",
            path: "/dueno/alertas",
            welcomeTitle: "Bienvenido a Alertas",
            welcomeDescription: "Vamos a recorrer lo esencial para que puedas revisar y atender incidentes con rapidez.",
            steps: [
                {
                    selector: ".alertas-header",
                    title: "Centro de alertas",
                    description: "Aquí ves el estado general de las alertas y la información de contexto de la sección.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".alertas-stats-grid",
                    title: "Resumen rápido",
                    description: "Estas tarjetas te muestran el volumen total, pendientes, atendidas y alertas críticas.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".filtros-alertas-card",
                    title: "Filtros",
                    description: "Con estos controles puedes buscar y acotar las alertas por estado, tipo y nivel.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".alertas-list-card",
                    title: "Listado de alertas",
                    description: "Aquí revisas cada alerta, entras al vehículo relacionado o la marcas como atendida.",
                    side: "top",
                    align: "start"
                }
            ]
        },
        {
            key: "configuracion",
            path: "/dueno/configuracion",
            welcomeTitle: "Bienvenido a Configuración",
            welcomeDescription: "Te enseño dónde consultar tu cuenta, la empresa y los accesos rápidos de este módulo.",
            steps: [
                {
                    selector: ".configuracion-header",
                    title: "Cabecera de configuración",
                    description: "Desde aquí accedes a la edición de tu información o al cambio de contraseña.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".configuracion-grid > .config-card:nth-child(1)",
                    title: "Cuenta del dueño",
                    description: "Este bloque resume tu información principal de acceso.",
                    side: "right",
                    align: "start"
                },
                {
                    selector: ".configuracion-grid > .config-card:nth-child(2)",
                    title: "Datos de la empresa",
                    description: "Aquí encuentras la información registrada de tu empresa.",
                    side: "left",
                    align: "start"
                },
                {
                    selector: ".configuracion-grid > .config-card:nth-child(3)",
                    title: "Suscripción actual",
                    description: "Este apartado muestra el plan y el estado de tu suscripción.",
                    side: "top",
                    align: "center"
                }
            ]
        },
        {
            key: "historial",
            path: "/dueno/historial",
            welcomeTitle: "Bienvenido a Historial",
            welcomeDescription: "Aquí puedes consultar la actividad reciente de tu flota y filtrar lo que necesites ver.",
            steps: [
                {
                    selector: ".historial-header",
                    title: "Encabezado",
                    description: "Te muestra el resumen general y el estado de sincronización del historial.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".historial-stats-grid",
                    title: "Métricas de actividad",
                    description: "Estas tarjetas resumen el total de actividad, alertas, eventos y servicios.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".historial-filtros-card",
                    title: "Filtros de búsqueda",
                    description: "Usa estos controles para acotar la actividad por vehículo y rango de fechas.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".historial-categorias",
                    title: "Categorías",
                    description: "Con estas pestañas cambias entre alertas, eventos, GPS y servicios.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".historial-list-card",
                    title: "Listado",
                    description: "Aquí aparece la actividad filtrada con el detalle más útil para revisar.",
                    side: "top",
                    align: "start"
                }
            ]
        },
        {
            key: "recorridos",
            path: "/dueno/recorridos",
            welcomeTitle: "Bienvenido a Recorridos",
            welcomeDescription: "Aquí puedes revisar los viajes registrados, seguir su trazado en el mapa y abrir cada detalle.",
            steps: [
                {
                    selector: ".panel-header",
                    title: "Filtros y actualización",
                    description: "Desde este bloque eliges el estado de los recorridos y refrescas la lista.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".lista-recorridos",
                    title: "Listado de recorridos",
                    description: "Aquí se muestran los viajes disponibles; al seleccionar uno se resalta y se carga su ruta.",
                    side: "right",
                    align: "start"
                },
                {
                    selector: ".panel-mapa",
                    title: "Mapa de ruta",
                    description: "Este mapa te permite visualizar el trayecto, inicio, destino y alertas del viaje seleccionado.",
                    side: "left",
                    align: "center"
                },
                {
                    selector: ".paginacion-compacta",
                    title: "Navegación",
                    description: "Con estos controles cambias de página para ver más recorridos registrados.",
                    side: "top",
                    align: "center"
                }
            ]
        },
        {
            key: "reportes",
            path: "/dueno/reportes",
            welcomeTitle: "Bienvenido a Reportes",
            welcomeDescription: "Vamos a ubicar las zonas donde eliges el tipo de reporte, aplicas filtros y exportas datos.",
            steps: [
                {
                    selector: ".reportes-header",
                    title: "Encabezado",
                    description: "Desde aquí ves el estado general y el botón para exportar el reporte actual.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".reportes-tipos-grid",
                    title: "Tipos de reporte",
                    description: "Estas tarjetas cambian la vista entre resumen, alertas, vehículos y servicios.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".reportes-stats-grid",
                    title: "Métricas",
                    description: "Aquí se concentran los indicadores principales del reporte seleccionado.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".reportes-filtros-card",
                    title: "Filtros",
                    description: "Usa este bloque para refinar el reporte antes de generarlo.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".reportes-tabla-card",
                    title: "Resultados",
                    description: "Aquí consultas la tabla y el detalle del reporte activo.",
                    side: "top",
                    align: "start"
                }
            ]
        },
        {
            key: "usuarios",
            path: "/dueno/usuarios",
            welcomeTitle: "Bienvenido a Usuarios",
            welcomeDescription: "Te muestro cómo revisar, filtrar y administrar los usuarios vinculados a tu empresa.",
            steps: [
                {
                    selector: ".usuarios-header",
                    title: "Cabecera",
                    description: "Desde este bloque puedes crear un usuario nuevo y ver el contexto de la sección.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".usuarios-stats-grid",
                    title: "Resumen de usuarios",
                    description: "Estas tarjetas te muestran cuántos usuarios hay, por rol y cuántos están activos.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".usuarios-filtros-card",
                    title: "Filtros",
                    description: "Busca usuarios por nombre o correo y reduce la lista por tipo o estado.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".usuarios-list-card",
                    title: "Listado",
                    description: "Aquí administras cada usuario con acceso a edición, desactivación o reactivación.",
                    side: "top",
                    align: "start"
                }
            ]
        },
        {
            key: "vehiculos",
            path: "/dueno/vehiculos",
            welcomeTitle: "Bienvenido a Vehículos",
            welcomeDescription: "Vamos a ubicar rápidamente las zonas principales para administrar tu flota.",
            steps: [
                {
                    selector: ".vehiculos-header",
                    title: "Cabecera",
                    description: "Desde aquí agregas vehículos nuevos y ves el contexto general de la flota.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".vehiculos-stats-grid",
                    title: "Resumen de flota",
                    description: "Estas tarjetas concentran el total registrado, activos, con alerta y pendientes.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".filtros-card",
                    title: "Filtros",
                    description: "Busca unidades por nombre o placa y filtra por estado.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".lista-vehiculos-card",
                    title: "Listado de vehículos",
                    description: "Aquí revisas cada unidad, entras al detalle o administras su estado.",
                    side: "top",
                    align: "start"
                }
            ]
        }
    ];

    const SUPERVISOR_TOUR_CONFIG = [
        {
            key: "supervisor_dashboard",
            path: "/supervisor/dashboard",
            welcomeTitle: "Bienvenido a TecTrack Security",
            welcomeDescription: "Te mostraremos rápidamente las partes más importantes del dashboard para que te ubiques desde el inicio.",
            steps: [
                {
                    selector: ".sidebar",
                    title: "Navegación principal",
                    description: "Desde este menú accedes a las secciones del sistema y a los ajustes de tu cuenta.",
                    side: "right",
                    align: "start"
                },
                {
                    selector: ".dashboard-metricas-grid",
                    title: "Resumen operativo",
                    description: "Estas tarjetas concentran los indicadores principales de la flota en una sola vista.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".dashboard-map-card",
                    title: "Mapa de monitoreo",
                    description: "Aquí visualizas la ubicación actual y la última ubicación conocida de cada vehículo.",
                    side: "left",
                    align: "center"
                },
                {
                    selector: ".dashboard-side-card",
                    title: "Alertas de hoy",
                    description: "Este panel agrupa las alertas registradas durante la jornada para revisarlas rápido.",
                    side: "left",
                    align: "start"
                },
                {
                    selector: ".dashboard-eventos-card",
                    title: "Últimos eventos",
                    description: "La bitácora muestra la actividad reciente más relevante de los vehículos.",
                    side: "top",
                    align: "start"
                }
            ]
        },
        {
            key: "supervisor_monitoreo",
            path: "/supervisor/monitoreo",
            welcomeTitle: "Bienvenido a Monitoreo",
            welcomeDescription: "Aquí puedes revisar el estado en tiempo real de la flota y seleccionar cualquier vehículo para ver su detalle.",
            steps: [
                {
                    selector: ".monitoreo-header",
                    title: "Encabezado",
                    description: "Te muestra el contexto general de la vista y el estado de actualización.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".monitoreo-stats-grid",
                    title: "Resumen operativo",
                    description: "Estas tarjetas resumen cuántos vehículos están en línea, en alerta o sin señal.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".monitoreo-filtros-card",
                    title: "Filtros",
                    description: "Usa estos controles para buscar y filtrar los vehículos que deseas revisar.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".monitoreo-main-grid",
                    title: "Lista y detalle",
                    description: "A la izquierda eliges un vehículo y a la derecha consultas su estado completo.",
                    side: "top",
                    align: "center"
                }
            ]
        },
        {
            key: "supervisor_vehiculos",
            path: "/supervisor/vehiculos",
            welcomeTitle: "Bienvenido a Vehículos",
            welcomeDescription: "Vamos a ubicar rápidamente las zonas principales para revisar la flota.",
            steps: [
                {
                    selector: ".vehiculos-header",
                    title: "Cabecera",
                    description: "Desde aquí revisas el contexto general de la flota y las acciones principales.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".vehiculos-stats-grid",
                    title: "Resumen de flota",
                    description: "Estas tarjetas concentran el total registrado, activos, con alerta y pendientes.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".filtros-card",
                    title: "Filtros",
                    description: "Busca unidades por nombre o placa y filtra por estado.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".lista-vehiculos-card",
                    title: "Listado de vehículos",
                    description: "Aquí revisas cada unidad y entras a su detalle.",
                    side: "top",
                    align: "start"
                }
            ]
        },
        {
            key: "supervisor_alertas",
            path: "/supervisor/alertas",
            welcomeTitle: "Bienvenido a Alertas",
            welcomeDescription: "Vamos a recorrer lo esencial para que puedas revisar y atender incidentes con rapidez.",
            steps: [
                {
                    selector: ".alertas-header",
                    title: "Centro de alertas",
                    description: "Aquí ves el estado general de las alertas y la información de contexto de la sección.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".alertas-stats-grid",
                    title: "Resumen rápido",
                    description: "Estas tarjetas te muestran el volumen total, pendientes, atendidas y alertas críticas.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".filtros-alertas-card",
                    title: "Filtros",
                    description: "Con estos controles puedes buscar y acotar las alertas por estado, tipo y nivel.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".alertas-list-card",
                    title: "Listado de alertas",
                    description: "Aquí revisas cada alerta, entras al vehículo relacionado o la marcas como atendida.",
                    side: "top",
                    align: "start"
                }
            ]
        },
        {
            key: "supervisor_historial",
            path: "/supervisor/historial",
            welcomeTitle: "Bienvenido a Historial",
            welcomeDescription: "Aquí puedes consultar la actividad reciente de la flota y filtrar lo que necesites ver.",
            steps: [
                {
                    selector: ".historial-header",
                    title: "Encabezado",
                    description: "Te muestra el resumen general y el estado de sincronización del historial.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".historial-stats-grid",
                    title: "Métricas de actividad",
                    description: "Estas tarjetas resumen el total de actividad, alertas, eventos y servicios.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".historial-filtros-card",
                    title: "Filtros de búsqueda",
                    description: "Usa estos controles para acotar la actividad por vehículo y rango de fechas.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".historial-categorias",
                    title: "Categorías",
                    description: "Con estas pestañas cambias entre alertas, eventos, GPS y servicios.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".historial-list-card",
                    title: "Listado",
                    description: "Aquí aparece la actividad filtrada con el detalle más útil para revisar.",
                    side: "top",
                    align: "start"
                }
            ]
        },
        {
            key: "supervisor_recorridos",
            path: "/supervisor/recorridos",
            welcomeTitle: "Bienvenido a Recorridos",
            welcomeDescription: "Aquí puedes revisar los viajes registrados, seguir su trazado en el mapa y abrir cada detalle.",
            steps: [
                {
                    selector: ".panel-header",
                    title: "Filtros y actualización",
                    description: "Desde este bloque eliges el estado de los recorridos y refrescas la lista.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".lista-recorridos",
                    title: "Listado de recorridos",
                    description: "Aquí se muestran los viajes disponibles; al seleccionar uno se resalta y se carga su ruta.",
                    side: "right",
                    align: "start"
                },
                {
                    selector: ".panel-mapa",
                    title: "Mapa de ruta",
                    description: "Este mapa te permite visualizar el trayecto, inicio, destino y alertas del viaje seleccionado.",
                    side: "left",
                    align: "center"
                },
                {
                    selector: ".paginacion-compacta",
                    title: "Navegación",
                    description: "Con estos controles cambias de página para ver más recorridos registrados.",
                    side: "top",
                    align: "center"
                }
            ]
        },
        {
            key: "supervisor_reportes",
            path: "/supervisor/reportes",
            welcomeTitle: "Bienvenido a Reportes",
            welcomeDescription: "Vamos a ubicar las zonas donde eliges el tipo de reporte, aplicas filtros y exportas datos.",
            steps: [
                {
                    selector: ".reportes-header",
                    title: "Encabezado",
                    description: "Desde aquí ves el estado general y el botón para exportar el reporte actual.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".reportes-tipos-grid",
                    title: "Tipos de reporte",
                    description: "Estas tarjetas cambian la vista entre resumen, alertas, vehículos y servicios.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".reportes-stats-grid",
                    title: "Métricas",
                    description: "Aquí se concentran los indicadores principales del reporte seleccionado.",
                    side: "bottom",
                    align: "center"
                },
                {
                    selector: ".reportes-filtros-card",
                    title: "Filtros",
                    description: "Usa este bloque para refinar el reporte antes de generarlo.",
                    side: "bottom",
                    align: "start"
                },
                {
                    selector: ".reportes-tabla-card",
                    title: "Resultados",
                    description: "Aquí consultas la tabla y el detalle del reporte activo.",
                    side: "top",
                    align: "start"
                }
            ]
        }
    ];

    const TOUR_CONFIGS = {
        dueno: DUENO_TOUR_CONFIG,
        supervisor: SUPERVISOR_TOUR_CONFIG
    };

    const TOUR_SEQUENCES = {
        dueno: [
            "dashboard",
            "vehiculos",
            "alertas",
            "historial",
            "recorridos",
            "reportes",
            "usuarios",
            "configuracion"
        ],
        supervisor: [
            "supervisor_dashboard",
            "supervisor_monitoreo",
            "supervisor_vehiculos",
            "supervisor_recorridos",
            "supervisor_alertas",
            "supervisor_historial",
            "supervisor_reportes"
        ]
    };

    const runtime = {
        driver: null,
        pageConfig: null,
        pageState: null,
        autoPersist: true,
        role: null,
        tourReplayMode: null
    };

    function normalizarRuta(pathname) {
        return String(pathname || "").replace(/\/+$/, "") || "/";
    }

    function obtenerRolActual(pathname = window.location.pathname) {
        const ruta = normalizarRuta(pathname);

        if (ruta.startsWith("/supervisor/")) {
            return "supervisor";
        }

        if (ruta.startsWith("/dueno/")) {
            return "dueno";
        }

        return null;
    }

    function obtenerConfiguracionActual(pathname = window.location.pathname) {
        const ruta = normalizarRuta(pathname);
        const rol = obtenerRolActual(ruta);

        runtime.role = rol;

        const configuraciones = TOUR_CONFIGS[rol] || [];
        return configuraciones.find((config) => config.path === ruta) || null;
    }

    function obtenerClaveTutorial(configuracion) {
        return configuracion.key;
    }

    function obtenerRutaApiTutorial() {
        const rol = runtime.role || "dueno";
        return `/api/${rol}/tutoriales`;
    }

    function obtenerConfiguracionesRol() {
        return TOUR_CONFIGS[runtime.role] || [];
    }

    function obtenerModoTourDesdeUrl(configuracion) {
        if (!configuracion) {
            return null;
        }

        const params = new URLSearchParams(window.location.search);

        const tour = params.get("tour");

        if (tour === "all") {
            return "all";
        }

        if (tour === configuracion.key) {
            return configuracion.key;
        }

        return null;
    }

    function obtenerSiguienteConfiguracionReplay(configuracion) {
        const secuencia = TOUR_SEQUENCES[runtime.role] || [];
        const configuraciones = obtenerConfiguracionesRol();
        const indiceActual = secuencia.indexOf(configuracion.key);

        if (indiceActual < 0 || indiceActual >= secuencia.length - 1) {
            return null;
        }

        const siguienteClave = secuencia[indiceActual + 1];
        return configuraciones.find((item) => item.key === siguienteClave) || null;
    }

    function navegarASiguienteModuloReplay(configuracion) {
        const siguienteConfiguracion = obtenerSiguienteConfiguracionReplay(configuracion);

        if (!siguienteConfiguracion) {
            return false;
        }

        const url = new URL(siguienteConfiguracion.path, window.location.origin);
        url.searchParams.set("tour", "all");
        window.location.href = `${url.pathname}${url.search}`;
        return true;
    }

    function construirPasos(configuracion) {
        const pasos = [];

        pasos.push({
            popover: {
                title: configuracion.welcomeTitle,
                description: configuracion.welcomeDescription,
                showButtons: ["next"]
            }
        });

        configuracion.steps.forEach((step) => {
            const elemento = document.querySelector(step.selector);

            if (!elemento) {
                return;
            }

            pasos.push({
                element: elemento,
                popover: {
                    title: step.title,
                    description: step.description,
                    side: step.side,
                    align: step.align
                }
            });
        });

        return pasos;
    }

    function personalizarPopover(popover, state) {
        const pasoActual = Number(state?.activeIndex ?? 0);
        const esBienvenida = pasoActual === 0;

        popover.wrapper.classList.toggle(
            "driverjs-dueno-tour-welcome",
            esBienvenida
        );

        if (popover.previousButton) {
            popover.previousButton.style.display = esBienvenida ? "none" : "";
        }

        if (popover.closeButton) {
            popover.closeButton.style.display = esBienvenida ? "none" : "";
        }

        if (esBienvenida && popover.nextButton) {
            popover.nextButton.textContent = "Comenzar recorrido";
        }

        if (esBienvenida && popover.footerButtons) {
            if (!popover.footerButtons.querySelector("[data-tour-skip-btn='1']")) {
                const skipButton = document.createElement("button");
                skipButton.type = "button";
                skipButton.className = "driver-popover-footer-btn driver-tour-skip-btn";
                skipButton.dataset.tourSkipBtn = "1";
                skipButton.textContent = "Saltar recorrido";
                skipButton.addEventListener("click", () => {
                    finalizarTour();
                });

                popover.footerButtons.prepend(skipButton);
            }
        }
    }

    function destruirDriver() {
        if (runtime.driver?.isActive?.()) {
            runtime.driver.destroy();
        }

        runtime.driver = null;
    }

    function marcarCompletado() {
        if (!runtime.pageConfig) {
            return Promise.resolve();
        }

        return TrackAPI.request(
            `${obtenerRutaApiTutorial()}/${runtime.pageConfig.key}/completar`,
            {
                method: "POST"
            }
        )
            .then((respuesta) => {
                runtime.pageState = respuesta?.tutorial || runtime.pageState;
                return respuesta;
            })
            .catch((error) => {
                console.warn("No se pudo registrar el completado del tutorial.", error);
                return null;
            });
    }

    function finalizarTour() {
        const debePersistir = Boolean(runtime.autoPersist && !runtime.pageState?.completado);

        if (debePersistir) {
            marcarCompletado().finally(() => {
                destruirDriver();
            });
            return;
        }

        destruirDriver();
    }

    function finalizarTourReplay({ avanzarSiguiente = false } = {}) {
        destruirDriver();

        if (
            avanzarSiguiente &&
            runtime.tourReplayMode === "all" &&
            runtime.pageConfig
        ) {
            navegarASiguienteModuloReplay(runtime.pageConfig);
        }
    }

    function crearDriver(configuracion, autoPersistir) {
        const pasos = construirPasos(configuracion);
        const esReplayGlobal = runtime.tourReplayMode === "all";

        if (!window.driver?.js?.driver || !pasos.length) {
            return null;
        }

        runtime.autoPersist = Boolean(autoPersistir);

        return window.driver.js.driver({
            animate: true,
            overlayColor: "rgba(15, 23, 42, 0.72)",
            popoverClass: "driverjs-dueno-tour",
            popoverOffset: 14,
            showProgress: true,
            progressText: "Paso {{current}} de {{total}}",
            showButtons: ["next", "previous", "close"],
            nextBtnText: "Siguiente",
            prevBtnText: "Anterior",
            doneBtnText: "Finalizar",
            skipMissingElement: true,
            onCloseClick: () => {
                if (esReplayGlobal) {
                    finalizarTourReplay();
                    return;
                }

                finalizarTour();
            },
            onDoneClick: () => {
                if (esReplayGlobal) {
                    finalizarTourReplay({
                        avanzarSiguiente: true
                    });
                    return;
                }

                finalizarTour();
            },
            onPopoverRender: (popover, options) => {
                personalizarPopover(popover, options?.state);
            },
            steps: pasos
        });
    }

    function iniciarTour(configuracion, { forzado = false, persistir = true } = {}) {
        if (!configuracion) {
            return;
        }

        if (!forzado && runtime.pageState?.completado) {
            return;
        }

        destruirDriver();

        runtime.pageConfig = configuracion;
        runtime.autoPersist = Boolean(persistir);
        runtime.driver = crearDriver(configuracion, persistir);

        if (!runtime.driver) {
            return;
        }

        runtime.driver.drive(0);
    }

    function obtenerEstadoTutorial(configuracion) {
        return TrackAPI.request(
            `${obtenerRutaApiTutorial()}/${configuracion.key}/estado`
        );
    }

    function configurarBotonManual(configuracion) {
        const selector =
            runtime.role === "supervisor"
                ? '[data-supervisor-tour-trigger="true"]'
                : '[data-dueno-tour-trigger="true"]';

        document
            .querySelectorAll(selector)
            .forEach((boton) => {
                const bandera = runtime.role === "supervisor"
                    ? "supervisorTourBound"
                    : "duenoTourBound";

                if (boton.dataset[bandera] === "1") {
                    return;
                }

                boton.dataset[bandera] = "1";
                boton.addEventListener("click", () => {
                    if (runtime.role === "supervisor") {
                        runtime.tourReplayMode = "all";
                    }

                    iniciarTour(configuracion, {
                        forzado: true,
                        persistir: runtime.role === "supervisor"
                            ? false
                            : !runtime.pageState?.completado
                    });
                });
            });
    }

    async function inicializarTour() {
        const configuracion = obtenerConfiguracionActual();

        if (!configuracion) {
            return;
        }

        runtime.tourReplayMode = obtenerModoTourDesdeUrl(configuracion);

        const nombreApi = runtime.role === "supervisor"
            ? "TrackSupervisorTour"
            : "TrackDuenoTour";

        window[nombreApi] = {
            iniciarActual: () => iniciarTour(configuracion, {
                forzado: true,
                persistir: !runtime.pageState?.completado
            }),
            reiniciarActual: () => {
                iniciarTour(configuracion, {
                    forzado: true,
                    persistir: !runtime.pageState?.completado
                });
            },
            obtenerConfiguracionActual: () => configuracion
        };

        configurarBotonManual(configuracion);

        try {
            const tourForzadoDesdeUrl = Boolean(runtime.tourReplayMode);
            const respuesta = await obtenerEstadoTutorial(configuracion);
            runtime.pageState = respuesta?.tutorial || { completado: false };

            if (tourForzadoDesdeUrl || !runtime.pageState.completado) {
                window.setTimeout(() => {
                    if (tourForzadoDesdeUrl || !runtime.pageState?.completado) {
                        iniciarTour(configuracion, {
                            forzado: tourForzadoDesdeUrl,
                            persistir: !tourForzadoDesdeUrl && !runtime.pageState?.completado
                        });
                    }
                }, 350);
            }
        } catch (error) {
            console.warn("No se pudo consultar el estado del tutorial.", error);
        }
    }

    document.addEventListener("DOMContentLoaded", inicializarTour);
})();
