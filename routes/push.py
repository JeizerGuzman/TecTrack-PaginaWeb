# ============================================================
# ROUTES PUSH - TrackSecurity
# ============================================================
#
# Endpoint para guardar suscripciones push.
# ============================================================

from flask import request, jsonify
from flask_jwt_extended import jwt_required

from config import db
from models import PushSubscripcion
from helpers import obtener_usuario_actual


# ------------------------------------------------------------
# Registra rutas de notificaciones push.
# ------------------------------------------------------------
def registrar_push_routes(app):

    # Guarda o actualiza suscripción push del usuario.
    #
    # Se usa actualmente en:
    # - dashboard web si activas notificaciones del navegador
    #
    # También puede usarse después en:
    # - app móvil
    @app.route("/api/push/subscribe", methods=["POST"])
    @jwt_required()
    def push_subscribe():
        usuario = obtener_usuario_actual()
        data = request.get_json(silent=True) or {}

        if not all(k in data for k in ("endpoint", "p256dh", "auth")):
            return jsonify({
                "error": "endpoint, p256dh y auth son requeridos"
            }), 400

        suscripcion_existente = PushSubscripcion.query.filter_by(
            endpoint=data["endpoint"]
        ).first()

        if suscripcion_existente:
            suscripcion_existente.p256dh = data["p256dh"]
            suscripcion_existente.auth = data["auth"]
            suscripcion_existente.usuario_id = usuario.id
        else:
            nueva_suscripcion = PushSubscripcion(
                usuario_id=usuario.id,
                endpoint=data["endpoint"],
                p256dh=data["p256dh"],
                auth=data["auth"],
            )
            db.session.add(nueva_suscripcion)

        try:
            db.session.commit()
            return jsonify({
                "ok": True,
                "mensaje": "suscripción push guardada"
            }), 201

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al guardar suscripción push: {e}")
            return jsonify({"error": "error interno del servidor"}), 500
