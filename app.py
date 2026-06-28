# ==================================================================
# TRACKSECURITY - BACKEND FLASK (API REST)
# ==================================================================
#
# ¿QUÉ HACE ESTE BACKEND?
# ------------------------------------------------------------------
# Este archivo es el servidor central de TrackSecurity, una plataforma
# IoT para monitoreo de vehículos de carga. El backend:
#
#   1. Recibe datos en tiempo real del dispositivo ESP32 instalado
#      en cada vehículo (ubicación GPS, estado de la puerta,
#      vibración, alertas, velocidad, etc.).
#   2. Guarda esos datos en la base de datos MySQL (vía SQLAlchemy).
#   3. Expone una API REST protegida con JWT para que el DASHBOARD
#      WEB y la APP MÓVIL (Flutter) puedan consultar y administrar
#      la información (vehículos, alertas, historial, usuarios, etc.)
#
# ¿QUÉ ENDPOINTS CONSUME EL ESP32?
# ------------------------------------------------------------------
#   - POST /datos   --> Envía su lectura de sensores cada cierto
#                        tiempo. NO requiere JWT (el dispositivo no
#                        tiene usuario), pero sí se valida que la
#                        "serie" del dispositivo exista y esté
#                        registrada en la base de datos.
#
# ¿QUÉ ENDPOINTS CONSUME EL DASHBOARD WEB?
# ------------------------------------------------------------------
#   - POST /login                       (iniciar sesión, obtener JWT)
#   - GET  /api/estado                  (resumen para el dashboard)
#   - GET  /api/vehiculos               (listar vehículos)
#   - POST /api/vehiculos               (crear vehículo)
#   - GET  /api/alertas                 (listar alertas)
#   - PUT  /api/alertas/<id>/atender    (marcar alerta atendida)
#   - GET  /api/historial/<vehiculo_id> (historial GPS + eventos)
#   - GET  /api/usuarios                (listar usuarios de la empresa)
#   - POST /api/usuarios                (crear chofer/supervisor)
#   - GET  /api/planes                  (ver planes comerciales)
#   - GET  /api/servicios               (ver servicios técnicos)
#
# ¿QUÉ ENDPOINTS CONSUME LA APP MÓVIL (FLUTTER)?
# ------------------------------------------------------------------
#   - POST /login                       (login del chofer/supervisor)
#   - GET  /api/estado                  (ver su vehículo asignado)
#   - GET  /api/vehiculos               (según su rol)
#   - GET  /api/alertas                 (alertas de su vehículo/empresa)
#   - GET  /api/historial/<vehiculo_id> (ver recorrido en mapa)
#   - POST /api/push/subscribe          (activar notificaciones push)
#
# ¿QUÉ ENDPOINTS CONSUME EL TÉCNICO (instalación de dispositivos)?
# ------------------------------------------------------------------
#   - GET  /api/dispositivos            (ver dispositivos disponibles)
#   - POST /api/dispositivos/vincular   (vincular dispositivo a vehículo)
#
# AUTENTICACIÓN
# ------------------------------------------------------------------
# Se usa JWT (Flask-JWT-Extended). NO se usa session de Flask.
# Cada usuario tiene un rol (claim "tipo" dentro del JWT):
#   admin / dueno / supervisor / chofer / tecnico
# Las rutas protegidas usan @jwt_required() y luego revisan el rol
# manualmente dentro de la función (ver función auxiliar
# `obtener_usuario_actual()` y `rol_requerido()`).
#
# ==================================================================

from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity
)
from functools import wraps
import time
import bcrypt
import os

from config import db, Config
from models import (
    Plan, Empresa, Usuario, Dispositivo, Vehiculo, Suscripcion,
    Servicio, UbicacionActual, HistorialGPS, Evento, Alerta,
    Evidencia, PushSubscripcion, crear_datos_iniciales
)
from werkzeug.security import generate_password_hash
from werkzeug.security import check_password_hash
# ==================================================================
# CONFIGURACIÓN DE LA APLICACIÓN
# ==================================================================

app = Flask(__name__)
app.config.from_object(Config)

# Clave secreta para firmar los JWT. En producción debe venir de
# una variable de entorno (JWT_SECRET_KEY), nunca debe quedar fija
# en el código.
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'cambia-esta-clave-en-produccion')

db.init_app(app)
CORS(app)
jwt = JWTManager(app)


# ==================================================================
# FUNCIONES AUXILIARES
# ==================================================================

def timestamp_actual():
    """Devuelve el timestamp actual en segundos (entero)."""
    return int(time.time())


