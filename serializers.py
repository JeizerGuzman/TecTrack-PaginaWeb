# ============================================================
# SERIALIZERS - TrackSecurity
# ============================================================
#
# Convierte objetos de SQLAlchemy en diccionarios JSON.
#
# Aquí NO van endpoints.
# Aquí NO se debe guardar información.
# Solo se prepara la respuesta que se manda al frontend/app.
# ============================================================

import time
from config import db
from models import Empresa, Usuario, Vehiculo, Dispositivo, UbicacionActual
from helpers import obtener_segundos_sin_senal

# ============================================================
# CONFIGURACIÓN DE CONEXIÓN DEL DISPOSITIVO
# ============================================================
#
# El ESP32 envía datos cada 1.5 segundos aproximadamente.
# Si pasan más de 60 segundos sin recibir datos, se considera
# que el dispositivo está sin señal.
#
# Puedes cambiarlo a 30 si quieres que detecte más rápido.
# ============================================================


def calcular_estado_conexion(ubicacion=None, dispositivo=None):
    """
    Calcula si el vehículo/dispositivo sigue en línea.

    No modifica la base de datos.
    Solo sirve para que la web y la app móvil muestren:
    - online
    - sin_senal
    - segundos_sin_senal
    """

    ahora = int(time.time())

    ultima_actualizacion = (
        ubicacion.ultima_actualizacion
        if ubicacion
        else None
    )

    ultima_conexion = (
        dispositivo.ultima_conexion
        if dispositivo
        else None
    )

    # Se prefiere ultima_actualizacion porque representa el último
    # paquete real recibido y guardado en ubicación actual.
    referencia = ultima_actualizacion or ultima_conexion

    if not referencia:
        return {
            "online": False,
            "sin_senal": True,
            "segundos_sin_senal": None,
            "ultima_referencia": None
        }

    segundos = ahora - referencia

    tiempo_sin_senal = obtener_segundos_sin_senal()

    sin_senal = segundos > tiempo_sin_senal

    return {
        "online": not sin_senal,
        "sin_senal": sin_senal,
        "segundos_sin_senal": segundos,
        "ultima_referencia": referencia
    }


def calcular_estado_visible_vehiculo(ubicacion=None, dispositivo=None):
    """
    Calcula el estado que debe ver la web/app/gráficas.

    Importante:
    - NO modifica la base de datos.
    - NO cambia UbicacionActual.estado.
    - Solo decide qué mostrar al usuario.

    Ejemplo:
    Si el último estado guardado fue "manual", pero ya pasaron
    más de 60 segundos sin conexión, se muestra "sin_senal".
    """

    conexion = calcular_estado_conexion(ubicacion, dispositivo)

    estado_real = ubicacion.estado if ubicacion else None

    # ========================================================
    # PRIORIDAD 1: SIN SEÑAL
    # ========================================================
    # Si no hay conexión, esto manda sobre cualquier estado viejo.
    # Aunque el último estado guardado sea manual, alerta o activo,
    # visualmente debe mostrarse sin_senal.
    # ========================================================
    if conexion["sin_senal"]:
        return {
            "estado": "sin_senal",
            "estado_real": estado_real,

            "online": False,
            "sin_senal": True,
            "segundos_sin_senal": conexion["segundos_sin_senal"],

            "lat": None,
            "lng": None,
            "velocidad": None,

            "puerta": "sin_conexion",
            "vibracion": None,
            "alerta": 0,

            "ultima_actualizacion": (
                ubicacion.ultima_actualizacion
                if ubicacion
                else None
            )
        }

    # ========================================================
    # PRIORIDAD 2: CON SEÑAL
    # ========================================================
    # Si sí hay conexión, entonces mostramos el último dato real.
    # Aquí sí puede mostrarse manual, panico, alerta o activo.
    # ========================================================
    estado = estado_real or "activo"

    return {
        "estado": estado,
        "estado_real": estado_real,

        "online": True,
        "sin_senal": False,
        "segundos_sin_senal": conexion["segundos_sin_senal"],

        "lat": ubicacion.lat if ubicacion else None,
        "lng": ubicacion.lng if ubicacion else None,
        "velocidad": ubicacion.velocidad if ubicacion else 0,

        "puerta": ubicacion.puerta if ubicacion else "desconocida",
        "vibracion": ubicacion.vibracion if ubicacion else None,
        "alerta": ubicacion.alerta if ubicacion else 0,

        "ultima_actualizacion": (
            ubicacion.ultima_actualizacion
            if ubicacion
            else None
        )
    }

