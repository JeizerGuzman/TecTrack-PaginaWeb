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
# PLANES / PAQUETES DEL SISTEMA
# Básico, Profesional, Premium
#
# En TrackSecurity el "Plan" representa realmente el paquete o
# versión del sistema que define qué características incluye.
# Se conservan los nombres Plan, planes y plan_id para evitar
# cambios innecesarios en rutas, vistas y lógica ya existente.
# ============================================================

class Plan(db.Model):
    __tablename__ = 'planes'

    id = db.Column(db.Integer, primary_key=True)

    nombre = db.Column(db.String(50), nullable=False, unique=True)
    descripcion = db.Column(db.String(255))

    # ---------------- CARACTERÍSTICAS INCLUIDAS ----------------

    tiene_gps = db.Column(db.Boolean, default=True)
    tiene_sensor_vibracion = db.Column(db.Boolean, default=True)
    tiene_sensor_puerta = db.Column(db.Boolean, default=True)
    tiene_boton_panico = db.Column(db.Boolean, default=True)
    tiene_sirena = db.Column(db.Boolean, default=True)
    tiene_dashboard_web = db.Column(db.Boolean, default=True)
    tiene_app_movil = db.Column(db.Boolean, default=True)

    tiene_fpga = db.Column(db.Boolean, default=False)
    tiene_camara = db.Column(db.Boolean, default=False)
    tiene_captura_evidencia = db.Column(db.Boolean, default=False)

    # ---------------- POLÍTICAS DE RETENCIÓN ----------------
    # Cantidad de días que se conservará la información.
    # Un valor NULL significa que no aplica.

    dias_retencion_gps = db.Column(db.Integer, default=30)
    dias_retencion_alertas = db.Column(db.Integer, default=180)
    dias_retencion_evidencias = db.Column(db.Integer, nullable=True)

    activo = db.Column(db.Boolean, default=True)
    fecha_creacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# TARIFAS POR PLAN Y CANTIDAD DE VEHÍCULOS
#
# Permite manejar descuentos por volumen:
# 1-4 vehículos, 5-9, 10-19, 20 o más, etc.
#
# Todos los costos guardados aquí son UNITARIOS.
# La suscripción guarda los precios reales acordados y los totales.
# ============================================================

class TarifaPlan(db.Model):
    __tablename__ = 'tarifas_plan'

    id = db.Column(db.Integer, primary_key=True)

    plan_id = db.Column(
        db.Integer,
        db.ForeignKey('planes.id'),
        nullable=False
    )

    cantidad_minima = db.Column(db.Integer, nullable=False, default=1)

    cantidad_maxima = db.Column(db.Integer, nullable=True)
    # NULL significa que no existe límite superior.

    # ---------------- PRECIOS UNITARIOS ----------------

    precio_dispositivo = db.Column(db.Float, default=0)
    costo_instalacion = db.Column(db.Float, default=0)
    mensualidad = db.Column(db.Float, default=0)
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

    # Se conserva plan_id para compatibilidad con el sistema actual.
    plan_id = db.Column(
        db.Integer,
        db.ForeignKey('planes.id'),
        nullable=True
    )

    activo = db.Column(db.Boolean, default=True)
    fecha_creacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# USUARIOS
# Roles: dueno, supervisor, chofer, tecnico, admin
# ============================================================

