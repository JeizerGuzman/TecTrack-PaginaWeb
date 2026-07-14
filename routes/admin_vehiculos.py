# ============================================================
# ROUTES ADMIN - VEHÍCULOS
# TrackSecurity
# ============================================================
#
# Endpoints exclusivos para el administrador global.
#
# Objetivos:
# - Listar todos los vehículos de todas las empresas.
# - Consultar el detalle completo de cualquier vehículo.
# - Consultar la bitácora de cualquier vehículo.
#
# Este archivo NO modifica las rutas existentes de:
# routes/vehiculos.py
#
# Por lo tanto, no rompe el flujo actual del dueño,
# supervisor, chofer ni la aplicación móvil.
# ============================================================

from flask import jsonify
from flask_jwt_extended import jwt_required

from config import db
from decorators import rol_requerido

from models import (
    Empresa,
    Usuario,
    Vehiculo,
    Dispositivo,
    Alerta,
    Evidencia,
    Suscripcion,
    Plan,
    Evento,
)

from serializers import (
    serializar_vehiculo,
    serializar_alerta,
    serializar_evento,
)


def obtener_empresa_vehiculo(vehiculo):
    if not vehiculo or not vehiculo.empresa_id:
        return None

    return db.session.get(
        Empresa,
        vehiculo.empresa_id
    )


def obtener_chofer_vehiculo(vehiculo):
    if not vehiculo or not vehiculo.chofer_id:
        return None

    return db.session.get(
        Usuario,
        vehiculo.chofer_id
    )


def obtener_dispositivo_vehiculo(vehiculo):
    if not vehiculo or not vehiculo.dispositivo_id:
        return None

    return db.session.get(
        Dispositivo,
        vehiculo.dispositivo_id
    )


def serializar_vehiculo_admin(vehiculo):
    empresa = obtener_empresa_vehiculo(vehiculo)
    chofer = obtener_chofer_vehiculo(vehiculo)
    dispositivo = obtener_dispositivo_vehiculo(vehiculo)

    data = serializar_vehiculo(vehiculo)

    data.update({
        "empresa_id": vehiculo.empresa_id,
        "empresa_nombre": (
            empresa.nombre
            if empresa
            else None
        ),

        "chofer_id": vehiculo.chofer_id,
        "chofer_nombre": (
            chofer.nombre
            if chofer
            else None
        ),

        "dispositivo_id": vehiculo.dispositivo_id,
        "dispositivo_serie": (
            dispositivo.serie
            if dispositivo
            else None
        ),
        "dispositivo_estado": (
            dispositivo.estado
            if dispositivo
            else None
        ),

        "activo": bool(vehiculo.activo),
    })

    return data


def obtener_plan_activo_empresa(empresa_id):
    suscripcion = (
        Suscripcion.query
        .filter_by(
            empresa_id=empresa_id,
            estado="activa"
        )
        .order_by(
            Suscripcion.fecha_inicio.desc()
        )
        .first()
    )

    if not suscripcion:
        return None

    return db.session.get(
        Plan,
        suscripcion.plan_id
    )


def registrar_admin_vehiculos_routes(app):

    @app.get("/api/admin/vehiculos")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_vehiculos():

        vehiculos = (
            Vehiculo.query
            .order_by(
                Vehiculo.id.desc()
            )
            .all()
        )

        return jsonify({
            "ok": True,

            "vehiculos": [
                serializar_vehiculo_admin(vehiculo)
                for vehiculo in vehiculos
            ]
        }), 200


    @app.get(
        "/api/admin/vehiculos/"
        "<int:vehiculo_id>"
    )
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_vehiculo_detalle(
        vehiculo_id
    ):

        vehiculo = db.session.get(
            Vehiculo,
            vehiculo_id
        )

        if not vehiculo:
            return jsonify({
                "error": "Vehículo no encontrado"
            }), 404

        alertas = (
            Alerta.query
            .filter_by(
                vehiculo_id=vehiculo.id
            )
            .order_by(
                Alerta.timestamp.desc()
            )
            .limit(10)
            .all()
        )

        evidencias = (
            Evidencia.query
            .filter_by(
                vehiculo_id=vehiculo.id
            )
            .order_by(
                Evidencia.timestamp.desc()
            )
            .limit(6)
            .all()
        )

        plan = obtener_plan_activo_empresa(
            vehiculo.empresa_id
        )

        nombre_plan = (
            plan.nombre
            if plan
            else "Sin plan"
        )

        es_premium = False

        if plan and plan.nombre:
            es_premium = (
                plan.nombre.strip().lower()
                == "premium"
            )

        return jsonify({
            "ok": True,

            "vehiculo": (
                serializar_vehiculo_admin(
                    vehiculo
                )
            ),

            "alertas": [
                serializar_alerta(alerta)
                for alerta in alertas
            ],

            "evidencias": [
                {
                    "id": evidencia.id,
                    "url_imagen": evidencia.url_imagen,
                    "descripcion": evidencia.descripcion,
                    "alerta_id": evidencia.alerta_id,
                    "timestamp": evidencia.timestamp,
                }
                for evidencia in evidencias
            ],

            "plan": {
                "nombre": nombre_plan,
                "es_premium": es_premium,
            }
        }), 200


    @app.get(
        "/api/admin/vehiculos/"
        "<int:vehiculo_id>/eventos"
    )
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_eventos_vehiculo(
        vehiculo_id
    ):

        vehiculo = db.session.get(
            Vehiculo,
            vehiculo_id
        )

        if not vehiculo:
            return jsonify({
                "error": "Vehículo no encontrado"
            }), 404

        eventos = (
            Evento.query
            .filter_by(
                vehiculo_id=vehiculo.id
            )
            .order_by(
                Evento.timestamp.desc()
            )
            .limit(20)
            .all()
        )

        return jsonify({
            "ok": True,

            "eventos": [
                serializar_evento(evento)
                for evento in eventos
            ]
        }), 200