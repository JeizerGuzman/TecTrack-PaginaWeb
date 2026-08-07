import random
import re
from flask import jsonify, request
from flask_jwt_extended import jwt_required
from config import db
from decorators import rol_requerido
from models import Dispositivo, Empresa, Vehiculo

# ============================================================
# FUNCIONES AUXILIARES
# ============================================================
def generar_siguiente_serie_dispositivo():
    dispositivos = Dispositivo.query.with_entities(Dispositivo.serie).all()
    mayor_numero = 0
    for item in dispositivos:
        serie = item[0] if isinstance(item, tuple) else item.serie
        if not serie: continue
        match = re.match(r"^TS-(\d{6})$", serie.strip())
        if match: mayor_numero = max(mayor_numero, int(match.group(1)))
    return f"TS-{mayor_numero + 1:06d}"

def generar_pin_activacion(longitud=6):
    minimo = 10 ** (longitud - 1)
    maximo = (10 ** longitud) - 1
    return str(random.randint(minimo, maximo))

def serializar_dispositivo_admin(dispositivo):  
    empresa = db.session.get(Empresa, dispositivo.empresa_id) if dispositivo.empresa_id else None
    vehiculo = Vehiculo.query.filter_by(dispositivo_id=dispositivo.id).first()
    return {
        "id": dispositivo.id, "serie": dispositivo.serie, "pin_activacion": dispositivo.pin_activacion,
        "imei": dispositivo.imei, "modelo": dispositivo.modelo, "firmware": dispositivo.firmware,
        "estado": dispositivo.estado, "empresa_id": dispositivo.empresa_id,
        "empresa_nombre": empresa.nombre if empresa else None,
        "vehiculo_id": vehiculo.id if vehiculo else None,
        "vehiculo_nombre": vehiculo.nombre if vehiculo else None,
        "vehiculo_identificador": vehiculo.identificador if vehiculo else None,
        "ultima_conexion": dispositivo.ultima_conexion, "fecha_instalacion": dispositivo.fecha_instalacion,
        "fecha_creacion": dispositivo.fecha_creacion,
    }

# ============================================================
# RUTAS DE DISPOSITIVOS
# ============================================================
def registrar_admin_dispositivos_routes(app):
    @app.get("/api/admin/dispositivos")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_dispositivos():
        dispositivos = Dispositivo.query.order_by(Dispositivo.id.desc()).all()
        return jsonify({"ok": True, "dispositivos": [serializar_dispositivo_admin(d) for d in dispositivos]}), 200

    @app.get("/api/admin/dispositivos/generar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_generar_datos_dispositivo():
        return jsonify({
            "ok": True, "serie": generar_siguiente_serie_dispositivo(), "pin_activacion": generar_pin_activacion(6)
        }), 200

    @app.post("/api/admin/dispositivos")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_dispositivo():
        data = request.get_json(silent=True) or {}
        serie = data.get("serie", "").strip().upper()
        pin_activacion = str(data.get("pin_activacion", "")).strip()
        imei = data.get("imei", "").strip()
        modelo = data.get("modelo", "").strip()
        firmware = data.get("firmware", "").strip()

        if not serie: serie = generar_siguiente_serie_dispositivo()
        if not pin_activacion: pin_activacion = generar_pin_activacion(6)

        if not re.match(r"^TS-\d{6}$", serie): return jsonify({"error": "La serie debe tener el formato TS-000001"}), 400
        if not pin_activacion.isdigit() or len(pin_activacion) not in [4, 6]: return jsonify({"error": "El PIN debe ser de 4 o 6 dígitos"}), 400
        if Dispositivo.query.filter_by(serie=serie).first(): return jsonify({"error": "Ya existe un dispositivo con esa serie"}), 409
        if imei and Dispositivo.query.filter_by(imei=imei).first(): return jsonify({"error": "Ya existe un dispositivo con ese IMEI"}), 409

        try:
            dispositivo = Dispositivo(
                serie=serie, pin_activacion=pin_activacion, imei=imei or None,
                modelo=modelo or None, firmware=firmware or None, estado="disponible"
            )
            db.session.add(dispositivo)
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Dispositivo creado", "dispositivo": serializar_dispositivo_admin(dispositivo)}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo crear el dispositivo"}), 500

    @app.get("/api/admin/dispositivos/<int:dispositivo_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_dispositivo(dispositivo_id):
        dispositivo = db.session.get(Dispositivo, dispositivo_id)
        if not dispositivo: return jsonify({"error": "Dispositivo no encontrado"}), 404
        return jsonify({"ok": True, "dispositivo": serializar_dispositivo_admin(dispositivo)}), 200

    @app.put("/api/admin/dispositivos/<int:dispositivo_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_dispositivo(dispositivo_id):
        dispositivo = db.session.get(Dispositivo, dispositivo_id)
        if not dispositivo: return jsonify({"error": "Dispositivo no encontrado"}), 404

        data = request.get_json(silent=True) or {}
        imei = data.get("imei", "").strip()
        modelo = data.get("modelo", "").strip()
        firmware = data.get("firmware", "").strip()
        pin_activacion = str(data.get("pin_activacion", "")).strip()

        if pin_activacion and (not pin_activacion.isdigit() or len(pin_activacion) not in [4, 6]):
            return jsonify({"error": "El PIN debe ser numérico de 4 o 6 dígitos"}), 400
        if imei and Dispositivo.query.filter(Dispositivo.imei == imei, Dispositivo.id != dispositivo.id).first():
            return jsonify({"error": "Ya existe otro dispositivo con ese IMEI"}), 409

        try:
            dispositivo.imei = imei or None
            dispositivo.modelo = modelo or None
            dispositivo.firmware = firmware or None
            if pin_activacion: dispositivo.pin_activacion = pin_activacion
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Dispositivo actualizado", "dispositivo": serializar_dispositivo_admin(dispositivo)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo actualizar el dispositivo"}), 500

    @app.put("/api/admin/dispositivos/<int:dispositivo_id>/estado")
    @jwt_required()
    @rol_requerido("admin")
    def admin_cambiar_estado_dispositivo(dispositivo_id):
        dispositivo = db.session.get(Dispositivo, dispositivo_id)
        if not dispositivo: return jsonify({"error": "Dispositivo no encontrado"}), 404

        data = request.get_json(silent=True) or {}
        nuevo_estado = data.get("estado", "").strip().lower()
        if nuevo_estado not in ["disponible", "activo", "instalado", "mantenimiento", "desactivado"]:
            return jsonify({"error": "Estado no válido"}), 400

        vehiculo_vinculado = Vehiculo.query.filter_by(dispositivo_id=dispositivo.id).first()
        if vehiculo_vinculado and nuevo_estado == "disponible":
            return jsonify({"error": "No puedes marcar disponible un dispositivo vinculado"}), 409

        try:
            dispositivo.estado = nuevo_estado
            if nuevo_estado == "disponible":
                dispositivo.empresa_id = None
                dispositivo.fecha_instalacion = None
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Estado actualizado", "dispositivo": serializar_dispositivo_admin(dispositivo)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo cambiar el estado"}), 500