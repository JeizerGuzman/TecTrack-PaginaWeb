# ============================================================
# ROUTES ADMIN - SERVICIOS
# TrackSecurity
# ============================================================
#
# Este módulo administra exclusivamente:
# - servicios_programados: agenda y planificación administrativa.
# - servicios: historial técnico real existente.
#
# Importante:
# - NO modifica la estructura ni el flujo actual de Flutter.
# - NO altera los endpoints técnicos existentes.
# - NO crea automáticamente registros en "servicios" al cambiar
#   el estado de un servicio programado, para evitar duplicados
#   con las operaciones que ya registra la app móvil.
# ============================================================

from flask import jsonify, request
from flask_jwt_extended import jwt_required

from config import db
from decorators import rol_requerido
from helpers import timestamp_actual
from models import (
    Empresa,
    Usuario,
    Vehiculo,
    Dispositivo,
    Servicio,
    ServicioProgramado,
)


ESTADOS_SERVICIO_PROGRAMADO = {
    "pendiente",
    "asignado",
    "en_proceso",
    "realizado",
    "cancelado",
}

TIPOS_SERVICIO_PROGRAMADO = {
    "instalacion",
    "mantenimiento",
    "reparacion",
    "cambio_dispositivo",
    "retiro_dispositivo",
    "diagnostico",
    "otro",
}


def convertir_entero_nullable(valor, nombre_campo):
    if valor in (None, ""):
        return None

    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValueError(f"{nombre_campo} debe ser un entero válido")


def convertir_float_no_negativo(valor, nombre_campo):
    if valor in (None, ""):
        return 0.0

    try:
        numero = float(valor)
    except (TypeError, ValueError):
        raise ValueError(f"{nombre_campo} debe ser un número válido")

    if numero < 0:
        raise ValueError(f"{nombre_campo} no puede ser negativo")

    return numero


def obtener_empresa(empresa_id):
    return db.session.get(Empresa, empresa_id) if empresa_id else None


def obtener_vehiculo(vehiculo_id):
    return db.session.get(Vehiculo, vehiculo_id) if vehiculo_id else None


def obtener_dispositivo(dispositivo_id):
    return db.session.get(Dispositivo, dispositivo_id) if dispositivo_id else None


def obtener_tecnico(tecnico_id):
    return db.session.get(Usuario, tecnico_id) if tecnico_id else None


def obtener_servicio_real(servicio_id):
    return db.session.get(Servicio, servicio_id) if servicio_id else None


def serializar_servicio_real(servicio):
    empresa = obtener_empresa(servicio.empresa_id)
    vehiculo = obtener_vehiculo(servicio.vehiculo_id)
    dispositivo = obtener_dispositivo(servicio.dispositivo_id)

    return {
        "id": servicio.id,
        "empresa_id": servicio.empresa_id,
        "empresa_nombre": empresa.nombre if empresa else None,
        "vehiculo_id": servicio.vehiculo_id,
        "vehiculo_nombre": vehiculo.nombre if vehiculo else None,
        "vehiculo_placa": vehiculo.placa if vehiculo else None,
        "dispositivo_id": servicio.dispositivo_id,
        "dispositivo_serie": dispositivo.serie if dispositivo else None,
        "tipo": servicio.tipo,
        "descripcion": servicio.descripcion,
        "costo": servicio.costo,
        "estado": servicio.estado,
        "timestamp": servicio.timestamp,
    }