class Usuario(db.Model):
    __tablename__ = 'usuarios'

    id = db.Column(db.Integer, primary_key=True)

    empresa_id = db.Column(
        db.Integer,
        db.ForeignKey('empresas.id'),
        nullable=True
    )

    nombre = db.Column(db.String(100), nullable=False)

    correo = db.Column(
        db.String(120),
        unique=True,
        nullable=False
    )

    password = db.Column(db.String(255), nullable=False)

    tipo = db.Column(
        db.String(20),
        nullable=False,
        default='chofer'
    )
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

    empresa_id = db.Column(
        db.Integer,
        db.ForeignKey('empresas.id'),
        nullable=True
    )

    serie = db.Column(
        db.String(50),
        unique=True,
        nullable=False
    )
    # Ejemplo: TS-000001

    imei = db.Column(
        db.String(30),
        unique=True,
        nullable=True
    )
    # IMEI del módulo SIM, si aplica

    pin_activacion = db.Column(
        db.String(10),
        nullable=False
    )

    modelo = db.Column(db.String(50))
    # Básico / Profesional / Premium
    # Se conserva como texto para no romper las rutas y vistas actuales.

    firmware = db.Column(db.String(50))

    estado = db.Column(
        db.String(20),
        default='disponible'
    )
    # disponible / instalado / activo / mantenimiento / desactivado

    ultima_conexion = db.Column(db.Integer, nullable=True)

    fecha_instalacion = db.Column(db.Integer, nullable=True)

    # Técnico que realizó la instalación o activación.
    instalado_por = db.Column(
        db.Integer,
        db.ForeignKey('usuarios.id'),
        nullable=True
    )

    # Momento en que el dispositivo quedó activado.
    fecha_activacion = db.Column(db.Integer, nullable=True)

    fecha_creacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# VEHÍCULOS
# Pertenecen a una empresa y pueden tener chofer/dispositivo
# ============================================================

class Vehiculo(db.Model):
    __tablename__ = 'vehiculos'

    id = db.Column(db.Integer, primary_key=True)

    empresa_id = db.Column(
        db.Integer,
        db.ForeignKey('empresas.id'),
        nullable=False
    )

    nombre = db.Column(db.String(100), nullable=False)

    identificador = db.Column(
        db.String(50),
        unique=True,
        nullable=False
    )
    # Identificador interno: CAM-001, camion_1, etc.

    placa = db.Column(db.String(20))
    marca = db.Column(db.String(50))
    modelo = db.Column(db.String(50))
    anio = db.Column(db.Integer)

    chofer_id = db.Column(
        db.Integer,
        db.ForeignKey('usuarios.id'),
        nullable=True
    )

    dispositivo_id = db.Column(
        db.Integer,
        db.ForeignKey('dispositivos.id'),
        nullable=True
    )

    # Estado independiente del estado operativo visible.
    estado_instalacion = db.Column(
        db.String(30),
        default='sin_dispositivo'
    )
    # sin_dispositivo / pendiente_instalacion / instalado / desactivado

    activo = db.Column(db.Boolean, default=True)

    fecha_creacion = db.Column(db.Integer, default=timestamp_actual)


# ============================================================
# SUSCRIPCIONES
# Guarda el acuerdo comercial real de cada empresa.
#
# Los campos "unitario" representan el precio por una unidad.
# Los campos "total" representan el precio multiplicado por la
# cantidad de vehículos contratados.
#
# Aunque después cambien las tarifas generales, esta tabla conserva
# los precios acordados originalmente con la empresa.
# ============================================================

