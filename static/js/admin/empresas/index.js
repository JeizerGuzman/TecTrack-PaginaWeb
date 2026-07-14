let empresasOriginales = [];
let empresasTimer = null;
let empresasCargando = false;
let empresaEditandoId = null;
let empresaEstadoSeleccionada = null;

document.addEventListener("DOMContentLoaded", async () => {

    if (window.TrackGuards?.requireAuth) {
        const autorizado = await TrackGuards.requireAuth("admin");

        if (!autorizado) {
            return;
        }
    }


    configurarEventosEmpresas();


    await cargarEmpresas();


    const intervaloMs =
        await TrackConfig.obtenerAdminMs(
            "empresas",
            30
        );


    if (empresasTimer) {
        clearInterval(empresasTimer);
    }


    empresasTimer = setInterval(
        cargarEmpresas,
        intervaloMs
    );

});

function configurarEventosEmpresas() {
    document.getElementById("buscarEmpresa")?.addEventListener("input", aplicarFiltrosEmpresas);
    document.getElementById("filtroEstadoEmpresa")?.addEventListener("change", aplicarFiltrosEmpresas);

    document.getElementById("btnAbrirModalEmpresa")?.addEventListener("click", abrirModalNuevaEmpresa);
    document.getElementById("btnCerrarModalEmpresa")?.addEventListener("click", cerrarModalEmpresa);
    document.getElementById("btnCancelarEmpresa")?.addEventListener("click", cerrarModalEmpresa);
    document.getElementById("formEmpresa")?.addEventListener("submit", guardarEmpresa);

    document.getElementById("btnCerrarModalEstadoEmpresa")?.addEventListener("click", cerrarModalEstadoEmpresa);
    document.getElementById("btnCancelarEstadoEmpresa")?.addEventListener("click", cerrarModalEstadoEmpresa);
    document.getElementById("btnConfirmarEstadoEmpresa")?.addEventListener("click", confirmarCambioEstadoEmpresa);

    // document.getElementById("modalEmpresa")?.addEventListener("click", (event) => {
    //     if (event.target.id === "modalEmpresa") cerrarModalEmpresa();
    // });

    // document.getElementById("modalEstadoEmpresa")?.addEventListener("click", (event) => {
    //     if (event.target.id === "modalEstadoEmpresa") cerrarModalEstadoEmpresa();
    // });
}

async function cargarEmpresas() {
    if (empresasCargando) return;

    empresasCargando = true;

    try {
        const data = await TrackAPI.obtenerAdminEmpresas();

        empresasOriginales = data.empresas || [];

        actualizarStatsEmpresas(empresasOriginales);
        aplicarFiltrosEmpresas();
        actualizarTextoActualizacion();

    } catch (error) {
        console.error("Error cargando empresas:", error);

        const listado = document.getElementById("empresasListado");
        if (listado) {
            listado.innerHTML = `
                <div class="empty-state">
                    <strong>No se pudieron cargar las empresas</strong>
                    <p>${escapeHtml(error.message || "Error desconocido")}</p>
                </div>
            `;
        }
    } finally {
        empresasCargando = false;
    }
}

function actualizarStatsEmpresas(empresas) {
    const total = empresas.length;
    const activas = empresas.filter(e => Boolean(e.activo)).length;
    const inactivas = total - activas;
    const vehiculos = empresas.reduce((sum, e) => sum + Number(e.total_vehiculos || 0), 0);

    setText("statEmpresasTotal", total);
    setText("statEmpresasActivas", activas);
    setText("statEmpresasInactivas", inactivas);
    setText("statEmpresasVehiculos", vehiculos);
}

function aplicarFiltrosEmpresas() {
    const texto = normalizar(document.getElementById("buscarEmpresa")?.value || "");
    const estado = document.getElementById("filtroEstadoEmpresa")?.value || "todos";

    let filtradas = [...empresasOriginales];

    if (texto) {
        filtradas = filtradas.filter(empresa => {
            const base = normalizar([
                empresa.nombre,
                empresa.correo,
                empresa.telefono,
                empresa.direccion
            ].join(" "));

            return base.includes(texto);
        });
    }

    if (estado === "activo") {
        filtradas = filtradas.filter(e => Boolean(e.activo));
    }

    if (estado === "inactivo") {
        filtradas = filtradas.filter(e => !Boolean(e.activo));
    }

    renderEmpresas(filtradas);
}

