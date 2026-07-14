# ============================================================
# ROUTES ADMIN - SUSCRIPCIONES
# TrackSecurity
# ============================================================
#
# Endpoints exclusivos para la administración global de
# suscripciones.
#
# Reglas principales:
# - Una empresa solo puede tener una suscripción activa.
# - La empresa y el plan deben estar activos al crear.
# - La tarifa se detecta automáticamente según:
#       plan_id + cantidad_vehiculos
# - Los precios sugeridos se copian desde TarifaPlan.
# - El admin puede guardar precios acordados diferentes.
# - Los cambios posteriores en TarifaPlan NO modifican
#   suscripciones existentes.
# - Empresa.plan_id se mantiene sincronizado con la
#   suscripción activa.
# ============================================================

from flask import jsonify, request
from flask_jwt_extended import jwt_required

from config import db
from decorators import rol_requerido
from models import (
    Empresa,
    Plan,
    TarifaPlan,
    Suscripcion
)


# ============================================================
# CONSTANTES
# ============================================================

ESTADOS_SUSCRIPCION = [
    "activa",
    "suspendida",
    "vencida",
    "cancelada"
]


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def convertir_float_no_negativo(valor, nombre_campo):
    """
    Convierte un valor a float y valida que no sea negativo.
    """

    try:
        numero = float(valor)

    except (TypeError, ValueError):
        raise ValueError(
            f"{nombre_campo} debe ser un número válido"
        )

    if numero < 0:
        raise ValueError(
            f"{nombre_campo} no puede ser negativo"
        )

    return numero


def encontrar_tarifa_para_cantidad(plan_id, cantidad_vehiculos):
    """
    Busca la tarifa activa del plan cuyo rango contenga
    la cantidad de vehículos indicada.

    Ejemplos:
    - 1 a 4
    - 5 a 9
    - 10 a 19
    - 20 o más -> cantidad_maxima = None
    """

    tarifas = (
        TarifaPlan.query
        .filter_by(
            plan_id=plan_id,
            activo=True
        )
        .order_by(
            TarifaPlan.cantidad_minima.asc()
        )
        .all()
    )

    for tarifa in tarifas:

        cumple_minimo = (
            cantidad_vehiculos
            >= tarifa.cantidad_minima
        )

        cumple_maximo = (
            tarifa.cantidad_maxima is None
            or cantidad_vehiculos
            <= tarifa.cantidad_maxima
        )

        if cumple_minimo and cumple_maximo:
            return tarifa

    return None


def texto_rango_tarifa(tarifa):
    """
    Devuelve el rango de una tarifa en texto legible.
    """

    if not tarifa:
        return None

    if tarifa.cantidad_maxima is None:
        return f"{tarifa.cantidad_minima} o más"

    if (
        tarifa.cantidad_minima
        == tarifa.cantidad_maxima
    ):
        return str(tarifa.cantidad_minima)

    return (
        f"{tarifa.cantidad_minima} a "
        f"{tarifa.cantidad_maxima}"
    )


def obtener_empresa_suscripcion(suscripcion):
    return db.session.get(
        Empresa,
        suscripcion.empresa_id
    )


def obtener_plan_suscripcion(suscripcion):
    return db.session.get(
        Plan,
        suscripcion.plan_id
    )


def obtener_tarifa_suscripcion(suscripcion):
    if not suscripcion.tarifa_plan_id:
        return None

    return db.session.get(
        TarifaPlan,
        suscripcion.tarifa_plan_id
    )


def calcular_totales_suscripcion(
    cantidad_vehiculos,
    precio_dispositivo_unitario,
    costo_instalacion_unitario,
    mensualidad_unitaria,
    costo_mantenimiento_unitario
):
    """
    Calcula los importes totales de la suscripción.
    """

    return {
        "monto_dispositivos_total": (
            cantidad_vehiculos
            * precio_dispositivo_unitario
        ),

        "monto_instalacion_total": (
            cantidad_vehiculos
            * costo_instalacion_unitario
        ),

        "monto_mensual": (
            cantidad_vehiculos
            * mensualidad_unitaria
        ),

        "monto_mantenimiento_total": (
            cantidad_vehiculos
            * costo_mantenimiento_unitario
        ),
    }


