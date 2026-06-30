# ============================================================
# DECORATORS - TrackSecurity
# ============================================================
#
# Decoradores reutilizables para proteger rutas.
# ============================================================

from functools import wraps
from flask import jsonify

from helpers import obtener_usuario_actual


# ------------------------------------------------------------
# Valida que el usuario tenga uno de los roles permitidos.
#
# Se usa actualmente en rutas de:
# - vehículos
# - usuarios
# - configuración
# - dispositivos
# - planes/servicios
#
# Importante:
# Debe ir después de @jwt_required().
#
# Ejemplo:
# @jwt_required()
# @rol_requerido("dueno", "admin")
# def crear_vehiculo():
#     ...
# ------------------------------------------------------------
def rol_requerido(*roles_permitidos):
    def decorador(funcion):
        @wraps(funcion)
        def wrapper(*args, **kwargs):
            usuario = obtener_usuario_actual()

            if not usuario:
                return jsonify({"error": "usuario no encontrado"}), 401

            if usuario.tipo not in roles_permitidos:
                return jsonify({"error": "acceso denegado para tu rol"}), 403

            return funcion(*args, **kwargs)

        return wrapper

    return decorador
