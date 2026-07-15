/* ============================================================
   AUTENTICACIÓN GLOBAL - TrackSecurity
   ============================================================ */

window.TrackAuth = {

    TOKEN_KEY:
        "access_token",

    USER_KEY:
        "ts_usuario",

    REMEMBER_KEY:
        "ts_recordar_sesion",


    /* ========================================================
       GUARDAR SESIÓN
       ======================================================== */

    saveSession(
        data,
        recordarSesion = false
    ) {

        if (
            !data ||
            !data.access_token
        ) {

            console.error(
                "El backend no devolvió access_token"
            );

            return false;
        }


        /*
         * Antes de guardar una sesión nueva,
         * eliminamos cualquier sesión anterior
         * de ambos almacenamientos.
         */
        this.clearSession();


        const almacenamiento =
            recordarSesion
                ? localStorage
                : sessionStorage;


        almacenamiento.setItem(
            this.TOKEN_KEY,
            data.access_token
        );


        if (data.usuario) {

            almacenamiento.setItem(
                this.USER_KEY,
                JSON.stringify(
                    data.usuario
                )
            );

        }


        almacenamiento.setItem(
            this.REMEMBER_KEY,
            recordarSesion
                ? "1"
                : "0"
        );


        return true;

    },


    /* ========================================================
       OBTENER TOKEN
       ======================================================== */

    getToken() {

        return (
            sessionStorage.getItem(
                this.TOKEN_KEY
            )
            ||
            localStorage.getItem(
                this.TOKEN_KEY
            )
            ||
            sessionStorage.getItem(
                "token"
            )
            ||
            localStorage.getItem(
                "token"
            )
        );

    },


    /* ========================================================
       OBTENER USUARIO
       ======================================================== */

    getUser() {

        const raw = (
            sessionStorage.getItem(
                this.USER_KEY
            )
            ||
            localStorage.getItem(
                this.USER_KEY
            )
        );


        if (!raw) {
            return null;
        }


        try {

            return JSON.parse(raw);

        } catch (error) {

            console.error(
                "No se pudo leer el usuario guardado:",
                error
            );

            return null;

        }

    },


    /* ========================================================
       OBTENER ROL
       ======================================================== */

    getRole() {

        const user =
            this.getUser();


        return user?.tipo || null;

    },


    /* ========================================================
       SESIÓN ACTIVA
       ======================================================== */

    isLoggedIn() {

        return Boolean(
            this.getToken()
        );

    },


    /* ========================================================
       SABER SI LA SESIÓN ES RECORDADA
       ======================================================== */

    isRemembered() {

        return (
            localStorage.getItem(
                this.REMEMBER_KEY
            ) === "1"
        );

    },


    /* ========================================================
       LIMPIAR SESIÓN
       ======================================================== */

    clearSession() {

        const claves = [

            this.TOKEN_KEY,
            this.USER_KEY,
            this.REMEMBER_KEY,

            /*
             * Claves antiguas que pudieron
             * utilizarse en versiones previas.
             */
            "token",
            "usuario",
            "tracksecurity_token",
            "tracksecurity_user",

        ];


        claves.forEach((clave) => {

            localStorage.removeItem(
                clave
            );

            sessionStorage.removeItem(
                clave
            );

        });

    },


    /* ========================================================
       CERRAR SESIÓN
       ======================================================== */

    logout() {

        this.clearSession();

        window.location.href =
            "/login";

    },


    /* ========================================================
       REDIRECCIÓN POR ROL
       ======================================================== */

    redirectByRole() {

        const role =
            this.getRole();


        if (role === "dueno") {

            window.location.href =
                "/dueno/dashboard";

            return;

        }


        if (role === "admin") {

            window.location.href =
                "/admin/dashboard";

            return;

        }


        if (role === "supervisor") {

            window.location.href =
                "/supervisor/dashboard";

            return;

        }


        if (role === "chofer") {

            window.location.href =
                "/chofer/dashboard";

            return;

        }


        window.location.href =
            "/login";

    },

};