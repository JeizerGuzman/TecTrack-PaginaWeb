# ============================================================
# ROUTES REPORTES DEL DUEÑO - TrackSecurity
# ============================================================
#
# Reportes disponibles:
#
# - resumen
# - alertas
# - vehiculos
# - servicios
#
# Filtros opcionales:
#
# - vehiculo_id
# - fecha_desde
# - fecha_hasta
# - estado
# - limite
# ============================================================

from flask import jsonify, request
from flask_jwt_extended import jwt_required

from config import db

from models import (
    Vehiculo,
    Alerta,
    Servicio,
    Evento,
    HistorialGPS,
    Usuario,
)

from helpers import obtener_usuario_actual


# ============================================================
# HELPERS
# ============================================================

def convertir_entero_opcional(
    valor,
    nombre,
    minimo=None,
    maximo=None,
):
    """
    Convierte un valor opcional a entero.
    """

    if valor in (
        None,
        "",
    ):
        return None


    try:

        numero = int(valor)

    except (
        TypeError,
        ValueError,
    ):

        raise ValueError(
            f"{nombre} debe ser un número entero"
        )


    if (
        minimo is not None
        and numero < minimo
    ):

        raise ValueError(
            f"{nombre} debe ser mayor o igual a "
            f"{minimo}"
        )


    if (
        maximo is not None
        and numero > maximo
    ):

        raise ValueError(
            f"{nombre} debe ser menor o igual a "
            f"{maximo}"
        )


    return numero


def aplicar_filtro_fechas(
    consulta,
    columna,
    fecha_desde=None,
    fecha_hasta=None,
):
    """
    Aplica filtros opcionales de fecha sobre timestamps UNIX.
    """

    if fecha_desde is not None:

        consulta = consulta.filter(
            columna >= fecha_desde
        )


    if fecha_hasta is not None:

        consulta = consulta.filter(
            columna <= fecha_hasta
        )


    return consulta


def nombre_alerta(tipo):
    """
    Devuelve un nombre legible para una alerta.
    """

    nombres = {

        "panico":
            "Botón de pánico",

        "puerta_abierta":
            "Puerta abierta",

        "vibracion":
            "Vibración detectada",

        "alerta_general":
            "Alerta general",

        "sin_senal":
            "Sin señal",

        "gps_perdido":
            "GPS perdido",

        "desviacion_ruta":
            "Desviación de ruta",
    }


    return nombres.get(
        str(tipo or "").lower(),
        "Alerta"
    )


def nombre_servicio(tipo):
    """
    Devuelve un nombre legible para un servicio.
    """

    nombres = {

        "instalacion":
            "Instalación",

        "mantenimiento":
            "Mantenimiento",

        "reparacion":
            "Reparación",

        "cambio_dispositivo":
            "Cambio de dispositivo",

        "retiro_dispositivo":
            "Retiro de dispositivo",

        "diagnostico":
            "Diagnóstico",
    }


    return nombres.get(
        str(tipo or "").lower(),
        "Servicio técnico"
    )


# ============================================================
# REGISTRO DE RUTAS
# ============================================================

