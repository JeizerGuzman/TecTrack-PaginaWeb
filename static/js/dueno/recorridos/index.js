document.addEventListener('DOMContentLoaded', () => {
    
    // Variables
    let paginaActual = 1;
    const limite = 15; // Lista compacta, caben más
    
    let mapa = null;
    let capaRuta = null;
    let capaAlertas = L.layerGroup();

    let recorridoActivoId = null;
    let recorridoActivoEstado = null;

    // Referencias DOM
    const contenedorRecorridos = document.getElementById('contenedor-recorridos');
    const filtroEstado = document.getElementById('filtro-estado');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const textoPaginacion = document.getElementById('texto-paginacion');
    
    const infoFlotante = document.getElementById('info-viaje-flotante');
    const tituloMapa = document.getElementById('titulo-mapa-viaje');
    const badgeMapa = document.getElementById('badge-estado-mapa');

    // 1. Inicializar Mapa inmediatamente
    inicializarMapa();
    // 2. Cargar la lista
    cargarRecorridos(paginaActual);

    // Eventos
    btnFiltrar.addEventListener('click', () => { paginaActual = 1; cargarRecorridos(paginaActual); });
    btnPrev.addEventListener('click', () => { if (paginaActual > 1) { paginaActual--; cargarRecorridos(paginaActual); } });
    btnNext.addEventListener('click', () => { paginaActual++; cargarRecorridos(paginaActual); });

    function inicializarMapa() {
        mapa = L.map('mapa-recorrido').setView([16.75, -93.11], 10); // Chiapas por defecto
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap, © CartoDB' // Estilo de mapa más limpio, parecido al de la imagen
        }).addTo(mapa);
        capaAlertas.addTo(mapa);
    }

    // ==========================================
    // LISTA COMPACTA
    // ==========================================
    async function cargarRecorridos(page) {
        contenedorRecorridos.innerHTML = '<div class="loading-texto">Cargando...</div>';
        try {
            const data = await TrackAPI.obtenerRecorridosAdmin(page, limite, filtroEstado.value);
            if (data.success) {
                renderizarLista(data.recorridos);
                actualizarPaginacion(data.paginacion);
            }
        } catch (error) {
            contenedorRecorridos.innerHTML = `<div class="loading-texto" style="color:red;">Error de conexión.</div>`;
        }
    }

    function renderizarLista(recorridos) {
        contenedorRecorridos.innerHTML = '';
        if (recorridos.length === 0) {
            contenedorRecorridos.innerHTML = '<div class="loading-texto">Sin registros.</div>';
            return;
        }

        recorridos.forEach(r => {
            const fecha = new Date(r.fecha_inicio * 1000);
            const hora = fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const fechaCorta = fecha.toLocaleDateString();

            // Determinar icono
            let icono = '✓';
            if(r.estado === 'en_curso') icono = '▶';
            if(r.estado === 'cancelado') icono = '✕';

            const div = document.createElement('div');
            div.className = 'item-recorrido';
            
            // 🌟 EL FIX: Si esta tarjeta es la que estábamos viendo, le ponemos la clase activo desde que nace
            if (r.id === recorridoActivoId) {
                div.classList.add('activo');
            }
            
            // Estructura HTML idéntica a tu imagen de referencia
            div.innerHTML = `
                <div class="status-dot dot-${r.estado}">${icono}</div>
                <div class="item-info">
                    <!-- 🌟 AHORA MUESTRA EL NOMBRE REAL -->
                    <div class="item-titulo">${escapeHtml(r.vehiculo_nombre || 'Vehículo ' + r.vehiculo_id)}</div>
                     <div class="item-detalle">De: ${r.origen_nombre}</div>
                    <div class="item-detalle">A: ${escapeHtml(r.destino_nombre || 'Sin destino')}</div>
                </div>
                <div class="item-meta">
                    <strong>${hora}</strong>
                    <span>${fechaCorta}</span>
                    <button class="btn-info-viaje" data-id="${r.id}" title="Ver detalles completos">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 16v-4"></path>
                            <path d="M12 8h.01"></path>
                        </svg>
                    </button>
                </div>
            `;
            // IMPORTANTE: Asegúrate de tener una función "escapeHtml" definida en tu JS, si no la tienes, te la dejo abajo.
            
            // Evento para dibujar en el mapa al hacer clic en la tarjeta
            div.addEventListener('click', () => {
                document.querySelectorAll('.item-recorrido').forEach(el => el.classList.remove('activo'));
                div.classList.add('activo');
                
                // Guardamos qué viaje se está viendo para autorefrescarlo
                recorridoActivoId = r.id;
                recorridoActivoEstado = r.estado;
                
                dibujarRutaEnMapa(r.id, r.estado);
            });

            // NUEVO: Evento para abrir el modal (evitando que se active el clic del mapa)
            const btnInfo = div.querySelector('.btn-info-viaje');
            btnInfo.addEventListener('click', (e) => {
                e.stopPropagation(); // Detiene el clic para que no afecte a la tarjeta padre
                abrirModalDetallesRecorrido(r.id, r.estado);
            });

            contenedorRecorridos.appendChild(div);
        });
    }

    function actualizarPaginacion(pag) {
        if (!pag) return;
        textoPaginacion.textContent = `${pag.pagina_actual} / ${pag.paginas_totales || 1}`;
        btnPrev.disabled = !pag.tiene_anterior;
        btnNext.disabled = !pag.tiene_siguiente;
    }

    // ==========================================
    // DIBUJAR EN EL MAPA PERSISTENTE
    // ==========================================
    async function dibujarRutaEnMapa(recorridoId, estado) {
        infoFlotante.classList.remove('oculto');
        tituloMapa.textContent = `Cargando ruta...`;
        badgeMapa.textContent = '';

        try {
            const data = await TrackAPI.obtenerDetalleRecorrido(recorridoId);
            
            if (data.success) {
                tituloMapa.textContent = `Viaje #${recorridoId}`;
                badgeMapa.textContent = estado.replace('_', ' ').toUpperCase();
                badgeMapa.style.color = estado === 'en_curso' ? '#10b981' : (estado === 'cancelado' ? '#ef4444' : '#6b7280');

                if (capaRuta) mapa.removeLayer(capaRuta);
                capaAlertas.clearLayers();

                // 1. Extraer coordenadas del Historial GPS
                let latlngs = data.ruta_trazada.map(p => [p.lat, p.lng]);

                // Si no hay historial, intentamos usar el origen
                if (latlngs.length === 0 && data.recorrido.origen_coordenadas) {
                    const partes = data.recorrido.origen_coordenadas.split(',');
                    if (partes.length === 2) {
                        latlngs.push([parseFloat(partes[0]), parseFloat(partes[1])]);
                    }
                }

                // ==============================================================
                // 2. DIBUJO DE RUTA (Estrategia Híbrida)
                // ==============================================================
                
                // A. Si el viaje terminó y ya tenemos la ruta corregida desde la BD
                if (estado !== 'en_curso' && data.recorrido.ruta_corregida) {
                    // La usamos directamente (es ultrarrápido)
                    capaRuta = L.polyline(data.recorrido.ruta_corregida, {color: '#2563eb', weight: 4, opacity: 0.8}).addTo(mapa);
                    mapa.fitBounds(capaRuta.getBounds(), { padding: [50, 50] });

                // B. Si el viaje está activo (en_curso) y hay más de 1 punto, pedimos a OSRM en vivo
                } else if (latlngs.length > 1) {
                    tituloMapa.textContent = `Ajustando ruta a las calles...`;
                    
                    let puntosAProcesar = latlngs;
                    if (latlngs.length > 90) {
                        const factor = Math.ceil(latlngs.length / 90);
                        puntosAProcesar = latlngs.filter((_, index) => index % factor === 0);
                        if (puntosAProcesar[puntosAProcesar.length - 1] !== latlngs[latlngs.length - 1]) {
                            puntosAProcesar.push(latlngs[latlngs.length - 1]);
                        }
                    }

                    const coordsOSRM = puntosAProcesar.map(p => `${p[1]},${p[0]}`).join(';');
                    
                    try {
                        const response = await fetch(`https://router.project-osrm.org/match/v1/driving/${coordsOSRM}?geometries=geojson&overview=full`);
                        const osrmData = await response.json();

                        if (osrmData.code === 'Ok' && osrmData.matchings.length > 0) {
                            const rutaAjustada = osrmData.matchings[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                            capaRuta = L.polyline(rutaAjustada, {color: '#2563eb', weight: 4, opacity: 0.8}).addTo(mapa);
                        } else {
                            throw new Error("No hubo match");
                        }
                    } catch (error) {
                        console.warn("Fallo OSRM en vivo, usando línea cruda.");
                        capaRuta = L.polyline(latlngs, {color: '#2563eb', weight: 4, opacity: 0.8}).addTo(mapa);
                    }

                    mapa.fitBounds(capaRuta.getBounds(), { padding: [50, 50] });
                    tituloMapa.textContent = `Viaje #${recorridoId}`;
                
                // C. Si solo tiene 1 punto, centramos la cámara
                } else if (latlngs.length === 1) {
                    mapa.setView(latlngs[0], 16);
                }

                // ==============================================================
                // 3. PINES DE INICIO / FIN Y ALERTAS
                // ==============================================================
                if (latlngs.length > 0) {
                    const iconoInicio = L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
                    });
                    
                    let textoPopup = `<b>📍 Origen:</b><br>${data.recorrido.origen_nombre}`;
                    
                    if (latlngs.length === 1 && estado !== 'en_curso') {
                        textoPopup = `<b>📍🏁 Inicio y Fin (Sin avance):</b><br>${data.recorrido.origen_nombre}`;
                        if(estado === 'cancelado') {
                            iconoInicio.options.iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png';
                        }
                    }

                    L.marker(latlngs[0], {icon: iconoInicio})
                        .bindPopup(textoPopup)
                        .addTo(capaAlertas);

                    if (latlngs.length > 1) {
                        const iconoFin = L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
                        });
                        L.marker(latlngs[latlngs.length - 1], {icon: iconoFin})
                            .bindPopup(`<b>🏁 Destino:</b><br>${data.recorrido.destino_nombre}`)
                            .addTo(capaAlertas);
                    }
                }

                const iconoAlerta = L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [20, 32], iconAnchor: [10, 32], popupAnchor: [1, -28]
                });

                data.alertas.forEach(alerta => {
                    if (alerta.lat && alerta.lng) {
                        const marker = L.marker([alerta.lat, alerta.lng], {icon: iconoAlerta});
                        const horaAlerta = new Date(alerta.timestamp * 1000).toLocaleTimeString();
                        marker.bindPopup(`
                            <div style="text-align:center;">
                                <strong style="color:#ef4444;">${alerta.tipo.toUpperCase()}</strong><br>
                                <small>${horaAlerta}</small><br>
                                <a href="/dueno/alertas?id=${alerta.id}" style="color:#2563eb; text-decoration:none; margin-top:5px; display:inline-block;">Ver detalle</a>
                            </div>
                        `);
                        capaAlertas.addLayer(marker);
                    }
                });
            }
        } catch (error) {
            tituloMapa.textContent = `Error al cargar`;
            console.error(error);
        }
    }

    // ==========================================
    // AUTO-REFRESCO (CADA 30 SEGUNDOS)
    // ==========================================
    setInterval(() => {
        // 1. Refrescar la lista silenciosamente (sin poner el texto de "Cargando...")
        // Usamos TrackAPI directo en lugar de cargarRecorridos() para no borrar la pantalla
        TrackAPI.obtenerRecorridosAdmin(paginaActual, limite, filtroEstado.value)
            .then(data => {
                if (data.success) {
                    renderizarLista(data.recorridos);
                    actualizarPaginacion(data.paginacion);
                }
            })
            .catch(err => console.error("Error en auto-refresco de lista:", err));

        // 2. Refrescar el mapa silenciosamente (solo si el viaje sigue en curso)
        if (recorridoActivoId && recorridoActivoEstado === 'en_curso') {
            dibujarRutaEnMapa(recorridoActivoId, recorridoActivoEstado);
        }
    }, 30000); // Ajustado a 30 segundos (30000 ms)

    // ==========================================
    // MODAL DE DETALLES DEL RECORRIDO
    // ==========================================
    
    // Configurar cierres del modal
    document.getElementById('btnCerrarModalDetalle')?.addEventListener('click', cerrarModalDetalle);
    document.getElementById('btnCerrarModalDetalleAbajo')?.addEventListener('click', cerrarModalDetalle);

    function cerrarModalDetalle() {
        document.getElementById('modalDetalleViaje')?.classList.remove('visible');
    }

    async function abrirModalDetallesRecorrido(recorridoId, estado) {
        // Mostrar modal con estado de carga
        const modal = document.getElementById('modalDetalleViaje');
        document.getElementById('modalDetalleTitulo').textContent = `Viaje #${recorridoId}`;
        document.getElementById('modalDetalleSubtitulo').textContent = "Obteniendo datos del servidor...";
        
        // Limpiar datos previos
        document.getElementById('mdlEstado').textContent = "-";
        document.getElementById('mdlDistanciaEst').textContent = "-";
        document.getElementById('mdlTiempoEst').textContent = "-";
        document.getElementById('mdlTotalAlertas').textContent = "0";
        document.getElementById('mdlInicio').textContent = "-";
        document.getElementById('mdlFin').textContent = "-";
        document.getElementById('mdlOrigen').textContent = "-";
        document.getElementById('mdlDestino').textContent = "-";
        document.getElementById('contenedorAlertasModal').style.display = 'none';
        document.getElementById('listaAlertasModal').innerHTML = "";

        modal.classList.add('visible');

        try {
            const data = await TrackAPI.obtenerDetalleRecorrido(recorridoId);
            if (data.success) {
                const rec = data.recorrido;
                
                document.getElementById('modalDetalleTitulo').textContent = `Viaje #${rec.id}`;
                document.getElementById('modalDetalleSubtitulo').textContent = `${rec.vehiculo_nombre || 'Vehículo ' + rec.vehiculo_id}`;
                
                // Chofer y Vehículo
                document.getElementById('mdlChofer').textContent = rec.chofer_nombre || "No asignado";document.getElementById('mdlPlacasYVel').textContent = rec.vehiculo_placas || 'Sin placas registradas';
                document.getElementById('mdlPlacasYVel').textContent = rec.vehiculo_placas || 'Sin placas registradas';

                // Estado
                const estadosVisuales = { 'en_curso': '🟢 En Curso', 'finalizado': '🔵 Finalizado', 'cancelado': '🔴 Cancelado' };
                document.getElementById('mdlEstado').textContent = estadosVisuales[rec.estado] || rec.estado;
                
                // Distancias
                document.getElementById('mdlDistanciaEst').textContent = rec.distancia_estimada_km ? `${rec.distancia_estimada_km} km` : '-';
                document.getElementById('mdlDistanciaReal').textContent = rec.distancia_real_km ? `${rec.distancia_real_km} km` : (rec.estado === 'en_curso' ? 'En ruta' : '-');
                
                // Tiempos y Cálculo de Retraso (La lógica inteligente)
                const tEst = rec.tiempo_estimado_mins || 0;
                let tReal = rec.tiempo_real_mins || 0;
                
                // Si el viaje está en curso y no nos envían tiempo_real, lo calculamos al vuelo
                if (rec.estado === 'en_curso' && rec.fecha_inicio) {
                    tReal = Math.floor((Date.now() / 1000 - rec.fecha_inicio) / 60);
                }

                document.getElementById('mdlTiempoEst').textContent = tEst ? `${tEst} min` : '-';
                document.getElementById('mdlTiempoReal').textContent = tReal ? `${tReal} min` : '-';

                // Lógica de retrasos
                const badgeRetraso = document.getElementById('mdlRetrasoBadge');
                badgeRetraso.innerHTML = ""; // Limpiar
                
                if (tEst > 0 && tReal > 0) {
                    const diferencia = tReal - tEst;
                    
                    if (diferencia <= 5) { // Margen de gracia de 5 minutos
                        badgeRetraso.innerHTML = `<span class="badge-tiempo tiempo-ok">A tiempo</span>`;
                    } else if (diferencia > 5 && diferencia <= 15) {
                        badgeRetraso.innerHTML = `<span class="badge-tiempo tiempo-retraso">+${diferencia} min (Ligero retraso)</span>`;
                    } else {
                        badgeRetraso.innerHTML = `<span class="badge-tiempo tiempo-tarde">+${diferencia} min (Muy tarde)</span>`;
                    }
                }

                // Fechas
                const formatearFecha = (ts) => ts ? new Date(ts * 1000).toLocaleString('es-MX') : 'Pendiente';
                document.getElementById('mdlInicio').textContent = formatearFecha(rec.fecha_inicio);
                document.getElementById('mdlFin').textContent = rec.estado === 'en_curso' ? 'En ruta...' : formatearFecha(rec.fecha_fin);
                
                // Direcciones
                document.getElementById('mdlOrigen').textContent = rec.origen_nombre || "Sin especificar";
                document.getElementById('mdlDestino').textContent = rec.destino_nombre || "Sin especificar";

                // Alertas
                const totalAlertas = data.alertas ? data.alertas.length : 0;
                document.getElementById('mdlTotalAlertas').textContent = totalAlertas;
                
                if (totalAlertas > 0) {
                    document.getElementById('contenedorAlertasModal').style.display = 'block';
                    const lista = document.getElementById('listaAlertasModal');
                    data.alertas.forEach(alerta => {
                        const li = document.createElement('li');
                        li.innerHTML = `<strong>${new Date(alerta.timestamp * 1000).toLocaleTimeString()} - ${alerta.tipo.toUpperCase()}</strong> ${alerta.descripcion || 'Sin detalles'}`;
                        lista.appendChild(li);
                    });
                }
            } else {
                document.getElementById('modalDetalleSubtitulo').textContent = "Error al obtener datos.";
            }
        } catch (error) {
            console.error("Error abriendo detalles:", error);
            document.getElementById('modalDetalleSubtitulo').textContent = "Fallo de conexión.";
        }
    }
    
    // Función de seguridad para evitar que textos extraños rompan el HTML
    function escapeHtml(texto) {
        if (!texto) return "";
        return String(texto).replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;', 
                '<': '&lt;', 
                '>': '&gt;', 
                '"': '&quot;', 
                "'": '&#39;'
            }[m];
        });
    }

});