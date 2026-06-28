document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const ok = await window.TrackGuards.requireAuth();
        if (!ok) return;
    }

    const contenedorPagina = document.querySelector(".vehiculo-form-page");
    const vehiculoId = Number(contenedorPagina?.dataset.vehiculoId || window.VEHICULO_ID || 0);

    const form = document.getElementById("formEditarVehiculo");
    const btnGuardar = document.getElementById("btnGuardarCambiosVehiculo");
    const mensaje = document.getElementById("mensajeVehiculoEditar");
    const choferSelect = document.getElementById("chofer_id");

    if (!vehiculoId) {
        console.error("No se pudo obtener el ID del vehículo para editar.");
        setMensaje("No se pudo obtener el vehículo a editar.", "error");
        return;
    }

    let choferSeleccionadoId = null;

    await cargarVehiculo();
    await cargarChoferes(choferSeleccionadoId, vehiculoId);

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = obtenerPayload();

        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";
        setMensaje("", "");

        try {
            await TrackAPI.editarVehiculo(vehiculoId, payload);

            setMensaje("Vehículo actualizado correctamente. Redirigiendo...", "success");

            setTimeout(() => {
                window.location.href = "/dueno/vehiculos";
            }, 700);

        } catch (error) {
            console.error("Error editando vehículo:", error);
            setMensaje(error.message || "No se pudo actualizar el vehículo.", "error");

        } finally {
            btnGuardar.disabled = false;
            btnGuardar.textContent = "Guardar cambios";
        }
    });

    async function cargarVehiculo() {
        try {
            const response = await TrackAPI.obtenerVehiculoDetalle(vehiculoId);
            const v = response.vehiculo || {};

            document.getElementById("nombre").value = v.nombre || "";
            document.getElementById("identificador").value = v.identificador || "";
            document.getElementById("placa").value = v.placa || "";
            document.getElementById("marca").value = v.marca || "";
            document.getElementById("modelo").value = v.modelo || "";
            document.getElementById("anio").value = v.anio || "";

            choferSeleccionadoId = v.chofer_id || null;

        } catch (error) {
            console.error("Error cargando vehículo para editar:", error);
            setMensaje(error.message || "No se pudo cargar el vehículo.", "error");
        }
    }

    async function cargarChoferes(choferId = null, vehiculoIdActual = null) {
        if (!choferSelect) return;

        choferSelect.innerHTML = `<option value="">Sin chofer asignado</option>`;

        if (!TrackAPI.obtenerChoferes) {
            console.warn("TrackAPI.obtenerChoferes no existe.");
            return;
        }

        try {
            const response = await TrackAPI.obtenerChoferes(vehiculoIdActual);
            const choferes = response.choferes || [];

            choferes.forEach((chofer) => {
                const option = document.createElement("option");
                option.value = chofer.id;
                option.textContent = chofer.correo
                    ? `${chofer.nombre} - ${chofer.correo}`
                    : chofer.nombre;

                if (choferId && Number(chofer.id) === Number(choferId)) {
                    option.selected = true;
                }

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