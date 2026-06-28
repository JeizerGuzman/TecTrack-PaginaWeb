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
};