# ============================================================
# ROUTES DASHBOARD - TrackSecurity
# ============================================================
#
# Endpoints de resumen general.
# ============================================================

from flask import jsonify
from flask_jwt_extended import jwt_required

from models import Vehiculo
from helpers import obtener_usuario_actual
from serializers import serializar_vehiculo


# ------------------------------------------------------------
# Registra rutas del dashboard.
# ------------------------------------------------------------
def registrar_dashboard_routes(app):

    # Devuelve vehículos visibles según el rol del usuario.
    #
    # Se usa actualmente en:
    # - static/js/dueno/dashboard.js
    #
    # También puede usarse después en:
    # - app móvil
    @app.route("/api/estado", methods=["GET"])
    @jwt_required()
    def api_estado():
        usuario = obtener_usuario_actual()

        if not usuario:
            return jsonify({"error": "usuario no encontrado"}), 401

        if usuario.tipo in ("admin", "dueno", "supervisor"):
            vehiculos = Vehiculo.query.filter_by(
                empresa_id=usuario.empresa_id,
                activo=True
            ).all()

            return jsonify({
                "tipo_usuario": usuario.tipo,
                "vehiculos": [serializar_vehiculo(v) for v in vehiculos]
            }), 200

        if usuario.tipo == "chofer":
            vehiculo = Vehiculo.query.filter_by(
                chofer_id=usuario.id,
                activo=True
            ).first()

            if not vehiculo:
                return jsonify({
                    "tipo_usuario": usuario.tipo,
                    "vehiculos": [],
                    "mensaje": "no tienes un vehículo asignado"
                }), 200

            return jsonify({
                "tipo_usuario": usuario.tipo,
                "vehiculos": [serializar_vehiculo(vehiculo)]
            }), 200

        if usuario.tipo == "tecnico":
            return jsonify({
                "tipo_usuario": usuario.tipo,
                "mensaje": (
                    "modo técnico activo, usa /api/dispositivos "
                    "para ver dispositivos disponibles"
                )
            }), 200

        return jsonify({"error": "rol no reconocido"}), 400
