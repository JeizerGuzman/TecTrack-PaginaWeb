window.TrackAPI = {
    getToken() {
        return localStorage.getItem("access_token");
    },

    async request(endpoint, options = {}) {
        const token = TrackAuth.getToken ? TrackAuth.getToken() : localStorage.getItem("token");

        const response = await fetch(endpoint, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                ...(options.headers || {})
            }
        });

        const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = data?.error || data?.mensaje || `Error HTTP ${response.status}`;
        console.error("Respuesta del backend:", data);
        throw new Error(message);
    }

        return data;
    },

    login(correo, password) {
        return this.request("/api/login", {
            method: "POST",
            body: JSON.stringify({ correo, password })
        });
    },

    obtenerEstado() {
        return this.request("/api/estado");
    },

    obtenerVehiculos() {
        return this.request("/api/vehiculos");
    },

    obtenerAlertas() {
        return this.request("/api/alertas");
    },

    atenderAlerta(alertaId) {
        return this.request(`/api/alertas/${alertaId}/atender`, {
            method: "PUT"
        });
    },

    obtenerHistorial(vehiculoId) {
        return this.request(`/api/historial/${vehiculoId}`);
    },

    obtenerUsuarios() {
        return this.request("/api/usuarios");
    },

    crearUsuario(data) {
        return this.request("/api/usuarios", {
            method: "POST",
            body: JSON.stringify(data)
        });
    },

    obtenerVehiculos() {
        return this.request("/api/vehiculos");
    },

    crearVehiculo(data) {
    return this.request("/api/vehiculos", {
        method: "POST",
        body: JSON.stringify(data)
    });
    },

    obtenerVehiculoDetalle(vehiculoId) {
    return this.request(`/api/vehiculos/${vehiculoId}`);
    },

    editarVehiculo(vehiculoId, data) {
        return this.request(`/api/vehiculos/${vehiculoId}`, {
            method: "PUT",
            body: JSON.stringify(data)
        });
    },

    desactivarVehiculo(vehiculoId) {
        return this.request(`/api/vehiculos/${vehiculoId}/desactivar`, {
            method: "PUT"
        });
    },

    obtenerEventosVehiculo(vehiculoId) {
    return this.request(`/api/vehiculos/${vehiculoId}/eventos`);
    },

    obtenerUsuarios() {
    return this.request("/api/usuarios");
    },

    crearUsuario(data) {
        return this.request("/api/usuarios", {
            method: "POST",
            body: JSON.stringify(data)
        });
    },

    desactivarUsuario(usuarioId) {
        return this.request(`/api/usuarios/${usuarioId}/desactivar`, {
            method: "PUT"
        });
    },
    obtenerUsuario(usuarioId) {
    return this.request(`/api/usuarios/${usuarioId}`);
    },

    editarUsuario(usuarioId, data) {
        return this.request(`/api/usuarios/${usuarioId}`, {
            method: "PUT",
            body: JSON.stringify(data)
        });
    },

    reactivarUsuario(usuarioId) {
    return this.request(`/api/usuarios/${usuarioId}/reactivar`, {
        method: "PUT"
    });
    },

        resetPasswordUsuario(usuarioId, password) {
        return this.request(`/api/usuarios/${usuarioId}/reset-password`, {
            method: "PUT",
            body: JSON.stringify({ password })
        });
    },

    obtenerConfiguracionDueno() {
        return this.request("/api/dueno/configuracion");
    },

    actualizarPerfilDueno(data) {
        return this.request("/api/dueno/perfil", {
            method: "PUT",
            body: JSON.stringify(data)
        });
    },

    cambiarPasswordDueno(data) {
        return this.request("/api/dueno/password", {
            method: "PUT",
            body: JSON.stringify(data)
        });
    },

    actualizarEmpresaDueno(data) {
        return this.request("/api/dueno/empresa", {
            method: "PUT",
            body: JSON.stringify(data)
        });
    },

    obtenerChoferes(vehiculoId = null) {
        const query = vehiculoId ? `?vehiculo_id=${vehiculoId}` : "";
        return this.request(`/api/choferes${query}`);
    },

    obtenerResumenAdmin() {
        return this.request("/api/admin/resumen");
    },

        obtenerAdminEmpresas() {
        return this.request("/api/admin/empresas");
    },

    obtenerAdminEmpresa(empresaId) {
        return this.request(`/api/admin/empresas/${empresaId}`);
    },

    crearAdminEmpresa(data) {
        return this.request("/api/admin/empresas", {
            method: "POST",
            body: JSON.stringify(data)
        });
    },

    editarAdminEmpresa(empresaId, data) {
        return this.request(`/api/admin/empresas/${empresaId}`, {
            method: "PUT",
            body: JSON.stringify(data)
        });
    },

    desactivarAdminEmpresa(empresaId) {
        return this.request(`/api/admin/empresas/${empresaId}/desactivar`, {
            method: "PUT"
        });
    },

    reactivarAdminEmpresa(empresaId) {
        return this.request(`/api/admin/empresas/${empresaId}/reactivar`, {
            method: "PUT"
        });
    },

    obtenerAdminDispositivos() {
        return this.request("/api/admin/dispositivos");
    },

    generarAdminDispositivo() {
        return this.request("/api/admin/dispositivos/generar");
    },

    obtenerAdminDispositivo(dispositivoId) {
        return this.request(`/api/admin/dispositivos/${dispositivoId}`);
    },

    crearAdminDispositivo(data) {
        return this.request("/api/admin/dispositivos", {
            method: "POST",
            body: JSON.stringify(data)
        });
    },

    editarAdminDispositivo(dispositivoId, data) {
        return this.request(`/api/admin/dispositivos/${dispositivoId}`, {
            method: "PUT",
            body: JSON.stringify(data)
        });
    },

    cambiarEstadoAdminDispositivo(dispositivoId, estado) {
        return this.request(`/api/admin/dispositivos/${dispositivoId}/estado`, {
            method: "PUT",
            body: JSON.stringify({ estado })
        });
    },

    obtenerAdminPlanesOpciones() {
        return this.request("/api/admin/planes/opciones");
    },

        obtenerAdminPlanes() {
        return this.request("/api/admin/planes");
    },

    obtenerAdminPlan(planId) {
        return this.request(
            `/api/admin/planes/${planId}`
        );
    },

    crearAdminPlan(data) {
        return this.request("/api/admin/planes", {
            method: "POST",
            body: JSON.stringify(data)
        });
    },

    editarAdminPlan(planId, data) {
        return this.request(
            `/api/admin/planes/${planId}`,
            {
                method: "PUT",
                body: JSON.stringify(data)
            }
        );
    },

    desactivarAdminPlan(planId) {
        return this.request(
            `/api/admin/planes/${planId}/desactivar`,
            {
                method: "PUT"
            }
        );
    },

    reactivarAdminPlan(planId) {
        return this.request(
            `/api/admin/planes/${planId}/reactivar`,
            {
                method: "PUT"
            }
        );
    },

    obtenerAdminTarifasPlan(planId) {
        return this.request(
            `/api/admin/planes/${planId}/tarifas`
        );
    },

    crearAdminTarifaPlan(planId, data) {
        return this.request(
            `/api/admin/planes/${planId}/tarifas`,
            {
                method: "POST",
                body: JSON.stringify(data)
            }
        );
    },

    editarAdminTarifaPlan(tarifaId, data) {
        return this.request(
            `/api/admin/tarifas/${tarifaId}`,
            {
                method: "PUT",
                body: JSON.stringify(data)
            }
        );
    },

    desactivarAdminTarifaPlan(tarifaId) {
        return this.request(
            `/api/admin/tarifas/${tarifaId}/desactivar`,
            {
                method: "PUT"
            }
        );
    },

    reactivarAdminTarifaPlan(tarifaId) {
        return this.request(
            `/api/admin/tarifas/${tarifaId}/reactivar`,
            {
                method: "PUT"
            }
        );
    },

    obtenerAdminSuscripciones() {
        return this.request(
            "/api/admin/suscripciones"
        );
    },

    obtenerAdminSuscripcion(suscripcionId) {
        return this.request(
            `/api/admin/suscripciones/${suscripcionId}`
        );
    },

    detectarAdminTarifaSuscripcion(
        planId,
        cantidadVehiculos
    ) {
        const params = new URLSearchParams({
            plan_id: planId,
            cantidad_vehiculos: cantidadVehiculos
        });

        return this.request(
            `/api/admin/suscripciones/detectar-tarifa?${params.toString()}`
        );
    },

    crearAdminSuscripcion(data) {
        return this.request(
            "/api/admin/suscripciones",
            {
                method: "POST",
                body: JSON.stringify(data)
            }
        );
    },

    editarAdminSuscripcion(
        suscripcionId,
        data
    ) {
        return this.request(
            `/api/admin/suscripciones/${suscripcionId}`,
            {
                method: "PUT",
                body: JSON.stringify(data)
            }
        );
    },

    cambiarEstadoAdminSuscripcion(
        suscripcionId,
        estado
    ) {
        return this.request(
            `/api/admin/suscripciones/${suscripcionId}/estado`,
            {
                method: "PUT",
                body: JSON.stringify({
                    estado
                })
            }
        );
    },

    obtenerAdminServicios() {
        return this.request(
            "/api/admin/servicios"
        );
    },

    obtenerAdminServicioProgramado(servicioId) {
        return this.request(
            `/api/admin/servicios/programados/${servicioId}`
        );
    },

    obtenerAdminCatalogosServicios() {
        return this.request(
            "/api/admin/servicios/catalogos"
        );
    },

    obtenerAdminVehiculosEmpresaServicio(empresaId) {
        return this.request(
            `/api/admin/servicios/empresas/${empresaId}/vehiculos`
        );
    },

    obtenerAdminDispositivoVehiculoServicio(vehiculoId) {
        return this.request(
            `/api/admin/servicios/vehiculos/${vehiculoId}/dispositivo`
        );
    },

    crearAdminServicioProgramado(data) {
        return this.request(
            "/api/admin/servicios/programados",
            {
                method: "POST",
                body: JSON.stringify(data)
            }
        );
    },

    editarAdminServicioProgramado(
        servicioId,
        data
    ) {
        return this.request(
            `/api/admin/servicios/programados/${servicioId}`,
            {
                method: "PUT",
                body: JSON.stringify(data)
            }
        );
    },

    cambiarEstadoAdminServicioProgramado(
        servicioId,
        estado
    ) {
        return this.request(
            `/api/admin/servicios/programados/${servicioId}/estado`,
            {
                method: "PUT",
                body: JSON.stringify({
                    estado
                })
            }
        );
    },

    vincularAdminServicioReal(
        servicioProgramadoId,
        servicioRealId
    ) {
        return this.request(
            `/api/admin/servicios/programados/${servicioProgramadoId}/vincular-real`,
            {
                method: "PUT",
                body: JSON.stringify({
                    servicio_id: servicioRealId
                })
            }
        );
    },

    obtenerAdminUsuarios() {
    return this.request("/api/admin/usuarios");
    },

    obtenerAdminUsuario(usuarioId) {
        return this.request(`/api/admin/usuarios/${usuarioId}`);
    },

    crearAdminUsuario(data) {
        return this.request("/api/admin/usuarios", {
            method: "POST",
            body: JSON.stringify(data)
        });
    },

    editarAdminUsuario(usuarioId, data) {
        return this.request(`/api/admin/usuarios/${usuarioId}`, {
            method: "PUT",
            body: JSON.stringify(data)
        });
    },

    desactivarAdminUsuario(usuarioId) {
        return this.request(`/api/admin/usuarios/${usuarioId}/desactivar`, {
            method: "PUT"
        });
    },

    reactivarAdminUsuario(usuarioId) {
        return this.request(`/api/admin/usuarios/${usuarioId}/reactivar`, {
            method: "PUT"
        });
    },

    resetPasswordAdminUsuario(usuarioId, password) {
        return this.request(`/api/admin/usuarios/${usuarioId}/reset-password`, {
            method: "PUT",
            body: JSON.stringify({ password })
        });
    },

    obtenerAdminAlertas() {
        return this.request(
            "/api/admin/alertas"
        );
    },

    obtenerAdminAlerta(alertaId) {
        return this.request(
            `/api/admin/alertas/${alertaId}`
        );
    },

    atenderAdminAlerta(alertaId) {
        return this.request(
            `/api/admin/alertas/${alertaId}/atender`,
            {
                method: "PUT"
            }
        );
    },

    obtenerAdminVehiculos() {
        return this.request(
            "/api/admin/vehiculos"
        );
    },

    obtenerAdminVehiculoDetalle(vehiculoId) {
        return this.request(
            `/api/admin/vehiculos/${vehiculoId}`
        );
    },

    obtenerAdminEventosVehiculo(vehiculoId) {
        return this.request(
            `/api/admin/vehiculos/${vehiculoId}/eventos`
        );
    },
    

    /* ============================================================
    CONFIGURACIÓN GLOBAL DEL SISTEMA
    ============================================================ */

    obtenerAdminConfiguracionSistema() {
        return this.request(
            "/api/admin/configuracion-sistema"
        );
    },
    
    actualizarAdminConfiguracionSistema(data) {
        return this.request(
            "/api/admin/configuracion-sistema",
            {
                method: "PUT",
                body: JSON.stringify(data),
            }
        );
    },

    obtenerIntervalosConfiguracionSistema() {
        return this.request(
            "/api/configuracion-sistema/intervalos"
        );
    },

    obtenerAdminConfiguracionSistema() {
        return this.request(
            "/api/admin/configuracion-sistema"
        );
    },

    actualizarAdminConfiguracionSistema(data) {
        return this.request(
            "/api/admin/configuracion-sistema",
            {
                method: "PUT",
                body: JSON.stringify(data),
            }
        );
    },

};