# ============================================================
# ROUTES ADMIN - ALERTAS
# TrackSecurity
# ============================================================
#
# Endpoints exclusivos para el administrador global.
#
# Mantiene intactas las rutas existentes de routes/alertas.py,
# que siguen siendo usadas por dueño, supervisor y otros roles.
#
# Estados reales de una alerta:
# - atendida = False  -> Pendiente
# - atendida = True   -> Atendida
#
# No se crean estados adicionales.
# ============================================================

from flask import jsonify
from flask_jwt_extended import jwt_required

from config import db
from decorators import rol_requerido
from helpers import obtener_usuario_actual, registrar_evento, timestamp_actual
from models import Empresa, Usuario, Vehiculo, Dispositivo, Alerta


def serializar_alerta_admin(alerta):
    vehiculo = db.session.get(Vehiculo, alerta.vehiculo_id)

    empresa = (
        db.session.get(Empresa, vehiculo.empresa_id)
        if vehiculo and vehiculo.empresa_id
        else None
    )

    dispositivo = (
        db.session.get(Dispositivo, vehiculo.dispositivo_id)
        if vehiculo and vehiculo.dispositivo_id
        else None
    )

    usuario_atencion = (
        db.session.get(Usuario, alerta.atendida_por)
        if alerta.atendida_por
        else None
    )

    return {
        "id": alerta.id,

        "vehiculo_id": alerta.vehiculo_id,
        "vehiculo_nombre": vehiculo.nombre if vehiculo else None,
        "vehiculo_placa": vehiculo.placa if vehiculo else None,
        "vehiculo_identificador": (
            vehiculo.identificador if vehiculo else None
        ),

        "empresa_id": empresa.id if empresa else None,
        "empresa_nombre": empresa.nombre if empresa else None,

        "dispositivo_id": dispositivo.id if dispositivo else None,
        "dispositivo_serie": dispositivo.serie if dispositivo else None,

        "tipo": alerta.tipo,
        "nivel": alerta.nivel,
        "descripcion": alerta.descripcion,

        "lat": alerta.lat,
        "lng": alerta.lng,

        "atendida": bool(alerta.atendida),
        "estado_texto": "Atendida" if alerta.atendida else "Pendiente",

        "atendida_por": alerta.atendida_por,
        "atendida_por_nombre": (
            usuario_atencion.nombre if usuario_atencion else None
        ),

        "fecha_atencion": alerta.fecha_atencion,
        "timestamp": alerta.timestamp,
        "ultima_actualizacion": alerta.ultima_actualizacion,
    }


def registrar_admin_alertas_routes(app):

    @app.get("/api/admin/alertas")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_alertas():
        alertas = (
            Alerta.query
            .order_by(Alerta.timestamp.desc())
            .limit(500)
            .all()
        )

        return jsonify({
            "ok": True,
            "alertas": [
                serializar_alerta_admin(alerta)
                for alerta in alertas
            ]
        }), 200


    @app.get("/api/admin/alertas/<int:alerta_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_alerta(alerta_id):
        alerta = db.session.get(Alerta, alerta_id)

        if not alerta:
            return jsonify({
                "error": "Alerta no encontrada"
            }), 404

        return jsonify({
            "ok": True,
            "alerta": serializar_alerta_admin(alerta)
        }), 200


    @app.put("/api/admin/alertas/<int:alerta_id>/atender")
    @jwt_required()
    @rol_requerido("admin")
    def admin_atender_alerta(alerta_id):
        usuario = obtener_usuario_actual()
        alerta = db.session.get(Alerta, alerta_id)

        if not alerta:
            return jsonify({
                "error": "Alerta no encontrada"
            }), 404

        vehiculo = db.session.get(Vehiculo, alerta.vehiculo_id)

        if not vehiculo:
            return jsonify({
                "error": "Vehículo no encontrado"
            }), 404

        if alerta.atendida:
            return jsonify({
                "ok": True,
                "mensaje": "La alerta ya se encuentra atendida",
                "alerta": serializar_alerta_admin(alerta)
            }), 200

        try:
            alerta.atendida = True
            alerta.atendida_por = usuario.id
            alerta.fecha_atencion = timestamp_actual()

            registrar_evento(
                vehiculo_id=vehiculo.id,
                tipo="alerta_atendida",
                descripcion=(
                    f"{usuario.nombre} atendió la alerta "
                    f"{alerta.tipo} del vehículo "
                    f"{vehiculo.nombre}"
                ),
                lat=alerta.lat,
                lng=alerta.lng,
            )

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Alerta atendida correctamente",
                "alerta": serializar_alerta_admin(alerta)
            }), 200

        except Exception as error:
            db.session.rollback()

            print("Error atendiendo alerta admin:", error)

            return jsonify({
                "error": "No se pudo atender la alerta"
            }), 500