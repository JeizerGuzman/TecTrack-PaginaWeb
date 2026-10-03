# ============================================================
# DATOS INICIALES - TrackSecurity
# ============================================================

import json
from config import db
from models import (
    Plan,
    TarifaPlan,
    Empresa,
    Usuario,
    ConfiguracionSistema,
    Dispositivo,
    Vehiculo,
    UbicacionActual,
    Suscripcion,
    Recorrido,
    HistorialGPS,
    generar_hash_password,
    timestamp_actual
)

# ============================================================
# FUNCIÓN PRINCIPAL
# ============================================================
def crear_datos_iniciales(crear_datos_demo=True):
    print("\n============================================================")
    print("INICIALIZANDO DATOS BASE DE TRACKSECURITY")
    print("============================================================")

    try:
        planes = crear_planes_iniciales()
        crear_tarifas_base(planes)
        crear_configuracion_sistema()
        crear_admin_global()

        if crear_datos_demo:
            crear_datos_demostracion(planes)

        db.session.commit()
        print("✅ Datos iniciales verificados correctamente.")

    except Exception as error:
        db.session.rollback()
        print("❌ Error creando datos iniciales:")
        print(error)
        raise
    finally:
        print("============================================================\n")


# ============================================================
# PLANES Y TARIFAS
# ============================================================
def crear_planes_iniciales():
    planes_configuracion = [
        {
            "nombre": "Básico",
            "descripcion": "GPS en tiempo real, sensores, botón de pánico, sirena, dashboard web, aplicación móvil, instalación y soporte.",
            "tiene_gps": True, "tiene_sensor_vibracion": True, "tiene_sensor_puerta": True,
            "tiene_boton_panico": True, "tiene_sirena": True, "tiene_dashboard_web": True,
            "tiene_app_movil": True, "tiene_fpga": False, "tiene_camara": False,
            "tiene_captura_evidencia": False, "dias_retencion_gps": 15,
            "dias_retencion_alertas": 90, "dias_retencion_evidencias": None,
        },
        {
            "nombre": "Profesional",
            "descripcion": "Incluye Básico y procesamiento ESP32-S3 avanzado para monitoreo activo.",
            "tiene_gps": True, "tiene_sensor_vibracion": True, "tiene_sensor_puerta": True,
            "tiene_boton_panico": True, "tiene_sirena": True, "tiene_dashboard_web": True,
            "tiene_app_movil": True, "tiene_fpga": True, "tiene_camara": False,
            "tiene_captura_evidencia": False, "dias_retencion_gps": 90,
            "dias_retencion_alertas": 365, "dias_retencion_evidencias": None,
        },
        {
            "nombre": "Premium",
            "descripcion": "Incluye Profesional, cámara ESP32-CAM y captura automática de evidencia fotográfica.",
            "tiene_gps": True, "tiene_sensor_vibracion": True, "tiene_sensor_puerta": True,
            "tiene_boton_panico": True, "tiene_sirena": True, "tiene_dashboard_web": True,
            "tiene_app_movil": True, "tiene_fpga": True, "tiene_camara": True,
            "tiene_captura_evidencia": True, "dias_retencion_gps": 365,
            "dias_retencion_alertas": 730, "dias_retencion_evidencias": 180,
        },
    ]

    planes_creados = {}
    for datos_plan in planes_configuracion:
        plan = Plan.query.filter_by(nombre=datos_plan["nombre"]).first()
        if not plan:
            plan = Plan(**datos_plan)
            db.session.add(plan)
            db.session.flush()
            print(f"➕ Plan creado: {plan.nombre}")
        planes_creados[plan.nombre] = plan
    return planes_creados


def crear_tarifas_base(planes):
    for plan in planes.values():
        tarifa_existente = TarifaPlan.query.filter_by(plan_id=plan.id, cantidad_minima=1, cantidad_maxima=None).first()
        if not tarifa_existente:
            tarifa = TarifaPlan(plan_id=plan.id, cantidad_minima=1, cantidad_maxima=None,
                                precio_dispositivo=0, costo_instalacion=0, mensualidad=0, costo_mantenimiento=0)
            db.session.add(tarifa)


