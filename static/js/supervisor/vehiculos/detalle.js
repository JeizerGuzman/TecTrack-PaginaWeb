// ============================================================
// DETALLE VEHÍCULO - TrackSecurity
// Autoactualización discreta sin recargar la página.
// ============================================================

let detalleCargando = false;
let detalleTimer = null;
let mapaVehiculo = null;
let marcadorVehiculo = null;


document.addEventListener("DOMContentLoaded", async () => {

    if (window.TrackGuards?.requireAuth) {

        const ok =
            await window.TrackGuards.requireAuth();

        if (!ok) {
            return;
        }

    }


    await cargarDetalleVehiculo();


    const intervaloMs =
        await TrackConfig.obtenerOperacionMs(
            "detalle_vehiculo",
            3
        );


    if (detalleTimer) {
        clearInterval(detalleTimer);
    }


    detalleTimer = setInterval(
        () => {

            cargarDetalleVehiculo({
                silencioso: true
            });

        },
        intervaloMs
    );

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

        const direccion =
            window.TrackDireccion
                ? TrackDireccion.obtenerTexto(
                    v
                )
                : (
                    v.direccion ||
                    "Dirección no disponible"
                );


        els.ubicacionTexto.textContent =
            v.lat != null && v.lng != null
                ? `Última ubicación recibida: ${v.lat}, ${v.lng} · ${direccion}`
                : "Este vehículo aún no tiene una ubicación reportada.";

    }
}

