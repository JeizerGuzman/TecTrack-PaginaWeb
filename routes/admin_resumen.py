from flask import jsonify
from flask_jwt_extended import jwt_required
from config import db
from decorators import rol_requerido
from models import Empresa, Usuario, Vehiculo, Dispositivo, UbicacionActual, Alerta, Servicio
from serializers import calcular_estado_visible_vehiculo
from helpers import obtener_segundos_sin_senal

def registrar_admin_resumen_routes(app):
    @app.get("/api/admin/resumen")
    @jwt_required()
    @rol_requerido("admin")
    def admin_resumen():
        # ====================================================
        # EMPRESAS
        # ====================================================
        total_empresas = Empresa.query.count()
        empresas_activas = Empresa.query.filter_by(activo=True).count()
        empresas_por_estado = {
            "activas": empresas_activas,
            "inactivas": max(total_empresas - empresas_activas, 0),
        }

        # ====================================================
        # USUARIOS
        # ====================================================
        total_usuarios = Usuario.query.count()
        usuarios_activos = Usuario.query.filter_by(activo=True).count()
        usuarios_rol_rows = (
            db.session.query(Usuario.tipo, db.func.count(Usuario.id))
            .group_by(Usuario.tipo)
            .all()
        )
        usuarios_por_rol = {}
        for rol, total in usuarios_rol_rows:
            usuarios_por_rol[rol or "sin_rol"] = total

        # ====================================================
        # VEHÍCULOS
        # ====================================================
        total_vehiculos = Vehiculo.query.count()
        vehiculos_activos = Vehiculo.query.filter_by(activo=True).count()
        vehiculos_por_estado = {
            "activo": 0, "alerta": 0, "panico": 0, 
            "manual": 0, "sin_senal": 0, "apagado": 0,
        }

        vehiculos_con_ubicacion = (
            db.session.query(Vehiculo, UbicacionActual, Dispositivo)
            .outerjoin(UbicacionActual, UbicacionActual.vehiculo_id == Vehiculo.id)
            .outerjoin(Dispositivo, Dispositivo.id == Vehiculo.dispositivo_id)
            .filter(Vehiculo.activo == True)
            .all()
        )

        for vehiculo, ubicacion, dispositivo in vehiculos_con_ubicacion:
            estado_visible = calcular_estado_visible_vehiculo(ubicacion=ubicacion, dispositivo=dispositivo)
            estado = estado_visible.get("estado") or "activo"
            if estado in vehiculos_por_estado:
                vehiculos_por_estado[estado] += 1
            else:
                vehiculos_por_estado["activo"] += 1

        vehiculos_sin_senal = vehiculos_por_estado["sin_senal"]
        vehiculos_en_alerta = vehiculos_por_estado["alerta"] + vehiculos_por_estado["panico"]

        # ====================================================
        # DISPOSITIVOS
        # ====================================================
        total_dispositivos = Dispositivo.query.count()
        dispositivos_disponibles = Dispositivo.query.filter_by(estado="disponible").count()
        dispositivos_instalados = Dispositivo.query.filter(Dispositivo.estado.in_(["instalado", "activo"])).count()
        dispositivos_mantenimiento = Dispositivo.query.filter_by(estado="mantenimiento").count()

        dispositivos_estado_rows = (
            db.session.query(Dispositivo.estado, db.func.count(Dispositivo.id))
            .group_by(Dispositivo.estado)
            .all()
        )
        dispositivos_por_estado = {}
        for estado, total in dispositivos_estado_rows:
            dispositivos_por_estado[estado or "sin_estado"] = total

        # ====================================================
        # ALERTAS & SERVICIOS
        # ====================================================
        total_alertas = Alerta.query.count()
        alertas_pendientes = Alerta.query.filter_by(atendida=False).count()
        alertas_recientes = (
            db.session.query(Alerta, Vehiculo, Empresa)
            .join(Vehiculo, Vehiculo.id == Alerta.vehiculo_id)
            .join(Empresa, Empresa.id == Vehiculo.empresa_id)
            .order_by(Alerta.timestamp.desc())
            .limit(5)
            .all()
        )

        servicios_pendientes = Servicio.query.filter_by(estado="pendiente").count()
        servicios_recientes = (
            db.session.query(Servicio, Empresa, Vehiculo, Dispositivo)
            .join(Empresa, Empresa.id == Servicio.empresa_id)
            .outerjoin(Vehiculo, Vehiculo.id == Servicio.vehiculo_id)
            .outerjoin(Dispositivo, Dispositivo.id == Servicio.dispositivo_id)
            .order_by(Servicio.timestamp.desc())
            .limit(5)
            .all()
        )

        return jsonify({
            "ok": True,
            "tiempo_sin_senal_segundos": obtener_segundos_sin_senal(),
            "metricas": {
                "total_empresas": total_empresas,
                "empresas_activas": empresas_activas,
                "total_usuarios": total_usuarios,
                "usuarios_activos": usuarios_activos,
                "total_vehiculos": total_vehiculos,
                "vehiculos_activos": vehiculos_activos,
                "vehiculos_sin_senal": vehiculos_sin_senal,
                "vehiculos_en_alerta": vehiculos_en_alerta,
                "total_dispositivos": total_dispositivos,
                "dispositivos_disponibles": dispositivos_disponibles,
                "dispositivos_instalados": dispositivos_instalados,
                "dispositivos_mantenimiento": dispositivos_mantenimiento,
                "total_alertas": total_alertas,
                "alertas_pendientes": alertas_pendientes,
                "servicios_pendientes": servicios_pendientes,
            },
            "graficas": {
                "vehiculos_por_estado": vehiculos_por_estado,
                "dispositivos_por_estado": dispositivos_por_estado,
                "usuarios_por_rol": usuarios_por_rol,
                "empresas_por_estado": empresas_por_estado,
            },
            "alertas_recientes": [
                {
                    "id": a.id, "tipo": a.tipo, "nivel": a.nivel, "descripcion": a.descripcion,
                    "atendida": a.atendida, "timestamp": a.timestamp, "vehiculo_id": v.id,
                    "vehiculo": v.nombre, "empresa_id": e.id, "empresa": e.nombre,
                } for a, v, e in alertas_recientes
            ],
            "servicios_recientes": [
                {
                    "id": s.id, "tipo": s.tipo, "descripcion": s.descripcion, "estado": s.estado,
                    "costo": s.costo, "timestamp": s.timestamp, "empresa_id": e.id, "empresa": e.nombre,
                    "vehiculo_id": v.id if v else None, "vehiculo": v.nombre if v else None,
                    "dispositivo_id": d.id if d else None, "dispositivo_serie": d.serie if d else None,
                } for s, e, v, d in servicios_recientes
            ],
        }), 200