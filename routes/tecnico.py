# ============================================================
# ROUTES TÉCNICO - TrackSecurity
# ============================================================
#
# Endpoints usados principalmente por la app móvil del técnico.
#
# Permite:
# - Ver resumen técnico.
# - Buscar dispositivos.
# - Validar dispositivo por serie y PIN.
# - Buscar empresas.
# - Ver vehículos de una empresa.
# - Reemplazar dispositivos.
# - Consultar diagnóstico de dispositivo.
# - Buscar vehículos.
# ============================================================

from flask import request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from config import db
from models import (
    Empresa,
    Usuario,
    Vehiculo,
    Dispositivo,
    Servicio,
    Evento,
    UbicacionActual
)
from decorators import rol_requerido
from helpers import obtener_usuario_actual, timestamp_actual, registrar_evento
from serializers import (
    serializar_dispositivo,
    serializar_empresa,
    serializar_vehiculo_tecnico,
    serializar_diagnostico
)


def registrar_tecnico_routes(app):

    # --------------------------------------------------------
    # Devuelve resumen inicial para el panel técnico móvil.
    #
    # Se usa en:
    # - Pantalla Inicio de la app móvil técnico
    # --------------------------------------------------------
    @app.route("/api/tecnico/resumen", methods=["GET"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def tecnico_resumen():
        dispositivos_disponibles = Dispositivo.query.filter_by(
            estado="disponible"
        ).count()

        dispositivos_instalados = Dispositivo.query.filter(
            Dispositivo.estado.in_(["activo", "instalado"])
        ).count()

        dispositivos_mantenimiento = Dispositivo.query.filter_by(
            estado="mantenimiento"
        ).count()

        servicios = Servicio.query.order_by(
            Servicio.timestamp.desc()
        ).limit(10).all()

        instalaciones_recientes = [
            {
                "id": s.id,
                "empresa_id": s.empresa_id,
                "vehiculo_id": s.vehiculo_id,
                "dispositivo_id": s.dispositivo_id,
                "tipo": s.tipo,
                "descripcion": s.descripcion,
                "estado": s.estado,
                "timestamp": s.timestamp
            }
            for s in servicios
        ]

        return jsonify({
            "ok": True,
            "resumen": {
                "dispositivos_disponibles": dispositivos_disponibles,
                "dispositivos_instalados": dispositivos_instalados,
                "dispositivos_mantenimiento": dispositivos_mantenimiento,
                "instalaciones_recientes": instalaciones_recientes
            }
        }), 200

    # --------------------------------------------------------
    # Busca dispositivos por serie, imei, estado o modelo.
    #
    # Se usa en:
    # - Pantalla Buscar de la app móvil técnico
    # --------------------------------------------------------
    @app.route("/api/dispositivos/buscar", methods=["GET"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def buscar_dispositivos():
        query = request.args.get("query", "").strip()

        consulta = Dispositivo.query

        if query:
            busqueda = f"%{query}%"
            consulta = consulta.filter(
                or_(
                    Dispositivo.serie.ilike(busqueda),
                    Dispositivo.imei.ilike(busqueda),
                    Dispositivo.estado.ilike(busqueda),
                    Dispositivo.modelo.ilike(busqueda)
                )
            )

        dispositivos = consulta.order_by(
            Dispositivo.id.desc()
        ).limit(20).all()

        return jsonify({
            "ok": True,
            "dispositivos": [
                serializar_dispositivo(d) for d in dispositivos
            ]
        }), 200

    # --------------------------------------------------------
    # Valida un dispositivo por serie y PIN.
    #
    # Se usa antes de:
    # - instalación nueva
    # - cambio de dispositivo
    # --------------------------------------------------------
    @app.route("/api/dispositivos/validar", methods=["POST"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def validar_dispositivo():

        data = request.get_json(silent=True) or {}

        serie = data.get("serie", "").strip()
        pin_activacion = str(data.get("pin_activacion", "")).strip()

        if not serie or not pin_activacion:
            return jsonify({
                "error": "serie y pin_activacion son requeridos"
            }), 400

        dispositivo = Dispositivo.query.filter_by(serie=serie).first()

        if not dispositivo:
            return jsonify({"error": "dispositivo no encontrado"}), 404

        if str(dispositivo.pin_activacion).strip() != pin_activacion:
            return jsonify({"error": "PIN de activación incorrecto"}), 401

        vehiculo = Vehiculo.query.filter_by(
            dispositivo_id=dispositivo.id
        ).first()

        # Si el dispositivo está vinculado a un vehículo, no se puede usar
        # como dispositivo nuevo para instalación o cambio.
        if vehiculo:
            return jsonify({
                "ok": True,
                "mensaje": "dispositivo ya instalado",
                "instalado": True,
                "disponible_para_instalacion": False,
                "dispositivo": serializar_dispositivo(dispositivo),
                "vehiculo": {
                    "id": vehiculo.id,
                    "nombre": vehiculo.nombre,
                    "placa": vehiculo.placa,
                    "identificador": vehiculo.identificador
                }
            }), 200

        # Aunque no esté vinculado a un vehículo, solo se permite instalar
        # si su estado es disponible.
        if dispositivo.estado != "disponible":
            return jsonify({
                "ok": True,
                "mensaje": (
                    f"el dispositivo está en estado {dispositivo.estado} "
                    "y no puede instalarse"
                ),
                "instalado": False,
                "disponible_para_instalacion": False,
                "dispositivo": serializar_dispositivo(dispositivo)
            }), 200

        return jsonify({
            "ok": True,
            "mensaje": "dispositivo válido",
            "instalado": False,
            "disponible_para_instalacion": True,
            "dispositivo": serializar_dispositivo(dispositivo)
        }), 200

    # --------------------------------------------------------
    # Busca empresas por nombre, correo o teléfono.
    #
    # Se usa en:
    # - instalación nueva
    # - cambio de dispositivo
    # --------------------------------------------------------
    @app.route("/api/empresas/buscar", methods=["GET"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def buscar_empresas():
        query = request.args.get("query", "").strip()

        consulta = Empresa.query.filter_by(activo=True)

        if query:
            busqueda = f"%{query}%"
            consulta = consulta.filter(
                or_(
                    Empresa.nombre.ilike(busqueda),
                    Empresa.correo.ilike(busqueda),
                    Empresa.telefono.ilike(busqueda)
                )
            )

        empresas = consulta.order_by(
            Empresa.nombre.asc()
        ).limit(20).all()

        return jsonify({
            "ok": True,
            "empresas": [
                serializar_empresa(e) for e in empresas
            ]
        }), 200

    # --------------------------------------------------------
    # Devuelve vehículos de una empresa.
    #
    # Filtros:
    # - sin_dispositivo
    # - con_dispositivo
    # - todos
    #
    # Se usa en:
    # - selección de vehículo para instalación
    # - selección de vehículo para cambio de dispositivo
    # --------------------------------------------------------
    @app.route("/api/empresas/<int:empresa_id>/vehiculos", methods=["GET"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def vehiculos_por_empresa_tecnico(empresa_id):
        filtro = request.args.get("filtro", "sin_dispositivo").strip()

        empresa = db.session.get(Empresa, empresa_id)

        if not empresa:
            return jsonify({"error": "empresa no encontrada"}), 404

        consulta = Vehiculo.query.filter_by(
            empresa_id=empresa.id,
            activo=True
        )

        if filtro == "sin_dispositivo":
            consulta = consulta.filter(Vehiculo.dispositivo_id.is_(None))
        elif filtro == "con_dispositivo":
            consulta = consulta.filter(Vehiculo.dispositivo_id.isnot(None))
        elif filtro == "todos":
            pass
        else:
            return jsonify({
                "error": "filtro no válido. Usa sin_dispositivo, con_dispositivo o todos"
            }), 400

        vehiculos = consulta.order_by(Vehiculo.nombre.asc()).all()

        return jsonify({
            "ok": True,
            "empresa": {
                "id": empresa.id,
                "nombre": empresa.nombre
            },
            "filtro": filtro,
            "vehiculos": [
                serializar_vehiculo_tecnico(v) for v in vehiculos
            ]
        }), 200

    # --------------------------------------------------------
    # Reemplaza el dispositivo actual de un vehículo.
    #
    # Se usa en:
    # - flujo de cambio de dispositivo de la app móvil técnico
    # --------------------------------------------------------
    @app.route("/api/dispositivos/reemplazar", methods=["POST"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def reemplazar_dispositivo():
        usuario = obtener_usuario_actual()
        data = request.get_json(silent=True) or {}

        vehiculo_id = data.get("vehiculo_id")
        nueva_serie = data.get("nueva_serie", "").strip()
        pin_activacion = str(data.get("pin_activacion", "")).strip()
        estado_anterior = data.get(
            "estado_dispositivo_anterior",
            "mantenimiento"
        ).strip()
        motivo = data.get("motivo", "").strip()

        estados_permitidos = [
            "mantenimiento",
            "disponible",
            "desactivado"
        ]

        if estado_anterior not in estados_permitidos:
            return jsonify({
                "error": "estado_dispositivo_anterior no válido"
            }), 400

        if not vehiculo_id or not nueva_serie or not pin_activacion:
            return jsonify({
                "error": "vehiculo_id, nueva_serie y pin_activacion son requeridos"
            }), 400

        vehiculo = db.session.get(Vehiculo, int(vehiculo_id))

        if not vehiculo:
            return jsonify({"error": "vehículo no encontrado"}), 404

        if not vehiculo.dispositivo_id:
            return jsonify({
                "error": "el vehículo no tiene dispositivo actual para reemplazar"
            }), 400

        dispositivo_anterior = db.session.get(
            Dispositivo,
            vehiculo.dispositivo_id
        )

        nuevo_dispositivo = Dispositivo.query.filter_by(
            serie=nueva_serie
        ).first()

        if not nuevo_dispositivo:
            return jsonify({"error": "nuevo dispositivo no encontrado"}), 404
        
        if nuevo_dispositivo.id == dispositivo_anterior.id:
            return jsonify({
                "error": "el nuevo dispositivo no puede ser el mismo dispositivo actual"
            }), 400

        if str(nuevo_dispositivo.pin_activacion).strip() != pin_activacion:
            return jsonify({"error": "PIN de activación incorrecto"}), 401

        if nuevo_dispositivo.estado not in ["disponible"]:
            return jsonify({
                "error": "el nuevo dispositivo no está disponible"
            }), 409

        try:
            dispositivo_anterior.estado = estado_anterior

            # Cuando un dispositivo deja de estar instalado,
            # ya no queda asignado operativamente a ninguna empresa.
            # Esto aplica para mantenimiento, disponible y desactivado.
            dispositivo_anterior.empresa_id = None
            dispositivo_anterior.fecha_instalacion = None

            nuevo_dispositivo.empresa_id = vehiculo.empresa_id
            nuevo_dispositivo.estado = "activo"
            nuevo_dispositivo.fecha_instalacion = timestamp_actual()

            vehiculo.dispositivo_id = nuevo_dispositivo.id

            servicio = Servicio(
                empresa_id=vehiculo.empresa_id,
                vehiculo_id=vehiculo.id,
                dispositivo_id=nuevo_dispositivo.id,
                tipo="cambio_dispositivo",
                descripcion=(
                    f"Cambio de dispositivo en {vehiculo.nombre}. "
                    f"Anterior: {dispositivo_anterior.serie}. "
                    f"Nuevo: {nuevo_dispositivo.serie}. "
                    f"Motivo: {motivo or 'No especificado'}"
                ),
                estado="realizado",
                timestamp=timestamp_actual()
            )

            db.session.add(servicio)

            registrar_evento(
                vehiculo_id=vehiculo.id,
                tipo="dispositivo_reemplazado",
                descripcion=(
                    f"{usuario.nombre} reemplazó el dispositivo "
                    f"{dispositivo_anterior.serie} por {nuevo_dispositivo.serie}"
                )
            )

            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "dispositivo reemplazado correctamente",
                "vehiculo": serializar_vehiculo_tecnico(vehiculo),
                "dispositivo_anterior": serializar_dispositivo(dispositivo_anterior),
                "dispositivo_nuevo": serializar_dispositivo(nuevo_dispositivo)
            }), 200

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error reemplazando dispositivo: {e}")

            return jsonify({
                "error": "error interno al reemplazar dispositivo"
            }), 500


    # ========================================================
    # RETIRAR DISPOSITIVO DE UN VEHÍCULO
    # ========================================================
    #
    # Permite que un técnico o administrador retire físicamente
    # un dispositivo instalado sin reemplazarlo por otro.
    #
    # El vehículo queda sin dispositivo y el dispositivo retirado
    # puede pasar a:
    #
    # - disponible
    # - mantenimiento
    # - desactivado
    #
    # Al dejar de estar instalado:
    #
    # - empresa_id = None
    # - fecha_instalacion = None
    #
    # También se registra un servicio técnico y un evento
    # para mantener historial de la operación.
    # ========================================================
    @app.route("/api/dispositivos/retirar", methods=["POST"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def retirar_dispositivo():
        usuario = obtener_usuario_actual()
        data = request.get_json(silent=True) or {}

        # ----------------------------------------------------
        # OBTENER Y LIMPIAR DATOS RECIBIDOS
        # ----------------------------------------------------
        vehiculo_id = data.get("vehiculo_id")

        estado_dispositivo = str(
            data.get("estado_dispositivo", "")
        ).strip().lower()

        motivo = str(
            data.get("motivo", "")
        ).strip()

        # ----------------------------------------------------
        # ESTADOS PERMITIDOS DESPUÉS DEL RETIRO
        # ----------------------------------------------------
        estados_permitidos = {
            "disponible",
            "mantenimiento",
            "desactivado",
        }

        # ----------------------------------------------------
        # VALIDAR CAMPOS OBLIGATORIOS
        # ----------------------------------------------------
        if not vehiculo_id:
            return jsonify({
                "error": "vehiculo_id es requerido"
            }), 400

        if not estado_dispositivo:
            return jsonify({
                "error": "estado_dispositivo es requerido"
            }), 400

        if not motivo:
            return jsonify({
                "error": "motivo es requerido"
            }), 400

        # ----------------------------------------------------
        # VALIDAR ESTADO FINAL
        # ----------------------------------------------------
        if estado_dispositivo not in estados_permitidos:
            return jsonify({
                "error": (
                    "estado_dispositivo no válido. "
                    "Debe ser: disponible, mantenimiento "
                    "o desactivado"
                )
            }), 400

        # ----------------------------------------------------
        # VALIDAR ID DEL VEHÍCULO
        # ----------------------------------------------------
        try:
            vehiculo_id = int(vehiculo_id)
        except (TypeError, ValueError):
            return jsonify({
                "error": "vehiculo_id debe ser un número entero válido"
            }), 400

        # ----------------------------------------------------
        # BUSCAR VEHÍCULO
        # ----------------------------------------------------
        vehiculo = db.session.get(Vehiculo, vehiculo_id)

        if not vehiculo:
            return jsonify({
                "error": "vehículo no encontrado"
            }), 404

        # ----------------------------------------------------
        # VERIFICAR QUE TENGA DISPOSITIVO VINCULADO
        # ----------------------------------------------------
        if not vehiculo.dispositivo_id:
            return jsonify({
                "error": "el vehículo no tiene un dispositivo vinculado"
            }), 400

        # Guardamos el ID antes de quitarlo del vehículo.
        dispositivo_id = vehiculo.dispositivo_id

        # ----------------------------------------------------
        # BUSCAR DISPOSITIVO ACTUAL
        # ----------------------------------------------------
        dispositivo = db.session.get(
            Dispositivo,
            dispositivo_id
        )

        if not dispositivo:
            return jsonify({
                "error": (
                    "el vehículo tiene un dispositivo_id vinculado, "
                    "pero el dispositivo no existe"
                )
            }), 404

        # ----------------------------------------------------
        # GUARDAR DATOS ANTES DEL CAMBIO
        # ----------------------------------------------------
        empresa_id = vehiculo.empresa_id
        serie_dispositivo = dispositivo.serie
        nombre_vehiculo = vehiculo.nombre

        try:
            # =================================================
            # 1. DESVINCULAR DISPOSITIVO DEL VEHÍCULO
            # =================================================
            vehiculo.dispositivo_id = None

            # =================================================
            # 2. ACTUALIZAR DISPOSITIVO RETIRADO
            # =================================================
            dispositivo.estado = estado_dispositivo

            # Al dejar de estar instalado ya no pertenece
            # operativamente a una empresa.
            dispositivo.empresa_id = None

            # Ya no está instalado en ningún vehículo.
            dispositivo.fecha_instalacion = None

            # =================================================
            # 3. REGISTRAR SERVICIO TÉCNICO
            # =================================================
            descripcion_servicio = (
                f"Se retiró el dispositivo {serie_dispositivo} "
                f"del vehículo {nombre_vehiculo}. "
                f"Motivo: {motivo}"
            )

            servicio = Servicio(
                empresa_id=empresa_id,
                vehiculo_id=vehiculo.id,
                dispositivo_id=dispositivo.id,
                tipo="retiro_dispositivo",
                descripcion=descripcion_servicio,
                estado=estado_dispositivo,
                timestamp=timestamp_actual(),
            )

            db.session.add(servicio)

            # =================================================
            # 4. REGISTRAR EVENTO DEL VEHÍCULO
            # =================================================
            #
            # Esto es adicional al Servicio y permite que el retiro
            # también aparezca en la bitácora/eventos del vehículo.
            # =================================================
            nombre_usuario = (
                usuario.nombre
                if usuario
                else "Usuario desconocido"
            )

            registrar_evento(
                vehiculo_id=vehiculo.id,
                tipo="dispositivo_retirado",
                descripcion=(
                    f"{nombre_usuario} retiró el dispositivo "
                    f"{serie_dispositivo}. "
                    f"Estado final: {estado_dispositivo}. "
                    f"Motivo: {motivo}"
                ),
            )

            # =================================================
            # 5. CONFIRMAR CAMBIOS
            # =================================================
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "Dispositivo retirado correctamente",

                "dispositivo": {
                    "id": dispositivo.id,
                    "serie": dispositivo.serie,
                    "estado": dispositivo.estado,
                    "empresa_id": dispositivo.empresa_id,
                    "fecha_instalacion": dispositivo.fecha_instalacion,
                },

                "vehiculo": {
                    "id": vehiculo.id,
                    "nombre": vehiculo.nombre,
                    "placa": vehiculo.placa,
                    "dispositivo_id": vehiculo.dispositivo_id,
                }
            }), 200

        except Exception as e:
            db.session.rollback()

            print(
                f"❌ Error retirando dispositivo "
                f"{serie_dispositivo} del vehículo "
                f"{nombre_vehiculo}: {e}"
            )

            return jsonify({
                "error": "error interno al retirar el dispositivo"
            }), 500

    # --------------------------------------------------------
    # Devuelve diagnóstico técnico por serie del dispositivo.
    #
    # Se usa en:
    # - pantalla Diagnóstico de la app móvil técnico
    # --------------------------------------------------------
    @app.route("/api/dispositivos/<string:serie>/diagnostico", methods=["GET"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def diagnostico_dispositivo(serie):
        dispositivo = Dispositivo.query.filter_by(serie=serie).first()

        if not dispositivo:
            return jsonify({"error": "dispositivo no encontrado"}), 404

        vehiculo = Vehiculo.query.filter_by(
            dispositivo_id=dispositivo.id
        ).first()

        return jsonify({
            "ok": True,
            "dispositivo": serializar_dispositivo(dispositivo),
            "vehiculo": (
                {
                    "id": vehiculo.id,
                    "nombre": vehiculo.nombre,
                    "placa": vehiculo.placa,
                    "identificador": vehiculo.identificador
                }
                if vehiculo else None
            ),
            "diagnostico": serializar_diagnostico(dispositivo)
        }), 200

    # --------------------------------------------------------
    # Busca vehículos por nombre, placa o identificador.
    #
    # Se usa en:
    # - búsqueda técnica general
    # --------------------------------------------------------
    @app.route("/api/vehiculos/buscar", methods=["GET"])
    @jwt_required()
    @rol_requerido("tecnico", "admin")
    def buscar_vehiculos_tecnico():
        query = request.args.get("query", "").strip()
        empresa_id = request.args.get("empresa_id", type=int)

        consulta = Vehiculo.query.filter_by(activo=True)

        if empresa_id:
            consulta = consulta.filter(Vehiculo.empresa_id == empresa_id)

        if query:
            busqueda = f"%{query}%"
            consulta = consulta.filter(
                or_(
                    Vehiculo.nombre.ilike(busqueda),
                    Vehiculo.placa.ilike(busqueda),
                    Vehiculo.identificador.ilike(busqueda)
                )
            )

        vehiculos = consulta.order_by(
            Vehiculo.nombre.asc()
        ).limit(20).all()

        return jsonify({
            "ok": True,
            "vehiculos": [
                serializar_vehiculo_tecnico(v) for v in vehiculos
            ]
        }), 200