function renderEmpresas(empresas) {
    const listado = document.getElementById("empresasListado");
    if (!listado) return;

    if (!empresas.length) {
        listado.innerHTML = `
            <div class="empty-state">
                <strong>No hay empresas para mostrar</strong>
                <p>No se encontraron empresas con los filtros seleccionados.</p>
            </div>
        `;
        return;
    }

    listado.innerHTML = empresas.map(empresa => {
        const activa = Boolean(empresa.activo);

        return `
            <article class="empresa-card ${activa ? "" : "inactiva"}">
                <div class="empresa-main">
                    <div class="empresa-title-row">
                        <div>
                            <h3>${escapeHtml(empresa.nombre || "Empresa sin nombre")}</h3>
                            <p>${escapeHtml(empresa.correo || "Sin correo registrado")}</p>
                        </div>

                        <div class="empresa-badges">
                            <span class="badge ${activa ? "badge-success" : "badge-muted"}">
                                ${activa ? "Activa" : "Inactiva"}
                            </span>

                            <span class="badge badge-muted">
                                ${escapeHtml(empresa.plan_nombre || "Sin plan")}
                            </span>
                        </div>
                    </div>

                    <div class="empresa-meta">
                        <span>Tel: ${escapeHtml(empresa.telefono || "Sin teléfono")}</span>
                        <span>Usuarios: ${Number(empresa.total_usuarios || 0)}</span>
                        <span>Vehículos: ${Number(empresa.total_vehiculos || 0)}</span>
                        <span>Dispositivos: ${Number(empresa.total_dispositivos || 0)}</span>
                    </div>
                </div>

                <div class="empresa-actions">
                    <button type="button" class="btn btn-outline btn-sm btn-editar-empresa" data-id="${empresa.id}">
                        Editar
                    </button>

                    ${
                        activa
                            ? `<button type="button" class="btn btn-danger-outline btn-sm btn-desactivar-empresa" data-id="${empresa.id}">
                                Desactivar
                            </button>`
                            : `<button type="button" class="btn btn-primary btn-sm btn-reactivar-empresa" data-id="${empresa.id}">
                                Reactivar
                            </button>`
                    }
                </div>
            </article>
        `;
    }).join("");

    bindAccionesEmpresas();
}

function bindAccionesEmpresas() {
    document.querySelectorAll(".btn-editar-empresa").forEach(btn => {
        btn.addEventListener("click", () => {
            const empresaId = Number(btn.dataset.id);
            abrirModalEditarEmpresa(empresaId);
        });
    });

    document.querySelectorAll(".btn-desactivar-empresa").forEach(btn => {
        btn.addEventListener("click", () => {
            const empresaId = Number(btn.dataset.id);
            abrirModalEstadoEmpresa(empresaId, "desactivar");
        });
    });

    document.querySelectorAll(".btn-reactivar-empresa").forEach(btn => {
        btn.addEventListener("click", () => {
            const empresaId = Number(btn.dataset.id);
            abrirModalEstadoEmpresa(empresaId, "reactivar");
        });
    });
}

function abrirModalNuevaEmpresa() {
    empresaEditandoId = null;

    setText("modalEmpresaTitulo", "Nueva empresa");
    setText("modalEmpresaSubtitulo", "Registra una empresa en TrackSecurity.");
    setText("btnGuardarEmpresa", "Guardar empresa");

    limpiarFormularioEmpresa();

    document.getElementById("modalEmpresa")?.classList.add("visible");
}

function abrirModalEditarEmpresa(empresaId) {
    const empresa = empresasOriginales.find(e => Number(e.id) === Number(empresaId));

    if (!empresa) {
        mostrarToastEmpresas("No se encontró la empresa seleccionada.", "error");
        return;
    }

    empresaEditandoId = empresa.id;

    setText("modalEmpresaTitulo", "Editar empresa");
    setText("modalEmpresaSubtitulo", "Actualiza los datos generales de la empresa.");
    setText("btnGuardarEmpresa", "Guardar cambios");

    document.getElementById("empresaId").value = empresa.id;
    document.getElementById("empresaNombre").value = empresa.nombre || "";
    document.getElementById("empresaCorreo").value = empresa.correo || "";
    document.getElementById("empresaTelefono").value = empresa.telefono || "";
    document.getElementById("empresaDireccion").value = empresa.direccion || "";

    document.getElementById("modalEmpresa")?.classList.add("visible");
}

function cerrarModalEmpresa() {
    empresaEditandoId = null;
    limpiarFormularioEmpresa();

    const modal = document.getElementById("modalEmpresa");
    const btn = document.getElementById("btnGuardarEmpresa");

    if (modal) modal.classList.remove("visible");

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar empresa";
    }
}

function limpiarFormularioEmpresa() {
    document.getElementById("empresaId").value = "";
    document.getElementById("empresaNombre").value = "";
    document.getElementById("empresaCorreo").value = "";
    document.getElementById("empresaTelefono").value = "";
    document.getElementById("empresaDireccion").value = "";
}

