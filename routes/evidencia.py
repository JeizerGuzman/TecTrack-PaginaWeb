# ============================================================
# ROUTES EVIDENCIAS - TrackSecurity
# ============================================================

import os
from werkzeug.utils import secure_filename
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from config import db
from models import Evidencia
from helpers import timestamp_actual
import cloudinary, cloudinary.uploader


def registrar_evidencia_routes(app):

    # ========================================================
    # 2. OBTENER EVIDENCIAS (DUEÑO / SUPERVISOR / ADMIN)
    # ========================================================
    @app.route('/api/evidencias', methods=['GET'])
    @jwt_required()
    def obtener_evidencias():
        alerta_id = request.args.get('alerta_id')
        vehiculo_id = request.args.get('vehiculo_id')
        
        query = Evidencia.query
        
        # Filtros opcionales por si quieres cargar evidencias de una alerta o de un vehículo entero
        if alerta_id:
            query = query.filter_by(alerta_id=alerta_id)
        if vehiculo_id:
            query = query.filter_by(vehiculo_id=vehiculo_id)
            
        evidencias = query.order_by(Evidencia.timestamp.desc()).all()
        
        resultado = []
        for ev in evidencias:
            resultado.append({
                "id": ev.id,
                "vehiculo_id": ev.vehiculo_id,
                "alerta_id": ev.alerta_id,
                "url_imagen": ev.url_imagen,
                "descripcion": ev.descripcion,
                "timestamp": ev.timestamp
            })
            
        return jsonify({"success": True, "evidencias": resultado}), 200
    
    # ========================================================
    # 3. SUBIR NUEVA EVIDENCIA (SIMULADOR / ESP32-CAM)
    # ========================================================
    @app.route('/api/evidencias', methods=['POST'])
    def subir_evidencia():
        try:
            # 1. Recibir datos del formulario (Multipart)
            # 🌟 AHORA ESPERAMOS SERIE Y FOLIO EN LUGAR DE IDs FIJOS
            serie = request.form.get('serie')
            folio = request.form.get('folio')
            descripcion = request.form.get('descripcion', 'Evidencia fotográfica')
            
            # 2. Validar imagen y datos mínimos
            if 'evidencia' not in request.files:
                return jsonify({"success": False, "mensaje": "No se envió ninguna imagen"}), 400
            if not serie or not folio:
                return jsonify({"success": False, "mensaje": "Faltan datos de identificación (serie o folio)"}), 400
                
            archivo_imagen = request.files['evidencia']
            
            # 🌟 3. BUSCAR EL VEHÍCULO A PARTIR DE LA SERIE
            from models import Dispositivo, Vehiculo, Alerta # Asegura las importaciones
            
            dispositivo = Dispositivo.query.filter_by(serie=serie).first()
            if not dispositivo:
                return jsonify({"success": False, "mensaje": "Dispositivo no encontrado"}), 404
                
            vehiculo = Vehiculo.query.filter_by(dispositivo_id=dispositivo.id).first()
            if not vehiculo:
                return jsonify({"success": False, "mensaje": "Vehículo no asignado a este dispositivo"}), 404

            # 🌟 4. EL FILTRO INTELIGENTE DE 1 HORA
            ahora = timestamp_actual()
            limite_tiempo = ahora - 3600 # 3600 segundos = 1 Hora
            
            alerta_asociada = Alerta.query.filter(
                Alerta.vehiculo_id == vehiculo.id,
                Alerta.folio == int(folio),
                Alerta.timestamp >= limite_tiempo
            ).order_by(Alerta.timestamp.desc()).first()

            # Si encontramos la alerta en el rango de tiempo, usamos su ID. Si no, queda huérfana (None)
            alerta_id = alerta_asociada.id if alerta_asociada else None

            # 5. Configurar entorno y subir a Cloudinary
            entorno = os.environ.get('FLASK_ENV', 'development')
            carpeta_base = "tectrack_prod" if entorno == "production" else "tectrack_local"
            ruta_carpeta = f"{carpeta_base}/vehiculo_{vehiculo.id}"

            respuesta_nube = cloudinary.uploader.upload(
                archivo_imagen,
                folder=ruta_carpeta,
                transformation=[
                    {'width': 1000, 'crop': 'limit'},
                    {'quality': 'auto'},             
                    {'fetch_format': 'auto'}         
                ]
            )
            
            url_segura = respuesta_nube.get('secure_url')

            # 6. Guardar el registro en la base de datos
            nueva_evidencia = Evidencia(
                alerta_id=alerta_id, # 🌟 Se vinculará mágicamente a la alerta correcta
                vehiculo_id=vehiculo.id,
                descripcion=descripcion,
                url_imagen=url_segura, 
                timestamp=ahora 
            )
            db.session.add(nueva_evidencia)
            db.session.commit()

            return jsonify({
                "success": True, 
                "mensaje": "Evidencia procesada con Filtro de Tiempo exitosamente", 
                "url": url_segura,
                "alerta_vinculada": alerta_id is not None
            }), 201

        except Exception as e:
            print(f"❌ Error al procesar evidencia: {e}")
            db.session.rollback()
            return jsonify({"success": False, "mensaje": "Error interno del servidor"}), 500