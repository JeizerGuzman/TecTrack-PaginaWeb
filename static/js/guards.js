// ============================================================
// GUARDS GLOBAL - TrackSecurity
// Protege páginas privadas por sesión y rol.
// ============================================================

window.TrackGuards = {
    // ========================================================
    // CONFIGURACIÓN DE ROLES BLOQUEADOS EN WEB
    // ========================================================
    // Técnico queda bloqueado en web porque su módulo será móvil.
    //
    // Si después quieres bloquear también al chofer,
    // descomenta "chofer".
    // ========================================================

    rolesNoPermitidosWeb: [
        "tecnico",

        // Descomenta esta línea si el chofer será solo para app móvil:
        // "chofer",
    ],

    mensajesRolesBloqueados: {
        tecnico: "El rol técnico solo está disponible desde la aplicación móvil.",
        chofer: "El rol chofer solo está disponible desde la aplicación móvil.",
    },

    // ========================================================
    // REQUIERE SESIÓN ACTIVA
    // ========================================================
    // Se usa en páginas privadas.
    //
    // Ejemplo:
    // await window.TrackGuards.requireAuth();
    //
    // También puede validar rol específico:
    // await window.TrackGuards.requireAuth("dueno");
    // ========================================================
    requireAuth(requiredRole = null) {
        if (!window.TrackAuth) {
            console.error("TrackAuth no está cargado. Revisa el orden de scripts.");
            window.location.href = "/login";
            return false;
        }

        if (!TrackAuth.isLoggedIn()) {
            window.location.href = "/login";
            return false;
        }

        const role = TrackAuth.getRole();

        // ====================================================
        // BLOQUEO GENERAL DE ROLES NO PERMITIDOS EN WEB
        // ====================================================
        // Esto evita que un técnico entre directo pegando una URL,
        // aunque haya iniciado sesión o tenga token guardado.
        // ====================================================
        if (this.rolesNoPermitidosWeb.includes(role)) {
            const mensaje = this.mensajesRolesBloqueados[role]
                || "Este rol no está disponible desde el panel web.";

            console.warn(`Acceso web bloqueado para rol: ${role}`);

            alert(mensaje);

            if (TrackAuth.logout) {
                TrackAuth.logout();
            } else {
                this.limpiarSesionWeb();
                window.location.href = "/login";
            }

            return false;
        }

        // ====================================================
        // VALIDACIÓN DE ROL ESPECÍFICO
        // ====================================================
        // Si una página pide un rol exacto y el usuario no lo tiene,
        // se redirige según su rol.
        // ====================================================
        if (requiredRole) {
            if (role && role !== requiredRole) {
                console.warn(`Rol incorrecto. Requerido: ${requiredRole}. Actual: ${role}`);
                TrackAuth.redirectByRole();
                return false;
            }
        }

        return true;
    },

    // ========================================================
    // REDIRIGE SI YA HAY SESIÓN
    // ========================================================
    // Se usa normalmente en login para evitar que un usuario
    // autenticado vuelva a ver la pantalla de login.
    // ========================================================
    redirectIfLoggedIn() {
        if (!window.TrackAuth || !TrackAuth.isLoggedIn()) {
            return false;
        }

        const role = TrackAuth.getRole();

        // Si el rol guardado no está permitido en web,
        // se limpia sesión y se queda en login.
        if (this.rolesNoPermitidosWeb.includes(role)) {
            const mensaje = this.mensajesRolesBloqueados[role]
                || "Este rol no está disponible desde el panel web.";

            console.warn(`Sesión web bloqueada para rol: ${role}`);

            alert(mensaje);

            if (TrackAuth.logout) {
                TrackAuth.logout();
            } else {
                this.limpiarSesionWeb();
                window.location.href = "/login";
            }

            return false;
        }

        TrackAuth.redirectByRole();
        return true;
    },

    // ========================================================
    // LIMPIA SESIÓN DEL NAVEGADOR
    // ========================================================
    // Se deja aquí como respaldo por si TrackAuth.logout()
    // no está disponible o cambia después.
    // ========================================================
    limpiarSesionWeb() {
        localStorage.removeItem("access_token");
        localStorage.removeItem("usuario");
        localStorage.removeItem("tracksecurity_token");
        localStorage.removeItem("tracksecurity_user");
    }
};