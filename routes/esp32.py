# ============================================================
# ROUTES ESP32 - TrackSecurity
# ============================================================
#
# Endpoint usado por el dispositivo ESP32.
#
# Importante:
# /datos NO usa JWT porque el dispositivo no inicia sesión
# como usuario.
#
# La validación se hace mediante la serie del dispositivo
# o el identificador del vehículo.
# ============================================================

from flask import request, jsonify

from config import db

from models import (
    Dispositivo,
    Vehiculo,
    Evento,
    Alerta,
    UbicacionActual,

)

from helpers import (
    timestamp_actual,
    imprimir_log_datos_esp32,
    actualizar_ubicacion_actual,
    guardar_historial_gps,
    crear_alerta,
    obtener_configuracion_telemetria,
    debe_actualizar_ubicacion_actual,
    debe_guardar_historial_gps,
)


# ------------------------------------------------------------
# Registra rutas del ESP32.
# ------------------------------------------------------------
def registrar_esp32_routes(app):


    def obtener_estado_manual_anterior(
        vehiculo_id,
        estado_anterior_ubicacion
    ):

        ultimo_evento_manual = (

            Evento.query

            .filter(
                Evento.vehiculo_id == vehiculo_id,
                Evento.tipo.in_(
                    [
                        "manual",
                        "modo_manual",
                        "modo_manual_activado",
                        "modo_manual_desactivado",
                    ]
                )
            )

            .order_by(
                Evento.timestamp.desc()
            )

            .first()

        )


        if ultimo_evento_manual:

            tipo_ultimo_evento = str(
                ultimo_evento_manual.tipo or ""
            ).lower()


            if tipo_ultimo_evento in (
                "manual",
                "modo_manual",
                "modo_manual_activado",
            ):

                return True


            if tipo_ultimo_evento == "modo_manual_desactivado":

                return False


        return estado_anterior_ubicacion in (
            "manual",
            "modo_manual",
        )


    def registrar_evento_cambio_manual(
        vehiculo_id,
        modo_manual_actual,
        modo_manual_anterior,
        data,
        ahora
    ):

        if (
            modo_manual_actual
            and
            not modo_manual_anterior
        ):

            evento = Evento(
                vehiculo_id=vehiculo_id,
                tipo="modo_manual_activado",
                descripcion="Modo manual activado",
                lat=data.get("lat"),
                lng=data.get("lng"),
                timestamp=ahora,
            )

            db.session.add(evento)

            print(
                "📝 EVENTO CREADO -> "
                "tipo: modo_manual_activado"
            )

            return True


        if (
            not modo_manual_actual
            and
            modo_manual_anterior
        ):

            evento = Evento(
                vehiculo_id=vehiculo_id,
                tipo="modo_manual_desactivado",
                descripcion="Modo manual desactivado",
                lat=data.get("lat"),
                lng=data.get("lng"),
                timestamp=ahora,
            )

            db.session.add(evento)

            print(
                "📝 EVENTO CREADO -> "
                "tipo: modo_manual_desactivado"
            )

            return True


        return False


    # ========================================================
    # RECIBIR DATOS DEL ESP32
    # ========================================================

    @app.route("/datos", methods=["POST"])
    def recibir_datos_esp32():

        data = request.get_json(
            silent=True
        ) or {}


        # ====================================================
        # VALIDAR JSON
        # ====================================================

        if not data:

            return jsonify({
                "success": False,
                "mensaje": "no se recibió JSON"
            }), 400


        imprimir_log_datos_esp32(data)


        # ====================================================
        # DATOS DE IDENTIFICACIÓN
        # ====================================================

        serie = data.get("serie")

        identificador_vehiculo = data.get(
            "vehiculo"
        )


        # ====================================================
        # BUSCAR DISPOSITIVO
        # ====================================================

        dispositivo = None


        if serie:

            dispositivo = (
                Dispositivo.query
                .filter_by(
                    serie=serie
                )
                .first()
            )


        # ====================================================
        # BUSCAR VEHÍCULO
        # ====================================================

        vehiculo = None


        if dispositivo:

            vehiculo = (
                Vehiculo.query
                .filter_by(
                    dispositivo_id=dispositivo.id
                )
                .first()
            )


        # Compatibilidad para pruebas:
        # buscar por identificador del vehículo.
        if (
            not vehiculo
            and identificador_vehiculo
        ):

            vehiculo = (
                Vehiculo.query
                .filter_by(
                    identificador=identificador_vehiculo
                )
                .first()
            )


        if not vehiculo:

            print(
                "❌ No se encontró vehículo "
                "para estos datos."
            )

            return jsonify({

                "success": False,

                "mensaje": (
                    "no se encontró un vehículo "
                    "asociado a esta "
                    "serie/identificador"
                )

            }), 404


        try:

            ahora = timestamp_actual()


            # =================================================
            # CONFIGURACIÓN GLOBAL
            # =================================================

            config_telemetria = (
                obtener_configuracion_telemetria()
            )


            intervalo_ubicacion = (
                config_telemetria[
                    "ubicacion_actual_segundos"
                ]
            )


            intervalo_historial = (
                config_telemetria[
                    "historial_gps_segundos"
                ]
            )


            gps_inmediato_alerta = (
                config_telemetria[
                    "guardar_gps_inmediato_alerta"
                ]
            )


            segundos_separacion_alertas = (
                config_telemetria[
                    "segundos_separacion_alertas"
                ]
            )


            # =================================================
            # NORMALIZAR DATOS RECIBIDOS
            # =================================================

            estado_actual = str(
                data.get(
                    "estado",
                    ""
                )
            ).strip().lower()


            puerta_actual = str(
                data.get(
                    "puerta",
                    "desconocida"
                )
            ).strip().lower()


            try:

                vibracion_actual = int(
                    data.get(
                        "vibracion",
                        0
                    )
                )

            except (TypeError, ValueError):

                vibracion_actual = 0


            try:

                alerta_actual = int(
                    data.get(
                        "alerta",
                        0
                    )
                )

            except (TypeError, ValueError):

                alerta_actual = 0


            try:

                modo_manual_actual = int(
                    data.get(
                        "modo_manual",
                        0
                    )
                ) == 1

            except (TypeError, ValueError):

                modo_manual_actual = False
                
            
            try:

                modo_panico_actual = int(
                    data.get(
                        "modo_panico",
                        0
                    )
                ) == 1

            except (TypeError, ValueError):

                modo_panico_actual = False


            # También respetamos el estado textual manual.
            if estado_actual in (
                "manual",
                "modo_manual"
            ):
                modo_manual_actual = True

            # =================================================
            # ESTADO ANTERIOR DEL VEHÍCULO
            #
            # Se obtiene antes de actualizar UbicacionActual.
            # Sirve para registrar eventos solo cuando existe
            # cambio real de estado.
            # =================================================

            ubicacion_anterior = db.session.get(
                UbicacionActual,
                vehiculo.id
            )


            estado_anterior_ubicacion = (
                str(
                    ubicacion_anterior.estado or ""
                ).strip().lower()
                if ubicacion_anterior
                else ""
            )


            modo_manual_anterior = (
                obtener_estado_manual_anterior(
                    vehiculo.id,
                    estado_anterior_ubicacion
                )
            )


            # =================================================
            # ÚLTIMA CONEXIÓN DEL DISPOSITIVO
            #
            # Siempre se actualiza con cada paquete válido.
            # =================================================

            if dispositivo:

                dispositivo.ultima_conexion = ahora

                print(
                    "🔌 ÚLTIMA CONEXIÓN "
                    "ACTUALIZADA -> "
                    f"dispositivo serie: "
                    f"{dispositivo.serie}"
                )


            # =================================================
            # UBICACIÓN ACTUAL
            # =================================================

            ubicacion_actualizada = False


            if debe_actualizar_ubicacion_actual(
                vehiculo.id,
                intervalo_ubicacion
            ):

                actualizar_ubicacion_actual(
                    vehiculo.id,
                    data
                )

                ubicacion_actualizada = True

            else:

                print(
                    "⏳ UBICACIÓN ACTUAL OMITIDA -> "
                    "todavía no se cumplen "
                    f"{intervalo_ubicacion} segundos"
                )


            # =================================================
            # EVENTOS
            #
            # Los eventos de modo manual solo se registran
            # cuando cambia el estado:
            #
            # - normal -> manual
            # - manual -> normal
            #
            # No se registra un evento por cada paquete del ESP32.
            # =================================================

            evento_creado = False


            evento_creado = registrar_evento_cambio_manual(
                vehiculo.id,
                modo_manual_actual,
                modo_manual_anterior,
                data,
                ahora
            )


            if estado_actual in (
                "encendido",
                "apagado",
            ):

                ultimo_evento_mismo_tipo = (

                    Evento.query

                    .filter_by(
                        vehiculo_id=vehiculo.id,
                        tipo=estado_actual
                    )

                    .order_by(
                        Evento.timestamp.desc()
                    )

                    .first()

                )


                crear_evento_estado = True


                if ultimo_evento_mismo_tipo:

                    segundos_desde_ultimo_evento = (
                        ahora
                        -
                        int(
                            ultimo_evento_mismo_tipo.timestamp
                            or 0
                        )
                    )


                    crear_evento_estado = (
                        segundos_desde_ultimo_evento
                        >
                        10
                    )


                if crear_evento_estado:

                    evento = Evento(
                        vehiculo_id=vehiculo.id,
                        tipo=estado_actual,
                        descripcion=(
                            f"Evento '{estado_actual}' "
                            "recibido desde dispositivo"
                        ),
                        lat=data.get("lat"),
                        lng=data.get("lng"),
                        timestamp=ahora,
                    )


                    db.session.add(evento)


                    evento_creado = True


                    print(
                        "📝 EVENTO CREADO -> "
                        f"tipo: {estado_actual}"
                    )


                else:

                    print(
                        "⏳ EVENTO OMITIDO -> "
                        f"tipo repetido: {estado_actual}"
                    )


            # =================================================
            # VARIABLES DE CONTROL DE ALERTAS
            # =================================================

            alerta_creada = False

            alerta_actualizada = False

            alerta_reutilizada = False

            condicion_finalizada = False

            tipos_alerta_creados = []

            tipos_alerta_actualizados = []

            tipos_alerta_reutilizados = []


            # =================================================
            # ESTADO FÍSICO ACTUAL DE CADA CONDICIÓN
            #
            # Cada condición se procesa independientemente.
            #
            # Así un vehículo puede tener simultáneamente:
            #
            # - puerta abierta
            # - vibración
            # - pánico
            #
            # Pero nunca habrá dos condiciones activas del
            # mismo vehículo y mismo tipo.
            # =================================================

            condiciones_fisicas = {
                
                "panico": {
                    "activa": (
                        modo_panico_actual
                        or estado_actual == "panico"
                    ),
                    "nivel": "critico",
                    "descripcion": (
                        "Botón de pánico activado"
                    ),
                },


                "puerta_abierta": {
                    "activa": (
                        puerta_actual == "abierta"
                    ),
                    "nivel": "alto",
                    "descripcion": (
                        "Apertura de puerta detectada"
                    ),
                },


                "vibracion": {
                    "activa": (
                        vibracion_actual == 1
                    ),
                    "nivel": "medio",
                    "descripcion": (
                        "Vibración sospechosa detectada"
                    ),
                },

            }


            # =================================================
            # ALERTA GENERAL
            #
            # Solo se considera cuando alerta=1 y no existe
            # una condición específica activa.
            # =================================================

            hay_alerta_especifica = any(
                condicion["activa"]
                for condicion
                in condiciones_fisicas.values()
            )


            condiciones_fisicas[
                "alerta_general"
            ] = {

                "activa": (
                    alerta_actual == 1
                    and not hay_alerta_especifica
                ),

                "nivel": "medio",

                "descripcion": (
                    "Alerta general reportada "
                    "por el dispositivo"
                ),
            }


            # =================================================
            # FINALIZAR CONDICIONES QUE YA DESAPARECIERON
            #
            # Esto ocurre independientemente de que la alerta
            # haya sido atendida o siga pendiente.
            #
            # Ejemplo:
            #
            # puerta abierta:
            # condicion_activa = True
            #
            # llega puerta cerrada:
            # condicion_activa = False
            # =================================================

            for (
                tipo_condicion,
                informacion_condicion
            ) in condiciones_fisicas.items():

                sigue_activa = (
                    informacion_condicion[
                        "activa"
                    ]
                )


                if sigue_activa:
                    continue


                alertas_condicion_activa = (

                    Alerta.query

                    .filter_by(
                        vehiculo_id=vehiculo.id,
                        tipo=tipo_condicion,
                        condicion_activa=True
                    )

                    .all()

                )


                for alerta_anterior in (
                    alertas_condicion_activa
                ):

                    alerta_anterior.condicion_activa = (
                        False
                    )

                    alerta_anterior.ultima_actualizacion = (
                        ahora
                    )

                    condicion_finalizada = True


                    print(
                        "✅ CONDICIÓN FINALIZADA -> "
                        f"tipo: {tipo_condicion} | "
                        f"vehiculo_id: {vehiculo.id}"
                    )


            # =================================================
            # CREAR / ACTUALIZAR / REUTILIZAR ALERTAS
            #
            # En modo manual:
            # - Los sensores siguen llegando.
            # - No se generan alertas nuevas.
            #
            # Fuera de modo manual:
            # - Cada tipo activo se procesa independientemente.
            # =================================================

            for (
                tipo_alerta,
                informacion_alerta
            ) in condiciones_fisicas.items():

                    # =========================================
                    # IGNORAR CONDICIONES NO ACTIVAS
                    # =========================================

                    if not informacion_alerta[
                        "activa"
                    ]:
                        continue

                    # En modo manual se ignoran las alertas automáticas
                    # de sensores, pero el botón de pánico siempre se procesa.
                    if (
                        modo_manual_actual
                        and tipo_alerta != "panico"
                    ):

                        print(
                            "🛠️ MODO MANUAL -> "
                            "alerta automática ignorada | "
                            f"tipo: {tipo_alerta}"
                        )

                        continue

                    nivel_alerta = (
                        informacion_alerta[
                            "nivel"
                        ]
                    )


                    descripcion = (
                        informacion_alerta[
                            "descripcion"
                        ]
                    )


                    # =========================================
                    # 1. BUSCAR CONDICIÓN ACTUALMENTE ACTIVA
                    #
                    # No importa si está atendida o pendiente.
                    # Mientras la condición física siga activa,
                    # se actualiza la misma alerta.
                    # =========================================

                    alerta_existente_activa = (

                        Alerta.query

                        .filter_by(
                            vehiculo_id=vehiculo.id,
                            tipo=tipo_alerta,
                            condicion_activa=True
                        )

                        .order_by(
                            Alerta.timestamp.desc()
                        )

                        .first()

                    )


                    if alerta_existente_activa:

                        alerta_existente_activa.nivel = (
                            nivel_alerta
                        )

                        alerta_existente_activa.descripcion = (
                            descripcion
                        )

                        alerta_existente_activa.lat = (
                            data.get("lat")
                        )

                        alerta_existente_activa.lng = (
                            data.get("lng")
                        )

                        alerta_existente_activa.ultima_actualizacion = (
                            ahora
                        )


                        alerta_actualizada = True


                        tipos_alerta_actualizados.append(
                            tipo_alerta
                        )


                        print(
                            "🔁 CONDICIÓN TODAVÍA ACTIVA -> "
                            f"tipo: {tipo_alerta} | "
                            f"vehiculo_id: {vehiculo.id} | "
                            "atendida: "
                            f"{alerta_existente_activa.atendida}"
                        )


                        continue


                    # =========================================
                    # 2. BUSCAR LA ÚLTIMA ALERTA DEL MISMO TIPO
                    #
                    # Aquí ya sabemos que no existe una
                    # condición activa del mismo tipo.
                    # =========================================

                    ultima_alerta_mismo_tipo = (

                        Alerta.query

                        .filter_by(
                            vehiculo_id=vehiculo.id,
                            tipo=tipo_alerta
                        )

                        .order_by(
                            Alerta.ultima_actualizacion.desc(),
                            Alerta.timestamp.desc()
                        )

                        .first()

                    )


                    reutilizar_alerta = False

                    segundos_desde_ultima_alerta = None


                    if ultima_alerta_mismo_tipo:

                        referencia_ultima_alerta = (

                            ultima_alerta_mismo_tipo
                            .ultima_actualizacion

                            or

                            ultima_alerta_mismo_tipo
                            .timestamp

                        )


                        if referencia_ultima_alerta:

                            segundos_desde_ultima_alerta = (

                                ahora

                                - int(
                                    referencia_ultima_alerta
                                )

                            )


                            reutilizar_alerta = (

                                segundos_desde_ultima_alerta

                                <=

                                segundos_separacion_alertas

                            )


                    # =========================================
                    # 3. REUTILIZAR ALERTA ANTERIOR
                    #
                    # La misma condición reapareció dentro
                    # del tiempo configurado.
                    #
                    # No se crea otra fila.
                    # =========================================

                    if (
                        ultima_alerta_mismo_tipo
                        and reutilizar_alerta
                    ):

                        # ========================================================
                        # REACTIVAR CONDICIÓN FÍSICA
                        # ========================================================

                        ultima_alerta_mismo_tipo.condicion_activa = (
                            True
                        )


                        # ========================================================
                        # VOLVER A PONER LA ALERTA COMO PENDIENTE
                        #
                        # La condición física había terminado y ahora volvió
                        # a aparecer. Aunque reutilicemos la misma fila para
                        # evitar duplicados muy cercanos, administrativamente
                        # debe volver a requerir atención.
                        # ========================================================

                        ultima_alerta_mismo_tipo.atendida = False

                        ultima_alerta_mismo_tipo.atendida_por = None

                        ultima_alerta_mismo_tipo.fecha_atencion = None


                        # ========================================================
                        # ACTUALIZAR DATOS
                        # ========================================================

                        ultima_alerta_mismo_tipo.nivel = (
                            nivel_alerta
                        )

                        ultima_alerta_mismo_tipo.descripcion = (
                            descripcion
                        )

                        ultima_alerta_mismo_tipo.lat = (
                            data.get("lat")
                        )

                        ultima_alerta_mismo_tipo.lng = (
                            data.get("lng")
                        )

                        ultima_alerta_mismo_tipo.ultima_actualizacion = (
                            ahora
                        )


                        alerta_reutilizada = True

                        alerta_actualizada = True


                        tipos_alerta_reutilizados.append(
                            tipo_alerta
                        )


                        print(
                            "♻️ ALERTA REUTILIZADA Y REABIERTA -> "
                            f"tipo: {tipo_alerta} | "
                            f"vehiculo_id: {vehiculo.id} | "
                            "estado: pendiente | "
                            "segundos desde finalización anterior: "
                            f"{segundos_desde_ultima_alerta} | "
                            "ventana configurada: "
                            f"{segundos_separacion_alertas}"
                        )


                        continue

                    # =========================================
                    # 4. CREAR NUEVA ALERTA
                    #
                    # No existe condición activa anterior y
                    # ya pasó la ventana de separación.
                    # =========================================

                    alerta_nueva = crear_alerta(

                        vehiculo.id,

                        tipo_alerta,

                        nivel_alerta,

                        descripcion,

                        lat=data.get("lat"),

                        lng=data.get("lng")

                    )


                    alerta_nueva.condicion_activa = True

                    alerta_nueva.ultima_actualizacion = (
                        ahora
                    )


                    alerta_creada = True


                    tipos_alerta_creados.append(
                        tipo_alerta
                    )


                    print(
                        "🚨 NUEVA ALERTA CREADA -> "
                        f"tipo: {tipo_alerta} | "
                        f"vehiculo_id: {vehiculo.id}"
                    )


            # =================================================
            # HISTORIAL GPS
            #
            # Prioridad:
            #
            # 1. Al menos una nueva alerta real fue creada y
            #    GPS inmediato está habilitado.
            #
            # 2. En caso contrario, respetar intervalo normal.
            #
            # Las alertas actualizadas o reutilizadas no
            # fuerzan GPS inmediato.
            # =================================================

            historial_gps_guardado = False

            motivo_historial = None


            if (
                alerta_creada
                and gps_inmediato_alerta
            ):

                punto = guardar_historial_gps(

                    vehiculo.id,

                    (
                        dispositivo.id
                        if dispositivo
                        else None
                    ),

                    data,

                    motivo="alerta_nueva"

                )


                if punto:

                    historial_gps_guardado = True

                    motivo_historial = (
                        "alerta_nueva"
                    )


            elif debe_guardar_historial_gps(

                vehiculo.id,

                intervalo_historial

            ):

                punto = guardar_historial_gps(

                    vehiculo.id,

                    (
                        dispositivo.id
                        if dispositivo
                        else None
                    ),

                    data,

                    motivo="intervalo"

                )


                if punto:

                    historial_gps_guardado = True

                    motivo_historial = (
                        "intervalo"
                    )


            else:

                print(
                    "⏳ HISTORIAL GPS OMITIDO -> "
                    "todavía no se cumplen "
                    f"{intervalo_historial} segundos"
                )


            # =================================================
            # GUARDAR TODOS LOS CAMBIOS
            # =================================================

            db.session.commit()


            # =================================================
            # LOG FINAL
            # =================================================

            print(
                "✅ Evento creado: "
                f"{evento_creado} | "

                "Alerta creada: "
                f"{alerta_creada} | "

                "Alerta actualizada: "
                f"{alerta_actualizada} | "

                "Alerta reutilizada: "
                f"{alerta_reutilizada} | "

                "Condición finalizada: "
                f"{condicion_finalizada} | "

                "Ubicación actualizada: "
                f"{ubicacion_actualizada} | "

                "Historial GPS guardado: "
                f"{historial_gps_guardado} | "

                "Motivo historial: "
                f"{motivo_historial}"
            )


            print(
                "🚨 Nuevas: "
                f"{tipos_alerta_creados} | "
                "Actualizadas: "
                f"{tipos_alerta_actualizados} | "
                "Reutilizadas: "
                f"{tipos_alerta_reutilizados}"
            )


            print(
                "=" * 60 + "\n"
            )


            # =================================================
            # RESPUESTA
            # =================================================

            return jsonify({

                "success": True,

                "mensaje":
                    "datos procesados correctamente",

                "vehiculo":
                    vehiculo.nombre,

                "modo_manual":
                    modo_manual_actual,

                "evento_creado":
                    evento_creado,

                "alerta_creada":
                    alerta_creada,

                "alerta_actualizada":
                    alerta_actualizada,

                "alerta_reutilizada":
                    alerta_reutilizada,

                "condicion_finalizada":
                    condicion_finalizada,

                "tipos_alerta_creados":
                    tipos_alerta_creados,

                "tipos_alerta_actualizados":
                    tipos_alerta_actualizados,

                "tipos_alerta_reutilizados":
                    tipos_alerta_reutilizados,

                "segundos_separacion_alertas":
                    segundos_separacion_alertas,

                "ubicacion_actualizada":
                    ubicacion_actualizada,

                "historial_gps_guardado":
                    historial_gps_guardado,

                "motivo_historial":
                    motivo_historial,

            }), 200


        except Exception as error:

            db.session.rollback()


            print(
                "❌ ERROR al procesar "
                f"datos del ESP32: {error}"
            )


            return jsonify({

                "success": False,

                "mensaje":
                    "error interno del servidor"

            }), 500