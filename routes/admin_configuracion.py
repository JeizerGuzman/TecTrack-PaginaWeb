# ============================================================
# CONFIGURACIÓN GLOBAL DEL SISTEMA - ADMINISTRADOR
# TrackSecurity
# ============================================================

from flask import jsonify, request
from flask_jwt_extended import jwt_required

from config import db
from models import ConfiguracionSistema
from decorators import rol_requerido
from helpers import (
    timestamp_actual,
    obtener_configuracion_sistema,
)

# ============================================================
# SERIALIZAR CONFIGURACIÓN COMPLETA
# ============================================================

def serializar_configuracion_sistema(configuracion):

    return {

        # ====================================================
        # GENERAL
        # ====================================================

        "general": {
            "nombre_plataforma":
                configuracion.nombre_plataforma,

            "correo_soporte":
                configuracion.correo_soporte,

            "telefono_soporte":
                configuracion.telefono_soporte,
        },


        # ====================================================
        # MONITOREO
        # ====================================================

        "monitoreo": {
            "segundos_sin_senal":
                configuracion.segundos_sin_senal,
        },

        
        "alertas": {
            "segundos_separacion_alertas":
                configuracion.segundos_separacion_alertas,
        },

        # ====================================================
        # PANEL ADMINISTRADOR
        # ====================================================

        "panel_admin": {
            "dashboard":
                configuracion.refresh_admin_dashboard_segundos,

            "empresas":
                configuracion.refresh_admin_empresas_segundos,

            "suscripciones":
                configuracion.refresh_admin_suscripciones_segundos,

            "planes":
                configuracion.refresh_admin_planes_segundos,

            "usuarios":
                configuracion.refresh_admin_usuarios_segundos,

            "vehiculos":
                configuracion.refresh_admin_vehiculos_segundos,

            "detalle_vehiculo":
                configuracion.refresh_admin_detalle_vehiculo_segundos,

            "dispositivos":
                configuracion.refresh_admin_dispositivos_segundos,

            "servicios":
                configuracion.refresh_admin_servicios_segundos,

            "alertas":
                configuracion.refresh_admin_alertas_segundos,
        },


        # ====================================================
        # PANEL OPERATIVO - DUEÑO Y SUPERVISOR
        # ====================================================

        "panel_operacion": {
            "dashboard":
                configuracion.refresh_operacion_dashboard_segundos,

            "vehiculos":
                configuracion.refresh_operacion_vehiculos_segundos,

            "detalle_vehiculo":
                configuracion.refresh_operacion_detalle_vehiculo_segundos,

            "alertas":
                configuracion.refresh_operacion_alertas_segundos,

            "monitoreo":
                configuracion.refresh_operacion_monitoreo_segundos,
        },


        # ====================================================
        # TELEMETRÍA Y GPS
        # ====================================================

        "telemetria": {
            "ubicacion_actual_segundos":
                configuracion.ubicacion_actual_segundos,

            "historial_gps_segundos":
                configuracion.historial_gps_segundos,

            "guardar_gps_inmediato_alerta":
                bool(
                    configuracion.guardar_gps_inmediato_alerta
                ),
        },


        # ====================================================
        # CONTROL
        # ====================================================

        "ultima_actualizacion":
            configuracion.ultima_actualizacion,
    }


# ============================================================
# CONVERTIR ENTERO Y VALIDAR RANGO
# ============================================================

def convertir_entero_configuracion(
    valor,
    nombre_campo,
    minimo,
    maximo
):
    try:
        numero = int(valor)

    except (TypeError, ValueError):
        raise ValueError(
            f"{nombre_campo} debe ser un número entero"
        )

    if numero < minimo or numero > maximo:
        raise ValueError(
            f"{nombre_campo} debe estar entre "
            f"{minimo} y {maximo} segundos"
        )

    return numero


# ============================================================
# CONVERTIR BOOLEANO
# ============================================================

def convertir_booleano_configuracion(valor):

    if isinstance(valor, bool):
        return valor

    if isinstance(valor, int):
        return valor == 1

    if isinstance(valor, str):

        valor_normalizado = valor.strip().lower()

        if valor_normalizado in (
            "true",
            "1",
            "si",
            "sí",
            "yes"
        ):
            return True

        if valor_normalizado in (
            "false",
            "0",
            "no"
        ):
            return False

    raise ValueError(
        "guardar_gps_inmediato_alerta debe ser "
        "verdadero o falso"
    )


# ============================================================
# REGISTRAR RUTAS
# ============================================================

