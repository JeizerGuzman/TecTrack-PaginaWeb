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

# Configuración de la carpeta destino y extensiones válidas
UPLOAD_FOLDER = 'static/uploads/evidencias'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def registrar_evidencia_routes(app):

    # Aseguramos que la carpeta exista en el sistema al arrancar la app
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    # ========================================================
    # 1. SUBIR EVIDENCIA FOTOGRÁFICA (APP MÓVIL / ESP32)
    # ========================================================
    @app.route('/api/alertas/<int:alerta_id>/evidencia', methods=['POST'])
    # @jwt_required()  # <-- Descomenta si obligarás al ESP32 o App a usar token JWT
    def subir_evidencia(alerta_id):
        # 1. Validar si viene la foto en la petición
        if 'foto' not in request.files:
            return jsonify({"success": False, "mensaje": "No se encontró el archivo de imagen"}), 400
        
        file = request.files['foto']
        
        if file.filename == '':
            return jsonify({"success": False, "mensaje": "Archivo vacío"}), 400
            
        if file and allowed_file(file.filename):
            # Obtener datos de texto enviados junto con el archivo (Multipart-form)
            vehiculo_id = request.form.get('vehiculo_id')
            descripcion = request.form.get('descripcion', 'Evidencia fotográfica capturada')
            
            if not vehiculo_id:
                return jsonify({"success": False, "mensaje": "El vehiculo_id es requerido"}), 400

            # 2. Generar nombre seguro y único
            filename = secure_filename(file.filename)
            nombre_unico = f"alerta_{alerta_id}_{timestamp_actual()}_{filename}"
            filepath = os.path.join(UPLOAD_FOLDER, nombre_unico)
            
            try:
                # 3. Guardar archivo físicamente en el servidor (Debian)
                file.save(filepath)
                
                # 4. Generar URL relativa (Flask la sirve directo desde la carpeta static)
                url_publica = f"/{filepath}" 
                
                # 5. Guardar el registro en la base de datos
                nueva_evidencia = Evidencia(
                    vehiculo_id=vehiculo_id,
                    alerta_id=alerta_id,
                    url_imagen=url_publica,
                    descripcion=descripcion
                )
                
                db.session.add(nueva_evidencia)
                db.session.commit()
                
                return jsonify({
                    "success": True, 
                    "mensaje": "Evidencia guardada correctamente", 
                    "evidencia_id": nueva_evidencia.id,
                    "url": url_publica
                }), 201

            except Exception as e:
                db.session.rollback()
                return jsonify({"success": False, "mensaje": f"Error interno al guardar: {str(e)}"}), 500
                
        return jsonify({"success": False, "mensaje": "Formato de imagen no permitido (.png, .jpg, .jpeg)"}), 400


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