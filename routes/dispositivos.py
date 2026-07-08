# ============================================================
# ROUTES DISPOSITIVOS - TrackSecurity
# ============================================================
#
# Endpoints usados por técnico/admin para dispositivos.
# ============================================================

from flask import request, jsonify
from flask_jwt_extended import jwt_required

from config import db
from models import Dispositivo, Vehiculo, Servicio
from decorators import rol_requerido
from helpers import obtener_usuario_actual, timestamp_actual, registrar_evento
from serializers import serializar_dispositivo, serializar_vehiculo_tecnico


# ------------------------------------------------------------
# Registra rutas de dispositivos.
# ------------------------------------------------------------
def registrar_dispositivos_routes(app):

    # Lista dispositivos disponibles o registrados.
    #
    # Se usa actualmente en:
    # - modo técnico
    #
    # También puede usarse después en:
    # - panel de inventario de dispositivos
    @app.route("/api/dispositivos", methods=["GET"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def listar_dispositivos():
        dispositivos = Dispositivo.query.all()

        return jsonify({
            "dispositivos": [
                {
                    "id": d.id,
                    "serie": d.serie,
                    "imei": d.imei,
                    "modelo": d.modelo,
                    "firmware": d.firmware,
                    "estado": d.estado,
                    "empresa_id": d.empresa_id,
                    "ultima_conexion": d.ultima_conexion,
                    "fecha_instalacion": d.fecha_instalacion,
                }
                for d in dispositivos
            ]
        }), 200

    # --------------------------------------------------------
    # Vincula un dispositivo disponible a un vehículo.
    #
    # Se usa en:
    # - app móvil técnico
    # - instalación nueva de dispositivo
    #
    # No permite vincular si el vehículo ya tiene dispositivo.
    # Para eso se usa /api/dispositivos/reemplazar.
    # --------------------------------------------------------
    @app.route("/api/dispositivos/vincular", methods=["POST"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def vincular_dispositivo():
        usuario = obtener_usuario_actual()
        data = request.get_json(silent=True) or {}

        serie = data.get("serie", "").strip()
        pin_activacion = str(data.get("pin_activacion", "")).strip()
        vehiculo_id = data.get("vehiculo_id")

        if not serie or not pin_activacion or not vehiculo_id:
            return jsonify({
                "error": "serie, pin_activacion y vehiculo_id son requeridos"
            }), 400

        dispositivo = Dispositivo.query.filter_by(serie=serie).first()

        if not dispositivo:
            return jsonify({"error": "dispositivo no encontrado"}), 404

        if str(dispositivo.pin_activacion).strip() != pin_activacion:
            return jsonify({"error": "PIN de activación incorrecto"}), 401

        vehiculo = db.session.get(Vehiculo, int(vehiculo_id))

        if not vehiculo:
            return jsonify({"error": "vehículo no encontrado"}), 404

        if not vehiculo.activo:
            return jsonify({"error": "el vehículo no está activo"}), 400

        if vehiculo.dispositivo_id:
            dispositivo_actual = db.session.get(
                Dispositivo,
                vehiculo.dispositivo_id
            )

            return jsonify({
                "error": "el vehículo ya tiene un dispositivo vinculado",
                "requiere_cambio": True,
                "dispositivo_actual": (
                    {
                        "id": dispositivo_actual.id,
                        "serie": dispositivo_actual.serie
                    }
                    if dispositivo_actual else None
                )
            }), 409

        if dispositivo.estado not in ["disponible"]:
            return jsonify({
                "error": "el dispositivo no está disponible para instalación"
            }), 409
            
        vehiculo_con_dispositivo = Vehiculo.query.filter_by(
            dispositivo_id=dispositivo.id
        ).first()

        if vehiculo_con_dispositivo:
            return jsonify({
                "error": "el dispositivo ya está vinculado a otro vehículo"
            }), 409

        try:
            vehiculo.dispositivo_id = dispositivo.id

            dispositivo.empresa_id = vehiculo.empresa_id
            dispositivo.estado = "activo"
            dispositivo.fecha_instalacion = timestamp_actual()

            servicio = Servicio(
                empresa_id=vehiculo.empresa_id,
                vehiculo_id=vehiculo.id,
                dispositivo_id=dispositivo.id,
                tipo="instalacion",
                descripcion=(
                    f"Instalación del dispositivo {dispositivo.serie} "
                    f"en {vehiculo.nombre}"
                ),
                estado="realizado",
                timestamp=timestamp_actual()
            )

            db.session.add(servicio)

            registrar_evento(
                vehiculo_id=vehiculo.id,
                tipo="dispositivo_vinculado",
                descripcion=(
                    f"{usuario.nombre} vinculó el dispositivo "
                    f"{dispositivo.serie} al vehículo {vehiculo.nombre}"
                )
            )

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "dispositivo vinculado correctamente",
                "vehiculo": serializar_vehiculo_tecnico(vehiculo),
                "dispositivo": serializar_dispositivo(dispositivo)
            }), 200

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al vincular dispositivo: {e}")

            return jsonify({
                "error": "error interno al vincular dispositivo"
            }), 500