// ============================================================
// DETALLE VEHÍCULO - TrackSecurity
// Autoactualización discreta sin recargar la página.
// ============================================================

let detalleCargando = false;
let detalleTimer = null;
const DETALLE_REFRESH_MS = 1000;
let mapaVehiculo = null;
let marcadorVehiculo = null;
let ultimaDireccionKey = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const ok = await window.TrackGuards.requireAuth();
        if (!ok) return;
    }

    await cargarDetalleVehiculo();

    if (detalleTimer) {
        clearInterval(detalleTimer);
    }

    detalleTimer = setInterval(() => {
        cargarDetalleVehiculo({ silencioso: true });
    }, DETALLE_REFRESH_MS);
});

async function cargarDetalleVehiculo({ silencioso = false } = {}) {
    if (detalleCargando) return;

    detalleCargando = true;

    const vehiculoId = Number(
        document.querySelector(".vehiculo-detalle-page")?.dataset.vehiculoId || 0
    );

    if (!vehiculoId) {
        console.error("No se encontró vehiculoId en .vehiculo-detalle-page");
        detalleCargando = false;
        return;
    }

    const titulo = document.getElementById("detalleVehiculoTitulo");
    const subtitulo = document.getElementById("detalleVehiculoSubtitulo");
    const estado = document.getElementById("detalleEstadoVehiculo");
    const velocidad = document.getElementById("detalleVelocidadVehiculo");
    const ultimaActualizacion = document.getElementById("detalleUltimaActualizacion");
    const dispositivo = document.getElementById("detalleDispositivo");
    const infoGeneral = document.getElementById("detalleInfoGeneral");
    const ubicacionTexto = document.getElementById("detalleUbicacionTexto");
    const alertasListado = document.getElementById("detalleAlertasVehiculo");
    const sensoresBox = document.getElementById("detalleSensores");
    const evidenciasBox = document.getElementById("detalleEvidencias");

    try {
        if (!silencioso) {
            aplicarEstadoCarga(true);
        }

        const response = await TrackAPI.obtenerVehiculoDetalle(vehiculoId);
        const eventosResponse = await TrackAPI.obtenerEventosVehiculo(vehiculoId);

        renderVehiculo(response.vehiculo, {
            titulo,
            subtitulo,
            estado,
            velocidad,
            ultimaActualizacion,
            dispositivo,
            infoGeneral,
            ubicacionTexto
        });

        renderSensores(response.vehiculo, sensoresBox);
        renderAlertas(response.alertas || [], alertasListado);
        renderEvidencias(response.evidencias || [], response.plan || {}, evidenciasBox);
        renderEventos(eventosResponse.eventos || []);
        actualizarIndicadorDetalle();
        actualizarMapaVehiculo(response.vehiculo);

    } catch (error) {
        console.error("Error cargando detalle:", error);

        if (!silencioso && infoGeneral) {
            infoGeneral.innerHTML = `
                <div class="empty-state">
                    <strong>No se pudo cargar el vehículo</strong>
                    <p>${escapeHtml(error.message || "Ocurrió un error al consultar la unidad.")}</p>
                </div>
            `;
        }

        if (error.status === 401 || String(error.message).includes("401")) {
            if (window.TrackAuth) TrackAuth.clearSession();
            window.location.href = "/login";
        }

    } finally {
        detalleCargando = false;

        if (!silencioso) {
            aplicarEstadoCarga(false);
        }
    }
}

function renderVehiculo(v, els) {
    if (!v) return;

    if (els.titulo) els.titulo.textContent = v.nombre || "Vehículo";
    if (els.subtitulo) {
        els.subtitulo.textContent = `${v.identificador || "Sin identificador"} · ${v.placa || "Sin placa"}`;
    }

    if (els.estado) els.estado.textContent = formatearEstado(v.estado || "activo");
    if (els.velocidad) els.velocidad.textContent = `${v.velocidad ?? 0} km/h`;
    if (els.ultimaActualizacion) els.ultimaActualizacion.textContent = tiempoRelativo(v.ultima_actualizacion);
    if (els.dispositivo) els.dispositivo.textContent = v.dispositivo_serie || "Sin vincular";

    if (els.infoGeneral) {
        els.infoGeneral.innerHTML = `
            <div class="detalle-item">
                <span>Nombre</span>
                <strong>${escapeHtml(v.nombre || "Sin registrar")}</strong>
            </div>

            <div class="detalle-item">
                <span>Identificador</span>
                <strong>${escapeHtml(v.identificador || "Sin registrar")}</strong>
            </div>

            <div class="detalle-item">
                <span>Placa</span>
                <strong>${escapeHtml(v.placa || "Sin registrar")}</strong>
            </div>

            <div class="detalle-item">
                <span>Marca</span>
                <strong>${escapeHtml(v.marca || "Sin registrar")}</strong>
            </div>

            <div class="detalle-item">
                <span>Modelo</span>
                <strong>${escapeHtml(v.modelo || "Sin registrar")}</strong>
            </div>

            <div class="detalle-item">
                <span>Año</span>
                <strong>${v.anio || "—"}</strong>
            </div>

            <div class="detalle-item">
                <span>Latitud</span>
                <strong>${v.lat ?? "—"}</strong>
            </div>

            <div class="detalle-item">
                <span>Longitud</span>
                <strong>${v.lng ?? "—"}</strong>
            </div>
            <div class="detalle-item">
                <span>Chofer</span>
                <strong>${escapeHtml(v.chofer_nombre || "Sin asignar")}</strong>
            </div>
        `;
    }

    if (els.ubicacionTexto) {
        els.ubicacionTexto.textContent =
            v.lat != null && v.lng != null
                ? `Última ubicación recibida: ${v.lat}, ${v.lng}`
                : "Este vehículo aún no tiene una ubicación reportada.";
    }
}

