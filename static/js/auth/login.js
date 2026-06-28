document.addEventListener("DOMContentLoaded", () => {
    console.log("LOGIN JS CARGADO");

    const form = document.getElementById("loginForm");
    const correoInput = document.getElementById("correo");
    const passwordInput = document.getElementById("password");
    const btnLogin = document.getElementById("btnLogin");
    const message = document.getElementById("loginMessage");
    const togglePassword = document.getElementById("togglePassword");

    console.log("form:", form);
    console.log("passwordInput:", passwordInput);
    console.log("togglePassword:", togglePassword);

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

                const guardado = TrackAuth.saveSession(data);

                if (!guardado) {
                    throw new Error("No se pudo guardar la sesión.");
                }

                console.log("Token guardado:", localStorage.getItem("access_token"));

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

    function setMessage(text, type) {
        if (!message) return;

        message.textContent = text;
        message.className = "auth-message";

        if (type) {
            message.classList.add(type);
        }
    }
});