class Suscripcion(db.Model):
    __tablename__ = 'suscripciones'

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # Empresa propietaria de la suscripción.
    empresa_id = db.Column(
        db.Integer,
        db.ForeignKey('empresas.id'),
        nullable=False
    )

    # Plan contratado por la empresa.
    plan_id = db.Column(
        db.Integer,
        db.ForeignKey('planes.id'),
        nullable=False
    )

    # Tarifa que sirvió como referencia al crear
    # la suscripción.
    #
    # Se deja nullable porque pueden existir:
    # - suscripciones antiguas
    # - acuerdos personalizados
    # - datos migrados sin tarifa asociada
    tarifa_plan_id = db.Column(
        db.Integer,
        db.ForeignKey('tarifas_plan.id'),
        nullable=True
    )

    # Cantidad de vehículos contratados.
    cantidad_vehiculos = db.Column(
        db.Integer,
        default=0
    )

    # ========================================================
    # PRECIOS UNITARIOS ACORDADOS
    # ========================================================
    #
    # Estos valores se copian inicialmente desde TarifaPlan,
    # pero pueden modificarse si existe una negociación especial.
    #
    # Una modificación futura de TarifaPlan NO debe cambiar
    # automáticamente estos precios.
    # ========================================================

    precio_dispositivo_unitario = db.Column(
        db.Float,
        default=0
    )

    costo_instalacion_unitario = db.Column(
        db.Float,
        default=0
    )

    mensualidad_unitaria = db.Column(
        db.Float,
        default=0
    )

    costo_mantenimiento_unitario = db.Column(
        db.Float,
        default=0
    )

    # ========================================================
    # TOTALES CALCULADOS
    # ========================================================

    monto_dispositivos_total = db.Column(
        db.Float,
        default=0
    )

    monto_instalacion_total = db.Column(
        db.Float,
        default=0
    )

    monto_mensual = db.Column(
        db.Float,
        default=0
    )

    monto_mantenimiento_total = db.Column(
        db.Float,
        default=0
    )

    # Estados sugeridos:
    #
    # activa
    # suspendida
    # vencida
    # cancelada
    estado = db.Column(
        db.String(20),
        default='activa'
    )

    fecha_inicio = db.Column(
        db.Integer,
        default=timestamp_actual
    )

    fecha_fin = db.Column(
        db.Integer,
        nullable=True
    )
    
# ============================================================
# SERVICIOS
# Instalación, mantenimiento, reparación, cambio de dispositivo
# ============================================================

class Servicio(db.Model):
    __tablename__ = 'servicios'

    id = db.Column(db.Integer, primary_key=True)

    empresa_id = db.Column(
        db.Integer,
        db.ForeignKey('empresas.id'),
        nullable=False
    )

    vehiculo_id = db.Column(
        db.Integer,
        db.ForeignKey('vehiculos.id'),
        nullable=True
    )

    dispositivo_id = db.Column(
        db.Integer,
        db.ForeignKey('dispositivos.id'),
        nullable=True
    )

    tipo = db.Column(db.String(50), nullable=False)
    # instalacion / mantenimiento / reparacion / cambio_dispositivo

    descripcion = db.Column(db.String(255))

    costo = db.Column(db.Float, default=0)

    estado = db.Column(
        db.String(20),
        default='pendiente'
    )
    # pendiente / realizado / cancelado

    timestamp = db.Column(
        db.Integer,
        default=timestamp_actual
    )


class ServicioProgramado(db.Model):
    __tablename__ = 'servicios_programados'

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    servicio_id = db.Column(
        db.Integer,
        db.ForeignKey('servicios.id'),
        nullable=True
    )

    empresa_id = db.Column(
        db.Integer,
        db.ForeignKey('empresas.id'),
        nullable=False
    )

    vehiculo_id = db.Column(
        db.Integer,
        db.ForeignKey('vehiculos.id'),
        nullable=True
    )

    dispositivo_id = db.Column(
        db.Integer,
        db.ForeignKey('dispositivos.id'),
        nullable=True
    )

    tecnico_id = db.Column(
        db.Integer,
        db.ForeignKey('usuarios.id'),
        nullable=True
    )

    tipo = db.Column(
        db.String(50),
        nullable=False
    )

    descripcion = db.Column(
        db.String(255),
        nullable=True
    )

    costo_estimado = db.Column(
        db.Float,
        default=0
    )

    estado = db.Column(
        db.String(20),
        default='pendiente'
    )

    fecha_programada = db.Column(
        db.Integer,
        nullable=True
    )

    fecha_inicio = db.Column(
        db.Integer,
        nullable=True
    )

    fecha_finalizacion = db.Column(
        db.Integer,
        nullable=True
    )

    timestamp = db.Column(
        db.Integer,
        default=timestamp_actual
    )

