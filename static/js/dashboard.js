// ================= INICIALIZACIÓN =================
document.addEventListener("DOMContentLoaded", () => {
    inicializarDashboard();
    actualizarEstado();
    setInterval(actualizarEstado, 1000);
    setInterval(tickClock, 1000);
});

// ================= INICIALIZAR DASHBOARD =================
function inicializarDashboard() {
    const id_usuario = window.SESSION_ID     || localStorage.getItem("id_usuario") || "0";
    const nombre     = window.SESSION_NOMBRE || localStorage.getItem("nombre")     || "Usuario";
    const tipo       = window.SESSION_TIPO   || localStorage.getItem("tipo")       || "usuario";

    localStorage.setItem("id_usuario", id_usuario);
    localStorage.setItem("nombre", nombre);
    localStorage.setItem("tipo", tipo);

    document.getElementById("userName").textContent = nombre;

    const rolBadge = document.getElementById("rolBadge");
    if (tipo === "dueno") {
        rolBadge.textContent = "Dueño";
        rolBadge.className   = "role-badge role-dueno";
        document.getElementById("btnAgregarVehiculo").style.display = "flex";
    } else if (tipo === "chofer") {
        rolBadge.textContent = "Chofer";
        rolBadge.className   = "role-badge role-chofer";
        document.getElementById("btnAgregarVehiculo").style.display = "none";
    }

    const iniciales = nombre.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    document.getElementById("userAvatar").textContent = iniciales;
}

// ================= LOGOUT =================
function logout() {
    localStorage.clear();
    window.location.href = "/logout";
}

// ================= RELOJ =================
function tickClock() {
    const t = new Date().toLocaleTimeString("es-MX", { hour12: false });
    document.getElementById("pillSync").textContent = "SYNC " + t;
}

// ═══════════════════════════════════════════
// MODAL — AGREGAR VEHÍCULO
// ═══════════════════════════════════════════
function abrirModalVehiculo() {
    document.getElementById("modalVehiculo").classList.add("active");
}

function cerrarModalVehiculo() {
    document.getElementById("modalVehiculo").classList.remove("active");
    document.getElementById("nombreVehiculo").value = "";
    document.getElementById("identificadorVehiculo").value = "";
    document.getElementById("errorNombreVehiculo").style.display = "none";
    document.getElementById("errorIdentificadorVehiculo").style.display = "none";
}

function crearVehiculo() {
    const nombre        = document.getElementById("nombreVehiculo").value.trim();
    const identificador = document.getElementById("identificadorVehiculo").value.trim();
    let valido = true;

    if (!nombre) {
        document.getElementById("errorNombreVehiculo").textContent = "El nombre es requerido";
        document.getElementById("errorNombreVehiculo").style.display = "block";
        valido = false;
    } else {
        document.getElementById("errorNombreVehiculo").style.display = "none";
    }
    if (!identificador) {
        document.getElementById("errorIdentificadorVehiculo").textContent = "El identificador es requerido";
        document.getElementById("errorIdentificadorVehiculo").style.display = "block";
        valido = false;
    } else {
        document.getElementById("errorIdentificadorVehiculo").style.display = "none";
    }
    if (!valido) return;

    fetch("/api/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, identificador })
    })
    .then(res => res.json())
    .then(data => {
        if (data.ok) { cerrarModalVehiculo(); actualizarEstado(); }
        else {
            if (data.error && data.error.includes("identificador")) {
                document.getElementById("errorIdentificadorVehiculo").textContent = data.error;
                document.getElementById("errorIdentificadorVehiculo").style.display = "block";
            } else { alert(data.error || "Error al crear vehículo"); }
        }
    })
    .catch(() => alert("Error de conexión"));
}

// ═══════════════════════════════════════════
// MODAL — ASIGNAR CHOFER
// ═══════════════════════════════════════════
let _vehiculoIdActivo = null;

