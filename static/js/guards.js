// ============================================================
// GUARDS GLOBAL - TrackSecurity
// Protege páginas privadas por sesión y rol.
// ============================================================

window.TrackGuards = {
    requireAuth(requiredRole = null) {
        if (!window.TrackAuth) {
            console.error('TrackAuth no está cargado. Revisa el orden de scripts.');
            window.location.href = '/login';
            return false;
        }

        if (!TrackAuth.isLoggedIn()) {
            window.location.href = '/login';
            return false;
        }

        if (requiredRole) {
            const role = TrackAuth.getRole();

            if (role && role !== requiredRole) {
                console.warn(`Rol incorrecto. Requerido: ${requiredRole}. Actual: ${role}`);
                TrackAuth.redirectByRole();
                return false;
            }
        }

        return true;
    },

    redirectIfLoggedIn() {
        if (window.TrackAuth && TrackAuth.isLoggedIn()) {
            TrackAuth.redirectByRole();
            return true;
        }
        return false;
    }
};