def hashear_password(password):
    """Genera un hash seguro de la contraseña usando bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verificar_password(password, password_hash):
    """Compara una contraseña en texto plano contra su hash guardado."""
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except Exception:
        return False


def obtener_usuario_actual():
    """
    Devuelve el objeto Usuario correspondiente al JWT actual.
    La identidad del JWT es el id del usuario (como string).
    """
    usuario_id = get_jwt_identity()
    return db.session.get(Usuario, int(usuario_id))


def registrar_evento(vehiculo_id, tipo, descripcion, lat=None, lng=None):
    """
    Registra un evento importante del vehículo o del sistema.

    Se usa para bitácora:
    - vehículo creado
    - vehículo editado
    - vehículo desactivado
    - alerta atendida
    - dispositivo vinculado
    - cambios importantes de estado

    NO se debe usar para guardar cada GPS o cada paquete del ESP32.
    """
    try:
        evento = Evento(
            vehiculo_id=vehiculo_id,
            tipo=tipo,
            descripcion=descripcion,
            lat=lat,
            lng=lng,
            timestamp=timestamp_actual()
        )

        db.session.add(evento)

    except Exception as e:
        print(f"⚠️ No se pudo preparar evento: {e}")


def obtener_suscripcion_activa(empresa_id):
    """
    Busca la suscripción activa más reciente de una empresa.
    Esta función se usa para validar si la empresa puede crear más vehículos.
    """
    return Suscripcion.query.filter_by(
        empresa_id=empresa_id,
        estado='activa'
    ).order_by(Suscripcion.fecha_inicio.desc()).first()


def validar_limite_vehiculos(empresa_id):
    """
    Valida si la empresa todavía puede crear más vehículos según su suscripción.
    Retorna:
        True, None  -> si todavía puede crear
        False, mensaje -> si ya llegó al límite o no tiene suscripción
    """
    suscripcion = obtener_suscripcion_activa(empresa_id)

    if not suscripcion:
        return False, "La empresa no tiene una suscripción activa."

    vehiculos_activos = Vehiculo.query.filter_by(
        empresa_id=empresa_id,
        activo=True
    ).count()

    if vehiculos_activos >= suscripcion.cantidad_vehiculos:
        return False, f"Límite alcanzado. Tu suscripción permite {suscripcion.cantidad_vehiculos} vehículos activos."

    return True, None



def rol_requerido(*roles_permitidos):
    """
    Decorador para proteger rutas según el rol del usuario.
    Uso:
        @app.route('/api/algo')
        @jwt_required()
        @rol_requerido('dueno', 'admin')
        def algo():
            ...
    Debe usarse SIEMPRE después de @jwt_required().
    """
    def decorador(funcion):
        @wraps(funcion)
        def wrapper(*args, **kwargs):
            usuario = obtener_usuario_actual()
            if not usuario:
                return jsonify({"error": "usuario no encontrado"}), 401
            if usuario.tipo not in roles_permitidos:
                return jsonify({"error": "acceso denegado para tu rol"}), 403
            return funcion(*args, **kwargs)
        return wrapper
    return decorador


def imprimir_log_datos_esp32(data):
    """
    Imprime en consola, de forma clara y ordenada, el JSON recibido
    desde el ESP32. Esto es temporal mientras el frontend no está
    listo, para poder verificar visualmente que todo llega bien.
    """
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


def crear_alerta(vehiculo_id, tipo, nivel, descripcion, lat=None, lng=None):
    """
    Crea un registro en la tabla 'alertas'.
    Se usa cuando se detecta una condición crítica:
    puerta abierta, vibración, pánico, etc.
    """
    alerta = Alerta(
        vehiculo_id=vehiculo_id,
        tipo=tipo,
        nivel=nivel,
        descripcion=descripcion,
        lat=lat,
        lng=lng,
        atendida=False,
        timestamp=timestamp_actual()
    )
    db.session.add(alerta)
    print(f"🚨 ALERTA CREADA -> tipo: {tipo} | nivel: {nivel} | vehiculo_id: {vehiculo_id}")
    return alerta


def actualizar_ubicacion_actual(vehiculo_id, data):
    """
    Actualiza (o crea si no existe) el registro de ubicación actual
    del vehículo. Esta tabla solo guarda el ÚLTIMO estado conocido,
    pensado para que el dashboard lo lea rápido sin recorrer historial.
    """
    ubicacion = db.session.get(UbicacionActual, vehiculo_id)

    if not ubicacion:
        ubicacion = UbicacionActual(vehiculo_id=vehiculo_id)
        db.session.add(ubicacion)

    ubicacion.lat = data.get('lat')
    ubicacion.lng = data.get('lng')
    ubicacion.velocidad = data.get('velocidad', 0)
    ubicacion.estado = data.get('estado', 'sin_senal')
    ubicacion.puerta = data.get('puerta', 'desconocida')
    ubicacion.vibracion = int(data.get('vibracion', 0))
    ubicacion.alerta = int(data.get('alerta', 0))
    ubicacion.ultima_actualizacion = timestamp_actual()

    print(f"📍 UBICACIÓN ACTUAL ACTUALIZADA -> vehiculo_id: {vehiculo_id}")
    return ubicacion


def guardar_historial_gps(vehiculo_id, dispositivo_id, data):
    """
    Inserta un nuevo punto en la tabla historial_gps.
    Esta tabla guarda TODO el recorrido del vehículo (a diferencia
    de ubicacion_actual que solo guarda el último punto).
    """
    punto = HistorialGPS(
        vehiculo_id=vehiculo_id,
        dispositivo_id=dispositivo_id,
        lat=data.get('lat'),
        lng=data.get('lng'),
        velocidad=data.get('velocidad', 0),
        timestamp=timestamp_actual()
    )
    db.session.add(punto)
    print(f"🗺️  HISTORIAL GPS GUARDADO -> vehiculo_id: {vehiculo_id}")
    return punto




def serializar_vehiculo(vehiculo):
    """
    Convierte un objeto Vehiculo (+ su ubicación actual y chofer)
    en un diccionario listo para enviar como JSON.
    """
    ubicacion = db.session.get(UbicacionActual, vehiculo.id)
    chofer = db.session.get(Usuario, vehiculo.chofer_id) if vehiculo.chofer_id else None
    dispositivo = db.session.get(Dispositivo, vehiculo.dispositivo_id) if vehiculo.dispositivo_id else None

    return {
        "id": vehiculo.id,
        "nombre": vehiculo.nombre,
        "identificador": vehiculo.identificador,
        "placa": vehiculo.placa,
        "marca": vehiculo.marca,
        "modelo": vehiculo.modelo,
        "anio": vehiculo.anio,
        "chofer": chofer.nombre if chofer else None,
        "chofer_id": vehiculo.chofer_id,
        "chofer_nombre": obtener_nombre_chofer(vehiculo.chofer_id),
        "dispositivo_serie": dispositivo.serie if dispositivo else None,
        "estado": ubicacion.estado if ubicacion else "sin_senal",
        "lat": ubicacion.lat if ubicacion else None,
        "lng": ubicacion.lng if ubicacion else None,
        "velocidad": ubicacion.velocidad if ubicacion else 0,
        "ultima_actualizacion": ubicacion.ultima_actualizacion if ubicacion else None,
            # Sensores actuales
        "puerta": ubicacion.puerta if ubicacion else "desconocida",
        "vibracion": ubicacion.vibracion if ubicacion else 0,
        "alerta": ubicacion.alerta if ubicacion else 0,
    }

def serializar_evento(evento):
    return {
        "id": evento.id,
        "vehiculo_id": evento.vehiculo_id,
        "tipo": evento.tipo,
        "descripcion": evento.descripcion,
        "lat": evento.lat,
        "lng": evento.lng,
        "timestamp": evento.timestamp
    }
    
def obtener_nombre_chofer(chofer_id):
    if not chofer_id:
        return None

    chofer = db.session.get(Usuario, chofer_id)
    return chofer.nombre if chofer else None

def serializar_usuario(usuario):
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "correo": usuario.correo,
        "telefono": usuario.telefono,
        "tipo": usuario.tipo,
        "empresa_id": usuario.empresa_id,
        "activo": getattr(usuario, "activo", True)
    }

def serializar_alerta(alerta):
    vehiculo = db.session.get(Vehiculo, alerta.vehiculo_id) if alerta.vehiculo_id else None
    usuario_atendio = db.session.get(Usuario, alerta.atendida_por) if getattr(alerta, "atendida_por", None) else None

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
        "timestamp": alerta.timestamp
    }


# ==================================================================
# ENDPOINT: LOGIN
# ==================================================================
# Recibe correo y password. Si son válidos, genera un JWT que el
# cliente (dashboard o app móvil) deberá enviar en el header:
#   Authorization: Bearer <token>
# en cada petición a una ruta protegida.
# ==================================================================

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if not data or 'correo' not in data or 'password' not in data:
        return jsonify({"error": "correo y password son requeridos"}), 400

    correo = data.get('correo', '').strip()
    password = data.get('password', '')

    usuario = Usuario.query.filter_by(correo=correo).first()

    if not usuario or not verificar_password(password, usuario.password):
        return jsonify({"error": "correo o contraseña incorrectos"}), 401

    if not usuario.activo:
        return jsonify({"error": "usuario desactivado, contacta al administrador"}), 403

    # La "identity" del token es el id del usuario (como string).
    # Se agregan datos extra (additional_claims) para que el cliente
    # los pueda leer sin tener que llamar a otro endpoint.
    access_token = create_access_token(
        identity=str(usuario.id),
        additional_claims={
            "tipo": usuario.tipo,
            "empresa_id": usuario.empresa_id
        }
    )

    return jsonify({
        "ok": True,
        "access_token": access_token,
        "usuario": {
            "id": usuario.id,
            "nombre": usuario.nombre,
            "correo": usuario.correo,
            "tipo": usuario.tipo,
            "empresa_id": usuario.empresa_id
        }
    }), 200


# ==================================================================
# ENDPOINT: ESTADO GENERAL (DASHBOARD)
# ==================================================================
# Devuelve la lista de vehículos visibles según el rol del usuario:
#   - admin / dueno / supervisor -> vehículos de su empresa
#   - chofer                     -> solo su vehículo asignado
#   - tecnico                    -> mensaje de modo técnico
# ==================================================================

@app.route('/api/estado', methods=['GET'])
@jwt_required()
def api_estado():
    usuario = obtener_usuario_actual()
    if not usuario:
        return jsonify({"error": "usuario no encontrado"}), 401

    if usuario.tipo in ('admin', 'dueno', 'supervisor'):
        vehiculos = Vehiculo.query.filter_by(empresa_id=usuario.empresa_id, activo=True).all()
        return jsonify({
            "tipo_usuario": usuario.tipo,
            "vehiculos": [serializar_vehiculo(v) for v in vehiculos]
        }), 200

    if usuario.tipo == 'chofer':
        vehiculo = Vehiculo.query.filter_by(chofer_id=usuario.id, activo=True).first()
        if not vehiculo:
            return jsonify({
                "tipo_usuario": usuario.tipo,
                "vehiculos": [],
                "mensaje": "no tienes un vehículo asignado"
            }), 200
        return jsonify({
            "tipo_usuario": usuario.tipo,
            "vehiculos": [serializar_vehiculo(vehiculo)]
        }), 200

    if usuario.tipo == 'tecnico':
        return jsonify({
            "tipo_usuario": usuario.tipo,
            "mensaje": "modo técnico activo, usa /api/dispositivos para ver dispositivos disponibles"
        }), 200

    return jsonify({"error": "rol no reconocido"}), 400


# ==================================================================
# ENDPOINT PRINCIPAL: RECEPCIÓN DE DATOS DEL ESP32
# ==================================================================
# Este endpoint NO requiere JWT (el dispositivo no es un usuario),
# pero SÍ valida que la "serie" enviada corresponda a un dispositivo
# real y registrado.
#
# Flujo:
#   1. Buscar dispositivo por serie.
#   2. Si no se encuentra, intentar compatibilidad por identificador
#      de vehículo directamente (para dispositivos de prueba o viejos).
#   3. Actualizar ubicación actual.
#   4. Guardar punto en historial GPS.
#   5. Registrar evento normal (si aplica).
#   6. Crear alerta si corresponde (alerta=1, puerta abierta,
#      vibración=1 o estado="alerta").
#   7. Actualizar última conexión del dispositivo.
#   8. Imprimir todo el proceso en consola.
# ==================================================================

@app.route('/datos', methods=['POST'])
def recibir_datos_esp32():
    data = request.json

    if not data:
        return jsonify({"success": False, "mensaje": "no se recibió JSON"}), 400

    # Imprimir el paquete completo recibido, tal como pide el cliente.
    imprimir_log_datos_esp32(data)

    serie = data.get('serie')
    identificador_vehiculo = data.get('vehiculo')

    # ---- 1. Buscar dispositivo por serie ----
    dispositivo = None
    if serie:
        dispositivo = Dispositivo.query.filter_by(serie=serie).first()

    vehiculo = None

    if dispositivo:
        # El dispositivo existe: buscamos el vehículo vinculado a él.
        vehiculo = Vehiculo.query.filter_by(dispositivo_id=dispositivo.id).first()

    # ---- 2. Compatibilidad: si no hay dispositivo o no tiene
    #         vehículo asociado, intentamos buscar directo por
    #         el identificador del vehículo que mandó el ESP32 ----
    if not vehiculo and identificador_vehiculo:
        vehiculo = Vehiculo.query.filter_by(identificador=identificador_vehiculo).first()

    if not vehiculo:
        print("❌ No se encontró vehículo para estos datos. Se descarta el paquete.")
        return jsonify({
            "success": False,
            "mensaje": "no se encontró un vehículo asociado a esta serie/identificador"
        }), 404

    try:
        # ---- 3. Actualizar ubicación actual ----
        actualizar_ubicacion_actual(vehiculo.id, data)

        # ---- 4. Guardar historial GPS ----
        guardar_historial_gps(
            vehiculo.id,
            dispositivo.id if dispositivo else None,
            data
        )

        # ---- 5. Registrar evento normal (opcional, solo si aporta
        #         información útil, para no llenar la tabla de ruido) ----
        evento_creado = False
        estado = data.get('estado')
        if estado in ('encendido', 'apagado', 'modo_manual'):
            evento = Evento(
                vehiculo_id=vehiculo.id,
                tipo=estado,
                descripcion=f"Evento '{estado}' recibido desde dispositivo",
                lat=data.get('lat'),
                lng=data.get('lng'),
                timestamp=timestamp_actual()
            )
            db.session.add(evento)
            evento_creado = True
            print(f"📝 EVENTO CREADO -> tipo: {estado}")

        # ---- 6. Crear alerta si corresponde ----
        alerta_creada = False
        es_alerta = (
            int(data.get('alerta', 0)) == 1 or
            data.get('puerta') == 'abierta' or
            int(data.get('vibracion', 0)) == 1 or
            estado == 'alerta'
        )

        if es_alerta:
            # Determinar tipo y nivel de la alerta según la causa.
            if estado == 'panico':
                tipo_alerta, nivel_alerta = 'panico', 'critico'
                descripcion = 'Botón de pánico activado'
            elif data.get('puerta') == 'abierta':
                tipo_alerta, nivel_alerta = 'puerta_abierta', 'alto'
                descripcion = 'Apertura de puerta detectada'
            elif int(data.get('vibracion', 0)) == 1:
                tipo_alerta, nivel_alerta = 'vibracion', 'medio'
                descripcion = 'Vibración sospechosa detectada'
            else:
                tipo_alerta, nivel_alerta = 'alerta_general', 'medio'
                descripcion = 'Alerta general reportada por el dispositivo'
            alerta_existente = Alerta.query.filter_by(
                vehiculo_id=vehiculo.id,
                tipo=tipo_alerta,
                atendida=False
            ).order_by(Alerta.timestamp.desc()).first()

            if alerta_existente:
                ahora = timestamp_actual()

                alerta_existente.nivel = nivel_alerta
                alerta_existente.descripcion = descripcion
                alerta_existente.lat = data.get('lat')
                alerta_existente.lng = data.get('lng')

                # Actualiza la fecha/hora mostrada en el dashboard
                alerta_existente.timestamp = ahora

                print(f"🔁 ALERTA YA ACTIVA -> se actualizó última hora: {tipo_alerta} | vehiculo_id: {vehiculo.id}")

            else:
                crear_alerta(
                    vehiculo.id,
                    tipo_alerta,
                    nivel_alerta,
                    descripcion,
                    lat=data.get('lat'),
                    lng=data.get('lng')
                )
                alerta_creada = True
        
        # ---- 7. Actualizar última conexión del dispositivo ----
        if dispositivo:
            dispositivo.ultima_conexion = timestamp_actual()
            print(f"🔌 ÚLTIMA CONEXIÓN ACTUALIZADA -> dispositivo serie: {dispositivo.serie}")

        db.session.commit()

        print(f"✅ Evento creado: {evento_creado} | Alerta creada: {alerta_creada}")
        print("=" * 60 + "\n")

        return jsonify({
            "success": True,
            "mensaje": "datos procesados correctamente",
            "vehiculo": vehiculo.nombre,
            "evento_creado": evento_creado,
            "alerta_creada": alerta_creada
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ ERROR al procesar datos del ESP32: {e}")
        return jsonify({"success": False, "mensaje": "error interno del servidor"}), 500


# ==================================================================
# ENDPOINT: LISTAR VEHÍCULOS
# ==================================================================

@app.route('/api/vehiculos', methods=['GET'])
@jwt_required()
def listar_vehiculos():
    usuario = obtener_usuario_actual()

    if usuario.tipo in ('admin', 'dueno', 'supervisor'):
        vehiculos = Vehiculo.query.filter_by(
            empresa_id=usuario.empresa_id,
            activo=True
        ).all()
    elif usuario.tipo == 'chofer':
        vehiculos = Vehiculo.query.filter_by(
            chofer_id=usuario.id,
            activo=True
        ).all()
    else:
        return jsonify({"error": "tu rol no tiene acceso a esta información"}), 403

    return jsonify({"vehiculos": [serializar_vehiculo(v) for v in vehiculos]}), 200

@app.route('/api/vehiculos/<int:vehiculo_id>/eventos', methods=['GET'])
@jwt_required()
def obtener_eventos_vehiculo(vehiculo_id):
    """
    Devuelve la bitácora de eventos de un vehículo.
    Se usa en el detalle del vehículo y luego en Historial.
    """
    usuario = obtener_usuario_actual()
    vehiculo = db.session.get(Vehiculo, vehiculo_id)

    if not vehiculo:
        return jsonify({"error": "vehículo no encontrado"}), 404

    if usuario.tipo != "admin" and vehiculo.empresa_id != usuario.empresa_id:
        return jsonify({"error": "no tienes acceso a este vehículo"}), 403

    eventos = Evento.query.filter_by(
        vehiculo_id=vehiculo.id
    ).order_by(Evento.timestamp.desc()).limit(20).all()

    return jsonify({
        "eventos": [serializar_evento(e) for e in eventos]
    }), 200


@app.route('/api/vehiculos/<int:vehiculo_id>', methods=['GET'])
@jwt_required()
def obtener_vehiculo_detalle(vehiculo_id):
    """
    Devuelve información completa de un vehículo:
    - datos generales
    - sensores actuales
    - alertas recientes
    - evidencias fotográficas
    - estado del plan para saber si puede usar evidencia
    """
    usuario = obtener_usuario_actual()
    vehiculo = db.session.get(Vehiculo, vehiculo_id)

    if not vehiculo:
        return jsonify({"error": "vehículo no encontrado"}), 404

    if usuario.tipo in ('admin', 'dueno', 'supervisor'):
        if vehiculo.empresa_id != usuario.empresa_id:
            return jsonify({"error": "no tienes acceso a este vehículo"}), 403
    elif usuario.tipo == 'chofer':
        if vehiculo.chofer_id != usuario.id:
            return jsonify({"error": "no tienes acceso a este vehículo"}), 403
    else:
        return jsonify({"error": "tu rol no tiene acceso a esta información"}), 403

    alertas = Alerta.query.filter_by(
        vehiculo_id=vehiculo.id
    ).order_by(Alerta.timestamp.desc()).limit(10).all()

    evidencias = Evidencia.query.filter_by(
        vehiculo_id=vehiculo.id
    ).order_by(Evidencia.timestamp.desc()).limit(6).all()

    suscripcion = Suscripcion.query.filter_by(
        empresa_id=vehiculo.empresa_id,
        estado='activa'
    ).order_by(Suscripcion.fecha_inicio.desc()).first()

    plan = db.session.get(Plan, suscripcion.plan_id) if suscripcion else None
    nombre_plan = plan.nombre if plan else "Sin plan"

    es_premium = False
    if plan and plan.nombre:
        es_premium = plan.nombre.strip().lower() == "premium"

    return jsonify({
        "vehiculo": serializar_vehiculo(vehiculo),
        "alertas": [serializar_alerta(a) for a in alertas],
        "evidencias": [
            {
                "id": e.id,
                "url_imagen": e.url_imagen,
                "descripcion": e.descripcion,
                "alerta_id": e.alerta_id,
                "timestamp": e.timestamp
            }
            for e in evidencias
        ],
        "plan": {
            "nombre": nombre_plan,
            "es_premium": es_premium
        }
    }), 200

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

@app.route('/api/vehiculos/<int:vehiculo_id>', methods=['PUT'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def editar_vehiculo(vehiculo_id):
    """
    Permite al dueño/admin editar datos administrativos del vehículo.
    No permite modificar dispositivo_id, empresa_id, historial ni datos técnicos.
    """
    usuario = obtener_usuario_actual()
    vehiculo = db.session.get(Vehiculo, vehiculo_id)

    if not vehiculo:
        return jsonify({"error": "vehículo no encontrado"}), 404

    if vehiculo.empresa_id != usuario.empresa_id:
        return jsonify({"error": "no tienes acceso a este vehículo"}), 403

    data = request.json or {}

    campos_editables = [
        'nombre',
        'identificador',
        'placa',
        'marca',
        'modelo',
        'anio',
        'chofer_id'
    ]

    chofer_id = data.get("chofer_id")

    if chofer_id:
        vehiculo_existente = chofer_ocupado_en_otro_vehiculo(
            usuario.empresa_id,
            chofer_id,
            vehiculo_id_actual=vehiculo.id
        )

        if vehiculo_existente:
            return jsonify({
                "error": f"este chofer ya está asignado al vehículo {vehiculo_existente.nombre}"
            }), 409

    for campo in campos_editables:
        if campo in data:
            setattr(vehiculo, campo, data[campo])

    try:
        registrar_evento(
            vehiculo_id=vehiculo.id,
            tipo="vehiculo_editado",
            descripcion=f"{usuario.nombre} editó los datos del vehículo {vehiculo.nombre}",
            lat=None,
            lng=None
        )
        db.session.commit()
        return jsonify({
            "ok": True,
            "mensaje": "vehículo actualizado correctamente",
            "vehiculo": serializar_vehiculo(vehiculo)
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error al editar vehículo: {e}")
        return jsonify({"error": "error interno del servidor"}), 500
    
    
@app.route('/api/vehiculos/<int:vehiculo_id>/desactivar', methods=['PUT'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def desactivar_vehiculo(vehiculo_id):
    """
    Desactiva un vehículo sin eliminarlo de la base de datos.
    Así se conserva historial, alertas y evidencias.
    """
    usuario = obtener_usuario_actual()
    vehiculo = db.session.get(Vehiculo, vehiculo_id)

    if not vehiculo:
        return jsonify({"error": "vehículo no encontrado"}), 404

    if vehiculo.empresa_id != usuario.empresa_id:
        return jsonify({"error": "no tienes acceso a este vehículo"}), 403

    try:
        vehiculo.activo = False
        
        registrar_evento(
            vehiculo_id=vehiculo.id,
            tipo="vehiculo_desactivado",
            descripcion=f"{usuario.nombre} desactivó el vehículo {vehiculo.nombre}",
            lat=None,
            lng=None
        )

        db.session.commit()


        return jsonify({
            "ok": True,
            "mensaje": "vehículo desactivado correctamente"
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error al desactivar vehículo: {e}")
        return jsonify({"error": "error interno del servidor"}), 500

# ==================================================================
# ENDPOINT: CREAR VEHÍCULO
# ==================================================================
# Solo dueños y admins pueden crear vehículos. El vehículo se asocia
# automáticamente a la empresa del usuario que lo crea.
# ==================================================================


@app.route('/api/vehiculos', methods=['POST'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def crear_vehiculo():
    usuario = obtener_usuario_actual()
    data = request.json
    
    puede_crear, mensaje_limite = validar_limite_vehiculos(usuario.empresa_id)

    if not puede_crear:
        return jsonify({"error": mensaje_limite}), 403
    

    if not data or not data.get('nombre') or not data.get('identificador'):
        return jsonify({"error": "nombre e identificador son requeridos"}), 400

    chofer_id = data.get('chofer_id')

    if chofer_id:
        vehiculo_existente = chofer_ocupado_en_otro_vehiculo(
            usuario.empresa_id,
            chofer_id
        )

        if vehiculo_existente:
            return jsonify({
                "error": f"este chofer ya está asignado al vehículo {vehiculo_existente.nombre}"
            }), 409

    vehiculo = Vehiculo(
        empresa_id=usuario.empresa_id,
        nombre=data['nombre'],
        identificador=data['identificador'],
        placa=data.get('placa'),
        marca=data.get('marca'),
        modelo=data.get('modelo'),
        anio=data.get('anio'),
        chofer_id=chofer_id
    )

    try:
        db.session.add(vehiculo)
        db.session.flush()

        registrar_evento(
            vehiculo_id=vehiculo.id,
            tipo="vehiculo_creado",
            descripcion=f"{usuario.nombre} creó el vehículo {vehiculo.nombre}"
        )

        db.session.commit()
        return jsonify({"ok": True, "vehiculo": serializar_vehiculo(vehiculo)}), 201
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error al crear vehículo: {e}")
        return jsonify({"error": "error interno del servidor"}), 500


# ==================================================================
# ENDPOINT: LISTAR ALERTAS
# ==================================================================

@app.route('/api/alertas', methods=['GET'])
@jwt_required()
def listar_alertas():
    usuario = obtener_usuario_actual()

    if usuario.tipo in ('admin', 'dueno', 'supervisor'):
        vehiculos_ids = [v.id for v in Vehiculo.query.filter_by(empresa_id=usuario.empresa_id).all()]
    elif usuario.tipo == 'chofer':
        vehiculos_ids = [v.id for v in Vehiculo.query.filter_by(chofer_id=usuario.id).all()]
    else:
        return jsonify({"error": "tu rol no tiene acceso a esta información"}), 403

    alertas = Alerta.query.filter(
        Alerta.vehiculo_id.in_(vehiculos_ids)
    ).order_by(Alerta.timestamp.desc()).limit(100).all()

    return jsonify({"alertas": [serializar_alerta(a) for a in alertas]}), 200



# ==================================================================
# ENDPOINT: MARCAR ALERTA COMO ATENDIDA
# ==================================================================

@app.route('/api/alertas/<int:alerta_id>/atender', methods=['PUT'])
@jwt_required()
def atender_alerta(alerta_id):
    usuario = obtener_usuario_actual()
    alerta = db.session.get(Alerta, alerta_id)

    if not alerta:
        return jsonify({"error": "alerta no encontrada"}), 404

    vehiculo = db.session.get(Vehiculo, alerta.vehiculo_id)

    if not vehiculo:
        return jsonify({"error": "vehículo no encontrado"}), 404

    if usuario.tipo != "admin" and vehiculo.empresa_id != usuario.empresa_id:
        return jsonify({"error": "no tienes permiso para atender esta alerta"}), 403

    try:
        alerta.atendida = True
        alerta.atendida_por = usuario.id
        alerta.fecha_atencion = timestamp_actual()

        registrar_evento(
        vehiculo_id=vehiculo.id,
        tipo="alerta_atendida",
        descripcion=f"{usuario.nombre} atendió la alerta {alerta.tipo} del vehículo {vehiculo.nombre}",
        lat=alerta.lat,
        lng=alerta.lng
)
        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "alerta atendida correctamente",
            "alerta": serializar_alerta(alerta)
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error al atender alerta: {e}")
        return jsonify({"error": "error interno al atender alerta"}), 500

# ==================================================================
# ENDPOINT: HISTORIAL DE UN VEHÍCULO
# ==================================================================
# Devuelve el historial GPS (para dibujar la ruta en el mapa) y los
# eventos registrados para ese vehículo.
# ==================================================================

@app.route('/api/historial/<int:vehiculo_id>', methods=['GET'])
@jwt_required()
def historial_vehiculo(vehiculo_id):
    usuario = obtener_usuario_actual()
    vehiculo = db.session.get(Vehiculo, vehiculo_id)

    if not vehiculo:
        return jsonify({"error": "vehículo no encontrado"}), 404

    # Verificación de permisos según el rol.
    if usuario.tipo in ('admin', 'dueno', 'supervisor'):
        if vehiculo.empresa_id != usuario.empresa_id:
            return jsonify({"error": "acceso denegado"}), 403
    elif usuario.tipo == 'chofer':
        if vehiculo.chofer_id != usuario.id:
            return jsonify({"error": "acceso denegado"}), 403
    else:
        return jsonify({"error": "tu rol no tiene acceso a esta información"}), 403

    puntos_gps = HistorialGPS.query.filter_by(vehiculo_id=vehiculo_id) \
        .order_by(HistorialGPS.timestamp.asc()).limit(500).all()

    eventos = Evento.query.filter_by(vehiculo_id=vehiculo_id) \
        .order_by(Evento.timestamp.desc()).limit(100).all()

    return jsonify({
        "vehiculo": vehiculo.nombre,
        "puntos_gps": [
            {"lat": p.lat, "lng": p.lng, "velocidad": p.velocidad, "timestamp": p.timestamp}
            for p in puntos_gps
        ],
        "eventos": [
            {
                "id": e.id, "tipo": e.tipo, "descripcion": e.descripcion,
                "lat": e.lat, "lng": e.lng, "timestamp": e.timestamp
            }
            for e in eventos
        ]
    }), 200


# ==================================================================
# ENDPOINT: LISTAR DISPOSITIVOS (TÉCNICO / ADMIN)
# ==================================================================

@app.route('/api/dispositivos', methods=['GET'])
@jwt_required()
@rol_requerido('tecnico', 'admin')
def listar_dispositivos():
    dispositivos = Dispositivo.query.all()

    return jsonify({
        "dispositivos": [
            {
                "id": d.id,
                "serie": d.serie,
                "imei": d.imei,
                "modelo": d.modelo,
                "firmware": d.firmware,
                "estado": d.estado,
                "empresa_id": d.empresa_id,
                "ultima_conexion": d.ultima_conexion,
                "fecha_instalacion": d.fecha_instalacion
            }
            for d in dispositivos
        ]
    }), 200


# ==================================================================
# ENDPOINT: VINCULAR DISPOSITIVO A UN VEHÍCULO
# ==================================================================
# El técnico usa este endpoint al instalar físicamente el dispositivo
# en un vehículo. Se valida el PIN de activación impreso en el
# dispositivo para evitar vinculaciones accidentales o erróneas.
# ==================================================================

@app.route('/api/dispositivos/vincular', methods=['POST'])
@jwt_required()
@rol_requerido('tecnico', 'admin')
def vincular_dispositivo():
    data = request.json

    if not data or not all(k in data for k in ('serie', 'pin_activacion', 'vehiculo_id')):
        return jsonify({"error": "serie, pin_activacion y vehiculo_id son requeridos"}), 400

    print(f"🔧 Iniciando vinculación -> serie: {data['serie']} | vehiculo_id: {data['vehiculo_id']}")

    dispositivo = Dispositivo.query.filter_by(serie=data['serie']).first()
    if not dispositivo:
        print("❌ Vinculación fallida: dispositivo no encontrado")
        return jsonify({"error": "dispositivo no encontrado"}), 404

    if dispositivo.pin_activacion != str(data['pin_activacion']):
        print("❌ Vinculación fallida: PIN incorrecto")
        return jsonify({"error": "PIN de activación incorrecto"}), 401

    vehiculo = db.session.get(Vehiculo, data['vehiculo_id'])
    if not vehiculo:
        print("❌ Vinculación fallida: vehículo no encontrado")
        return jsonify({"error": "vehículo no encontrado"}), 404

    try:
        # Asociar dispositivo al vehículo y a la empresa del vehículo.
        vehiculo.dispositivo_id = dispositivo.id
        dispositivo.empresa_id = vehiculo.empresa_id
        dispositivo.estado = 'activo'
        dispositivo.fecha_instalacion = timestamp_actual()

        # Registrar el servicio de instalación.
        servicio = Servicio(
            empresa_id=vehiculo.empresa_id,
            vehiculo_id=vehiculo.id,
            dispositivo_id=dispositivo.id,
            tipo='instalacion',
            descripcion=f"Instalación del dispositivo {dispositivo.serie} en {vehiculo.nombre}",
            estado='realizado',
            timestamp=timestamp_actual()
        )
        db.session.add(servicio)
        registrar_evento(
            vehiculo_id=vehiculo.id,
            tipo="dispositivo_vinculado",
            descripcion=f"Se vinculó el dispositivo {dispositivo.serie} al vehículo {vehiculo.nombre}",
            lat=None,
            lng=None
        )
        db.session.commit()

        print(f"✅ Dispositivo {dispositivo.serie} vinculado correctamente a {vehiculo.nombre}")

        return jsonify({
            "ok": True,
            "mensaje": "dispositivo vinculado correctamente",
            "dispositivo_serie": dispositivo.serie,
            "vehiculo": vehiculo.nombre
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error al vincular dispositivo: {e}")
        return jsonify({"error": "error interno del servidor"}), 500

# ==================================================================
# ENDPOINT: LISTAR USUARIOS DE LA EMPRESA
# ==================================================================

@app.route('/api/usuarios', methods=['GET'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def listar_usuarios_empresa():
    usuario = obtener_usuario_actual()

    if not usuario:
        return jsonify({"error": "sesión no válida"}), 401

    if usuario.tipo not in ("dueno", "admin"):
        return jsonify({"error": "no tienes permiso para ver usuarios"}), 403

    usuarios = Usuario.query.filter(
        Usuario.empresa_id == usuario.empresa_id,
        Usuario.tipo.in_(["chofer", "supervisor"])
    ).order_by(Usuario.id.desc()).all()

    return jsonify({
        "usuarios": [serializar_usuario(u) for u in usuarios]
    }), 200

@app.route('/api/usuarios/<int:usuario_id>/reset-password', methods=['PUT'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def reset_password_usuario_empresa(usuario_id):
    usuario_actual = obtener_usuario_actual()
    usuario = db.session.get(Usuario, usuario_id)

    if not usuario:
        return jsonify({"error": "usuario no encontrado"}), 404

    if usuario.empresa_id != usuario_actual.empresa_id:
        return jsonify({"error": "no tienes acceso a este usuario"}), 403

    if usuario.tipo not in ("chofer", "supervisor"):
        return jsonify({"error": "no puedes cambiar contraseña de este usuario"}), 403

    data = request.json or {}
    nueva_password = data.get("password", "").strip()

    if len(nueva_password) < 6:
        return jsonify({"error": "la contraseña debe tener al menos 6 caracteres"}), 400

    try:
        usuario.password = generate_password_hash(nueva_password)
        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "contraseña actualizada correctamente"
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ==================================================================
# ENDPOINT: CREAR USUARIO (CHOFER O SUPERVISOR)
# ==================================================================

@app.route('/api/usuarios', methods=['POST'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def crear_usuario_empresa():
    print("✅ ENTRÓ A CREAR USUARIO")

    try:
        usuario_actual = obtener_usuario_actual()
        print("Usuario actual:", usuario_actual)

        if not usuario_actual:
            return jsonify({"error": "sesión no válida"}), 401

        data = request.json or {}
        print("DATA RECIBIDA:", data)

        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        password = data.get("password", "").strip()
        tipo = data.get("tipo", "").strip()

        nuevo_usuario = Usuario(
            nombre=nombre,
            correo=correo,
            password=generate_password_hash(password),
            tipo=tipo,
            empresa_id=usuario_actual.empresa_id,
            activo=True
        )

        db.session.add(nuevo_usuario)
        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "usuario creado correctamente",
            "usuario": serializar_usuario(nuevo_usuario)
        }), 201

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
# ==================================================================
# ENDPOINT: DESACTIVAR USUARIO
# ==================================================================

@app.route('/api/usuarios/<int:usuario_id>/desactivar', methods=['PUT'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def desactivar_usuario_empresa(usuario_id):
    usuario_actual = obtener_usuario_actual()

    if not usuario_actual:
        return jsonify({"error": "sesión no válida"}), 401

    if usuario_actual.tipo not in ("dueno", "admin"):
        return jsonify({"error": "no tienes permiso para desactivar usuarios"}), 403

    usuario = db.session.get(Usuario, usuario_id)

    if not usuario:
        return jsonify({"error": "usuario no encontrado"}), 404

    if usuario.empresa_id != usuario_actual.empresa_id:
        return jsonify({"error": "no tienes acceso a este usuario"}), 403

    if usuario.id == usuario_actual.id:
        return jsonify({"error": "no puedes desactivar tu propia cuenta"}), 400

    usuario.activo = False
    db.session.commit()

    return jsonify({"ok": True, "mensaje": "usuario desactivado correctamente"}), 200


@app.route('/api/usuarios/<int:usuario_id>', methods=['GET'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def obtener_usuario_empresa(usuario_id):
    usuario_actual = obtener_usuario_actual()

    usuario = db.session.get(Usuario, usuario_id)

    if not usuario:
        return jsonify({"error": "usuario no encontrado"}), 404

    if usuario.empresa_id != usuario_actual.empresa_id:
        return jsonify({"error": "no tienes acceso a este usuario"}), 403

    if usuario.tipo not in ("chofer", "supervisor"):
        return jsonify({"error": "no puedes editar este tipo de usuario"}), 403

    return jsonify({
        "usuario": serializar_usuario(usuario)
    }), 200


@app.route('/api/usuarios/<int:usuario_id>', methods=['PUT'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def editar_usuario_empresa(usuario_id):
    usuario_actual = obtener_usuario_actual()

    usuario = db.session.get(Usuario, usuario_id)

    if not usuario:
        return jsonify({"error": "usuario no encontrado"}), 404

    if usuario.empresa_id != usuario_actual.empresa_id:
        return jsonify({"error": "no tienes acceso a este usuario"}), 403

    if usuario.tipo not in ("chofer", "supervisor"):
        return jsonify({"error": "no puedes editar este tipo de usuario"}), 403

    data = request.json or {}

    nombre = data.get("nombre", "").strip()
    correo = data.get("correo", "").strip().lower()
    telefono = data.get("telefono", "").strip()
    tipo = data.get("tipo", "").strip()

    if not nombre or not correo or not tipo:
        return jsonify({"error": "nombre, correo y tipo son requeridos"}), 400

    if tipo not in ("chofer", "supervisor"):
        return jsonify({"error": "tipo de usuario no válido"}), 400

    existe = Usuario.query.filter(
        Usuario.correo == correo,
        Usuario.id != usuario.id
    ).first()

    if existe:
        return jsonify({"error": "ya existe otro usuario con ese correo"}), 409

    try:
        usuario.nombre = nombre
        usuario.correo = correo
        usuario.telefono = telefono
        usuario.tipo = tipo

        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "usuario actualizado correctamente",
            "usuario": serializar_usuario(usuario)
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error editando usuario: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/usuarios/<int:usuario_id>/reactivar', methods=['PUT'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def reactivar_usuario_empresa(usuario_id):
    usuario_actual = obtener_usuario_actual()

    usuario = db.session.get(Usuario, usuario_id)

    if not usuario:
        return jsonify({"error": "usuario no encontrado"}), 404

    if usuario.empresa_id != usuario_actual.empresa_id:
        return jsonify({"error": "no tienes acceso a este usuario"}), 403

    if usuario.tipo not in ("chofer", "supervisor"):
        return jsonify({"error": "no puedes reactivar este tipo de usuario"}), 403

    usuario.activo = True
    db.session.commit()

    return jsonify({
        "ok": True,
        "mensaje": "usuario reactivado correctamente",
        "usuario": serializar_usuario(usuario)
    }), 200

# ==================================================================
# ENDPOINT: LISTAR PLANES COMERCIALES
# ==================================================================

@app.route('/api/planes', methods=['GET'])
@jwt_required()
def listar_planes():
    planes = Plan.query.filter_by(activo=True).all()
    return jsonify({
        "planes": [
            {
                "id": p.id, "nombre": p.nombre, "descripcion": p.descripcion,
                "precio_dispositivo": p.precio_dispositivo, "mensualidad": p.mensualidad,
                "costo_instalacion": p.costo_instalacion,
                "costo_mantenimiento": p.costo_mantenimiento
            }
            for p in planes
        ]
    }), 200


# ==================================================================
# ENDPOINT: LISTAR SERVICIOS (INSTALACIONES, MANTENIMIENTOS, ETC.)
# ==================================================================

@app.route('/api/servicios', methods=['GET'])
@jwt_required()
@rol_requerido('dueno', 'admin', 'tecnico')
def listar_servicios():
    usuario = obtener_usuario_actual()

    if usuario.tipo == 'tecnico':
        # El técnico ve todos los servicios (no pertenece a una empresa).
        servicios = Servicio.query.order_by(Servicio.timestamp.desc()).limit(200).all()
    else:
        servicios = Servicio.query.filter_by(empresa_id=usuario.empresa_id) \
            .order_by(Servicio.timestamp.desc()).limit(200).all()

    return jsonify({
        "servicios": [
            {
                "id": s.id, "vehiculo_id": s.vehiculo_id, "dispositivo_id": s.dispositivo_id,
                "tipo": s.tipo, "descripcion": s.descripcion, "costo": s.costo,
                "estado": s.estado, "timestamp": s.timestamp
            }
            for s in servicios
        ]
    }), 200

# ENDPOINT: DUEÑO CONFIGURACION

@app.route('/api/dueno/configuracion', methods=['GET'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def obtener_configuracion_dueno():
    usuario = obtener_usuario_actual()

    if not usuario:
        return jsonify({"error": "usuario no válido"}), 401

    empresa = db.session.get(Empresa, usuario.empresa_id) if usuario.empresa_id else None

    suscripcion = Suscripcion.query.filter_by(
        empresa_id=usuario.empresa_id
    ).order_by(Suscripcion.id.desc()).first() if usuario.empresa_id else None

    plan = db.session.get(Plan, suscripcion.plan_id) if suscripcion else None

    return jsonify({
        "usuario": {
            "id": usuario.id,
            "nombre": usuario.nombre,
            "correo": usuario.correo,
            "tipo": usuario.tipo,
            "telefono": getattr(usuario, "telefono", None),
            "activo": getattr(usuario, "activo", True)
        },
        "empresa": {
            "id": empresa.id if empresa else None,
            "nombre": getattr(empresa, "nombre", "Empresa no disponible") if empresa else "Empresa no disponible",
            "telefono": getattr(empresa, "telefono", None) if empresa else None,
            "correo": getattr(empresa, "correo", None) if empresa else None,
            "direccion": getattr(empresa, "direccion", None) if empresa else None
        },
        "suscripcion": {
            "id": suscripcion.id if suscripcion else None,
            "estado": suscripcion.estado if suscripcion else "sin suscripción",
            "cantidad_vehiculos": suscripcion.cantidad_vehiculos if suscripcion else 0,
            "monto_mensual": suscripcion.monto_mensual if suscripcion else 0,
            "fecha_inicio": suscripcion.fecha_inicio if suscripcion else None,
            "fecha_fin": suscripcion.fecha_fin if suscripcion else None
        },
        "plan": {
            "id": plan.id if plan else None,
            "nombre": getattr(plan, "nombre", "Plan no disponible") if plan else "Plan no disponible",
            "descripcion": getattr(plan, "descripcion", None) if plan else None
        }
    }), 200

@app.route('/api/dueno/perfil', methods=['PUT'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def actualizar_perfil_dueno():
    usuario = obtener_usuario_actual()

    data = request.json or {}

    nombre = data.get("nombre", "").strip()
    telefono = data.get("telefono", "").strip()

    if not nombre:
        return jsonify({"error": "el nombre es requerido"}), 400

    try:
        usuario.nombre = nombre
        usuario.telefono = telefono

        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "perfil actualizado correctamente",
            "usuario": {
                "id": usuario.id,
                "nombre": usuario.nombre,
                "correo": usuario.correo,
                "telefono": usuario.telefono,
                "tipo": usuario.tipo
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    

@app.route('/api/dueno/password', methods=['PUT'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def cambiar_password_dueno():
    usuario = obtener_usuario_actual()
    data = request.json or {}

    password_actual = data.get("password_actual", "").strip()
    password_nueva = data.get("password_nueva", "").strip()

    if not password_actual or not password_nueva:
        return jsonify({"error": "contraseña actual y nueva contraseña son requeridas"}), 400

    if len(password_nueva) < 6:
        return jsonify({"error": "la nueva contraseña debe tener al menos 6 caracteres"}), 400

    try:
        password_guardada = usuario.password or ""

        if not bcrypt.checkpw(
            password_actual.encode("utf-8"),
            password_guardada.encode("utf-8")
        ):
            return jsonify({"error": "la contraseña actual no es correcta"}), 401

        usuario.password = bcrypt.hashpw(
            password_nueva.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "contraseña actualizada correctamente"
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error cambiando contraseña: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/dueno/empresa', methods=['PUT'])
@jwt_required()
@rol_requerido('dueno', 'admin')
def actualizar_empresa_dueno():
    usuario = obtener_usuario_actual()
    empresa = db.session.get(Empresa, usuario.empresa_id)

    if not empresa:
        return jsonify({"error": "empresa no encontrada"}), 404

    data = request.json or {}

    empresa.nombre = data.get("nombre", "").strip()
    empresa.correo = data.get("correo", "").strip().lower()
    empresa.telefono = data.get("telefono", "").strip()
    empresa.direccion = data.get("direccion", "").strip()

    db.session.commit()

    return jsonify({"ok": True, "mensaje": "empresa actualizada correctamente"}), 200


@app.route('/api/choferes', methods=['GET'])
@jwt_required()
@rol_requerido('dueno', 'admin', 'supervisor')
def listar_choferes_empresa():
    usuario_actual = obtener_usuario_actual()

    vehiculo_id = request.args.get("vehiculo_id", type=int)

    choferes_ocupados_query = Vehiculo.query.filter(
        Vehiculo.empresa_id == usuario_actual.empresa_id,
        Vehiculo.activo == True,
        Vehiculo.chofer_id.isnot(None)
    )

    # En editar, permitimos que aparezca el chofer del mismo vehículo.
    if vehiculo_id:
        choferes_ocupados_query = choferes_ocupados_query.filter(
            Vehiculo.id != vehiculo_id
        )

    choferes_ocupados_ids = [
        v.chofer_id for v in choferes_ocupados_query.all()
    ]

    choferes = Usuario.query.filter(
        Usuario.empresa_id == usuario_actual.empresa_id,
        Usuario.tipo == 'chofer',
        Usuario.activo == True,
        ~Usuario.id.in_(choferes_ocupados_ids)
    ).order_by(Usuario.nombre.asc()).all()

    return jsonify({
        "choferes": [
            {
                "id": c.id,
                "nombre": c.nombre,
                "correo": c.correo,
                "telefono": c.telefono
            }
            for c in choferes
        ]
    }), 200

# ==================================================================
# ENDPOINT: GUARDAR SUSCRIPCIÓN PUSH
# ==================================================================
# El dashboard/app móvil llama esto cuando el usuario activa las
# notificaciones push en su navegador o dispositivo.
# ==================================================================

@app.route('/api/push/subscribe', methods=['POST'])
@jwt_required()
def push_subscribe():
    usuario = obtener_usuario_actual()
    data = request.json

    if not data or not all(k in data for k in ('endpoint', 'p256dh', 'auth')):
        return jsonify({"error": "endpoint, p256dh y auth son requeridos"}), 400

    suscripcion_existente = PushSubscripcion.query.filter_by(endpoint=data['endpoint']).first()

    if suscripcion_existente:
        suscripcion_existente.p256dh = data['p256dh']
        suscripcion_existente.auth = data['auth']
        suscripcion_existente.usuario_id = usuario.id
    else:
        nueva_suscripcion = PushSubscripcion(
            usuario_id=usuario.id,
            endpoint=data['endpoint'],
            p256dh=data['p256dh'],
            auth=data['auth']
        )
        db.session.add(nueva_suscripcion)

    try:
        db.session.commit()
        return jsonify({"ok": True, "mensaje": "suscripción push guardada"}), 201
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error al guardar suscripción push: {e}")
        return jsonify({"error": "error interno del servidor"}), 500


# ==================================================================
# EJECUCIÓN DE LA APLICACIÓN
# ==================================================================
# Para correr el servidor en desarrollo:
#
#   1. Crear las tablas en MySQL (solo la primera vez o si cambian
#      los modelos):
#         with app.app_context():
#             db.create_all()
#
#   2. Crear datos iniciales de prueba (planes, empresa demo,
#      usuario dueño y técnico):
#         with app.app_context():
#             crear_datos_iniciales()
#
#   3. Iniciar el servidor:
#         python app.py
#
# Ambos pasos (1 y 2) ya están incluidos abajo, así que basta con
# ejecutar este archivo directamente la primera vez.
# ==================================================================


# ============================================================
# RUTAS FRONTEND - VISTAS HTML
# Estas rutas solo renderizan templates.
# La seguridad real de datos se mantiene en los endpoints /api con JWT.
# ============================================================

@app.route("/")
def home():
    return redirect(url_for("login_view"))


@app.get("/login")
def login_view():
    return render_template("auth/login.html")


@app.get("/registro")
def registro_view():
    return render_template("auth/registro.html")


@app.get("/logout")
def logout_view():
    return redirect(url_for("login_view"))


@app.get("/dueno")
def dueno_home():
    return redirect(url_for("dueno_dashboard"))


@app.get("/dueno/dashboard")
def dueno_dashboard():
    return render_template("dueno/dashboard.html")


@app.get("/dueno/vehiculos")
def dueno_vehiculos():
    return render_template("dueno/vehiculos/index.html")

@app.get("/dueno/vehiculos/nuevo")
def dueno_vehiculo_nuevo():
    return render_template("dueno/vehiculos/nuevo.html")


@app.get("/dueno/vehiculos/<int:vehiculo_id>")
def dueno_vehiculo_detalle(vehiculo_id):
    return render_template("dueno/vehiculos/detalle.html", vehiculo_id=vehiculo_id)

@app.get("/dueno/vehiculos/<int:vehiculo_id>/editar")
def dueno_vehiculo_editar(vehiculo_id):
    return render_template("dueno/vehiculos/editar.html", vehiculo_id=vehiculo_id)

@app.get("/dueno/alertas")
def dueno_alertas():
    return render_template("dueno/alertas/index.html")


@app.get("/dueno/historial")
def dueno_historial():
    return render_template("dueno/historial.html")


@app.get("/dueno/reportes")
def dueno_reportes():
    return render_template("dueno/reportes.html")


@app.get("/dueno/usuarios")
def dueno_usuarios():
    return render_template("dueno/usuarios/index.html")


@app.get("/dueno/usuarios/nuevo")
def dueno_usuario_nuevo():
    return render_template("dueno/usuarios/nuevo.html")


@app.get("/dueno/usuarios/<int:usuario_id>/editar")
def dueno_usuario_editar(usuario_id):
    return render_template("dueno/usuarios/editar.html", usuario_id=usuario_id)

@app.get("/dueno/configuracion")
def dueno_configuracion():
    return render_template("dueno/configuracion/index.html")

@app.get("/dueno/configuracion/editar")
def dueno_configuracion_editar():
    return render_template("dueno/configuracion/editar.html")


with app.app_context():
    db.create_all()
    crear_datos_iniciales()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)