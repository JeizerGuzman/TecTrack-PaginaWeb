# ============================================================
# ROUTES ADMIN - TrackSecurity
# ============================================================
#
# Endpoints exclusivos para el rol admin.
# Aquí irá la administración global de la plataforma.
#
# Importante:
# - No reemplaza endpoints existentes como /api/estado.
# - No afecta dashboard del dueño.
# - El admin ve información global, no filtrada por empresa.
# ============================================================

import random
import re

from flask import jsonify, request
from flask_jwt_extended import jwt_required
from helpers import (
    hashear_password,
    obtener_usuario_actual,
    obtener_segundos_sin_senal,
)

from config import db
from decorators import rol_requerido
from models import (
    Empresa,
    Usuario,
    Vehiculo,
    Dispositivo,
    UbicacionActual,
    Alerta,
    Servicio,
    Plan,
    TarifaPlan

)
from serializers import calcular_estado_visible_vehiculo


def generar_siguiente_serie_dispositivo():
    """
    Genera la siguiente serie disponible con formato:
    TS-000001, TS-000002, TS-000003...

    No depende del ID porque puede haber registros eliminados o pruebas.
    Busca la serie más alta existente y suma 1.
    """

    dispositivos = Dispositivo.query.with_entities(Dispositivo.serie).all()

    mayor_numero = 0

    for item in dispositivos:
        serie = item[0] if isinstance(item, tuple) else item.serie

        if not serie:
            continue

        match = re.match(r"^TS-(\d{6})$", serie.strip())

        if match:
            numero = int(match.group(1))
            mayor_numero = max(mayor_numero, numero)

    siguiente = mayor_numero + 1

    return f"TS-{siguiente:06d}"


def generar_pin_activacion(longitud=6):
    """
    Genera un PIN numérico para activación técnica.
    Por defecto usamos 6 dígitos.
    """

    minimo = 10 ** (longitud - 1)
    maximo = (10 ** longitud) - 1

    return str(random.randint(minimo, maximo))


def serializar_dispositivo_admin(dispositivo):  
    """
    Serializador específico para el panel admin.
    Incluye PIN porque el admin necesita ver/generar el dispositivo.
    """

    empresa = (
        db.session.get(Empresa, dispositivo.empresa_id)
        if dispositivo.empresa_id
        else None
    )

    vehiculo = Vehiculo.query.filter_by(
        dispositivo_id=dispositivo.id
    ).first()

    return {
        "id": dispositivo.id,
        "serie": dispositivo.serie,
        "pin_activacion": dispositivo.pin_activacion,
        "imei": dispositivo.imei,
        "modelo": dispositivo.modelo,
        "firmware": dispositivo.firmware,
        "estado": dispositivo.estado,

        "empresa_id": dispositivo.empresa_id,
        "empresa_nombre": empresa.nombre if empresa else None,

        "vehiculo_id": vehiculo.id if vehiculo else None,
        "vehiculo_nombre": vehiculo.nombre if vehiculo else None,
        "vehiculo_identificador": vehiculo.identificador if vehiculo else None,

        "ultima_conexion": dispositivo.ultima_conexion,
        "fecha_instalacion": dispositivo.fecha_instalacion,
        "fecha_creacion": dispositivo.fecha_creacion,
    }

    
def serializar_usuario_admin(usuario):
    """
    Serializa usuarios para el panel global del admin.
    Incluye información de empresa y fecha de creación.
    """

    empresa = (
        db.session.get(Empresa, usuario.empresa_id)
        if usuario.empresa_id
        else None
    )

    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "correo": usuario.correo,
        "telefono": usuario.telefono,
        "tipo": usuario.tipo,
        "empresa_id": usuario.empresa_id,
        "empresa_nombre": empresa.nombre if empresa else None,
        "activo": usuario.activo,
        "fecha_creacion": usuario.fecha_creacion,
    }


def contar_administradores_activos():
    """
    Devuelve la cantidad de administradores activos del sistema.
    Se utiliza para evitar que TrackSecurity quede sin ningún admin activo.
    """
    return Usuario.query.filter_by(
        tipo="admin",
        activo=True
    ).count()


# ============================================================
# FUNCIONES AUXILIARES - PLANES Y TARIFAS
# ============================================================

def serializar_plan_admin(plan):
    """
    Serializa un plan para el panel administrativo.

    Incluye:
    - información general
    - características del sistema
    - políticas de retención
    - cantidad de tarifas
    """

    total_tarifas = TarifaPlan.query.filter_by(
        plan_id=plan.id
    ).count()

    tarifas_activas = TarifaPlan.query.filter_by(
        plan_id=plan.id,
        activo=True
    ).count()

    return {
        "id": plan.id,
        "nombre": plan.nombre,
        "descripcion": plan.descripcion,

        # Características incluidas
        "tiene_gps": bool(plan.tiene_gps),
        "tiene_sensor_vibracion": bool(
            plan.tiene_sensor_vibracion
        ),
        "tiene_sensor_puerta": bool(
            plan.tiene_sensor_puerta
        ),
        "tiene_boton_panico": bool(
            plan.tiene_boton_panico
        ),
        "tiene_sirena": bool(plan.tiene_sirena),
        "tiene_dashboard_web": bool(
            plan.tiene_dashboard_web
        ),
        "tiene_app_movil": bool(
            plan.tiene_app_movil
        ),
        "tiene_fpga": bool(plan.tiene_fpga),
        "tiene_camara": bool(plan.tiene_camara),
        "tiene_captura_evidencia": bool(
            plan.tiene_captura_evidencia
        ),

        # Retención
        "dias_retencion_gps": plan.dias_retencion_gps,
        "dias_retencion_alertas": (
            plan.dias_retencion_alertas
        ),
        "dias_retencion_evidencias": (
            plan.dias_retencion_evidencias
        ),

        # Estado
        "activo": bool(plan.activo),
        "fecha_creacion": plan.fecha_creacion,

        # Métricas relacionadas
        "total_tarifas": total_tarifas,
        "tarifas_activas": tarifas_activas,
    }


def serializar_tarifa_plan_admin(tarifa):
    """
    Serializa una tarifa de plan.

    Todos los precios almacenados en TarifaPlan
    son precios unitarios.
    """

    return {
        "id": tarifa.id,
        "plan_id": tarifa.plan_id,

        "cantidad_minima": tarifa.cantidad_minima,
        "cantidad_maxima": tarifa.cantidad_maxima,

        "precio_dispositivo": tarifa.precio_dispositivo,
        "costo_instalacion": tarifa.costo_instalacion,
        "mensualidad": tarifa.mensualidad,
        "costo_mantenimiento": (
            tarifa.costo_mantenimiento
        ),

        "activo": bool(tarifa.activo),
        "fecha_creacion": tarifa.fecha_creacion,
    }


def convertir_booleano(valor, valor_default=False):
    """
    Convierte diferentes representaciones a booleano.

    Acepta:
    True, False, 1, 0, "true", "false", "1", "0".
    """

    if valor is None:
        return valor_default

    if isinstance(valor, bool):
        return valor

    if isinstance(valor, int):
        return valor == 1

    if isinstance(valor, str):
        return valor.strip().lower() in (
            "true",
            "1",
            "si",
            "sí",
            "on"
        )

    return bool(valor)


def convertir_entero_nullable(valor):
    """
    Convierte un valor a entero.

    Devuelve None cuando:
    - llega None
    - llega una cadena vacía

    Lanza ValueError si el valor no es entero.
    """

    if valor in (None, ""):
        return None

    return int(valor)


