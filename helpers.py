# ============================================================
# HELPERS - TrackSecurity
# ============================================================
#
# Funciones auxiliares reutilizables.
#
# Aquí NO van endpoints.
# Aquí van acciones que se usan desde varias rutas:
# - obtener usuario actual
# - validar contraseñas
# - registrar eventos
# - validar límite de vehículos
# - procesar datos recibidos del ESP32
# ============================================================

import time
import bcrypt
from flask_jwt_extended import get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash

from config import db
from models import (
    Usuario,
    Vehiculo,
    Suscripcion,
    Evento,
    Alerta,
    UbicacionActual,
    HistorialGPS,
    ConfiguracionSistema,
)


# ------------------------------------------------------------
# Devuelve la fecha/hora actual en timestamp.
# Se usa en alertas, eventos, historial GPS y conexiones.
# ------------------------------------------------------------
def timestamp_actual():
    return int(time.time())

# ------------------------------------------------------------
# Obtiene la configuración global del sistema.
#
# La plataforma utiliza una sola fila global:
# id = 1
#
# Si por alguna razón no existe, la crea automáticamente
# utilizando los valores por defecto definidos en el modelo.
# ------------------------------------------------------------
def obtener_configuracion_sistema():
    configuracion = db.session.get(
        ConfiguracionSistema,
        1
    )

    if configuracion:
        return configuracion

    configuracion = ConfiguracionSistema(
        id=1
    )

    db.session.add(configuracion)
    db.session.commit()

    return configuracion


# ------------------------------------------------------------
# Obtiene el tiempo global para considerar un vehículo sin señal.
#
# Devuelve siempre un entero positivo.
# Si existe cualquier problema con la configuración,
# usa 60 segundos como respaldo seguro.
# ------------------------------------------------------------
def obtener_segundos_sin_senal():
    try:
        configuracion = db.session.get(
            ConfiguracionSistema,
            1
        )

        if not configuracion:
            return 60

        segundos = int(
            configuracion.segundos_sin_senal
        )

        if segundos <= 0:
            return 60

        return segundos

    except Exception as error:
        print(
            "No se pudo obtener segundos_sin_senal "
            f"desde configuración: {error}"
        )

        return 60


# ------------------------------------------------------------
# Obtiene la configuración global de telemetría y GPS.
#
# Devuelve valores seguros aunque exista algún problema con
# la fila global de configuración.
# ------------------------------------------------------------
def obtener_configuracion_telemetria():
    """
    Obtiene la configuración global usada por:

    - Telemetría.
    - GPS.
    - Alertas.

    Devuelve valores seguros aunque exista algún problema
    al consultar la configuración.
    """

    try:

        configuracion = db.session.get(
            ConfiguracionSistema,
            1
        )


        if not configuracion:

            return {
                "ubicacion_actual_segundos": 3,
                "historial_gps_segundos": 30,
                "guardar_gps_inmediato_alerta": True,
                "segundos_separacion_alertas": 10,
            }


        ubicacion_actual_segundos = int(
            configuracion.ubicacion_actual_segundos
        )


        historial_gps_segundos = int(
            configuracion.historial_gps_segundos
        )


        guardar_gps_inmediato_alerta = bool(
            configuracion.guardar_gps_inmediato_alerta
        )


        segundos_separacion_alertas = int(
            configuracion.segundos_separacion_alertas
        )


        # ====================================================
        # RESPALDOS DE SEGURIDAD
        # ====================================================

        if ubicacion_actual_segundos <= 0:
            ubicacion_actual_segundos = 3


        if historial_gps_segundos <= 0:
            historial_gps_segundos = 30


        if segundos_separacion_alertas <= 0:
            segundos_separacion_alertas = 10


        return {

            "ubicacion_actual_segundos":
                ubicacion_actual_segundos,

            "historial_gps_segundos":
                historial_gps_segundos,

            "guardar_gps_inmediato_alerta":
                guardar_gps_inmediato_alerta,

            "segundos_separacion_alertas":
                segundos_separacion_alertas,
        }


    except Exception as error:

        print(
            "No se pudo obtener la configuración "
            f"de telemetría y alertas: {error}"
        )


        return {
            "ubicacion_actual_segundos": 3,
            "historial_gps_segundos": 30,
            "guardar_gps_inmediato_alerta": True,
            "segundos_separacion_alertas": 10,
        }


# ------------------------------------------------------------
# Decide si ya corresponde actualizar UbicacionActual.
#
# Si todavía no existe una fila para el vehículo,
# devuelve True para crearla inmediatamente.
# ------------------------------------------------------------
def debe_actualizar_ubicacion_actual(
    vehiculo_id,
    intervalo_segundos
):
    ubicacion = db.session.get(
        UbicacionActual,
        vehiculo_id
    )

    if not ubicacion:
        return True

    ultima_actualizacion = (
        ubicacion.ultima_actualizacion
    )

    if not ultima_actualizacion:
        return True

    ahora = timestamp_actual()

    segundos_transcurridos = (
        ahora - int(ultima_actualizacion)
    )

    return (
        segundos_transcurridos >=
        int(intervalo_segundos)
    )



