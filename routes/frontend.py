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
        return render_template("dueno/historial.html")

    # Pantalla de reportes. Puede seguir vacía si aún no se desarrolla.
    @app.get("/dueno/reportes")
    def dueno_reportes():
        return render_template("dueno/reportes.html")

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