def obtener_precios_suscripcion_desde_data(
    data,
    tarifa
):
    """
    Toma los precios acordados enviados por el frontend.

    Si algún precio no fue enviado, utiliza el valor sugerido
    de la tarifa detectada.
    """

    campos = [
        (
            "precio_dispositivo_unitario",
            tarifa.precio_dispositivo,
            "El precio del dispositivo"
        ),
        (
            "costo_instalacion_unitario",
            tarifa.costo_instalacion,
            "El costo de instalación"
        ),
        (
            "mensualidad_unitaria",
            tarifa.mensualidad,
            "La mensualidad"
        ),
        (
            "costo_mantenimiento_unitario",
            tarifa.costo_mantenimiento,
            "El costo de mantenimiento"
        ),
    ]

    precios = {}

    for campo, valor_sugerido, nombre in campos:

        valor = data.get(campo)

        if valor in (None, ""):
            valor = valor_sugerido

        precios[campo] = convertir_float_no_negativo(
            valor,
            nombre
        )

    return precios


def empresa_tiene_otra_suscripcion_activa(
    empresa_id,
    suscripcion_excluir_id=None
):
    """
    Valida si una empresa ya tiene otra suscripción activa.
    """

    consulta = Suscripcion.query.filter_by(
        empresa_id=empresa_id,
        estado="activa"
    )

    if suscripcion_excluir_id:
        consulta = consulta.filter(
            Suscripcion.id != suscripcion_excluir_id
        )

    return consulta.first()


def serializar_tarifa_referencia(tarifa):
    if not tarifa:
        return None

    return {
        "id": tarifa.id,
        "plan_id": tarifa.plan_id,

        "cantidad_minima": tarifa.cantidad_minima,
        "cantidad_maxima": tarifa.cantidad_maxima,
        "rango_texto": texto_rango_tarifa(tarifa),

        "precio_dispositivo": tarifa.precio_dispositivo,
        "costo_instalacion": tarifa.costo_instalacion,
        "mensualidad": tarifa.mensualidad,
        "costo_mantenimiento": (
            tarifa.costo_mantenimiento
        ),

        "activo": bool(tarifa.activo),
    }


def serializar_suscripcion_admin(suscripcion):
    """
    Serializa una suscripción para el panel admin.
    """

    empresa = obtener_empresa_suscripcion(
        suscripcion
    )

    plan = obtener_plan_suscripcion(
        suscripcion
    )

    tarifa = obtener_tarifa_suscripcion(
        suscripcion
    )

    return {
        "id": suscripcion.id,

        "empresa_id": suscripcion.empresa_id,
        "empresa_nombre": (
            empresa.nombre
            if empresa
            else None
        ),

        "plan_id": suscripcion.plan_id,
        "plan_nombre": (
            plan.nombre
            if plan
            else None
        ),

        "tarifa_plan_id": (
            suscripcion.tarifa_plan_id
        ),

        "tarifa_referencia": (
            serializar_tarifa_referencia(tarifa)
        ),

        "cantidad_vehiculos": (
            suscripcion.cantidad_vehiculos
        ),

        # Precios acordados
        "precio_dispositivo_unitario": (
            suscripcion.precio_dispositivo_unitario
        ),

        "costo_instalacion_unitario": (
            suscripcion.costo_instalacion_unitario
        ),

        "mensualidad_unitaria": (
            suscripcion.mensualidad_unitaria
        ),

        "costo_mantenimiento_unitario": (
            suscripcion.costo_mantenimiento_unitario
        ),

        # Totales
        "monto_dispositivos_total": (
            suscripcion.monto_dispositivos_total
        ),

        "monto_instalacion_total": (
            suscripcion.monto_instalacion_total
        ),

        "monto_mensual": (
            suscripcion.monto_mensual
        ),

        "monto_mantenimiento_total": (
            suscripcion.monto_mantenimiento_total
        ),

        "estado": suscripcion.estado,

        "fecha_inicio": suscripcion.fecha_inicio,
        "fecha_fin": suscripcion.fecha_fin,
    }