function abrirModalChofer(vehiculoId, nombreVehiculo) {
    _vehiculoIdActivo = vehiculoId;
    document.getElementById("nombreVehiculoAsignar").textContent = nombreVehiculo;
    document.getElementById("errorSelectChofer").style.display = "none";

    const select = document.getElementById("selectChofer");
    select.innerHTML = '<option value="">Cargando choferes...</option>';
    select.disabled  = true;
    document.getElementById("modalChofer").classList.add("active");

    fetch("/api/choferes")
        .then(res => res.json())
        .then(data => {
            select.innerHTML = "";
            if (!data.choferes || data.choferes.length === 0) {
                select.innerHTML = '<option value="">Sin choferes registrados</option>';
                select.disabled  = true;
                return;
            }
            const ph = document.createElement("option");
            ph.value = ""; ph.textContent = "Seleccionar chofer...";
            select.appendChild(ph);
            data.choferes.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = `${c.nombre} — ${c.correo}`;
                select.appendChild(opt);
            });
            select.disabled = false;
        })
        .catch(() => { select.innerHTML = '<option value="">Error al cargar choferes</option>'; });
}

function cerrarModalChofer() {
    document.getElementById("modalChofer").classList.remove("active");
    _vehiculoIdActivo = null;
}

function confirmarAsignacion() {
    const chofer_id = document.getElementById("selectChofer").value;
    if (!chofer_id) {
        document.getElementById("errorSelectChofer").textContent = "Selecciona un chofer";
        document.getElementById("errorSelectChofer").style.display = "block";
        return;
    }
    document.getElementById("errorSelectChofer").style.display = "none";
    fetch(`/api/vehiculos/${_vehiculoIdActivo}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chofer_id: parseInt(chofer_id) })
    })
    .then(res => res.json())
    .then(data => {
        if (data.ok) { cerrarModalChofer(); actualizarEstado(); }
        else alert(data.error || "Error al asignar chofer");
    })
    .catch(() => alert("Error de conexión"));
}

function desasignarChofer() {
    if (!_vehiculoIdActivo) return;
    fetch(`/api/vehiculos/${_vehiculoIdActivo}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chofer_id: null })
    })
    .then(res => res.json())
    .then(data => {
        if (data.ok) { cerrarModalChofer(); actualizarEstado(); }
        else alert(data.error || "Error al desasignar");
    })
    .catch(() => alert("Error de conexión"));
}

// ═══════════════════════════════════════════
// MODAL — ELIMINAR VEHÍCULO
// ═══════════════════════════════════════════
let _vehiculoIdEliminar = null;

function abrirModalEliminar(vehiculoId, nombreVehiculo) {
    _vehiculoIdEliminar = vehiculoId;
    document.getElementById("nombreVehiculoEliminar").textContent = nombreVehiculo;
    document.getElementById("modalEliminar").classList.add("active");
}

function cerrarModalEliminar() {
    document.getElementById("modalEliminar").classList.remove("active");
    _vehiculoIdEliminar = null;
}

function confirmarEliminacion() {
    if (!_vehiculoIdEliminar) return;
    fetch(`/api/vehiculos/${_vehiculoIdEliminar}`, { method: "DELETE" })
    .then(res => res.json())
    .then(data => {
        if (data.ok) {
            cerrarModalEliminar();
            const card = document.getElementById(`card-${_vehiculoIdEliminar}`);
            if (card) card.remove();
            actualizarEstado();
        } else { alert(data.error || "Error al eliminar vehículo"); }
    })
    .catch(() => alert("Error de conexión"));
}

// ═══════════════════════════════════════════
// MODAL — HISTORIAL
// ═══════════════════════════════════════════
let _historialChart = null;