async function guardarEmpresa(event) {
    event.preventDefault();

    const btn = document.getElementById("btnGuardarEmpresa");

    const data = {
        nombre: document.getElementById("empresaNombre")?.value.trim(),
        correo: document.getElementById("empresaCorreo")?.value.trim(),
        telefono: document.getElementById("empresaTelefono")?.value.trim(),
        direccion: document.getElementById("empresaDireccion")?.value.trim(),
    };

    if (!data.nombre) {
        mostrarToastEmpresas("El nombre de la empresa es requerido.", "error");
        return;
    }

    btn.disabled = true;
    btn.textContent = empresaEditandoId ? "Guardando..." : "Creando...";

    try {
        if (empresaEditandoId) {
            await TrackAPI.editarAdminEmpresa(empresaEditandoId, data);
            mostrarToastEmpresas("Empresa actualizada correctamente.", "success");
        } else {
            await TrackAPI.crearAdminEmpresa(data);
            mostrarToastEmpresas("Empresa creada correctamente.", "success");
        }

        cerrarModalEmpresa();
        await cargarEmpresas();

    } catch (error) {
        console.error("Error guardando empresa:", error);
        mostrarToastEmpresas(error.message || "No se pudo guardar la empresa.", "error");

        btn.disabled = false;
        btn.textContent = empresaEditandoId ? "Guardar cambios" : "Guardar empresa";
    }
}

function abrirModalEstadoEmpresa(empresaId, accion) {
    const empresa = empresasOriginales.find(e => Number(e.id) === Number(empresaId));

    if (!empresa) {
        mostrarToastEmpresas("No se encontró la empresa seleccionada.", "error");
        return;
    }

    empresaEstadoSeleccionada = {
        id: empresa.id,
        nombre: empresa.nombre,
        accion
    };

    if (accion === "desactivar") {
        setText("modalEstadoTitulo", "Desactivar empresa");
        setText(
            "modalEstadoDescripcion",
            `¿Seguro que deseas desactivar la empresa "${empresa.nombre}"?`
        );
        setText("btnConfirmarEstadoEmpresa", "Desactivar");
    } else {
        setText("modalEstadoTitulo", "Reactivar empresa");
        setText(
            "modalEstadoDescripcion",
            `¿Seguro que deseas reactivar la empresa "${empresa.nombre}"?`
        );
        setText("btnConfirmarEstadoEmpresa", "Reactivar");
    }

    document.getElementById("modalEstadoEmpresa")?.classList.add("visible");
}

function cerrarModalEstadoEmpresa() {
    empresaEstadoSeleccionada = null;

    const modal = document.getElementById("modalEstadoEmpresa");
    const btn = document.getElementById("btnConfirmarEstadoEmpresa");

    if (modal) modal.classList.remove("visible");

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Confirmar";
    }
}

async function confirmarCambioEstadoEmpresa() {
    if (!empresaEstadoSeleccionada) return;

    const btn = document.getElementById("btnConfirmarEstadoEmpresa");
    btn.disabled = true;
    btn.textContent = "Procesando...";

    try {
        if (empresaEstadoSeleccionada.accion === "desactivar") {
            await TrackAPI.desactivarAdminEmpresa(empresaEstadoSeleccionada.id);
            mostrarToastEmpresas("Empresa desactivada correctamente.", "success");
        } else {
            await TrackAPI.reactivarAdminEmpresa(empresaEstadoSeleccionada.id);
            mostrarToastEmpresas("Empresa reactivada correctamente.", "success");
        }

        cerrarModalEstadoEmpresa();
        await cargarEmpresas();

    } catch (error) {
        console.error("Error cambiando estado:", error);
        mostrarToastEmpresas(error.message || "No se pudo cambiar el estado.", "error");

        btn.disabled = false;
        btn.textContent = "Confirmar";
    }
}

function actualizarTextoActualizacion() {
    const ahora = new Date();

    setText("empresasActualizacion", `Actualizado ${ahora.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })}`);
}

function mostrarToastEmpresas(mensaje, tipo = "info") {
    let toast = document.getElementById("empresasToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "empresasToast";
        toast.className = "empresas-toast";
        document.body.appendChild(toast);
    }

    toast.textContent = mensaje;
    toast.className = `empresas-toast ${tipo} visible`;

    setTimeout(() => {
        toast.classList.remove("visible");
    }, 3000);
}

function normalizar(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

window.addEventListener("beforeunload", () => {
    if (empresasTimer) {
        clearInterval(empresasTimer);
    }
});