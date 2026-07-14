let alertasCargando = false;
let alertasTimer = null;

let alertasOriginales = [];
let alertaSeleccionada = null;

document.addEventListener("DOMContentLoaded", async () => {

    if (window.TrackGuards?.requireAuth) {

        const ok =
            await TrackGuards.requireAuth("dueno");

        if (!ok) {
            return;
        }

    }


    configurarModalAtencion();


    await cargarAlertas();


    const intervaloMs =
        await TrackConfig.obtenerOperacionMs(
            "alertas",
            5
        );


    if (alertasTimer) {
        clearInterval(alertasTimer);
    }


    alertasTimer = setInterval(
        () => {

            cargarAlertas({
                silencioso: true
            });

        },
        intervaloMs
    );


    document
        .getElementById("buscarAlerta")
        ?.addEventListener(
            "input",
            renderConFiltros
        );


    document
        .getElementById("filtroEstadoAlerta")
        ?.addEventListener(
            "change",
            renderConFiltros
        );


    document
        .getElementById("filtroTipoAlerta")
        ?.addEventListener(
            "change",
            renderConFiltros
        );


    document
        .getElementById("filtroNivelAlerta")
        ?.addEventListener(
            "change",
            renderConFiltros
        );

});

async function cargarAlertas({ silencioso = false } = {}) {
    if (alertasCargando) return;

    alertasCargando = true;

    try {
        if (!silencioso) mostrarEstadoCarga(true);

        const response = await TrackAPI.obtenerAlertas();
        alertasOriginales = response.alertas || [];

        renderStats(alertasOriginales);
        renderConFiltros();
        actualizarUltimaActualizacion();

    } catch (error) {
        console.error("Error cargando alertas:", error);

        if (!silencioso) {
            document.getElementById("alertasListado").innerHTML = `
                <div class="empty-state">
                    <strong>No se pudieron cargar las alertas</strong>
                    <p>${escapeHtml(error.message || "Ocurrió un error al consultar alertas.")}</p>
                </div>
            `;
        }

        if (error.status === 401 || String(error.message).includes("401")) {
            if (window.TrackAuth) TrackAuth.clearSession();
            window.location.href = "/login";
        }

    } finally {
        alertasCargando = false;
        if (!silencioso) mostrarEstadoCarga(false);
    }
}

function renderStats(alertas) {
    const total = alertas.length;
    const pendientes = alertas.filter(a => !a.atendida).length;
    const atendidas = alertas.filter(a => a.atendida).length;
    const criticas = alertas.filter(a => {
        const nivel = normalizar(a.nivel);
        return nivel === "critico" || nivel === "alto";
    }).length;

    setText("statAlertasTotal", total);
    setText("statAlertasPendientes", pendientes);
    setText("statAlertasAtendidas", atendidas);
    setText("statAlertasCriticas", criticas);
}

function renderConFiltros() {
    const texto = normalizar(document.getElementById("buscarAlerta")?.value || "");
    const estado = document.getElementById("filtroEstadoAlerta")?.value || "todas";
    const tipo = document.getElementById("filtroTipoAlerta")?.value || "todos";
    const nivel = document.getElementById("filtroNivelAlerta")?.value || "todos";

    let filtradas = [...alertasOriginales];

    if (texto) {
        filtradas = filtradas.filter(a => {
            const contenido = normalizar(`${a.vehiculo || ""} ${a.descripcion || ""} ${a.tipo || ""}`);
            return contenido.includes(texto);
        });
    }

    if (estado === "pendiente") {
        filtradas = filtradas.filter(a => !a.atendida);
    }

    if (estado === "atendida") {
        filtradas = filtradas.filter(a => a.atendida);
    }

    if (tipo !== "todos") {
        filtradas = filtradas.filter(a => normalizar(a.tipo) === tipo);
    }

    if (nivel !== "todos") {
        filtradas = filtradas.filter(a => normalizar(a.nivel) === nivel);
    }

    renderAlertas(filtradas);
}

function renderAlertas(alertas) {
    const contenedor = document.getElementById("alertasListado");
    if (!contenedor) return;

    if (!alertas.length) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <strong>No hay alertas para mostrar</strong>
                <p>No se encontraron alertas con los filtros seleccionados.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = alertas.map(alerta => {
        const atendida = Boolean(alerta.atendida);
        const nivel = normalizar(alerta.nivel || "medio");
        const tipo = normalizar(alerta.tipo || "alerta_general");

        return `
            <article class="alerta-card ${atendida ? "alerta-atendida" : ""} nivel-${nivel}">
                <div class="alerta-icon">
                    ${iconoAlerta(tipo)}
                </div>

                <div class="alerta-main">
                    <div class="alerta-title-row">
                        <div>
                            <h3>${formatearTipo(tipo)}</h3>
                            <p>${escapeHtml(alerta.descripcion || "Sin descripción")}</p>
                        </div>

                        <span class="badge badge-${nivel}">
                            ${formatearNivel(nivel)}
                        </span>
                    </div>

                    <div class="alerta-meta">
                        <span>Vehículo: ${escapeHtml(alerta.vehiculo || "Sin vehículo")}</span>
                        <span>Último reporte: ${tiempoRelativo(alerta.timestamp)}</span>
                        <span>Fecha reporte: ${formatearFecha(alerta.timestamp)}</span>
                        <span>${atendida ? "Atendida" : "Pendiente"}</span>
                    </div>

                    ${
                        atendida
                            ? `
                                <div class="alerta-atencion-info">
                                    <span>Atendida por: ${escapeHtml(alerta.atendida_por_nombre || "Usuario no disponible")}</span>
                                    <span>Fecha de atención: ${formatearFecha(alerta.fecha_atencion)}</span>
                                </div>
                            `
                            : ""
                    }
                </div>

                <div class="alerta-actions">
                    <a class="btn btn-outline btn-sm" href="/dueno/vehiculos/${alerta.vehiculo_id}">
                        Ver vehículo
                    </a>

                    ${
                        atendida
                            ? `<span class="estado-atendida">Atendida</span>`
                            : `<button 
                                    class="btn btn-primary btn-sm btn-atender-alerta" 
                                    data-id="${alerta.id}">
                                    Atender
                            </button>`
                    }
                </div>
            </article>
        `;
    }).join("");

    bindBotonesAtender();
}

