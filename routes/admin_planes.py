from flask import jsonify, request
from flask_jwt_extended import jwt_required
from config import db
from decorators import rol_requerido
from models import Plan, TarifaPlan

# ============================================================
# FUNCIONES AUXILIARES
# ============================================================
def serializar_plan_admin(plan):
    total_tarifas = TarifaPlan.query.filter_by(plan_id=plan.id).count()
    tarifas_activas = TarifaPlan.query.filter_by(plan_id=plan.id, activo=True).count()
    return {
        "id": plan.id, "nombre": plan.nombre, "descripcion": plan.descripcion,
        "tiene_gps": bool(plan.tiene_gps), "tiene_sensor_vibracion": bool(plan.tiene_sensor_vibracion),
        "tiene_sensor_puerta": bool(plan.tiene_sensor_puerta), "tiene_boton_panico": bool(plan.tiene_boton_panico),
        "tiene_sirena": bool(plan.tiene_sirena), "tiene_dashboard_web": bool(plan.tiene_dashboard_web),
        "tiene_app_movil": bool(plan.tiene_app_movil), "tiene_fpga": bool(plan.tiene_fpga),
        "tiene_camara": bool(plan.tiene_camara), "tiene_captura_evidencia": bool(plan.tiene_captura_evidencia),
        "dias_retencion_gps": plan.dias_retencion_gps, "dias_retencion_alertas": plan.dias_retencion_alertas,
        "dias_retencion_evidencias": plan.dias_retencion_evidencias, "activo": bool(plan.activo),
        "fecha_creacion": plan.fecha_creacion, "total_tarifas": total_tarifas, "tarifas_activas": tarifas_activas,
    }

def serializar_tarifa_plan_admin(tarifa):
    return {
        "id": tarifa.id, "plan_id": tarifa.plan_id, "cantidad_minima": tarifa.cantidad_minima,
        "cantidad_maxima": tarifa.cantidad_maxima, "precio_dispositivo": tarifa.precio_dispositivo,
        "costo_instalacion": tarifa.costo_instalacion, "mensualidad": tarifa.mensualidad,
        "costo_mantenimiento": tarifa.costo_mantenimiento, "activo": bool(tarifa.activo),
        "fecha_creacion": tarifa.fecha_creacion,
    }

def convertir_booleano(valor, valor_default=False):
    if valor is None: return valor_default
    if isinstance(valor, bool): return valor
    if isinstance(valor, int): return valor == 1
    if isinstance(valor, str): return valor.strip().lower() in ("true", "1", "si", "sí", "on")
    return bool(valor)

def convertir_entero_nullable(valor):
    if valor in (None, ""): return None
    return int(valor)

def convertir_float_no_negativo(valor, nombre_campo):
    try: numero = float(valor or 0)
    except (TypeError, ValueError): raise ValueError(f"{nombre_campo} debe ser un número válido")
    if numero < 0: raise ValueError(f"{nombre_campo} no puede ser negativo")
    return numero

def obtener_conflicto_rango_tarifa(plan_id, cantidad_minima, cantidad_maxima, tarifa_excluir_id=None):
    consulta = TarifaPlan.query.filter(TarifaPlan.plan_id == plan_id, TarifaPlan.activo == True)
    if tarifa_excluir_id: consulta = consulta.filter(TarifaPlan.id != tarifa_excluir_id)
    tarifas = consulta.all()
    infinito = float("inf")
    nuevo_inicio = cantidad_minima
    nuevo_fin = cantidad_maxima if cantidad_maxima is not None else infinito

    for tarifa in tarifas:
        existente_inicio = tarifa.cantidad_minima
        existente_fin = tarifa.cantidad_maxima if tarifa.cantidad_maxima is not None else infinito
        if nuevo_inicio <= existente_fin and existente_inicio <= nuevo_fin:
            return tarifa
    return None

def texto_rango_tarifa(tarifa):
    if tarifa.cantidad_maxima is None: return f"{tarifa.cantidad_minima} o más"
    if tarifa.cantidad_minima == tarifa.cantidad_maxima: return str(tarifa.cantidad_minima)
    return f"{tarifa.cantidad_minima} a {tarifa.cantidad_maxima}"

