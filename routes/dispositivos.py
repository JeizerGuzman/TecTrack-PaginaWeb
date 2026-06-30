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
from helpers import timestamp_actual, registrar_evento


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

    # Vincula un dispositivo físico a un vehículo.
    #
    # Se usa actualmente en:
    # - modo técnico de instalación
    #
    # También puede usarse después en:
    # - app móvil modo técnico por Bluetooth/BLE
    @app.route("/api/dispositivos/vincular", methods=["POST"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def vincular_dispositivo():
        data = request.get_json(silent=True) or {}

        if not all(k in data for k in ("serie", "pin_activacion", "vehiculo_id")):
            return jsonify({
                "error": "serie, pin_activacion y vehiculo_id son requeridos"
            }), 400

        print(
            f"🔧 Iniciando vinculación -> serie: {data['serie']} | "
            f"vehiculo_id: {data['vehiculo_id']}"
        )

        dispositivo = Dispositivo.query.filter_by(serie=data["serie"]).first()

        if not dispositivo:
            print("❌ Vinculación fallida: dispositivo no encontrado")
            return jsonify({"error": "dispositivo no encontrado"}), 404

        if dispositivo.pin_activacion != str(data["pin_activacion"]):
            print("❌ Vinculación fallida: PIN incorrecto")
            return jsonify({"error": "PIN de activación incorrecto"}), 401

        vehiculo = db.session.get(Vehiculo, data["vehiculo_id"])

        if not vehiculo:
            print("❌ Vinculación fallida: vehículo no encontrado")
            return jsonify({"error": "vehículo no encontrado"}), 404

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
                timestamp=timestamp_actual(),
            )
            db.session.add(servicio)

            registrar_evento(
                vehiculo_id=vehiculo.id,
                tipo="dispositivo_vinculado",
                descripcion=(
                    f"Se vinculó el dispositivo {dispositivo.serie} "
                    f"al vehículo {vehiculo.nombre}"
                ),
            )

            db.session.commit()

            print(
                f"✅ Dispositivo {dispositivo.serie} vinculado "
                f"correctamente a {vehiculo.nombre}"
            )

            return jsonify({
                "ok": True,
                "mensaje": "dispositivo vinculado correctamente",
                "dispositivo_serie": dispositivo.serie,
                "vehiculo": vehiculo.nombre,
            }), 200

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al vincular dispositivo: {e}")
            return jsonify({"error": "error interno del servidor"}), 500
