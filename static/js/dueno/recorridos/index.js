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
                    <div class="item-titulo">Vehículo ${r.vehiculo_id}</div>
                    <div class="item-detalle">De: ${r.origen_nombre}</div>
                    <div class="item-detalle">A: ${r.destino_nombre}</div>
                </div>
                <div class="item-meta">
                    <strong>${hora}</strong>
                    <span>${fechaCorta}</span>
                </div>
            `;
            
            div.addEventListener('click', () => {
                document.querySelectorAll('.item-recorrido').forEach(el => el.classList.remove('activo'));
                div.classList.add('activo');
                
                // Guardamos qué viaje se está viendo para autorefrescarlo
                recorridoActivoId = r.id;
                recorridoActivoEstado = r.estado;
                
                dibujarRutaEnMapa(r.id, r.estado);
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

                // Limpiar mapa
                if (capaRuta) mapa.removeLayer(capaRuta);
                capaAlertas.clearLayers();

                // 1. Extraer coordenadas del Historial GPS
                let latlngs = data.ruta_trazada.map(p => [p.lat, p.lng]);

                // 🌟 EL FIX: Si no hay historial GPS, usamos el punto de origen del Recorrido
                if (latlngs.length === 0 && data.recorrido.origen_coordenadas) {
                    // Asumimos que viene como "latitud,longitud" (ej. "16.75,-93.11")
                    const partes = data.recorrido.origen_coordenadas.split(',');
                    if (partes.length === 2) {
                        latlngs.push([parseFloat(partes[0]), parseFloat(partes[1])]);
                    }
                }

                // 2. Dibujar la línea SOLO si hay 2 o más puntos
                if (latlngs.length > 1) {
                    capaRuta = L.polyline(latlngs, {color: '#2563eb', weight: 4, opacity: 0.8}).addTo(mapa);
                    mapa.fitBounds(capaRuta.getBounds(), { padding: [50, 50] });
                } else if (latlngs.length === 1) {
                    // Si solo hay 1 punto, centramos la cámara ahí con buen zoom
                    mapa.setView(latlngs[0], 15);
                }

                // 3. Colocar Pines de Inicio y Fin
                if (latlngs.length > 0) {
                    const iconoInicio = L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
                    });
                    
                    // Preparamos el texto del globito (Popup)
                    let textoPopup = `<b>📍 Origen:</b><br>${data.recorrido.origen_nombre}`;
                    
                    // Si el viaje no avanzó (1 punto) y ya NO está en curso, actualizamos el texto
                    if (latlngs.length === 1 && estado !== 'en_curso') {
                        textoPopup = `<b>📍🏁 Inicio y Fin (Sin avance):</b><br>${data.recorrido.origen_nombre}`;
                        
                        // Opcional: Si quieres que el pin cambie de color a gris cuando se canceló sin moverse
                        if(estado === 'cancelado') {
                            iconoInicio.options.iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png';
                        }
                    }

                    L.marker(latlngs[0], {icon: iconoInicio})
                        .bindPopup(textoPopup)
                        .addTo(capaAlertas);

                    // Pin Azul para el FIN real (Solo si avanzó de lugar y hay más de 1 punto)
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

                // 4. Dibujar Alertas
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
    }, 5000); // 30000 milisegundos = 30 segundos

});