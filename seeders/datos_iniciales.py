# ============================================================
# DATOS INICIALES - TrackSecurity
# ============================================================
#
# Datos que siempre se crean:
#
# - Planes.
# - Tarifas base.
# - Configuración global.
# - Administrador global.
#
# Datos opcionales de demostración:
#
# - Empresa Demo.
# - Dueño Demo.
# - Supervisor Demo.
# - Técnico Demo.
#
# La lógica es idempotente:
#
# - si un registro ya existe, no lo duplica;
# - si falta, lo crea;
# - puede ejecutarse cada vez que inicia Flask.
#
# ============================================================

from config import db

from models import (
    Plan,
    TarifaPlan,
    Empresa,
    Usuario,
    ConfiguracionSistema,
    generar_hash_password,
)


# ============================================================
# FUNCIÓN PRINCIPAL
# ============================================================

def crear_datos_iniciales(
    crear_datos_demo=True
):
    """
    Crea los datos mínimos necesarios de TrackSecurity.

    Datos obligatorios:
    - Plan Básico.
    - Plan Profesional.
    - Plan Premium.
    - Tarifa base para cada plan.
    - Configuración global del sistema.
    - Administrador global.

    Datos opcionales de demostración:
    - Empresa Demo.
    - Dueño Demo.
    - Supervisor Demo.
    - Técnico Demo.
    """

    print(
        "\n"
        "============================================================"
    )

    print(
        "INICIALIZANDO DATOS BASE DE TRACKSECURITY"
    )

    print(
        "============================================================"
    )


    try:

        planes = crear_planes_iniciales()

        crear_tarifas_base(
            planes
        )

        crear_configuracion_sistema()

        crear_admin_global()


        if crear_datos_demo:

            crear_datos_demostracion(
                planes
            )

        db.session.commit()


        print(
            "✅ Datos iniciales verificados correctamente."
        )


    except Exception as error:

        db.session.rollback()


        print(
            "❌ Error creando datos iniciales:"
        )

        print(error)


        raise


    finally:

        print(
            "============================================================"
        )

        print()


# ============================================================
# PLANES
# ============================================================

def crear_planes_iniciales():

    planes_configuracion = [

        {
            "nombre":
                "Básico",

            "descripcion":
                (
                    "GPS en tiempo real, sensores, botón de "
                    "pánico, sirena, dashboard web, aplicación "
                    "móvil, instalación y soporte."
                ),

            "tiene_gps":
                True,

            "tiene_sensor_vibracion":
                True,

            "tiene_sensor_puerta":
                True,

            "tiene_boton_panico":
                True,

            "tiene_sirena":
                True,

            "tiene_dashboard_web":
                True,

            "tiene_app_movil":
                True,

            "tiene_fpga":
                False,

            "tiene_camara":
                False,

            "tiene_captura_evidencia":
                False,

            "dias_retencion_gps":
                15,

            "dias_retencion_alertas":
                90,

            "dias_retencion_evidencias":
                None,
        },


        {
            "nombre":
                "Profesional",

            "descripcion":
                (
                    "Incluye todas las funciones del plan "
                    "Básico y procesamiento FPGA Tang Nano 9K "
                    "para monitoreo avanzado."
                ),

            "tiene_gps":
                True,

            "tiene_sensor_vibracion":
                True,

            "tiene_sensor_puerta":
                True,

            "tiene_boton_panico":
                True,

            "tiene_sirena":
                True,

            "tiene_dashboard_web":
                True,

            "tiene_app_movil":
                True,

            "tiene_fpga":
                True,

            "tiene_camara":
                False,

            "tiene_captura_evidencia":
                False,

            "dias_retencion_gps":
                90,

            "dias_retencion_alertas":
                365,

            "dias_retencion_evidencias":
                None,
        },


        {
            "nombre":
                "Premium",

            "descripcion":
                (
                    "Incluye todas las funciones del plan "
                    "Profesional, cámara de evidencia y captura "
                    "automática de evidencia fotográfica."
                ),

            "tiene_gps":
                True,

            "tiene_sensor_vibracion":
                True,

            "tiene_sensor_puerta":
                True,

            "tiene_boton_panico":
                True,

            "tiene_sirena":
                True,

            "tiene_dashboard_web":
                True,

            "tiene_app_movil":
                True,

            "tiene_fpga":
                True,

            "tiene_camara":
                True,

            "tiene_captura_evidencia":
                True,

            "dias_retencion_gps":
                365,

            "dias_retencion_alertas":
                730,

            "dias_retencion_evidencias":
                180,
        },

    ]


    planes_creados = {}


    for datos_plan in planes_configuracion:

        plan = Plan.query.filter_by(
            nombre=datos_plan[
                "nombre"
            ]
        ).first()


        if not plan:

            plan = Plan(
                **datos_plan
            )


            db.session.add(
                plan
            )


            db.session.flush()


            print(
                "➕ Plan creado:",
                plan.nombre
            )


        else:

            print(
                "✔ Plan existente:",
                plan.nombre
            )


        planes_creados[
            plan.nombre
        ] = plan


    return planes_creados


