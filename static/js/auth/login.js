document.addEventListener("DOMContentLoaded", () => {
    console.log("LOGIN JS CARGADO");

    const form = document.getElementById("loginForm");
    const correoInput = document.getElementById("correo");
    const passwordInput = document.getElementById("password");
    const btnLogin = document.getElementById("btnLogin");
    const message = document.getElementById("loginMessage");
    const togglePassword = document.getElementById("togglePassword");
    const rememberInput =
        document.getElementById(
            "remember"
        );
    // ============================================================
    // CONFIGURACIÓN DE ROLES EN WEB
    // ============================================================
    // Aquí defines qué roles NO pueden entrar al panel web.
    //
    // Por ahora bloqueamos técnico porque su uso será solo desde app móvil.
    //
    // Si después quieres bloquear también al chofer en la web,
    // solo descomenta "chofer".
    // ============================================================

    const ROLES_NO_PERMITIDOS_WEB = [
        "tecnico",

        // Descomenta esta línea si quieres que el chofer tampoco pueda entrar a la web:
        // "chofer",
    ];

    // Mensaje personalizado por rol bloqueado.
    const MENSAJES_ROLES_BLOQUEADOS = {
        tecnico: "El rol técnico solo está disponible desde la aplicación móvil.",
        chofer: "El rol chofer solo está disponible desde la aplicación móvil.",
    };

    // =========================
    // OJITO MOSTRAR / OCULTAR
    // =========================
    if (togglePassword && passwordInput) {
        togglePassword.onclick = function (event) {
            event.preventDefault();

            const esPassword = passwordInput.type === "password";
            passwordInput.type = esPassword ? "text" : "password";

            togglePassword.classList.toggle("is-visible", esPassword);
            togglePassword.setAttribute(
                "aria-label",
                esPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            );
        };
    }

    // =========================
    // LOGIN
    // =========================
    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const correo = correoInput.value.trim();
            const password = passwordInput.value;

            setMessage("", "");
            btnLogin.disabled = true;
            btnLogin.textContent = "Ingresando...";

            try {
                const data = await TrackAPI.login(correo, password);

                const usuario = data?.usuario;
                const rol = usuario?.tipo;

                // ====================================================
                // BLOQUEO DE ROLES NO PERMITIDOS EN WEB
                // ====================================================
                // Importante:
                // El backend sí permite login de técnico porque la app móvil
                // lo necesita. El bloqueo se hace solo en la web.
                //
                // Aquí todavía NO guardamos la sesión.
                // Si el rol está bloqueado, mostramos mensaje y salimos.
                // ====================================================
                if (ROLES_NO_PERMITIDOS_WEB.includes(rol)) {
                    const mensaje = MENSAJES_ROLES_BLOQUEADOS[rol]
                        || "Este rol no está disponible desde el panel web.";

                    limpiarSesionWeb();
                    setMessage(mensaje, "error");
                    return;
                }

                // ====================================================
                // GUARDAR SESIÓN
                // ====================================================
                // Solo se guarda si el rol sí está permitido en la web.
                // ====================================================
                const recordarSesion =
                    Boolean(
                        rememberInput?.checked
                    );


                const guardado =
                    TrackAuth.saveSession(
                        data,
                        recordarSesion
                    );

                if (!guardado) {
                    throw new Error("No se pudo guardar la sesión.");
                }

                setMessage("Inicio de sesión correcto. Redirigiendo...", "success");

                setTimeout(() => {
                    TrackAuth.redirectByRole();
                }, 500);

            } catch (error) {
                console.error("Error en login:", error);
                setMessage(error.message || "No se pudo iniciar sesión.", "error");
            } finally {
                btnLogin.disabled = false;
                btnLogin.textContent = "Iniciar sesión";
            }
        });
    }

    // ============================================================
    // MUESTRA MENSAJES EN EL LOGIN
    // ============================================================
    function setMessage(text, type) {
        if (!message) return;

        message.textContent = text;
        message.className = "auth-message";

        if (type) {
            message.classList.add(type);
        }
    }

    // ============================================================
    // LIMPIA SESIÓN DEL NAVEGADOR
    // ============================================================
    // Sirve por si antes había quedado guardado un token de técnico
    // o chofer en localStorage.
    // ============================================================
    function limpiarSesionWeb() {

        if (
            window.TrackAuth
            &&
            typeof TrackAuth.clearSession ===
                "function"
        ) {

            TrackAuth.clearSession();

            return;

        }


        const claves = [

            "access_token",
            "ts_usuario",
            "ts_recordar_sesion",
            "token",
            "usuario",
            "tracksecurity_token",
            "tracksecurity_user",

        ];


        claves.forEach((clave) => {

            localStorage.removeItem(clave);

            sessionStorage.removeItem(clave);

        });

    }
});