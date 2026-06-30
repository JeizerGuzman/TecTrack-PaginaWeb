# ==================================================================
# TRACKSECURITY - BACKEND FLASK (API REST)
# ==================================================================
#
# Archivo principal del servidor.
#
# Aquí solo se hace lo más importante:
# 1. Crear la aplicación Flask.
# 2. Cargar configuración.
# 3. Inicializar base de datos, CORS y JWT.
# 4. Registrar todas las rutas separadas en la carpeta routes/.
# 5. Crear tablas y datos iniciales.
# 6. Arrancar el servidor.
#
# La lógica grande ya NO va aquí.
# Ahora está separada en:
# - helpers.py
# - serializers.py
# - decorators.py
# - routes/*.py
# ==================================================================

import os

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import db, Config
from models import crear_datos_iniciales
from routes import registrar_rutas


# ==================================================================
# CONFIGURACIÓN DE LA APLICACIÓN
# ==================================================================

app = Flask(__name__)
app.config.from_object(Config)

# Clave secreta para firmar JWT.
# En producción conviene configurarla en variables de entorno.
app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY",
    "cambia-esta-clave-en-produccion"
)

# Inicialización de extensiones principales.
db.init_app(app)
CORS(app)
jwt = JWTManager(app)

# Registro de rutas separadas por módulos.
# Aquí se conectan routes/auth.py, routes/vehiculos.py, etc.
registrar_rutas(app)


# ==================================================================
# CREACIÓN DE TABLAS Y DATOS INICIALES
# ==================================================================
#
# db.create_all(): crea tablas si no existen.
# crear_datos_iniciales(): crea planes, empresa demo y usuarios demo.
#
# Nota:
# Esto está bien para desarrollo y demostración.
# En producción normalmente se usarían migraciones con Flask-Migrate.
# ==================================================================

with app.app_context():
    db.create_all()
    crear_datos_iniciales()


# ==================================================================
# EJECUCIÓN DEL SERVIDOR
# ==================================================================
#
# host='0.0.0.0' permite que el ESP32 y otros dispositivos de la red
# puedan conectarse usando la IP de tu computadora.
# ==================================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