# ============================================================
# RUTAS DE PLANES Y TARIFAS
# ============================================================
def registrar_admin_planes_routes(app):
    @app.get("/api/admin/planes")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_planes():
        planes = Plan.query.order_by(Plan.activo.desc(), Plan.id.desc()).all()
        return jsonify({"ok": True, "planes": [serializar_plan_admin(p) for p in planes]}), 200    

    @app.post("/api/admin/planes")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_plan():
        data = request.get_json(silent=True) or {}
        nombre = data.get("nombre", "").strip()
        descripcion = data.get("descripcion", "").strip()

        if not nombre: return jsonify({"error": "El nombre del plan es requerido"}), 400
        if len(nombre) > 50: return jsonify({"error": "El nombre no puede superar 50 caracteres"}), 400
        if Plan.query.filter(db.func.lower(Plan.nombre) == nombre.lower()).first():
            return jsonify({"error": "Ya existe un plan con ese nombre"}), 409

        try:
            dias_retencion_gps = convertir_entero_nullable(data.get("dias_retencion_gps"))
            dias_retencion_alertas = convertir_entero_nullable(data.get("dias_retencion_alertas"))
            dias_retencion_evidencias = convertir_entero_nullable(data.get("dias_retencion_evidencias"))
        except (TypeError, ValueError):
            return jsonify({"error": "Los días de retención deben ser números enteros válidos"}), 400

        if dias_retencion_gps is None or dias_retencion_gps < 1: return jsonify({"error": "La retención GPS debe ser de al menos 1 día"}), 400
        if dias_retencion_alertas is None or dias_retencion_alertas < 1: return jsonify({"error": "La retención de alertas debe ser de al menos 1 día"}), 400
        if dias_retencion_evidencias is not None and dias_retencion_evidencias < 1: return jsonify({"error": "La retención de evidencias debe ser de al menos 1 día"}), 400

        tiene_captura_evidencia = convertir_booleano(data.get("tiene_captura_evidencia"), False)
        if not tiene_captura_evidencia: dias_retencion_evidencias = None

        try:
            plan = Plan(
                nombre=nombre, descripcion=descripcion or None,
                tiene_gps=convertir_booleano(data.get("tiene_gps"), True),
                tiene_sensor_vibracion=convertir_booleano(data.get("tiene_sensor_vibracion"), True),
                tiene_sensor_puerta=convertir_booleano(data.get("tiene_sensor_puerta"), True),
                tiene_boton_panico=convertir_booleano(data.get("tiene_boton_panico"), True),
                tiene_sirena=convertir_booleano(data.get("tiene_sirena"), True),
                tiene_dashboard_web=convertir_booleano(data.get("tiene_dashboard_web"), True),
                tiene_app_movil=convertir_booleano(data.get("tiene_app_movil"), True),
                tiene_fpga=convertir_booleano(data.get("tiene_fpga"), False),
                tiene_camara=convertir_booleano(data.get("tiene_camara"), False),
                tiene_captura_evidencia=tiene_captura_evidencia,
                dias_retencion_gps=dias_retencion_gps, dias_retencion_alertas=dias_retencion_alertas,
                dias_retencion_evidencias=dias_retencion_evidencias, activo=True
            )
            db.session.add(plan)
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Plan creado correctamente", "plan": serializar_plan_admin(plan)}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo crear el plan"}), 500

    @app.get("/api/admin/planes/<int:plan_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_plan(plan_id):
        plan = db.session.get(Plan, plan_id)
        if not plan: return jsonify({"error": "Plan no encontrado"}), 404
        return jsonify({"ok": True, "plan": serializar_plan_admin(plan)}), 200

    @app.put("/api/admin/planes/<int:plan_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_plan(plan_id):
        plan = db.session.get(Plan, plan_id)
        if not plan: return jsonify({"error": "Plan no encontrado"}), 404

        data = request.get_json(silent=True) or {}
        nombre = data.get("nombre", "").strip()
        descripcion = data.get("descripcion", "").strip()

        if not nombre: return jsonify({"error": "El nombre del plan es requerido"}), 400
        if len(nombre) > 50: return jsonify({"error": "El nombre no puede superar 50 caracteres"}), 400
        if Plan.query.filter(db.func.lower(Plan.nombre) == nombre.lower(), Plan.id != plan.id).first():
            return jsonify({"error": "Ya existe otro plan con ese nombre"}), 409

        try:
            dias_retencion_gps = convertir_entero_nullable(data.get("dias_retencion_gps"))
            dias_retencion_alertas = convertir_entero_nullable(data.get("dias_retencion_alertas"))
            dias_retencion_evidencias = convertir_entero_nullable(data.get("dias_retencion_evidencias"))
        except (TypeError, ValueError):
            return jsonify({"error": "Los días de retención deben ser números enteros válidos"}), 400

        if dias_retencion_gps is None or dias_retencion_gps < 1: return jsonify({"error": "La retención GPS debe ser de al menos 1 día"}), 400
        if dias_retencion_alertas is None or dias_retencion_alertas < 1: return jsonify({"error": "La retención de alertas debe ser de al menos 1 día"}), 400
        if dias_retencion_evidencias is not None and dias_retencion_evidencias < 1: return jsonify({"error": "La retención de evidencias debe ser de al menos 1 día"}), 400

        tiene_captura_evidencia = convertir_booleano(data.get("tiene_captura_evidencia"), plan.tiene_captura_evidencia)
        if not tiene_captura_evidencia: dias_retencion_evidencias = None

        try:
            plan.nombre = nombre
            plan.descripcion = descripcion or None
            plan.tiene_gps = convertir_booleano(data.get("tiene_gps"), plan.tiene_gps)
            plan.tiene_sensor_vibracion = convertir_booleano(data.get("tiene_sensor_vibracion"), plan.tiene_sensor_vibracion)
            plan.tiene_sensor_puerta = convertir_booleano(data.get("tiene_sensor_puerta"), plan.tiene_sensor_puerta)
            plan.tiene_boton_panico = convertir_booleano(data.get("tiene_boton_panico"), plan.tiene_boton_panico)
            plan.tiene_sirena = convertir_booleano(data.get("tiene_sirena"), plan.tiene_sirena)
            plan.tiene_dashboard_web = convertir_booleano(data.get("tiene_dashboard_web"), plan.tiene_dashboard_web)
            plan.tiene_app_movil = convertir_booleano(data.get("tiene_app_movil"), plan.tiene_app_movil)
            plan.tiene_fpga = convertir_booleano(data.get("tiene_fpga"), plan.tiene_fpga)
            plan.tiene_camara = convertir_booleano(data.get("tiene_camara"), plan.tiene_camara)
            plan.tiene_captura_evidencia = tiene_captura_evidencia
            plan.dias_retencion_gps = dias_retencion_gps
            plan.dias_retencion_alertas = dias_retencion_alertas
            plan.dias_retencion_evidencias = dias_retencion_evidencias

            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Plan actualizado correctamente", "plan": serializar_plan_admin(plan)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo actualizar el plan"}), 500

    @app.put("/api/admin/planes/<int:plan_id>/desactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_desactivar_plan(plan_id):
        plan = db.session.get(Plan, plan_id)
        if not plan: return jsonify({"error": "Plan no encontrado"}), 404
        if not plan.activo: return jsonify({"ok": True, "mensaje": "El plan ya estaba desactivado"}), 200
        try:
            plan.activo = False
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Plan desactivado", "plan": serializar_plan_admin(plan)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo desactivar el plan"}), 500

    @app.put("/api/admin/planes/<int:plan_id>/reactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reactivar_plan(plan_id):
        plan = db.session.get(Plan, plan_id)
        if not plan: return jsonify({"error": "Plan no encontrado"}), 404
        if plan.activo: return jsonify({"ok": True, "mensaje": "El plan ya estaba activo"}), 200
        try:
            plan.activo = True
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Plan reactivado", "plan": serializar_plan_admin(plan)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo reactivar el plan"}), 500

    @app.get("/api/admin/planes/opciones")
    @jwt_required()
    @rol_requerido("admin")
    def admin_planes_opciones():
        planes = Plan.query.filter_by(activo=True).order_by(Plan.nombre.asc()).all()
        return jsonify({"ok": True, "planes": [{"id": p.id, "nombre": p.nombre} for p in planes]}), 200

    # RUTAS DE TARIFAS
    @app.get("/api/admin/planes/<int:plan_id>/tarifas")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_tarifas_plan(plan_id):
        plan = db.session.get(Plan, plan_id)
        if not plan: return jsonify({"error": "Plan no encontrado"}), 404
        tarifas = TarifaPlan.query.filter_by(plan_id=plan.id).order_by(TarifaPlan.activo.desc(), TarifaPlan.cantidad_minima.asc()).all()
        return jsonify({"ok": True, "plan": {"id": plan.id, "nombre": plan.nombre, "activo": bool(plan.activo)}, "tarifas": [serializar_tarifa_plan_admin(t) for t in tarifas]}), 200

    @app.post("/api/admin/planes/<int:plan_id>/tarifas")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_tarifa_plan(plan_id):
        plan = db.session.get(Plan, plan_id)
        if not plan: return jsonify({"error": "Plan no encontrado"}), 404
        data = request.get_json(silent=True) or {}

        try:
            cantidad_minima = int(data.get("cantidad_minima"))
            cantidad_maxima = convertir_entero_nullable(data.get("cantidad_maxima"))
        except (TypeError, ValueError): return jsonify({"error": "Las cantidades deben ser enteros"}), 400
        if cantidad_minima < 1: return jsonify({"error": "La cantidad mínima debe ser al menos 1"}), 400
        if cantidad_maxima is not None and cantidad_maxima < cantidad_minima: return jsonify({"error": "La máxima no puede ser menor a la mínima"}), 400

        try:
            precio_dispositivo = convertir_float_no_negativo(data.get("precio_dispositivo"), "El precio del dispositivo")
            costo_instalacion = convertir_float_no_negativo(data.get("costo_instalacion"), "El costo de instalación")
            mensualidad = convertir_float_no_negativo(data.get("mensualidad"), "La mensualidad")
            costo_mantenimiento = convertir_float_no_negativo(data.get("costo_mantenimiento"), "El costo de mantenimiento")
        except ValueError as error: return jsonify({"error": str(error)}), 400

        conflicto = obtener_conflicto_rango_tarifa(plan_id=plan.id, cantidad_minima=cantidad_minima, cantidad_maxima=cantidad_maxima)
        if conflicto: return jsonify({"error": f"Se cruza con tarifa existente: {texto_rango_tarifa(conflicto)} vehículos"}), 409

        try:
            tarifa = TarifaPlan(
                plan_id=plan.id, cantidad_minima=cantidad_minima, cantidad_maxima=cantidad_maxima,
                precio_dispositivo=precio_dispositivo, costo_instalacion=costo_instalacion, mensualidad=mensualidad,
                costo_mantenimiento=costo_mantenimiento, activo=True
            )
            db.session.add(tarifa)
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Tarifa creada", "tarifa": serializar_tarifa_plan_admin(tarifa)}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo crear la tarifa"}), 500

    @app.put("/api/admin/tarifas/<int:tarifa_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_tarifa_plan(tarifa_id):
        tarifa = db.session.get(TarifaPlan, tarifa_id)
        if not tarifa: return jsonify({"error": "Tarifa no encontrada"}), 404
        data = request.get_json(silent=True) or {}

        try:
            cantidad_minima = int(data.get("cantidad_minima"))
            cantidad_maxima = convertir_entero_nullable(data.get("cantidad_maxima"))
        except (TypeError, ValueError): return jsonify({"error": "Cantidades deben ser enteros"}), 400
        if cantidad_minima < 1: return jsonify({"error": "Mínima debe ser al menos 1"}), 400
        if cantidad_maxima is not None and cantidad_maxima < cantidad_minima: return jsonify({"error": "Máxima no puede ser menor a mínima"}), 400

        try:
            precio_dispositivo = convertir_float_no_negativo(data.get("precio_dispositivo"), "Precio de dispositivo")
            costo_instalacion = convertir_float_no_negativo(data.get("costo_instalacion"), "Costo de instalación")
            mensualidad = convertir_float_no_negativo(data.get("mensualidad"), "Mensualidad")
            costo_mantenimiento = convertir_float_no_negativo(data.get("costo_mantenimiento"), "Costo de mantenimiento")
        except ValueError as error: return jsonify({"error": str(error)}), 400

        if tarifa.activo:
            conflicto = obtener_conflicto_rango_tarifa(plan_id=tarifa.plan_id, cantidad_minima=cantidad_minima, cantidad_maxima=cantidad_maxima, tarifa_excluir_id=tarifa.id)
            if conflicto: return jsonify({"error": f"Se cruza con tarifa activa: {texto_rango_tarifa(conflicto)}"}), 409

        try:
            tarifa.cantidad_minima = cantidad_minima
            tarifa.cantidad_maxima = cantidad_maxima
            tarifa.precio_dispositivo = precio_dispositivo
            tarifa.costo_instalacion = costo_instalacion
            tarifa.mensualidad = mensualidad
            tarifa.costo_mantenimiento = costo_mantenimiento
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Tarifa actualizada", "tarifa": serializar_tarifa_plan_admin(tarifa)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo actualizar la tarifa"}), 500

    @app.put("/api/admin/tarifas/<int:tarifa_id>/desactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_desactivar_tarifa_plan(tarifa_id):
        tarifa = db.session.get(TarifaPlan, tarifa_id)
        if not tarifa: return jsonify({"error": "Tarifa no encontrada"}), 404
        if not tarifa.activo: return jsonify({"ok": True, "mensaje": "Ya estaba desactivada"}), 200
        try:
            tarifa.activo = False
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Tarifa desactivada", "tarifa": serializar_tarifa_plan_admin(tarifa)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo desactivar"}), 500

    @app.put("/api/admin/tarifas/<int:tarifa_id>/reactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reactivar_tarifa_plan(tarifa_id):
        tarifa = db.session.get(TarifaPlan, tarifa_id)
        if not tarifa: return jsonify({"error": "Tarifa no encontrada"}), 404
        if tarifa.activo: return jsonify({"ok": True, "mensaje": "Ya estaba activa"}), 200
        conflicto = obtener_conflicto_rango_tarifa(plan_id=tarifa.plan_id, cantidad_minima=tarifa.cantidad_minima, cantidad_maxima=tarifa.cantidad_maxima, tarifa_excluir_id=tarifa.id)
        if conflicto: return jsonify({"error": f"Se cruza con tarifa activa: {texto_rango_tarifa(conflicto)}"}), 409
        try:
            tarifa.activo = True
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Tarifa reactivada", "tarifa": serializar_tarifa_plan_admin(tarifa)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo reactivar"}), 500