# ============================================================
# TARIFAS BASE
# ============================================================

def crear_tarifas_base(
    planes
):

    for plan in planes.values():

        tarifa_existente = (

            TarifaPlan.query

            .filter_by(
                plan_id=plan.id,
                cantidad_minima=1,
                cantidad_maxima=None,
            )

            .first()

        )


        if tarifa_existente:

            print(
                "✔ Tarifa base existente:",
                plan.nombre
            )

            continue


        tarifa = TarifaPlan(

            plan_id=
                plan.id,

            cantidad_minima=
                1,

            cantidad_maxima=
                None,

            precio_dispositivo=
                0,

            costo_instalacion=
                0,

            mensualidad=
                0,

            costo_mantenimiento=
                0,

            activo=
                True,

        )


        db.session.add(
            tarifa
        )


        print(
            "➕ Tarifa base creada:",
            plan.nombre
        )


# ============================================================
# CONFIGURACIÓN GLOBAL
# ============================================================

def crear_configuracion_sistema():

    configuracion = db.session.get(
        ConfiguracionSistema,
        1
    )


    if configuracion:

        print(
            "✔ Configuración global existente."
        )

        return configuracion


    configuracion = ConfiguracionSistema(

        id=1,


        # General

        nombre_plataforma=
            "TrackSecurity",

        correo_soporte=
            None,

        telefono_soporte=
            None,


        # Monitoreo

        segundos_sin_senal=
            60,


        # Alertas

        segundos_separacion_alertas=
            10,


        # Panel administrador

        refresh_admin_dashboard_segundos=
            30,

        refresh_admin_empresas_segundos=
            30,

        refresh_admin_suscripciones_segundos=
            30,

        refresh_admin_planes_segundos=
            30,

        refresh_admin_usuarios_segundos=
            30,

        refresh_admin_vehiculos_segundos=
            10,

        refresh_admin_detalle_vehiculo_segundos=
            5,

        refresh_admin_dispositivos_segundos=
            10,

        refresh_admin_servicios_segundos=
            30,

        refresh_admin_alertas_segundos=
            5,


        # Dueño / supervisor

        refresh_operacion_dashboard_segundos=
            5,

        refresh_operacion_vehiculos_segundos=
            5,

        refresh_operacion_detalle_vehiculo_segundos=
            3,

        refresh_operacion_alertas_segundos=
            5,

        refresh_operacion_monitoreo_segundos=
            3,


        # GPS / Telemetría

        ubicacion_actual_segundos=
            3,

        historial_gps_segundos=
            30,

        guardar_gps_inmediato_alerta=
            True,

        distancia_minima_gps_metros=
            15,

        velocidad_minima_kmh=
            1.0,

        geocodificacion_direccion_segundos=
            120,

        distancia_minima_direccion_metros=
            50,

    )


    db.session.add(
        configuracion
    )


    db.session.flush()


    print(
        "➕ Configuración global creada."
    )


    return configuracion


