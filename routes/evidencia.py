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
            alerta_id = request.form.get('alerta_id')
            vehiculo_id = request.form.get('vehiculo_id')
            descripcion = request.form.get('descripcion', 'Evidencia fotográfica')
            
            # 2. Validar que la imagen venga en la petición
            if 'evidencia' not in request.files:
                return jsonify({"success": False, "mensaje": "No se envió ninguna imagen"}), 400
                
            archivo_imagen = request.files['evidencia']

            # 3. Leer el entorno para separar las fotos de prueba de las de producción
            entorno = os.environ.get('FLASK_ENV', 'development')
            carpeta_base = "tectrack_prod" if entorno == "production" else "tectrack_local"
            
            # Creamos una subcarpeta para mantener organizado cada vehículo
            ruta_carpeta = f"{carpeta_base}/vehiculo_{vehiculo_id}"

            # 4. Subir directamente a Cloudinary desde la memoria
            respuesta_nube = cloudinary.uploader.upload(
                archivo_imagen,
                folder=ruta_carpeta,
                transformation=[
                    {'width': 1000, 'crop': 'limit'}, # Evita fotos gigantescas (max 1000px)
                    {'quality': 'auto'},             # Cloudinary decide la mejor compresión sin que se vea borroso
                    {'fetch_format': 'auto'}         # Convierte a WebP (ultra ligero) para la página web
                ]
            )
            
            # 5. Extraer la URL segura que nos genera Cloudinary
            url_segura = respuesta_nube.get('secure_url')

            # 6. Guardar el registro en la base de datos
            # Asegúrate de usar la función que genera tu timestamp, ej. timestamp_actual()
            nueva_evidencia = Evidencia(
                alerta_id=alerta_id,
                vehiculo_id=vehiculo_id,
                descripcion=descripcion,
                url_imagen=url_segura, 
                timestamp=timestamp_actual() 
            )
            db.session.add(nueva_evidencia)
            db.session.commit()

            return jsonify({
                "success": True, 
                "mensaje": "Evidencia subida a la nube exitosamente", 
                "url": url_segura
            }), 201

        except Exception as e:
            print(f"❌ Error al subir imagen a Cloudinary: {e}")
            db.session.rollback()
            return jsonify({"success": False, "mensaje": "Error interno del servidor"}), 500