function renderSensores(v, sensoresBox) {
    if (!sensoresBox || !v) return;

    const puerta = String(v.puerta || "desconocida").toLowerCase();
    const vibracion = Number(v.vibracion || 0);
    const alerta = Number(v.alerta || 0);
    const estadoActual = String(v.estado || "").toLowerCase();

    sensoresBox.innerHTML = `
        <div class="sensor-card ${puerta === "abierta" ? "sensor-alerta" : "sensor-ok"}">
            <span>Sensor de puerta</span>
            <strong>${puerta === "abierta" ? "Puerta abierta" : puerta === "cerrada" ? "Puerta cerrada" : "Desconocido"}</strong>
            <small>${tiempoRelativo(v.ultima_actualizacion)}</small>
        </div>

        <div class="sensor-card ${
            v.sin_senal || v.online === false || vibracion === null || vibracion === undefined
                ? "sensor-desconectado"
                : vibracion === 1
                    ? "sensor-alerta"
                    : "sensor-ok"
        }">
            <span>Sensor de vibración</span>
            <strong>${
                v.sin_senal || v.online === false || vibracion === null || vibracion === undefined
                    ? "Desconocido"
                    : vibracion === 1
                        ? "Vibración detectada"
                        : "Normal"
            }</strong>
            <small>${
                tiempoRelativo(v.ultima_actualizacion)
            }</small>
        </div>

        <div class="sensor-card ${alerta === 1 ? "sensor-alerta" : "sensor-ok"}">
            <span>Alerta general</span>
            <strong>${alerta === 1 ? "Alerta activa" : "Sin alerta"}</strong>
            <small>${tiempoRelativo(v.ultima_actualizacion)}</small>
        </div>

        <div class="sensor-card ${estadoActual === "panico" ? "sensor-alerta" : "sensor-ok"}">
            <span>Botón de pánico</span>
            <strong>${estadoActual === "panico" ? "Pánico activo" : "Inactivo"}</strong>
            <small>${tiempoRelativo(v.ultima_actualizacion)}</small>
        </div>
    `;
}

function renderAlertas(alertas, alertasListado) {
    if (!alertasListado) return;

    if (!alertas.length) {
        alertasListado.innerHTML = `
            <div class="empty-state">
                <strong>Sin alertas recientes</strong>
                <p>Este vehículo no tiene alertas registradas por ahora.</p>
            </div>
        `;
        return;
    }

    alertasListado.innerHTML = alertas.map(alerta => `
        <article class="alerta-item">
            <div>
                <strong>${formatearTipoAlerta(alerta.tipo)}</strong>
                <p>${escapeHtml(alerta.descripcion || "Sin descripción")}</p>
                <small>${alerta.atendida ? "Atendida" : "Pendiente"}</small>
            </div>
            <span>${tiempoRelativo(alerta.timestamp)}</span>
        </article>
    `).join("");
}

function renderEvidencias(evidencias, plan, evidenciasBox) {
    if (!evidenciasBox) return;

    const esPremium = Boolean(plan.es_premium);

    if (!esPremium) {
        evidenciasBox.innerHTML = `
            <div class="premium-lock">
                <strong>Evidencia fotográfica disponible en Plan Premium</strong>
                <p>
                    Este módulo permite consultar capturas automáticas asociadas
                    a alertas críticas como apertura de puerta, vibración o pánico.
                </p>
                <span>Plan actual: ${escapeHtml(plan.nombre || "Sin plan")}</span>
            </div>
        `;
        return;
    }

    if (!evidencias.length) {
        evidenciasBox.innerHTML = `
            <div class="empty-state">
                <strong>Sin evidencias registradas</strong>
                <p>Cuando el dispositivo Premium capture imágenes, aparecerán aquí.</p>
            </div>
        `;
        return;
    }

    evidenciasBox.innerHTML = evidencias.map(ev => `
        <article class="evidencia-card">
            <div class="evidencia-img">
                <img src="${escapeHtml(ev.url_imagen)}" alt="Evidencia del vehículo">
            </div>
            <div>
                <strong>${escapeHtml(ev.descripcion || "Evidencia fotográfica")}</strong>
                <small>${tiempoRelativo(ev.timestamp)}</small>
            </div>
        </article>
    `).join("");
}

function aplicarEstadoCarga(mostrar) {
    const page = document.querySelector(".vehiculo-detalle-page");
    if (!page) return;
    page.classList.toggle("is-loading-soft", mostrar);
}

