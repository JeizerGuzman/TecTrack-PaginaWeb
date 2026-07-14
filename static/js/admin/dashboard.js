let adminDashboardTimer = null;
let adminDashboardCargando = false;

const COLORES_GRAFICAS = {
    azul: "#2563eb",
    verde: "#16a34a",
    rojo: "#dc2626",
    naranja: "#f59e0b",
    morado: "#7c3aed",
    gris: "#94a3b8",
    cyan: "#0891b2",
    rosa: "#db2777",
};

document.addEventListener("DOMContentLoaded", async () => {

    if (window.TrackGuards?.requireAuth) {
        const autorizado = await TrackGuards.requireAuth("admin");

        if (!autorizado) {
            return;
        }
    }


    await cargarDashboardAdmin();


    const intervaloMs =
        await TrackConfig.obtenerAdminMs(
            "dashboard",
            30
        );


    if (adminDashboardTimer) {
        clearInterval(adminDashboardTimer);
    }


    adminDashboardTimer = setInterval(
        cargarDashboardAdmin,
        intervaloMs
    );

});

async function cargarDashboardAdmin() {
    if (adminDashboardCargando) return;

    adminDashboardCargando = true;
    
    try {
        const data = await TrackAPI.obtenerResumenAdmin();

        const metricas = data.metricas || {};
        const graficas = data.graficas || {};

        setText("totalEmpresas", metricas.total_empresas || 0);
        setText("empresasActivasTexto", `${metricas.empresas_activas || 0} activas`);

        setText("totalUsuarios", metricas.total_usuarios || 0);
        setText("usuariosActivosTexto", `${metricas.usuarios_activos || 0} activos`);

        setText("totalVehiculos", metricas.total_vehiculos || 0);
        setText("vehiculosActivosTexto", `${metricas.vehiculos_activos || 0} activos`);

        setText("alertasPendientes", metricas.alertas_pendientes || 0);
        setText("totalAlertasTexto", `${metricas.total_alertas || 0} alertas totales`);

        setText("totalDispositivos", metricas.total_dispositivos || 0);
        setText("dispositivosDisponiblesTexto", `${metricas.dispositivos_disponibles || 0} disponibles`);

        setText("vehiculosSinSenal", metricas.vehiculos_sin_senal || 0);
        setText("vehiculosEnAlertaTexto", `${metricas.vehiculos_en_alerta || 0} en alerta`);

        dibujarGraficaBarras(
            "graficaVehiculos",
            "leyendaVehiculos",
            prepararVehiculos(graficas.vehiculos_por_estado || {})
        );

        dibujarGraficaDona(
            "graficaDispositivos",
            "leyendaDispositivos",
            prepararDispositivos(graficas.dispositivos_por_estado || {})
        );

        dibujarGraficaBarras(
            "graficaUsuarios",
            "leyendaUsuarios",
            prepararUsuarios(graficas.usuarios_por_rol || {})
        );

        dibujarGraficaDona(
            "graficaEmpresas",
            "leyendaEmpresas",
            prepararEmpresas(graficas.empresas_por_estado || {})
        );

        actualizarUltimaActualizacion();

    } catch (error) {
        console.error("Error cargando dashboard admin:", error);
        setText("adminUltimaActualizacion", "Error al actualizar");
    } finally {
        adminDashboardCargando = false;
    }
}

function prepararVehiculos(datos) {
    return [
        { label: "Activos", value: datos.activo || 0, color: COLORES_GRAFICAS.verde },
        { label: "Alertas", value: datos.alerta || 0, color: COLORES_GRAFICAS.rojo },
        { label: "Pánico", value: datos.panico || 0, color: COLORES_GRAFICAS.rojo },
        { label: "Manual", value: datos.manual || 0, color: COLORES_GRAFICAS.azul },
        { label: "Sin señal", value: datos.sin_senal || 0, color: COLORES_GRAFICAS.gris },
        { label: "Apagado", value: datos.apagado || 0, color: COLORES_GRAFICAS.naranja },
    ];
}

function prepararDispositivos(datos) {
    return [
        { label: "Disponibles", value: datos.disponible || 0, color: COLORES_GRAFICAS.azul },
        { label: "Instalados", value: (datos.instalado || 0) + (datos.activo || 0), color: COLORES_GRAFICAS.verde },
        { label: "Mantenimiento", value: datos.mantenimiento || 0, color: COLORES_GRAFICAS.naranja },
        { label: "Desactivados", value: datos.desactivado || 0, color: COLORES_GRAFICAS.gris },
    ];
}

