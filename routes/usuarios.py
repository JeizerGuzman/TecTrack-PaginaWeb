# ============================================================
# ROUTES USUARIOS - TrackSecurity
# ============================================================
#
# Endpoints para administrar choferes y supervisores.
# ============================================================

from flask import request, jsonify
from flask_jwt_extended import jwt_required

from config import db
from models import Usuario, Vehiculo
from decorators import rol_requerido
from helpers import obtener_usuario_actual, hashear_password
from serializers import serializar_usuario


# ------------------------------------------------------------
# Registra rutas de usuarios.
# ------------------------------------------------------------
def registrar_usuarios_routes(app):

    # Lista choferes y supervisores de la empresa.
    #
    # Se usa actualmente en:
    # - static/js/dueno/usuarios/index.js
    @app.route("/api/usuarios", methods=["GET"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def listar_usuarios_empresa():
        usuario = obtener_usuario_actual()

        if not usuario:
            return jsonify({"error": "sesión no válida"}), 401

        usuarios = Usuario.query.filter(
            Usuario.empresa_id == usuario.empresa_id,
            Usuario.tipo.in_(["chofer", "supervisor"])
        ).order_by(Usuario.id.desc()).all()

        return jsonify({
            "usuarios": [serializar_usuario(u) for u in usuarios]
        }), 200

    # Crea un usuario de tipo chofer o supervisor.
    #
    # Se usa actualmente en:
    # - static/js/dueno/usuarios/nuevo.js
    #
    # También podría usarse después en:
    # - app móvil del dueño
    @app.route("/api/usuarios", methods=["POST"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def crear_usuario_empresa():
        try:
            usuario_actual = obtener_usuario_actual()

            if not usuario_actual:
                return jsonify({"error": "sesión no válida"}), 401

            data = request.get_json(silent=True) or {}

            nombre = data.get("nombre", "").strip()
            correo = data.get("correo", "").strip().lower()
            telefono = data.get("telefono", "").strip()
            password = data.get("password", "").strip()
            tipo = data.get("tipo", "").strip()

            if not nombre or not correo or not password or not tipo:
                return jsonify({
                    "error": "nombre, correo, password y tipo son requeridos"
                }), 400

            if tipo not in ("chofer", "supervisor"):
                return jsonify({"error": "tipo de usuario no válido"}), 400

            existe = Usuario.query.filter_by(correo=correo).first()
            if existe:
                return jsonify({"error": "ya existe un usuario con ese correo"}), 409

            nuevo_usuario = Usuario(
                nombre=nombre,
                correo=correo,
                telefono=telefono,
                password=hashear_password(password),
                tipo=tipo,
                empresa_id=usuario_actual.empresa_id,
                activo=True,
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

    # Obtiene un usuario específico para edición.
    #
    # Se usa actualmente en:
    # - static/js/dueno/usuarios/editar.js
    @app.route("/api/usuarios/<int:usuario_id>", methods=["GET"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def obtener_usuario_empresa(usuario_id):
        usuario_actual = obtener_usuario_actual()
        usuario = db.session.get(Usuario, usuario_id)

        if not usuario:
            return jsonify({"error": "usuario no encontrado"}), 404

        if usuario.empresa_id != usuario_actual.empresa_id:
            return jsonify({"error": "no tienes acceso a este usuario"}), 403

        if usuario.tipo not in ("chofer", "supervisor"):
            return jsonify({"error": "no puedes editar este tipo de usuario"}), 403

        return jsonify({"usuario": serializar_usuario(usuario)}), 200

    # Edita datos de un usuario chofer/supervisor.
    #
    # Se usa actualmente en:
    # - static/js/dueno/usuarios/editar.js
    @app.route("/api/usuarios/<int:usuario_id>", methods=["PUT"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def editar_usuario_empresa(usuario_id):
        usuario_actual = obtener_usuario_actual()
        usuario = db.session.get(Usuario, usuario_id)

        if not usuario:
            return jsonify({"error": "usuario no encontrado"}), 404

        if usuario.empresa_id != usuario_actual.empresa_id:
            return jsonify({"error": "no tienes acceso a este usuario"}), 403

        if usuario.tipo not in ("chofer", "supervisor"):
            return jsonify({"error": "no puedes editar este tipo de usuario"}), 403

        data = request.get_json(silent=True) or {}

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

        if usuario.tipo == "chofer" and tipo != "chofer":
            vehiculo_asignado = Vehiculo.query.filter_by(
                chofer_id=usuario.id,
                activo=True
            ).first()

            if vehiculo_asignado:
                return jsonify({
                    "error": (
                        f"No puedes cambiar el rol de este chofer porque está "
                        f"asignado al vehículo {vehiculo_asignado.nombre}"
                    )
                }), 409
        
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

    # Desactiva un usuario sin eliminarlo.
    #
    # Se usa actualmente en:
    # - static/js/dueno/usuarios/index.js
    @app.route("/api/usuarios/<int:usuario_id>/desactivar", methods=["PUT"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def desactivar_usuario_empresa(usuario_id):
        usuario_actual = obtener_usuario_actual()

        if not usuario_actual:
            return jsonify({"error": "sesión no válida"}), 401

        usuario = db.session.get(Usuario, usuario_id)

        if not usuario:
            return jsonify({"error": "usuario no encontrado"}), 404

        if usuario.empresa_id != usuario_actual.empresa_id:
            return jsonify({"error": "no tienes acceso a este usuario"}), 403

        if usuario.id == usuario_actual.id:
            return jsonify({"error": "no puedes desactivar tu propia cuenta"}), 400

        usuario.activo = False
        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "usuario desactivado correctamente"
        }), 200

    # Reactiva un usuario previamente desactivado.
    #
    # Se usa actualmente en:
    # - módulo usuarios, si tienes botón reactivar
    @app.route("/api/usuarios/<int:usuario_id>/reactivar", methods=["PUT"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
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

    # Reinicia la contraseña de un chofer/supervisor.
    #
    # Se usa actualmente en:
    # - módulo usuarios si tienes botón reset password
    @app.route("/api/usuarios/<int:usuario_id>/reset-password", methods=["PUT"])
    @jwt_required()
    @rol_requerido("dueno", "admin")
    def reset_password_usuario_empresa(usuario_id):
        usuario_actual = obtener_usuario_actual()
        usuario = db.session.get(Usuario, usuario_id)

        if not usuario:
            return jsonify({"error": "usuario no encontrado"}), 404

        if usuario.empresa_id != usuario_actual.empresa_id:
            return jsonify({"error": "no tienes acceso a este usuario"}), 403

        if usuario.tipo not in ("chofer", "supervisor"):
            return jsonify({"error": "no puedes cambiar contraseña de este usuario"}), 403

        data = request.get_json(silent=True) or {}
        nueva_password = data.get("password", "").strip()

        if len(nueva_password) < 6:
            return jsonify({
                "error": "la contraseña debe tener al menos 6 caracteres"
            }), 400

        try:
            usuario.password = hashear_password(nueva_password)
            db.session.commit()

            return jsonify({
                "ok": True,
                "mensaje": "contraseña actualizada correctamente"
            }), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500

    # Lista choferes disponibles para asignar a vehículo.
    #
    # Se usa actualmente en:
    # - static/js/dueno/vehiculos/nuevo.js
    # - static/js/dueno/vehiculos/editar.js
    @app.route("/api/choferes", methods=["GET"])
    @jwt_required()
    @rol_requerido("dueno", "admin", "supervisor")
    def listar_choferes_empresa():
        usuario_actual = obtener_usuario_actual()
        vehiculo_id = request.args.get("vehiculo_id", type=int)

        choferes_ocupados_query = Vehiculo.query.filter(
            Vehiculo.empresa_id == usuario_actual.empresa_id,
            Vehiculo.activo == True,
            Vehiculo.chofer_id.isnot(None)
        )

        # En editar permitimos que aparezca el chofer del mismo vehículo.
        if vehiculo_id:
            choferes_ocupados_query = choferes_ocupados_query.filter(
                Vehiculo.id != vehiculo_id
            )

        choferes_ocupados_ids = [
            v.chofer_id for v in choferes_ocupados_query.all()
        ]

        consulta = Usuario.query.filter(
            Usuario.empresa_id == usuario_actual.empresa_id,
            Usuario.tipo == "chofer",
            Usuario.activo == True,
        )

        if choferes_ocupados_ids:
            consulta = consulta.filter(~Usuario.id.in_(choferes_ocupados_ids))

        choferes = consulta.order_by(Usuario.nombre.asc()).all()

        return jsonify({
            "choferes": [
                {
                    "id": c.id,
                    "nombre": c.nombre,
                    "correo": c.correo,
                    "telefono": c.telefono,
                }
                for c in choferes
            ]
        }), 200
