from flask import jsonify, request
from flask_jwt_extended import jwt_required
from config import db
from decorators import rol_requerido
from models import Usuario, Empresa, Vehiculo
from helpers import hashear_password, obtener_usuario_actual

# ============================================================
# FUNCIONES AUXILIARES
# ============================================================
def serializar_usuario_admin(usuario):
    empresa = db.session.get(Empresa, usuario.empresa_id) if usuario.empresa_id else None
    return {
        "id": usuario.id, "nombre": usuario.nombre, "correo": usuario.correo,
        "telefono": usuario.telefono, "tipo": usuario.tipo, "empresa_id": usuario.empresa_id,
        "empresa_nombre": empresa.nombre if empresa else None, "activo": usuario.activo,
        "fecha_creacion": usuario.fecha_creacion,
    }

def contar_administradores_activos():
    return Usuario.query.filter_by(tipo="admin", activo=True).count()

# ============================================================
# RUTAS DE USUARIOS
# ============================================================
def registrar_admin_usuarios_routes(app):
    @app.get("/api/admin/usuarios")
    @jwt_required()
    @rol_requerido("admin")
    def admin_listar_usuarios():
        usuarios = Usuario.query.order_by(Usuario.id.desc()).all()
        return jsonify({"ok": True, "usuarios": [serializar_usuario_admin(u) for u in usuarios]}), 200

    @app.get("/api/admin/usuarios/<int:usuario_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_obtener_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)
        if not usuario: return jsonify({"error": "Usuario no encontrado"}), 404
        return jsonify({"ok": True, "usuario": serializar_usuario_admin(usuario)}), 200

    @app.post("/api/admin/usuarios")
    @jwt_required()
    @rol_requerido("admin")
    def admin_crear_usuario():
        data = request.get_json(silent=True) or {}
        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        telefono = data.get("telefono", "").strip()
        password = data.get("password", "").strip()
        tipo = data.get("tipo", "").strip().lower()
        empresa_id = data.get("empresa_id")

        if not nombre or not correo or not password: return jsonify({"error": "Faltan datos requeridos"}), 400
        if len(password) < 6: return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
        if tipo not in ["admin", "dueno", "supervisor", "chofer", "tecnico"]: return jsonify({"error": "Tipo no válido"}), 400
        if Usuario.query.filter_by(correo=correo).first(): return jsonify({"error": "El correo ya existe"}), 409

        if tipo in ("dueno", "supervisor", "chofer"):
            if not empresa_id: return jsonify({"error": "Debes seleccionar una empresa para este usuario"}), 400
            if not db.session.get(Empresa, int(empresa_id)): return jsonify({"error": "Empresa no existe"}), 404
        else:
            empresa_id = None

        try:
            nuevo_usuario = Usuario(
                nombre=nombre, correo=correo, telefono=telefono or None,
                password=hashear_password(password), tipo=tipo,
                empresa_id=int(empresa_id) if empresa_id else None, activo=True,
            )
            db.session.add(nuevo_usuario)
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Usuario creado", "usuario": serializar_usuario_admin(nuevo_usuario)}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo crear el usuario"}), 500

    @app.put("/api/admin/usuarios/<int:usuario_id>")
    @jwt_required()
    @rol_requerido("admin")
    def admin_editar_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)
        if not usuario: return jsonify({"error": "Usuario no encontrado"}), 404
        usuario_actual = obtener_usuario_actual()
        if not usuario_actual: return jsonify({"error": "Sesión no válida"}), 401

        data = request.get_json(silent=True) or {}
        nombre = data.get("nombre", "").strip()
        correo = data.get("correo", "").strip().lower()
        telefono = data.get("telefono", "").strip()
        tipo = data.get("tipo", "").strip().lower()
        empresa_id = data.get("empresa_id")

        if not nombre or not correo: return jsonify({"error": "Nombre y correo son requeridos"}), 400
        if tipo not in ["admin", "dueno", "supervisor", "chofer", "tecnico"]: return jsonify({"error": "Tipo no válido"}), 400
        if usuario.id == usuario_actual.id and usuario.tipo != tipo: return jsonify({"error": "No puedes cambiar tu propio rol"}), 409
        if usuario.tipo == "admin" and usuario.activo and tipo != "admin" and contar_administradores_activos() <= 1:
            return jsonify({"error": "No puedes quitar al último administrador activo"}), 409
        if Usuario.query.filter(Usuario.correo == correo, Usuario.id != usuario.id).first():
            return jsonify({"error": "Ya existe otro usuario con ese correo"}), 409

        if usuario.tipo == "chofer" and tipo != "chofer":
            vehiculo = Vehiculo.query.filter_by(chofer_id=usuario.id, activo=True).first()
            if vehiculo: return jsonify({"error": f"El chofer está asignado al vehículo {vehiculo.nombre}"}), 409

        if tipo in ("dueno", "supervisor", "chofer"):
            if not empresa_id: return jsonify({"error": "Debes seleccionar una empresa para este usuario"}), 400
            if not db.session.get(Empresa, int(empresa_id)): return jsonify({"error": "Empresa no existe"}), 404
        else:
            empresa_id = None

        try:
            usuario.nombre = nombre
            usuario.correo = correo
            usuario.telefono = telefono or None
            usuario.tipo = tipo
            usuario.empresa_id = int(empresa_id) if empresa_id else None
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Usuario actualizado", "usuario": serializar_usuario_admin(usuario)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo actualizar el usuario"}), 500

    @app.put("/api/admin/usuarios/<int:usuario_id>/desactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_desactivar_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)
        if not usuario: return jsonify({"error": "Usuario no encontrado"}), 404
        usuario_actual = obtener_usuario_actual()
        if usuario.id == usuario_actual.id: return jsonify({"error": "No puedes desactivar tu propia cuenta"}), 409
        if usuario.tipo == "admin" and usuario.activo and contar_administradores_activos() <= 1:
            return jsonify({"error": "Es el último administrador activo"}), 409

        try:
            usuario.activo = False
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Usuario desactivado correctamente"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo desactivar el usuario"}), 500

    @app.put("/api/admin/usuarios/<int:usuario_id>/reactivar")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reactivar_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)
        if not usuario: return jsonify({"error": "Usuario no encontrado"}), 404
        try:
            usuario.activo = True
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Usuario reactivado", "usuario": serializar_usuario_admin(usuario)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo reactivar el usuario"}), 500

    @app.put("/api/admin/usuarios/<int:usuario_id>/reset-password")
    @jwt_required()
    @rol_requerido("admin")
    def admin_reset_password_usuario(usuario_id):
        usuario = db.session.get(Usuario, usuario_id)
        if not usuario: return jsonify({"error": "Usuario no encontrado"}), 404
        data = request.get_json(silent=True) or {}
        nueva_password = data.get("password", "").strip()

        if len(nueva_password) < 6: return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
        try:
            usuario.password = hashear_password(nueva_password)
            db.session.commit()
            return jsonify({"ok": True, "mensaje": "Contraseña actualizada correctamente"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "No se pudo actualizar la contraseña"}), 500