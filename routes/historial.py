# ============================================================
# ROUTES HISTORIAL - TrackSecurity
# ============================================================
#
# Endpoints para:
#
# - Historial individual de un vehículo.
# - Historial general de la empresa del dueño.
#
# Categorías disponibles:
#
# - todos
# - alertas
# - eventos
# - gps
# - servicios
# ============================================================

from flask import jsonify, request
from flask_jwt_extended import jwt_required

from config import db

from models import (
    Vehiculo,
    HistorialGPS,
    Evento,
    Alerta,
    Servicio,
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
    maximo=None
):
    """
    Convierte un valor opcional a entero.

    Devuelve None cuando no se recibe valor.
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
        ValueError
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
    query,
    columna_timestamp,
    fecha_desde=None,
    fecha_hasta=None
):
    """
    Aplica filtros opcionales de timestamp.
    """

    if fecha_desde is not None:

        query = query.filter(
            columna_timestamp >= fecha_desde
        )


    if fecha_hasta is not None:

        query = query.filter(
            columna_timestamp <= fecha_hasta
        )


    return query


def titulo_alerta(tipo):
    """
    Devuelve un título legible para una alerta.
    """

    titulos = {

        "panico":
            "Botón de pánico activado",

        "puerta_abierta":
            "Puerta abierta detectada",

        "vibracion":
            "Vibración detectada",

        "alerta_general":
            "Alerta general",

        "sin_senal":
            "Vehículo sin señal",

        "gps_perdido":
            "Señal GPS perdida",

        "desviacion_ruta":
            "Desviación de ruta",
    }


    return titulos.get(
        str(tipo or "").lower(),
        "Alerta del vehículo"
    )


def titulo_evento(tipo):
    """
    Devuelve un título legible para un evento.
    """

    titulos = {

        "encendido":
            "Sistema encendido",

        "apagado":
            "Sistema apagado",

        "manual":
            "Modo manual activado",

        "modo_manual":
            "Modo manual activado",
            
        "modo_manual_activado":
            "Modo manual activado",

        "modo_manual_desactivado":
            "Modo manual desactivado",

        "sistema_encendido":
            "Sistema encendido",

        "puerta_cerrada":
            "Puerta cerrada",

        "gps_actualizado":
            "GPS actualizado",
    }


    return titulos.get(
        str(tipo or "").lower(),
        "Evento del vehículo"
    )


def titulo_servicio(tipo):
    """
    Devuelve un título legible para un servicio.
    """

    titulos = {

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


    return titulos.get(
        str(tipo or "").lower(),
        "Servicio técnico"
    )


# ============================================================
# REGISTRO DE RUTAS
# ============================================================

def registrar_historial_routes(app):

    # ========================================================
    # HISTORIAL INDIVIDUAL DE UN VEHÍCULO
    #
    # Endpoint existente.
    # Se conserva para no romper funcionalidad futura.
    # ========================================================

    @app.route(
        "/api/historial/<int:vehiculo_id>",
        methods=["GET"]
    )
    @jwt_required()
    def historial_vehiculo(vehiculo_id):

        usuario = obtener_usuario_actual()

        vehiculo = db.session.get(
            Vehiculo,
            vehiculo_id
        )


        if not vehiculo:

            return jsonify({
                "error":
                    "vehículo no encontrado"
            }), 404


        if usuario.tipo in (
            "admin",
            "dueno",
            "supervisor"
        ):

            if (
                usuario.tipo != "admin"
                and
                vehiculo.empresa_id !=
                usuario.empresa_id
            ):

                return jsonify({
                    "error": "acceso denegado"
                }), 403


        elif usuario.tipo == "chofer":

            if (
                vehiculo.chofer_id != usuario.id
            ):

                return jsonify({
                    "error": "acceso denegado"
                }), 403


        else:

            return jsonify({
                "error": (
                    "tu rol no tiene acceso "
                    "a esta información"
                )
            }), 403


        puntos_gps = (

            HistorialGPS.query

            .filter_by(
                vehiculo_id=vehiculo_id
            )

            .order_by(
                HistorialGPS.timestamp.asc()
            )

            .limit(500)

            .all()

        )


        eventos = (

            Evento.query

            .filter_by(
                vehiculo_id=vehiculo_id
            )

            .order_by(
                Evento.timestamp.desc()
            )

            .limit(100)

            .all()

        )


        return jsonify({

            "vehiculo":
                vehiculo.nombre,


            "puntos_gps": [

                {
                    "id": punto.id,

                    "lat": punto.lat,

                    "lng": punto.lng,

                    "velocidad":
                        punto.velocidad,

                    "timestamp":
                        punto.timestamp,
                }

                for punto in puntos_gps
            ],


            "eventos": [

                {
                    "id": evento.id,

                    "tipo": evento.tipo,

                    "descripcion":
                        evento.descripcion,

                    "lat": evento.lat,

                    "lng": evento.lng,

                    "timestamp":
                        evento.timestamp,
                }

                for evento in eventos
            ]

        }), 200


    # ========================================================
    # HISTORIAL GENERAL DEL DUEÑO
    # ========================================================

    @app.route(
        "/api/dueno/historial",
        methods=["GET"]
    )
    @jwt_required()
    def historial_general_dueno():

        usuario = obtener_usuario_actual()


        # ====================================================
        # VALIDAR USUARIO
        # ====================================================

        if not usuario:

            return jsonify({
                "error":
                    "usuario no encontrado"
            }), 404


        if usuario.tipo not in (
            "dueno",
            "supervisor",
        ):

            return jsonify({
                "error": (
                    "tu rol no tiene acceso "
                    "a este historial"
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

            categoria = str(
                request.args.get(
                    "categoria",
                    "todos"
                )
            ).strip().lower()


            categorias_validas = {
                "todos",
                "alertas",
                "eventos",
                "gps",
                "servicios",
            }


            if categoria not in categorias_validas:

                return jsonify({
                    "error":
                        "categoría de historial no válida"
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
                        200
                    ),
                    "limite",
                    minimo=20,
                    maximo=500
                )
            )


            if (
                fecha_desde is not None
                and
                fecha_hasta is not None
                and
                fecha_desde > fecha_hasta
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
                vehiculo.id: vehiculo
                for vehiculo in vehiculos
            }


            ids_vehiculos = list(
                vehiculos_por_id.keys()
            )


            # ================================================
            # VALIDAR FILTRO DE VEHÍCULO
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

            if not ids_consulta:

                return jsonify({

                    "metricas": {
                        "total_actividad": 0,
                        "alertas": 0,
                        "eventos": 0,
                        "servicios": 0,
                    },

                    "vehiculos": [],

                    "registros": [],

                    "categoria":
                        categoria,

                    "total_mostrado": 0,
                    "total_disponible": 0,

                }), 200


            # ================================================
            # MÉTRICAS
            #
            # Las métricas respetan:
            #
            # - vehículo seleccionado
            # - fecha inicial
            # - fecha final
            #
            # No dependen de la categoría seleccionada.
            # ================================================

            query_metricas_alertas = (

                Alerta.query

                .filter(
                    Alerta.vehiculo_id.in_(
                        ids_consulta
                    )
                )

            )


            query_metricas_alertas = (
                aplicar_filtro_fechas(
                    query_metricas_alertas,
                    Alerta.timestamp,
                    fecha_desde,
                    fecha_hasta
                )
            )


            total_alertas = (
                query_metricas_alertas.count()
            )


            query_metricas_eventos = (

                Evento.query

                .filter(
                    Evento.vehiculo_id.in_(
                        ids_consulta
                    )
                )

            )


            query_metricas_eventos = (
                aplicar_filtro_fechas(
                    query_metricas_eventos,
                    Evento.timestamp,
                    fecha_desde,
                    fecha_hasta
                )
            )


            total_eventos = (
                query_metricas_eventos.count()
            )


            query_metricas_servicios = (

                Servicio.query

                .filter(
                    Servicio.empresa_id ==
                    usuario.empresa_id
                )

            )


            if vehiculo_id is not None:

                query_metricas_servicios = (
                    query_metricas_servicios
                    .filter(
                        Servicio.vehiculo_id ==
                        vehiculo_id
                    )
                )


            query_metricas_servicios = (
                aplicar_filtro_fechas(
                    query_metricas_servicios,
                    Servicio.timestamp,
                    fecha_desde,
                    fecha_hasta
                )
            )


            total_servicios = (
                query_metricas_servicios.count()
            )


            metricas = {

                "total_actividad": (
                    total_alertas
                    +
                    total_eventos
                    +
                    total_servicios
                ),

                "alertas":
                    total_alertas,

                "eventos":
                    total_eventos,

                "servicios":
                    total_servicios,
            }
    
            if categoria == "todos":

                total_disponible = (
                    metricas["total_actividad"]
                )


            elif categoria == "alertas":

                total_disponible = (
                    total_alertas
                )


            elif categoria == "eventos":

                total_disponible = (
                    total_eventos
                )


            elif categoria == "servicios":

                total_disponible = (
                    total_servicios
                )


            else:

                total_disponible = 0


            # ================================================
            # REGISTROS UNIFICADOS
            # ================================================

            registros = []


            # ================================================
            # ALERTAS
            # ================================================

            if categoria in (
                "todos",
                "alertas"
            ):

                query_alertas = (

                    Alerta.query

                    .filter(
                        Alerta.vehiculo_id.in_(
                            ids_consulta
                        )
                    )

                )


                query_alertas = (
                    aplicar_filtro_fechas(
                        query_alertas,
                        Alerta.timestamp,
                        fecha_desde,
                        fecha_hasta
                    )
                )


                alertas = (

                    query_alertas

                    .order_by(
                        Alerta.timestamp.desc()
                    )

                    .limit(limite)

                    .all()

                )


                usuarios_atencion_ids = {

                    alerta.atendida_por

                    for alerta in alertas

                    if alerta.atendida_por
                }


                usuarios_atencion = {}


                if usuarios_atencion_ids:

                    usuarios = (

                        Usuario.query

                        .filter(
                            Usuario.id.in_(
                                usuarios_atencion_ids
                            )
                        )

                        .all()

                    )


                    usuarios_atencion = {

                        usuario_item.id:
                            usuario_item.nombre

                        for usuario_item in usuarios
                    }


                for alerta in alertas:

                    vehiculo = (
                        vehiculos_por_id.get(
                            alerta.vehiculo_id
                        )
                    )


                    registros.append({

                        "id":
                            alerta.id,

                        "categoria":
                            "alerta",

                        "tipo":
                            alerta.tipo,

                        "titulo":
                            titulo_alerta(
                                alerta.tipo
                            ),

                        "descripcion":
                            alerta.descripcion,

                        "vehiculo_id":
                            alerta.vehiculo_id,

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

                        "timestamp":
                            alerta.timestamp,

                        "ultima_actualizacion":
                            alerta.ultima_actualizacion,

                        "nivel":
                            alerta.nivel,

                        "atendida":
                            bool(
                                alerta.atendida
                            ),

                        "condicion_activa":
                            bool(
                                alerta.condicion_activa
                            ),

                        "atendida_por_nombre":
                            usuarios_atencion.get(
                                alerta.atendida_por
                            ),

                        "fecha_atencion":
                            alerta.fecha_atencion,

                        "lat":
                            alerta.lat,

                        "lng":
                            alerta.lng,
                    })


            # ================================================
            # EVENTOS
            # ================================================

            if categoria in (
                "todos",
                "eventos"
            ):

                query_eventos = (

                    Evento.query

                    .filter(
                        Evento.vehiculo_id.in_(
                            ids_consulta
                        )
                    )

                )


                query_eventos = (
                    aplicar_filtro_fechas(
                        query_eventos,
                        Evento.timestamp,
                        fecha_desde,
                        fecha_hasta
                    )
                )


                eventos = (

                    query_eventos

                    .order_by(
                        Evento.timestamp.desc()
                    )

                    .limit(limite)

                    .all()

                )


                for evento in eventos:

                    vehiculo = (
                        vehiculos_por_id.get(
                            evento.vehiculo_id
                        )
                    )


                    registros.append({

                        "id":
                            evento.id,

                        "categoria":
                            "evento",

                        "tipo":
                            evento.tipo,

                        "titulo":
                            titulo_evento(
                                evento.tipo
                            ),

                        "descripcion":
                            evento.descripcion,

                        "vehiculo_id":
                            evento.vehiculo_id,

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

                        "timestamp":
                            evento.timestamp,

                        "lat":
                            evento.lat,

                        "lng":
                            evento.lng,
                    })


            # ================================================
            # SERVICIOS REALES
            # ================================================

            if categoria in (
                "todos",
                "servicios"
            ):

                query_servicios = (

                    Servicio.query

                    .filter(
                        Servicio.empresa_id ==
                        usuario.empresa_id
                    )

                )


                if vehiculo_id is not None:

                    query_servicios = (
                        query_servicios
                        .filter(
                            Servicio.vehiculo_id ==
                            vehiculo_id
                        )
                    )


                query_servicios = (
                    aplicar_filtro_fechas(
                        query_servicios,
                        Servicio.timestamp,
                        fecha_desde,
                        fecha_hasta
                    )
                )


                servicios = (

                    query_servicios

                    .order_by(
                        Servicio.timestamp.desc()
                    )

                    .limit(limite)

                    .all()

                )


                for servicio in servicios:

                    vehiculo = (
                        vehiculos_por_id.get(
                            servicio.vehiculo_id
                        )
                    )


                    registros.append({

                        "id":
                            servicio.id,

                        "categoria":
                            "servicio",

                        "tipo":
                            servicio.tipo,

                        "titulo":
                            titulo_servicio(
                                servicio.tipo
                            ),

                        "descripcion":
                            servicio.descripcion,

                        "vehiculo_id":
                            servicio.vehiculo_id,

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

                        "timestamp":
                            servicio.timestamp,

                        "estado":
                            servicio.estado,

                        "costo":
                            float(
                                servicio.costo or 0
                            ),

                        "dispositivo_id":
                            servicio.dispositivo_id,
                    })


            # ================================================
            # HISTORIAL GPS
            #
            # Solo se devuelve cuando se selecciona
            # explícitamente la categoría GPS.
            # ================================================

            if categoria == "gps":

                query_gps = (

                    HistorialGPS.query

                    .filter(
                        HistorialGPS.vehiculo_id.in_(
                            ids_consulta
                        )
                    )

                )


                query_gps = (
                    aplicar_filtro_fechas(
                        query_gps,
                        HistorialGPS.timestamp,
                        fecha_desde,
                        fecha_hasta
                    )
                )
                
                total_disponible = (
                    query_gps.count()
                )

                puntos_gps = (

                    query_gps

                    .order_by(
                        HistorialGPS.timestamp.desc()
                    )

                    .limit(limite)

                    .all()

                )


                for punto in puntos_gps:

                    vehiculo = (
                        vehiculos_por_id.get(
                            punto.vehiculo_id
                        )
                    )


                    registros.append({

                        "id":
                            punto.id,

                        "categoria":
                            "gps",

                        "tipo":
                            "punto_gps",

                        "titulo":
                            "Punto GPS registrado",

                        "descripcion":
                            "Ubicación histórica registrada por el dispositivo.",

                        "vehiculo_id":
                            punto.vehiculo_id,

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

                        "timestamp":
                            punto.timestamp,

                        "lat":
                            punto.lat,

                        "lng":
                            punto.lng,

                        "velocidad":
                            float(
                                punto.velocidad or 0
                            ),
                    })


            # ================================================
            # ORDENAR Y APLICAR LÍMITE FINAL
            # ================================================

            registros.sort(
                key=lambda registro:
                    int(
                        registro.get(
                            "timestamp"
                        ) or 0
                    ),
                reverse=True
            )


            registros = registros[:limite]


            # ================================================
            # RESPUESTA
            # ================================================

            return jsonify({

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


                "registros":
                    registros,


                "categoria":
                    categoria,


                "filtros": {

                    "vehiculo_id":
                        vehiculo_id,

                    "fecha_desde":
                        fecha_desde,

                    "fecha_hasta":
                        fecha_hasta,

                    "limite":
                        limite,
                },


                "total_mostrado":
                    len(registros),

                "total_disponible":
                    total_disponible,

            }), 200


        except ValueError as error:

            return jsonify({
                "error": str(error)
            }), 400


        except Exception as error:

            print(
                "❌ ERROR EN HISTORIAL DEL DUEÑO:",
                error
            )


            return jsonify({
                "error": (
                    "no se pudo obtener "
                    "el historial"
                )
            }), 500