# ------------------------------------------------------------
# Obtiene el nombre del chofer según su id.
#
# Se usa actualmente en:
# - serializar_vehiculo()
# ------------------------------------------------------------
def obtener_nombre_chofer(chofer_id):
    if not chofer_id:
        return None

    chofer = db.session.get(Usuario, chofer_id)
    return chofer.nombre if chofer else None


# ------------------------------------------------------------
# Convierte un vehículo a JSON.
#
# Se usa actualmente en:
# - GET /api/estado
# - GET /api/vehiculos
# - GET /api/vehiculos/<id>
# - POST /api/vehiculos
# - PUT /api/vehiculos/<id>
#
# Lo consume:
# - dashboard.js
# - vehículos/index.js
# - vehículos/detalle.js
# - vehículos/editar.js
# - app móvil en el futuro
# ------------------------------------------------------------
def serializar_vehiculo(vehiculo):
    ubicacion = db.session.get(UbicacionActual, vehiculo.id)

    chofer = (
        db.session.get(Usuario, vehiculo.chofer_id)
        if vehiculo.chofer_id
        else None
    )

    dispositivo = (
        db.session.get(Dispositivo, vehiculo.dispositivo_id)
        if vehiculo.dispositivo_id
        else None
    )

    estado_visible = calcular_estado_visible_vehiculo(ubicacion, dispositivo)

    return {
        "id": vehiculo.id,
        "nombre": vehiculo.nombre,
        "identificador": vehiculo.identificador,
        "placa": vehiculo.placa,
        "marca": vehiculo.marca,
        "modelo": vehiculo.modelo,
        "anio": vehiculo.anio,
        
        # Estado administrativo del vehículo.
        "activo": vehiculo.activo,

        # Chofer asignado.
        "chofer": chofer.nombre if chofer else None,
        "chofer_id": vehiculo.chofer_id,
        "chofer_nombre": obtener_nombre_chofer(vehiculo.chofer_id),

        # Dispositivo vinculado.
        "dispositivo_id": vehiculo.dispositivo_id,
        "dispositivo_serie": dispositivo.serie if dispositivo else None,

        # Estado de conexión.
        "online": estado_visible["online"],
        "sin_senal": estado_visible["sin_senal"],
        "segundos_sin_senal": estado_visible["segundos_sin_senal"],
        
        # Último paquete recibido directamente
        # desde el dispositivo ESP32.
        "ultima_conexion": (
            dispositivo.ultima_conexion
            if dispositivo
            else None
        ),

        # Estado visible para web/app.
        "estado": estado_visible["estado"],

        # Último estado real recibido del ESP32.
        # Puede servir para diagnóstico.
        "estado_real": estado_visible["estado_real"],

        # Ubicación actual visible.
        "lat": estado_visible["lat"],
        "lng": estado_visible["lng"],
        "velocidad": estado_visible["velocidad"],
        "ultima_actualizacion": estado_visible["ultima_actualizacion"],

        # Sensores visibles.
        "puerta": estado_visible["puerta"],
        "vibracion": estado_visible["vibracion"],
        "alerta": estado_visible["alerta"],
    }

# ------------------------------------------------------------
# Convierte un evento a JSON.
#
# Se usa actualmente en:
# - GET /api/vehiculos/<id>/eventos
# - GET /api/historial/<vehiculo_id>
# ------------------------------------------------------------
def serializar_evento(evento):
    return {
        "id": evento.id,
        "vehiculo_id": evento.vehiculo_id,
        "tipo": evento.tipo,
        "descripcion": evento.descripcion,
        "lat": evento.lat,
        "lng": evento.lng,
        "timestamp": evento.timestamp,
    }


# ------------------------------------------------------------
# Convierte un usuario a JSON.
#
# Se usa actualmente en:
# - GET /api/usuarios
# - GET /api/usuarios/<id>
# - POST /api/usuarios
# - PUT /api/usuarios/<id>
# - PUT /api/usuarios/<id>/reactivar
# ------------------------------------------------------------
def serializar_usuario(usuario):
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "correo": usuario.correo,
        "telefono": usuario.telefono,
        "tipo": usuario.tipo,
        "empresa_id": usuario.empresa_id,
        "activo": getattr(usuario, "activo", True),
    }


