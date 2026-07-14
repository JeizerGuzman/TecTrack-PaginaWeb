(() => {
    "use strict";

    const state = {
        vehiculosOriginales: [],
        cargando: false,
        timer: null
    };

    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            configurarEventosVehiculos();


            await cargarVehiculos();


            const intervaloMs =
                await TrackConfig.obtenerAdminMs(
                    "vehiculos",
                    10
                );


            if (state.timer) {
                window.clearInterval(
                    state.timer
                );
            }


            state.timer =
                window.setInterval(
                    () => {

                        cargarVehiculos({
                            silencioso: true
                        });

                    },
                    intervaloMs
                );

        }
    );

    window.addEventListener("beforeunload", () => {
        if (state.timer) {
            window.clearInterval(state.timer);
        }
    });

    function configurarEventosVehiculos() {
        [
            "filtroBusquedaVehiculo",
            "filtroEmpresaVehiculo",
            "filtroEstadoVehiculo",
            "filtroDispositivoVehiculo"
        ].forEach(id => {
            const elemento = document.getElementById(id);

            elemento?.addEventListener(
                id === "filtroBusquedaVehiculo" ? "input" : "change",
                aplicarFiltrosVehiculos
            );
        });
    }

    async function cargarVehiculos({ silencioso = false } = {}) {
        if (state.cargando) return;

        state.cargando = true;

        try {
            const response = await TrackAPI.obtenerAdminVehiculos();

            state.vehiculosOriginales = Array.isArray(response.vehiculos)
                ? response.vehiculos
                : [];

            actualizarEstadisticas();
            cargarFiltroEmpresas();
            cargarFiltroEstados();
            aplicarFiltrosVehiculos();

        } catch (error) {
            if (!silencioso) {
                mostrarToastVehiculos(
                    error.message || "No se pudieron cargar los vehículos.",
                    "error"
                );
            }

        } finally {
            state.cargando = false;
        }
    }

    function actualizarEstadisticas() {
        const total = state.vehiculosOriginales.length;

        const activos = state.vehiculosOriginales.filter(
            item => item.activo
        ).length;

        const conDispositivo = state.vehiculosOriginales.filter(
            item => Boolean(item.dispositivo_id)
        ).length;

        const sinDispositivo = total - conDispositivo;

        asignarTexto("statVehiculosTotal", total);
        asignarTexto("statVehiculosActivos", activos);
        asignarTexto("statVehiculosConDispositivo", conDispositivo);
        asignarTexto("statVehiculosSinDispositivo", sinDispositivo);
    }

    function cargarFiltroEmpresas() {
        const select = document.getElementById("filtroEmpresaVehiculo");
        if (!select) return;

        const valorActual = select.value || "todas";
        const empresas = new Map();

        state.vehiculosOriginales.forEach(item => {
            if (item.empresa_id && item.empresa_nombre) {
                empresas.set(
                    String(item.empresa_id),
                    item.empresa_nombre
                );
            }
        });

        select.innerHTML = `
            <option value="todas">Todas las empresas</option>
            ${Array.from(empresas.entries())
                .sort((a, b) => a[1].localeCompare(b[1], "es"))
                .map(([id, nombre]) => `
                    <option value="${escapeHtml(id)}">
                        ${escapeHtml(nombre)}
                    </option>
                `)
                .join("")}
        `;

        const existe = Array.from(select.options)
            .some(option => option.value === valorActual);

        select.value = existe ? valorActual : "todas";
    }

    function cargarFiltroEstados() {
        const select = document.getElementById("filtroEstadoVehiculo");
        if (!select) return;

        const valorActual = select.value || "todos";

        const estados = Array.from(
            new Set(
                state.vehiculosOriginales
                    .map(item => String(item.estado || "").toLowerCase())
                    .filter(Boolean)
            )
        ).sort();

        select.innerHTML = `
            <option value="todos">Todos los estados</option>
            ${estados.map(estado => `
                <option value="${escapeHtml(estado)}">
                    ${escapeHtml(formatearEstado(estado))}
                </option>
            `).join("")}
        `;

        const existe = Array.from(select.options)
            .some(option => option.value === valorActual);

        select.value = existe ? valorActual : "todos";
    }

    function aplicarFiltrosVehiculos() {
        const busqueda = normalizarTexto(
            document.getElementById("filtroBusquedaVehiculo")?.value
        );

        const empresa = (
            document.getElementById("filtroEmpresaVehiculo")?.value
            || "todas"
        );

        const estado = (
            document.getElementById("filtroEstadoVehiculo")?.value
            || "todos"
        );

        const dispositivo = (
            document.getElementById("filtroDispositivoVehiculo")?.value
            || "todos"
        );

        const filtrados = state.vehiculosOriginales.filter(item => {
            const coincideBusqueda =
                !busqueda
                || normalizarTexto(item.nombre).includes(busqueda)
                || normalizarTexto(item.placa).includes(busqueda)
                || normalizarTexto(item.identificador).includes(busqueda)
                || normalizarTexto(item.dispositivo_serie).includes(busqueda)
                || normalizarTexto(item.empresa_nombre).includes(busqueda)
                || normalizarTexto(item.chofer_nombre).includes(busqueda);

            const coincideEmpresa =
                empresa === "todas"
                || String(item.empresa_id) === empresa;

            const coincideEstado =
                estado === "todos"
                || String(item.estado || "").toLowerCase() === estado;

            const tieneDispositivo = Boolean(item.dispositivo_id);

            const coincideDispositivo =
                dispositivo === "todos"
                || (dispositivo === "con" && tieneDispositivo)
                || (dispositivo === "sin" && !tieneDispositivo);

            return (
                coincideBusqueda
                && coincideEmpresa
                && coincideEstado
                && coincideDispositivo
            );
        });

        renderizarVehiculos(filtrados);
    }

    function renderizarVehiculos(vehiculos) {
        const contenedor = document.getElementById("vehiculosLista");
        const vacio = document.getElementById("vehiculosEstadoVacio");

        if (!contenedor || !vacio) return;

        if (!vehiculos.length) {
            contenedor.innerHTML = "";
            vacio.hidden = false;
            return;
        }

        vacio.hidden = true;

        contenedor.innerHTML = vehiculos
            .map(item => crearHtmlVehiculo(item))
            .join("");
    }

    function crearHtmlVehiculo(item) {
        return `
            <article class="card vehiculo-card">

                <header class="vehiculo-card-header">
                    <div>
                        <div class="vehiculo-card-badges">
                            <span class="status-badge ${claseEstadoVehiculo(item.estado)}">
                                ${escapeHtml(formatearEstado(item.estado || "activo"))}
                            </span>

                            <span class="status-badge ${
                                item.activo ? "status-active" : "status-gray"
                            }">
                                ${item.activo ? "Activo" : "Inactivo"}
                            </span>
                        </div>

                        <h2>${escapeHtml(item.nombre || "Vehículo")}</h2>

                        <p>
                            ${escapeHtml(item.empresa_nombre || "Empresa no disponible")}
                        </p>
                    </div>

                    <div class="vehiculo-card-identificador">
                        <span>Identificador</span>
                        <strong>
                            ${escapeHtml(item.identificador || "-")}
                        </strong>
                    </div>
                </header>

                <section class="vehiculo-card-info-grid">
                    <div>
                        <span>Placa</span>
                        <strong>${escapeHtml(item.placa || "-")}</strong>
                    </div>

                    <div>
                        <span>Chofer</span>
                        <strong>
                            ${escapeHtml(item.chofer_nombre || "Sin asignar")}
                        </strong>
                    </div>

                    <div>
                        <span>Dispositivo</span>
                        <strong>
                            ${escapeHtml(item.dispositivo_serie || "Sin dispositivo")}
                        </strong>
                    </div>

                    <div>
                        <span>Estado del dispositivo</span>
                        <strong>
                            ${escapeHtml(
                                item.dispositivo_estado
                                    ? formatearEstado(item.dispositivo_estado)
                                    : "No aplica"
                            )}
                        </strong>
                    </div>
                </section>

                <footer class="vehiculo-card-actions">
                    <a href="/admin/vehiculos/${item.id}"
                       class="btn btn-primary">
                        Ver detalle
                    </a>
                </footer>

            </article>
        `;
    }

    function formatearEstado(estado) {
        const mapa = {
            activo: "Activo",
            alerta: "Con alerta",
            panico: "Pánico",
            manual: "Manual",
            sin_senal: "Sin señal",
            apagado: "Apagado",
            disponible: "Disponible",
            instalado: "Instalado",
            mantenimiento: "Mantenimiento",
            desactivado: "Desactivado"
        };

        const clave = String(estado || "").toLowerCase();

        return mapa[clave] || capitalizar(
            clave.replaceAll("_", " ")
        );
    }

    function claseEstadoVehiculo(estado) {
        const mapa = {
            activo: "status-active",
            alerta: "status-warning",
            panico: "status-danger",
            manual: "status-blue",
            sin_senal: "status-gray",
            apagado: "status-gray"
        };

        return mapa[String(estado || "").toLowerCase()]
            || "status-gray";
    }

    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function capitalizar(valor) {
        const texto = String(valor || "");

        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }

    function escapeHtml(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function asignarTexto(id, valor) {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = valor;
        }
    }

    function mostrarToastVehiculos(mensaje, tipo = "info") {
        const contenedor = document.getElementById(
            "vehiculosToastContainer"
        );

        if (!contenedor) return;

        const toast = document.createElement("div");

        toast.className = `vehiculos-toast toast-${tipo}`;
        toast.textContent = mensaje;

        contenedor.appendChild(toast);

        window.setTimeout(() => {
            toast.classList.add("is-hiding");

            window.setTimeout(() => {
                toast.remove();
            }, 250);
        }, 3500);
    }
})();
