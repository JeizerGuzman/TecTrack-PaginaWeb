window.TrackAuth = {
    TOKEN_KEY: "access_token",
    USER_KEY: "ts_usuario",

    saveSession(data) {
        console.log("Respuesta login:", data);

        if (!data || !data.access_token) {
            console.error("El backend no devolvió access_token");
            return false;
        }

        localStorage.setItem(this.TOKEN_KEY, data.access_token);

        if (data.usuario) {
            localStorage.setItem(this.USER_KEY, JSON.stringify(data.usuario));
        }

        return true;
    },

    getToken() {
        return localStorage.getItem("token") || localStorage.getItem("access_token");
    },

    getUser() {
        const raw = localStorage.getItem(this.USER_KEY);
        if (!raw) return null;

        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    getRole() {
        const user = this.getUser();
        return user?.tipo || null;
    },

    isLoggedIn() {
        return Boolean(this.getToken());
    },

    clearSession() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    },

    logout() {
        this.clearSession();
        window.location.href = "/login";
    },

    redirectByRole() {
        const role = this.getRole();

        if (role === "dueno") {
            window.location.href = "/dueno/dashboard";
            return;
        }

        if (role === "admin") {
            window.location.href = "/admin/dashboard";
            return;
        }

        if (role === "supervisor") {
            window.location.href = "/supervisor/dashboard";
            return;
        }

        if (role === "chofer") {
            window.location.href = "/chofer/dashboard";
            return;
        }

        window.location.href = "/dueno/dashboard";
    }
};