def convertir_float_no_negativo(valor, nombre_campo):
    """
    Convierte un precio a float y valida que
    no sea negativo.
    """

    try:
        numero = float(valor or 0)

    except (TypeError, ValueError):
        raise ValueError(
            f"{nombre_campo} debe ser un número válido"
        )

    if numero < 0:
        raise ValueError(
            f"{nombre_campo} no puede ser negativo"
        )

    return numero


def obtener_conflicto_rango_tarifa(
    plan_id,
    cantidad_minima,
    cantidad_maxima,
    tarifa_excluir_id=None
):
    """
    Busca una tarifa activa cuyo rango se solape con
    el rango recibido.

    Ejemplos de conflicto:

    Existente: 1 a 10
    Nueva:     5 a 15

    Existente: 20 o más
    Nueva:     30 o más

    Solo se comparan tarifas activas.
    Las tarifas inactivas pueden conservarse como historial.
    """

    consulta = TarifaPlan.query.filter(
        TarifaPlan.plan_id == plan_id,
        TarifaPlan.activo == True
    )

    if tarifa_excluir_id:
        consulta = consulta.filter(
            TarifaPlan.id != tarifa_excluir_id
        )

    tarifas = consulta.all()

    infinito = float("inf")

    nuevo_inicio = cantidad_minima

    nuevo_fin = (
        cantidad_maxima
        if cantidad_maxima is not None
        else infinito
    )

    for tarifa in tarifas:

        existente_inicio = tarifa.cantidad_minima

        existente_fin = (
            tarifa.cantidad_maxima
            if tarifa.cantidad_maxima is not None
            else infinito
        )

        hay_solapamiento = (
            nuevo_inicio <= existente_fin
            and existente_inicio <= nuevo_fin
        )

        if hay_solapamiento:
            return tarifa

    return None


def texto_rango_tarifa(tarifa):
    """
    Devuelve un texto legible para mostrar un rango.
    """

    if tarifa.cantidad_maxima is None:
        return f"{tarifa.cantidad_minima} o más"

    if tarifa.cantidad_minima == tarifa.cantidad_maxima:
        return str(tarifa.cantidad_minima)

    return (
        f"{tarifa.cantidad_minima} a "
        f"{tarifa.cantidad_maxima}"
    )


