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
)


# ------------------------------------------------------------
# Devuelve la fecha/hora actual en timestamp.
# Se usa en alertas, eventos, historial GPS y conexiones.
# ------------------------------------------------------------
def timestamp_actual():
    return int(time.time())


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
def crear_alerta(vehiculo_id, tipo, nivel, descripcion, lat=None, lng=None):
    alerta = Alerta(
        vehiculo_id=vehiculo_id,
        tipo=tipo,
        nivel=nivel,
        descripcion=descripcion,
        lat=lat,
        lng=lng,
        atendida=False,
        timestamp=timestamp_actual(),
    )

    db.session.add(alerta)

    print(
        f"🚨 ALERTA CREADA -> tipo: {tipo} | "
        f"nivel: {nivel} | vehiculo_id: {vehiculo_id}"
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
def actualizar_ubicacion_actual(vehiculo_id, data):
    ubicacion = db.session.get(UbicacionActual, vehiculo_id)

    if not ubicacion:
        ubicacion = UbicacionActual(vehiculo_id=vehiculo_id)
        db.session.add(ubicacion)

    ubicacion.lat = data.get("lat")
    ubicacion.lng = data.get("lng")
    ubicacion.velocidad = data.get("velocidad", 0)
    ubicacion.estado = data.get("estado", "sin_senal")
    ubicacion.puerta = data.get("puerta", "desconocida")
    ubicacion.vibracion = int(data.get("vibracion", 0))
    ubicacion.alerta = int(data.get("alerta", 0))
    ubicacion.ultima_actualizacion = timestamp_actual()

    print(f"📍 UBICACIÓN ACTUAL ACTUALIZADA -> vehiculo_id: {vehiculo_id}")

    return ubicacion


# ------------------------------------------------------------
# Guarda un punto nuevo en el historial GPS.
#
# Se usa actualmente en:
# - POST /datos
#
# Sirve para historial, rutas, reportes y mapas.
# ------------------------------------------------------------
def guardar_historial_gps(vehiculo_id, dispositivo_id, data):
    punto = HistorialGPS(
        vehiculo_id=vehiculo_id,
        dispositivo_id=dispositivo_id,
        lat=data.get("lat"),
        lng=data.get("lng"),
        velocidad=data.get("velocidad", 0),
        timestamp=timestamp_actual(),
    )

    db.session.add(punto)

    print(f"🗺️  HISTORIAL GPS GUARDADO -> vehiculo_id: {vehiculo_id}")

    return punto