function abrirModalHistorial(vehiculoId, nombreVehiculo) {
    document.getElementById("historialNombreVehiculo").textContent = nombreVehiculo;
    document.getElementById("historialCargando").style.display     = "block";
    document.getElementById("historialTabla").style.display        = "none";
    document.getElementById("historialVacio").style.display        = "none";
    document.getElementById("historialBody").innerHTML             = "";
    document.getElementById("modalHistorial").classList.add("active");

    if (_historialChart) { _historialChart.destroy(); _historialChart = null; }

    fetch(`/api/historial/${vehiculoId}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById("historialCargando").style.display = "none";
            if (!data.rangos || data.rangos.length === 0) {
                document.getElementById("historialVacio").style.display = "block";
                return;
            }
            renderTablaHistorial(data.rangos);
            renderGraficaHistorial(data.rangos);
        })
        .catch(() => { document.getElementById("historialCargando").textContent = "Error al cargar historial"; });
}

function cerrarModalHistorial() {
    document.getElementById("modalHistorial").classList.remove("active");
    if (_historialChart) { _historialChart.destroy(); _historialChart = null; }
}

function formatDuracion(s) {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}
function formatHora(ts) {
    return new Date(ts * 1000).toLocaleTimeString("es-MX", { hour12: false });
}
function formatFechaHora(ts) {
    return new Date(ts * 1000).toLocaleString("es-MX", {
        day:"2-digit", month:"2-digit",
        hour:"2-digit", minute:"2-digit", second:"2-digit", hour12: false
    });
}

function renderTablaHistorial(rangos) {
    const tbody = document.getElementById("historialBody");
    tbody.innerHTML = "";
    rangos.forEach(r => {
        const tr = document.createElement("tr");
        if (r.alerta === 1) tr.classList.add("fila-alerta");
        tr.innerHTML = `
            <td class="td-mono">${formatFechaHora(r.inicio)}</td>
            <td class="td-mono">${formatFechaHora(r.fin)}</td>
            <td class="td-mono td-duracion">${formatDuracion(r.fin - r.inicio)}</td>
            <td><span class="tag-estado ${r.alerta===1?'tag-warn':'tag-ok'}">${r.estado}</span></td>
            <td><span class="tag-estado ${r.puerta==='abierta'?'tag-warn':'tag-ok'}">${r.puerta}</span></td>
            <td><span class="tag-estado ${r.vibracion===1?'tag-warn':'tag-ok'}">${r.vibracion===1?'Detectada':'Normal'}</span></td>`;
        tbody.appendChild(tr);
    });
    document.getElementById("historialTabla").style.display = "table";
}

function renderGraficaHistorial(rangos) {
    const canvas = document.getElementById("historialChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function color(r) {
        if (r.estado === "sin señal")  return "#FFB020";
        if (r.estado === "panico")     return "#FF4D6A";  // rojo intenso
        if (r.estado === "manual")     return "#6C7A9C";  // gris azulado
        if (r.alerta===1 || r.puerta==="abierta" || r.vibracion===1) return "#FF4D6A";
        return "#00E096";
    }

    const cronologico = [...rangos].reverse();
    const fusionados  = [];
    let actual = { ...cronologico[0], color: color(cronologico[0]) };
    for (let i = 1; i < cronologico.length; i++) {
        const c = color(cronologico[i]);
        if (c === actual.color) { actual.fin = cronologico[i].fin; }
        else { fusionados.push(actual); actual = { ...cronologico[i], color: c }; }
    }
    fusionados.push(actual);

    const tsBase = fusionados[0].inicio;
    const tsMax  = fusionados[fusionados.length-1].fin;
    const barData = fusionados.map(r => ({ x:[r.inicio-tsBase, r.fin-tsBase], y:"Timeline", color:r.color, meta:r }));

    _historialChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Timeline"],
            datasets: [{ label:"Historial", data:barData,
                backgroundColor: barData.map(d=>d.color),
                borderWidth:0, borderRadius:3,
                barPercentage:0.5, categoryPercentage:1.0 }]
        },
        options: {
            indexAxis:"y", responsive:true, maintainAspectRatio:false, animation:false,
            parsing:{ xAxisKey:"x", yAxisKey:"y" },
            plugins: {
                legend:{ display:false },
                tooltip:{ callbacks:{
                    title: i => { const r=i[0].raw.meta; return `${formatFechaHora(r.inicio)} → ${formatFechaHora(r.fin)}`; },
                    label: i => { const r=i.raw.meta; return [
                        `Duración : ${formatDuracion(r.fin-r.inicio)}`,
                        `Estado   : ${r.estado}`,
                        `Puerta   : ${r.puerta}`,
                        `Vibración: ${r.vibracion===1?"Detectada":"Normal"}`
                    ];}
                }}
            },
            scales: {
                x:{ type:"linear", min:0, max:tsMax-tsBase,
                    ticks:{ color:"#6B7280", font:{size:10},
                        callback: val => new Date((tsBase+val)*1000).toLocaleTimeString("es-MX",{hour12:false}) },
                    grid:{ color:"rgba(255,255,255,0.05)" } },
                y:{ display:false }
            }
        }
    });
}

// ═══════════════════════════════════════════
// MODAL — MAPA GPS
// ═══════════════════════════════════════════
let _mapaLeaflet     = null;
let _mapaRuta        = null;
let _mapaMarkerActual = null;
let _mapaIntervalId  = null;
let _mapaVehiculoId  = null;
let _mapaPrimeraCarga = false;

function abrirModalMapa(vehiculoId, nombreVehiculo) {
    _mapaVehiculoId = vehiculoId;

    document.getElementById("mapaNombreVehiculo").textContent    = nombreVehiculo;
    document.getElementById("mapaSubtitulo").textContent         = "Cargando ruta...";
    document.getElementById("mapaCargando").style.display        = "block";
    document.getElementById("mapaVacio").style.display           = "none";
    document.getElementById("mapaInfoBar").style.display         = "none";
    document.getElementById("modalMapa").classList.add("active");

    // Inicializar mapa Leaflet la primera vez
    if (!_mapaLeaflet) {
        _mapaLeaflet = L.map("mapaLeaflet", { zoomControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap",
            maxZoom: 19
        }).addTo(_mapaLeaflet);
    }

    _mapaPrimeraCarga = true;
    cargarMapa().then(() => {
        _mapaIntervalId = setInterval(() => {
            _mapaPrimeraCarga = false;
            cargarMapa();
        }, 3000);
    });
}

function cargarMapa() {
    return fetch(`/api/mapa/${_mapaVehiculoId}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById("mapaCargando").style.display = "none";

            if (!data.puntos || data.puntos.length === 0) {
                document.getElementById("mapaVacio").style.display = "block";
                document.getElementById("mapaSubtitulo").textContent = "Sin datos GPS aún";
                return;
            }

            document.getElementById("mapaVacio").style.display   = "none";
            document.getElementById("mapaInfoBar").style.display = "flex";

            const ultima = data.ultima;
            document.getElementById("mapaUltimaPosicion").textContent =
                `${ultima.lat.toFixed(5)}, ${ultima.lng.toFixed(5)}`;
            document.getElementById("mapaUltimoTs").textContent =
                formatFechaHora(ultima.timestamp);
            document.getElementById("mapaTotalPuntos").textContent =
                `${data.total} puntos`;
            document.getElementById("mapaSubtitulo").textContent =
                `Ruta del día — ${data.total} puntos registrados`;

            const coords = data.puntos.map(p => [p.lat, p.lng]);

            if (_mapaRuta) { _mapaLeaflet.removeLayer(_mapaRuta); }

            _mapaRuta = L.polyline(coords, {
                color:   "#00E5C8",
                weight:  3,
                opacity: 0.8
            }).addTo(_mapaLeaflet);

            if (_mapaMarkerActual) { _mapaLeaflet.removeLayer(_mapaMarkerActual); }

            const iconColor = ultima.alerta === 1 ? "#FF4D6A" : "#00E096";
            const iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
                    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.27 21.73 0 14 0z"
                        fill="${iconColor}" stroke="white" stroke-width="2"/>
                    <circle cx="14" cy="14" r="5" fill="white"/>
                </svg>`;

            const icon = L.divIcon({
                html:       iconSvg,
                iconSize:   [28, 36],
                iconAnchor: [14, 36],
                className:  ""
            });

            _mapaMarkerActual = L.marker([ultima.lat, ultima.lng], { icon })
                .addTo(_mapaLeaflet)
                .bindPopup(`
                    <b>${data.vehiculo}</b><br>
                    Estado: ${ultima.estado}<br>
                    ${formatFechaHora(ultima.timestamp)}
                `);

            // ── Vista inicial: solo en la primera carga ──────────────
            if (_mapaPrimeraCarga) {
                _mapaLeaflet.setView([ultima.lat, ultima.lng], 16);
                _mapaPrimeraCarga = false;
            }

            setTimeout(() => _mapaLeaflet.invalidateSize(), 100);
        })
        .catch(() => {
            document.getElementById("mapaCargando").style.display = "none";
            document.getElementById("mapaVacio").style.display    = "block";
            document.getElementById("mapaSubtitulo").textContent  = "Error al cargar mapa";
        });
}

function cerrarModalMapa() {
    document.getElementById("modalMapa").classList.remove("active");
    if (_mapaIntervalId) { clearInterval(_mapaIntervalId); _mapaIntervalId = null; }
    _mapaVehiculoId = null;
}

// ═══════════════════════════════════════════
// ESTADO Y RENDER
// ═══════════════════════════════════════════
function actualizarEstado() {
    fetch("/estado?t=" + new Date().getTime())
        .then(res => res.json())
        .then(data => renderDatos(data))
        .catch(err => {
            console.error("Error:", err);
            const pill = document.getElementById("statusBar").querySelector(".status-pill");
            if (pill) pill.textContent = "SIN CONEXIÓN";
        });
}

function renderDatos(data) {
    const contenedor = document.getElementById("contenedor");
    const tipo       = localStorage.getItem("tipo") || "usuario";
    const keys       = Object.keys(data).filter(k => data[k] && data[k].vehiculo);

    document.getElementById("pillCount").textContent = keys.length + " UNIDADES";
    document.getElementById("sectionSub").textContent =
        "última actualización " + new Date().toLocaleTimeString("es-MX", { hour12: false });

    if (keys.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
                        <rect x="1" y="6" width="20" height="10" rx="2" stroke="#3D4048" stroke-width="1.5"/>
                        <circle cx="5" cy="18" r="2" stroke="#3D4048" stroke-width="1.5"/>
                        <circle cx="17" cy="18" r="2" stroke="#3D4048" stroke-width="1.5"/>
                    </svg>
                </div>
                <div class="empty-title">Sin vehículos activos</div>
                <div class="empty-sub">Esperando datos del ESP32...</div>
            </div>`;
        return;
    }

    const tarjetasActuales = Array.from(contenedor.querySelectorAll('.vehicle-card'))
        .map(c => c.id.replace('card-', ''));
    const keysNuevos = keys.map(k => data[k].vehiculo_id?.toString() || k);
    const mismoConjunto =
        tarjetasActuales.length === keysNuevos.length &&
        keysNuevos.every(k => tarjetasActuales.includes(k));

    if (!mismoConjunto || contenedor.querySelector('.skeleton') || contenedor.querySelector('.empty-state')) {
        contenedor.innerHTML = "";
        keys.forEach((key, i) => { contenedor.innerHTML += crearTarjetaHTML(key, data[key], i, tipo); });
        return;
    }

    keys.forEach(key => actualizarTarjeta(key, data[key]));
}

