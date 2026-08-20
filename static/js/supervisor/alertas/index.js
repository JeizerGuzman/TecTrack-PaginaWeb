let alertasCargando = false;
let alertasTimer = null;

let alertasOriginales = [];
let alertaSeleccionada = null;

document.addEventListener("DOMContentLoaded", async () => {

    if (window.TrackGuards?.requireAuth) {

        const ok =
            TrackGuards.requireAuth(
                "supervisor"
            )

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
                    <a class="btn btn-outline btn-sm" href="/supervisor/vehiculos/${alerta.vehiculo_id}">
                        Ver vehículo
                    </a>

                    ${
                        alerta.evidencia_url
                            ? `<button 
                                  class="btn btn-outline btn-sm" 
                                  style="border-color: #3b82f6; color: #3b82f6;"
                                  onclick="abrirModalEvidenciaAlerta('${alerta.evidencia_url}', '${alerta.vehiculo_id}', '${alerta.chofer_telefono || ''}')">
                                  Ver evidencia
                               </button>`
                            : ``
                    }

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

// ============================================================
// LÓGICA DEL MODAL DE EVIDENCIAS EN ALERTAS (ZOOM Y WHATSAPP)
// ============================================================
let alertaModalEscala = 1;
let alertaModalTranslateX = 0;
let alertaModalTranslateY = 0;
let alertaModalIsDragging = false;
let alertaModalStartX = 0;
let alertaModalStartY = 0;

window.abrirModalEvidenciaAlerta = function(url, vehiculoId, telefono) {
    const modal = document.getElementById('modalEvidenciaAlertaFotografica');
    const img = document.getElementById('imagenEvidenciaAlerta');
    const btnVehiculo = document.getElementById('btnIrVehiculoAlerta');
    const btnWhatsapp = document.getElementById('btnWhatsappAlerta');

    // Resetear zoom
    alertaModalEscala = 1;
    alertaModalTranslateX = 0;
    alertaModalTranslateY = 0;
    if(img) img.style.transform = `translate(0px, 0px) scale(1)`;

    if(img) img.src = url;
    if(btnVehiculo) btnVehiculo.href = `/supervisor/vehiculos/${vehiculoId}`;

    if (btnWhatsapp) {
        if (telefono && telefono !== "null") {
            const telLimpio = String(telefono).replace(/\D/g, '');
            const numeroWa = telLimpio.length === 10 ? `52${telLimpio}` : telLimpio;
            btnWhatsapp.href = `https://wa.me/${numeroWa}?text=Hola,%20te%20contacto%20por%20una%20alerta%20generada%20en%20tu%20unidad.`;
            btnWhatsapp.style.display = 'inline-flex';
        } else {
            btnWhatsapp.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
};

window.cerrarModalEvidenciaAlerta = function() {
    const modal = document.getElementById('modalEvidenciaAlertaFotografica');
    if(modal) modal.style.display = 'none';
    document.body.style.overflow = ''; 
};

// Eventos de Zoom y Paneo
document.addEventListener("DOMContentLoaded", () => {
    const img = document.getElementById('imagenEvidenciaAlerta');
    const visor = document.getElementById('visorImagenAlerta');

    if (img && visor) {
        visor.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factorZoom = 0.15;
            alertaModalEscala += (e.deltaY < 0) ? factorZoom : -factorZoom;
            alertaModalEscala = Math.max(0.5, Math.min(alertaModalEscala, 8));
            img.style.transform = `translate(${alertaModalTranslateX}px, ${alertaModalTranslateY}px) scale(${alertaModalEscala})`;
        });

        img.addEventListener('mousedown', (e) => {
            e.preventDefault();
            alertaModalIsDragging = true;
            alertaModalStartX = e.clientX - alertaModalTranslateX;
            alertaModalStartY = e.clientY - alertaModalTranslateY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!alertaModalIsDragging) return;
            alertaModalTranslateX = e.clientX - alertaModalStartX;
            alertaModalTranslateY = e.clientY - alertaModalStartY;
            img.style.transform = `translate(${alertaModalTranslateX}px, ${alertaModalTranslateY}px) scale(${alertaModalEscala})`;
        });

        window.addEventListener('mouseup', () => { alertaModalIsDragging = false; });
        visor.addEventListener('mouseleave', () => { alertaModalIsDragging = false; });
    }
});