def registrar_admin_routes(app):

    # --------------------------------------------------------
    # RESUMEN GENERAL DEL ADMIN
    # --------------------------------------------------------
    #
    # Se usa en:
    # - static/js/admin/dashboard.js
    #
    # Devuelve métricas globales de toda la plataforma.
    # --------------------------------------------------------
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
            db.session.query(
                Usuario.tipo,
                db.func.count(Usuario.id)
            )
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

        # ----------------------------------------------------
        # VEHÍCULOS POR ESTADO VISIBLE
        # ----------------------------------------------------
        #
        # No agrupamos directamente por UbicacionActual.estado.
        #
        # UbicacionActual.estado guarda el último estado real
        # recibido del ESP32.
        #
        # Ejemplo:
        # Si el último estado guardado fue "manual", pero ya
        # pasaron más de 60 segundos sin datos, visualmente debe
        # contar como "sin_senal", no como "manual".
        #
        # Por eso recorremos vehículo por vehículo y usamos:
        # calcular_estado_visible_vehiculo()
        # ----------------------------------------------------

        vehiculos_por_estado = {
            "activo": 0,
            "alerta": 0,
            "panico": 0,
            "manual": 0,
            "sin_senal": 0,
            "apagado": 0,
        }

        vehiculos_con_ubicacion = (
            db.session.query(Vehiculo, UbicacionActual, Dispositivo)
            .outerjoin(
                UbicacionActual,
                UbicacionActual.vehiculo_id == Vehiculo.id
            )
            .outerjoin(
                Dispositivo,
                Dispositivo.id == Vehiculo.dispositivo_id
            )
            .filter(Vehiculo.activo == True)
            .all()
        )

        for vehiculo, ubicacion, dispositivo in vehiculos_con_ubicacion:
            estado_visible = calcular_estado_visible_vehiculo(
                ubicacion=ubicacion,
                dispositivo=dispositivo
            )

            estado = estado_visible.get("estado") or "activo"

            if estado in vehiculos_por_estado:
                vehiculos_por_estado[estado] += 1
            else:
                vehiculos_por_estado["activo"] += 1

        # Estas métricas se calculan después del recorrido.
        # Si las calculas antes, siempre quedarían en 0.
        vehiculos_sin_senal = vehiculos_por_estado["sin_senal"]

        vehiculos_en_alerta = (
            vehiculos_por_estado["alerta"] +
            vehiculos_por_estado["panico"]
        )

        # ====================================================
        # DISPOSITIVOS
        # ====================================================

        total_dispositivos = Dispositivo.query.count()

        dispositivos_disponibles = Dispositivo.query.filter_by(
            estado="disponible"
        ).count()

        dispositivos_instalados = Dispositivo.query.filter(
            Dispositivo.estado.in_(["instalado", "activo"])
        ).count()

        dispositivos_mantenimiento = Dispositivo.query.filter_by(
            estado="mantenimiento"
        ).count()

        dispositivos_estado_rows = (
            db.session.query(
                Dispositivo.estado,
                db.func.count(Dispositivo.id)
            )
            .group_by(Dispositivo.estado)
            .all()
        )

        dispositivos_por_estado = {}

        for estado, total in dispositivos_estado_rows:
            dispositivos_por_estado[estado or "sin_estado"] = total

        # ====================================================
        # ALERTAS
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

        # ====================================================
        # SERVICIOS TÉCNICOS
        # ====================================================

        servicios_pendientes = Servicio.query.filter_by(
            estado="pendiente"
        ).count()

        servicios_recientes = (
            db.session.query(Servicio, Empresa, Vehiculo, Dispositivo)
            .join(Empresa, Empresa.id == Servicio.empresa_id)
            .outerjoin(Vehiculo, Vehiculo.id == Servicio.vehiculo_id)
            .outerjoin(Dispositivo, Dispositivo.id == Servicio.dispositivo_id)
            .order_by(Servicio.timestamp.desc())
            .limit(5)
            .all()
        )

        # ====================================================
        # RESPUESTA JSON
        # ====================================================

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

            # Aunque ya no los muestres en el dashboard visual,
            # los dejamos por si luego quieres usarlos en otro módulo.
            "alertas_recientes": [
                {
                    "id": alerta.id,
                    "tipo": alerta.tipo,
                    "nivel": alerta.nivel,
                    "descripcion": alerta.descripcion,
                    "atendida": alerta.atendida,
                    "timestamp": alerta.timestamp,

                    "vehiculo_id": vehiculo.id,
                    "vehiculo": vehiculo.nombre,

                    "empresa_id": empresa.id,
                    "empresa": empresa.nombre,
                }
                for alerta, vehiculo, empresa in alertas_recientes
            ],

            "servicios_recientes": [
                {
                    "id": servicio.id,
                    "tipo": servicio.tipo,
                    "descripcion": servicio.descripcion,
                    "estado": servicio.estado,
                    "costo": servicio.costo,
                    "timestamp": servicio.timestamp,

                    "empresa_id": empresa.id,
                    "empresa": empresa.nombre,

                    "vehiculo_id": vehiculo.id if vehiculo else None,
                    "vehiculo": vehiculo.nombre if vehiculo else None,

                    "dispositivo_id": dispositivo.id if dispositivo else None,
                    "dispositivo_serie": dispositivo.serie if dispositivo else None,
                }
                for servicio, empresa, vehiculo, dispositivo in servicios_recientes
            ],
        }), 200
    
        # --------------------------------------------------------
    # EMPRESAS - LISTAR
    # --------------------------------------------------------
    @app.get("/api/admin/empresas")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_empresas():
        empresas = (
            Empresa.query
            .order_by(Empresa.id.desc())
            .all()
        )

        empresas_json = []

        for empresa in empresas:
            total_usuarios = Usuario.query.filter_by(
                empresa_id=empresa.id
            ).count()

            total_vehiculos = Vehiculo.query.filter_by(
                empresa_id=empresa.id
            ).count()

            total_dispositivos = Dispositivo.query.filter_by(
                empresa_id=empresa.id
            ).count()

            plan = db.session.get(Plan, empresa.plan_id) if empresa.plan_id else None

            empresas_json.append({
                "id": empresa.id,
                "nombre": empresa.nombre,
                "correo": empresa.correo,
                "telefono": empresa.telefono,
                "direccion": empresa.direccion,
                "plan_id": empresa.plan_id,
                "plan_nombre": plan.nombre if plan else None,
                "activo": empresa.activo,
                "fecha_creacion": empresa.fecha_creacion,

                "total_usuarios": total_usuarios,
                "total_vehiculos": total_vehiculos,
                "total_dispositivos": total_dispositivos,
            })

        return jsonify({
            "ok": True,
            "empresas": empresas_json
        }), 200

    # --------------------------------------------------------
    # EMPRESAS - CREAR
    # --------------------------------------------------------
    @app.post("/api/admin/empresas")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_empresa():
        data = request.get_json(silent=True) or {}

        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        telefono = data.get("telefono", "").strip()
        direccion = data.get("direccion", "").strip()
        plan_id = data.get("plan_id")

        if not nombre:
            return jsonify({"error": "El nombre de la empresa es requerido"}), 400

        if correo:
            existe_correo = Empresa.query.filter_by(correo=correo).first()
            if existe_correo:
                return jsonify({"error": "Ya existe una empresa con ese correo"}), 409

        if plan_id in ("", None):
            plan_id = None

        if plan_id:
            plan = db.session.get(Plan, int(plan_id))
            if not plan:
                return jsonify({"error": "El plan seleccionado no existe"}), 404

        try:
            empresa = Empresa(
                nombre=nombre,
                correo=correo or None,
                telefono=telefono or None,
                direccion=direccion or None,
                plan_id=int(plan_id) if plan_id else None,
                activo=True
            )

            db.session.add(empresa)
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Empresa creada correctamente",
                "empresa": {
                    "id": empresa.id,
                    "nombre": empresa.nombre,
                    "correo": empresa.correo,
                    "telefono": empresa.telefono,
                    "direccion": empresa.direccion,
                    "plan_id": empresa.plan_id,
                    "activo": empresa.activo,
                    "fecha_creacion": empresa.fecha_creacion,
                }
            }), 201

        except Exception as e:
            db.session.rollback()
            print("Error creando empresa:", e)
            return jsonify({"error": "No se pudo crear la empresa"}), 500

    # --------------------------------------------------------
    # EMPRESAS - OBTENER UNA
    # --------------------------------------------------------
    @app.get("/api/admin/empresas/<int:empresa_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_empresa(empresa_id):
        empresa = db.session.get(Empresa, empresa_id)

        if not empresa:
            return jsonify({"error": "Empresa no encontrada"}), 404

        return jsonify({
            "ok": True,
            "empresa": {
                "id": empresa.id,
                "nombre": empresa.nombre,
                "correo": empresa.correo,
                "telefono": empresa.telefono,
                "direccion": empresa.direccion,
                "plan_id": empresa.plan_id,
                "activo": empresa.activo,
                "fecha_creacion": empresa.fecha_creacion,
            }
        }), 200

    # --------------------------------------------------------
    # EMPRESAS - EDITAR
    # --------------------------------------------------------
    @app.put("/api/admin/empresas/<int:empresa_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_empresa(empresa_id):
        empresa = db.session.get(Empresa, empresa_id)

        if not empresa:
            return jsonify({"error": "Empresa no encontrada"}), 404

        data = request.get_json(silent=True) or {}

        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        telefono = data.get("telefono", "").strip()
        direccion = data.get("direccion", "").strip()
        plan_id = data.get("plan_id")

        if not nombre:
            return jsonify({"error": "El nombre de la empresa es requerido"}), 400

        if correo:
            existe_correo = Empresa.query.filter(
                Empresa.correo == correo,
                Empresa.id != empresa.id
            ).first()

            if existe_correo:
                return jsonify({"error": "Ya existe otra empresa con ese correo"}), 409

        if plan_id in ("", None):
            plan_id = None

        if plan_id:
            plan = db.session.get(Plan, int(plan_id))
            if not plan:
                return jsonify({"error": "El plan seleccionado no existe"}), 404

        try:
            empresa.nombre = nombre
            empresa.correo = correo or None
            empresa.telefono = telefono or None
            empresa.direccion = direccion or None
            empresa.plan_id = int(plan_id) if plan_id else None

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Empresa actualizada correctamente"
            }), 200

        except Exception as e:
            db.session.rollback()
            print("Error editando empresa:", e)
            return jsonify({"error": "No se pudo actualizar la empresa"}), 500

    # --------------------------------------------------------
    # EMPRESAS - DESACTIVAR
    # --------------------------------------------------------
    @app.put("/api/admin/empresas/<int:empresa_id>/desactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_desactivar_empresa(empresa_id):
        empresa = db.session.get(Empresa, empresa_id)

        if not empresa:
            return jsonify({"error": "Empresa no encontrada"}), 404

        empresa.activo = False
        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "Empresa desactivada correctamente"
        }), 200

    # --------------------------------------------------------
    # EMPRESAS - REACTIVAR
    # --------------------------------------------------------
    @app.put("/api/admin/empresas/<int:empresa_id>/reactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reactivar_empresa(empresa_id):
        empresa = db.session.get(Empresa, empresa_id)

        if not empresa:
            return jsonify({"error": "Empresa no encontrada"}), 404

        empresa.activo = True
        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "Empresa reactivada correctamente"
        }), 200
        
        
    # --------------------------------------------------------
    # PLANES - LISTAR TODOS
    # --------------------------------------------------------
    @app.get("/api/admin/planes")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_planes():

        planes = (
            Plan.query
            .order_by(
                Plan.activo.desc(),
                Plan.id.desc()
            )
            .all()
        )

        return jsonify({
            "ok": True,
            "planes": [
                serializar_plan_admin(plan)
                for plan in planes
            ]
        }), 200    
    
    # --------------------------------------------------------
    # PLANES - CREAR
    # --------------------------------------------------------
    @app.post("/api/admin/planes")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_plan():

        data = request.get_json(silent=True) or {}

        nombre = data.get(
            "nombre",
            ""
        ).strip()

        descripcion = data.get(
            "descripcion",
            ""
        ).strip()

        # ----------------------------------------------------
        # VALIDAR NOMBRE
        # ----------------------------------------------------

        if not nombre:
            return jsonify({
                "error": "El nombre del plan es requerido"
            }), 400

        if len(nombre) > 50:
            return jsonify({
                "error": (
                    "El nombre del plan no puede superar "
                    "los 50 caracteres"
                )
            }), 400

        existe_nombre = Plan.query.filter(
            db.func.lower(Plan.nombre)
            == nombre.lower()
        ).first()

        if existe_nombre:
            return jsonify({
                "error": (
                    "Ya existe un plan con ese nombre"
                )
            }), 409

        # ----------------------------------------------------
        # RETENCIÓN
        # ----------------------------------------------------

        try:
            dias_retencion_gps = convertir_entero_nullable(
                data.get("dias_retencion_gps")
            )

            dias_retencion_alertas = convertir_entero_nullable(
                data.get("dias_retencion_alertas")
            )

            dias_retencion_evidencias = (
                convertir_entero_nullable(
                    data.get(
                        "dias_retencion_evidencias"
                    )
                )
            )

        except (TypeError, ValueError):
            return jsonify({
                "error": (
                    "Los días de retención deben ser "
                    "números enteros válidos"
                )
            }), 400

        # GPS y alertas son obligatorios.
        if (
            dias_retencion_gps is None
            or dias_retencion_gps < 1
        ):
            return jsonify({
                "error": (
                    "La retención GPS debe ser de "
                    "al menos 1 día"
                )
            }), 400

        if (
            dias_retencion_alertas is None
            or dias_retencion_alertas < 1
        ):
            return jsonify({
                "error": (
                    "La retención de alertas debe ser "
                    "de al menos 1 día"
                )
            }), 400

        if (
            dias_retencion_evidencias is not None
            and dias_retencion_evidencias < 1
        ):
            return jsonify({
                "error": (
                    "La retención de evidencias debe ser "
                    "de al menos 1 día"
                )
            }), 400

        # ----------------------------------------------------
        # CARACTERÍSTICAS
        # ----------------------------------------------------

        tiene_gps = convertir_booleano(
            data.get("tiene_gps"),
            True
        )

        tiene_sensor_vibracion = convertir_booleano(
            data.get("tiene_sensor_vibracion"),
            True
        )

        tiene_sensor_puerta = convertir_booleano(
            data.get("tiene_sensor_puerta"),
            True
        )

        tiene_boton_panico = convertir_booleano(
            data.get("tiene_boton_panico"),
            True
        )

        tiene_sirena = convertir_booleano(
            data.get("tiene_sirena"),
            True
        )

        tiene_dashboard_web = convertir_booleano(
            data.get("tiene_dashboard_web"),
            True
        )

        tiene_app_movil = convertir_booleano(
            data.get("tiene_app_movil"),
            True
        )

        tiene_fpga = convertir_booleano(
            data.get("tiene_fpga"),
            False
        )

        tiene_camara = convertir_booleano(
            data.get("tiene_camara"),
            False
        )

        tiene_captura_evidencia = convertir_booleano(
            data.get("tiene_captura_evidencia"),
            False
        )

        # Si no existe captura de evidencia,
        # no tiene sentido conservar retención de evidencias.
        if not tiene_captura_evidencia:
            dias_retencion_evidencias = None

        try:

            plan = Plan(
                nombre=nombre,
                descripcion=descripcion or None,

                tiene_gps=tiene_gps,

                tiene_sensor_vibracion=(
                    tiene_sensor_vibracion
                ),

                tiene_sensor_puerta=(
                    tiene_sensor_puerta
                ),

                tiene_boton_panico=(
                    tiene_boton_panico
                ),

                tiene_sirena=tiene_sirena,

                tiene_dashboard_web=(
                    tiene_dashboard_web
                ),

                tiene_app_movil=tiene_app_movil,

                tiene_fpga=tiene_fpga,

                tiene_camara=tiene_camara,

                tiene_captura_evidencia=(
                    tiene_captura_evidencia
                ),

                dias_retencion_gps=(
                    dias_retencion_gps
                ),

                dias_retencion_alertas=(
                    dias_retencion_alertas
                ),

                dias_retencion_evidencias=(
                    dias_retencion_evidencias
                ),

                activo=True
            )

            db.session.add(plan)
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Plan creado correctamente",
                "plan": serializar_plan_admin(plan)
            }), 201

        except Exception as e:

            db.session.rollback()

            print(
                "Error creando plan admin:",
                e
            )

            return jsonify({
                "error": "No se pudo crear el plan"
            }), 500
    
    # --------------------------------------------------------
    # PLANES - OBTENER UNO
    # --------------------------------------------------------
    @app.get("/api/admin/planes/<int:plan_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_plan(plan_id):

        plan = db.session.get(
            Plan,
            plan_id
        )

        if not plan:
            return jsonify({
                "error": "Plan no encontrado"
            }), 404

        return jsonify({
            "ok": True,
            "plan": serializar_plan_admin(plan)
        }), 200
    
    # --------------------------------------------------------
    # PLANES - EDITAR
    # --------------------------------------------------------
    @app.put("/api/admin/planes/<int:plan_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_plan(plan_id):

        plan = db.session.get(
            Plan,
            plan_id
        )

        if not plan:
            return jsonify({
                "error": "Plan no encontrado"
            }), 404

        data = request.get_json(silent=True) or {}

        nombre = data.get(
            "nombre",
            ""
        ).strip()

        descripcion = data.get(
            "descripcion",
            ""
        ).strip()

        if not nombre:
            return jsonify({
                "error": "El nombre del plan es requerido"
            }), 400

        if len(nombre) > 50:
            return jsonify({
                "error": (
                    "El nombre del plan no puede superar "
                    "los 50 caracteres"
                )
            }), 400

        existe_nombre = Plan.query.filter(
            db.func.lower(Plan.nombre)
            == nombre.lower(),
            Plan.id != plan.id
        ).first()

        if existe_nombre:
            return jsonify({
                "error": (
                    "Ya existe otro plan con ese nombre"
                )
            }), 409

        try:

            dias_retencion_gps = convertir_entero_nullable(
                data.get("dias_retencion_gps")
            )

            dias_retencion_alertas = convertir_entero_nullable(
                data.get("dias_retencion_alertas")
            )

            dias_retencion_evidencias = (
                convertir_entero_nullable(
                    data.get(
                        "dias_retencion_evidencias"
                    )
                )
            )

        except (TypeError, ValueError):
            return jsonify({
                "error": (
                    "Los días de retención deben ser "
                    "números enteros válidos"
                )
            }), 400

        if (
            dias_retencion_gps is None
            or dias_retencion_gps < 1
        ):
            return jsonify({
                "error": (
                    "La retención GPS debe ser de "
                    "al menos 1 día"
                )
            }), 400

        if (
            dias_retencion_alertas is None
            or dias_retencion_alertas < 1
        ):
            return jsonify({
                "error": (
                    "La retención de alertas debe ser "
                    "de al menos 1 día"
                )
            }), 400

        if (
            dias_retencion_evidencias is not None
            and dias_retencion_evidencias < 1
        ):
            return jsonify({
                "error": (
                    "La retención de evidencias debe ser "
                    "de al menos 1 día"
                )
            }), 400

        tiene_gps = convertir_booleano(
            data.get("tiene_gps"),
            plan.tiene_gps
        )

        tiene_sensor_vibracion = convertir_booleano(
            data.get("tiene_sensor_vibracion"),
            plan.tiene_sensor_vibracion
        )

        tiene_sensor_puerta = convertir_booleano(
            data.get("tiene_sensor_puerta"),
            plan.tiene_sensor_puerta
        )

        tiene_boton_panico = convertir_booleano(
            data.get("tiene_boton_panico"),
            plan.tiene_boton_panico
        )

        tiene_sirena = convertir_booleano(
            data.get("tiene_sirena"),
            plan.tiene_sirena
        )

        tiene_dashboard_web = convertir_booleano(
            data.get("tiene_dashboard_web"),
            plan.tiene_dashboard_web
        )

        tiene_app_movil = convertir_booleano(
            data.get("tiene_app_movil"),
            plan.tiene_app_movil
        )

        tiene_fpga = convertir_booleano(
            data.get("tiene_fpga"),
            plan.tiene_fpga
        )

        tiene_camara = convertir_booleano(
            data.get("tiene_camara"),
            plan.tiene_camara
        )

        tiene_captura_evidencia = convertir_booleano(
            data.get("tiene_captura_evidencia"),
            plan.tiene_captura_evidencia
        )

        if not tiene_captura_evidencia:
            dias_retencion_evidencias = None

        try:

            plan.nombre = nombre
            plan.descripcion = descripcion or None

            plan.tiene_gps = tiene_gps

            plan.tiene_sensor_vibracion = (
                tiene_sensor_vibracion
            )

            plan.tiene_sensor_puerta = (
                tiene_sensor_puerta
            )

            plan.tiene_boton_panico = (
                tiene_boton_panico
            )

            plan.tiene_sirena = tiene_sirena

            plan.tiene_dashboard_web = (
                tiene_dashboard_web
            )

            plan.tiene_app_movil = tiene_app_movil

            plan.tiene_fpga = tiene_fpga

            plan.tiene_camara = tiene_camara

            plan.tiene_captura_evidencia = (
                tiene_captura_evidencia
            )

            plan.dias_retencion_gps = (
                dias_retencion_gps
            )

            plan.dias_retencion_alertas = (
                dias_retencion_alertas
            )

            plan.dias_retencion_evidencias = (
                dias_retencion_evidencias
            )

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Plan actualizado correctamente",
                "plan": serializar_plan_admin(plan)
            }), 200

        except Exception as e:

            db.session.rollback()

            print(
                "Error editando plan admin:",
                e
            )

            return jsonify({
                "error": "No se pudo actualizar el plan"
            }), 500
    
    # --------------------------------------------------------
    # PLANES - DESACTIVAR
    # --------------------------------------------------------
    @app.put("/api/admin/planes/<int:plan_id>/desactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_desactivar_plan(plan_id):

        plan = db.session.get(
            Plan,
            plan_id
        )

        if not plan:
            return jsonify({
                "error": "Plan no encontrado"
            }), 404

        if not plan.activo:
            return jsonify({
                "ok": True,
                "mensaje": "El plan ya estaba desactivado"
            }), 200

        try:

            plan.activo = False

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Plan desactivado correctamente",
                "plan": serializar_plan_admin(plan)
            }), 200

        except Exception as e:

            db.session.rollback()

            print(
                "Error desactivando plan admin:",
                e
            )

            return jsonify({
                "error": "No se pudo desactivar el plan"
            }), 500
    
    # --------------------------------------------------------
    # PLANES - REACTIVAR
    # --------------------------------------------------------
    @app.put("/api/admin/planes/<int:plan_id>/reactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reactivar_plan(plan_id):

        plan = db.session.get(
            Plan,
            plan_id
        )

        if not plan:
            return jsonify({
                "error": "Plan no encontrado"
            }), 404

        if plan.activo:
            return jsonify({
                "ok": True,
                "mensaje": "El plan ya estaba activo"
            }), 200

        try:

            plan.activo = True

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Plan reactivado correctamente",
                "plan": serializar_plan_admin(plan)
            }), 200

        except Exception as e:

            db.session.rollback()

            print(
                "Error reactivando plan admin:",
                e
            )

            return jsonify({
                "error": "No se pudo reactivar el plan"
            }), 500
    
    # --------------------------------------------------------
    # PLANES - OPCIONES PARA SELECT
    # --------------------------------------------------------
    @app.get("/api/admin/planes/opciones")
    @jwt_required()
    @rol_requerido("admin")
    def admin_planes_opciones():
        planes = (
            Plan.query
            .filter_by(activo=True)
            .order_by(Plan.nombre.asc())
            .all()
        )

        return jsonify({
            "ok": True,
            "planes": [
                {
                    "id": plan.id,
                    "nombre": plan.nombre,
                }
                for plan in planes
            ]
        }), 200
        
        
        
        
    # --------------------------------------------------------
    # DISPOSITIVOS - LISTAR
    # --------------------------------------------------------
    @app.get("/api/admin/dispositivos")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_dispositivos():
        dispositivos = (
            Dispositivo.query
            .order_by(Dispositivo.id.desc())
            .all()
        )

        return jsonify({
            "ok": True,
            "dispositivos": [
                serializar_dispositivo_admin(dispositivo)
                for dispositivo in dispositivos
            ]
        }), 200


    # --------------------------------------------------------
    # TARIFAS DE PLAN - LISTAR
    # --------------------------------------------------------
    @app.get("/api/admin/planes/<int:plan_id>/tarifas")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_tarifas_plan(plan_id):

        plan = db.session.get(
            Plan,
            plan_id
        )

        if not plan:
            return jsonify({
                "error": "Plan no encontrado"
            }), 404

        tarifas = (
            TarifaPlan.query
            .filter_by(plan_id=plan.id)
            .order_by(
                TarifaPlan.activo.desc(),
                TarifaPlan.cantidad_minima.asc()
            )
            .all()
        )

        return jsonify({
            "ok": True,

            "plan": {
                "id": plan.id,
                "nombre": plan.nombre,
                "activo": bool(plan.activo),
            },

            "tarifas": [
                serializar_tarifa_plan_admin(tarifa)
                for tarifa in tarifas
            ]
        }), 200
        
    
    # --------------------------------------------------------
    # TARIFAS DE PLAN - CREAR
    # --------------------------------------------------------
    @app.post("/api/admin/planes/<int:plan_id>/tarifas")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_tarifa_plan(plan_id):

        plan = db.session.get(
            Plan,
            plan_id
        )

        if not plan:
            return jsonify({
                "error": "Plan no encontrado"
            }), 404

        data = request.get_json(silent=True) or {}

        # ----------------------------------------------------
        # CANTIDADES
        # ----------------------------------------------------

        try:

            cantidad_minima = int(
                data.get("cantidad_minima")
            )

            cantidad_maxima = convertir_entero_nullable(
                data.get("cantidad_maxima")
            )

        except (TypeError, ValueError):
            return jsonify({
                "error": (
                    "Las cantidades deben ser "
                    "números enteros válidos"
                )
            }), 400

        if cantidad_minima < 1:
            return jsonify({
                "error": (
                    "La cantidad mínima debe ser "
                    "al menos 1"
                )
            }), 400

        if (
            cantidad_maxima is not None
            and cantidad_maxima < cantidad_minima
        ):
            return jsonify({
                "error": (
                    "La cantidad máxima no puede ser "
                    "menor que la cantidad mínima"
                )
            }), 400

        # ----------------------------------------------------
        # PRECIOS UNITARIOS
        # ----------------------------------------------------

        try:

            precio_dispositivo = (
                convertir_float_no_negativo(
                    data.get("precio_dispositivo"),
                    "El precio del dispositivo"
                )
            )

            costo_instalacion = (
                convertir_float_no_negativo(
                    data.get("costo_instalacion"),
                    "El costo de instalación"
                )
            )

            mensualidad = convertir_float_no_negativo(
                data.get("mensualidad"),
                "La mensualidad"
            )

            costo_mantenimiento = (
                convertir_float_no_negativo(
                    data.get("costo_mantenimiento"),
                    "El costo de mantenimiento"
                )
            )

        except ValueError as error:
            return jsonify({
                "error": str(error)
            }), 400

        # ----------------------------------------------------
        # VALIDAR SOLAPAMIENTO
        # ----------------------------------------------------

        conflicto = obtener_conflicto_rango_tarifa(
            plan_id=plan.id,
            cantidad_minima=cantidad_minima,
            cantidad_maxima=cantidad_maxima
        )

        if conflicto:

            return jsonify({
                "error": (
                    "El rango indicado se cruza con una "
                    "tarifa activa existente: "
                    f"{texto_rango_tarifa(conflicto)} vehículos"
                )
            }), 409

        try:

            tarifa = TarifaPlan(
                plan_id=plan.id,

                cantidad_minima=cantidad_minima,
                cantidad_maxima=cantidad_maxima,

                precio_dispositivo=precio_dispositivo,
                costo_instalacion=costo_instalacion,
                mensualidad=mensualidad,

                costo_mantenimiento=(
                    costo_mantenimiento
                ),

                activo=True
            )

            db.session.add(tarifa)
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Tarifa creada correctamente",

                "tarifa": (
                    serializar_tarifa_plan_admin(tarifa)
                )
            }), 201

        except Exception as e:

            db.session.rollback()

            print(
                "Error creando tarifa de plan:",
                e
            )

            return jsonify({
                "error": "No se pudo crear la tarifa"
            }), 500    
    
    # --------------------------------------------------------
    # TARIFAS DE PLAN - EDITAR
    # --------------------------------------------------------
    @app.put("/api/admin/tarifas/<int:tarifa_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_tarifa_plan(tarifa_id):

        tarifa = db.session.get(
            TarifaPlan,
            tarifa_id
        )

        if not tarifa:
            return jsonify({
                "error": "Tarifa no encontrada"
            }), 404

        data = request.get_json(silent=True) or {}

        try:

            cantidad_minima = int(
                data.get("cantidad_minima")
            )

            cantidad_maxima = convertir_entero_nullable(
                data.get("cantidad_maxima")
            )

        except (TypeError, ValueError):
            return jsonify({
                "error": (
                    "Las cantidades deben ser "
                    "números enteros válidos"
                )
            }), 400

        if cantidad_minima < 1:
            return jsonify({
                "error": (
                    "La cantidad mínima debe ser "
                    "al menos 1"
                )
            }), 400

        if (
            cantidad_maxima is not None
            and cantidad_maxima < cantidad_minima
        ):
            return jsonify({
                "error": (
                    "La cantidad máxima no puede ser "
                    "menor que la cantidad mínima"
                )
            }), 400

        try:

            precio_dispositivo = (
                convertir_float_no_negativo(
                    data.get("precio_dispositivo"),
                    "El precio del dispositivo"
                )
            )

            costo_instalacion = (
                convertir_float_no_negativo(
                    data.get("costo_instalacion"),
                    "El costo de instalación"
                )
            )

            mensualidad = convertir_float_no_negativo(
                data.get("mensualidad"),
                "La mensualidad"
            )

            costo_mantenimiento = (
                convertir_float_no_negativo(
                    data.get("costo_mantenimiento"),
                    "El costo de mantenimiento"
                )
            )

        except ValueError as error:
            return jsonify({
                "error": str(error)
            }), 400

        # Solo verificamos solapamiento si la tarifa
        # actualmente está activa.
        if tarifa.activo:

            conflicto = obtener_conflicto_rango_tarifa(
                plan_id=tarifa.plan_id,
                cantidad_minima=cantidad_minima,
                cantidad_maxima=cantidad_maxima,
                tarifa_excluir_id=tarifa.id
            )

            if conflicto:

                return jsonify({
                    "error": (
                        "El rango indicado se cruza con una "
                        "tarifa activa existente: "
                        f"{texto_rango_tarifa(conflicto)} vehículos"
                    )
                }), 409

        try:

            tarifa.cantidad_minima = cantidad_minima

            tarifa.cantidad_maxima = cantidad_maxima

            tarifa.precio_dispositivo = (
                precio_dispositivo
            )

            tarifa.costo_instalacion = (
                costo_instalacion
            )

            tarifa.mensualidad = mensualidad

            tarifa.costo_mantenimiento = (
                costo_mantenimiento
            )

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Tarifa actualizada correctamente",

                "tarifa": (
                    serializar_tarifa_plan_admin(tarifa)
                )
            }), 200

        except Exception as e:

            db.session.rollback()

            print(
                "Error editando tarifa de plan:",
                e
            )

            return jsonify({
                "error": "No se pudo actualizar la tarifa"
            }), 500
    
    # --------------------------------------------------------
    # TARIFAS DE PLAN - DESACTIVAR
    # --------------------------------------------------------
    @app.put("/api/admin/tarifas/<int:tarifa_id>/desactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_desactivar_tarifa_plan(tarifa_id):

        tarifa = db.session.get(
            TarifaPlan,
            tarifa_id
        )

        if not tarifa:
            return jsonify({
                "error": "Tarifa no encontrada"
            }), 404

        if not tarifa.activo:
            return jsonify({
                "ok": True,
                "mensaje": "La tarifa ya estaba desactivada"
            }), 200

        try:

            tarifa.activo = False

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Tarifa desactivada correctamente",

                "tarifa": (
                    serializar_tarifa_plan_admin(tarifa)
                )
            }), 200

        except Exception as e:

            db.session.rollback()

            print(
                "Error desactivando tarifa:",
                e
            )

            return jsonify({
                "error": "No se pudo desactivar la tarifa"
            }), 500
            
    # --------------------------------------------------------
    # TARIFAS DE PLAN - REACTIVAR
    # --------------------------------------------------------
    @app.put("/api/admin/tarifas/<int:tarifa_id>/reactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reactivar_tarifa_plan(tarifa_id):

        tarifa = db.session.get(
            TarifaPlan,
            tarifa_id
        )

        if not tarifa:
            return jsonify({
                "error": "Tarifa no encontrada"
            }), 404

        if tarifa.activo:
            return jsonify({
                "ok": True,
                "mensaje": "La tarifa ya estaba activa"
            }), 200

        conflicto = obtener_conflicto_rango_tarifa(
            plan_id=tarifa.plan_id,

            cantidad_minima=tarifa.cantidad_minima,

            cantidad_maxima=tarifa.cantidad_maxima,

            tarifa_excluir_id=tarifa.id
        )

        if conflicto:

            return jsonify({
                "error": (
                    "No puedes reactivar esta tarifa porque "
                    "su rango se cruza con una tarifa activa: "
                    f"{texto_rango_tarifa(conflicto)} vehículos"
                )
            }), 409

        try:

            tarifa.activo = True

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Tarifa reactivada correctamente",

                "tarifa": (
                    serializar_tarifa_plan_admin(tarifa)
                )
            }), 200

        except Exception as e:

            db.session.rollback()

            print(
                "Error reactivando tarifa:",
                e
            )

            return jsonify({
                "error": "No se pudo reactivar la tarifa"
            }), 500

    # --------------------------------------------------------
    # DISPOSITIVOS - GENERAR DATOS PREVIOS
    # --------------------------------------------------------
    @app.get("/api/admin/dispositivos/generar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_generar_datos_dispositivo():
        return jsonify({
            "ok": True,
            "serie": generar_siguiente_serie_dispositivo(),
            "pin_activacion": generar_pin_activacion(6)
        }), 200

    # --------------------------------------------------------
    # DISPOSITIVOS - CREAR
    # --------------------------------------------------------
    @app.post("/api/admin/dispositivos")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_dispositivo():
        data = request.get_json(silent=True) or {}

        serie = data.get("serie", "").strip().upper()
        pin_activacion = str(data.get("pin_activacion", "")).strip()

        imei = data.get("imei", "").strip()
        modelo = data.get("modelo", "").strip()
        firmware = data.get("firmware", "").strip()

        if not serie:
            serie = generar_siguiente_serie_dispositivo()

        if not pin_activacion:
            pin_activacion = generar_pin_activacion(6)

        if not re.match(r"^TS-\d{6}$", serie):
            return jsonify({
                "error": "La serie debe tener el formato TS-000001"
            }), 400

        if not pin_activacion.isdigit() or len(pin_activacion) not in [4, 6]:
            return jsonify({
                "error": "El PIN debe ser numérico de 4 o 6 dígitos"
            }), 400

        existe_serie = Dispositivo.query.filter_by(serie=serie).first()

        if existe_serie:
            return jsonify({
                "error": "Ya existe un dispositivo con esa serie"
            }), 409

        if imei:
            existe_imei = Dispositivo.query.filter_by(imei=imei).first()

            if existe_imei:
                return jsonify({
                    "error": "Ya existe un dispositivo con ese IMEI"
                }), 409

        try:
            dispositivo = Dispositivo(
                serie=serie,
                pin_activacion=pin_activacion,
                imei=imei or None,
                modelo=modelo or None,
                firmware=firmware or None,
                estado="disponible"
            )

            db.session.add(dispositivo)
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Dispositivo creado correctamente",
                "dispositivo": serializar_dispositivo_admin(dispositivo)
            }), 201

        except Exception as e:
            db.session.rollback()
            print("Error creando dispositivo:", e)

            return jsonify({
                "error": "No se pudo crear el dispositivo"
            }), 500

    # --------------------------------------------------------
    # DISPOSITIVOS - OBTENER UNO
    # --------------------------------------------------------
    @app.get("/api/admin/dispositivos/<int:dispositivo_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_dispositivo(dispositivo_id):
        dispositivo = db.session.get(Dispositivo, dispositivo_id)

        if not dispositivo:
            return jsonify({"error": "Dispositivo no encontrado"}), 404

        return jsonify({
            "ok": True,
            "dispositivo": serializar_dispositivo_admin(dispositivo)
        }), 200

    # --------------------------------------------------------
    # DISPOSITIVOS - EDITAR
    # --------------------------------------------------------
    @app.put("/api/admin/dispositivos/<int:dispositivo_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_dispositivo(dispositivo_id):
        dispositivo = db.session.get(Dispositivo, dispositivo_id)

        if not dispositivo:
            return jsonify({"error": "Dispositivo no encontrado"}), 404

        data = request.get_json(silent=True) or {}

        imei = data.get("imei", "").strip()
        modelo = data.get("modelo", "").strip()
        firmware = data.get("firmware", "").strip()
        pin_activacion = str(data.get("pin_activacion", "")).strip()

        if pin_activacion:
            if not pin_activacion.isdigit() or len(pin_activacion) not in [4, 6]:
                return jsonify({
                    "error": "El PIN debe ser numérico de 4 o 6 dígitos"
                }), 400

        if imei:
            existe_imei = Dispositivo.query.filter(
                Dispositivo.imei == imei,
                Dispositivo.id != dispositivo.id
            ).first()

            if existe_imei:
                return jsonify({
                    "error": "Ya existe otro dispositivo con ese IMEI"
                }), 409

        try:
            dispositivo.imei = imei or None
            dispositivo.modelo = modelo or None
            dispositivo.firmware = firmware or None

            if pin_activacion:
                dispositivo.pin_activacion = pin_activacion

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Dispositivo actualizado correctamente",
                "dispositivo": serializar_dispositivo_admin(dispositivo)
            }), 200

        except Exception as e:
            db.session.rollback()
            print("Error editando dispositivo:", e)

            return jsonify({
                "error": "No se pudo actualizar el dispositivo"
            }), 500

    # --------------------------------------------------------
    # DISPOSITIVOS - CAMBIAR ESTADO
    # --------------------------------------------------------
    @app.put("/api/admin/dispositivos/<int:dispositivo_id>/estado")
    @jwt_required()
    @rol_requerido("admin")
    def admin_cambiar_estado_dispositivo(dispositivo_id):
        dispositivo = db.session.get(Dispositivo, dispositivo_id)

        if not dispositivo:
            return jsonify({"error": "Dispositivo no encontrado"}), 404

        data = request.get_json(silent=True) or {}
        nuevo_estado = data.get("estado", "").strip().lower()

        estados_permitidos = [
            "disponible",
            "activo",
            "instalado",
            "mantenimiento",
            "desactivado"
        ]

        if nuevo_estado not in estados_permitidos:
            return jsonify({
                "error": "Estado de dispositivo no válido"
            }), 400

        vehiculo_vinculado = Vehiculo.query.filter_by(
            dispositivo_id=dispositivo.id
        ).first()

        # Para evitar inconsistencias:
        # - Si está vinculado a un vehículo, no debe quedar como disponible.
        # - Si está disponible, no debería tener empresa asignada.
        if vehiculo_vinculado and nuevo_estado == "disponible":
            return jsonify({
                "error": "No puedes marcar como disponible un dispositivo vinculado a un vehículo"
            }), 409

        try:
            dispositivo.estado = nuevo_estado

            if nuevo_estado == "disponible":
                dispositivo.empresa_id = None
                dispositivo.fecha_instalacion = None

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Estado actualizado correctamente",
                "dispositivo": serializar_dispositivo_admin(dispositivo)
            }), 200

        except Exception as e:
            db.session.rollback()
            print("Error cambiando estado del dispositivo:", e)

            return jsonify({
                "error": "No se pudo cambiar el estado del dispositivo"
            }), 500
        

    # --------------------------------------------------------
    # USUARIOS ADMIN - LISTAR
    # --------------------------------------------------------
    @app.get("/api/admin/usuarios")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_usuarios():
        usuarios = (
            Usuario.query
            .order_by(Usuario.id.desc())
            .all()
        )

        return jsonify({
            "ok": True,
            "usuarios": [
                serializar_usuario_admin(usuario)
                for usuario in usuarios
            ]
        }), 200
    
    # --------------------------------------------------------
    # USUARIOS ADMIN - OBTENER UNO
    # --------------------------------------------------------
    @app.get("/api/admin/usuarios/<int:usuario_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)

        if not usuario:
            return jsonify({
                "error": "Usuario no encontrado"
            }), 404

        return jsonify({
            "ok": True,
            "usuario": serializar_usuario_admin(usuario)
        }), 200
    
    # --------------------------------------------------------
    # USUARIOS ADMIN - CREAR
    # --------------------------------------------------------
    @app.post("/api/admin/usuarios")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_usuario():
        data = request.get_json(silent=True) or {}

        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        telefono = data.get("telefono", "").strip()
        password = data.get("password", "").strip()
        tipo = data.get("tipo", "").strip().lower()
        empresa_id = data.get("empresa_id")

        if not nombre:
            return jsonify({
                "error": "El nombre es requerido"
            }), 400

        if not correo:
            return jsonify({
                "error": "El correo es requerido"
            }), 400

        if not password:
            return jsonify({
                "error": "La contraseña es requerida"
            }), 400

        if len(password) < 6:
            return jsonify({
                "error": "La contraseña debe tener al menos 6 caracteres"
            }), 400

        tipos_permitidos = [
            "admin",
            "dueno",
            "supervisor",
            "chofer",
            "tecnico"
        ]

        if tipo not in tipos_permitidos:
            return jsonify({
                "error": "Tipo de usuario no válido"
            }), 400

        existe_correo = Usuario.query.filter_by(correo=correo).first()

        if existe_correo:
            return jsonify({
                "error": "Ya existe un usuario con ese correo"
            }), 409

        # ----------------------------------------------------
        # REGLAS DE EMPRESA SEGÚN ROL
        # ----------------------------------------------------

        if tipo in ("dueno", "supervisor", "chofer"):
            if not empresa_id:
                return jsonify({
                    "error": "Debes seleccionar una empresa para este tipo de usuario"
                }), 400

            empresa = db.session.get(Empresa, int(empresa_id))

            if not empresa:
                return jsonify({
                    "error": "La empresa seleccionada no existe"
                }), 404

        elif tipo in ("admin", "tecnico"):

            # Administradores y técnicos son usuarios globales,
            # por lo que no pertenecen a una empresa específica.
            empresa_id = None

        try:
            nuevo_usuario = Usuario(
                nombre=nombre,
                correo=correo,
                telefono=telefono or None,
                password=hashear_password(password),
                tipo=tipo,
                empresa_id=int(empresa_id) if empresa_id else None,
                activo=True,
            )

            db.session.add(nuevo_usuario)
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Usuario creado correctamente",
                "usuario": serializar_usuario_admin(nuevo_usuario)
            }), 201

        except Exception as e:
            db.session.rollback()
            print("Error creando usuario admin:", e)

            return jsonify({
                "error": "No se pudo crear el usuario"
            }), 500
            
        # --------------------------------------------------------
    # USUARIOS ADMIN - EDITAR
    # --------------------------------------------------------
    @app.put("/api/admin/usuarios/<int:usuario_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)

        if not usuario:
            return jsonify({
                "error": "Usuario no encontrado"
            }), 404
            
        usuario_actual = obtener_usuario_actual()

        if not usuario_actual:
            return jsonify({
                "error": "Sesión no válida"
            }), 401

        data = request.get_json(silent=True) or {}

        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        telefono = data.get("telefono", "").strip()
        tipo = data.get("tipo", "").strip().lower()
        empresa_id = data.get("empresa_id")

        if not nombre:
            return jsonify({
                "error": "El nombre es requerido"
            }), 400

        if not correo:
            return jsonify({
                "error": "El correo es requerido"
            }), 400

        tipos_permitidos = [
            "admin",
            "dueno",
            "supervisor",
            "chofer",
            "tecnico"
        ]

        if tipo not in tipos_permitidos:
            return jsonify({
                "error": "Tipo de usuario no válido"
            }), 400
        
        # ----------------------------------------------------
        # PROTECCIÓN: NO CAMBIAR EL PROPIO ROL
        # ----------------------------------------------------

        if (
            usuario.id == usuario_actual.id
            and usuario.tipo != tipo
        ):
            return jsonify({
                "error": "No puedes cambiar tu propio rol mientras tienes la sesión iniciada"
            }), 409
        
        # ----------------------------------------------------
        # PROTECCIÓN: NO QUITAR EL ROL AL ÚLTIMO ADMIN ACTIVO
        # ----------------------------------------------------

        if (
            usuario.tipo == "admin"
            and usuario.activo is True
            and tipo != "admin"
            and contar_administradores_activos() <= 1
        ):
            return jsonify({
                "error": (
                    "No puedes cambiar el rol de este usuario porque es "
                    "el último administrador activo del sistema"
                )
            }), 409
        
        existe_correo = Usuario.query.filter(
            Usuario.correo == correo,
            Usuario.id != usuario.id
        ).first()

        if existe_correo:
            return jsonify({
                "error": "Ya existe otro usuario con ese correo"
            }), 409

        if usuario.tipo == "chofer" and tipo != "chofer":
            vehiculo_asignado = Vehiculo.query.filter_by(
                chofer_id=usuario.id,
                activo=True
            ).first()

            if vehiculo_asignado:
                return jsonify({
                    "error": (
                        f"No puedes cambiar el rol de este chofer porque está "
                        f"asignado al vehículo {vehiculo_asignado.nombre}"
                    )
                }), 409
        
        if tipo in ("dueno", "supervisor", "chofer"):
            if not empresa_id:
                return jsonify({
                    "error": "Debes seleccionar una empresa para este tipo de usuario"
                }), 400

            empresa = db.session.get(Empresa, int(empresa_id))

            if not empresa:
                return jsonify({
                    "error": "La empresa seleccionada no existe"
                }), 404

        elif tipo in ("admin", "tecnico"):
            empresa_id = None

        try:
            usuario.nombre = nombre
            usuario.correo = correo
            usuario.telefono = telefono or None
            usuario.tipo = tipo
            usuario.empresa_id = int(empresa_id) if empresa_id else None

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Usuario actualizado correctamente",
                "usuario": serializar_usuario_admin(usuario)
            }), 200

        except Exception as e:
            db.session.rollback()
            print("Error editando usuario admin:", e)

            return jsonify({
                "error": "No se pudo actualizar el usuario"
            }), 500
            
    # --------------------------------------------------------
    # USUARIOS ADMIN - DESACTIVAR
    # --------------------------------------------------------
    @app.put("/api/admin/usuarios/<int:usuario_id>/desactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_desactivar_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)

        if not usuario:
            return jsonify({
                "error": "Usuario no encontrado"
            }), 404

        usuario_actual = obtener_usuario_actual()

        if not usuario_actual:
            return jsonify({
                "error": "Sesión no válida"
            }), 401

        if usuario.id == usuario_actual.id:
            return jsonify({
                "error": "No puedes desactivar tu propia cuenta"
            }), 409

        if (
            usuario.tipo == "admin"
            and usuario.activo is True
            and contar_administradores_activos() <= 1
        ):
            return jsonify({
                "error": (
                    "No puedes desactivar este usuario porque es "
                    "el último administrador activo del sistema"
                )
            }), 409

        try:
            usuario.activo = False
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Usuario desactivado correctamente"
            }), 200

        except Exception as e:
            db.session.rollback()
            print("Error desactivando usuario admin:", e)

            return jsonify({
                "error": "No se pudo desactivar el usuario"
            }), 500
            
    # --------------------------------------------------------
    # USUARIOS ADMIN - REACTIVAR
    # --------------------------------------------------------
    @app.put("/api/admin/usuarios/<int:usuario_id>/reactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reactivar_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)

        if not usuario:
            return jsonify({
                "error": "Usuario no encontrado"
            }), 404

        try:
            usuario.activo = True
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Usuario reactivado correctamente",
                "usuario": serializar_usuario_admin(usuario)
            }), 200

        except Exception as e:
            db.session.rollback()
            print("Error reactivando usuario admin:", e)

            return jsonify({
                "error": "No se pudo reactivar el usuario"
            }), 500
            
    # --------------------------------------------------------
    # USUARIOS ADMIN - RESET PASSWORD
    # --------------------------------------------------------
    @app.put("/api/admin/usuarios/<int:usuario_id>/reset-password")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reset_password_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)

        if not usuario:
            return jsonify({
                "error": "Usuario no encontrado"
            }), 404

        data = request.get_json(silent=True) or {}
        nueva_password = data.get("password", "").strip()

        if len(nueva_password) < 6:
            return jsonify({
                "error": "La contraseña debe tener al menos 6 caracteres"
            }), 400

        try:
            usuario.password = hashear_password(nueva_password)

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Contraseña actualizada correctamente"
            }), 200

        except Exception as e:
            db.session.rollback()
            print("Error reseteando contraseña:", e)

            return jsonify({
                "error": "No se pudo actualizar la contraseña"
            }), 500