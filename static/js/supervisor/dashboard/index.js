let dashboardCargando = false;
let dashboardTimer = null;

let tiempoSinSenalSegundos = 60;
let dashboardVehiculos = [];
let dashboardAlertas = [];
let dashboardEventos = [];

let dashboardMapa = null;
let dashboardMapaModal = null;
let dashboardMarcadores = [];
let dashboardMarcadoresModal = [];
let dashboardMapaCentradoInicial = false;
let dashboardMapaModalCentradoInicial = false;

const DASHBOARD_DETAIL_PREFIX = "/supervisor/vehiculos";

document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const autorizado = await TrackGuards.requireAuth("supervisor");

        if (!autorizado) {
            return;
        }
    }

    configurarEventosDashboard();

    if (window.TrackConfig?.obtenerSegundosSinSenal) {
        tiempoSinSenalSegundos = await TrackConfig.obtenerSegundosSinSenal();
    }

    await cargarDashboard({
        silencioso: false
    });

    const intervaloMs =
        window.TrackConfig?.obtenerOperacionMs
            ? await TrackConfig.obtenerOperacionMs("dashboard", 5)
            : 5000;

    if (dashboardTimer) {
        clearInterval(dashboardTimer);
    }

    dashboardTimer = setInterval(
        () => {
            cargarDashboard({
                silencioso: true
            });
        },
        intervaloMs
    );
});

function configurarEventosDashboard() {
    document
        .getElementById("btnAbrirMapaDashboard")
        ?.addEventListener("click", abrirModalMapaDashboard);

    document
        .getElementById("btnCentrarMapaDashboard")
        ?.addEventListener("click", () => {
            renderMapaEnContenedor(
                "dashboardMapaFlota",
                false,
                true
            );
        });

    document
        .getElementById("btnCentrarMapaDashboardModal")
        ?.addEventListener("click", () => {
            renderMapaEnContenedor(
                "dashboardMapaFlotaModal",
                true,
                true
            );
        });

    document
        .querySelectorAll("[data-cerrar-mapa-dashboard]")
        .forEach((boton) => {
            boton.addEventListener("click", cerrarModalMapaDashboard);
        });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            cerrarModalMapaDashboard();
        }
    });
}

async function cargarDashboard({ silencioso = false } = {}) {
    if (dashboardCargando) return;

    dashboardCargando = true;

    try {
        if (!silencioso) {
            mostrarEstadoCarga(true);
        }

        const [estadoData, vehiculosData, alertasData, eventosData] =
            await Promise.all([
                TrackAPI.obtenerEstado(),
                TrackAPI.obtenerVehiculos().catch(() => null),
                TrackAPI.obtenerAlertas().catch(() => ({ alertas: [] })),
                obtenerEventosDashboard().catch(() => ({ registros: [] }))
            ]);

        dashboardVehiculos =
            combinarVehiculosDashboard(
                estadoData,
                vehiculosData
            );

        dashboardAlertas =
            compactarAlertas(
                Array.isArray(alertasData?.alertas)
                    ? alertasData.alertas
                    : []
            );

        dashboardEventos =
            Array.isArray(eventosData?.registros)
                ? eventosData.registros
                : [];

        renderMetricasDashboard();
        renderMapaDashboard();
        renderAlertasDashboard();
        renderEventosDashboard();
        actualizarUltimaActualizacion();

    } catch (error) {
        console.error("Error cargando dashboard:", error);

        if (!silencioso) {
            mostrarToast(
                error.message ||
                "No se pudo cargar el dashboard.",
                "error"
            );
        }

        if (
            error.status === 401 ||
            String(error.message).includes("401")
        ) {
            if (window.TrackAuth) {
                TrackAuth.clearSession();
            }

            window.location.href = "/login";
        }

    } finally {
        dashboardCargando = false;

        if (!silencioso) {
            mostrarEstadoCarga(false);
        }
    }
}

function obtenerEventosDashboard() {
    if (window.TrackAPI?.obtenerHistorialDueno) {
        return TrackAPI.obtenerHistorialDueno({
            categoria: "eventos",
            limite: 20
        });
    }

    return Promise.resolve({
        registros: []
    });
}