# ------------------------------------------------------------
# Decide si ya corresponde guardar un nuevo punto normal
# en HistorialGPS.
#
# Consulta solamente el último punto del vehículo.
# ------------------------------------------------------------
def debe_guardar_historial_gps(
    vehiculo_id,
    intervalo_segundos
):
    ultimo_punto = (
        HistorialGPS.query
        .filter_by(
            vehiculo_id=vehiculo_id
        )
        .order_by(
            HistorialGPS.timestamp.desc()
        )
        .first()
    )

    if not ultimo_punto:
        return True

    if not ultimo_punto.timestamp:
        return True

    ahora = timestamp_actual()

    segundos_transcurridos = (
        ahora - int(ultimo_punto.timestamp)
    )

    return (
        segundos_transcurridos >=
        int(intervalo_segundos)
    )

# ------------------------------------------------------------
# Genera hash seguro para contraseña.
# Se usa al crear usuarios o cambiar contraseñas.
# ------------------------------------------------------------
def hashear_password(password):
    return generate_password_hash(password)


# ------------------------------------------------------------
# Verifica contraseña contra el hash guardado.
#
# Se usa actualmente en:
# - POST /api/login
# - PUT /api/dueno/password
#
# Soporta hashes de Werkzeug y bcrypt para evitar problemas
# con usuarios creados en diferentes etapas del proyecto.
# ------------------------------------------------------------
def verificar_password(password, password_hash):
    if not password_hash:
        return False

    try:
        if password_hash.startswith(("scrypt:", "pbkdf2:", "sha256:")):
            return check_password_hash(password_hash, password)

        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8")
        )
    except Exception:
        try:
            return check_password_hash(password_hash, password)
        except Exception:
            return False


# ------------------------------------------------------------
# Obtiene el usuario autenticado usando el JWT actual.
# Se usa en casi todos los endpoints protegidos.
# ------------------------------------------------------------
def obtener_usuario_actual():
    usuario_id = get_jwt_identity()

    if not usuario_id:
        return None

    return db.session.get(Usuario, int(usuario_id))


# ------------------------------------------------------------
# Registra un evento importante en la bitácora del vehículo.
#
# Se usa actualmente en:
# - crear vehículo
# - editar vehículo
# - desactivar vehículo
# - atender alerta
# - vincular dispositivo
# - eventos recibidos desde ESP32
#
# También puede usarse después para reportes o auditoría.
# ------------------------------------------------------------
def registrar_evento(vehiculo_id, tipo, descripcion, lat=None, lng=None):
    try:
        evento = Evento(
            vehiculo_id=vehiculo_id,
            tipo=tipo,
            descripcion=descripcion,
            lat=lat,
            lng=lng,
            timestamp=timestamp_actual(),
        )
        db.session.add(evento)
    except Exception as e:
        print(f"⚠️ No se pudo preparar evento: {e}")


# ------------------------------------------------------------
# Busca la suscripción activa más reciente de una empresa.
#
# Se usa actualmente en:
# - validar límite de vehículos
# - detalle del vehículo para saber si tiene plan Premium
# ------------------------------------------------------------
def obtener_suscripcion_activa(empresa_id):
    return Suscripcion.query.filter_by(
        empresa_id=empresa_id,
        estado="activa"
    ).order_by(Suscripcion.fecha_inicio.desc()).first()


# ------------------------------------------------------------
# Valida si la empresa puede crear otro vehículo según su plan.
#
# Se usa actualmente en:
# - POST /api/vehiculos
# ------------------------------------------------------------
def validar_limite_vehiculos(empresa_id):
    suscripcion = obtener_suscripcion_activa(empresa_id)

    if not suscripcion:
        return False, "La empresa no tiene una suscripción activa."

    vehiculos_activos = Vehiculo.query.filter_by(
        empresa_id=empresa_id,
        activo=True
    ).count()

    if vehiculos_activos >= suscripcion.cantidad_vehiculos:
        return False, (
            f"Límite alcanzado. Tu suscripción permite "
            f"{suscripcion.cantidad_vehiculos} vehículos activos."
        )

    return True, None


# ------------------------------------------------------------
# Revisa si un chofer ya está asignado a otro vehículo activo.
#
# Se usa actualmente en:
# - crear vehículo
# - editar vehículo
# - listar choferes disponibles
#
# También puede usarse en la app móvil si luego permites asignar
# choferes desde celular.
# ------------------------------------------------------------
def chofer_ocupado_en_otro_vehiculo(empresa_id, chofer_id, vehiculo_id_actual=None):
    if not chofer_id:
        return None

    consulta = Vehiculo.query.filter(
        Vehiculo.empresa_id == empresa_id,
        Vehiculo.chofer_id == chofer_id,
        Vehiculo.activo == True
    )

    if vehiculo_id_actual:
        consulta = consulta.filter(Vehiculo.id != vehiculo_id_actual)

    return consulta.first()