def serializar_servicio_programado(servicio):
    empresa = obtener_empresa(servicio.empresa_id)
    vehiculo = obtener_vehiculo(servicio.vehiculo_id)
    dispositivo = obtener_dispositivo(servicio.dispositivo_id)
    tecnico = obtener_tecnico(servicio.tecnico_id)
    servicio_real = obtener_servicio_real(servicio.servicio_id)

    return {
        "id": servicio.id,
        "servicio_id": servicio.servicio_id,
        "servicio_real": (
            serializar_servicio_real(servicio_real)
            if servicio_real
            else None
        ),
        "empresa_id": servicio.empresa_id,
        "empresa_nombre": empresa.nombre if empresa else None,
        "vehiculo_id": servicio.vehiculo_id,
        "vehiculo_nombre": vehiculo.nombre if vehiculo else None,
        "vehiculo_placa": vehiculo.placa if vehiculo else None,
        "dispositivo_id": servicio.dispositivo_id,
        "dispositivo_serie": dispositivo.serie if dispositivo else None,
        "tecnico_id": servicio.tecnico_id,
        "tecnico_nombre": tecnico.nombre if tecnico else None,
        "tecnico_correo": tecnico.correo if tecnico else None,
        "tipo": servicio.tipo,
        "descripcion": servicio.descripcion,
        "costo_estimado": servicio.costo_estimado,
        "estado": servicio.estado,
        "fecha_programada": servicio.fecha_programada,
        "fecha_inicio": servicio.fecha_inicio,
        "fecha_finalizacion": servicio.fecha_finalizacion,
        "timestamp": servicio.timestamp,
    }


def validar_relaciones_servicio(
    empresa_id,
    vehiculo_id,
    dispositivo_id,
    tecnico_id,
):
    empresa = obtener_empresa(empresa_id)

    if not empresa:
        return None, (jsonify({"error": "Empresa no encontrada"}), 404)

    if not empresa.activo:
        return None, (
            jsonify({
                "error": "No puedes programar un servicio para una empresa inactiva"
            }),
            409,
        )

    vehiculo = obtener_vehiculo(vehiculo_id)

    if vehiculo and vehiculo.empresa_id != empresa.id:
        return None, (
            jsonify({
                "error": "El vehículo no pertenece a la empresa seleccionada"
            }),
            409,
        )

    dispositivo = obtener_dispositivo(dispositivo_id)

    if dispositivo:
        if vehiculo and vehiculo.dispositivo_id != dispositivo.id:
            return None, (
                jsonify({
                    "error": "El dispositivo no corresponde al vehículo seleccionado"
                }),
                409,
            )

        if not vehiculo and dispositivo.empresa_id not in (None, empresa.id):
            return None, (
                jsonify({
                    "error": "El dispositivo no pertenece a la empresa seleccionada"
                }),
                409,
            )

    tecnico = obtener_tecnico(tecnico_id)

    if tecnico:
        if tecnico.tipo != "tecnico":
            return None, (
                jsonify({
                    "error": "El usuario seleccionado no tiene rol técnico"
                }),
                409,
            )

        if not tecnico.activo:
            return None, (
                jsonify({
                    "error": "El técnico seleccionado está inactivo"
                }),
                409,
            )

    return {
        "empresa": empresa,
        "vehiculo": vehiculo,
        "dispositivo": dispositivo,
        "tecnico": tecnico,
    }, None


def aplicar_fechas_por_estado(servicio, nuevo_estado):
    ahora = timestamp_actual()

    if nuevo_estado == "en_proceso":
        if not servicio.fecha_inicio:
            servicio.fecha_inicio = ahora

    elif nuevo_estado == "realizado":
        if not servicio.fecha_inicio:
            servicio.fecha_inicio = ahora

        if not servicio.fecha_finalizacion:
            servicio.fecha_finalizacion = ahora

    elif nuevo_estado in ("pendiente", "asignado"):
        servicio.fecha_inicio = None
        servicio.fecha_finalizacion = None

    elif nuevo_estado == "cancelado":
        servicio.fecha_finalizacion = ahora


