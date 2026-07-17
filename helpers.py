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
import math
import json
import urllib.parse
import urllib.request
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

    En Fase 1 algunos valores todavía tienen respaldo fijo.
    En Fase 2 se podrán editar desde el panel admin.
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
                "distancia_minima_gps_metros": 15,
                "velocidad_minima_kmh": 1,
                "geocodificacion_direccion_segundos": 120,
                "distancia_minima_direccion_metros": 50,
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


        distancia_minima_gps_metros = float(
            getattr(
                configuracion,
                "distancia_minima_gps_metros",
                15
            )
        )


        velocidad_minima_kmh = float(
            getattr(
                configuracion,
                "velocidad_minima_kmh",
                1
            )
        )
        
        geocodificacion_direccion_segundos = int(
            getattr(
                configuracion,
                "geocodificacion_direccion_segundos",
                120
            )
        )


        distancia_minima_direccion_metros = int(
            getattr(
                configuracion,
                "distancia_minima_direccion_metros",
                50
            )
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


        if distancia_minima_gps_metros <= 0:
            distancia_minima_gps_metros = 15


        if velocidad_minima_kmh < 0:
            velocidad_minima_kmh = 1
            
            
        if geocodificacion_direccion_segundos <= 0:
            geocodificacion_direccion_segundos = 120


        if distancia_minima_direccion_metros <= 0:
            distancia_minima_direccion_metros = 50


        return {

            "ubicacion_actual_segundos":
                ubicacion_actual_segundos,

            "historial_gps_segundos":
                historial_gps_segundos,

            "guardar_gps_inmediato_alerta":
                guardar_gps_inmediato_alerta,

            "segundos_separacion_alertas":
                segundos_separacion_alertas,

            "distancia_minima_gps_metros":
                distancia_minima_gps_metros,

            "velocidad_minima_kmh":
                velocidad_minima_kmh,
                
            "geocodificacion_direccion_segundos":
                geocodificacion_direccion_segundos,

            "distancia_minima_direccion_metros":
                distancia_minima_direccion_metros,
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
            "distancia_minima_gps_metros": 15,
            "velocidad_minima_kmh": 1,
            "geocodificacion_direccion_segundos": 120,
            "distancia_minima_direccion_metros": 50,
        }
        
        
        
# ------------------------------------------------------------
# Convierte un valor a float opcional.
#
# Se usa para limpiar coordenadas y velocidad recibidas desde:
# - ESP32 físico
# - app simuladora móvil
# ------------------------------------------------------------
def convertir_float_opcional(valor):

    if valor in (
        None,
        "",
    ):
        return None


    try:

        return float(valor)

    except (
        TypeError,
        ValueError
    ):

        return None


# ------------------------------------------------------------
# Normaliza velocidad.
#
# Reglas:
# - Si no viene velocidad válida: 0.0
# - Si es menor al mínimo configurado: 0.0
# - Si es válida: se redondea a 1 decimal
#
# Esto evita valores como:
# 0.78865 km/h
# cuando el celular está quieto.
# ------------------------------------------------------------
def normalizar_velocidad_kmh(
    valor,
    velocidad_minima_kmh=1
):

    velocidad = convertir_float_opcional(
        valor
    )


    if velocidad is None:
        return 0.0


    if velocidad < 0:
        return 0.0


    if velocidad < float(
        velocidad_minima_kmh
    ):
        return 0.0


    return round(
        velocidad,
        1
    )


# ------------------------------------------------------------
# Calcula distancia entre dos coordenadas usando Haversine.
#
# Devuelve metros.
# ------------------------------------------------------------
def calcular_distancia_metros(
    lat1,
    lng1,
    lat2,
    lng2
):

    lat1 = convertir_float_opcional(lat1)
    lng1 = convertir_float_opcional(lng1)
    lat2 = convertir_float_opcional(lat2)
    lng2 = convertir_float_opcional(lng2)


    if (
        lat1 is None
        or lng1 is None
        or lat2 is None
        or lng2 is None
    ):

        return None


    radio_tierra_metros = 6371000


    lat1_rad = math.radians(lat1)
    lng1_rad = math.radians(lng1)
    lat2_rad = math.radians(lat2)
    lng2_rad = math.radians(lng2)


    diferencia_lat = lat2_rad - lat1_rad
    diferencia_lng = lng2_rad - lng1_rad


    a = (
        math.sin(diferencia_lat / 2) ** 2
        +
        math.cos(lat1_rad)
        *
        math.cos(lat2_rad)
        *
        math.sin(diferencia_lng / 2) ** 2
    )


    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )


    return radio_tierra_metros * c


