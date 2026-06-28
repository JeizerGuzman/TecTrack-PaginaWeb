let dashboardCargando = false;
let dashboardTimer = null;
const DASHBOARD_REFRESH_MS = 1000;

document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const autorizado = await TrackGuards.requireAuth("dueno");
        if (!autorizado) return;
    }

    await cargarDashboardDueno();

    dashboardTimer = setInterval(() => {
        cargarDashboardDueno({ silencioso: true });
    }, DASHBOARD_REFRESH_MS);
});

async function cargarDashboardDueno({ silencioso = false } = {}) {
    if (dashboardCargando) return;

    dashboardCargando = true;

    try {
        if (!silencioso) mostrarEstadoCarga(true);

        const [estadoData, vehiculosData, alertasData] = await Promise.all([
            TrackAPI.obtenerEstado(),
            TrackAPI.obtenerVehiculos(),
            TrackAPI.obtenerAlertas()
        ]);

        const vehiculos = (vehiculosData.vehiculos && vehiculosData.vehiculos.length)
            ? vehiculosData.vehiculos
            : (estadoData.vehiculos || []);

        const alertas = compactarAlertas(alertasData.alertas || []);

        renderCards(vehiculos, alertas);
        renderVehiculosResumen(vehiculos);
        renderAlertasRecientes(alertas);
        actualizarUltimaActualizacion();

    } catch (error) {
        console.error("Error cargando dashboard:", error);

        if (!silencioso) {
            mostrarToast(error.message || "No se pudo cargar el dashboard.", "error");
        }

        if (error.status === 401 || String(error.message).includes("401")) {
            if (window.TrackAuth) TrackAuth.clearSession();
            window.location.href = "/login";
        }

    } finally {
        dashboardCargando = false;
        if (!silencioso) mostrarEstadoCarga(false);
    }
}

function renderCards(vehiculos, alertas) {
    const totalVehiculos = vehiculos.length;

    const vehiculosActivos = vehiculos.filter(v => {
        const estado = normalizarTexto(v.estado);
        return estado === "activo" || estado === "manual";
    }).length;

    const alertasPendientes = alertas.filter(a => !a.atendida).length;

    const vehiculosEnAlerta = vehiculos.filter(v => {
        const estado = normalizarTexto(v.estado);
        return estado === "alerta" || estado === "panico" || Number(v.alerta) === 1;
    }).length;

    setText("totalVehiculos", totalVehiculos);
    setText("vehiculosActivos", vehiculosActivos);
    setText("alertasPendientes", alertasPendientes);
    setText("vehiculosEnAlerta", vehiculosEnAlerta);
}

function renderVehiculosResumen(vehiculos) {
    const contenedor = document.getElementById("vehiculosResumen");
    if (!contenedor) return;

    if (!vehiculos.length) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <strong>No hay vehículos registrados</strong>
                <p>Cuando agregues vehículos aparecerán aquí.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = vehiculos.slice(0, 6).map(v => {
        const estado = normalizarTexto(v.estado || "sin_senal");
        const estadoClase = claseEstado(estado);

        return `
            <article class="dashboard-vehicle-item ${estadoClase}">
                <div class="dashboard-vehicle-status"></div>

                <div class="dashboard-vehicle-main">
                    <div class="dashboard-vehicle-title-row">
                        <div>
                            <h3>${escapeHtml(v.nombre || "Vehículo sin nombre")}</h3>
                            <p>
                                ${escapeHtml(v.identificador || "Sin identificador")} · 
                                ${escapeHtml(v.chofer_nombre || "Sin chofer asignado")}
                            </p>
                        </div>

                        <span class="dashboard-badge ${estadoClase}">
                            ${formatearEstado(estado)}
                        </span>
                    </div> 

                    <div class="dashboard-vehicle-meta">
                        <span>Velocidad: ${v.velocidad ?? 0} km/h</span>
                        <span>Último reporte: ${tiempoRelativo(v.ultima_actualizacion)}</span>
                        <span>Dispositivo: ${escapeHtml(v.dispositivo_serie || "Sin vincular")}</span>
                    </div>
                </div>

                <div class="dashboard-vehicle-actions">
                    <a href="/dueno/vehiculos/${v.id}" class="btn btn-primary btn-sm">
                        Ver vehículo
                    </a>
                </div>
            </article>
        `;
    }).join("");
}

