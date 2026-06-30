# ============================================================
# ROUTES VEHÍCULOS - TrackSecurity
# ============================================================
#
# Endpoints para administrar vehículos.
#
# Se usa actualmente en:
# - dashboard
# - módulo vehículos
# - detalle vehículo
# - formulario nuevo/editar vehículo
# ============================================================

from flask import request, jsonify
from flask_jwt_extended import jwt_required

from config import db
from models import Vehiculo, Alerta, Evidencia, Suscripcion, Plan, Evento
from decorators import rol_requerido
from helpers import (
    obtener_usuario_actual,
    registrar_evento,
    validar_limite_vehiculos,
    chofer_ocupado_en_otro_vehiculo,
)
from serializers import (
    serializar_vehiculo,
    serializar_alerta,
    serializar_evento,
)



# ------------------------------------------------------------
# Limpia textos opcionales.
#
# Convierte:
# None -> None
# ""   -> None
# "  " -> None
# "ABC" -> "ABC"
#
# Se usa en:
# - crear vehículo
# - editar vehículo
# ------------------------------------------------------------
def limpiar_texto_opcional(valor):
    if valor is None:
        return None

    valor = str(valor).strip()
    return valor if valor else None


# ------------------------------------------------------------
# Convierte campos numéricos opcionales.
#
# Evita errores cuando el formulario manda "" en campos como:
# - anio
# - chofer_id
#
# Se usa en:
# - crear vehículo
# - editar vehículo
# ------------------------------------------------------------
def limpiar_entero_opcional(valor, nombre_campo):
    if valor is None or valor == "":
        return None

    try:
        return int(valor)
    except ValueError:
        raise ValueError(f"{nombre_campo} debe ser un número válido")


# ------------------------------------------------------------
# Revisa si ya existe un vehículo con el mismo identificador.
#
# Se usa en:
# - crear vehículo
# - editar vehículo
#
# El identificador NO debe repetirse.
# ------------------------------------------------------------
def existe_identificador_vehiculo(identificador, vehiculo_id_actual=None):
    consulta = Vehiculo.query.filter(
        Vehiculo.identificador == identificador
    )

    if vehiculo_id_actual:
        consulta = consulta.filter(Vehiculo.id != vehiculo_id_actual)

    return consulta.first()


# ------------------------------------------------------------
# Revisa si ya existe un vehículo activo con la misma placa
# dentro de la misma empresa.
#
# Se usa en:
# - crear vehículo
# - editar vehículo
#
# La placa no se valida globalmente, solo por empresa.
# ------------------------------------------------------------
def existe_placa_vehiculo(empresa_id, placa, vehiculo_id_actual=None):
    if not placa:
        return None

    consulta = Vehiculo.query.filter(
        Vehiculo.empresa_id == empresa_id,
        Vehiculo.placa == placa,
        Vehiculo.activo == True
    )

    if vehiculo_id_actual:
        consulta = consulta.filter(Vehiculo.id != vehiculo_id_actual)

    return consulta.first()