def registrar_admin_servicios_routes(app):

    @app.get("/api/admin/servicios")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_servicios():
        programados = (
            ServicioProgramado.query
            .order_by(ServicioProgramado.id.desc())
            .all()
        )

        historial_real = (
            Servicio.query
            .order_by(Servicio.timestamp.desc())
            .limit(200)
            .all()
        )

        return jsonify({
            "ok": True,
            "servicios_programados": [
                serializar_servicio_programado(item)
                for item in programados
            ],
            "historial_real": [
                serializar_servicio_real(item)
                for item in historial_real
            ],
        }), 200


    @app.get("/api/admin/servicios/programados/<int:servicio_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_servicio_programado(servicio_id):
        servicio = db.session.get(ServicioProgramado, servicio_id)

        if not servicio:
            return jsonify({
                "error": "Servicio programado no encontrado"
            }), 404

        return jsonify({
            "ok": True,
            "servicio": serializar_servicio_programado(servicio),
        }), 200


    @app.get("/api/admin/servicios/catalogos")
    @jwt_required()
    @rol_requerido("admin")
    def admin_catalogos_servicios():
        empresas = (
            Empresa.query
            .filter_by(activo=True)
            .order_by(Empresa.nombre.asc())
            .all()
        )

        tecnicos = (
            Usuario.query
            .filter_by(tipo="tecnico", activo=True)
            .order_by(Usuario.nombre.asc())
            .all()
        )

        return jsonify({
            "ok": True,
            "empresas": [
                {
                    "id": empresa.id,
                    "nombre": empresa.nombre,
                    "correo": empresa.correo,
                    "telefono": empresa.telefono,
                }
                for empresa in empresas
            ],
            "tecnicos": [
                {
                    "id": tecnico.id,
                    "nombre": tecnico.nombre,
                    "correo": tecnico.correo,
                    "telefono": tecnico.telefono,
                }
                for tecnico in tecnicos
            ],
            "tipos": sorted(TIPOS_SERVICIO_PROGRAMADO),
            "estados": [
                "pendiente",
                "asignado",
                "en_proceso",
                "realizado",
                "cancelado",
            ],
        }), 200


    @app.get("/api/admin/servicios/empresas/<int:empresa_id>/vehiculos")
    @jwt_required()
    @rol_requerido("admin")
    def admin_vehiculos_empresa_servicio(empresa_id):
        empresa = db.session.get(Empresa, empresa_id)

        if not empresa:
            return jsonify({"error": "Empresa no encontrada"}), 404

        vehiculos = (
            Vehiculo.query
            .filter_by(empresa_id=empresa.id, activo=True)
            .order_by(Vehiculo.nombre.asc())
            .all()
        )

        return jsonify({
            "ok": True,
            "empresa": {
                "id": empresa.id,
                "nombre": empresa.nombre,
            },
            "vehiculos": [
                {
                    "id": vehiculo.id,
                    "nombre": vehiculo.nombre,
                    "placa": vehiculo.placa,
                    "identificador": vehiculo.identificador,
                    "dispositivo_id": vehiculo.dispositivo_id,
                }
                for vehiculo in vehiculos
            ],
        }), 200


    @app.get("/api/admin/servicios/vehiculos/<int:vehiculo_id>/dispositivo")
    @jwt_required()
    @rol_requerido("admin")
    def admin_dispositivo_vehiculo_servicio(vehiculo_id):
        vehiculo = db.session.get(Vehiculo, vehiculo_id)

        if not vehiculo:
            return jsonify({"error": "Vehículo no encontrado"}), 404

        dispositivo = (
            db.session.get(Dispositivo, vehiculo.dispositivo_id)
            if vehiculo.dispositivo_id
            else None
        )

        return jsonify({
            "ok": True,
            "vehiculo": {
                "id": vehiculo.id,
                "nombre": vehiculo.nombre,
                "placa": vehiculo.placa,
            },
            "dispositivo": (
                {
                    "id": dispositivo.id,
                    "serie": dispositivo.serie,
                    "estado": dispositivo.estado,
                }
                if dispositivo
                else None
            ),
        }), 200


    @app.post("/api/admin/servicios/programados")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_servicio_programado():
        data = request.get_json(silent=True) or {}

        try:
            empresa_id = int(data.get("empresa_id"))
            vehiculo_id = convertir_entero_nullable(
                data.get("vehiculo_id"),
                "vehiculo_id",
            )
            dispositivo_id = convertir_entero_nullable(
                data.get("dispositivo_id"),
                "dispositivo_id",
            )
            tecnico_id = convertir_entero_nullable(
                data.get("tecnico_id"),
                "tecnico_id",
            )
            fecha_programada = convertir_entero_nullable(
                data.get("fecha_programada"),
                "fecha_programada",
            )
            costo_estimado = convertir_float_no_negativo(
                data.get("costo_estimado", 0),
                "El costo estimado",
            )

        except (TypeError, ValueError) as error:
            return jsonify({"error": str(error)}), 400

        tipo = str(data.get("tipo", "")).strip().lower()
        descripcion = str(data.get("descripcion", "")).strip()

        if not tipo:
            return jsonify({
                "error": "El tipo de servicio es requerido"
            }), 400

        if tipo not in TIPOS_SERVICIO_PROGRAMADO:
            return jsonify({"error": "Tipo de servicio no válido"}), 400

        if not fecha_programada:
            return jsonify({
                "error": "La fecha programada es requerida"
            }), 400

        _, error_relacion = validar_relaciones_servicio(
            empresa_id=empresa_id,
            vehiculo_id=vehiculo_id,
            dispositivo_id=dispositivo_id,
            tecnico_id=tecnico_id,
        )

        if error_relacion:
            return error_relacion

        estado_inicial = "asignado" if tecnico_id else "pendiente"

        try:
            servicio = ServicioProgramado(
                servicio_id=None,
                empresa_id=empresa_id,
                vehiculo_id=vehiculo_id,
                dispositivo_id=dispositivo_id,
                tecnico_id=tecnico_id,
                tipo=tipo,
                descripcion=descripcion if descripcion else None,
                costo_estimado=costo_estimado,
                estado=estado_inicial,
                fecha_programada=fecha_programada,
                fecha_inicio=None,
                fecha_finalizacion=None,
                timestamp=timestamp_actual(),
            )

            db.session.add(servicio)
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Servicio programado creado correctamente",
                "servicio": serializar_servicio_programado(servicio),
            }), 201

        except Exception as error:
            db.session.rollback()
            print("Error creando servicio programado:", error)

            return jsonify({
                "error": "No se pudo crear el servicio programado"
            }), 500


    @app.put("/api/admin/servicios/programados/<int:servicio_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_servicio_programado(servicio_id):
        servicio = db.session.get(ServicioProgramado, servicio_id)

        if not servicio:
            return jsonify({
                "error": "Servicio programado no encontrado"
            }), 404

        data = request.get_json(silent=True) or {}

        try:
            empresa_id = int(data.get("empresa_id", servicio.empresa_id))
            vehiculo_id = convertir_entero_nullable(
                data.get("vehiculo_id", servicio.vehiculo_id),
                "vehiculo_id",
            )
            dispositivo_id = convertir_entero_nullable(
                data.get("dispositivo_id", servicio.dispositivo_id),
                "dispositivo_id",
            )
            tecnico_id = convertir_entero_nullable(
                data.get("tecnico_id", servicio.tecnico_id),
                "tecnico_id",
            )
            fecha_programada = convertir_entero_nullable(
                data.get("fecha_programada", servicio.fecha_programada),
                "fecha_programada",
            )
            costo_estimado = convertir_float_no_negativo(
                data.get("costo_estimado", servicio.costo_estimado),
                "El costo estimado",
            )

        except (TypeError, ValueError) as error:
            return jsonify({"error": str(error)}), 400

        tipo = str(data.get("tipo", servicio.tipo)).strip().lower()
        descripcion = str(
            data.get("descripcion", servicio.descripcion or "")
        ).strip()

        if tipo not in TIPOS_SERVICIO_PROGRAMADO:
            return jsonify({"error": "Tipo de servicio no válido"}), 400

        if not fecha_programada:
            return jsonify({
                "error": "La fecha programada es requerida"
            }), 400

        _, error_relacion = validar_relaciones_servicio(
            empresa_id=empresa_id,
            vehiculo_id=vehiculo_id,
            dispositivo_id=dispositivo_id,
            tecnico_id=tecnico_id,
        )

        if error_relacion:
            return error_relacion

        try:
            servicio.empresa_id = empresa_id
            servicio.vehiculo_id = vehiculo_id
            servicio.dispositivo_id = dispositivo_id
            servicio.tecnico_id = tecnico_id
            servicio.tipo = tipo
            servicio.descripcion = descripcion if descripcion else None
            servicio.costo_estimado = costo_estimado
            servicio.fecha_programada = fecha_programada

            if servicio.estado == "pendiente" and tecnico_id:
                servicio.estado = "asignado"
            elif servicio.estado == "asignado" and not tecnico_id:
                servicio.estado = "pendiente"

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Servicio programado actualizado correctamente",
                "servicio": serializar_servicio_programado(servicio),
            }), 200

        except Exception as error:
            db.session.rollback()
            print("Error editando servicio programado:", error)

            return jsonify({
                "error": "No se pudo actualizar el servicio programado"
            }), 500


    @app.put("/api/admin/servicios/programados/<int:servicio_id>/estado")
    @jwt_required()
    @rol_requerido("admin")
    def admin_cambiar_estado_servicio_programado(servicio_id):
        servicio = db.session.get(ServicioProgramado, servicio_id)

        if not servicio:
            return jsonify({
                "error": "Servicio programado no encontrado"
            }), 404

        data = request.get_json(silent=True) or {}
        nuevo_estado = str(data.get("estado", "")).strip().lower()

        if nuevo_estado not in ESTADOS_SERVICIO_PROGRAMADO:
            return jsonify({
                "error": "Estado de servicio no válido"
            }), 400

        if nuevo_estado in {"asignado", "en_proceso"} and not servicio.tecnico_id:
            return jsonify({
                "error": "Debes asignar un técnico antes de usar ese estado"
            }), 409

        try:
            servicio.estado = nuevo_estado
            aplicar_fechas_por_estado(servicio, nuevo_estado)
            db.session.commit()

            mensajes = {
                "pendiente": "Servicio marcado como pendiente",
                "asignado": "Servicio marcado como asignado",
                "en_proceso": "Servicio marcado como en proceso",
                "realizado": "Servicio marcado como realizado",
                "cancelado": "Servicio cancelado correctamente",
            }

            return jsonify({
                "ok": True,
                "mensaje": mensajes.get(
                    nuevo_estado,
                    "Estado actualizado correctamente",
                ),
                "servicio": serializar_servicio_programado(servicio),
            }), 200

        except Exception as error:
            db.session.rollback()
            print("Error cambiando estado del servicio programado:", error)

            return jsonify({
                "error": "No se pudo cambiar el estado del servicio"
            }), 500


    @app.put("/api/admin/servicios/programados/<int:servicio_id>/vincular-real")
    @jwt_required()
    @rol_requerido("admin")
    def admin_vincular_servicio_real(servicio_id):
        programado = db.session.get(ServicioProgramado, servicio_id)

        if not programado:
            return jsonify({
                "error": "Servicio programado no encontrado"
            }), 404

        data = request.get_json(silent=True) or {}

        try:
            servicio_real_id = int(data.get("servicio_id"))
        except (TypeError, ValueError):
            return jsonify({
                "error": "servicio_id debe ser válido"
            }), 400

        servicio_real = db.session.get(Servicio, servicio_real_id)

        if not servicio_real:
            return jsonify({
                "error": "Servicio real no encontrado"
            }), 404

        if servicio_real.empresa_id != programado.empresa_id:
            return jsonify({
                "error": "El servicio real no pertenece a la misma empresa"
            }), 409

        try:
            programado.servicio_id = servicio_real.id
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Servicio real vinculado correctamente",
                "servicio": serializar_servicio_programado(programado),
            }), 200

        except Exception as error:
            db.session.rollback()
            print("Error vinculando servicio real:", error)

            return jsonify({
                "error": "No se pudo vincular el servicio real"
            }), 500