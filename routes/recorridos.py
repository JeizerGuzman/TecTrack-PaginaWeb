# ============================================================
# ROUTES RECORRIDOS - TrackSecurity
# ============================================================
# Endpoints para la app móvil (chofer) y panel web (dueño)
# ============================================================

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import json

from config import db
from models import Recorrido,Vehiculo,Usuario
from helpers import timestamp_actual

import requests
import math

def registrar_recorridos_routes(app):

    # ========================================================
    # INICIAR UN RECORRIDO
    # ========================================================
    @app.route('/api/recorridos/iniciar', methods=['POST'])
    @jwt_required()
    def iniciar_recorrido():
        usuario_id = get_jwt_identity()
        data = request.get_json(silent=True) or {}

        vehiculo_id = data.get('vehiculo_id')
        origen_nombre = data.get('origen_nombre')
        origen_coordenadas = data.get('origen_coordenadas')
        destino_nombre = data.get('destino_nombre')
        destino_coordenadas = data.get('destino_coordenadas')
        ruta_planeada = data.get('ruta_planeada') # GeoJSON enviado por Flutter
        
        # MODO OFFLINE: Respetar la hora en la que el chofer presionó el botón en la app
        fecha_inicio_app = data.get('fecha_inicio')
        fecha_inicio_real = fecha_inicio_app if fecha_inicio_app else timestamp_actual()

        if not all([vehiculo_id, origen_nombre, origen_coordenadas, destino_nombre, destino_coordenadas]):
            return jsonify({"success": False, "mensaje": "Faltan datos obligatorios para iniciar el recorrido"}), 400

        # Validar que el vehículo no tenga un recorrido activo
        recorrido_activo = Recorrido.query.filter_by(
            vehiculo_id=vehiculo_id,
            estado='en_curso'
        ).first()

        if recorrido_activo:
            return jsonify({"success": False, "mensaje": "El vehículo ya tiene un recorrido en curso"}), 400

        try:
            nuevo_recorrido = Recorrido(
                vehiculo_id=vehiculo_id,
                chofer_id=usuario_id,
                origen_nombre=origen_nombre,
                origen_coordenadas=origen_coordenadas,
                destino_nombre=destino_nombre,
                destino_coordenadas=destino_coordenadas,
                ruta_planeada=json.dumps(ruta_planeada) if ruta_planeada else None,
                distancia_estimada=data.get('distancia_estimada'),
                duracion_estimada=data.get('duracion_estimada'),
                estado='en_curso',
                fecha_inicio=fecha_inicio_real
            )
            db.session.add(nuevo_recorrido)
            db.session.commit()

            return jsonify({
                "success": True, 
                "mensaje": "Recorrido iniciado correctamente",
                "recorrido_id": nuevo_recorrido.id
            }), 201

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "mensaje": f"Error interno: {str(e)}"}), 500


    # ========================================================
    # TERMINAR UN RECORRIDO (FINALIZAR O CANCELAR)
    # ========================================================
    @app.route('/api/recorridos/<int:recorrido_id>/terminar', methods=['PUT'])
    @jwt_required()
    def terminar_recorrido(recorrido_id):
        from models import HistorialGPS # Importación local para evitar dependencias circulares
        import requests
        import math

        # 🌟 NUEVO: Función de respaldo por si falla OSRM
        def calcular_distancia_manual(puntos):
            distancia_total = 0.0
            if len(puntos) < 2:
                return 0.0
                
            for i in range(len(puntos) - 1):
                p1, p2 = puntos[i], puntos[i+1]
                if not (p1.lat and p1.lng and p2.lat and p2.lng):
                    continue
                    
                R = 6371000.0 # Radio de la Tierra en metros
                d_lat = math.radians(p2.lat - p1.lat)
                d_lng = math.radians(p2.lng - p1.lng)
                
                a = math.sin(d_lat / 2)**2 + math.cos(math.radians(p1.lat)) * math.cos(math.radians(p2.lat)) * math.sin(d_lng / 2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                distancia_total += R * c
                
            return distancia_total

        usuario_id = get_jwt_identity()
        data = request.get_json(silent=True) or {}
        
        estado_final = data.get('estado', 'finalizado') 
        motivo_cancelacion = data.get('motivo_cancelacion', None)
        coordenadas_fin = data.get('coordenadas_fin', None) 
        
        fecha_fin_app = data.get('fecha_fin')
        fecha_fin_real = fecha_fin_app if fecha_fin_app else timestamp_actual()
        
        recorrido = Recorrido.query.get(recorrido_id)

        if not recorrido:
            return jsonify({"success": False, "mensaje": "Recorrido no encontrado"}), 404
            
        if str(recorrido.chofer_id) != str(usuario_id):
            return jsonify({"success": False, "mensaje": "No tienes permiso para finalizar este recorrido"}), 403

        if recorrido.estado != 'en_curso':
            return jsonify({"success": False, "mensaje": f"El recorrido ya está {recorrido.estado}"}), 400

        try:
            recorrido.estado = estado_final
            recorrido.fecha_fin = fecha_fin_real
            
            # 🌟 Calculamos la Duración Real (en segundos)
            duracion_calculada = 0
            if recorrido.fecha_inicio:
                duracion_calculada = fecha_fin_real - recorrido.fecha_inicio
                recorrido.duracion_real = duracion_calculada
            
            if estado_final == 'cancelado' and motivo_cancelacion:
                recorrido.motivo_cancelacion = motivo_cancelacion
            
            if coordenadas_fin:
                recorrido.coordenadas_fin = coordenadas_fin

            # ============================================================
            # MAP MATCHING Y CÁLCULO DE DISTANCIA
            # ============================================================
            puntos_gps = HistorialGPS.query.filter_by(recorrido_id=recorrido_id).order_by(HistorialGPS.timestamp.asc()).all()
            distancia_calculada = 0.0 # Variable para guardar los metros reales
            
            if len(puntos_gps) > 1:
                if len(puntos_gps) > 90:
                    factor = math.ceil(len(puntos_gps) / 90)
                    puntos_procesar = puntos_gps[::factor]
                    if puntos_procesar[-1] != puntos_gps[-1]:
                        puntos_procesar.append(puntos_gps[-1])
                else:
                    puntos_procesar = puntos_gps

                coords_str = ";".join([f"{p.lng},{p.lat}" for p in puntos_procesar if p.lat and p.lng])
                
                if coords_str:
                    osrm_url = f"https://router.project-osrm.org/match/v1/driving/{coords_str}?geometries=geojson&overview=full"
                    try:
                        response = requests.get(osrm_url, timeout=5)
                        osrm_data = response.json()
                        if osrm_data.get('code') == 'Ok':
                            ruta_ajustada = [[c[1], c[0]] for c in osrm_data['matchings'][0]['geometry']['coordinates']]
                            recorrido.ruta_corregida = json.dumps(ruta_ajustada)
                            
                            # 🌟 Extraemos la distancia oficial de OSRM
                            distancia_calculada = osrm_data['matchings'][0]['distance']
                        else:
                            # 🌟 Si OSRM responde pero no encuentra calles, usamos el respaldo manual
                            distancia_calculada = calcular_distancia_manual(puntos_gps)
                    except Exception as e:
                        print(f"Error OSRM en backend: {e}")
                        # 🌟 Si OSRM se cae por completo, usamos el respaldo manual
                        distancia_calculada = calcular_distancia_manual(puntos_gps)
            
            # Guardamos la distancia en la base de datos (asumiendo que tu modelo Recorrido tiene distancia_real)
            recorrido.distancia_real = distancia_calculada
            
            db.session.commit()

            # 🌟 MODIFICADO: Ahora devolvemos los datos calculados a Flutter
            return jsonify({
                "success": True, 
                "mensaje": f"Recorrido {estado_final} correctamente",
                "resultados_reales": {
                    "duracion_real": duracion_calculada,
                    "distancia_real": distancia_calculada
                }
            }), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "mensaje": f"Error interno: {str(e)}"}), 500

    # ========================================================
    # PANEL WEB (ADMIN): DETALLE Y RUTA PARA EL MAPA (REPLAY)
    # ========================================================
    @app.route('/api/admin/recorridos/<int:recorrido_id>/detalle', methods=['GET'])
    @jwt_required()
    def admin_detalle_recorrido(recorrido_id):
        from models import HistorialGPS, Alerta 
        
        try:
            recorrido = Recorrido.query.get(recorrido_id)
            if not recorrido:
                return jsonify({"success": False, "mensaje": "Recorrido no encontrado"}), 404

            puntos_gps = HistorialGPS.query.filter_by(recorrido_id=recorrido.id).order_by(HistorialGPS.timestamp.asc()).all()
            
            ruta_trazada = []
            for p in puntos_gps:
                if p.lat and p.lng: 
                    ruta_trazada.append({
                        "lat": p.lat,
                        "lng": p.lng,
                        "velocidad": p.velocidad,
                        "timestamp": p.timestamp
                    })

            limite_tiempo_fin = recorrido.fecha_fin if recorrido.fecha_fin else timestamp_actual()
            
            alertas = Alerta.query.filter(
                Alerta.vehiculo_id == recorrido.vehiculo_id,
                Alerta.timestamp >= recorrido.fecha_inicio,
                Alerta.timestamp <= limite_tiempo_fin
            ).all()

            alertas_viaje = []
            for a in alertas:
                alertas_viaje.append({
                    "id": a.id,
                    "tipo": a.tipo,
                    "descripcion": a.descripcion,
                    "lat": a.lat,
                    "lng": a.lng,
                    "timestamp": a.timestamp,
                    "atendida": a.atendida
                })

            # 1. Buscamos los datos del vehículo y del chofer vinculados a este recorrido
            vehiculo = Vehiculo.query.get(recorrido.vehiculo_id)
            chofer = Usuario.query.get(recorrido.chofer_id)

            # 2. Convertimos los valores para el frontend (si existen)
            # Convertimos metros a kilómetros (redondeado a 2 decimales)
            distancia_est_km = round(recorrido.distancia_estimada / 1000, 2) if recorrido.distancia_estimada else None
            distancia_real_km = round(recorrido.distancia_real / 1000, 2) if recorrido.distancia_real else None
            
            # Convertimos segundos a minutos (redondeado al entero más cercano)
            tiempo_est_mins = round(recorrido.duracion_estimada / 60) if recorrido.duracion_estimada else None
            tiempo_real_mins = round(recorrido.duracion_real / 60) if recorrido.duracion_real else None

            # 3. Retornamos el JSON armado para el modal
            return jsonify({
                "success": True,
                "recorrido": {
                    "id": recorrido.id,
                    "vehiculo_nombre": vehiculo.nombre if vehiculo else "Vehículo desconocido",
                    "vehiculo_placas": vehiculo.placa if vehiculo and vehiculo.placa else "Sin placas",
                    "chofer_nombre": chofer.nombre if chofer else "Sin chofer asig.",
                    "estado": recorrido.estado,
                    
                    "distancia_estimada_km": distancia_est_km,
                    "distancia_real_km": distancia_real_km,
                    
                    "tiempo_estimado_mins": tiempo_est_mins,
                    "tiempo_real_mins": tiempo_real_mins,
                    
                    "origen_nombre": recorrido.origen_nombre,
                    "origen_coordenadas": recorrido.origen_coordenadas, 
                    "destino_nombre": recorrido.destino_nombre,
                    "destino_coordenadas": recorrido.destino_coordenadas, 
                    "fecha_inicio": recorrido.fecha_inicio,
                    "fecha_fin": recorrido.fecha_fin,
                    
                    "ruta_planeada": json.loads(recorrido.ruta_planeada) if recorrido.ruta_planeada else None,
                    "ruta_corregida": json.loads(recorrido.ruta_corregida) if recorrido.ruta_corregida else None
                },
                "ruta_trazada": ruta_trazada,
                "alertas": alertas_viaje
            }), 200

        except Exception as e:
            return jsonify({"success": False, "mensaje": f"Error al cargar detalle: {str(e)}"}), 500
        
        
    # ========================================================
    # CONSULTAR RECORRIDO ACTIVO
    # ========================================================
    @app.route('/api/recorridos/activo/<int:vehiculo_id>', methods=['GET'])
    @jwt_required()
    def obtener_recorrido_activo(vehiculo_id):
        try:
            recorrido = Recorrido.query.filter_by(
                vehiculo_id=vehiculo_id,
                estado='en_curso'
            ).first()

            if recorrido:
                return jsonify({
                    "success": True,
                    "hay_recorrido": True,
                    "recorrido": {
                        "id": recorrido.id,
                        "destino_nombre": recorrido.destino_nombre,
                        "destino_coordenadas": recorrido.destino_coordenadas,
                        "ruta_planeada": json.loads(recorrido.ruta_planeada) if recorrido.ruta_planeada else None,
                        "fecha_inicio": recorrido.fecha_inicio
                    }
                }), 200
            else:
                return jsonify({"success": True, "hay_recorrido": False}), 200

        except Exception as e:
            return jsonify({"success": False, "mensaje": f"Error interno: {str(e)}"}), 500
        
    
    # ========================================================
    # HISTORIAL DE RECORRIDOS (CHOFER)
    # ========================================================
    @app.route('/api/recorridos/historial/<int:vehiculo_id>', methods=['GET'])
    @jwt_required()
    def obtener_historial_vehiculo(vehiculo_id):
        try:
            # Ordenamos por fecha_inicio descendente (el más nuevo arriba)
            recorridos = Recorrido.query.filter_by(
                vehiculo_id=vehiculo_id
            ).order_by(Recorrido.fecha_inicio.desc()).all()
            
            resultado = []
            for r in recorridos:
                resultado.append({
                    "id": r.id,
                    "origen_nombre": r.origen_nombre,
                    "destino_nombre": r.destino_nombre,
                    "estado": r.estado,
                    "fecha_inicio": r.fecha_inicio,
                    "fecha_fin": r.fecha_fin,
                    "distancia_estimada": r.distancia_estimada,
                    "duracion_real": r.duracion_real,
                    "motivo_cancelacion": r.motivo_cancelacion
                })
                
            return jsonify({"success": True, "historial": resultado}), 200
        except Exception as e:
            return jsonify({"success": False, "mensaje": f"Error al cargar historial: {str(e)}"}), 500
        
    
    # ========================================================
    # PANEL WEB (ADMIN): OBTENER RECORRIDOS PAGINADOS
    # ========================================================
    @app.route('/api/admin/recorridos', methods=['GET'])
    @jwt_required()
    def admin_obtener_recorridos_paginados():
        try:
            # Recibimos parámetros de la URL (Query Params)
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 15, type=int)
            estado = request.args.get('estado', None)
            vehiculo_id = request.args.get('vehiculo_id', None)

            # Iniciamos la consulta base
            query = Recorrido.query

            # Aplicamos filtros si el administrador los seleccionó
            if estado:
                query = query.filter_by(estado=estado)
            if vehiculo_id:
                query = query.filter_by(vehiculo_id=vehiculo_id)

            # Ordenamos del más reciente al más antiguo y paginamos
            paginacion = query.order_by(Recorrido.fecha_inicio.desc()).paginate(
                page=page, per_page=per_page, error_out=False
            )

            resultado = []
            for r in paginacion.items:
                # 1. Buscamos el vehículo y el chofer
                vehiculo = Vehiculo.query.get(r.vehiculo_id)
                chofer = Usuario.query.get(r.chofer_id) if r.chofer_id else None

                # 2. Agregamos sus nombres al diccionario
                resultado.append({
                    "id": r.id,
                    "vehiculo_id": r.vehiculo_id,
                    "vehiculo_nombre": vehiculo.nombre if vehiculo else f"Vehículo {r.vehiculo_id}", # 🌟 AQUI ENVIAMOS EL NOMBRE
                    "chofer_id": r.chofer_id,
                    "chofer_nombre": chofer.nombre if chofer else "Sin chofer asig.",              # 🌟 AQUI ENVIAMOS EL CHOFER
                    "origen_nombre": r.origen_nombre,
                    "destino_nombre": r.destino_nombre,
                    "estado": r.estado,
                    "fecha_inicio": r.fecha_inicio,
                    "fecha_fin": r.fecha_fin,
                    "distancia_estimada": r.distancia_estimada,
                    "duracion_real": r.duracion_real,
                    "motivo_cancelacion": r.motivo_cancelacion
                })

            return jsonify({
                "success": True,
                "recorridos": resultado,
                "paginacion": {
                    "total_registros": paginacion.total,
                    "paginas_totales": paginacion.pages,
                    "pagina_actual": paginacion.page,
                    "tiene_siguiente": paginacion.has_next,
                    "tiene_anterior": paginacion.has_prev
                }
            }), 200

        except Exception as e:
            return jsonify({"success": False, "mensaje": f"Error al cargar recorridos: {str(e)}"}), 500