# ============================================================
# UBICACIÓN ACTUAL
# Guarda solo el último estado real reportado por el vehículo.
#
# El estado visible "sin_senal" debe calcularse según el tiempo
# transcurrido desde ultima_actualizacion, sin sobrescribir el
# último estado real recibido.
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

    estado = db.Column(
        db.String(20),
        default='sin_senal'
    )

    puerta = db.Column(
        db.String(20),
        default='desconocida'
    )

    vibracion = db.Column(db.Integer, default=0)
    alerta = db.Column(db.Integer, default=0)

    ultima_actualizacion = db.Column(
        db.Integer,
        default=timestamp_actual
    )


# ============================================================
# HISTORIAL GPS
# Guarda recorrido completo del vehículo
# ============================================================

class HistorialGPS(db.Model):
    __tablename__ = 'historial_gps'

    id = db.Column(db.Integer, primary_key=True)

    vehiculo_id = db.Column(
        db.Integer,
        db.ForeignKey('vehiculos.id'),
        nullable=False
    )

    dispositivo_id = db.Column(
        db.Integer,
        db.ForeignKey('dispositivos.id'),
        nullable=True
    )

    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    velocidad = db.Column(db.Float, default=0)

    timestamp = db.Column(
        db.Integer,
        nullable=False,
        default=timestamp_actual
    )


# ============================================================
# EVENTOS
# Registros normales: modo manual, encendido, cambio de estado
# ============================================================

class Evento(db.Model):
    __tablename__ = 'eventos'

    id = db.Column(db.Integer, primary_key=True)

    vehiculo_id = db.Column(
        db.Integer,
        db.ForeignKey('vehiculos.id'),
        nullable=False
    )

    tipo = db.Column(db.String(50), nullable=False)
    # sistema_encendido / modo_manual / puerta_cerrada / gps_actualizado

    descripcion = db.Column(db.String(255))

    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    timestamp = db.Column(
        db.Integer,
        default=timestamp_actual
    )


# ============================================================
# ALERTAS
# Eventos críticos: pánico, puerta abierta, vibración, sin señal
# ============================================================

class Alerta(db.Model):
    __tablename__ = 'alertas'

    id = db.Column(db.Integer, primary_key=True)

    vehiculo_id = db.Column(
        db.Integer,
        db.ForeignKey('vehiculos.id'),
        nullable=False
    )

    tipo = db.Column(db.String(50), nullable=False)
    # panico / puerta_abierta / vibracion / sin_senal / gps_perdido

    nivel = db.Column(
        db.String(20),
        default='medio'
    )
    # bajo / medio / alto / critico

    descripcion = db.Column(db.String(255))

    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    atendida = db.Column(db.Boolean, default=False)

    # Indica si la condición física que originó la alerta
    # sigue presente en la lectura actual del dispositivo.
    #
    # Ejemplos:
    # puerta abierta  -> True
    # puerta cerrada  -> False
    #
    # Atender una alerta NO modifica este campo.
    condicion_activa = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )
        
    atendida_por = db.Column(
        db.Integer,
        db.ForeignKey('usuarios.id'),
        nullable=True
    )

    fecha_atencion = db.Column(db.Integer, nullable=True)

    timestamp = db.Column(
        db.Integer,
        default=timestamp_actual
    )

    # Última vez que esta alerta volvió a dispararse o actualizarse.
    ultima_actualizacion = db.Column(
        db.Integer,
        default=timestamp_actual
    )


# ============================================================
# EVIDENCIAS
# Fotografías capturadas por cámara en alertas
# ============================================================

class Evidencia(db.Model):
    __tablename__ = 'evidencias'

    id = db.Column(db.Integer, primary_key=True)

    vehiculo_id = db.Column(
        db.Integer,
        db.ForeignKey('vehiculos.id'),
        nullable=False
    )

    alerta_id = db.Column(
        db.Integer,
        db.ForeignKey('alertas.id'),
        nullable=True
    )

    url_imagen = db.Column(
        db.String(500),
        nullable=False
    )

    descripcion = db.Column(db.String(255))

    timestamp = db.Column(
        db.Integer,
        default=timestamp_actual
    )


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