// ─── CREAR HTML DE TARJETA ────────────────────
function crearTarjetaHTML(key, v, index, tipo) {
    const esAlerta   = v.alerta === 1;
    const esSinSenal = v.estado === 'sin señal';

    const esPanico = v.estado === "panico";
    const esManual = v.estado === "manual";

    let claseCard = "vehicle-card normal";
    if (esPanico)        claseCard = "vehicle-card panico";
    else if (esAlerta)   claseCard = "vehicle-card alerta";
    else if (esManual)   claseCard = "vehicle-card manual";
    else if (esSinSenal) claseCard = "vehicle-card sin-senal";

    const ts = v.timestamp
        ? new Date(v.timestamp * 1000).toLocaleTimeString("es-MX", { hour12: false })
        : "--:--";

    let alertaBar = "";
    if (esPanico) {
        alertaBar = `
            <div class="alert-bar">
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2L1 12h12L7 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    <path d="M7 6v3M7 10.5v.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                BOTÓN DE PÁNICO ACTIVADO — atender de inmediato
            </div>`;
    } else if (esManual) {
        alertaBar = `
            <div class="alert-bar manual-bar">
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                Modo manual activo — sensores pausados
            </div>`;
    } else if (esAlerta) {
        alertaBar = `
            <div class="alert-bar">
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2L1 12h12L7 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    <path d="M7 6v3M7 10.5v.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                Alerta activa — revisar unidad
            </div>`;
    }

    const choferInfo = v.chofer_nombre
        ? `<div class="chofer-chip"><div class="chip-dot"></div>${v.chofer_nombre}</div>`
        : `<div class="chofer-chip" style="color:var(--text-dim);">Sin chofer asignado</div>`;

    // Indicador GPS en la tarjeta
    const gpsIndicador = v.lat && v.lng
        ? `<div class="gps-chip"><div class="gps-dot"></div>${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}</div>`
        : `<div class="gps-chip" style="color:var(--text-dim);">Sin GPS</div>`;

    const btnAcciones = tipo === "dueno" ? `
        <button class="btn-historial" onclick="abrirModalHistorial(${v.vehiculo_id}, '${v.vehiculo}')">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M7 4v3.5l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            Historial
        </button>
        <button class="btn-mapa" onclick="abrirModalMapa(${v.vehiculo_id}, '${v.vehiculo}')">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="5.5" r="3" stroke="currentColor" stroke-width="1.3"/>
                <path d="M7 14s5-4.5 5-8.5a5 5 0 00-10 0C2 9.5 7 14 7 14z" stroke="currentColor" stroke-width="1.3"/>
            </svg>
            Ver mapa
        </button>
        <button class="btn-asignar" onclick="abrirModalChofer(${v.vehiculo_id}, '${v.vehiculo}')">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="5" r="3" stroke="currentColor" stroke-width="1.3"/>
                <path d="M1 13c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            Chofer
        </button>
        <button class="btn-eliminar" onclick="abrirModalEliminar(${v.vehiculo_id}, '${v.vehiculo}')">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>` : `
        <button class="btn-historial" onclick="abrirModalHistorial(${v.vehiculo_id}, '${v.vehiculo}')">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M7 4v3.5l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            Historial
        </button>
        <button class="btn-mapa" onclick="abrirModalMapa(${v.vehiculo_id}, '${v.vehiculo}')">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="5.5" r="3" stroke="currentColor" stroke-width="1.3"/>
                <path d="M7 14s5-4.5 5-8.5a5 5 0 00-10 0C2 9.5 7 14 7 14z" stroke="currentColor" stroke-width="1.3"/>
            </svg>
            Ver mapa
        </button>`;

    return `
        <div class="${claseCard}" data-vehiculo="${key}" id="card-${v.vehiculo_id}" style="animation-delay:${index*0.06}s">
            ${alertaBar}
            <div class="card-header">
                <div>
                    <div class="card-name">${v.vehiculo}</div>
                    <div class="card-plate">ESP32 · UART 115200</div>
                </div>
                <div class="status-badge ${esPanico?'warn':esManual?'manual-badge':esAlerta?'warn':esSinSenal?'mid':'ok'}">
                    <div class="badge-dot"></div>
                    ${v.estado}
                </div>
            </div>
            <div class="card-metrics">
                <div class="metric">
                    <div class="metric-label">ESTADO</div>
                    <div class="metric-value estado-val ${esAlerta?'warn':esSinSenal?'mid':'ok'}">${v.estado}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">PUERTA</div>
                    <div class="metric-value puerta-val ${v.puerta==='abierta'?'warn':v.puerta==='desconocida'?'mid':'ok'}">${v.puerta}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">VIBRACIÓN</div>
                    <div class="metric-value vibracion-val ${v.vibracion===1?'warn':esSinSenal?'mid':'ok'}">${v.vibracion===1?'Detectada':esSinSenal?'desconocida':'Normal'}</div>
                </div>
            </div>
            <div class="card-footer">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    ${choferInfo}
                    ${gpsIndicador}
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    ${btnAcciones}
                    <div class="card-footer-ts">Actualizado: <span class="timestamp">${ts}</span></div>
                </div>
            </div>
        </div>`;
}

