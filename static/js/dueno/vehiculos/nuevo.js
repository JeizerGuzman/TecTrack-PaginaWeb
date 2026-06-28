document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const ok = await window.TrackGuards.requireAuth();
        if (!ok) return;
    }

    const form = document.getElementById("formNuevoVehiculo");
    const btnGuardar = document.getElementById("btnGuardarVehiculo");
    const mensaje = document.getElementById("mensajeVehiculoNuevo");
    const choferSelect = document.getElementById("chofer_id");

    await cargarChoferes();

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = obtenerPayload();

        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";
        setMensaje("", "");

        try {
            await TrackAPI.crearVehiculo(payload);

            setMensaje("Vehículo creado correctamente. Redirigiendo...", "success");

            setTimeout(() => {
                window.location.href = "/dueno/vehiculos";
            }, 700);

        } catch (error) {
            console.error("Error creando vehículo:", error);
            setMensaje(error.message || "No se pudo crear el vehículo.", "error");

        } finally {
            btnGuardar.disabled = false;
            btnGuardar.textContent = "Guardar vehículo";
        }
    });

    async function cargarChoferes() {
        if (!choferSelect) return;

        choferSelect.innerHTML = `<option value="">Sin chofer asignado</option>`;

        if (!TrackAPI.obtenerChoferes) {
            console.warn("TrackAPI.obtenerChoferes no existe.");
            return;
        }

        try {
            const response = await TrackAPI.obtenerChoferes();
            const choferes = response.choferes || [];

            choferes.forEach((chofer) => {
                const option = document.createElement("option");
                option.value = chofer.id;
                option.textContent = chofer.correo
                    ? `${chofer.nombre} - ${chofer.correo}`
                    : chofer.nombre;

                choferSelect.appendChild(option);
            });

        } catch (error) {
            console.error("Error cargando choferes:", error);
            choferSelect.innerHTML = `<option value="">No se pudieron cargar choferes</option>`;
        }
    }

    function obtenerPayload() {
        return {
            nombre: document.getElementById("nombre").value.trim(),
            identificador: document.getElementById("identificador").value.trim(),
            placa: document.getElementById("placa").value.trim(),
            marca: document.getElementById("marca").value.trim(),
            modelo: document.getElementById("modelo").value.trim(),
            anio: parseInt(document.getElementById("anio").value || "0", 10) || null,
            chofer_id: choferSelect?.value ? parseInt(choferSelect.value, 10) : null
        };
    }

    function setMensaje(texto, tipo) {
        if (!mensaje) return;

        mensaje.textContent = texto;
        mensaje.className = "form-message";

        if (tipo) mensaje.classList.add(tipo);
    }
});