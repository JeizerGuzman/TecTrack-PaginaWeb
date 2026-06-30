# ============================================================
# ROUTES ESP32 - TrackSecurity
# ============================================================
#
# Endpoint usado por el dispositivo ESP32.
#
# Importante:
# /datos NO usa JWT porque el dispositivo no inicia sesión como usuario.
# La validación se hace por serie del dispositivo o identificador.
# ============================================================

from flask import request, jsonify

from config import db
from models import Dispositivo, Vehiculo, Evento, Alerta
from helpers import (
    timestamp_actual,
    imprimir_log_datos_esp32,
    actualizar_ubicacion_actual,
    guardar_historial_gps,
    crear_alerta,
)


# ------------------------------------------------------------
# Registra rutas del ESP32.
# ------------------------------------------------------------
def registrar_esp32_routes(app):

    # Recibe datos del ESP32 y los guarda en base de datos.
    #
    # Se usa actualmente en:
    # - Código del ESP32 con HTTP POST a /datos
    #
    # Recibe:
    # - serie
    # - vehiculo
    # - estado
    # - alerta
    # - puerta
    # - vibracion
    # - lat/lng
    # - velocidad
    @app.route("/datos", methods=["POST"])
    def recibir_datos_esp32():
        data = request.get_json(silent=True) or {}

        if not data:
            return jsonify({
                "success": False,
                "mensaje": "no se recibió JSON"
            }), 400

        imprimir_log_datos_esp32(data)

        serie = data.get("serie")
        identificador_vehiculo = data.get("vehiculo")

        dispositivo = None
        if serie:
            dispositivo = Dispositivo.query.filter_by(serie=serie).first()

        vehiculo = None

        if dispositivo:
            vehiculo = Vehiculo.query.filter_by(
                dispositivo_id=dispositivo.id
            ).first()

        # Compatibilidad para pruebas: buscar por identificador del vehículo.
        if not vehiculo and identificador_vehiculo:
            vehiculo = Vehiculo.query.filter_by(
                identificador=identificador_vehiculo
            ).first()

        if not vehiculo:
            print("❌ No se encontró vehículo para estos datos.")
            return jsonify({
                "success": False,
                "mensaje": (
                    "no se encontró un vehículo asociado "
                    "a esta serie/identificador"
                )
            }), 404

        try:
            actualizar_ubicacion_actual(vehiculo.id, data)

            guardar_historial_gps(
                vehiculo.id,
                dispositivo.id if dispositivo else None,
                data
            )

            evento_creado = False
            estado = data.get("estado")

            if estado in ("encendido", "apagado", "modo_manual"):
                evento = Evento(
                    vehiculo_id=vehiculo.id,
                    tipo=estado,
                    descripcion=f"Evento '{estado}' recibido desde dispositivo",
                    lat=data.get("lat"),
                    lng=data.get("lng"),
                    timestamp=timestamp_actual(),
                )
                db.session.add(evento)
                evento_creado = True
                print(f"📝 EVENTO CREADO -> tipo: {estado}")

            alerta_creada = False

            # También se considera pánico aunque alerta venga en 0.
            es_alerta = (
                int(data.get("alerta", 0)) == 1 or
                data.get("puerta") == "abierta" or
                int(data.get("vibracion", 0)) == 1 or
                estado in ("alerta", "panico")
            )

            if es_alerta:
                if estado == "panico":
                    tipo_alerta = "panico"
                    nivel_alerta = "critico"
                    descripcion = "Botón de pánico activado"

                elif data.get("puerta") == "abierta":
                    tipo_alerta = "puerta_abierta"
                    nivel_alerta = "alto"
                    descripcion = "Apertura de puerta detectada"

                elif int(data.get("vibracion", 0)) == 1:
                    tipo_alerta = "vibracion"
                    nivel_alerta = "medio"
                    descripcion = "Vibración sospechosa detectada"

                else:
                    tipo_alerta = "alerta_general"
                    nivel_alerta = "medio"
                    descripcion = "Alerta general reportada por el dispositivo"

                alerta_existente = Alerta.query.filter_by(
                    vehiculo_id=vehiculo.id,
                    tipo=tipo_alerta,
                    atendida=False
                ).order_by(Alerta.timestamp.desc()).first()

                if alerta_existente:
                    alerta_existente.nivel = nivel_alerta
                    alerta_existente.descripcion = descripcion
                    alerta_existente.lat = data.get("lat")
                    alerta_existente.lng = data.get("lng")
                    alerta_existente.timestamp = timestamp_actual()

                    print(
                        f"🔁 ALERTA YA ACTIVA -> se actualizó: "
                        f"{tipo_alerta} | vehiculo_id: {vehiculo.id}"
                    )
                else:
                    crear_alerta(
                        vehiculo.id,
                        tipo_alerta,
                        nivel_alerta,
                        descripcion,
                        lat=data.get("lat"),
                        lng=data.get("lng")
                    )
                    alerta_creada = True

            if dispositivo:
                dispositivo.ultima_conexion = timestamp_actual()
                print(
                    f"🔌 ÚLTIMA CONEXIÓN ACTUALIZADA -> "
                    f"dispositivo serie: {dispositivo.serie}"
                )

            db.session.commit()

            print(
                f"✅ Evento creado: {evento_creado} | "
                f"Alerta creada: {alerta_creada}"
            )
            print("=" * 60 + "\n")

            return jsonify({
                "success": True,
                "mensaje": "datos procesados correctamente",
                "vehiculo": vehiculo.nombre,
                "evento_creado": evento_creado,
                "alerta_creada": alerta_creada,
            }), 200

        except Exception as e:
            db.session.rollback()
            print(f"❌ ERROR al procesar datos del ESP32: {e}")
            return jsonify({
                "success": False,
                "mensaje": "error interno del servidor"
            }), 500