# ============================================================
# DATOS DE DEMOSTRACIÓN
# ============================================================

def crear_datos_demostracion(
    planes
):

    plan_profesional = (
        planes.get(
            "Profesional"
        )
    )


    empresa = crear_empresa_demo(
        plan_profesional
    )


    crear_dueno_demo(
        empresa
    )


    crear_supervisor_demo(
        empresa
    )


    crear_tecnico_demo()



# ============================================================
# EMPRESA DEMO
# ============================================================

def crear_empresa_demo(
    plan_profesional
):

    empresa = (

        Empresa.query

        .filter_by(
            nombre="Empresa Demo"
        )

        .first()

    )


    if empresa:

        print(
            "✔ Empresa demo existente."
        )

        return empresa


    empresa = Empresa(

        nombre=
            "Empresa Demo",

        correo=
            "empresa@demo.com",

        telefono=
            "0000000000",

        direccion=
            "Sin dirección",

        plan_id=(
            plan_profesional.id
            if plan_profesional
            else None
        ),

    )


    db.session.add(
        empresa
    )


    db.session.flush()


    print(
        "➕ Empresa demo creada."
    )


    return empresa


# ============================================================
# DUEÑO DEMO
# ============================================================

def crear_dueno_demo(
    empresa
):

    correo = (
        "fersanvilla@gmail.com"
    )


    usuario = Usuario.query.filter_by(
        correo=correo
    ).first()


    if usuario:

        print(
            "✔ Dueño demo existente."
        )

        return usuario


    usuario = Usuario(

        empresa_id=
            empresa.id,

        nombre=
            "Fernando Sanchez Villanueva",

        correo=
            correo,

        password=
            generar_hash_password(
                "fer123"
            ),

        tipo=
            "dueno",

        activo=
            True,

    )


    db.session.add(
        usuario
    )


    print(
        "➕ Dueño demo creado."
    )


    return usuario


# ============================================================
# SUPERVISOR DEMO
# ============================================================

def crear_supervisor_demo(
    empresa
):

    correo = (
        "supervisor@gmail.com"
    )


    usuario = Usuario.query.filter_by(
        correo=correo
    ).first()


    if usuario:

        print(
            "✔ Supervisor demo existente."
        )

        return usuario


    usuario = Usuario(

        empresa_id=
            empresa.id,

        nombre=
            "Supervisor Demo",

        correo=
            correo,

        password=
            generar_hash_password(
                "supervisor123"
            ),

        tipo=
            "supervisor",

        activo=
            True,

    )


    db.session.add(
        usuario
    )


    print(
        "➕ Supervisor demo creado."
    )


    return usuario


# ============================================================
# TÉCNICO DEMO
# ============================================================

def crear_tecnico_demo():

    correo = (
        "tecnico@gmail.com"
    )


    usuario = Usuario.query.filter_by(
        correo=correo
    ).first()


    if usuario:

        print(
            "✔ Técnico demo existente."
        )

        return usuario


    usuario = Usuario(

        empresa_id=
            None,

        nombre=
            "Técnico TrackSecurity",

        correo=
            correo,

        password=
            generar_hash_password(
                "tecnico123"
            ),

        tipo=
            "tecnico",

        activo=
            True,

    )


    db.session.add(
        usuario
    )


    print(
        "➕ Técnico demo creado."
    )


    return usuario


# ============================================================
# ADMINISTRADOR GLOBAL
# ============================================================

def crear_admin_global():

    correo = (
        "jeizerguzchable@gmail.com"
    )


    usuario = Usuario.query.filter_by(
        correo=correo
    ).first()


    if usuario:

        print(
            "✔ Administrador global existente."
        )

        return usuario


    usuario = Usuario(

        empresa_id=
            None,

        nombre=
            "Jeizer Guzmán",

        correo=
            correo,

        password=
            generar_hash_password(
                "jeizer123"
            ),

        tipo=
            "admin",

        activo=
            True,

    )


    db.session.add(
        usuario
    )


    print(
        "➕ Administrador global creado."
    )


    return usuario