# ============================================================
# ROUTES CONFIGURACIÓN - TrackSecurity
# ============================================================
#
# Endpoints para configuración del dueño/admin.
# ============================================================

from flask import request, jsonify
from flask_jwt_extended import jwt_required

from config import db
from models import Empresa, Plan, Suscripcion
from decorators import rol_requerido
from helpers import obtener_usuario_actual, verificar_password, hashear_password


# ------------------------------------------------------------
# Registra rutas de configuración.
# ------------------------------------------------------------
def registrar_configuracion_routes(app):

    # Obtiene datos de configuración del dueño.
    #
    # Se usa actualmente en:
    # - static/js/dueno/configuracion/index.js
    @app.route("/api/dueno/configuracion", methods=["GET"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def obtener_configuracion_dueno():
        usuario = obtener_usuario_actual()

        if not usuario:
            return jsonify({"error": "usuario no válido"}), 401

        empresa = db.session.get(Empresa, usuario.empresa_id) if usuario.empresa_id else None

        suscripcion = None
        if usuario.empresa_id:
            suscripcion = Suscripcion.query.filter_by(
                empresa_id=usuario.empresa_id
            ).order_by(Suscripcion.id.desc()).first()

        plan = db.session.get(Plan, suscripcion.plan_id) if suscripcion else None

        return jsonify({
            "usuario": {
                "id": usuario.id,
                "nombre": usuario.nombre,
                "correo": usuario.correo,
                "tipo": usuario.tipo,
                "telefono": getattr(usuario, "telefono", None),
                "activo": getattr(usuario, "activo", True),
            },
            "empresa": {
                "id": empresa.id if empresa else None,
                "nombre": getattr(empresa, "nombre", "Empresa no disponible") if empresa else "Empresa no disponible",
                "telefono": getattr(empresa, "telefono", None) if empresa else None,
                "correo": getattr(empresa, "correo", None) if empresa else None,
                "direccion": getattr(empresa, "direccion", None) if empresa else None,
            },
            "suscripcion": {
                "id": suscripcion.id if suscripcion else None,
                "estado": suscripcion.estado if suscripcion else "sin suscripción",
                "cantidad_vehiculos": suscripcion.cantidad_vehiculos if suscripcion else 0,
                "monto_mensual": suscripcion.monto_mensual if suscripcion else 0,
                "fecha_inicio": suscripcion.fecha_inicio if suscripcion else None,
                "fecha_fin": suscripcion.fecha_fin if suscripcion else None,
            },
            "plan": {
                "id": plan.id if plan else None,
                "nombre": getattr(plan, "nombre", "Plan no disponible") if plan else "Plan no disponible",
                "descripcion": getattr(plan, "descripcion", None) if plan else None,
            }
        }), 200

    # Actualiza datos del perfil del dueño/admin.
    #
    # Se usa actualmente en:
    # - static/js/dueno/configuracion/editar.js
    @app.route("/api/dueno/perfil", methods=["PUT"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def actualizar_perfil_dueno():
        usuario = obtener_usuario_actual()
        data = request.get_json(silent=True) or {}

        nombre = data.get("nombre", "").strip()
        telefono = data.get("telefono", "").strip()

        if not nombre:
            return jsonify({"error": "el nombre es requerido"}), 400

        try:
            usuario.nombre = nombre
            usuario.telefono = telefono

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "perfil actualizado correctamente",
                "usuario": {
                    "id": usuario.id,
                    "nombre": usuario.nombre,
                    "correo": usuario.correo,
                    "telefono": usuario.telefono,
                    "tipo": usuario.tipo,
                }
            }), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500

    # Cambia la contraseña del dueño/admin actual.
    #
    # Se usa actualmente en:
    # - configuración de cuenta
    @app.route("/api/dueno/password", methods=["PUT"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def cambiar_password_dueno():
        usuario = obtener_usuario_actual()
        data = request.get_json(silent=True) or {}

        password_actual = data.get("password_actual", "").strip()
        password_nueva = data.get("password_nueva", "").strip()

        if not password_actual or not password_nueva:
            return jsonify({
                "error": "contraseña actual y nueva contraseña son requeridas"
            }), 400

        if len(password_nueva) < 6:
            return jsonify({
                "error": "la nueva contraseña debe tener al menos 6 caracteres"
            }), 400

        try:
            if not verificar_password(password_actual, usuario.password or ""):
                return jsonify({"error": "la contraseña actual no es correcta"}), 401

            usuario.password = hashear_password(password_nueva)

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "contraseña actualizada correctamente"
            }), 200

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error cambiando contraseña: {e}")
            return jsonify({"error": str(e)}), 500

    # Actualiza datos de la empresa.
    #
    # Se usa actualmente en:
    # - configuración de empresa
    @app.route("/api/dueno/empresa", methods=["PUT"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def actualizar_empresa_dueno():
        usuario = obtener_usuario_actual()
        empresa = db.session.get(Empresa, usuario.empresa_id)

        if not empresa:
            return jsonify({"error": "empresa no encontrada"}), 404

        data = request.get_json(silent=True) or {}

        empresa.nombre = data.get("nombre", "").strip()
        empresa.correo = data.get("correo", "").strip().lower()
        empresa.telefono = data.get("telefono", "").strip()
        empresa.direccion = data.get("direccion", "").strip()

        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "empresa actualizada correctamente"
        }), 200