# ------------------------------------------------------------
# Prepara datos de telemetría antes de guardarlos.
#
# Corrige:
# - velocidad con demasiados decimales
# - velocidad falsa cuando el celular está quieto
# - movimiento falso por variación pequeña de GPS
#
# Si la nueva ubicación se movió menos de X metros,
# conserva la ubicación anterior para que el mapa no brinque.
# ------------------------------------------------------------
def preparar_datos_telemetria(
    vehiculo_id,
    data,
    distancia_minima_gps_metros=15,
    velocidad_minima_kmh=1
):

    datos = dict(
        data or {}
    )


    # ========================================================
    # GPS VÁLIDO
    # ========================================================

    gps_valido_recibido = datos.get(
        "gps_valido",
        True
    )


    gps_valido = True


    if isinstance(
        gps_valido_recibido,
        str
    ):

        gps_valido = (
            gps_valido_recibido
            .strip()
            .lower()
            not in (
                "0",
                "false",
                "no",
                "gps_invalido",
            )
        )


    elif isinstance(
        gps_valido_recibido,
        int
    ):

        gps_valido = (
            gps_valido_recibido == 1
        )


    elif isinstance(
        gps_valido_recibido,
        bool
    ):

        gps_valido = gps_valido_recibido


    datos["gps_valido"] = gps_valido


    # ========================================================
    # VELOCIDAD
    # ========================================================

    datos["velocidad"] = (
        normalizar_velocidad_kmh(
            datos.get("velocidad", 0),
            velocidad_minima_kmh
        )
    )


    # ========================================================
    # COORDENADAS
    # ========================================================

    lat_nueva = convertir_float_opcional(
        datos.get("lat")
    )

    lng_nueva = convertir_float_opcional(
        datos.get("lng")
    )


    datos["_gps_movimiento_valido"] = False
    datos["_gps_distancia_metros"] = None


    if (
        not gps_valido
        or lat_nueva is None
        or lng_nueva is None
    ):

        datos["lat"] = None
        datos["lng"] = None

        return datos


    ubicacion_anterior = db.session.get(
        UbicacionActual,
        vehiculo_id
    )


    if (
        not ubicacion_anterior
        or ubicacion_anterior.lat is None
        or ubicacion_anterior.lng is None
    ):

        datos["lat"] = round(
            lat_nueva,
            6
        )

        datos["lng"] = round(
            lng_nueva,
            6
        )

        datos["_gps_movimiento_valido"] = True

        return datos


    distancia_metros = calcular_distancia_metros(
        ubicacion_anterior.lat,
        ubicacion_anterior.lng,
        lat_nueva,
        lng_nueva
    )


    datos["_gps_distancia_metros"] = (
        round(
            distancia_metros,
            2
        )
        if distancia_metros is not None
        else None
    )


    if (
        distancia_metros is not None
        and distancia_metros <
        float(distancia_minima_gps_metros)
    ):

        # Conserva ubicación anterior para evitar saltos falsos.
        datos["lat"] = ubicacion_anterior.lat
        datos["lng"] = ubicacion_anterior.lng
        datos["_gps_movimiento_valido"] = False

        print(
            "📍 GPS FILTRADO -> "
            "movimiento menor al mínimo | "
            f"distancia: {round(distancia_metros, 2)} m | "
            f"mínimo: {distancia_minima_gps_metros} m"
        )

        return datos


    datos["lat"] = round(
        lat_nueva,
        6
    )

    datos["lng"] = round(
        lng_nueva,
        6
    )

    datos["_gps_movimiento_valido"] = True

    return datos        

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
# Construye una dirección corta a partir de la respuesta
# de Nominatim / OpenStreetMap.
# ------------------------------------------------------------
def construir_direccion_corta(
    datos_direccion
):

    if not isinstance(
        datos_direccion,
        dict
    ):

        return None


    address = datos_direccion.get(
        "address",
        {}
    )


    if not isinstance(
        address,
        dict
    ):

        return datos_direccion.get(
            "display_name"
        )


    calle = (
        address.get("road")
        or address.get("pedestrian")
        or address.get("residential")
        or address.get("path")
        or address.get("footway")
    )


    numero = address.get(
        "house_number"
    )


    colonia = (
        address.get("neighbourhood")
        or address.get("suburb")
        or address.get("quarter")
    )


    ciudad = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
    )


    estado = address.get(
        "state"
    )


    partes = []


    if calle and numero:

        partes.append(
            f"{calle} {numero}"
        )

    elif calle:

        partes.append(
            calle
        )


    if colonia:
        partes.append(
            colonia
        )


    if ciudad:
        partes.append(
            ciudad
        )


    if estado:
        partes.append(
            estado
        )


    if partes:

        return ", ".join(
            partes[:4]
        )


    return datos_direccion.get(
        "display_name"
    )