function actualizarIndicadorDetalle() {
    let indicador = document.getElementById("detalleUltimaCarga");

    if (!indicador) {
        const headerActions = document.querySelector(".vehiculos-header-actions");
        if (!headerActions) return;

        indicador = document.createElement("span");
        indicador.id = "detalleUltimaCarga";
        indicador.className = "detalle-ultima-carga";
        headerActions.prepend(indicador);
    }

    const ahora = new Date();
    indicador.textContent = `Actualizado ${ahora.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })}`;
}

function formatearEstado(estado) {
    const mapa = {
        activo: "Activo",
        alerta: "Con alerta",
        panico: "Pánico",
        sin_senal: "Sin señal",
        apagado: "Apagado"
    };
    return mapa[String(estado).toLowerCase()] || estado;
}

function formatearTipoAlerta(tipo) {
    const mapa = {
        panico: "Botón de pánico",
        puerta_abierta: "Puerta abierta",
        vibracion: "Vibración detectada",
        alerta_general: "Alerta general"
    };

    return mapa[String(tipo || "").toLowerCase()] || tipo || "Alerta";
}

function tiempoRelativo(ts) {
    if (!ts) return "Sin registro";

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

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

window.addEventListener("beforeunload", () => {
    if (detalleTimer) {
        clearInterval(detalleTimer);
    }
});

function renderEventos(eventos) {
    const contenedor = document.getElementById("detalleEventosVehiculo");
    if (!contenedor) return;

    if (!eventos.length) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <strong>Sin eventos registrados</strong>
                <p>La bitácora aparecerá cuando ocurra una acción importante.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = eventos.map(evento => `
        <article class="evento-item">
            <div>
                <strong>${formatearTipoEvento(evento.tipo)}</strong>
                <p>${escapeHtml(evento.descripcion || "Sin descripción")}</p>
                ${
                    evento.lat != null && evento.lng != null
                        ? `<small>Ubicación: ${evento.lat}, ${evento.lng}</small>`
                        : ""
                }
            </div>
            <span>${tiempoRelativo(evento.timestamp)}</span>
        </article>
    `).join("");
}

function formatearTipoEvento(tipo) {
    const mapa = {
        vehiculo_creado: "Vehículo creado",
        vehiculo_editado: "Vehículo editado",
        vehiculo_desactivado: "Vehículo desactivado",
        alerta_atendida: "Alerta atendida",
        dispositivo_vinculado: "Dispositivo vinculado"
    };

    return mapa[String(tipo || "").toLowerCase()] || String(tipo || "Evento").replaceAll("_", " ");
}

function actualizarMapaVehiculo(vehiculo) {
    if (!vehiculo) return;

    const lat = Number(vehiculo.lat);
    const lng = Number(vehiculo.lng);

    const ubicacionTexto = document.getElementById("detalleUbicacionTexto");
    const btnGoogle = document.getElementById("btnAbrirGoogleMaps");

    if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) {
        if (ubicacionTexto) {
            ubicacionTexto.textContent = "Este vehículo aún no tiene una ubicación válida.";
        }
        return;
    }

    if (ubicacionTexto) {
        ubicacionTexto.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)} · ${vehiculo.velocidad ?? 0} km/h`;
    }

    if (btnGoogle) {
        btnGoogle.href = `https://www.google.com/maps?q=${lat},${lng}`;
    }

    if (!mapaVehiculo) {
        mapaVehiculo = L.map("mapaVehiculo", {
            zoomControl: true
        }).setView([lat, lng], 16);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap"
        }).addTo(mapaVehiculo);

        marcadorVehiculo = L.marker([lat, lng]).addTo(mapaVehiculo);
    } else {
        marcadorVehiculo.setLatLng([lat, lng]);
        mapaVehiculo.panTo([lat, lng], {
            animate: true,
            duration: 0.8
        });
    }

    marcadorVehiculo.bindPopup(`
        <strong>${escapeHtml(vehiculo.nombre || "Vehículo")}</strong><br>
        ${escapeHtml(vehiculo.placa || "Sin placa")}<br>
        Velocidad: ${vehiculo.velocidad ?? 0} km/h<br>
        Último reporte: ${tiempoRelativo(vehiculo.ultima_actualizacion)}
    `);

    cargarDireccionCercana(lat, lng);
}

async function cargarDireccionCercana(lat, lng) {
    const direccionEl = document.getElementById("detalleDireccionVehiculo");
    if (!direccionEl) return;

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

    if (ultimaDireccionKey === key) return;
    ultimaDireccionKey = key;

    try {
        direccionEl.textContent = "Buscando dirección cercana...";

        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

        const response = await fetch(url);
        const data = await response.json();

        direccionEl.textContent =
            data.display_name || "No se encontró una dirección cercana.";

    } catch (error) {
        console.warn("No se pudo obtener dirección:", error);
        direccionEl.textContent = "Dirección no disponible por ahora.";
    }
}

function volverPaginaAnterior() {
    if (document.referrer && document.referrer !== window.location.href) {
        window.history.back();
    } else {
        window.location.href = "/dueno/vehiculos";
    }
}