# ------------------------------------------------------------
# Imprime en consola los datos recibidos desde ESP32.
#
# Se usa actualmente en:
# - POST /datos
# ------------------------------------------------------------
def imprimir_log_datos_esp32(data):
    print("\n" + "=" * 60)
    print("📡 NUEVO PAQUETE RECIBIDO DESDE ESP32")
    print("=" * 60)
    print(f"🧾 JSON recibido      : {data}")
    print(f"🚚 Vehículo detectado : {data.get('vehiculo')}")
    print(f"📶 Estado             : {data.get('estado')}")
    print(f"🚪 Puerta             : {data.get('puerta')}")
    print(f"📳 Vibración          : {data.get('vibracion')}")
    print(f"🚨 Alerta             : {data.get('alerta')}")
    print(f"🌐 Latitud            : {data.get('lat')}")
    print(f"🌐 Longitud           : {data.get('lng')}")
    print(f"🏎️  Velocidad          : {data.get('velocidad')}")


# ------------------------------------------------------------
# Crea una alerta en la base de datos.
#
# Se usa actualmente en:
# - POST /datos cuando ESP32 reporta pánico, puerta abierta,
#   vibración o alerta general.
# ------------------------------------------------------------
def crear_alerta(
    vehiculo_id,
    tipo,
    nivel,
    descripcion,
    lat=None,
    lng=None
):
    ahora = timestamp_actual()

    alerta = Alerta(
        vehiculo_id=vehiculo_id,
        tipo=tipo,
        nivel=nivel,
        descripcion=descripcion,
        lat=lat,
        lng=lng,

        # Nueva alerta administrativa.
        atendida=False,

        # La condición física acaba de detectarse,
        # por lo tanto está activa.
        condicion_activa=True,

        timestamp=ahora,
        ultima_actualizacion=ahora,
    )

    db.session.add(alerta)

    print(
        f"🚨 ALERTA CREADA -> "
        f"tipo: {tipo} | "
        f"nivel: {nivel} | "
        f"vehiculo_id: {vehiculo_id}"
    )

    return alerta

# ------------------------------------------------------------
# Actualiza la ubicación actual del vehículo.
#
# Se usa actualmente en:
# - POST /datos
#
# Esta tabla guarda solo el último estado conocido para que el
# dashboard cargue rápido.
# ------------------------------------------------------------
def actualizar_ubicacion_actual(
    vehiculo_id,
    data
):
    ubicacion = db.session.get(
        UbicacionActual,
        vehiculo_id
    )

    if not ubicacion:
        ubicacion = UbicacionActual(
            vehiculo_id=vehiculo_id
        )

        db.session.add(ubicacion)

    ubicacion.lat = data.get("lat")

    ubicacion.lng = data.get("lng")

    ubicacion.velocidad = data.get(
        "velocidad",
        0
    )

    ubicacion.estado = data.get(
        "estado",
        "sin_senal"
    )

    ubicacion.puerta = data.get(
        "puerta",
        "desconocida"
    )

    ubicacion.vibracion = int(
        data.get(
            "vibracion",
            0
        )
    )

    ubicacion.alerta = int(
        data.get(
            "alerta",
            0
        )
    )

    ubicacion.ultima_actualizacion = (
        timestamp_actual()
    )

    print(
        "📍 UBICACIÓN ACTUAL ACTUALIZADA -> "
        f"vehiculo_id: {vehiculo_id}"
    )

    return ubicacion

# ------------------------------------------------------------
# Guarda un punto nuevo en el historial GPS.
#
# Se usa actualmente en:
# - POST /datos
#
# Sirve para historial, rutas, reportes y mapas.
# ------------------------------------------------------------
def guardar_historial_gps(
    vehiculo_id,
    dispositivo_id,
    data,
    motivo="intervalo"
):
    lat = data.get("lat")
    lng = data.get("lng")

    gps_valido = data.get(
        "gps_valido",
        True
    )

    # Si el ESP32 indica explícitamente que el GPS no es válido,
    # no se crea un punto histórico.
    if gps_valido is False:
        print(
            "⚠️ HISTORIAL GPS OMITIDO -> "
            "GPS marcado como inválido"
        )

        return None

    # Sin coordenadas no tiene sentido guardar el punto.
    if lat is None or lng is None:
        print(
            "⚠️ HISTORIAL GPS OMITIDO -> "
            "sin coordenadas válidas"
        )

        return None

    punto = HistorialGPS(
        vehiculo_id=vehiculo_id,
        dispositivo_id=dispositivo_id,
        lat=lat,
        lng=lng,
        velocidad=data.get(
            "velocidad",
            0
        ),
        timestamp=timestamp_actual(),
    )

    db.session.add(punto)

    print(
        "🗺️ HISTORIAL GPS GUARDADO -> "
        f"vehiculo_id: {vehiculo_id} | "
        f"motivo: {motivo}"
    )

    return punto