function renderSensores(v, sensoresBox) {
    if (!sensoresBox || !v) return;

    const puerta = String(
        v.puerta || "desconocida"
    ).toLowerCase();

    const vibracion = (
        v.vibracion === null ||
        v.vibracion === undefined
    )
        ? null
        : Number(v.vibracion);

    const alerta = Number(v.alerta || 0);

    const estadoActual = String(
        v.estado || ""
    ).toLowerCase();

    const modoManual = [
        "manual",
        "modo_manual",
    ].includes(
        estadoActual
    );

    const puertaAbierta =
        puerta === "abierta";

    const vibracionDetectada =
        vibracion === 1;

    /*
     * Se considera sin conexión cuando:
     * - sin_senal es true
     * - online es false
     * - el estado visible es sin_senal
     */
    const sinConexion = (
        v.sin_senal === true ||
        v.online === false ||
        estadoActual === "sin_senal"
    );


    /* ========================================================
       SIN CONEXIÓN
       Todos los sensores se muestran en gris.
       ======================================================== */

    if (sinConexion) {
        sensoresBox.innerHTML = `
            <div class="sensor-card sensor-desconectado">
                <span>Sensor de puerta</span>
                <strong>Sin conexión</strong>
                <small>
                    ${tiempoRelativo(v.ultima_actualizacion)}
                </small>
            </div>

            <div class="sensor-card sensor-desconectado">
                <span>Sensor de vibración</span>
                <strong>Sin conexión</strong>
                <small>
                    ${tiempoRelativo(v.ultima_actualizacion)}
                </small>
            </div>

            <div class="sensor-card sensor-desconectado">
                <span>Alerta general</span>
                <strong>Sin conexión</strong>
                <small>
                    ${tiempoRelativo(v.ultima_actualizacion)}
                </small>
            </div>

            <div class="sensor-card sensor-desconectado">
                <span>Botón de pánico</span>
                <strong>Sin conexión</strong>
                <small>
                    ${tiempoRelativo(v.ultima_actualizacion)}
                </small>
            </div>
        `;

        return;
    }


    const clasePuerta =
        puertaAbierta
            ? (
                modoManual
                    ? "sensor-info"
                    : "sensor-alerta"
            )
            : "sensor-ok";


    const claseVibracion =
        vibracionDetectada
            ? (
                modoManual
                    ? "sensor-info"
                    : "sensor-alerta"
            )
            : "sensor-ok";


    const textoPuerta =
        puertaAbierta
            ? (
                modoManual
                    ? "Puerta abierta en modo manual"
                    : "Puerta abierta"
            )
            : puerta === "cerrada"
                ? "Puerta cerrada"
                : "Desconocido";


    const textoVibracion =
        vibracionDetectada
            ? (
                modoManual
                    ? "Vibración detectada en modo manual"
                    : "Vibración detectada"
            )
            : "Normal";


    sensoresBox.innerHTML = `
        <div class="sensor-card ${clasePuerta}">
            <span>Sensor de puerta</span>

            <strong>
                ${textoPuerta}
            </strong>

            <small>
                ${tiempoRelativo(v.ultima_actualizacion)}
            </small>
        </div>


        <div class="sensor-card ${claseVibracion}">
            <span>Sensor de vibración</span>

            <strong>
                ${textoVibracion}
            </strong>

            <small>
                ${tiempoRelativo(v.ultima_actualizacion)}
            </small>
        </div>


        <div class="sensor-card ${
            alerta === 1
                ? "sensor-alerta"
                : "sensor-ok"
        }">
            <span>Alerta general</span>

            <strong>
                ${
                    alerta === 1
                        ? "Alerta activa"
                        : "Sin alerta"
                }
            </strong>

            <small>
                ${tiempoRelativo(v.ultima_actualizacion)}
            </small>
        </div>


        <div class="sensor-card ${
            estadoActual === "panico"
                ? "sensor-alerta"
                : "sensor-ok"
        }">
            <span>Botón de pánico</span>

            <strong>
                ${
                    estadoActual === "panico"
                        ? "Pánico activo"
                        : "Inactivo"
                }
            </strong>

            <small>
                ${tiempoRelativo(v.ultima_actualizacion)}
            </small>
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

// 🌟 CORRECCIÓN: Auto-refresco y conexión con el Modal
function renderEvidencias(evidencias, plan, evidenciasBox) {
    if (!evidenciasBox) return;

    const esPremium = Boolean(plan.es_premium);

    if (!esPremium) {
        evidenciasBox.innerHTML = `
            <div class="premium-lock">
                <strong>Evidencia fotográfica disponible en Plan Premium</strong>
                <p>Este módulo permite consultar capturas automáticas asociadas a alertas críticas como apertura de puerta, vibración o pánico.</p>
                <span>Plan actual: ${escapeHtml(plan.nombre || "Sin plan")}</span>
            </div>
        `;
        return;
    }

    if (!evidencias || !evidencias.length) {
        evidenciasBox.innerHTML = `
            <div class="empty-state" style="height: 100%; display: flex; flex-direction: column; justify-content: center;">
                <strong>Sin evidencias registradas</strong>
                <p>Cuando el dispositivo Premium capture imágenes, aparecerán aquí.</p>
            </div>
        `;
        return;
    }

    // 🌟 CORRECCIÓN DEL AUTO-REFRESCO: 
    // Ahora verificamos si la URL de la primera imagen cambió, no solo la cantidad total.
    const trackExiste = document.getElementById('carruselTrack');
    if (trackExiste && trackExiste.children.length === evidencias.length) {
        const primeraImagenActual = trackExiste.querySelector('.carrusel-imagen-container img');
        if (primeraImagenActual && primeraImagenActual.src === evidencias[0].url_imagen) {
            return; // Solo detenemos el render si la foto más reciente es exactamente la misma
        }
    }

    const multiClase = evidencias.length > 1 ? 'multi-slide' : 'single-slide';

    const slidesHTML = evidencias.map((ev, index) => {
        const fechaObj = new Date(Number(ev.timestamp) * 1000);
        const fechaExacta = fechaObj.toLocaleString("es-MX", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
        });
        
        const descripcionLimpia = escapeHtml(ev.descripcion || "Evidencia fotográfica");

        return `
            <div class="carrusel-slide">
                <div class="carrusel-imagen-container">
                    <!-- 🌟 NUEVO: Evento onclick para el Modal -->
                    <img 
                        src="${escapeHtml(ev.url_imagen)}" 
                        alt="Evidencia" 
                        style="cursor: zoom-in;"
                        onclick="abrirModalEvidencia('${escapeHtml(ev.url_imagen)}', '${descripcionLimpia}', '${fechaExacta}')"
                    >
                    <span class="carrusel-contador-slide">${index + 1} / ${evidencias.length}</span>
                </div>
                <div class="carrusel-info">
                    <strong>${descripcionLimpia}</strong>
                    <div class="carrusel-meta">
                        <span class="carrusel-fecha">${fechaExacta}</span>
                        <span class="badge-relativo">${tiempoRelativo(ev.timestamp)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    evidenciasBox.innerHTML = `
        <div class="carrusel-evidencias-wrapper">
            <button class="btn-carrusel prev" onclick="window.scrollCarrusel(-1)" ${evidencias.length <= 1 ? 'style="display:none"' : ''}>&#10094;</button>
            <div class="carrusel-track ${multiClase}" id="carruselTrack">
                ${slidesHTML}
            </div>
            <button class="btn-carrusel next" onclick="window.scrollCarrusel(1)" ${evidencias.length <= 1 ? 'style="display:none"' : ''}>&#10095;</button>
        </div>
    `;
}

// 🌟 NUEVA FUNCIÓN DE NAVEGACIÓN: Desplaza el scroll en lugar de cambiar la variable
window.scrollCarrusel = function(direccion) {
    const track = document.getElementById('carruselTrack');
    if (!track) return;
    
    // Calculamos el ancho de un elemento para saber exactamente cuánto mover el carrusel
    const slide = track.querySelector('.carrusel-slide');
    if (!slide) return;
    
    const scrollAmount = slide.offsetWidth + 10; // ancho del contenedor + gap
    track.scrollBy({ left: direccion * scrollAmount, behavior: 'smooth' });
};

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

    const ubicacionTexto =
        document.getElementById(
            "detalleUbicacionTexto"
        );

    const direccionTexto =
        document.getElementById(
            "detalleDireccionVehiculo"
        );

    const btnGoogle =
        document.getElementById(
            "btnAbrirGoogleMaps"
        );

    const direccion =
        window.TrackDireccion
            ? TrackDireccion.obtenerTexto(
                vehiculo
            )
            : (
                vehiculo.direccion ||
                "Dirección no disponible"
            );

    const tieneUbicacionValida =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !(lat === 0 && lng === 0);


    if (!tieneUbicacionValida) {

        if (ubicacionTexto) {

            ubicacionTexto.textContent =
                "Este vehículo aún no tiene una ubicación válida.";

        }


        if (direccionTexto) {

            direccionTexto.textContent =
                direccion;

        }


        if (btnGoogle) {

            btnGoogle.removeAttribute(
                "href"
            );

        }


        return;

    }


    if (ubicacionTexto) {

        ubicacionTexto.textContent =
            `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)} · ${vehiculo.velocidad ?? 0} km/h`;

    }


    if (direccionTexto) {

        direccionTexto.textContent =
            direccion;

    }


    if (btnGoogle) {

        btnGoogle.href =
            `https://www.google.com/maps?q=${lat},${lng}`;

    }


    if (!mapaVehiculo) {

        mapaVehiculo = L.map(
            "mapaVehiculo",
            {
                zoomControl: true
            }
        ).setView(
            [lat, lng],
            16
        );


        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap"
            }
        ).addTo(
            mapaVehiculo
        );


        marcadorVehiculo =
            L.marker(
                [lat, lng]
            ).addTo(
                mapaVehiculo
            );

    } else {

        marcadorVehiculo.setLatLng(
            [lat, lng]
        );


        mapaVehiculo.panTo(
            [lat, lng],
            {
                animate: true,
                duration: 0.8
            }
        );

    }


    marcadorVehiculo.bindPopup(`
        <strong>${escapeHtml(vehiculo.nombre || "Vehículo")}</strong><br>
        ${escapeHtml(vehiculo.placa || "Sin placa")}<br>
        ${escapeHtml(direccion)}<br>
        Velocidad: ${vehiculo.velocidad ?? 0} km/h<br>
        Último reporte: ${tiempoRelativo(vehiculo.ultima_actualizacion)}
    `);

}