# ------------------------------------------------------------
# Consulta dirección aproximada usando Nominatim.
#
# IMPORTANTE:
# No debe llamarse en cada paquete del ESP32/app simuladora.
# Se controla con:
# - intervalo de configuración
# - distancia mínima de configuración
# ------------------------------------------------------------
def consultar_direccion_por_coordenadas(
    lat,
    lng
):

    lat = convertir_float_opcional(
        lat
    )

    lng = convertir_float_opcional(
        lng
    )


    if lat is None or lng is None:
        return None


    parametros = urllib.parse.urlencode({
        "format": "jsonv2",
        "lat": f"{lat:.6f}",
        "lon": f"{lng:.6f}",
        "zoom": "18",
        "addressdetails": "1",
        "accept-language": "es",
    })


    url = (
        "https://nominatim.openstreetmap.org"
        f"/reverse?{parametros}"
    )


    solicitud = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "TrackSecurity/1.0 "
                "(contacto: soporte@tracksecurity.local)"
            )
        }
    )


    try:

        with urllib.request.urlopen(
            solicitud,
            timeout=4
        ) as respuesta:

            contenido = respuesta.read().decode(
                "utf-8"
            )


        datos = json.loads(
            contenido
        )


        direccion = construir_direccion_corta(
            datos
        )


        if direccion:

            return direccion[:255]


        return None


    except Exception as error:

        print(
            "⚠️ No se pudo obtener dirección "
            f"por coordenadas: {error}"
        )

        return None


# ------------------------------------------------------------
# Decide si ya toca actualizar la dirección textual.
#
# Reglas:
# - Si no hay dirección previa, sí consulta.
# - Si no ha pasado el intervalo configurado, no consulta.
# - Si no se movió la distancia mínima configurada, no consulta.
# ------------------------------------------------------------
def debe_actualizar_direccion_ubicacion(
    ubicacion,
    lat,
    lng,
    intervalo_segundos,
    distancia_minima_metros
):

    if not ubicacion:
        return False


    lat = convertir_float_opcional(
        lat
    )

    lng = convertir_float_opcional(
        lng
    )


    if lat is None or lng is None:
        return False


    if not ubicacion.direccion:

        return True


    ahora = timestamp_actual()


    ultima_actualizacion_direccion = (
        ubicacion.ultima_actualizacion_direccion
    )


    if ultima_actualizacion_direccion:

        segundos_transcurridos = (
            ahora
            -
            int(
                ultima_actualizacion_direccion
            )
        )


        if segundos_transcurridos < int(
            intervalo_segundos
        ):

            return False


    if (
        ubicacion.direccion_lat is None
        or ubicacion.direccion_lng is None
    ):

        return True


    distancia = calcular_distancia_metros(
        ubicacion.direccion_lat,
        ubicacion.direccion_lng,
        lat,
        lng
    )


    if distancia is None:

        return True


    return distancia >= float(
        distancia_minima_metros
    )


# ------------------------------------------------------------
# Actualiza la dirección textual si corresponde.
# ------------------------------------------------------------
def actualizar_direccion_si_corresponde(
    ubicacion,
    data,
    config_telemetria
):

    if not ubicacion:
        return None


    gps_valido = data.get(
        "gps_valido",
        True
    )


    if gps_valido is False:

        print(
            "📍 DIRECCIÓN OMITIDA -> GPS inválido"
        )

        return None


    lat = data.get(
        "lat"
    )

    lng = data.get(
        "lng"
    )


    intervalo_segundos = int(
        config_telemetria.get(
            "geocodificacion_direccion_segundos",
            120
        )
    )


    distancia_minima_metros = int(
        config_telemetria.get(
            "distancia_minima_direccion_metros",
            50
        )
    )


    if not debe_actualizar_direccion_ubicacion(
        ubicacion,
        lat,
        lng,
        intervalo_segundos,
        distancia_minima_metros
    ):

        print(
            "📍 DIRECCIÓN OMITIDA -> "
            "no cumple intervalo/distancia mínima"
        )

        return None


    direccion = consultar_direccion_por_coordenadas(
        lat,
        lng
    )


    if not direccion:

        print(
            "📍 DIRECCIÓN NO DISPONIBLE"
        )

        return None


    ubicacion.direccion = direccion
    ubicacion.direccion_lat = lat
    ubicacion.direccion_lng = lng
    ubicacion.ultima_actualizacion_direccion = (
        timestamp_actual()
    )


    print(
        "📍 DIRECCIÓN ACTUALIZADA -> "
        f"{direccion}"
    )


    return direccion

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
    data,
    config_telemetria=None
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


    if config_telemetria is None:

        config_telemetria = (
            obtener_configuracion_telemetria()
        )


    actualizar_direccion_si_corresponde(
        ubicacion,
        data,
        config_telemetria
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


    if gps_valido is False:

        print(
            "⚠️ HISTORIAL GPS OMITIDO -> "
            "GPS marcado como inválido"
        )

        return None


    if (
        motivo == "intervalo"
        and
        data.get("_gps_movimiento_valido") is False
    ):

        print(
            "⚠️ HISTORIAL GPS OMITIDO -> "
            "movimiento menor al mínimo configurado"
        )

        return None


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