# ============================================================
# CONFIGURACIÓN Y ADMINISTRADOR GLOBAL
# ============================================================
def crear_configuracion_sistema():
    configuracion = db.session.get(ConfiguracionSistema, 1)
    if not configuracion:
        configuracion = ConfiguracionSistema(id=1, nombre_plataforma="TrackSecurity")
        db.session.add(configuracion)
        db.session.flush()
    return configuracion


def crear_admin_global():
    correo = "jeizerguzchable@gmail.com"
    usuario = Usuario.query.filter_by(correo=correo).first()
    if not usuario:
        usuario = Usuario(empresa_id=None, nombre="Jeizer Guzmán", correo=correo,
                          password=generar_hash_password("jeizer123"), tipo="admin", activo=True)
        db.session.add(usuario)
    return usuario


# ============================================================
# ORQUESTADOR DE DEMOSTRACIÓN
# ============================================================
def crear_datos_demostracion(planes):
    plan_premium = planes.get("Premium")
    
    empresa = crear_empresa_demo(plan_premium)
    crear_dueno_demo(empresa)
    crear_supervisor_demo(empresa)
    tecnico = crear_tecnico_demo()
    
    # Inyección de nueva operatividad
    choferes = crear_choferes_demo(empresa)
    dispositivos = crear_dispositivos_demo(empresa, tecnico)
    crear_vehiculos_demo(empresa, choferes, dispositivos)
    crear_suscripcion_demo(empresa, plan_premium)
    crear_recorridos_demo(empresa, choferes, dispositivos)


# ============================================================
# EMPRESA Y USUARIOS DEMO
# ============================================================
def crear_empresa_demo(plan_premium):
    empresa = Empresa.query.filter_by(nombre="Empresa Demo").first()
    if not empresa:
        empresa = Empresa(nombre="Empresa Demo", correo="empresa@demo.com", telefono="9610000000",
                          direccion="Tuxtla Gutiérrez, Chiapas", plan_id=plan_premium.id if plan_premium else None)
        db.session.add(empresa)
        db.session.flush()
    return empresa

def crear_dueno_demo(empresa):
    correo = "fersanvilla@gmail.com"
    if not Usuario.query.filter_by(correo=correo).first():
        db.session.add(Usuario(empresa_id=empresa.id, nombre="Fernando Sanchez Villanueva", correo=correo,
                               password=generar_hash_password("fer123"), tipo="dueno", activo=True))

def crear_supervisor_demo(empresa):
    correo = "supervisor@gmail.com"
    if not Usuario.query.filter_by(correo=correo).first():
        db.session.add(Usuario(empresa_id=empresa.id, nombre="Supervisor Demo", correo=correo,
                               password=generar_hash_password("supervisor123"), tipo="supervisor", activo=True))

def crear_tecnico_demo():
    correo = "tecnico@gmail.com"
    usuario = Usuario.query.filter_by(correo=correo).first()
    if not usuario:
        usuario = Usuario(empresa_id=None, nombre="Técnico TrackSecurity", correo=correo,
                          password=generar_hash_password("tecnico123"), tipo="tecnico", activo=True)
        db.session.add(usuario)
        db.session.flush()
    return usuario


# ============================================================
# CHOFERES Y DISPOSITIVOS
# ============================================================
def crear_choferes_demo(empresa):
    datos_choferes = [
        {"nombre": "Brayam Rios Garcia", "correo": "brayam@demo.com", "telefono": "9611653755"},
        {"nombre": "Rodrigo Gonzalez Lopez", "correo": "rodrigo@demo.com", "telefono": "9612999908"}
    ]
    
    choferes_creados = []
    for c in datos_choferes:
        chofer = Usuario.query.filter_by(correo=c["correo"]).first()
        if not chofer:
            chofer = Usuario(empresa_id=empresa.id, nombre=c["nombre"], correo=c["correo"],
                             password=generar_hash_password("chofer123"), tipo="chofer", 
                             telefono=c["telefono"], activo=True)
            db.session.add(chofer)
            db.session.flush()
        choferes_creados.append(chofer)
    return choferes_creados