function volverPaginaAnterior() {
    if (document.referrer && document.referrer !== window.location.href) {
        window.history.back();
    } else {
        window.location.href = "/supervisor/vehiculos";
    }
}


// ============================================================
// LÓGICA DEL MODAL DE EVIDENCIAS (ZOOM CON RUEDA Y PANEO)
// ============================================================

// Variables matemáticas para controlar la foto
let modalEscala = 1;
let modalTranslateX = 0;
let modalTranslateY = 0;
let modalIsDragging = false;
let modalStartX = 0;
let modalStartY = 0;

function abrirModalEvidencia(url, descripcion, fecha) {
    const modal = document.getElementById('modalEvidenciaFotografica');
    const img = document.getElementById('imagenZoomModal');
    const texto = document.getElementById('textoDescripcionModal');
    const btnDescargar = document.getElementById('btnDescargarEvidencia');

    // 🌟 1. BLOQUEAR SCROLL EXTERNO DE LA PÁGINA
    document.body.classList.add('modal-sin-scroll');

    // 🌟 2. RESETEAR EL ZOOM Y LA POSICIÓN DE LA FOTO CADA QUE SE ABRE
    modalEscala = 1;
    modalTranslateX = 0;
    modalTranslateY = 0;
    aplicarTransformacionModal(img);

    img.src = url;
    texto.innerHTML = `<strong>${descripcion}</strong><br><small>${fecha}</small>`;

    // Truco Cloudinary para forzar descarga
    let urlDescarga = url;
    if (url.includes('/upload/')) {
        urlDescarga = url.replace('/upload/', '/upload/fl_attachment/');
    }
    btnDescargar.href = urlDescarga;

    modal.classList.add('modal-activo');
}

