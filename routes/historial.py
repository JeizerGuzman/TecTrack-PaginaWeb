# ============================================================
# ROUTES HISTORIAL - TrackSecurity
# ============================================================
#
# Endpoints para historial GPS y eventos.
# ============================================================

from flask import jsonify
from flask_jwt_extended import jwt_required

from config import db
from models import Vehiculo, HistorialGPS, Evento
from helpers import obtener_usuario_actual


# ------------------------------------------------------------
# Registra rutas de historial.
# ------------------------------------------------------------
def registrar_historial_routes(app):

    # Devuelve historial GPS y eventos de un vehículo.
    #
    # Se usa actualmente en:
    # - static/js/dueno/historial.js
    #
    # También puede usarse después para:
    # - reportes
    # - exportar recorridos
    # - app móvil
    @app.route("/api/historial/<int:vehiculo_id>", methods=["GET"])
    @jwt_required()
    def historial_vehiculo(vehiculo_id):
        usuario = obtener_usuario_actual()
        vehiculo = db.session.get(Vehiculo, vehiculo_id)

        if not vehiculo:
            return jsonify({"error": "vehículo no encontrado"}), 404

        if usuario.tipo in ("admin", "dueno", "supervisor"):
            if vehiculo.empresa_id != usuario.empresa_id:
                return jsonify({"error": "acceso denegado"}), 403

        elif usuario.tipo == "chofer":
            if vehiculo.chofer_id != usuario.id:
                return jsonify({"error": "acceso denegado"}), 403

        else:
            return jsonify({
                "error": "tu rol no tiene acceso a esta información"
            }), 403

        puntos_gps = HistorialGPS.query.filter_by(
            vehiculo_id=vehiculo_id
        ).order_by(HistorialGPS.timestamp.asc()).limit(500).all()

        eventos = Evento.query.filter_by(
            vehiculo_id=vehiculo_id
        ).order_by(Evento.timestamp.desc()).limit(100).all()

        return jsonify({
            "vehiculo": vehiculo.nombre,
            "puntos_gps": [
                {
                    "lat": p.lat,
                    "lng": p.lng,
                    "velocidad": p.velocidad,
                    "timestamp": p.timestamp,
                }
                for p in puntos_gps
            ],
            "eventos": [
                {
                    "id": e.id,
                    "tipo": e.tipo,
                    "descripcion": e.descripcion,
                    "lat": e.lat,
                    "lng": e.lng,
                    "timestamp": e.timestamp,
                }
                for e in eventos
            ]
        }), 200