def registrar_reportes_routes(app):

    # ========================================================
    # REPORTE GENERAL
    # ========================================================

    @app.route(
        "/api/dueno/reportes",
        methods=["GET"]
    )
    @jwt_required()
    def obtener_reportes_dueno():

        usuario = obtener_usuario_actual()


        if not usuario:

            return jsonify({
                "error":
                    "usuario no encontrado"
            }), 404


        if usuario.tipo != "dueno":

            return jsonify({
                "error": (
                    "solo el dueño puede acceder "
                    "a los reportes"
                )
            }), 403


        if not usuario.empresa_id:

            return jsonify({
                "error": (
                    "el usuario no tiene una "
                    "empresa asociada"
                )
            }), 400


        try:

            # ================================================
            # PARÁMETROS
            # ================================================

            tipo_reporte = str(
                request.args.get(
                    "tipo",
                    "resumen"
                )
            ).strip().lower()


            tipos_validos = {
                "resumen",
                "alertas",
                "vehiculos",
                "servicios",
            }


            if tipo_reporte not in tipos_validos:

                return jsonify({
                    "error":
                        "tipo de reporte no válido"
                }), 400


            vehiculo_id = (
                convertir_entero_opcional(
                    request.args.get(
                        "vehiculo_id"
                    ),
                    "vehiculo_id",
                    minimo=1
                )
            )


            fecha_desde = (
                convertir_entero_opcional(
                    request.args.get(
                        "fecha_desde"
                    ),
                    "fecha_desde",
                    minimo=0
                )
            )


            fecha_hasta = (
                convertir_entero_opcional(
                    request.args.get(
                        "fecha_hasta"
                    ),
                    "fecha_hasta",
                    minimo=0
                )
            )


            limite = (
                convertir_entero_opcional(
                    request.args.get(
                        "limite",
                        300
                    ),
                    "limite",
                    minimo=20,
                    maximo=1000
                )
            )


            estado = str(
                request.args.get(
                    "estado",
                    ""
                )
            ).strip().lower()


            if (
                fecha_desde is not None
                and fecha_hasta is not None
                and fecha_desde > fecha_hasta
            ):

                return jsonify({
                    "error": (
                        "la fecha inicial no puede "
                        "ser posterior a la fecha final"
                    )
                }), 400


            # ================================================
            # VEHÍCULOS DE LA EMPRESA
            # ================================================

            vehiculos = (

                Vehiculo.query

                .filter_by(
                    empresa_id=usuario.empresa_id
                )

                .order_by(
                    Vehiculo.nombre.asc()
                )

                .all()

            )


            vehiculos_por_id = {

                vehiculo.id:
                    vehiculo

                for vehiculo in vehiculos
            }


            ids_vehiculos = list(
                vehiculos_por_id.keys()
            )


            # ================================================
            # VALIDAR VEHÍCULO SOLICITADO
            # ================================================

            if vehiculo_id is not None:

                if (
                    vehiculo_id
                    not in vehiculos_por_id
                ):

                    return jsonify({
                        "error": (
                            "el vehículo no pertenece "
                            "a tu empresa"
                        )
                    }), 403


                ids_consulta = [
                    vehiculo_id
                ]


            else:

                ids_consulta = (
                    ids_vehiculos
                )


            # ================================================
            # EMPRESA SIN VEHÍCULOS
            # ================================================

            if not ids_vehiculos:

                return jsonify({

                    "tipo":
                        tipo_reporte,

                    "metricas": {
                        "vehiculos": 0,
                        "alertas": 0,
                        "alertas_pendientes": 0,
                        "servicios": 0,
                        "eventos": 0,
                        "puntos_gps": 0,
                    },

                    "vehiculos": [],

                    "columnas": [],

                    "registros": [],

                    "total":
                        0,

                }), 200


            # ================================================
            # MÉTRICAS GENERALES
            # ================================================

            consulta_alertas = (

                Alerta.query

                .filter(
                    Alerta.vehiculo_id.in_(
                        ids_consulta
                    )
                )

            )


            consulta_alertas = (
                aplicar_filtro_fechas(
                    consulta_alertas,
                    Alerta.timestamp,
                    fecha_desde,
                    fecha_hasta,
                )
            )


            total_alertas = (
                consulta_alertas.count()
            )


            total_alertas_pendientes = (

                consulta_alertas

                .filter(
                    Alerta.atendida.is_(False)
                )

                .count()

            )


            consulta_servicios = (

                Servicio.query

                .filter(
                    Servicio.empresa_id ==
                    usuario.empresa_id
                )

            )


            if vehiculo_id is not None:

                consulta_servicios = (
                    consulta_servicios.filter(
                        Servicio.vehiculo_id ==
                        vehiculo_id
                    )
                )


            consulta_servicios = (
                aplicar_filtro_fechas(
                    consulta_servicios,
                    Servicio.timestamp,
                    fecha_desde,
                    fecha_hasta,
                )
            )


            total_servicios = (
                consulta_servicios.count()
            )


            consulta_eventos = (

                Evento.query

                .filter(
                    Evento.vehiculo_id.in_(
                        ids_consulta
                    )
                )

            )


            consulta_eventos = (
                aplicar_filtro_fechas(
                    consulta_eventos,
                    Evento.timestamp,
                    fecha_desde,
                    fecha_hasta,
                )
            )


            total_eventos = (
                consulta_eventos.count()
            )


            consulta_gps = (

                HistorialGPS.query

                .filter(
                    HistorialGPS.vehiculo_id.in_(
                        ids_consulta
                    )
                )

            )


            consulta_gps = (
                aplicar_filtro_fechas(
                    consulta_gps,
                    HistorialGPS.timestamp,
                    fecha_desde,
                    fecha_hasta,
                )
            )


            total_puntos_gps = (
                consulta_gps.count()
            )


            metricas = {

                "vehiculos":
                    len(ids_consulta),

                "alertas":
                    total_alertas,

                "alertas_pendientes":
                    total_alertas_pendientes,

                "servicios":
                    total_servicios,

                "eventos":
                    total_eventos,

                "puntos_gps":
                    total_puntos_gps,
            }


            # ================================================
            # REPORTE: RESUMEN
            # ================================================

            if tipo_reporte == "resumen":

                registros = []


                for vehiculo in (
                    vehiculos
                    if vehiculo_id is None
                    else [
                        vehiculos_por_id[
                            vehiculo_id
                        ]
                    ]
                ):

                    consulta_alertas_vehiculo = (

                        Alerta.query

                        .filter_by(
                            vehiculo_id=vehiculo.id
                        )

                    )


                    consulta_alertas_vehiculo = (
                        aplicar_filtro_fechas(
                            consulta_alertas_vehiculo,
                            Alerta.timestamp,
                            fecha_desde,
                            fecha_hasta,
                        )
                    )


                    alertas_total = (
                        consulta_alertas_vehiculo.count()
                    )


                    alertas_pendientes = (

                        consulta_alertas_vehiculo

                        .filter(
                            Alerta.atendida.is_(False)
                        )

                        .count()

                    )


                    consulta_eventos_vehiculo = (

                        Evento.query

                        .filter_by(
                            vehiculo_id=vehiculo.id
                        )

                    )


                    consulta_eventos_vehiculo = (
                        aplicar_filtro_fechas(
                            consulta_eventos_vehiculo,
                            Evento.timestamp,
                            fecha_desde,
                            fecha_hasta,
                        )
                    )


                    eventos_total = (
                        consulta_eventos_vehiculo.count()
                    )


                    consulta_gps_vehiculo = (

                        HistorialGPS.query

                        .filter_by(
                            vehiculo_id=vehiculo.id
                        )

                    )


                    consulta_gps_vehiculo = (
                        aplicar_filtro_fechas(
                            consulta_gps_vehiculo,
                            HistorialGPS.timestamp,
                            fecha_desde,
                            fecha_hasta,
                        )
                    )


                    gps_total = (
                        consulta_gps_vehiculo.count()
                    )


                    consulta_servicios_vehiculo = (

                        Servicio.query

                        .filter(
                            Servicio.empresa_id ==
                            usuario.empresa_id,
                            Servicio.vehiculo_id ==
                            vehiculo.id,
                        )

                    )


                    consulta_servicios_vehiculo = (
                        aplicar_filtro_fechas(
                            consulta_servicios_vehiculo,
                            Servicio.timestamp,
                            fecha_desde,
                            fecha_hasta,
                        )
                    )


                    servicios_total = (
                        consulta_servicios_vehiculo.count()
                    )


                    registros.append({

                        "id":
                            vehiculo.id,

                        "vehiculo":
                            vehiculo.nombre,

                        "identificador":
                            vehiculo.identificador,

                        "placa":
                            vehiculo.placa,

                        "activo":
                            bool(
                                vehiculo.activo
                            ),

                        "alertas":
                            alertas_total,

                        "alertas_pendientes":
                            alertas_pendientes,

                        "eventos":
                            eventos_total,

                        "servicios":
                            servicios_total,

                        "puntos_gps":
                            gps_total,
                    })


                columnas = [
                    {
                        "clave": "vehiculo",
                        "titulo": "Vehículo",
                    },
                    {
                        "clave": "placa",
                        "titulo": "Placa",
                    },
                    {
                        "clave": "alertas",
                        "titulo": "Alertas",
                    },
                    {
                        "clave": "alertas_pendientes",
                        "titulo": "Pendientes",
                    },
                    {
                        "clave": "eventos",
                        "titulo": "Eventos",
                    },
                    {
                        "clave": "servicios",
                        "titulo": "Servicios",
                    },
                    {
                        "clave": "puntos_gps",
                        "titulo": "Puntos GPS",
                    },
                ]


            # ================================================
            # REPORTE: ALERTAS
            # ================================================

            elif tipo_reporte == "alertas":

                consulta = (

                    Alerta.query

                    .filter(
                        Alerta.vehiculo_id.in_(
                            ids_consulta
                        )
                    )

                )


                consulta = (
                    aplicar_filtro_fechas(
                        consulta,
                        Alerta.timestamp,
                        fecha_desde,
                        fecha_hasta,
                    )
                )


                if estado == "pendiente":

                    consulta = consulta.filter(
                        Alerta.atendida.is_(False)
                    )


                elif estado == "atendida":

                    consulta = consulta.filter(
                        Alerta.atendida.is_(True)
                    )


                alertas = (

                    consulta

                    .order_by(
                        Alerta.timestamp.desc()
                    )

                    .limit(limite)

                    .all()

                )


                usuarios_ids = {

                    alerta.atendida_por

                    for alerta in alertas

                    if alerta.atendida_por
                }


                usuarios_atencion = {}


                if usuarios_ids:

                    usuarios = (

                        Usuario.query

                        .filter(
                            Usuario.id.in_(
                                usuarios_ids
                            )
                        )

                        .all()

                    )


                    usuarios_atencion = {

                        usuario_item.id:
                            usuario_item.nombre

                        for usuario_item in usuarios
                    }


                registros = []


                for alerta in alertas:

                    vehiculo = (
                        vehiculos_por_id.get(
                            alerta.vehiculo_id
                        )
                    )


                    registros.append({

                        "id":
                            alerta.id,

                        "tipo":
                            alerta.tipo,

                        "tipo_texto":
                            nombre_alerta(
                                alerta.tipo
                            ),

                        "vehiculo":
                            (
                                vehiculo.nombre
                                if vehiculo
                                else "Vehículo"
                            ),

                        "placa":
                            (
                                vehiculo.placa
                                if vehiculo
                                else None
                            ),

                        "nivel":
                            alerta.nivel,

                        "descripcion":
                            alerta.descripcion,

                        "estado":
                            (
                                "Atendida"
                                if alerta.atendida
                                else "Pendiente"
                            ),

                        "atendida":
                            bool(
                                alerta.atendida
                            ),

                        "condicion_activa":
                            bool(
                                alerta.condicion_activa
                            ),

                        "atendida_por":
                            usuarios_atencion.get(
                                alerta.atendida_por
                            ),

                        "fecha_atencion":
                            alerta.fecha_atencion,

                        "timestamp":
                            alerta.timestamp,

                        "lat":
                            alerta.lat,

                        "lng":
                            alerta.lng,
                    })


                columnas = [
                    {
                        "clave": "timestamp",
                        "titulo": "Fecha",
                    },
                    {
                        "clave": "vehiculo",
                        "titulo": "Vehículo",
                    },
                    {
                        "clave": "tipo_texto",
                        "titulo": "Tipo",
                    },
                    {
                        "clave": "nivel",
                        "titulo": "Nivel",
                    },
                    {
                        "clave": "estado",
                        "titulo": "Estado",
                    },
                ]


            # ================================================
            # REPORTE: VEHÍCULOS
            # ================================================

            elif tipo_reporte == "vehiculos":

                vehiculos_reporte = (
                    vehiculos
                    if vehiculo_id is None
                    else [
                        vehiculos_por_id[
                            vehiculo_id
                        ]
                    ]
                )


                if estado == "activo":

                    vehiculos_reporte = [
                        item
                        for item in vehiculos_reporte
                        if item.activo
                    ]


                elif estado == "inactivo":

                    vehiculos_reporte = [
                        item
                        for item in vehiculos_reporte
                        if not item.activo
                    ]


                registros = []


                for vehiculo in vehiculos_reporte:

                    chofer = None


                    if vehiculo.chofer_id:

                        chofer = db.session.get(
                            Usuario,
                            vehiculo.chofer_id
                        )


                    registros.append({

                        "id":
                            vehiculo.id,

                        "vehiculo":
                            vehiculo.nombre,

                        "identificador":
                            vehiculo.identificador,

                        "placa":
                            vehiculo.placa,

                        "marca":
                            vehiculo.marca,

                        "modelo":
                            vehiculo.modelo,

                        "anio":
                            vehiculo.anio,

                        "chofer":
                            (
                                chofer.nombre
                                if chofer
                                else "Sin chofer"
                            ),

                        "estado":
                            (
                                "Activo"
                                if vehiculo.activo
                                else "Inactivo"
                            ),

                        "estado_instalacion":
                            vehiculo.estado_instalacion,

                        "fecha_creacion":
                            vehiculo.fecha_creacion,
                    })


                columnas = [
                    {
                        "clave": "vehiculo",
                        "titulo": "Vehículo",
                    },
                    {
                        "clave": "identificador",
                        "titulo": "Identificador",
                    },
                    {
                        "clave": "placa",
                        "titulo": "Placa",
                    },
                    {
                        "clave": "chofer",
                        "titulo": "Chofer",
                    },
                    {
                        "clave": "estado",
                        "titulo": "Estado",
                    },
                    {
                        "clave": "estado_instalacion",
                        "titulo": "Instalación",
                    },
                ]


            # ================================================
            # REPORTE: SERVICIOS
            # ================================================

            else:

                consulta = (

                    Servicio.query

                    .filter(
                        Servicio.empresa_id ==
                        usuario.empresa_id
                    )

                )


                if vehiculo_id is not None:

                    consulta = consulta.filter(
                        Servicio.vehiculo_id ==
                        vehiculo_id
                    )


                consulta = (
                    aplicar_filtro_fechas(
                        consulta,
                        Servicio.timestamp,
                        fecha_desde,
                        fecha_hasta,
                    )
                )


                if estado:

                    consulta = consulta.filter(
                        Servicio.estado == estado
                    )


                servicios = (

                    consulta

                    .order_by(
                        Servicio.timestamp.desc()
                    )

                    .limit(limite)

                    .all()

                )


                registros = []


                for servicio in servicios:

                    vehiculo = (
                        vehiculos_por_id.get(
                            servicio.vehiculo_id
                        )
                    )


                    registros.append({

                        "id":
                            servicio.id,

                        "tipo":
                            servicio.tipo,

                        "tipo_texto":
                            nombre_servicio(
                                servicio.tipo
                            ),

                        "vehiculo":
                            (
                                vehiculo.nombre
                                if vehiculo
                                else "Sin vehículo específico"
                            ),

                        "placa":
                            (
                                vehiculo.placa
                                if vehiculo
                                else None
                            ),

                        "descripcion":
                            servicio.descripcion,

                        "estado":
                            servicio.estado,

                        "costo":
                            float(
                                servicio.costo or 0
                            ),

                        "timestamp":
                            servicio.timestamp,

                        "dispositivo_id":
                            servicio.dispositivo_id,
                    })


                columnas = [
                    {
                        "clave": "timestamp",
                        "titulo": "Fecha",
                    },
                    {
                        "clave": "vehiculo",
                        "titulo": "Vehículo",
                    },
                    {
                        "clave": "tipo_texto",
                        "titulo": "Tipo",
                    },
                    {
                        "clave": "estado",
                        "titulo": "Estado",
                    },
                    {
                        "clave": "costo",
                        "titulo": "Costo",
                    },
                ]


            # ================================================
            # RESPUESTA
            # ================================================

            return jsonify({

                "tipo":
                    tipo_reporte,

                "metricas":
                    metricas,

                "vehiculos": [

                    {
                        "id":
                            vehiculo.id,

                        "nombre":
                            vehiculo.nombre,

                        "identificador":
                            vehiculo.identificador,

                        "placa":
                            vehiculo.placa,

                        "activo":
                            bool(
                                vehiculo.activo
                            ),
                    }

                    for vehiculo in vehiculos
                ],

                "columnas":
                    columnas,

                "registros":
                    registros,

                "filtros": {

                    "tipo":
                        tipo_reporte,

                    "vehiculo_id":
                        vehiculo_id,

                    "fecha_desde":
                        fecha_desde,

                    "fecha_hasta":
                        fecha_hasta,

                    "estado":
                        estado,

                    "limite":
                        limite,
                },

                "total":
                    len(registros),

            }), 200


        except ValueError as error:

            return jsonify({
                "error": str(error)
            }), 400


        except Exception as error:

            print(
                "❌ ERROR EN REPORTES DEL DUEÑO:",
                error
            )


            return jsonify({
                "error": (
                    "no se pudo generar el reporte"
                )
            }), 500