class ConfiguracionSistema(db.Model):
    __tablename__ = "configuracion_sistema"

    id = db.Column(
        db.Integer, 
        primary_key=True
    )

    # ========================================================
    # CONFIGURACIÓN GENERAL
    # ========================================================

    nombre_plataforma = db.Column(
        db.String(100),
        nullable=False,
        default="TrackSecurity"
    )

    correo_soporte = db.Column(
        db.String(150),
        nullable=True
    )

    telefono_soporte = db.Column(
        db.String(30),
        nullable=True
    )


    # ========================================================
    # MONITOREO Y CONEXIÓN
    # ========================================================

    segundos_sin_senal = db.Column(
        db.Integer,
        nullable=False,
        default=60
    )
    
    segundos_separacion_alertas = db.Column(
        db.Integer,
        nullable=False,
        default=10
    )


    # ========================================================
    # ACTUALIZACIÓN AUTOMÁTICA - PANEL ADMINISTRADOR
    # ========================================================

    refresh_admin_dashboard_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=30
    )

    refresh_admin_empresas_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=30
    )

    refresh_admin_suscripciones_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=30
    )

    refresh_admin_planes_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=30
    )

    refresh_admin_usuarios_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=30
    )

    refresh_admin_vehiculos_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=10
    )

    refresh_admin_detalle_vehiculo_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=5
    )

    refresh_admin_dispositivos_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=10
    )

    refresh_admin_servicios_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=30
    )

    refresh_admin_alertas_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=5
    )


    # ========================================================
    # ACTUALIZACIÓN AUTOMÁTICA - DUEÑO Y SUPERVISOR
    #
    # Ambos roles compartirán estos intervalos cuando sus
    # módulos tengan el mismo propósito operativo.
    # ========================================================

    refresh_operacion_dashboard_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=5
    )

    refresh_operacion_vehiculos_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=5
    )

    refresh_operacion_detalle_vehiculo_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=3
    )

    refresh_operacion_alertas_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=5
    )

    refresh_operacion_monitoreo_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=3
    )


    # ========================================================
    # TELEMETRÍA Y GPS
    # ========================================================

    ubicacion_actual_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=3
    )

    historial_gps_segundos = db.Column(
        db.Integer,
        nullable=False,
        default=30
    )

    guardar_gps_inmediato_alerta = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )


    # ========================================================
    # CONTROL
    # ========================================================

    ultima_actualizacion = db.Column(
        db.Integer,
        nullable=False,
        default=timestamp_actual
    )

# ============================================================
# DATOS INICIALES
# Crea planes, tarifas base, empresa demo y usuarios por defecto
# ============================================================