function combinarVehiculosDashboard(estadoData, vehiculosData) {
    const mapa = new Map();

    const vehiculosBase =
        Array.isArray(vehiculosData?.vehiculos)
            ? vehiculosData.vehiculos
            : [];

    const vehiculosEstado =
        Array.isArray(estadoData?.vehiculos)
            ? estadoData.vehiculos
            : [];

    vehiculosBase.forEach((vehiculo) => {
        if (vehiculo?.id === undefined || vehiculo?.id === null) return;

        mapa.set(
            Number(vehiculo.id),
            vehiculo
        );
    });

    vehiculosEstado.forEach((vehiculo) => {
        if (vehiculo?.id === undefined || vehiculo?.id === null) return;

        const id = Number(vehiculo.id);
        const existente = mapa.get(id) || {};

        const combinado = {
            ...existente,
            ...vehiculo
        };

        /*
         * Si el vehículo pierde señal, algunas respuestas pueden venir
         * sin lat/lng actualizados. En ese caso conservamos la última
         * ubicación conocida que venía de /api/vehiculos.
         */
        if (
            !tieneGpsValidoDashboard(combinado) &&
            tieneGpsValidoDashboard(existente)
        ) {
            combinado.lat = existente.lat;
            combinado.lng = existente.lng;
            combinado.direccion = existente.direccion;
            combinado.ultima_actualizacion_direccion =
                existente.ultima_actualizacion_direccion;
        }

        mapa.set(
            id,
            combinado
        );
    });

    return Array.from(
        mapa.values()
    );
}

function obtenerInicioDiaTimestamp() {
    const fecha = new Date();

    fecha.setHours(
        0,
        0,
        0,
        0
    );

    return Math.floor(
        fecha.getTime() / 1000
    );
}

function obtenerAlertasDeHoy(alertas) {
    const inicioDia =
        obtenerInicioDiaTimestamp();

    return alertas.filter((alerta) => {
        const timestamp = Number(
            alerta.timestamp || 0
        );

        return (
            Number.isFinite(timestamp) &&
            timestamp >= inicioDia
        );
    });
}

function renderMetricasDashboard() {
    const totalVehiculos =
        dashboardVehiculos.length;

    const vehiculosSinSenal =
        dashboardVehiculos.filter(
            (vehiculo) => estaSinSenal(vehiculo)
        ).length;

    const vehiculosEnLinea =
        dashboardVehiculos.filter(
            (vehiculo) => !estaSinSenal(vehiculo)
        ).length;

    const vehiculosEnAlerta =
        dashboardVehiculos.filter((vehiculo) => {
            if (estaSinSenal(vehiculo)) {
                return false;
            }

            const estado =
                obtenerEstadoVisual(vehiculo);

            return (
                estado === "alerta" ||
                estado === "panico" ||
                Number(vehiculo.alerta || 0) === 1
            );
        }).length;

    setText("totalVehiculos", totalVehiculos);
    setText("vehiculosEnLinea", vehiculosEnLinea);
    setText("vehiculosEnAlerta", vehiculosEnAlerta);
    setText("vehiculosSinSenal", vehiculosSinSenal);
}

function renderMapaDashboard() {
    renderMapaEnContenedor(
        "dashboardMapaFlota",
        false
    );

    if (dashboardMapaModal) {
        renderMapaEnContenedor(
            "dashboardMapaFlotaModal",
            true,
            false
        );
    }
}

