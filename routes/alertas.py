# ============================================================
# ROUTES ALERTAS - TrackSecurity
# ============================================================
#
# Endpoints para listar y atender alertas.
# ============================================================

from flask import jsonify
from flask_jwt_extended import jwt_required

from config import db
from models import Vehiculo, Alerta
from helpers import obtener_usuario_actual, registrar_evento, timestamp_actual
from serializers import serializar_alerta


# ------------------------------------------------------------
# Registra rutas de alertas.
# ------------------------------------------------------------
def registrar_alertas_routes(app):

    # Lista alertas visibles según el rol del usuario.
    #
    # Se usa actualmente en:
    # - static/js/dueno/alertas/index.js
    @app.route("/api/alertas", methods=["GET"])
    @jwt_required()
    def listar_alertas():
        usuario = obtener_usuario_actual()

        if usuario.tipo in ("admin", "dueno", "supervisor"):
            vehiculos_ids = [
                v.id for v in Vehiculo.query.filter_by(
                    empresa_id=usuario.empresa_id
                ).all()
            ]

        elif usuario.tipo == "chofer":
            vehiculos_ids = [
                v.id for v in Vehiculo.query.filter_by(
                    chofer_id=usuario.id
                ).all()
            ]

        else:
            return jsonify({
                "error": "tu rol no tiene acceso a esta información"
            }), 403

        alertas = Alerta.query.filter(
            Alerta.vehiculo_id.in_(vehiculos_ids)
        ).order_by(Alerta.timestamp.desc()).limit(100).all()

        return jsonify({
            "alertas": [serializar_alerta(a) for a in alertas]
        }), 200

    # Marca una alerta como atendida.
    #
    # Se usa actualmente en:
    # - static/js/dueno/alertas/index.js
    #
    # También podría usarse después en:
    # - app móvil de supervisor
    @app.route("/api/alertas/<int:alerta_id>/atender", methods=["PUT"])
    @jwt_required()
    def atender_alerta(alerta_id):
        usuario = obtener_usuario_actual()
        alerta = db.session.get(Alerta, alerta_id)

        if not alerta:
            return jsonify({"error": "alerta no encontrada"}), 404

        vehiculo = db.session.get(Vehiculo, alerta.vehiculo_id)

        if not vehiculo:
            return jsonify({"error": "vehículo no encontrado"}), 404

        if usuario.tipo != "admin" and vehiculo.empresa_id != usuario.empresa_id:
            return jsonify({
                "error": "no tienes permiso para atender esta alerta"
            }), 403

        try:
            alerta.atendida = True
            alerta.atendida_por = usuario.id
            alerta.fecha_atencion = timestamp_actual()

            registrar_evento(
                vehiculo_id=vehiculo.id,
                tipo="alerta_atendida",
                descripcion=(
                    f"{usuario.nombre} atendió la alerta {alerta.tipo} "
                    f"del vehículo {vehiculo.nombre}"
                ),
                lat=alerta.lat,
                lng=alerta.lng,
            )

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "alerta atendida correctamente",
                "alerta": serializar_alerta(alerta)
            }), 200

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al atender alerta: {e}")
            return jsonify({"error": "error interno al atender alerta"}), 500