// ─── ACTUALIZAR TARJETA EXISTENTE ─────────────
function actualizarTarjeta(key, v) {
    const card = document.getElementById(`card-${v.vehiculo_id}`);
    if (!card) return;

    const esAlerta   = v.alerta === 1;
    const esSinSenal = v.estado === 'sin señal';
    const ts = v.timestamp
        ? new Date(v.timestamp * 1000).toLocaleTimeString("es-MX", { hour12: false })
        : "--:--";

    const esPanico = v.estado === "panico";
    const esManual = v.estado === "manual";
    card.className = `vehicle-card ${
        esPanico   ? "panico"    :
        esAlerta   ? "alerta"    :
        esManual   ? "manual"    :
        esSinSenal ? "sin-senal" : "normal"
    }`;

    let alertBar = card.querySelector('.alert-bar');

    if (esPanico) {
        if (!alertBar) {
            card.querySelector('.card-header').insertAdjacentHTML('beforebegin', `
                <div class="alert-bar">
                    <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2L1 12h12L7 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                        <path d="M7 6v3M7 10.5v.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                    BOTÓN DE PÁNICO ACTIVADO — atender de inmediato
                </div>`);
        } else {
            alertBar.className = "alert-bar";
            alertBar.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2L1 12h12L7 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    <path d="M7 6v3M7 10.5v.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                BOTÓN DE PÁNICO ACTIVADO — atender de inmediato`;
        }
    } else if (esManual) {
        if (!alertBar) {
            card.querySelector('.card-header').insertAdjacentHTML('beforebegin', `
                <div class="alert-bar manual-bar">
                    <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                        <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/>
                        <path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                    Modo manual activo — sensores pausados
                </div>`);
        } else {
            alertBar.className = "alert-bar manual-bar";
            alertBar.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                Modo manual activo — sensores pausados`;
        }
    } else if (esAlerta) {
        if (!alertBar) {
            card.querySelector('.card-header').insertAdjacentHTML('beforebegin', `
                <div class="alert-bar">
                    <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2L1 12h12L7 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                        <path d="M7 6v3M7 10.5v.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                    Alerta activa — revisar unidad
                </div>`);
        } else {
            alertBar.className = "alert-bar";
            alertBar.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2L1 12h12L7 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    <path d="M7 6v3M7 10.5v.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                Alerta activa — revisar unidad`;
        }
    } else if (alertBar) {
        alertBar.remove();
    }

    const badge = card.querySelector('.status-badge');
    badge.className = `status-badge ${esAlerta?'warn':esSinSenal?'mid':'ok'}`;
    badge.innerHTML = `<div class="badge-dot"></div>${v.estado}`;

    card.querySelector('.estado-val').className   = `metric-value estado-val ${esAlerta?'warn':esSinSenal?'mid':'ok'}`;
    card.querySelector('.estado-val').textContent = v.estado;
    card.querySelector('.puerta-val').className   = `metric-value puerta-val ${v.puerta==='abierta'?'warn':v.puerta==='desconocida'?'mid':'ok'}`;
    card.querySelector('.puerta-val').textContent = v.puerta;
    card.querySelector('.vibracion-val').className   = `metric-value vibracion-val ${v.vibracion===1?'warn':esSinSenal?'mid':'ok'}`;
    card.querySelector('.vibracion-val').textContent = v.vibracion===1?'Detectada':esSinSenal?'desconocida':'Normal';

    const tsEl = card.querySelector('.timestamp');
    if (tsEl) tsEl.textContent = ts;

    const choferChip = card.querySelector('.chofer-chip');
    if (choferChip) {
        if (v.chofer_nombre) {
            choferChip.style.color = "";
            choferChip.innerHTML   = `<div class="chip-dot"></div>${v.chofer_nombre}`;
        } else {
            choferChip.style.color = "var(--text-dim)";
            choferChip.innerHTML   = "Sin chofer asignado";
        }
    }

    // Actualizar indicador GPS
    const gpsChip = card.querySelector('.gps-chip');
    if (gpsChip) {
        if (v.lat && v.lng) {
            gpsChip.style.color = "";
            gpsChip.innerHTML   = `<div class="gps-dot"></div>${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}`;
        } else {
            gpsChip.style.color = "var(--text-dim)";
            gpsChip.innerHTML   = "Sin GPS";
        }
    }
}