function cerrarModalEvidencia() {
    document.getElementById('modalEvidenciaFotografica').classList.remove('modal-activo');
    // 🌟 DEVOLVERLE EL SCROLL A LA PÁGINA
    document.body.classList.remove('modal-sin-scroll');
}

function aplicarTransformacionModal(imgElement) {
    imgElement.style.transform = `translate(${modalTranslateX}px, ${modalTranslateY}px) scale(${modalEscala})`;
}

// 🌟 INYECTAMOS LOS EVENTOS DEL RATÓN CUANDO CARGA LA PÁGINA
document.addEventListener("DOMContentLoaded", () => {
    const img = document.getElementById('imagenZoomModal');
    const visor = document.querySelector('.modal-visor-imagen');

    if (img && visor) {
        
        // 1. ZOOM CON LA RUEDA DEL RATÓN
        visor.addEventListener('wheel', (e) => {
            e.preventDefault(); // Evita que la página intente scrollear

            const factorZoom = 0.15; // Velocidad del zoom
            if (e.deltaY < 0) {
                modalEscala += factorZoom; // Rueda hacia arriba = Acercar
            } else {
                modalEscala -= factorZoom; // Rueda hacia abajo = Alejar
            }

            // Evitar que la foto se haga miniatura (min 0.5x) o demasiado grande (max 8x)
            modalEscala = Math.max(0.5, Math.min(modalEscala, 8));
            aplicarTransformacionModal(img);
        });

        // 2. INICIAR ARRASTRE (Clic Izquierdo Sostenido)
        img.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Evita que el navegador intente "descargar" la foto al arrastrar
            modalIsDragging = true;
            // Calculamos en qué punto exacto de la pantalla hiciste clic
            modalStartX = e.clientX - modalTranslateX;
            modalStartY = e.clientY - modalTranslateY;
        });

        // 3. MOVER LA FOTO (Mientras mueves el ratón)
        window.addEventListener('mousemove', (e) => {
            if (!modalIsDragging) return;
            // Movemos la imagen restando la posición actual menos donde iniciaste el clic
            modalTranslateX = e.clientX - modalStartX;
            modalTranslateY = e.clientY - modalStartY;
            aplicarTransformacionModal(img);
        });

        // 4. SOLTAR LA FOTO
        window.addEventListener('mouseup', () => {
            modalIsDragging = false;
        });
        
        // Si el ratón sale del área negra, también soltamos la foto
        visor.addEventListener('mouseleave', () => {
            modalIsDragging = false;
        });
    }
});