def crear_dispositivos_demo(empresa, tecnico):
    dispositivos_creados = []
    
    # 4 Dispositivos Premium ACTIVOS asignados a la empresa
    for i in range(1, 5):
        serie = f"TS-00000{i}"
        disp = Dispositivo.query.filter_by(serie=serie).first()
        if not disp:
            disp = Dispositivo(
                empresa_id=empresa.id, serie=serie, imei=f"86012345678900{i}",
                pin_activacion=f"100{i}", modelo="Premium", firmware="v2.1.0-esp32s3",
                estado="activo", ultima_conexion=timestamp_actual(), fecha_instalacion=timestamp_actual(),
                fecha_activacion=timestamp_actual(), instalado_por=tecnico.id
            )
            db.session.add(disp)
            db.session.flush()
        dispositivos_creados.append(disp)

    # 1 Dispositivo Premium DISPONIBLE (Inventario Libre)
    disp_libre = Dispositivo.query.filter_by(serie="TS-999999").first()
    if not disp_libre:
        disp_libre = Dispositivo(
            empresa_id=None, serie="TS-999999", imei="860987654321099",
            pin_activacion="9999", modelo="Premium", firmware="v2.1.0-esp32s3", estado="disponible"
        )
        db.session.add(disp_libre)
        db.session.flush()
        
    return dispositivos_creados


# ============================================================
# VEHÍCULOS, TELEMETRÍA Y SUSCRIPCIÓN
# ============================================================
def crear_vehiculos_demo(empresa, choferes, dispositivos):
    marcas = ["Kenworth T680", "Freightliner Cascadia", "Volvo VNL", "International LT"]
    placas = ["CW-8924-A", "DB-1122-B", "XC-3344-C", "YZ-5566-D"]
    
    # Coordenadas realistas de descanso (Tuxtla, Libramiento Sur, Base, etc)
    ubicaciones = [
        [16.746182, -93.078426], # Diana Cazadora
        [16.755457, -93.123282], # Marimba
        [16.753896, -93.143093], # Plaza Crystal
        [16.726532, -93.029875]  # Chiapa de Corzo puente
    ]

    for i in range(4):
        identificador = f"CAM-00{i+1}"
        vehiculo = Vehiculo.query.filter_by(identificador=identificador).first()
        
        # Asignamos Brayam al CAM-001 y Rodrigo al CAM-002. Los demás sin chofer fijo.
        chofer_asignado = choferes[i].id if i < 2 else None
        
        if not vehiculo:
            vehiculo = Vehiculo(
                empresa_id=empresa.id, nombre=f"Tractocamión {marcas[i]}", identificador=identificador,
                placa=placas[i], marca=marcas[i].split()[0], modelo=marcas[i].split()[1], anio=2024,
                chofer_id=chofer_asignado, dispositivo_id=dispositivos[i].id,
                estado_instalacion="instalado", activo=True
            )
            db.session.add(vehiculo)
            db.session.flush()

            # Posición en el mapa
            ubicacion = UbicacionActual(
                vehiculo_id=vehiculo.id, lat=ubicaciones[i][0], lng=ubicaciones[i][1],
                velocidad=0.0, estado="detenido", puerta="cerrada", vibracion=0, alerta=0,
                ultima_actualizacion=timestamp_actual()
            )
            db.session.add(ubicacion)


def crear_suscripcion_demo(empresa, plan):
    if not Suscripcion.query.filter_by(empresa_id=empresa.id).first():
        db.session.add(Suscripcion(
            empresa_id=empresa.id, plan_id=plan.id, cantidad_vehiculos=10,
            precio_dispositivo_unitario=10000.0, costo_instalacion_unitario=0.0,
            mensualidad_unitaria=299.0, costo_mantenimiento_unitario=0.0,
            monto_dispositivos_total=100000.0, monto_mensual=2990.0,
            estado="activa", fecha_inicio=timestamp_actual()
        ))


