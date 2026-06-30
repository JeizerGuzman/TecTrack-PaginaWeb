# ============================================================
# ROUTES AUTH - TrackSecurity
# ============================================================
#
# Rutas de autenticación.
#
# Se usa actualmente en:
# - Login web
# - Login de app móvil cuando se implemente
# ============================================================

from flask import request, jsonify
from flask_jwt_extended import create_access_token

from models import Usuario
from helpers import verificar_password


# ------------------------------------------------------------
# Registra rutas de autenticación.
#
# Este archivo se conecta desde:
# - routes/__init__.py
#
# Endpoint creado:
# - POST /api/login
# ------------------------------------------------------------
def registrar_auth_routes(app):

    # --------------------------------------------------------
    # Inicia sesión y genera un JWT.
    #
    # Se usa actualmente en:
    # - static/js/auth/login.js
    #
    # También se usará después en:
    # - App móvil Flutter
    # --------------------------------------------------------
    @app.route("/api/login", methods=["POST"])
    def login():
        data = request.get_json(silent=True) or {}

        if "correo" not in data or "password" not in data:
            return jsonify({"error": "correo y password son requeridos"}), 400

        correo = data.get("correo", "").strip().lower()
        password = data.get("password", "")

        usuario = Usuario.query.filter_by(correo=correo).first()

        if not usuario or not verificar_password(password, usuario.password):
            return jsonify({"error": "correo o contraseña incorrectos"}), 401

        if not usuario.activo:
            return jsonify({
                "error": "usuario desactivado, contacta al administrador"
            }), 403

        access_token = create_access_token(
            identity=str(usuario.id),
            additional_claims={
                "tipo": usuario.tipo,
                "empresa_id": usuario.empresa_id,
            }
        )

        return jsonify({
            "ok": True,
            "access_token": access_token,
            "usuario": {
                "id": usuario.id,
                "nombre": usuario.nombre,
                "correo": usuario.correo,
                "tipo": usuario.tipo,
                "empresa_id": usuario.empresa_id,
            }
        }), 200