function renderAlertasRecientes(alertas) {
    const contenedor = document.getElementById("alertasRecientes");
    if (!contenedor) return;

    const visibles = alertas.slice(0, 5);

    if (!visibles.length) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <strong>Sin alertas recientes</strong>
                <p>Las alertas aparecerán aquí cuando el dispositivo detecte un evento.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = visibles.map(alerta => {
        const tipo = normalizarTexto(alerta.tipo || "alerta_general");
        const nivel = normalizarTexto(alerta.nivel || "medio");
        const atendida = Boolean(alerta.atendida);

        return `
            <article class="dashboard-alert-item nivel-${nivel} ${atendida ? "atendida" : ""}">
                <div class="dashboard-alert-icon">${iconoAlerta(tipo)}</div>

                <div class="dashboard-alert-main">
                    <div class="dashboard-alert-title-row">
                        <strong>${formatearTipoAlerta(tipo)}</strong>
                        <span class="dashboard-badge nivel-${nivel}">${formatearNivel(nivel)}</span>
                    </div>

                    <p>${escapeHtml(alerta.descripcion || "Sin descripción")}</p>

                    <div class="dashboard-alert-meta">
                        <span>${escapeHtml(alerta.vehiculo || "Sin vehículo")}</span>
                        <span>${tiempoRelativo(alerta.timestamp)}</span>
                        <span>${atendida ? "Atendida" : "Pendiente"}</span>
                    </div>
                </div>

                <a href="/dueno/vehiculos/${alerta.vehiculo_id}" class="btn btn-outline btn-sm">
                    Ver vehículo
                </a>
            </article>
        `;
    }).join("");
}

function compactarAlertas(alertas) {
    const mapa = new Map();

    alertas.forEach(alerta => {
        const clave = [
            alerta.vehiculo_id || alerta.vehiculo || "sin_vehiculo",
            alerta.tipo || "alerta_general",
            alerta.atendida ? "atendida" : "pendiente"
        ].join("-");

        if (!mapa.has(clave)) {
            mapa.set(clave, alerta);
            return;
        }

        const existente = mapa.get(clave);
        if (Number(alerta.timestamp || 0) > Number(existente.timestamp || 0)) {
            mapa.set(clave, alerta);
        }
    });

    return Array.from(mapa.values())
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}

function actualizarUltimaActualizacion() {
    const el = document.getElementById("ultimaActualizacion");
    if (!el) return;

    const ahora = new Date();

    el.textContent = `Actualizado ${ahora.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })}`;
}

function mostrarEstadoCarga(mostrar) {
    const el = document.getElementById("estadoCargaDashboard");
    if (!el) return;
    el.style.opacity = mostrar ? "1" : "0";
}

function claseEstado(estado) {
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
        activo: "Activo",
        alerta: "Alerta",
        panico: "Pánico",
        manual: "Manual",
        sin_senal: "Sin señal",
        apagado: "Apagado",
        desconocido: "Desconocido"
    };

    return mapa[estado] || "Desconocido";
}

function formatearTipoAlerta(tipo) {
    const mapa = {
        panico: "Botón de pánico",
        puerta_abierta: "Puerta abierta",
        vibracion: "Vibración detectada",
        alerta_general: "Alerta general"
    };

    return mapa[tipo] || tipo.replaceAll("_", " ");
}

function formatearNivel(nivel) {
    const mapa = {
        critico: "Crítico",
        alto: "Alto",
        medio: "Medio",
        bajo: "Bajo"
    };

    return mapa[nivel] || "Medio";
}

function iconoAlerta(tipo) {
    if (tipo === "panico") return "!";
    if (tipo === "puerta_abierta") return "P";
    if (tipo === "vibracion") return "V";
    return "A";
}

function tiempoRelativo(timestamp) {
    if (!timestamp) return "Sin registro";

    const ahora = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, ahora - Number(timestamp));

    if (diff < 10) return "Ahora";
    if (diff < 60) return `Hace ${diff} seg`;

    const minutos = Math.floor(diff / 60);
    if (minutos < 60) return `Hace ${minutos} min`;

    const horas = Math.floor(minutos / 60);
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

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function mostrarToast(mensaje, tipo = "info") {
    let toast = document.getElementById("dashboardToast");

    if (!toast) {
        toast = document.createElement("div");
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
    if (dashboardTimer) clearInterval(dashboardTimer);
});