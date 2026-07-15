# ============================================================
# ROUTES FRONTEND - TrackSecurity
# ============================================================
#
# Rutas que renderizan páginas HTML.
#
# Rodrigo probablemente tocará más:
# - templates/
# - static/css/
# - static/js/
#
# Estas rutas NO devuelven datos JSON.
# La información real se consulta desde endpoints /api.
# ============================================================

from flask import render_template, redirect, url_for


# ------------------------------------------------------------
# Registra las vistas HTML principales.
#
# Se usa actualmente en:
# - app.py mediante routes.registrar_rutas(app)
# ------------------------------------------------------------
def registrar_frontend_routes(app):

    # Redirige la raíz del sistema al login.
    @app.route("/")
    def home():
        return redirect(url_for("login_view"))

    # Muestra la pantalla de inicio de sesión.
    @app.get("/login")
    def login_view():
        return render_template("auth/login.html")

    # Muestra la pantalla de registro.
    @app.get("/registro")
    def registro_view():
        return render_template("auth/registro.html")

    # Redirige al login. El token realmente se elimina en frontend.
    @app.get("/logout")
    def logout_view():
        return redirect(url_for("login_view"))

    # Redirige /dueno hacia el dashboard.
    @app.get("/dueno")
    def dueno_home():
        return redirect(url_for("dueno_dashboard"))

    # Página principal del dueño/admin.
    @app.get("/dueno/dashboard")
    def dueno_dashboard():
        return render_template("dueno/dashboard.html")

    # Listado de vehículos.
    @app.get("/dueno/vehiculos")
    def dueno_vehiculos():
        return render_template("dueno/vehiculos/index.html")

    # Formulario para crear vehículo.
    @app.get("/dueno/vehiculos/nuevo")
    def dueno_vehiculo_nuevo():
        return render_template("dueno/vehiculos/nuevo.html")

    # Detalle de un vehículo.
    @app.get("/dueno/vehiculos/<int:vehiculo_id>")
    def dueno_vehiculo_detalle(vehiculo_id):
        return render_template(
            "dueno/vehiculos/detalle.html",
            vehiculo_id=vehiculo_id
        )

    # Formulario para editar vehículo.
    @app.get("/dueno/vehiculos/<int:vehiculo_id>/editar")
    def dueno_vehiculo_editar(vehiculo_id):
        return render_template(
            "dueno/vehiculos/editar.html",
            vehiculo_id=vehiculo_id
        )

    # Pantalla de alertas.
    @app.get("/dueno/alertas")
    def dueno_alertas():
        return render_template("dueno/alertas/index.html")

    # Pantalla de historial.
    @app.get("/dueno/historial")
    def dueno_historial():
        return render_template("dueno/historial/index.html")

    # Pantalla de reportes. Puede seguir vacía si aún no se desarrolla.
    @app.get("/dueno/reportes")
    def dueno_reportes():
        return render_template("dueno/reportes/index.html")

    # Listado de usuarios.
    @app.get("/dueno/usuarios")
    def dueno_usuarios():
        return render_template("dueno/usuarios/index.html")

    # Formulario para crear usuario.
    @app.get("/dueno/usuarios/nuevo")
    def dueno_usuario_nuevo():
        return render_template("dueno/usuarios/nuevo.html")

    # Formulario para editar usuario.
    @app.get("/dueno/usuarios/<int:usuario_id>/editar")
    def dueno_usuario_editar(usuario_id):
        return render_template(
            "dueno/usuarios/editar.html",
            usuario_id=usuario_id
        )

    # Pantalla de configuración.
    @app.get("/dueno/configuracion")
    def dueno_configuracion():
        return render_template("dueno/configuracion/index.html")

    # Pantalla para editar configuración.
    @app.get("/dueno/configuracion/editar")
    def dueno_configuracion_editar():
        return render_template("dueno/configuracion/editar.html")

    
    
    # ========================================================
    # VISTAS SUPERVISOR
    # ========================================================

    # Redirige /supervisor hacia el dashboard.
    @app.get("/supervisor")
    def supervisor_home():
        return redirect(
            url_for(
                "supervisor_dashboard"
            )
        )


    # Dashboard principal del supervisor.
    @app.get("/supervisor/dashboard")
    def supervisor_dashboard():
        return render_template(
            "supervisor/dashboard.html"
        )


    # Monitoreo operativo en vivo.
    @app.get("/supervisor/monitoreo")
    def supervisor_monitoreo():
        return render_template(
            "supervisor/monitoreo/index.html"
        )


    # Listado de vehículos en modo consulta.
    @app.get("/supervisor/vehiculos")
    def supervisor_vehiculos():
        return render_template(
            "supervisor/vehiculos/index.html"
        )


    # Detalle de vehículo en modo consulta.
    @app.get(
        "/supervisor/vehiculos/<int:vehiculo_id>"
    )
    def supervisor_vehiculo_detalle(
        vehiculo_id
    ):
        return render_template(
            "supervisor/vehiculos/detalle.html",
            vehiculo_id=vehiculo_id
        )


    # Alertas del supervisor.
    @app.get("/supervisor/alertas")
    def supervisor_alertas():
        return render_template(
            "supervisor/alertas/index.html"
        )


    # Historial operativo.
    @app.get("/supervisor/historial")
    def supervisor_historial():
        return render_template(
            "supervisor/historial/index.html"
        )


    # Reportes.
    @app.get("/supervisor/reportes")
    def supervisor_reportes():
        return render_template(
            "supervisor/reportes/index.html"
        )
    
    # ========================================================
    # VISTAS ADMIN
    # ========================================================
    # Estas rutas solo renderizan páginas HTML.
    # La seguridad real de datos está en los endpoints /api/admin
    # protegidos con JWT y rol admin.
    # ========================================================

    @app.get("/admin")
    def admin_home():
        return redirect(url_for("admin_dashboard"))

    @app.get("/admin/dashboard")
    def admin_dashboard():
        return render_template("admin/dashboard.html")

    @app.get("/admin/empresas")
    def admin_empresas():
        return render_template("admin/empresas/index.html")

    @app.get("/admin/usuarios")
    def admin_usuarios():
        return render_template("admin/usuarios/index.html")

    @app.get("/admin/planes")
    def admin_planes():
        return render_template("admin/planes/index.html")

    @app.get("/admin/vehiculos")
    def admin_vehiculos_page():
        return render_template(
            "admin/vehiculos/index.html"
        )
        
    @app.get("/admin/vehiculos/<int:vehiculo_id>")
    def admin_vehiculo_detalle_page(vehiculo_id):
        return render_template(
            "admin/vehiculos/detalle.html",
            vehiculo_id=vehiculo_id
        )
    
    @app.get("/admin/dispositivos")
    def admin_dispositivos():
        return render_template("admin/dispositivos/index.html")

    @app.get("/admin/suscripciones")
    def admin_suscripciones():
        return render_template("admin/suscripciones/index.html")

    @app.get("/admin/servicios")
    def admin_servicios():
        return render_template("admin/servicios/index.html")

    @app.get("/admin/alertas")
    def admin_alertas():
        return render_template("admin/alertas/index.html")

    @app.get("/admin/configuracion")
    def admin_configuracion():
        return render_template("admin/configuracion/index.html")