# ------------------------------------------------------------
# Convierte una alerta a JSON.
#
# Se usa actualmente en:
# - GET /api/alertas
# - GET /api/vehiculos/<id>
# - PUT /api/alertas/<id>/atender
# ------------------------------------------------------------
def serializar_alerta(alerta):
    vehiculo = (
        db.session.get(Vehiculo, alerta.vehiculo_id)
        if alerta.vehiculo_id
        else None
    )

    usuario_atendio = (
        db.session.get(Usuario, alerta.atendida_por)
        if getattr(alerta, "atendida_por", None)
        else None
    )

    return {
        "id": alerta.id,
        "vehiculo_id": alerta.vehiculo_id,
        "vehiculo": vehiculo.nombre if vehiculo else "Sin vehículo",
        "tipo": alerta.tipo,
        "nivel": getattr(alerta, "nivel", "medio"),
        "descripcion": alerta.descripcion,
        "atendida": alerta.atendida,
        "atendida_por": alerta.atendida_por,
        "atendida_por_nombre": usuario_atendio.nombre if usuario_atendio else None,
        "fecha_atencion": getattr(alerta, "fecha_atencion", None),
        "lat": getattr(alerta, "lat", None),
        "lng": getattr(alerta, "lng", None),
        "timestamp": alerta.timestamp,
    }


# ============================================================
# SERIALIZERS PARA MÓDULO TÉCNICO / APP MÓVIL
# ============================================================

# ------------------------------------------------------------
# Convierte un dispositivo a JSON.
#
# Se usa en:
# - app móvil técnico
# - búsqueda de dispositivos
# - validación de dispositivo
# - diagnóstico
# ------------------------------------------------------------
def serializar_dispositivo(dispositivo):
    empresa = None

    if dispositivo.empresa_id:
        empresa = db.session.get(Empresa, dispositivo.empresa_id)

    return {
        "id": dispositivo.id,
        "empresa_id": dispositivo.empresa_id,
        "empresa_nombre": empresa.nombre if empresa else None,
        "serie": dispositivo.serie,
        "imei": dispositivo.imei,
        "modelo": dispositivo.modelo,
        "firmware": dispositivo.firmware,
        "estado": dispositivo.estado,
        "ultima_conexion": dispositivo.ultima_conexion,
        "fecha_instalacion": dispositivo.fecha_instalacion,
        "fecha_creacion": getattr(dispositivo, "fecha_creacion", None),
    }

# ------------------------------------------------------------
# Convierte una empresa a JSON.
#
# Se usa en:
# - búsqueda de empresas para instalación técnica
# ------------------------------------------------------------
def serializar_empresa(empresa):
    if not empresa:
        return None

    return {
        "id": empresa.id,
        "nombre": empresa.nombre,
        "correo": empresa.correo,
        "telefono": empresa.telefono,
        "direccion": empresa.direccion,
        "activo": empresa.activo
    }


# ------------------------------------------------------------
# Convierte un vehículo a JSON para el módulo técnico.
#
# Se usa en:
# - vehículos por empresa
# - búsqueda técnica de vehículos
# - selección para instalación o cambio de dispositivo
# ------------------------------------------------------------
def serializar_vehiculo_tecnico(vehiculo):
    if not vehiculo:
        return None

    dispositivo = (
        db.session.get(Dispositivo, vehiculo.dispositivo_id)
        if vehiculo.dispositivo_id
        else None
    )

    chofer = (
        db.session.get(Usuario, vehiculo.chofer_id)
        if vehiculo.chofer_id
        else None
    )

    return {
        "id": vehiculo.id,
        "empresa_id": vehiculo.empresa_id,
        "nombre": vehiculo.nombre,
        "identificador": vehiculo.identificador,
        "placa": vehiculo.placa,
        "marca": vehiculo.marca,
        "modelo": vehiculo.modelo,
        "anio": vehiculo.anio,
        "dispositivo_id": vehiculo.dispositivo_id,
        "dispositivo_serie": dispositivo.serie if dispositivo else None,
        "chofer_id": vehiculo.chofer_id,
        "chofer_nombre": chofer.nombre if chofer else None,
        "activo": vehiculo.activo
    }


