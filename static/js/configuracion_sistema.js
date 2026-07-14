/* ============================================================
   CONFIGURACIÓN GLOBAL DEL SISTEMA
   TrackSecurity
   ============================================================ */

const TrackConfig = {

    /* ========================================================
       ESTADO INTERNO
       ======================================================== */

    _configuracion: null,

    _promesaCarga: null,

    _ultimaCargaMs: 0,

    _cacheDuracionMs: 60000,


    /* ========================================================
       VALORES DE RESPALDO
       ======================================================== */

    _defaults: {

        segundos_sin_senal: 60,

        admin: {
            dashboard: 30,
            empresas: 30,
            suscripciones: 30,
            planes: 30,
            usuarios: 30,
            vehiculos: 10,
            detalle_vehiculo: 5,
            dispositivos: 10,
            servicios: 30,
            alertas: 5,
        },

        operacion: {
            dashboard: 5,
            vehiculos: 5,
            detalle_vehiculo: 3,
            alertas: 5,
            monitoreo: 3,
        },

    },


    /* ========================================================
       CARGAR CONFIGURACIÓN
       ======================================================== */

    async cargar({
        forzar = false
    } = {}) {

        const ahora = Date.now();


        /*
         * Si ya existe una configuración reciente,
         * se reutiliza.
         */

        if (
            !forzar &&
            this._configuracion &&
            (
                ahora - this._ultimaCargaMs
            ) < this._cacheDuracionMs
        ) {
            return this._configuracion;
        }


        /*
         * Si ya hay una consulta en proceso,
         * se reutiliza la misma promesa.
         */

        if (
            !forzar &&
            this._promesaCarga
        ) {
            return this._promesaCarga;
        }


        this._promesaCarga = this._cargarDesdeApi();


        try {

            const configuracion =
                await this._promesaCarga;


            this._configuracion =
                configuracion;


            this._ultimaCargaMs =
                Date.now();


            return this._configuracion;


        } finally {

            this._promesaCarga = null;

        }

    },


    /* ========================================================
       CONSULTAR API
       ======================================================== */

    async _cargarDesdeApi() {

        try {

            if (
                typeof TrackAPI === "undefined" ||
                typeof TrackAPI.obtenerIntervalosConfiguracionSistema
                    !== "function"
            ) {

                console.warn(
                    "TrackConfig: TrackAPI no está disponible."
                );

                return this._copiarDefaults();

            }


            const respuesta =
                await TrackAPI
                    .obtenerIntervalosConfiguracionSistema();


            if (
                !respuesta ||
                typeof respuesta !== "object"
            ) {

                throw new Error(
                    "La respuesta de configuración no es válida."
                );

            }


            return this._normalizarConfiguracion(
                respuesta
            );


        } catch (error) {

            console.warn(
                "TrackConfig: no se pudieron cargar los intervalos. " +
                "Se usarán valores de respaldo.",
                error
            );


            return this._copiarDefaults();

        }

    },


    /* ========================================================
       NORMALIZAR RESPUESTA
       ======================================================== */

    _normalizarConfiguracion(data) {

        const defaults =
            this._defaults;


        return {

            segundos_sin_senal:
                this._enteroSeguro(
                    data.segundos_sin_senal,
                    defaults.segundos_sin_senal
                ),


            admin: {

                dashboard:
                    this._enteroSeguro(
                        data.admin?.dashboard,
                        defaults.admin.dashboard
                    ),

                empresas:
                    this._enteroSeguro(
                        data.admin?.empresas,
                        defaults.admin.empresas
                    ),

                suscripciones:
                    this._enteroSeguro(
                        data.admin?.suscripciones,
                        defaults.admin.suscripciones
                    ),

                planes:
                    this._enteroSeguro(
                        data.admin?.planes,
                        defaults.admin.planes
                    ),

                usuarios:
                    this._enteroSeguro(
                        data.admin?.usuarios,
                        defaults.admin.usuarios
                    ),

                vehiculos:
                    this._enteroSeguro(
                        data.admin?.vehiculos,
                        defaults.admin.vehiculos
                    ),

                detalle_vehiculo:
                    this._enteroSeguro(
                        data.admin?.detalle_vehiculo,
                        defaults.admin.detalle_vehiculo
                    ),

                dispositivos:
                    this._enteroSeguro(
                        data.admin?.dispositivos,
                        defaults.admin.dispositivos
                    ),

                servicios:
                    this._enteroSeguro(
                        data.admin?.servicios,
                        defaults.admin.servicios
                    ),

                alertas:
                    this._enteroSeguro(
                        data.admin?.alertas,
                        defaults.admin.alertas
                    ),

            },


            operacion: {

                dashboard:
                    this._enteroSeguro(
                        data.operacion?.dashboard,
                        defaults.operacion.dashboard
                    ),

                vehiculos:
                    this._enteroSeguro(
                        data.operacion?.vehiculos,
                        defaults.operacion.vehiculos
                    ),

                detalle_vehiculo:
                    this._enteroSeguro(
                        data.operacion?.detalle_vehiculo,
                        defaults.operacion.detalle_vehiculo
                    ),

                alertas:
                    this._enteroSeguro(
                        data.operacion?.alertas,
                        defaults.operacion.alertas
                    ),

                monitoreo:
                    this._enteroSeguro(
                        data.operacion?.monitoreo,
                        defaults.operacion.monitoreo
                    ),

            },

        };

    },


    /* ========================================================
       OBTENER CONFIGURACIÓN COMPLETA
       ======================================================== */

    async obtenerConfiguracion({
        forzar = false
    } = {}) {

        return this.cargar({
            forzar
        });

    },


    /* ========================================================
       OBTENER SEGUNDOS SIN SEÑAL
       ======================================================== */

    async obtenerSegundosSinSenal() {

        const config =
            await this.cargar();


        return config.segundos_sin_senal;

    },


    /* ========================================================
       OBTENER INTERVALO DE ADMINISTRADOR
       Devuelve segundos.
       ======================================================== */

    async obtenerAdmin(
        modulo,
        valorRespaldo = 30
    ) {

        const config =
            await this.cargar();


        return this._enteroSeguro(
            config.admin?.[modulo],
            valorRespaldo
        );

    },


    /* ========================================================
       OBTENER INTERVALO OPERATIVO
       Dueño y supervisor.
       Devuelve segundos.
       ======================================================== */

    async obtenerOperacion(
        modulo,
        valorRespaldo = 5
    ) {

        const config =
            await this.cargar();


        return this._enteroSeguro(
            config.operacion?.[modulo],
            valorRespaldo
        );

    },


    /* ========================================================
       OBTENER INTERVALO ADMINISTRADOR EN MILISEGUNDOS
       ======================================================== */

    async obtenerAdminMs(
        modulo,
        valorRespaldoSegundos = 30
    ) {

        const segundos =
            await this.obtenerAdmin(
                modulo,
                valorRespaldoSegundos
            );


        return segundos * 1000;

    },


    /* ========================================================
       OBTENER INTERVALO OPERATIVO EN MILISEGUNDOS
       ======================================================== */

    async obtenerOperacionMs(
        modulo,
        valorRespaldoSegundos = 5
    ) {

        const segundos =
            await this.obtenerOperacion(
                modulo,
                valorRespaldoSegundos
            );


        return segundos * 1000;

    },


    /* ========================================================
       REFRESCAR CONFIGURACIÓN
       ======================================================== */

    async refrescar() {

        return this.cargar({
            forzar: true
        });

    },


    /* ========================================================
       LIMPIAR CACHE
       ======================================================== */

    limpiarCache() {

        this._configuracion = null;

        this._promesaCarga = null;

        this._ultimaCargaMs = 0;

    },


    /* ========================================================
       HELPERS
       ======================================================== */

    _enteroSeguro(
        valor,
        respaldo
    ) {

        const numero =
            Number.parseInt(
                valor,
                10
            );


        if (
            !Number.isFinite(numero) ||
            numero <= 0
        ) {
            return respaldo;
        }


        return numero;

    },


    _copiarDefaults() {

        return JSON.parse(
            JSON.stringify(
                this._defaults
            )
        );

    },

};