function renderMapaEnContenedor(contenedorId, esModal, forzarCentrado = false) {
    const contenedor =
        document.getElementById(contenedorId);

    if (!contenedor || !window.L) {
        return;
    }

    const mapaActual =
        esModal
            ? dashboardMapaModal
            : dashboardMapa;

    const marcadoresActuales =
        esModal
            ? dashboardMarcadoresModal
            : dashboardMarcadores;

    let mapa =
        mapaActual;

    if (!mapa) {
        mapa = L.map(
            contenedorId,
            {
                zoomControl: true
            }
        ).setView(
            [16.7569, -93.1292],
            12
        );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap"
            }
        ).addTo(mapa);

        if (esModal) {
            dashboardMapaModal = mapa;
        } else {
            dashboardMapa = mapa;
        }
    }

    marcadoresActuales.forEach((marcador) => {
        mapa.removeLayer(marcador);
    });

    marcadoresActuales.length = 0;

    const vehiculosConGps =
        dashboardVehiculos.filter(
            tieneGpsValidoDashboard
        );

    if (!vehiculosConGps.length) {
        const debeCentrar =
            forzarCentrado ||
            (esModal
                ? !dashboardMapaModalCentradoInicial
                : !dashboardMapaCentradoInicial);

        if (debeCentrar) {
            mapa.setView(
                [16.7569, -93.1292],
                12
            );

            if (esModal) {
                dashboardMapaModalCentradoInicial = true;
            } else {
                dashboardMapaCentradoInicial = true;
            }
        }

        setTimeout(
            () => mapa.invalidateSize(),
            100
        );

        return;
    }

    const bounds = [];

    vehiculosConGps.forEach((vehiculo) => {
        const lat = Number(vehiculo.lat);
        const lng = Number(vehiculo.lng);
        const estado = obtenerEstadoVisual(vehiculo);

        const marcador =
            L.marker(
                [lat, lng],
                {
                    icon: crearIconoVehiculoDashboard(estado)
                }
            ).addTo(mapa);

        marcador.bindPopup(
            crearPopupVehiculoDashboard(
                vehiculo,
                estado
            )
        );

        marcadoresActuales.push(marcador);
        bounds.push([lat, lng]);
    });

    const debeCentrar =
        forzarCentrado ||
        (esModal
            ? !dashboardMapaModalCentradoInicial
            : !dashboardMapaCentradoInicial);

    if (debeCentrar) {
        if (bounds.length === 1) {
            mapa.setView(
                bounds[0],
                esModal ? 15 : 14
            );
        } else {
            mapa.fitBounds(
                bounds,
                {
                    padding: [38, 38],
                    maxZoom: esModal ? 15 : 14
                }
            );
        }

        if (esModal) {
            dashboardMapaModalCentradoInicial = true;
        } else {
            dashboardMapaCentradoInicial = true;
        }
    }

    setTimeout(
        () => mapa.invalidateSize(),
        100
    );
}