function prepararUsuarios(datos) {
    return [
        { label: "Admin", value: datos.admin || 0, color: COLORES_GRAFICAS.morado },
        { label: "Dueños", value: datos.dueno || 0, color: COLORES_GRAFICAS.azul },
        { label: "Supervisores", value: datos.supervisor || 0, color: COLORES_GRAFICAS.cyan },
        { label: "Choferes", value: datos.chofer || 0, color: COLORES_GRAFICAS.verde },
        { label: "Técnicos", value: datos.tecnico || 0, color: COLORES_GRAFICAS.naranja },
    ];
}

function prepararEmpresas(datos) {
    return [
        { label: "Activas", value: datos.activas || 0, color: COLORES_GRAFICAS.verde },
        { label: "Inactivas", value: datos.inactivas || 0, color: COLORES_GRAFICAS.gris },
    ];
}

function prepararCanvas(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;

    const parent = canvas.parentElement;
    const width = Math.max(parent?.clientWidth || canvas.clientWidth || 320, 320);
    const height = 220;

    canvas.style.width = "100%";
    canvas.style.height = `${height}px`;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    return { width, height };
}

function dibujarGraficaBarras(canvasId, legendId, items) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const { width, height } = prepararCanvas(canvas, ctx);

    const max = Math.max(...items.map(item => item.value), 1);
    const padding = 28;
    const chartWidth = width - padding * 2;
    const chartHeight = height - 58;
    const barGap = 12;
    const barWidth = Math.max(24, (chartWidth - barGap * (items.length - 1)) / items.length);

    ctx.font = "700 12px system-ui";
    ctx.textAlign = "center";

    items.forEach((item, index) => {
        const x = padding + index * (barWidth + barGap);
        const barHeight = (item.value / max) * chartHeight;
        const y = height - 36 - barHeight;

        ctx.fillStyle = "#eef2f7";
        redondearRect(ctx, x, height - 36 - chartHeight, barWidth, chartHeight, 10);
        ctx.fill();

        ctx.fillStyle = item.color;
        redondearRect(ctx, x, y, barWidth, barHeight || 3, 10);
        ctx.fill();

        ctx.fillStyle = "#0f172a";
        ctx.fillText(String(item.value), x + barWidth / 2, y - 8);

        ctx.fillStyle = "#64748b";
        ctx.font = "750 11px system-ui";
        ctx.fillText(cortarTexto(item.label, 10), x + barWidth / 2, height - 14);
    });

    renderLeyenda(legendId, items);
}

function dibujarGraficaDona(canvasId, legendId, items) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const { width, height } = prepararCanvas(canvas, ctx);

    const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 18;
    const innerRadius = radius * 0.62;

    if (total <= 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "#e8eef7";
        ctx.lineWidth = radius - innerRadius;
        ctx.stroke();

        ctx.fillStyle = "#64748b";
        ctx.font = "800 14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Sin datos", cx, cy + 5);

        renderLeyenda(legendId, items);
        return;
    }

    let start = -Math.PI / 2;

    items.forEach(item => {
        const value = Number(item.value || 0);
        const angle = (value / total) * Math.PI * 2;

        if (value <= 0) return;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, start, start + angle);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = radius - innerRadius;
        ctx.lineCap = "round";
        ctx.stroke();

        start += angle;
    });

    ctx.fillStyle = "#0f172a";
    ctx.font = "850 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(String(total), cx, cy - 2);

    ctx.fillStyle = "#64748b";
    ctx.font = "750 12px system-ui";
    ctx.fillText("Total", cx, cy + 20);

    renderLeyenda(legendId, items);
}

function renderLeyenda(legendId, items) {
    const contenedor = document.getElementById(legendId);
    if (!contenedor) return;

    contenedor.innerHTML = items.map(item => `
        <span class="chart-legend-item">
            <span class="chart-legend-dot" style="background:${item.color}"></span>
            ${escapeHtml(item.label)}: ${Number(item.value || 0)}
        </span>
    `).join("");
}

function redondearRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function actualizarUltimaActualizacion() {
    const ahora = new Date();

    setText("adminUltimaActualizacion", `Actualizado ${ahora.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })}`);
}

function cortarTexto(texto, limite) {
    texto = String(texto || "");

    if (texto.length <= limite) return texto;

    return texto.substring(0, limite - 1) + "…";
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

window.addEventListener("beforeunload", () => {
    if (adminDashboardTimer) {
        clearInterval(adminDashboardTimer);
    }
});