def registrar_admin_configuracion_routes(app):


    # ========================================================
    # OBTENER CONFIGURACIÓN COMPLETA
    # ========================================================

    @app.route(
        "/api/admin/configuracion-sistema",
        methods=["GET"]
    )
    @jwt_required()
    @rol_requerido("admin")
    def obtener_admin_configuracion_sistema():

        try:

            configuracion = obtener_configuracion_sistema()

            return jsonify({
                "ok": True,
                "configuracion":
                    serializar_configuracion_sistema(
                        configuracion
                    )
            }), 200

        except Exception as error:

            db.session.rollback()

            print(
                "Error obteniendo configuración "
                f"del sistema: {error}"
            )

            return jsonify({
                "error":
                    "No se pudo obtener la configuración "
                    "del sistema"
            }), 500


    # ========================================================
    # ACTUALIZAR CONFIGURACIÓN COMPLETA
    # ========================================================

    @app.route(
        "/api/admin/configuracion-sistema",
        methods=["PUT"]
    )
    @jwt_required()
    @rol_requerido("admin")
    def actualizar_admin_configuracion_sistema():

        data = request.get_json(silent=True) or {}

        try:

            configuracion = obtener_configuracion_sistema()


            # =================================================
            # GENERAL
            # =================================================

            general = data.get("general", {})

            if "nombre_plataforma" in general:

                nombre = str(
                    general.get(
                        "nombre_plataforma",
                        ""
                    )
                ).strip()

                if not nombre:
                    return jsonify({
                        "error":
                            "El nombre de la plataforma "
                            "es requerido"
                    }), 400

                if len(nombre) > 100:
                    return jsonify({
                        "error":
                            "El nombre de la plataforma "
                            "no puede superar 100 caracteres"
                    }), 400

                configuracion.nombre_plataforma = nombre


            if "correo_soporte" in general:

                correo = str(
                    general.get(
                        "correo_soporte",
                        ""
                    )
                ).strip().lower()

                configuracion.correo_soporte = (
                    correo or None
                )


            if "telefono_soporte" in general:

                telefono = str(
                    general.get(
                        "telefono_soporte",
                        ""
                    )
                ).strip()

                configuracion.telefono_soporte = (
                    telefono or None
                )


            # =================================================
            # MONITOREO
            # =================================================

            monitoreo = data.get(
                "monitoreo",
                {}
            )

            if "segundos_sin_senal" in monitoreo:

                configuracion.segundos_sin_senal = (
                    convertir_entero_configuracion(
                        monitoreo.get(
                            "segundos_sin_senal"
                        ),
                        "Tiempo sin señal",
                        15,
                        600
                    )
                )

            alertas = data.get("alertas", {})
            
            configuracion.segundos_separacion_alertas = (
                convertir_entero_configuracion(
                    alertas.get(
                        "segundos_separacion_alertas"
                    ),
                    "El tiempo mínimo entre alertas del mismo tipo",
                    1,
                    300,
                )
            )
            
            # =================================================
            # PANEL ADMINISTRADOR
            # =================================================

            panel_admin = data.get(
                "panel_admin",
                {}
            )

            campos_admin = {

                "dashboard":
                    "refresh_admin_dashboard_segundos",

                "empresas":
                    "refresh_admin_empresas_segundos",

                "suscripciones":
                    "refresh_admin_suscripciones_segundos",

                "planes":
                    "refresh_admin_planes_segundos",

                "usuarios":
                    "refresh_admin_usuarios_segundos",

                "vehiculos":
                    "refresh_admin_vehiculos_segundos",

                "detalle_vehiculo":
                    "refresh_admin_detalle_vehiculo_segundos",

                "dispositivos":
                    "refresh_admin_dispositivos_segundos",

                "servicios":
                    "refresh_admin_servicios_segundos",

                "alertas":
                    "refresh_admin_alertas_segundos",
            }

            for nombre_json, nombre_modelo in (
                campos_admin.items()
            ):

                if nombre_json not in panel_admin:
                    continue

                valor = convertir_entero_configuracion(
                    panel_admin.get(nombre_json),
                    f"Intervalo admin {nombre_json}",
                    2,
                    300
                )

                setattr(
                    configuracion,
                    nombre_modelo,
                    valor
                )


            # =================================================
            # PANEL OPERATIVO - DUEÑO Y SUPERVISOR
            # =================================================

            panel_operacion = data.get(
                "panel_operacion",
                {}
            )

            campos_operacion = {

                "dashboard":
                    "refresh_operacion_dashboard_segundos",

                "vehiculos":
                    "refresh_operacion_vehiculos_segundos",

                "detalle_vehiculo":
                    "refresh_operacion_detalle_vehiculo_segundos",

                "alertas":
                    "refresh_operacion_alertas_segundos",

                "monitoreo":
                    "refresh_operacion_monitoreo_segundos",
            }

            for nombre_json, nombre_modelo in (
                campos_operacion.items()
            ):

                if nombre_json not in panel_operacion:
                    continue

                valor = convertir_entero_configuracion(
                    panel_operacion.get(nombre_json),
                    f"Intervalo operación {nombre_json}",
                    2,
                    300
                )

                setattr(
                    configuracion,
                    nombre_modelo,
                    valor
                )


            # =================================================
            # TELEMETRÍA Y GPS
            # =================================================

            telemetria = data.get(
                "telemetria",
                {}
            )

            if (
                "ubicacion_actual_segundos"
                in telemetria
            ):

                configuracion.ubicacion_actual_segundos = (
                    convertir_entero_configuracion(
                        telemetria.get(
                            "ubicacion_actual_segundos"
                        ),
                        "Actualización de ubicación actual",
                        1,
                        300
                    )
                )


            if (
                "historial_gps_segundos"
                in telemetria
            ):

                configuracion.historial_gps_segundos = (
                    convertir_entero_configuracion(
                        telemetria.get(
                            "historial_gps_segundos"
                        ),
                        "Guardado de historial GPS",
                        5,
                        3600
                    )
                )


            if (
                "guardar_gps_inmediato_alerta"
                in telemetria
            ):

                configuracion.guardar_gps_inmediato_alerta = (
                    convertir_booleano_configuracion(
                        telemetria.get(
                            "guardar_gps_inmediato_alerta"
                        )
                    )
                )


            # =================================================
            # ACTUALIZAR TIMESTAMP
            # =================================================

            configuracion.ultima_actualizacion = (
                timestamp_actual()
            )

            db.session.commit()


            # =================================================
            # RESPUESTA
            # =================================================

            return jsonify({
                "ok": True,

                "mensaje":
                    "Configuración actualizada correctamente",

                "configuracion":
                    serializar_configuracion_sistema(
                        configuracion
                    )
            }), 200


        except ValueError as error:

            db.session.rollback()

            return jsonify({
                "error": str(error)
            }), 400


        except Exception as error:

            db.session.rollback()

            print(
                "Error actualizando configuración "
                f"del sistema: {error}"
            )

            return jsonify({
                "error":
                    "No se pudo actualizar la configuración "
                    "del sistema"
            }), 500


    # ========================================================
    # OBTENER INTERVALOS SEGUROS PARA PANELES AUTENTICADOS
    # ========================================================

    @app.route(
        "/api/configuracion-sistema/intervalos",
        methods=["GET"]
    )
    @jwt_required()
    @rol_requerido(
        "admin",
        "dueno",
        "supervisor"
    )
    def obtener_intervalos_configuracion_sistema():

        try:

            configuracion = obtener_configuracion_sistema()

            return jsonify({

                "segundos_sin_senal":
                    configuracion.segundos_sin_senal,

                "admin": {
                    "dashboard":
                        configuracion
                        .refresh_admin_dashboard_segundos,

                    "empresas":
                        configuracion
                        .refresh_admin_empresas_segundos,

                    "suscripciones":
                        configuracion
                        .refresh_admin_suscripciones_segundos,

                    "planes":
                        configuracion
                        .refresh_admin_planes_segundos,

                    "usuarios":
                        configuracion
                        .refresh_admin_usuarios_segundos,

                    "vehiculos":
                        configuracion
                        .refresh_admin_vehiculos_segundos,

                    "detalle_vehiculo":
                        configuracion
                        .refresh_admin_detalle_vehiculo_segundos,

                    "dispositivos":
                        configuracion
                        .refresh_admin_dispositivos_segundos,

                    "servicios":
                        configuracion
                        .refresh_admin_servicios_segundos,

                    "alertas":
                        configuracion
                        .refresh_admin_alertas_segundos,
                },

                "operacion": {
                    "dashboard":
                        configuracion
                        .refresh_operacion_dashboard_segundos,

                    "vehiculos":
                        configuracion
                        .refresh_operacion_vehiculos_segundos,

                    "detalle_vehiculo":
                        configuracion
                        .refresh_operacion_detalle_vehiculo_segundos,

                    "alertas":
                        configuracion
                        .refresh_operacion_alertas_segundos,

                    "monitoreo":
                        configuracion
                        .refresh_operacion_monitoreo_segundos,
                }

            }), 200

        except Exception as error:

            db.session.rollback()

            print(
                "Error obteniendo intervalos "
                f"del sistema: {error}"
            )

            return jsonify({
                "error":
                    "No se pudieron obtener los intervalos"
            }), 500