# ============================================================
# RUTAS REALES TERMINADAS
# ============================================================
def crear_recorridos_demo(empresa, choferes, dispositivos):
    """
    Genera 3 rutas históricas completadas con coordenadas exactas 
    sobre carreteras para evitar que las líneas crucen casas.
    """
    if Recorrido.query.filter_by(estado="finalizado").first():
        return # Ya existen rutas, no duplicamos

    # 1. Tuxtla (Av. Central) - Muy precisa sobre calle
    ruta_tuxtla = [
    [16.754861, -93.123482],
    [16.754913, -93.123817],
    [16.754929, -93.123898],
    [16.754859, -93.12391],
    [16.754985, -93.12479],
    [16.755018, -93.125729],
    [16.754988, -93.125784],
    [16.754963, -93.126086],
    [16.754931, -93.126472],
    [16.754882, -93.127388],
    [16.754896, -93.127626],
    [16.754913, -93.127714],
    [16.75489, -93.127981],
    [16.754727, -93.128881],
    [16.754695, -93.129279],
    [16.754536, -93.130187],
    [16.754425, -93.130873],
    [16.754383, -93.131124],
    [16.754254, -93.13195],
    [16.754297, -93.131947],
    [16.754284, -93.132061],
    [16.754315, -93.132661],
    [16.754416, -93.133891],
    [16.754431, -93.134233],
    [16.754445, -93.134496],
    [16.754456, -93.134672],
    [16.754492, -93.134733],
    [16.754501, -93.134841],
    [16.754475, -93.134933],
    [16.754476, -93.13501],
    [16.754531, -93.135642],
    [16.754583, -93.136279],
    [16.754619, -93.136709],
    [16.754683, -93.137857],
    [16.754686, -93.137961],
    [16.754723, -93.138026],
    [16.754727, -93.138148],
    [16.754692, -93.138187],
    [16.754715, -93.138432],
    [16.754746, -93.138737],
    [16.754812, -93.139601],
    [16.754827, -93.139926],
    [16.754879, -93.140638],
    [16.75492, -93.140707],
    [16.754929, -93.140812],
    [16.754898, -93.140899],
    [16.754903, -93.140947],
    [16.754909, -93.14104],
    [16.754944, -93.141626],
    [16.75497, -93.141955],
    [16.755012, -93.142641],
    [16.75511, -93.143774],
    [16.75515, -93.144302],
    [16.75512, -93.144306],
    [16.755162, -93.144976],
    [16.755207, -93.145652],
    [16.755218, -93.14582],
    [16.75524, -93.146045],
    [16.755273, -93.146375],
    [16.755278, -93.146513],
    [16.755284, -93.14659],
    [16.755292, -93.14677],
    [16.755322, -93.147078],
    [16.755428, -93.148376],
    [16.755441, -93.148614],
    [16.755478, -93.149275],
    [16.755557, -93.150573],
    [16.755646, -93.150618],
    [16.75557, -93.150697],
    [16.75545, -93.150736],
    [16.755437, -93.150592],
    [16.755371, -93.149405]
    ]
    
    # 2. Tuxtla a Chiapa de Corzo (Carretera Panamericana)
    ruta_chiapa = ruta_chiapa = [
        [16.746095, -93.078469], [16.746309, -93.079763], [16.74671, -93.079726], [16.746832, -93.079713], 
        [16.746936, -93.079912], [16.747033, -93.079997], [16.747252, -93.080084], [16.748328, -93.079857], 
        [16.749141, -93.079681], [16.750012, -93.079498], [16.750029, -93.079424], [16.750085, -93.079367], 
        [16.749948, -93.077967], [16.74991, -93.077568], [16.7499, -93.077467], [16.750469, -93.077383], 
        [16.751149, -93.077305], [16.75193, -93.077205], [16.752287, -93.077151], [16.752335, -93.077043], 
        [16.752336, -93.07697], [16.75227, -93.076891], [16.752219, -93.076825], [16.752026, -93.076372], 
        [16.751715, -93.075941], [16.751525, -93.075724], [16.751251, -93.075434], [16.750691, -93.075126], 
        [16.750583, -93.075031], [16.750489, -93.074879], [16.750405, -93.074541], [16.750356, -93.074332], 
        [16.750313, -93.074147], [16.750073, -93.073754], [16.749669, -93.073192], [16.749181, -93.072496], 
        [16.749081, -93.072372], [16.748682, -93.071838], [16.748215, -93.071208], [16.748148, -93.071123], 
        [16.747496, -93.070155], [16.747071, -93.069543], [16.746428, -93.06865], [16.746401, -93.068613], 
        [16.746373, -93.068574], [16.745889, -93.067936], [16.745829, -93.067849], [16.745773, -93.067763], 
        [16.745291, -93.067081], [16.744967, -93.066658], [16.744731, -93.066408], [16.744052, -93.066025], 
        [16.743791, -93.065892], [16.743497, -93.065747], [16.74332, -93.06564], [16.743423, -93.065481], 
        [16.743604, -93.065318], [16.743821, -93.065164], [16.743822, -93.06509], [16.743476, -93.064748], 
        [16.743288, -93.064284], [16.743196, -93.064115], [16.742625, -93.063312], [16.742563, -93.063092], 
        [16.742528, -93.062992], [16.74222, -93.062577], [16.742169, -93.062461], [16.742114, -93.062382], 
        [16.74186, -93.062142], [16.741731, -93.061873], [16.741596, -93.06164], [16.741474, -93.061539], 
        [16.741325, -93.061278], [16.741223, -93.061163], [16.741127, -93.061069], [16.740852, -93.060726], 
        [16.740576, -93.060375], [16.740426, -93.060223], [16.740314, -93.060083], [16.740176, -93.059848], 
        [16.73998, -93.059232], [16.7399, -93.059077], [16.739607, -93.058665], [16.739329, -93.058257], 
        [16.739087, -93.05789], [16.738907, -93.057647], [16.738811, -93.057518], [16.738599, -93.057251], 
        [16.738288, -93.056772], [16.737944, -93.056248], [16.737762, -93.056064], [16.737508, -93.05575], 
        [16.737236, -93.05531], [16.736935, -93.054886], [16.738248, -93.053806], [16.738598, -93.053506], 
        [16.738618, -93.053403], [16.73893, -93.053071], [16.739249, -93.052772], [16.739582, -93.052498], 
        [16.739893, -93.052237], [16.739488, -93.051634], [16.739614, -93.051502], [16.73973, -93.051415], 
        [16.73991, -93.05127], [16.74011, -93.051083], [16.740246, -93.050985], [16.740408, -93.050837], 
        [16.740001, -93.050297], [16.739993, -93.050243], [16.740109, -93.05013], [16.740157, -93.050069], 
        [16.739626, -93.049568], [16.739948, -93.049272], [16.74013, -93.049138], [16.740279, -93.04904], 
        [16.740688, -93.048768], [16.7409, -93.048605], [16.741064, -93.048415], [16.741348, -93.048048], 
        [16.741638, -93.047693], [16.741912, -93.047339], [16.742189, -93.046987], [16.741939, -93.046773], 
        [16.741555, -93.046465], [16.742122, -93.045709], [16.741776, -93.045389], [16.742311, -93.044641], 
        [16.742009, -93.044307], [16.741988, -93.044286], [16.741637, -93.043944], [16.741249, -93.043614], 
        [16.740889, -93.043305], [16.740493, -93.042942], [16.740166, -93.042656], [16.739942, -93.042418], 
        [16.739615, -93.04211], [16.739425, -93.04195], [16.739079, -93.041638], [16.739225, -93.04135], 
        [16.739333, -93.041178], [16.739595, -93.040918], [16.739455, -93.040771], [16.739384, -93.040716], 
        [16.738922, -93.040257], [16.738584, -93.039958], [16.738235, -93.039658], [16.738104, -93.039564], 
        [16.737945, -93.040022], [16.737846, -93.039989], [16.737929, -93.039688], [16.737978, -93.039538], 
        [16.738033, -93.039136], [16.738223, -93.038542], [16.73829, -93.038392], [16.73843, -93.038095], 
        [16.738599, -93.037791], [16.738675, -93.037465], [16.73896, -93.036841], [16.739042, -93.036725], 
        [16.739242, -93.036498], [16.739421, -93.036373], [16.739524, -93.03633], [16.739676, -93.036293], 
        [16.740008, -93.036255], [16.740267, -93.036231], [16.740595, -93.036116], [16.740785, -93.036], 
        [16.741082, -93.035779], [16.741272, -93.035579], [16.74163, -93.035374], [16.742112, -93.036191], 
        [16.742257, -93.036393], [16.742379, -93.035886], [16.742506, -93.03545], [16.742846, -93.03412], 
        [16.742887, -93.03386], [16.742889, -93.033723], [16.742884, -93.033315], [16.742851, -93.033037], 
        [16.742635, -93.032216], [16.742319, -93.031117], [16.74199, -93.02989], [16.741697, -93.029225], 
        [16.7415, -93.028922], [16.741367, -93.028724], [16.741042, -93.028329], [16.740574, -93.027802], 
        [16.7403, -93.027436], [16.740137, -93.027171], [16.739989, -93.026838], [16.739908, -93.026579], 
        [16.739843, -93.026306], [16.739506, -93.024494], [16.739465, -93.023955], [16.739483, -93.023609], 
        [16.739573, -93.023048], [16.739759, -93.022267], [16.739847, -93.021783], [16.739854, -93.021288], 
        [16.739835, -93.021063], [16.739749, -93.020678], [16.739627, -93.020383], [16.739395, -93.019985], 
        [16.739066, -93.019625], [16.738696, -93.019314], [16.738322, -93.019055], [16.737387, -93.02009], 
        [16.736825, -93.019697], [16.736634, -93.01954], [16.736376, -93.019328], [16.735919, -93.019046], 
        [16.735685, -93.018948], [16.735597, -93.018948], [16.735476, -93.018948], [16.734793, -93.018947], 
        [16.734094, -93.018974], [16.73367, -93.018952], [16.733362, -93.018915], [16.732516, -93.018344], 
        [16.732366, -93.01825], [16.73224, -93.018236], [16.732093, -93.018292], [16.731577, -93.018512], 
        [16.731228, -93.018861], [16.731151, -93.018884], [16.731057, -93.018869], [16.73079, -93.018656], 
        [16.730306, -93.018378], [16.730044, -93.01826], [16.729914, -93.018236], [16.729671, -93.018229], 
        [16.729008, -93.018263], [16.728579, -93.018244], [16.727325, -93.018593], [16.726492, -93.018967], 
        [16.725474, -93.019404], [16.725148, -93.019505], [16.723867, -93.019742], [16.723642, -93.019798], 
        [16.722254, -93.020371], [16.721219, -93.020776], [16.720456, -93.021079], [16.720317, -93.02113], 
        [16.719894, -93.021297], [16.719042, -93.02135], [16.718186, -93.021425], [16.718122, -93.021369], 
        [16.717979, -93.020875], [16.717883, -93.020594], [16.717829, -93.020525], [16.717688, -93.020536], 
        [16.717566, -93.020517], [16.717484, -93.02041], [16.717241, -93.019556], [16.71714, -93.018915], 
        [16.716667, -93.018948], [16.716132, -93.018987], [16.714971, -93.01907], [16.714809, -93.019068], 
        [16.714667, -93.019041], [16.714433, -93.018921], [16.714451, -93.019172], [16.714546, -93.019389], 
        [16.714986, -93.020572], [16.715411, -93.020401]
    ]

    # 3. Villahermosa (Paseo Tabasco local)
    ruta_villa = ruta_villa = [
        [18.004347, -92.95183], [18.004347, -92.95183], [18.004348, -92.951801], [18.004427, -92.95173], 
        [18.004085, -92.951225], [18.003725, -92.950667], [18.003604, -92.950724], [18.003582, -92.950713], 
        [18.003496, -92.950567], [18.003416, -92.950431], [18.00341, -92.950398], [18.00342, -92.950368], 
        [18.003494, -92.950309], [18.003333, -92.950065], [18.00298, -92.949557], [18.002696, -92.949199], 
        [18.002553, -92.948997], [18.002148, -92.948358], [18.001916, -92.947939], [18.001862, -92.94786], 
        [18.001666, -92.947554], [18.001564, -92.947392], [18.001467, -92.947367], [18.001386, -92.947309], 
        [18.001301, -92.947191], [18.001168, -92.946976], [18.001133, -92.946929], [18.000866, -92.946533], 
        [18.000362, -92.945795], [18.000238, -92.945607], [17.999923, -92.945282], [17.999859, -92.94519], 
        [17.999638, -92.944742], [17.999092, -92.94392], [17.999015, -92.94382], [17.998957, -92.943763], 
        [17.998877, -92.943713], [17.998787, -92.943676], [17.998688, -92.943604], [17.998621, -92.943502], 
        [17.998576, -92.943366], [17.998535, -92.943234], [17.998481, -92.943038], [17.998406, -92.942889], 
        [17.997961, -92.942214], [17.997823, -92.941811], [17.997501, -92.941384], [17.997401, -92.941328], 
        [17.997408, -92.94123], [17.997322, -92.941064], [17.997203, -92.940709], [17.99703, -92.940446], 
        [17.996823, -92.94014], [17.995676, -92.938462], [17.995118, -92.93763], [17.994872, -92.937262], 
        [17.994813, -92.937277], [17.994759, -92.937272], [17.994596, -92.937216], [17.994488, -92.937205], 
        [17.994311, -92.93718], [17.994172, -92.937054], [17.993552, -92.936195], [17.993259, -92.935859], 
        [17.992963, -92.935588], [17.992791, -92.935981], [17.992595, -92.93588], [17.991895, -92.935553], 
        [17.990965, -92.935128], [17.990031, -92.934711], [17.989585, -92.934517], [17.989353, -92.934413], 
        [17.989048, -92.934275], [17.988772, -92.934898], [17.988395, -92.934577], [17.987895, -92.93416], 
        [17.987798, -92.934079], [17.986788, -92.933273], [17.987019, -92.932743], [17.985203, -92.931304], 
        [17.985964, -92.930553], [17.986002, -92.930438], [17.985966, -92.930326], [17.985942, -92.930296], 
        [17.985878, -92.930266], [17.985757, -92.930257], [17.985718, -92.930243], [17.98569, -92.930205], 
        [17.985683, -92.930263], [17.985657, -92.930306], [17.984999, -92.930823]
    ]

    # Vehiculos a usar (CAM-001 y CAM-002)
    v1 = Vehiculo.query.filter_by(identificador="CAM-001").first()
    v2 = Vehiculo.query.filter_by(identificador="CAM-002").first()

    rutas_crear = [
        {
            "vehiculo": v1, "chofer": choferes[0], "origen": "Parque de la Marimba, Tuxtla Gutiérrez", 
            "destino": "Plaza Crystal, Tuxtla Gutiérrez", "coordenadas": ruta_tuxtla, "dist": 3.2, "dur": 15
        },
        {
            "vehiculo": v2, "chofer": choferes[1], "origen": "Diana Cazadora, Tuxtla Gutiérrez", 
            "destino": "Entrada Chiapa de Corzo", "coordenadas": ruta_chiapa, "dist": 14.5, "dur": 22
        },
        {
            "vehiculo": v1, "chofer": choferes[0], "origen": "Parque La Choca, Villahermosa", 
            "destino": "Catedral, Villahermosa", "coordenadas": ruta_villa, "dist": 2.8, "dur": 12
        }
    ]

    for r in rutas_crear:
        if not r["vehiculo"]: continue
        
        # Guardamos el JSON convertido a texto como lo espera Leaflet/OSRM
        ruta_str = json.dumps(r["coordenadas"])
        
        inicio = r["coordenadas"][0]
        fin = r["coordenadas"][-1]

        recorrido = Recorrido(
            vehiculo_id=r["vehiculo"].id, chofer_id=r["chofer"].id,
            origen_nombre=r["origen"], origen_coordenadas=f"{inicio[0]},{inicio[1]}",
            destino_nombre=r["destino"], destino_coordenadas=f"{fin[0]},{fin[1]}",
            coordenadas_fin=f"{fin[0]},{fin[1]}",
            ruta_corregida=ruta_str,
            distancia_estimada=r["dist"], distancia_real=r["dist"],
            duracion_estimada=r["dur"], duracion_real=r["dur"] * 60,
            estado="finalizado", fecha_inicio=timestamp_actual() - 3600, fecha_fin=timestamp_actual()
        )
        db.session.add(recorrido)