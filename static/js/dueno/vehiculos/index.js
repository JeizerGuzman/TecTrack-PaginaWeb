document.addEventListener("DOMContentLoaded", async () => {
    if (window.TrackGuards?.requireAuth) {
        const ok = await window.TrackGuards.requireAuth();
        if (!ok) return;
    }

    const listado = document.getElementById("vehiculosListado");
    const buscarInput = document.getElementById("buscarVehiculo");
    const filtroEstado = document.getElementById("filtroEstadoVehiculo");

    const statVehiculosTotal = document.getElementById("statVehiculosTotal");
    const statVehiculosActivos = document.getElementById("statVehiculosActivos");
    const statVehiculosAlerta = document.getElementById("statVehiculosAlerta");
    const statVehiculosPendientes = document.getElementById("statVehiculosPendientes");

    let vehiculosOriginales = [];
    let vehiculoSeleccionadoDesactivar = null;
    let intervaloActualizacionVehiculos = null;
    let cargandoVehiculos = false;

    await cargarVehiculos(false);

    configurarModalDesactivarVehiculo();

    await iniciarActualizacionAutomatica();

    buscarInput?.addEventListener("input", aplicarFiltros);
    filtroEstado?.addEventListener("change", aplicarFiltros);

    // ============================================================
    // Carga vehículos desde el backend.
    //
    // Se usa actualmente en:
    // - Al entrar a /dueno/vehiculos
    // - Al desactivar un vehículo
    // - Actualización automática cada 3 segundos
    //
    // esActualizacionAutomatica evita mostrar errores o parpadeos
    // molestos durante el refresco silencioso.
    // ============================================================
    async function cargarVehiculos(esActualizacionAutomatica = false) {
        if (cargandoVehiculos) return;

        cargandoVehiculos = true;

        try {
            const response = await TrackAPI.obtenerVehiculos();
            vehiculosOriginales = response.vehiculos || [];

            renderStats(vehiculosOriginales);
            aplicarFiltros();

        } catch (error) {
            console.error("Error cargando vehículos:", error);

            // En actualización automática no reemplazamos la pantalla,
            // para no borrar la lista si solo falló una consulta temporal.
            if (!esActualizacionAutomatica && listado) {
                listado.innerHTML = `
                    <div class="empty-state">
                        <strong>No se pudieron cargar los vehículos</strong>
                        <p>${escapeHtml(error.message || "Ocurrió un error al consultar la flota.")}</p>
                    </div>
                `;
            }
        } finally {
            cargandoVehiculos = false;
        }
    }

    // ============================================================
    // Inicia actualización automática del listado.
    //
    // Se usa para que el index de vehículos muestre cambios de:
    // - alerta
    // - sin señal
    // - activo
    // - dispositivo
    // sin recargar manualmente la página.
    // ============================================================
    async function iniciarActualizacionAutomatica() {

        const intervaloMs =
            await TrackConfig.obtenerOperacionMs(
                "vehiculos",
                5
            );


        if (intervaloActualizacionVehiculos) {

            clearInterval(
                intervaloActualizacionVehiculos
            );

        }


        intervaloActualizacionVehiculos =
            setInterval(
                async () => {

                    await cargarVehiculos(true);

                },
                intervaloMs
            );

    }

    // ============================================================
    // Aplica búsqueda y filtro por estado usando la lista actual.
    //
    // Se usa actualmente en:
    // - input buscarVehiculo
    // - select filtroEstadoVehiculo
    // - después de cada actualización automática
    // ============================================================
    function aplicarFiltros() {
        const texto = (buscarInput?.value || "").trim().toLowerCase();
        const estado = filtroEstado?.value || "todos";

        let filtrados = [...vehiculosOriginales];

        if (texto) {
            filtrados = filtrados.filter(v => {
                return [
                    v.nombre,
                    v.identificador,
                    v.placa,
                    v.marca,
                    v.modelo,
                    v.chofer_nombre
                ].some(valor => String(valor || "").toLowerCase().includes(texto));
            });
        }

        if (estado !== "todos") {
            filtrados = filtrados.filter(v => normalizarEstadoVehiculo(v) === estado);
        }

        renderVehiculos(filtrados);
    }

    // ============================================================
    // Actualiza las tarjetas estadísticas superiores.
    //
    // Se usa actualmente en:
    // - index de vehículos
    // ============================================================
    function renderStats(vehiculos) {
        const total = vehiculos.length;
        const activos = vehiculos.filter(v => normalizarEstadoVehiculo(v) === "activo").length;
        const alerta = vehiculos.filter(v => normalizarEstadoVehiculo(v) === "alerta").length;
        const pendientes = vehiculos.filter(v => {
            const estado = normalizarEstadoVehiculo(v);
            return estado === "sin_senal" || estado === "sin_dispositivo";
        }).length;

        if (statVehiculosTotal) statVehiculosTotal.textContent = total;
        if (statVehiculosActivos) statVehiculosActivos.textContent = activos;
        if (statVehiculosAlerta) statVehiculosAlerta.textContent = alerta;
        if (statVehiculosPendientes) statVehiculosPendientes.textContent = pendientes;
    }

    // ============================================================
    // Renderiza las tarjetas de vehículos.
    //
    // Se usa actualmente en:
    // - listado principal de vehículos
    //
    // Cada tarjeta muestra:
    // - nombre
    // - identificador
    // - chofer
    // - marca/modelo/año
    // - estado
    // - botones detalle/editar/desactivar
    // ============================================================
    function renderVehiculos(vehiculos) {
        if (!listado) return;

        if (!vehiculos.length) {
            listado.innerHTML = `
                <div class="empty-state">
                    <strong>No hay vehículos para mostrar</strong>
                    <p>No se encontraron unidades con los filtros seleccionados.</p>
                </div>
            `;
            return;
        }

        listado.innerHTML = vehiculos.map(v => {
            const estado = normalizarEstadoVehiculo(v);
            const estadoLabel = formatearEstado(estado);

            return `
                <article class="vehiculo-card">
                    <div class="vehiculo-card-header">
                        <div>
                            <h3>${escapeHtml(v.nombre || "Vehículo sin nombre")}</h3>
                            <p>
                                ${escapeHtml(v.identificador || "Sin identificador")} ·
                                Chofer: ${escapeHtml(v.chofer_nombre || "Sin asignar")}
                            </p>
                        </div>

                        <span class="badge badge-${estado}">
                            ${estadoLabel}
                        </span>
                    </div>

                    <div class="vehiculo-card-body">
                        <div class="vehiculo-info">
                            <span>Marca</span>
                            <strong>${escapeHtml(v.marca || "Sin registrar")}</strong>
                        </div>

                        <div class="vehiculo-info">
                            <span>Modelo</span>
                            <strong>${escapeHtml(v.modelo || "Sin registrar")}</strong>
                        </div>

                        <div class="vehiculo-info">
                            <span>Año</span>
                            <strong>${v.anio || "—"}</strong>
                        </div>

                        <div class="vehiculo-info">
                            <span>Placa</span>
                            <strong>${escapeHtml(v.placa || "Sin placa")}</strong>
                        </div>
                    </div>

                    <div class="vehiculo-card-footer">
                        <a class="btn btn-outline btn-sm" href="/dueno/vehiculos/${v.id}">
                            Ver detalle
                        </a>

                        <button class="btn btn-outline btn-sm btn-editar" data-id="${v.id}">
                            Editar
                        </button>

                        <button class="btn btn-danger-outline btn-sm btn-desactivar-vehiculo" data-id="${v.id}">
                            Desactivar
                        </button>
                    </div>
                </article>
            `;
        }).join("");

        bindEventosTarjetas();
    }

    // ============================================================
    // Conecta los botones de cada tarjeta.
    //
    // Se usa actualmente en:
    // - botón Editar
    // - botón Desactivar
    // ============================================================
    function bindEventosTarjetas() {
        document.querySelectorAll(".btn-editar").forEach(btn => {
            btn.addEventListener("click", () => {
                const vehiculoId = btn.dataset.id;
                window.location.href = `/dueno/vehiculos/${vehiculoId}/editar`;
            });
        });

        document.querySelectorAll(".btn-desactivar-vehiculo").forEach(btn => {
            btn.addEventListener("click", () => {
                const vehiculoId = Number(btn.dataset.id);
                const vehiculo = vehiculosOriginales.find(v => Number(v.id) === vehiculoId);

                if (!vehiculo) {
                    mostrarToastVehiculo("No se encontró el vehículo seleccionado.", "error");
                    return;
                }

                abrirModalDesactivarVehiculo(vehiculo);
            });
        });
    }

    // ============================================================
    // Configura eventos del modal de desactivar vehículo.
    //
    // Se usa actualmente en:
    // - modalDesactivarVehiculo del HTML
    // ============================================================
    function configurarModalDesactivarVehiculo() {
        document.getElementById("btnCerrarModalVehiculo")?.addEventListener("click", cerrarModalDesactivarVehiculo);
        document.getElementById("btnCancelarDesactivarVehiculo")?.addEventListener("click", cerrarModalDesactivarVehiculo);
        document.getElementById("btnConfirmarDesactivarVehiculo")?.addEventListener("click", confirmarDesactivarVehiculo);

        document.getElementById("modalDesactivarVehiculo")?.addEventListener("click", (event) => {
            if (event.target.id === "modalDesactivarVehiculo") {
                cerrarModalDesactivarVehiculo();
            }
        });
    }

    // ============================================================
    // Abre el modal para confirmar desactivación.
    //
    // Se usa cuando el usuario presiona:
    // - Desactivar
    // ============================================================
    function abrirModalDesactivarVehiculo(vehiculo) {
        vehiculoSeleccionadoDesactivar = vehiculo;

        const nombre = document.getElementById("modalVehiculoNombre");
        const placa = document.getElementById("modalVehiculoPlaca");
        const modal = document.getElementById("modalDesactivarVehiculo");

        if (nombre) nombre.textContent = vehiculo.nombre || "Vehículo sin nombre";
        if (placa) placa.textContent = vehiculo.placa || "Placa no registrada";
        if (modal) modal.classList.add("visible");
    }

    // ============================================================
    // Cierra y limpia el modal de desactivar vehículo.
    //
    // Se usa en:
    // - cancelar
    // - cerrar
    // - después de desactivar correctamente
    // ============================================================
    function cerrarModalDesactivarVehiculo() {
        vehiculoSeleccionadoDesactivar = null;

        const modal = document.getElementById("modalDesactivarVehiculo");
        const btn = document.getElementById("btnConfirmarDesactivarVehiculo");

        if (modal) modal.classList.remove("visible");

        if (btn) {
            btn.disabled = false;
            btn.textContent = "Desactivar vehículo";
        }
    }

    // ============================================================
    // Desactiva el vehículo seleccionado.
    //
    // Se usa actualmente en:
    // - botón confirmar del modal
    //
    // Después de desactivar, vuelve a cargar la lista.
    // ============================================================
    async function confirmarDesactivarVehiculo() {
        if (!vehiculoSeleccionadoDesactivar) return;

        const btn = document.getElementById("btnConfirmarDesactivarVehiculo");

        if (btn) {
            btn.disabled = true;
            btn.textContent = "Desactivando...";
        }

        try {
            await TrackAPI.desactivarVehiculo(vehiculoSeleccionadoDesactivar.id);

            cerrarModalDesactivarVehiculo();
            await cargarVehiculos(false);

            mostrarToastVehiculo("Vehículo desactivado correctamente.", "success");

        } catch (error) {
            console.error("Error desactivando vehículo:", error);
            mostrarToastVehiculo(error.message || "No se pudo desactivar el vehículo.", "error");

            if (btn) {
                btn.disabled = false;
                btn.textContent = "Desactivar vehículo";
            }
        }
    }

    // ============================================================
    // Normaliza el estado recibido del backend.
    //
    // Se usa para:
    // - badges
    // - estadísticas
    // - filtros
    //
    // Devuelve:
    // - activo
    // - alerta
    // - sin_senal
    // - sin_dispositivo
    // ============================================================
    function normalizarEstadoVehiculo(v) {
        if (!v.dispositivo_id && !v.dispositivo_serie) return "sin_dispositivo";

        const estado = String(v.estado || "").toLowerCase();
        const alerta = Number(v.alerta || 0);
        const vibracion = Number(v.vibracion || 0);
        const puerta = String(v.puerta || "").toLowerCase();

        if (alerta === 1) return "alerta";
        if (vibracion === 1) return "alerta";
        if (puerta === "abierta") return "alerta";

        if (estado.includes("alert")) return "alerta";
        if (estado.includes("panic")) return "alerta";
        if (estado.includes("panico")) return "alerta";
        if (estado.includes("sin")) return "sin_senal";
        if (estado.includes("off")) return "sin_senal";

        return "activo";
    }

    // ============================================================
    // Convierte estado interno en texto visible.
    // ============================================================
    function formatearEstado(estado) {
        const mapa = {
            activo: "Activo",
            alerta: "Con alerta",
            sin_senal: "Sin señal",
            sin_dispositivo: "Sin dispositivo"
        };

        return mapa[estado] || "Activo";
    }

    // ============================================================
    // Muestra un mensaje flotante.
    //
    // Se usa actualmente en:
    // - errores
    // - confirmaciones
    // ============================================================
    function mostrarToastVehiculo(mensaje, tipo = "info") {
        let toast = document.getElementById("vehiculosToast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "vehiculosToast";
            toast.className = "vehiculos-toast";
            document.body.appendChild(toast);
        }

        toast.textContent = mensaje;
        toast.className = `vehiculos-toast ${tipo} visible`;

        setTimeout(() => {
            toast.classList.remove("visible");
        }, 3000);
    }

    // ============================================================
    // Limpia texto antes de insertarlo en HTML.
    //
    // Ayuda a evitar que texto raro rompa la interfaz.
    // ============================================================
    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // ============================================================
    // Limpia el intervalo si el usuario sale de la página.
    // ============================================================
    window.addEventListener("beforeunload", () => {
        if (intervaloActualizacionVehiculos) {
            clearInterval(intervaloActualizacionVehiculos);
        }
    });
});