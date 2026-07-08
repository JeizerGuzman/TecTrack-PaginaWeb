# ============================================================
# REGISTRO DE RUTAS - TrackSecurity
# ============================================================
#
# Este archivo conecta todos los módulos de routes/ con app.py.
#
# Elegimos funciones registrar_*_routes(app) en lugar de Blueprints
# para mantener los nombres de endpoints como estaban antes.
# Así evitamos romper templates que usen url_for("login_view") o similares.
# ============================================================

from .frontend import registrar_frontend_routes
from .auth import registrar_auth_routes
from .dashboard import registrar_dashboard_routes
from .esp32 import registrar_esp32_routes
from .vehiculos import registrar_vehiculos_routes
from .alertas import registrar_alertas_routes
from .historial import registrar_historial_routes
from .dispositivos import registrar_dispositivos_routes
from .usuarios import registrar_usuarios_routes
from .configuracion import registrar_configuracion_routes
from .planes import registrar_planes_routes
from .push import registrar_push_routes
from .tecnico import registrar_tecnico_routes


# ------------------------------------------------------------
# Registra todas las rutas del sistema.
#
# Se usa actualmente en:
# - app.py
# ------------------------------------------------------------
def registrar_rutas(app):
    registrar_frontend_routes(app)
    registrar_auth_routes(app)
    registrar_dashboard_routes(app)
    registrar_esp32_routes(app)
    registrar_vehiculos_routes(app)
    registrar_alertas_routes(app)
    registrar_historial_routes(app)
    registrar_dispositivos_routes(app)
    registrar_usuarios_routes(app)
    registrar_configuracion_routes(app)
    registrar_planes_routes(app)
    registrar_push_routes(app)
    registrar_tecnico_routes(app)