# ------------------------------------------------------------
# Registra rutas de vehículos.
# ------------------------------------------------------------
def registrar_vehiculos_routes(app):

    # Lista vehículos visibles según el rol.
    #
    # Se usa actualmente en:
    # - static/js/dueno/vehiculos/index.js
    # - dashboard.js
    @app.route("/api/vehiculos", methods=["GET"])
    @jwt_required()
    def listar_vehiculos():
        usuario = obtener_usuario_actual()

        if usuario.tipo in ("admin", "dueno", "supervisor"):
            vehiculos = Vehiculo.query.filter_by(
                empresa_id=usuario.empresa_id,
                activo=True
            ).all()

        elif usuario.tipo == "chofer":
            vehiculos = Vehiculo.query.filter_by(
                chofer_id=usuario.id,
                activo=True
            ).all()

        else:
            return jsonify({
                "error": "tu rol no tiene acceso a esta información"
            }), 403

        return jsonify({
            "vehiculos": [serializar_vehiculo(v) for v in vehiculos]
        }), 200

    # Devuelve eventos recientes de un vehículo.
    #
    # Se usa actualmente en:
    # - detalle de vehículo
    #
    # También puede usarse después en:
    # - historial completo
    # - reportes
    @app.route("/api/vehiculos/<int:vehiculo_id>/eventos", methods=["GET"])
    @jwt_required()
    def obtener_eventos_vehiculo(vehiculo_id):
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

    # Devuelve detalle completo de un vehículo.
    #
    # Se usa actualmente en:
    # - static/js/dueno/vehiculos/detalle.js
    @app.route("/api/vehiculos/<int:vehiculo_id>", methods=["GET"])
    @jwt_required()
    def obtener_vehiculo_detalle(vehiculo_id):
        usuario = obtener_usuario_actual()
        vehiculo = db.session.get(Vehiculo, vehiculo_id)

        if not vehiculo:
            return jsonify({"error": "vehículo no encontrado"}), 404

        if usuario.tipo in ("admin", "dueno", "supervisor"):
            if vehiculo.empresa_id != usuario.empresa_id:
                return jsonify({"error": "no tienes acceso a este vehículo"}), 403

        elif usuario.tipo == "chofer":
            if vehiculo.chofer_id != usuario.id:
                return jsonify({"error": "no tienes acceso a este vehículo"}), 403

        else:
            return jsonify({
                "error": "tu rol no tiene acceso a esta información"
            }), 403

        alertas = Alerta.query.filter_by(
            vehiculo_id=vehiculo.id
        ).order_by(Alerta.timestamp.desc()).limit(10).all()

        evidencias = Evidencia.query.filter_by(
            vehiculo_id=vehiculo.id
        ).order_by(Evidencia.timestamp.desc()).limit(6).all()

        suscripcion = Suscripcion.query.filter_by(
            empresa_id=vehiculo.empresa_id,
            estado="activa"
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
                    "timestamp": e.timestamp,
                }
                for e in evidencias
            ],
            "plan": {
                "nombre": nombre_plan,
                "es_premium": es_premium,
            }
        }), 200


    # --------------------------------------------------------
    # Crea un vehículo nuevo.
    #
    # Se usa actualmente en:
    # - static/js/dueno/vehiculos/nuevo.js
    #
    # También puede usarse después en:
    # - app móvil del dueño
    # - panel administrativo
    # --------------------------------------------------------
    @app.route("/api/vehiculos", methods=["POST"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def crear_vehiculo():
        usuario = obtener_usuario_actual()
        data = request.get_json(silent=True) or {}

        puede_crear, mensaje_limite = validar_limite_vehiculos(usuario.empresa_id)

        if not puede_crear:
            return jsonify({"error": mensaje_limite}), 403

        nombre = limpiar_texto_opcional(data.get("nombre"))
        identificador = limpiar_texto_opcional(data.get("identificador"))
        placa = limpiar_texto_opcional(data.get("placa"))

        if not nombre or not identificador:
            return jsonify({
                "error": "nombre e identificador son requeridos"
            }), 400

        # Validar identificador repetido.
        vehiculo_con_identificador = existe_identificador_vehiculo(identificador)

        if vehiculo_con_identificador:
            return jsonify({
                "error": "ya existe un vehículo con ese identificador. Usa otro."
            }), 409

        # Validar placa repetida dentro de la misma empresa.
        vehiculo_con_placa = existe_placa_vehiculo(
            usuario.empresa_id,
            placa
        )

        if vehiculo_con_placa:
            return jsonify({
                "error": f"ya existe un vehículo con la placa {placa}. Usa otra."
            }), 409

        try:
            anio = limpiar_entero_opcional(data.get("anio"), "año")
            chofer_id = limpiar_entero_opcional(data.get("chofer_id"), "chofer")

        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        if chofer_id:
            vehiculo_existente = chofer_ocupado_en_otro_vehiculo(
                usuario.empresa_id,
                chofer_id
            )

            if vehiculo_existente:
                return jsonify({
                    "error": (
                        "este chofer ya está asignado al vehículo "
                        f"{vehiculo_existente.nombre}"
                    )
                }), 409

        vehiculo = Vehiculo(
            empresa_id=usuario.empresa_id,
            nombre=nombre,
            identificador=identificador,
            placa=placa,
            marca=limpiar_texto_opcional(data.get("marca")),
            modelo=limpiar_texto_opcional(data.get("modelo")),
            anio=anio,
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

            return jsonify({
                "ok": True,
                "mensaje": "vehículo creado correctamente",
                "vehiculo": serializar_vehiculo(vehiculo)
            }), 201

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al crear vehículo: {e}")

            return jsonify({
                "error": "error interno del servidor"
            }), 500


    # Edita datos administrativos de un vehículo.
    #
    # Se usa actualmente en:
    # - static/js/dueno/vehiculos/editar.js
    @app.route("/api/vehiculos/<int:vehiculo_id>", methods=["PUT"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def editar_vehiculo(vehiculo_id):
        usuario = obtener_usuario_actual()
        vehiculo = db.session.get(Vehiculo, vehiculo_id)

        if not vehiculo:
            return jsonify({"error": "vehículo no encontrado"}), 404

        if vehiculo.empresa_id != usuario.empresa_id:
            return jsonify({"error": "no tienes acceso a este vehículo"}), 403

        data = request.get_json(silent=True) or {}

        nombre = limpiar_texto_opcional(data.get("nombre"))
        identificador = limpiar_texto_opcional(data.get("identificador"))
        placa = limpiar_texto_opcional(data.get("placa"))

        if not nombre or not identificador:
            return jsonify({
                "error": "nombre e identificador son requeridos"
            }), 400

        # Validar que otro vehículo no tenga el mismo identificador.
        vehiculo_con_identificador = existe_identificador_vehiculo(
            identificador,
            vehiculo_id_actual=vehiculo.id
        )

        if vehiculo_con_identificador:
            return jsonify({
                "error": "ya existe otro vehículo con ese identificador. Usa otro."
            }), 409

        # Validar que otro vehículo activo de la misma empresa no tenga la misma placa.
        vehiculo_con_placa = existe_placa_vehiculo(
            usuario.empresa_id,
            placa,
            vehiculo_id_actual=vehiculo.id
        )

        if vehiculo_con_placa:
            return jsonify({
                "error": f"ya existe otro vehículo con la placa {placa}. Usa otra."
            }), 409

        try:
            anio = limpiar_entero_opcional(data.get("anio"), "año")
            chofer_id = limpiar_entero_opcional(data.get("chofer_id"), "chofer")

        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        if chofer_id:
            vehiculo_existente = chofer_ocupado_en_otro_vehiculo(
                usuario.empresa_id,
                chofer_id,
                vehiculo_id_actual=vehiculo.id
            )

            if vehiculo_existente:
                return jsonify({
                    "error": (
                        "este chofer ya está asignado al vehículo "
                        f"{vehiculo_existente.nombre}"
                    )
                }), 409

        vehiculo.nombre = nombre
        vehiculo.identificador = identificador
        vehiculo.placa = placa
        vehiculo.marca = limpiar_texto_opcional(data.get("marca"))
        vehiculo.modelo = limpiar_texto_opcional(data.get("modelo"))
        vehiculo.anio = anio
        vehiculo.chofer_id = chofer_id

        try:
            registrar_evento(
                vehiculo_id=vehiculo.id,
                tipo="vehiculo_editado",
                descripcion=(
                    f"{usuario.nombre} editó los datos del vehículo "
                    f"{vehiculo.nombre}"
                ),
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

    # Desactiva un vehículo sin borrar su historial.
    #
    # Se usa actualmente en:
    # - static/js/dueno/vehiculos/index.js
    @app.route("/api/vehiculos/<int:vehiculo_id>/desactivar", methods=["PUT"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def desactivar_vehiculo(vehiculo_id):
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
                descripcion=f"{usuario.nombre} desactivó el vehículo {vehiculo.nombre}"
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
