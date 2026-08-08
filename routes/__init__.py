# ============================================================
# REGISTRO DE RUTAS - TrackSecurity
# ============================================================

from .frontend import registrar_frontend_routes
from .auth import registrar_auth_routes
from .dashboard import registrar_dashboard_routes
from .esp32 import registrar_esp32_routes
from .vehiculos import registrar_vehiculos_routes
from .alertas import registrar_alertas_routes
from .historial import registrar_historial_routes
from .reportes import registrar_reportes_routes
from .dispositivos import registrar_dispositivos_routes
from .usuarios import registrar_usuarios_routes
from .configuracion import registrar_configuracion_routes
from .tutoriales import registrar_tutoriales_routes
from .planes import registrar_planes_routes
from .push import registrar_push_routes
from .tecnico import registrar_tecnico_routes
from .paquetes import registrar_paquetes_routes
from .recorridos import registrar_recorridos_routes
from .evidencia import registrar_evidencia_routes

# Rutas de Administración
from .admin_suscripciones import registrar_admin_suscripciones_routes 
from .admin_servicios import registrar_admin_servicios_routes
from .admin_alertas import registrar_admin_alertas_routes
from .admin_vehiculos import registrar_admin_vehiculos_routes
from .admin_configuracion import registrar_admin_configuracion_routes

# Nuevas rutas modulares (Reemplazan a admin.py)
from .admin_resumen import registrar_admin_resumen_routes
from .admin_empresas import registrar_admin_empresas_routes
from .admin_planes import registrar_admin_planes_routes
from .admin_dispositivos import registrar_admin_dispositivos_routes
from .admin_usuarios import registrar_admin_usuarios_routes

def registrar_rutas(app):
    registrar_frontend_routes(app)
    registrar_auth_routes(app)
    registrar_dashboard_routes(app)
    registrar_esp32_routes(app)
    registrar_vehiculos_routes(app)
    registrar_alertas_routes(app)
    registrar_historial_routes(app)
    registrar_reportes_routes(app)
    registrar_dispositivos_routes(app)
    registrar_usuarios_routes(app)
    registrar_configuracion_routes(app)
    registrar_tutoriales_routes(app)
    registrar_planes_routes(app)
    registrar_push_routes(app)
    registrar_tecnico_routes(app)
    registrar_paquetes_routes(app)
    registrar_recorridos_routes(app)
    registrar_evidencia_routes(app)

    # Modulares de Admin
    registrar_admin_suscripciones_routes(app)
    registrar_admin_servicios_routes(app)
    registrar_admin_alertas_routes(app)
    registrar_admin_vehiculos_routes(app)
    registrar_admin_configuracion_routes(app)
    
    # Nuevos modulares
    registrar_admin_resumen_routes(app)
    registrar_admin_empresas_routes(app)
    registrar_admin_planes_routes(app)
    registrar_admin_dispositivos_routes(app)
    registrar_admin_usuarios_routes(app)
    
