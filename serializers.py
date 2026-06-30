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

from config import db
from models import Usuario, Vehiculo, Dispositivo, UbicacionActual


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

    return {
        "id": vehiculo.id,
        "nombre": vehiculo.nombre,
        "identificador": vehiculo.identificador,
        "placa": vehiculo.placa,
        "marca": vehiculo.marca,
        "modelo": vehiculo.modelo,
        "anio": vehiculo.anio,

        # Chofer asignado.
        "chofer": chofer.nombre if chofer else None,
        "chofer_id": vehiculo.chofer_id,
        "chofer_nombre": obtener_nombre_chofer(vehiculo.chofer_id),

        # Dispositivo vinculado.
        "dispositivo_id": vehiculo.dispositivo_id,
        "dispositivo_serie": dispositivo.serie if dispositivo else None,

        # Ubicación actual.
        "estado": ubicacion.estado if ubicacion else "sin_senal",
        "lat": ubicacion.lat if ubicacion else None,
        "lng": ubicacion.lng if ubicacion else None,
        "velocidad": ubicacion.velocidad if ubicacion else 0,
        "ultima_actualizacion": ubicacion.ultima_actualizacion if ubicacion else None,

        # Sensores actuales.
        "puerta": ubicacion.puerta if ubicacion else "desconocida",
        "vibracion": ubicacion.vibracion if ubicacion else 0,
        "alerta": ubicacion.alerta if ubicacion else 0,
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
