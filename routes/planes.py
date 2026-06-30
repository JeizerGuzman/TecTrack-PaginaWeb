# ============================================================
# ROUTES PLANES Y SERVICIOS - TrackSecurity
# ============================================================
#
# Endpoints para planes comerciales y servicios técnicos.
# ============================================================

from flask import jsonify
from flask_jwt_extended import jwt_required

from models import Plan, Servicio
from decorators import rol_requerido
from helpers import obtener_usuario_actual


# ------------------------------------------------------------
# Registra rutas de planes y servicios.
# ------------------------------------------------------------
def registrar_planes_routes(app):

    # Lista planes comerciales activos.
    #
    # Se usa actualmente en:
    # - dashboard/configuración si quieres mostrar plan
    #
    # También puede usarse después en:
    # - página de ventas
    # - registro de empresas
    @app.route("/api/planes", methods=["GET"])
    @jwt_required()
    def listar_planes():
        planes = Plan.query.filter_by(activo=True).all()

        return jsonify({
            "planes": [
                {
                    "id": p.id,
                    "nombre": p.nombre,
                    "descripcion": p.descripcion,
                    "precio_dispositivo": p.precio_dispositivo,
                    "mensualidad": p.mensualidad,
                    "costo_instalacion": p.costo_instalacion,
                    "costo_mantenimiento": p.costo_mantenimiento,
                }
                for p in planes
            ]
        }), 200

    # Lista servicios de instalación/mantenimiento.
    #
    # Se usa actualmente en:
    # - panel técnico o administración
    @app.route("/api/servicios", methods=["GET"])
    @jwt_required()
    @rol_requerido("dueno", "admin", "tecnico")
    def listar_servicios():
        usuario = obtener_usuario_actual()

        if usuario.tipo == "tecnico":
            servicios = Servicio.query.order_by(
                Servicio.timestamp.desc()
            ).limit(200).all()
        else:
            servicios = Servicio.query.filter_by(
                empresa_id=usuario.empresa_id
            ).order_by(Servicio.timestamp.desc()).limit(200).all()

        return jsonify({
            "servicios": [
                {
                    "id": s.id,
                    "vehiculo_id": s.vehiculo_id,
                    "dispositivo_id": s.dispositivo_id,
                    "tipo": s.tipo,
                    "descripcion": s.descripcion,
                    "costo": s.costo,
                    "estado": s.estado,
                    "timestamp": s.timestamp,
                }
                for s in servicios
            ]
        }), 200
