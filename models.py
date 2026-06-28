from config import db
import time
import bcrypt


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def timestamp_actual():
    """Devuelve timestamp actual en segundos."""
    return int(time.time())


def generar_hash_password(password):
    """Genera hash seguro para contraseñas."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ============================================================
# PLANES / PAQUETES COMERCIALES
# Básico, Profesional, Premium
# ============================================================

class Plan(db.Model):
    __tablename__ = 'planes'

    id = db.Column(db.Integer, primary_key=True)

    nombre = db.Column(db.String(50), nullable=False, unique=True)
    descripcion = db.Column(db.String(255))

    precio_dispositivo = db.Column(db.Float, default=0)
    mensualidad = db.Column(db.Float, default=0)
    costo_instalacion = db.Column(db.Float, default=0)
    costo_mantenimiento = db.Column(db.Float, default=0)

    activo = db.Column(db.Boolean, default=True)
    fecha_creacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# EMPRESAS / CLIENTES
# Cada empresa puede tener usuarios, vehículos y dispositivos
# ============================================================

class Empresa(db.Model):
    __tablename__ = 'empresas'

    id = db.Column(db.Integer, primary_key=True)

    nombre = db.Column(db.String(150), nullable=False)
    correo = db.Column(db.String(120))
    telefono = db.Column(db.String(20))
    direccion = db.Column(db.String(255))

    plan_id = db.Column(db.Integer, db.ForeignKey('planes.id'), nullable=True)

    activo = db.Column(db.Boolean, default=True)
    fecha_creacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# USUARIOS
# Roles: dueno, supervisor, chofer, tecnico, admin
# ============================================================

class Usuario(db.Model):
    __tablename__ = 'usuarios'

    id = db.Column(db.Integer, primary_key=True)

    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=True)

    nombre = db.Column(db.String(100), nullable=False)

    correo = db.Column(db.String(120), unique=True, nullable=False)

    password = db.Column(db.String(255), nullable=False)

    tipo = db.Column(db.String(20), nullable=False, default='chofer')
    # admin / dueno / supervisor / chofer / tecnico

    telefono = db.Column(db.String(20))
    activo = db.Column(db.Boolean, default=True)

    fecha_creacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# DISPOSITIVOS FÍSICOS TRACKSECURITY
# Cada dispositivo tiene serie, PIN y puede asignarse a empresa
# ============================================================

class Dispositivo(db.Model):
    __tablename__ = 'dispositivos'

    id = db.Column(db.Integer, primary_key=True)

    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=True)

    serie = db.Column(db.String(50), unique=True, nullable=False)
    # Ejemplo: TS-000001

    imei = db.Column(db.String(30), unique=True, nullable=True)
    # IMEI del módulo SIM, si aplica

    pin_activacion = db.Column(db.String(10), nullable=False)

    modelo = db.Column(db.String(50))
    # Básico / Profesional / Premium

    firmware = db.Column(db.String(50))

    estado = db.Column(db.String(20), default='disponible')
    # disponible / instalado / activo / mantenimiento / desactivado

    ultima_conexion = db.Column(db.Integer, nullable=True)
    fecha_instalacion = db.Column(db.Integer, nullable=True)

    fecha_creacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# VEHÍCULOS
# Pertenecen a una empresa y pueden tener chofer/dispositivo
# ============================================================

class Vehiculo(db.Model):
    __tablename__ = 'vehiculos'

    id = db.Column(db.Integer, primary_key=True)

    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=False)

    nombre = db.Column(db.String(100), nullable=False)

    identificador = db.Column(db.String(50), unique=True, nullable=False)
    # Numero de serie del dispositivo: CAM-001, camion_1, etc.

    placa = db.Column(db.String(20))
    marca = db.Column(db.String(50))
    modelo = db.Column(db.String(50))
    anio = db.Column(db.Integer)

    chofer_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)

    dispositivo_id = db.Column(db.Integer, db.ForeignKey('dispositivos.id'), nullable=True)

    activo = db.Column(db.Boolean, default=True)

    fecha_creacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# SUSCRIPCIONES
# Control de mensualidad por empresa
# ============================================================

class Suscripcion(db.Model):
    __tablename__ = 'suscripciones'

    id = db.Column(db.Integer, primary_key=True)

    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=False)
    plan_id = db.Column(db.Integer, db.ForeignKey('planes.id'), nullable=False)

    cantidad_vehiculos = db.Column(db.Integer, default=0)
    monto_mensual = db.Column(db.Float, default=0)

    estado = db.Column(db.String(20), default='activa')
    # activa / vencida / cancelada / suspendida

    fecha_inicio = db.Column(db.Integer, default=timestamp_actual)
    fecha_fin = db.Column(db.Integer, nullable=True)


# ============================================================
# SERVICIOS
# Instalación, mantenimiento, reparación, cambio de dispositivo
# ============================================================

class Servicio(db.Model):
    __tablename__ = 'servicios'

    id = db.Column(db.Integer, primary_key=True)

    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=False)
    vehiculo_id = db.Column(db.Integer, db.ForeignKey('vehiculos.id'), nullable=True)
    dispositivo_id = db.Column(db.Integer, db.ForeignKey('dispositivos.id'), nullable=True)

    tipo = db.Column(db.String(50), nullable=False)
    # instalacion / mantenimiento / reparacion / cambio_dispositivo

    descripcion = db.Column(db.String(255))

    costo = db.Column(db.Float, default=0)

    estado = db.Column(db.String(20), default='pendiente')
    # pendiente / realizado / cancelado

    timestamp = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# UBICACIÓN ACTUAL
# Guarda solo el último estado del vehículo para el dashboard
# ============================================================

class UbicacionActual(db.Model):
    __tablename__ = 'ubicacion_actual'

    vehiculo_id = db.Column(
        db.Integer,
        db.ForeignKey('vehiculos.id'),
        primary_key=True
    )

    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    velocidad = db.Column(db.Float, default=0)

    estado = db.Column(db.String(20), default='sin_senal')
    puerta = db.Column(db.String(20), default='desconocida')
    vibracion = db.Column(db.Integer, default=0)
    alerta = db.Column(db.Integer, default=0)

    ultima_actualizacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# HISTORIAL GPS
# Guarda recorrido completo del vehículo
# ============================================================

class HistorialGPS(db.Model):
    __tablename__ = 'historial_gps'

    id = db.Column(db.Integer, primary_key=True)

    vehiculo_id = db.Column(db.Integer, db.ForeignKey('vehiculos.id'), nullable=False)
    dispositivo_id = db.Column(db.Integer, db.ForeignKey('dispositivos.id'), nullable=True)

    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    velocidad = db.Column(db.Float, default=0)

    timestamp = db.Column(db.Integer, nullable=False, default=timestamp_actual)


# ============================================================
# EVENTOS
# Registros normales: modo manual, encendido, cambio de estado
# ============================================================

class Evento(db.Model):
    __tablename__ = 'eventos'

    id = db.Column(db.Integer, primary_key=True)

    vehiculo_id = db.Column(db.Integer, db.ForeignKey('vehiculos.id'), nullable=False)

    tipo = db.Column(db.String(50), nullable=False)
    # sistema_encendido / modo_manual / puerta_cerrada / gps_actualizado

    descripcion = db.Column(db.String(255))

    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    timestamp = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# ALERTAS
# Eventos críticos: pánico, puerta abierta, vibración, sin señal
# ============================================================

class Alerta(db.Model):
    __tablename__ = 'alertas'

    id = db.Column(db.Integer, primary_key=True)

    vehiculo_id = db.Column(db.Integer, db.ForeignKey('vehiculos.id'), nullable=False)

    tipo = db.Column(db.String(50), nullable=False)
    # panico / puerta_abierta / vibracion / sin_senal / gps_perdido

    nivel = db.Column(db.String(20), default='medio')
    # bajo / medio / alto / critico

    descripcion = db.Column(db.String(255))

    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    atendida = db.Column(db.Boolean, default=False)

    atendida_por = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    fecha_atencion = db.Column(db.Integer, nullable=True)

    timestamp = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# EVIDENCIAS
# Fotografías capturadas por cámara en alertas
# ============================================================

class Evidencia(db.Model):
    __tablename__ = 'evidencias'

    id = db.Column(db.Integer, primary_key=True)

    vehiculo_id = db.Column(db.Integer, db.ForeignKey('vehiculos.id'), nullable=False)

    alerta_id = db.Column(db.Integer, db.ForeignKey('alertas.id'), nullable=True)

    url_imagen = db.Column(db.String(500), nullable=False)

    descripcion = db.Column(db.String(255))

    timestamp = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# PUSH SUBSCRIPCIONES
# Notificaciones web push por usuario
# ============================================================

class PushSubscripcion(db.Model):
    __tablename__ = 'push_subscripciones'

    id = db.Column(db.Integer, primary_key=True)

    usuario_id = db.Column(
        db.Integer,
        db.ForeignKey('usuarios.id'),
        nullable=False
    )

    endpoint = db.Column(
        db.String(500),
        unique=True,
        nullable=False
    )

    p256dh = db.Column(
        db.String(255),
        nullable=False
    )

    auth = db.Column(
        db.String(255),
        nullable=False
    )

    created_at = db.Column(
        db.Integer,
        default=timestamp_actual
    )


# ============================================================
# DATOS INICIALES
# Crea planes, empresa demo, dueño y técnico por defecto
# ============================================================

def crear_datos_iniciales():
    """
    Ejecutar después de db.create_all().
    Crea datos mínimos para pruebas:
    - Planes comerciales
    - Empresa demo
    - Usuario dueño
    - Usuario técnico
    """

    # ---------------- PLANES ----------------

    if not Plan.query.filter_by(nombre='Básico').first():
        db.session.add(Plan(
            nombre='Básico',
            descripcion='Monitoreo GPS, sensor de puerta, app móvil y dashboard.',
            precio_dispositivo=0,
            mensualidad=0,
            costo_instalacion=0,
            costo_mantenimiento=0
        ))

    if not Plan.query.filter_by(nombre='Profesional').first():
        db.session.add(Plan(
            nombre='Profesional',
            descripcion='Incluye FPGA, sensor de vibración, botón de pánico y sirena.',
            precio_dispositivo=0,
            mensualidad=0,
            costo_instalacion=0,
            costo_mantenimiento=0
        ))

    if not Plan.query.filter_by(nombre='Premium').first():
        db.session.add(Plan(
            nombre='Premium',
            descripcion='Incluye cámara de evidencia fotográfica y funciones avanzadas.',
            precio_dispositivo=0,
            mensualidad=0,
            costo_instalacion=0,
            costo_mantenimiento=0
        ))

    db.session.commit()

    # ---------------- EMPRESA DEMO ----------------

    empresa = Empresa.query.filter_by(nombre='Empresa Demo').first()

    if not empresa:
        plan_profesional = Plan.query.filter_by(nombre='Profesional').first()

        empresa = Empresa(
            nombre='Empresa Demo',
            correo='empresa@demo.com',
            telefono='0000000000',
            direccion='Sin dirección',
            plan_id=plan_profesional.id if plan_profesional else None
        )

        db.session.add(empresa)
        db.session.commit()

    # ---------------- USUARIO DUEÑO ----------------

    if not Usuario.query.filter_by(correo='admin@gmail.com').first():
        db.session.add(Usuario(
            empresa_id=empresa.id,
            nombre='Dueño Demo',
            correo='admin@gmail.com',
            password=generar_hash_password('admin123'),
            tipo='dueno'
        ))

    # ---------------- USUARIO TÉCNICO ----------------

    if not Usuario.query.filter_by(correo='tecnico@gmail.com').first():
        db.session.add(Usuario(
            empresa_id=None,
            nombre='Técnico TrackSecurity',
            correo='tecnico@gmail.com',
            password=generar_hash_password('tecnico123'),
            tipo='tecnico'
        ))

    db.session.commit()