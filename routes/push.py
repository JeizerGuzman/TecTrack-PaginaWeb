# ============================================================
# ROUTES PUSH - TrackSecurity
# ============================================================
#
# Endpoint para guardar suscripciones push (Web y Móvil).
# ============================================================

from flask import request, jsonify
from flask_jwt_extended import jwt_required

from config import db
# 🌟 ASEGÚRATE DE IMPORTAR TU NUEVA TABLA FCMToken AQUÍ
from models import PushSubscripcion, FCMToken 
from helpers import obtener_usuario_actual


# ------------------------------------------------------------
# Registra rutas de notificaciones push.
# ------------------------------------------------------------
def registrar_push_routes(app):

    # ========================================================
    # 1. RUTA PARA NOTIFICACIONES WEB (Navegador)
    # ========================================================
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
                "mensaje": "Suscripción push web guardada"
            }), 201

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al guardar suscripción push web: {e}")
            return jsonify({"error": "error interno del servidor"}), 500


    # ========================================================
    # 2. 🌟 NUEVA RUTA PARA NOTIFICACIONES MÓVILES (FCM Firebase)
    # ========================================================
    @app.route("/api/push/mobile-token", methods=["POST"])
    @jwt_required()
    def mobile_token_subscribe():
        usuario = obtener_usuario_actual()
        data = request.get_json(silent=True) or {}

        # Obtenemos el token largo que nos mandará Flutter
        fcm_token = data.get("fcm_token")

        if not fcm_token:
            return jsonify({
                "error": "El campo fcm_token es requerido"
            }), 400

        # Buscamos si ese token exacto del celular ya existe en la base de datos
        token_existente = FCMToken.query.filter_by(token=fcm_token).first()

        if token_existente:
            # Si ya existe, nos aseguramos de que le pertenezca a quien inició sesión.
            # (Útil por si dos usuarios distintos inician sesión en el mismo teléfono).
            token_existente.usuario_id = usuario.id
        else:
            # Si es la primera vez que vemos este celular, lo guardamos.
            nuevo_token = FCMToken(
                usuario_id=usuario.id,
                token=fcm_token
            )
            db.session.add(nuevo_token)

        try:
            db.session.commit()
            return jsonify({
                "ok": True,
                "mensaje": "Token de Firebase guardado correctamente"
            }), 201

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al guardar token FCM: {e}")
            return jsonify({"error": "error interno del servidor"}), 500