# ------------------------------------------------------------
# Genera diagnóstico técnico de un dispositivo.
#
# Se usa en:
# - GET /api/dispositivos/<serie>/diagnostico
# ------------------------------------------------------------
def serializar_diagnostico(dispositivo):
    if not dispositivo:
        return None

    vehiculo = Vehiculo.query.filter_by(
        dispositivo_id=dispositivo.id
    ).first()

    ubicacion = (
        db.session.get(UbicacionActual, vehiculo.id)
        if vehiculo
        else None
    )

    conexion = calcular_estado_conexion(ubicacion, dispositivo)

    # ========================================================
    # SI NO HAY SEÑAL
    # ========================================================
    #
    # El diagnóstico debe mostrar que no hay comunicación.
    # No debe decir que GPS o sensores están correctos si el
    # dispositivo no está enviando datos.
    # ========================================================
    if conexion["sin_senal"]:
        return {
            "online": False,
            "gps_ok": False,
            "sensores_ok": False,   
            "puerta": "sin_conexion",
            "vibracion": None,
            "alerta": 0,
            "estado": "sin_senal",
            "lat": None,
            "lng": None,
            "velocidad": None,
            "ultima_actualizacion": (
                ubicacion.ultima_actualizacion
                if ubicacion
                else None
            ),
            "segundos_desde_ultima_actualizacion": conexion["segundos_sin_senal"]
        }

    # ========================================================
    # SI SÍ HAY SEÑAL
    # ========================================================
    gps_ok = bool(
        ubicacion and
        ubicacion.lat is not None and
        ubicacion.lng is not None
    )

    sensores_ok = bool(
        ubicacion and
        ubicacion.puerta is not None and
        ubicacion.puerta != "desconocida"
    )

    return {
        "online": conexion["online"],
        "gps_ok": gps_ok,
        "sensores_ok": sensores_ok,
        "puerta": ubicacion.puerta if ubicacion else None,
        "vibracion": ubicacion.vibracion if ubicacion else None,
        "alerta": ubicacion.alerta if ubicacion else None,
        "estado": ubicacion.estado if ubicacion else "sin_datos",
        "lat": ubicacion.lat if ubicacion else None,
        "lng": ubicacion.lng if ubicacion else None,
        "velocidad": ubicacion.velocidad if ubicacion else None,
        "ultima_actualizacion": (
            ubicacion.ultima_actualizacion
            if ubicacion
            else None
        ),
        "segundos_desde_ultima_actualizacion": conexion["segundos_sin_senal"]
    }
    if not dispositivo:
        return None

    vehiculo = Vehiculo.query.filter_by(dispositivo_id=dispositivo.id).first()
    ubicacion = db.session.get(UbicacionActual, vehiculo.id) if vehiculo else None

    ahora = int(time.time())

    ultima_actualizacion = ubicacion.ultima_actualizacion if ubicacion else None
    ultima_conexion = dispositivo.ultima_conexion

    referencia_tiempo = ultima_actualizacion or ultima_conexion
    segundos_desde = ahora - referencia_tiempo if referencia_tiempo else None

    online = False

    if referencia_tiempo:
        tiempo_sin_senal = (
            obtener_segundos_sin_senal()
        )

        online = (
            segundos_desde <= tiempo_sin_senal
        )

    gps_ok = bool(ubicacion and ubicacion.lat is not None and ubicacion.lng is not None)

    sensores_ok = bool(
        ubicacion and
        ubicacion.puerta is not None and
        ubicacion.puerta != "desconocida" and
        online
    )

    return {
        "online": online,
        "gps_ok": gps_ok,
        "sensores_ok": sensores_ok,
        "puerta": ubicacion.puerta if ubicacion else None,
        "vibracion": ubicacion.vibracion if ubicacion else None,
        "alerta": ubicacion.alerta if ubicacion else None,
        "estado": ubicacion.estado if ubicacion else "sin_datos",
        "lat": ubicacion.lat if ubicacion else None,
        "lng": ubicacion.lng if ubicacion else None,
        "velocidad": ubicacion.velocidad if ubicacion else None,
        "ultima_actualizacion": ultima_actualizacion,
        "segundos_desde_ultima_actualizacion": segundos_desde
    }