function bindBotonesAtender() {
    document.querySelectorAll(".btn-atender-alerta").forEach(btn => {
        btn.addEventListener("click", () => {
            const alertaId = Number(btn.dataset.id);
            const alerta = alertasOriginales.find(a => Number(a.id) === alertaId);

            if (!alerta) {
                alert("No se encontró la alerta seleccionada.");
                return;
            }

            abrirModalAtencion(alerta);
        });
    });
}

function configurarModalAtencion() {
    document.getElementById("btnCerrarModalAlerta")?.addEventListener("click", cerrarModalAtencion);
    document.getElementById("btnCancelarAtencion")?.addEventListener("click", cerrarModalAtencion);

    // document.getElementById("modalAtenderAlerta")?.addEventListener("click", (event) => {
    //     if (event.target.id === "modalAtenderAlerta") {
    //         cerrarModalAtencion();
    //     }
    // });

    document.getElementById("btnConfirmarAtencion")?.addEventListener("click", confirmarAtencionAlerta);
}

function abrirModalAtencion(alerta) {
    alertaSeleccionada = alerta;

    document.getElementById("modalAlertaTipo").textContent = formatearTipo(normalizar(alerta.tipo));
    document.getElementById("modalAlertaVehiculo").textContent = `Vehículo: ${alerta.vehiculo || "Sin vehículo"}`;
    document.getElementById("modalAlertaDescripcion").textContent = alerta.descripcion || "Sin descripción";

    document.getElementById("modalAtenderAlerta").classList.add("visible");
}

function cerrarModalAtencion() {
    alertaSeleccionada = null;
    document.getElementById("modalAtenderAlerta")?.classList.remove("visible");

    const btn = document.getElementById("btnConfirmarAtencion");
    if (btn) {
        btn.disabled = false;
        btn.textContent = "Sí, atender alerta";
    }
}

async function confirmarAtencionAlerta() {
    if (!alertaSeleccionada) return;

    const btn = document.getElementById("btnConfirmarAtencion");
    btn.disabled = true;
    btn.textContent = "Atendiendo...";

    try {
        await TrackAPI.atenderAlerta(alertaSeleccionada.id);
        cerrarModalAtencion();
        await cargarAlertas({ silencioso: true });
        mostrarToastAlerta("Alerta atendida correctamente.", "success");

    } catch (error) {
        console.error("Error atendiendo alerta:", error);
        mostrarToastAlerta(error.message || "No se pudo atender la alerta.", "error");

        btn.disabled = false;
        btn.textContent = "Sí, atender alerta";
    }
}

function mostrarEstadoCarga(mostrar) {
    const el = document.getElementById("estadoCargaAlertas");
    if (!el) return;
    el.style.opacity = mostrar ? "1" : "0";
}

function actualizarUltimaActualizacion() {
    const el = document.getElementById("ultimaActualizacionAlertas");
    if (!el) return;

    const ahora = new Date();
    el.textContent = `Actualizado ${ahora.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })}`;
}

function mostrarToastAlerta(mensaje, tipo = "info") {
    let toast = document.getElementById("alertasToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "alertasToast";
        toast.className = "alertas-toast";
        document.body.appendChild(toast);
    }

    toast.textContent = mensaje;
    toast.className = `alertas-toast ${tipo} visible`;

    setTimeout(() => {
        toast.classList.remove("visible");
    }, 3000);
}

function iconoAlerta(tipo) {
    if (tipo === "panico") return "!";
    if (tipo === "puerta_abierta") return "P";
    if (tipo === "vibracion") return "V";
    return "A";
}

function formatearTipo(tipo) {
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

function tiempoRelativo(ts) {
    if (!ts) return "Sin fecha";

    const ahora = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, ahora - Number(ts));

    if (diff < 10) return "Ahora";
    if (diff < 60) return `Hace ${diff} seg`;

    const minutos = Math.floor(diff / 60);
    if (minutos < 60) return `Hace ${minutos} min`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} h`;

    return `Hace ${Math.floor(horas / 24)} días`;
}

function formatearFecha(ts) {
    if (!ts) return "Sin registro";

    const fecha = new Date(Number(ts) * 1000);

    return fecha.toLocaleString("es-MX", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function normalizar(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
    return String(value ?? "")
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
    if (alertasTimer) clearInterval(alertasTimer);
});