def sincronizar_plan_empresa(empresa_id):
    """
    Sincroniza Empresa.plan_id con su suscripción activa.

    Si existe una suscripción activa:
        empresa.plan_id = suscripcion.plan_id

    Si no existe:
        empresa.plan_id = None
    """

    empresa = db.session.get(
        Empresa,
        empresa_id
    )

    if not empresa:
        return

    suscripcion_activa = (
        Suscripcion.query
        .filter_by(
            empresa_id=empresa_id,
            estado="activa"
        )
        .order_by(
            Suscripcion.id.desc()
        )
        .first()
    )

    empresa.plan_id = (
        suscripcion_activa.plan_id
        if suscripcion_activa
        else None
    )


# ============================================================
# REGISTRO DE RUTAS
# ============================================================

def registrar_admin_suscripciones_routes(app):

    # --------------------------------------------------------
    # SUSCRIPCIONES - LISTAR
    # --------------------------------------------------------
    @app.get("/api/admin/suscripciones")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_suscripciones():

        suscripciones = (
            Suscripcion.query
            .order_by(
                Suscripcion.id.desc()
            )
            .all()
        )

        return jsonify({
            "ok": True,
            "suscripciones": [
                serializar_suscripcion_admin(
                    suscripcion
                )
                for suscripcion in suscripciones
            ]
        }), 200


    # --------------------------------------------------------
    # SUSCRIPCIONES - OBTENER UNA
    # --------------------------------------------------------
    @app.get(
        "/api/admin/suscripciones/"
        "<int:suscripcion_id>"
    )
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_suscripcion(
        suscripcion_id
    ):

        suscripcion = db.session.get(
            Suscripcion,
            suscripcion_id
        )

        if not suscripcion:
            return jsonify({
                "error": "Suscripción no encontrada"
            }), 404

        return jsonify({
            "ok": True,
            "suscripcion": (
                serializar_suscripcion_admin(
                    suscripcion
                )
            )
        }), 200


    # --------------------------------------------------------
    # SUSCRIPCIONES - DETECTAR TARIFA
    # --------------------------------------------------------
    @app.get(
        "/api/admin/suscripciones/"
        "detectar-tarifa"
    )
    @jwt_required()
    @rol_requerido("admin")
    def admin_detectar_tarifa_suscripcion():

        plan_id = request.args.get(
            "plan_id",
            type=int
        )

        cantidad_vehiculos = request.args.get(
            "cantidad_vehiculos",
            type=int
        )

        if not plan_id:
            return jsonify({
                "error": "Debes seleccionar un plan"
            }), 400

        if (
            not cantidad_vehiculos
            or cantidad_vehiculos < 1
        ):
            return jsonify({
                "error": (
                    "La cantidad de vehículos debe ser "
                    "al menos 1"
                )
            }), 400

        plan = db.session.get(
            Plan,
            plan_id
        )

        if not plan:
            return jsonify({
                "error": "Plan no encontrado"
            }), 404

        tarifa = encontrar_tarifa_para_cantidad(
            plan_id=plan.id,
            cantidad_vehiculos=cantidad_vehiculos
        )

        if not tarifa:
            return jsonify({
                "error": (
                    "No existe una tarifa activa para "
                    "esa cantidad de vehículos"
                )
            }), 404

        return jsonify({
            "ok": True,
            "plan": {
                "id": plan.id,
                "nombre": plan.nombre,
                "activo": bool(plan.activo),
            },
            "tarifa": (
                serializar_tarifa_referencia(
                    tarifa
                )
            )
        }), 200


    # --------------------------------------------------------
    # SUSCRIPCIONES - CREAR
    # --------------------------------------------------------
    @app.post("/api/admin/suscripciones")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_suscripcion():

        data = request.get_json(
            silent=True
        ) or {}

        empresa_id = data.get("empresa_id")
        plan_id = data.get("plan_id")

        try:
            empresa_id = int(empresa_id)
            plan_id = int(plan_id)

            cantidad_vehiculos = int(
                data.get("cantidad_vehiculos")
            )

        except (TypeError, ValueError):
            return jsonify({
                "error": (
                    "Empresa, plan y cantidad de vehículos "
                    "deben ser válidos"
                )
            }), 400

        if cantidad_vehiculos < 1:
            return jsonify({
                "error": (
                    "La cantidad de vehículos debe ser "
                    "al menos 1"
                )
            }), 400

        empresa = db.session.get(
            Empresa,
            empresa_id
        )

        if not empresa:
            return jsonify({
                "error": "Empresa no encontrada"
            }), 404

        if not empresa.activo:
            return jsonify({
                "error": (
                    "No puedes crear una suscripción "
                    "para una empresa inactiva"
                )
            }), 409

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
                "error": (
                    "No puedes crear una suscripción "
                    "con un plan inactivo"
                )
            }), 409

        existente = (
            empresa_tiene_otra_suscripcion_activa(
                empresa_id
            )
        )

        if existente:
            return jsonify({
                "error": (
                    "La empresa ya tiene una suscripción "
                    "activa"
                )
            }), 409

        tarifa = encontrar_tarifa_para_cantidad(
            plan_id=plan.id,
            cantidad_vehiculos=cantidad_vehiculos
        )

        if not tarifa:
            return jsonify({
                "error": (
                    "No existe una tarifa activa para "
                    "esa cantidad de vehículos"
                )
            }), 409

        try:
            precios = (
                obtener_precios_suscripcion_desde_data(
                    data,
                    tarifa
                )
            )

        except ValueError as error:
            return jsonify({
                "error": str(error)
            }), 400

        totales = calcular_totales_suscripcion(
            cantidad_vehiculos=(
                cantidad_vehiculos
            ),

            precio_dispositivo_unitario=(
                precios[
                    "precio_dispositivo_unitario"
                ]
            ),

            costo_instalacion_unitario=(
                precios[
                    "costo_instalacion_unitario"
                ]
            ),

            mensualidad_unitaria=(
                precios[
                    "mensualidad_unitaria"
                ]
            ),

            costo_mantenimiento_unitario=(
                precios[
                    "costo_mantenimiento_unitario"
                ]
            )
        )

        try:
            suscripcion = Suscripcion(
                empresa_id=empresa.id,
                plan_id=plan.id,

                tarifa_plan_id=tarifa.id,

                cantidad_vehiculos=(
                    cantidad_vehiculos
                ),

                precio_dispositivo_unitario=(
                    precios[
                        "precio_dispositivo_unitario"
                    ]
                ),

                costo_instalacion_unitario=(
                    precios[
                        "costo_instalacion_unitario"
                    ]
                ),

                mensualidad_unitaria=(
                    precios[
                        "mensualidad_unitaria"
                    ]
                ),

                costo_mantenimiento_unitario=(
                    precios[
                        "costo_mantenimiento_unitario"
                    ]
                ),

                monto_dispositivos_total=(
                    totales[
                        "monto_dispositivos_total"
                    ]
                ),

                monto_instalacion_total=(
                    totales[
                        "monto_instalacion_total"
                    ]
                ),

                monto_mensual=(
                    totales[
                        "monto_mensual"
                    ]
                ),

                monto_mantenimiento_total=(
                    totales[
                        "monto_mantenimiento_total"
                    ]
                ),

                estado="activa"
            )

            db.session.add(suscripcion)
            db.session.flush()

            sincronizar_plan_empresa(
                empresa.id
            )

            db.session.commit()

            return jsonify({
                "ok": True,

                "mensaje": (
                    "Suscripción creada correctamente"
                ),

                "suscripcion": (
                    serializar_suscripcion_admin(
                        suscripcion
                    )
                )
            }), 201

        except Exception as e:
            db.session.rollback()

            print(
                "Error creando suscripción admin:",
                e
            )

            return jsonify({
                "error": (
                    "No se pudo crear la suscripción"
                )
            }), 500


    # --------------------------------------------------------
    # SUSCRIPCIONES - EDITAR
    # --------------------------------------------------------
    @app.put(
        "/api/admin/suscripciones/"
        "<int:suscripcion_id>"
    )
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_suscripcion(
        suscripcion_id
    ):

        suscripcion = db.session.get(
            Suscripcion,
            suscripcion_id
        )

        if not suscripcion:
            return jsonify({
                "error": "Suscripción no encontrada"
            }), 404

        data = request.get_json(
            silent=True
        ) or {}

        empresa_anterior_id = (
            suscripcion.empresa_id
        )

        try:
            empresa_id = int(
                data.get(
                    "empresa_id",
                    suscripcion.empresa_id
                )
            )

            plan_id = int(
                data.get(
                    "plan_id",
                    suscripcion.plan_id
                )
            )

            cantidad_vehiculos = int(
                data.get(
                    "cantidad_vehiculos",
                    suscripcion.cantidad_vehiculos
                )
            )

        except (TypeError, ValueError):
            return jsonify({
                "error": (
                    "Empresa, plan y cantidad de vehículos "
                    "deben ser válidos"
                )
            }), 400

        if cantidad_vehiculos < 1:
            return jsonify({
                "error": (
                    "La cantidad de vehículos debe ser "
                    "al menos 1"
                )
            }), 400

        empresa = db.session.get(
            Empresa,
            empresa_id
        )

        if not empresa:
            return jsonify({
                "error": "Empresa no encontrada"
            }), 404

        plan = db.session.get(
            Plan,
            plan_id
        )

        if not plan:
            return jsonify({
                "error": "Plan no encontrado"
            }), 404

        # Si la suscripción está activa, no debe generar
        # duplicidad de suscripciones activas para la empresa.
        if suscripcion.estado == "activa":

            existente = (
                empresa_tiene_otra_suscripcion_activa(
                    empresa_id=empresa.id,
                    suscripcion_excluir_id=(
                        suscripcion.id
                    )
                )
            )

            if existente:
                return jsonify({
                    "error": (
                        "La empresa ya tiene otra "
                        "suscripción activa"
                    )
                }), 409

        tarifa = encontrar_tarifa_para_cantidad(
            plan_id=plan.id,
            cantidad_vehiculos=cantidad_vehiculos
        )

        if not tarifa:
            return jsonify({
                "error": (
                    "No existe una tarifa activa para "
                    "esa cantidad de vehículos"
                )
            }), 409

        try:
            precios = (
                obtener_precios_suscripcion_desde_data(
                    data,
                    tarifa
                )
            )

        except ValueError as error:
            return jsonify({
                "error": str(error)
            }), 400

        totales = calcular_totales_suscripcion(
            cantidad_vehiculos=(
                cantidad_vehiculos
            ),

            precio_dispositivo_unitario=(
                precios[
                    "precio_dispositivo_unitario"
                ]
            ),

            costo_instalacion_unitario=(
                precios[
                    "costo_instalacion_unitario"
                ]
            ),

            mensualidad_unitaria=(
                precios[
                    "mensualidad_unitaria"
                ]
            ),

            costo_mantenimiento_unitario=(
                precios[
                    "costo_mantenimiento_unitario"
                ]
            )
        )

        try:
            suscripcion.empresa_id = empresa.id
            suscripcion.plan_id = plan.id

            suscripcion.tarifa_plan_id = (
                tarifa.id
            )

            suscripcion.cantidad_vehiculos = (
                cantidad_vehiculos
            )

            suscripcion.precio_dispositivo_unitario = (
                precios[
                    "precio_dispositivo_unitario"
                ]
            )

            suscripcion.costo_instalacion_unitario = (
                precios[
                    "costo_instalacion_unitario"
                ]
            )

            suscripcion.mensualidad_unitaria = (
                precios[
                    "mensualidad_unitaria"
                ]
            )

            suscripcion.costo_mantenimiento_unitario = (
                precios[
                    "costo_mantenimiento_unitario"
                ]
            )

            suscripcion.monto_dispositivos_total = (
                totales[
                    "monto_dispositivos_total"
                ]
            )

            suscripcion.monto_instalacion_total = (
                totales[
                    "monto_instalacion_total"
                ]
            )

            suscripcion.monto_mensual = (
                totales[
                    "monto_mensual"
                ]
            )

            suscripcion.monto_mantenimiento_total = (
                totales[
                    "monto_mantenimiento_total"
                ]
            )

            # Si cambió de empresa, actualizar también
            # la empresa anterior.
            if (
                empresa_anterior_id
                != empresa.id
            ):
                sincronizar_plan_empresa(
                    empresa_anterior_id
                )

            sincronizar_plan_empresa(
                empresa.id
            )

            db.session.commit()

            return jsonify({
                "ok": True,

                "mensaje": (
                    "Suscripción actualizada correctamente"
                ),

                "suscripcion": (
                    serializar_suscripcion_admin(
                        suscripcion
                    )
                )
            }), 200

        except Exception as e:
            db.session.rollback()

            print(
                "Error editando suscripción admin:",
                e
            )

            return jsonify({
                "error": (
                    "No se pudo actualizar la suscripción"
                )
            }), 500


    # --------------------------------------------------------
    # SUSCRIPCIONES - CAMBIAR ESTADO
    # --------------------------------------------------------
    @app.put(
        "/api/admin/suscripciones/"
        "<int:suscripcion_id>/estado"
    )
    @jwt_required()
    @rol_requerido("admin")
    def admin_cambiar_estado_suscripcion(
        suscripcion_id
    ):

        suscripcion = db.session.get(
            Suscripcion,
            suscripcion_id
        )

        if not suscripcion:
            return jsonify({
                "error": "Suscripción no encontrada"
            }), 404

        data = request.get_json(
            silent=True
        ) or {}

        nuevo_estado = (
            data.get("estado", "")
            .strip()
            .lower()
        )

        if (
            nuevo_estado
            not in ESTADOS_SUSCRIPCION
        ):
            return jsonify({
                "error": (
                    "Estado de suscripción no válido"
                )
            }), 400

        if nuevo_estado == suscripcion.estado:
            return jsonify({
                "ok": True,
                "mensaje": (
                    "La suscripción ya tiene ese estado"
                ),
                "suscripcion": (
                    serializar_suscripcion_admin(
                        suscripcion
                    )
                )
            }), 200

        # Al reactivar, evitar dos suscripciones activas.
        if nuevo_estado == "activa":

            existente = (
                empresa_tiene_otra_suscripcion_activa(
                    empresa_id=(
                        suscripcion.empresa_id
                    ),
                    suscripcion_excluir_id=(
                        suscripcion.id
                    )
                )
            )

            if existente:
                return jsonify({
                    "error": (
                        "La empresa ya tiene otra "
                        "suscripción activa"
                    )
                }), 409

            empresa = db.session.get(
                Empresa,
                suscripcion.empresa_id
            )

            if not empresa:
                return jsonify({
                    "error": (
                        "La empresa de la suscripción "
                        "ya no existe"
                    )
                }), 404

            if not empresa.activo:
                return jsonify({
                    "error": (
                        "No puedes activar la suscripción "
                        "de una empresa inactiva"
                    )
                }), 409

        try:
            suscripcion.estado = nuevo_estado

            sincronizar_plan_empresa(
                suscripcion.empresa_id
            )

            db.session.commit()

            mensajes = {
                "activa": (
                    "Suscripción activada correctamente"
                ),
                "suspendida": (
                    "Suscripción suspendida correctamente"
                ),
                "vencida": (
                    "Suscripción marcada como vencida"
                ),
                "cancelada": (
                    "Suscripción cancelada correctamente"
                ),
            }

            return jsonify({
                "ok": True,

                "mensaje": mensajes.get(
                    nuevo_estado,
                    "Estado actualizado correctamente"
                ),

                "suscripcion": (
                    serializar_suscripcion_admin(
                        suscripcion
                    )
                )
            }), 200

        except Exception as e:
            db.session.rollback()

            print(
                "Error cambiando estado de suscripción:",
                e
            )

            return jsonify({
                "error": (
                    "No se pudo cambiar el estado "
                    "de la suscripción"
                )
            }), 500