function crearIconoVehiculoDashboard(estado) {
    const claseEstado =
        claseEstadoDashboard(estado);

    return L.divIcon({
        className: "dashboard-map-marker-wrap",
        html: `
            <span class="dashboard-map-marker ${claseEstado}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 16V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"></path>
                    <path d="M2 16h20"></path>
                    <path d="M6 16v3"></path>
                    <path d="M18 16v3"></path>
                    <circle cx="7.5" cy="16.5" r="1.5"></circle>
                    <circle cx="16.5" cy="16.5" r="1.5"></circle>
                    <path d="M17 11h3l2 3v2"></path>
                </svg>
            </span>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
    });
}

function crearPopupVehiculoDashboard(vehiculo, estado) {
    const direccion =
        window.TrackDireccion
            ? TrackDireccion.obtenerTexto(vehiculo)
            : (
                vehiculo.direccion ||
                "Dirección no disponible"
            );

    const etiquetaUbicacion =
        estado === "sin_senal"
            ? "Última ubicación conocida"
            : "Ubicación actual";

    return `
        <div class="dashboard-popup">
            <strong>${escapeHtml(vehiculo.nombre || "Vehículo")}</strong>
            <span>${escapeHtml(vehiculo.placa || vehiculo.identificador || "Sin identificador")}</span>
            <span>Estado: ${escapeHtml(formatearEstado(estado))}</span>
            <span>Velocidad: ${escapeHtml(formatearVelocidad(vehiculo.velocidad))}</span>
            <span>${escapeHtml(etiquetaUbicacion)}: ${escapeHtml(direccion)}</span>
            <a href="${DASHBOARD_DETAIL_PREFIX}/${Number(vehiculo.id)}">Ver detalle</a>
        </div>
    `;
}

function renderAlertasDashboard() {
    const contenedor =
        document.getElementById("alertasRecientes");

    if (!contenedor) return;

    const visibles =
        obtenerAlertasDeHoy(
            dashboardAlertas
        ).slice(0, 4);

    if (!visibles.length) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <strong>Sin alertas de hoy</strong>
                <p>Las alertas del día aparecerán cuando el dispositivo detecte un evento.</p>
            </div>
        `;

        return;
    }

    contenedor.innerHTML =
        visibles.map((alerta) => {
            const tipo = normalizarTexto(
                alerta.tipo ||
                "alerta_general"
            );

            const nivel = normalizarTexto(
                alerta.nivel ||
                "medio"
            );

            const atendida =
                Boolean(alerta.atendida);

            return `
                <article class="dashboard-alert-item nivel-${nivel} ${atendida ? "atendida" : ""}">
                    <div class="dashboard-alert-icon">
                        ${svgAlertaDashboard(tipo)}
                    </div>

                    <div class="dashboard-alert-main">
                        <div class="dashboard-alert-title-row">
                            <strong>${escapeHtml(formatearTipoAlerta(tipo))}</strong>
                            <span class="dashboard-badge ${atendida ? "badge-atendida" : "badge-pendiente"}">
                                ${atendida ? "Atendida" : "Pendiente"}
                            </span>
                        </div>

                        <p>${escapeHtml(alerta.descripcion || "Sin descripción")}</p>

                        <div class="dashboard-alert-meta">
                            <span>${escapeHtml(alerta.vehiculo || "Sin vehículo")}</span>
                            <span>${tiempoRelativo(alerta.timestamp)}</span>
                        </div>
                    </div>

                    <a href="${DASHBOARD_DETAIL_PREFIX}/${Number(alerta.vehiculo_id || 0)}" class="btn btn-outline btn-sm">
                        Ver
                    </a>
                </article>
            `;
        }).join("");
}

function renderEventosDashboard() {
    const contenedor =
        document.getElementById("dashboardEventosRecientes");

    if (!contenedor) return;

    const visibles =
        dashboardEventos.slice(0, 6);

    if (!visibles.length) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <strong>Sin eventos recientes</strong>
                <p>La bitácora aparecerá cuando exista actividad de los vehículos.</p>
            </div>
        `;

        return;
    }

    contenedor.innerHTML =
        visibles.map((evento) => `
            <article class="dashboard-evento-item">
                <div>
                    <strong>${escapeHtml(evento.titulo || formatearTipoEvento(evento.tipo))}</strong>
                    <p>${escapeHtml(evento.descripcion || "Sin descripción")}</p>
                    <small>${escapeHtml(evento.vehiculo || "Sin vehículo")} · ${tiempoRelativo(evento.timestamp)}</small>
                </div>

                <a href="${DASHBOARD_DETAIL_PREFIX}/${Number(evento.vehiculo_id || 0)}" class="btn btn-outline btn-sm">
                    Ver
                </a>
            </article>
        `).join("");
}

function abrirModalMapaDashboard() {
    const modal =
        document.getElementById("modalMapaDashboard");

    if (!modal) return;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("dashboard-map-modal-open");

    setTimeout(() => {
        renderMapaEnContenedor(
            "dashboardMapaFlotaModal",
            true,
            false
        );

        dashboardMapaModal?.invalidateSize();
    }, 120);
}

function cerrarModalMapaDashboard() {
    const modal =
        document.getElementById("modalMapaDashboard");

    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dashboard-map-modal-open");
}

function estaSinSenal(vehiculo) {
    if (!vehiculo) return true;

    if (
        vehiculo.sin_senal === true ||
        vehiculo.online === false
    ) {
        return true;
    }

    const ultima =
        Number(
            vehiculo.ultima_conexion ||
            vehiculo.ultima_actualizacion
        );

    if (!Number.isFinite(ultima) || ultima <= 0) {
        return true;
    }

    const ahora =
        Math.floor(Date.now() / 1000);

    return (
        ahora - ultima >
        tiempoSinSenalSegundos
    );
}

function obtenerEstadoVisual(vehiculo) {
    if (estaSinSenal(vehiculo)) {
        return "sin_senal";
    }

    const estado =
        normalizarTexto(
            vehiculo.estado_mostrado ||
            vehiculo.estado ||
            "sin_senal"
        );

    if (estado === "modo_manual") {
        return "manual";
    }

    return estado;
}

function tieneGpsValidoDashboard(vehiculo) {
    if (!vehiculo) return false;

    const lat = Number(vehiculo.lat);
    const lng = Number(vehiculo.lng);

    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !(lat === 0 && lng === 0)
    );
}

function compactarAlertas(alertas) {
    const mapa = new Map();

    alertas.forEach((alerta) => {
        const clave = [
            alerta.vehiculo_id || alerta.vehiculo || "sin_vehiculo",
            alerta.tipo || "alerta_general",
            alerta.atendida ? "atendida" : "pendiente"
        ].join("-");

        const existente =
            mapa.get(clave);

        if (
            !existente ||
            Number(alerta.timestamp || 0) >
            Number(existente.timestamp || 0)
        ) {
            mapa.set(clave, alerta);
        }
    });

    return Array
        .from(mapa.values())
        .sort(
            (a, b) =>
                Number(b.timestamp || 0) -
                Number(a.timestamp || 0)
        );
}

function actualizarUltimaActualizacion() {
    const el =
        document.getElementById("ultimaActualizacion");

    if (!el) return;

    const ahora =
        new Date();

    el.textContent =
        `Actualizado ${ahora.toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        })}`;
}

function mostrarEstadoCarga(mostrar) {
    const el =
        document.getElementById("estadoCargaDashboard");

    if (!el) return;

    el.textContent =
        mostrar
            ? "Sincronizando..."
            : "En tiempo real";
}

function claseEstadoDashboard(estado) {
    estado = normalizarTexto(estado);

    if (estado === "activo") return "estado-activo";
    if (estado === "alerta") return "estado-alerta";
    if (estado === "panico") return "estado-panico";
    if (estado === "manual") return "estado-manual";
    if (estado === "sin_senal") return "estado-sin-senal";
    if (estado === "apagado") return "estado-apagado";

    return "estado-desconocido";
}

function formatearEstado(estado) {
    const mapa = {
        activo: "En línea",
        alerta: "En alerta",
        panico: "Pánico",
        manual: "Modo manual",
        sin_senal: "Sin señal",
        apagado: "Apagado",
        desconocido: "Desconocido"
    };

    return mapa[normalizarTexto(estado)] || "Desconocido";
}

function formatearTipoAlerta(tipo) {
    const mapa = {
        panico: "Botón de pánico",
        puerta_abierta: "Puerta abierta",
        vibracion: "Vibración detectada",
        alerta_general: "Alerta general"
    };

    return mapa[normalizarTexto(tipo)] || String(tipo || "Alerta").replaceAll("_", " ");
}

function formatearTipoEvento(tipo) {
    const mapa = {
        vehiculo_creado: "Vehículo creado",
        vehiculo_editado: "Vehículo editado",
        vehiculo_desactivado: "Vehículo desactivado",
        vehiculo_reactivado: "Vehículo reactivado",
        alerta_atendida: "Alerta atendida",
        dispositivo_vinculado: "Dispositivo vinculado",
        modo_manual_activado: "Modo manual activado",
        modo_manual_desactivado: "Modo manual desactivado",
        encendido: "Dispositivo encendido",
        apagado: "Dispositivo apagado"
    };

    return mapa[normalizarTexto(tipo)] || String(tipo || "Evento").replaceAll("_", " ");
}

function formatearVelocidad(valor) {
    const numero =
        Number(valor);

    if (!Number.isFinite(numero)) {
        return "0 km/h";
    }

    return `${numero.toFixed(1)} km/h`;
}

function svgAlertaDashboard(tipo) {
    if (tipo === "panico") {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
            </svg>
        `;
    }

    if (tipo === "puerta_abierta") {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 4h3a2 2 0 0 1 2 2v14"></path>
                <path d="M2 20h20"></path>
                <path d="M13 20V4L6 6v14"></path>
            </svg>
        `;
    }

    if (tipo === "vibracion") {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 8h2l2 8 4-12 4 16 3-12 1 4h2"></path>
            </svg>
        `;
    }

    return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 9v4"></path>
            <path d="M12 17h.01"></path>
            <circle cx="12" cy="12" r="10"></circle>
        </svg>
    `;
}

function tiempoRelativo(timestamp) {
    if (!timestamp) return "Sin registro";

    const ahora =
        Math.floor(Date.now() / 1000);

    const diff =
        Math.max(
            0,
            ahora - Number(timestamp)
        );

    if (diff < 10) return "Ahora";
    if (diff < 60) return `Hace ${diff} seg`;

    const minutos =
        Math.floor(diff / 60);

    if (minutos < 60) return `Hace ${minutos} min`;

    const horas =
        Math.floor(minutos / 60);

    if (horas < 24) return `Hace ${horas} h`;

    return `Hace ${Math.floor(horas / 24)} días`;
}

function normalizarTexto(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setText(id, valor) {
    const el =
        document.getElementById(id);

    if (el) {
        el.textContent = valor;
    }
}

function mostrarToast(mensaje, tipo = "info") {
    let toast =
        document.getElementById("dashboardToast");

    if (!toast) {
        toast =
            document.createElement("div");

        toast.id = "dashboardToast";
        toast.className = "dashboard-toast";
        document.body.appendChild(toast);
    }

    toast.textContent = mensaje;
    toast.className = `dashboard-toast ${tipo} visible`;

    setTimeout(() => {
        toast.classList.remove("visible");
    }, 3500);
}

window.addEventListener("beforeunload", () => {
    if (dashboardTimer) {
        clearInterval(dashboardTimer);
    }
});