def crear_datos_iniciales():
    """
    Ejecutar después de db.create_all().

    Crea datos mínimos para pruebas:
    - Plan Básico
    - Plan Profesional
    - Plan Premium
    - Una tarifa base vacía para cada plan
    - Empresa demo
    - Usuario dueño
    - Usuario técnico
    - Usuario administrador global
    """

    # ---------------- PLAN BÁSICO ----------------

    plan_basico = Plan.query.filter_by(
        nombre='Básico'
    ).first()

    if not plan_basico:
        plan_basico = Plan(
            nombre='Básico',
            descripcion=(
                'GPS en tiempo real, sensores, botón de pánico, sirena, '
                'dashboard web, aplicación móvil, instalación y soporte.'
            ),
            tiene_gps=True,
            tiene_sensor_vibracion=True,
            tiene_sensor_puerta=True,
            tiene_boton_panico=True,
            tiene_sirena=True,
            tiene_dashboard_web=True,
            tiene_app_movil=True,
            tiene_fpga=False,
            tiene_camara=False,
            tiene_captura_evidencia=False,
            dias_retencion_gps=15,
            dias_retencion_alertas=90,
            dias_retencion_evidencias=None
        )

        db.session.add(plan_basico)
        db.session.flush()

    # ---------------- PLAN PROFESIONAL ----------------

    plan_profesional = Plan.query.filter_by(
        nombre='Profesional'
    ).first()

    if not plan_profesional:
        plan_profesional = Plan(
            nombre='Profesional',
            descripcion=(
                'Incluye todas las funciones del plan Básico y procesamiento '
                'FPGA Tang Nano 9K para monitoreo avanzado.'
            ),
            tiene_gps=True,
            tiene_sensor_vibracion=True,
            tiene_sensor_puerta=True,
            tiene_boton_panico=True,
            tiene_sirena=True,
            tiene_dashboard_web=True,
            tiene_app_movil=True,
            tiene_fpga=True,
            tiene_camara=False,
            tiene_captura_evidencia=False,
            dias_retencion_gps=90,
            dias_retencion_alertas=365,
            dias_retencion_evidencias=None
        )

        db.session.add(plan_profesional)
        db.session.flush()

    # ---------------- PLAN PREMIUM ----------------

    plan_premium = Plan.query.filter_by(
        nombre='Premium'
    ).first()

    if not plan_premium:
        plan_premium = Plan(
            nombre='Premium',
            descripcion=(
                'Incluye todas las funciones del plan Profesional, cámara de '
                'evidencia y captura automática de evidencia fotográfica.'
            ),
            tiene_gps=True,
            tiene_sensor_vibracion=True,
            tiene_sensor_puerta=True,
            tiene_boton_panico=True,
            tiene_sirena=True,
            tiene_dashboard_web=True,
            tiene_app_movil=True,
            tiene_fpga=True,
            tiene_camara=True,
            tiene_captura_evidencia=True,
            dias_retencion_gps=365,
            dias_retencion_alertas=730,
            dias_retencion_evidencias=180
        )

        db.session.add(plan_premium)
        db.session.flush()

    db.session.commit()

    # ---------------- TARIFAS BASE ----------------
    # Se crea una tarifa inicial de 1 unidad en adelante con valor 0.
    # Después el administrador podrá configurar rangos y precios reales.

    for plan in [plan_basico, plan_profesional, plan_premium]:

        tarifa_existente = TarifaPlan.query.filter_by(
            plan_id=plan.id,
            cantidad_minima=1,
            cantidad_maxima=None
        ).first()

        if not tarifa_existente:
            db.session.add(TarifaPlan(
                plan_id=plan.id,
                cantidad_minima=1,
                cantidad_maxima=None,
                precio_dispositivo=0,
                costo_instalacion=0,
                mensualidad=0,
                costo_mantenimiento=0,
                activo=True
            ))

    db.session.commit()

    # ---------------- EMPRESA DEMO ----------------

    empresa = Empresa.query.filter_by(
        nombre='Empresa Demo'
    ).first()

    if not empresa:
        empresa = Empresa(
            nombre='Empresa Demo',
            correo='empresa@demo.com',
            telefono='0000000000',
            direccion='Sin dirección',
            plan_id=(
                plan_profesional.id
                if plan_profesional
                else None
            )
        )

        db.session.add(empresa)
        db.session.commit()

    # ---------------- USUARIO DUEÑO ----------------

    if not Usuario.query.filter_by(
        correo='admin@gmail.com'
    ).first():

        db.session.add(Usuario(
            empresa_id=empresa.id,
            nombre='Dueño Demo',
            correo='admin@gmail.com',
            password=generar_hash_password('admin123'),
            tipo='dueno'
        ))

    # ---------------- USUARIO TÉCNICO ----------------

    if not Usuario.query.filter_by(
        correo='tecnico@gmail.com'
    ).first():

        db.session.add(Usuario(
            empresa_id=None,
            nombre='Técnico TrackSecurity',
            correo='tecnico@gmail.com',
            password=generar_hash_password('tecnico123'),
            tipo='tecnico'
        ))

    # ---------------- USUARIO ADMIN GLOBAL ----------------

    if not Usuario.query.filter_by(
        correo='superadmin@gmail.com'
    ).first():

        db.session.add(Usuario(
            empresa_id=None,
            nombre='Administrador Global',
            correo='superadmin@gmail.com',
            password=generar_hash_password('admin123'),
            tipo='admin'
        ))

    db.session.commit()