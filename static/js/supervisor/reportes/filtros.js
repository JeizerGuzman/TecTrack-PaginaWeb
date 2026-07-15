/* ============================================================
   FILTROS DE REPORTES - TrackSecurity
   ============================================================ */


window.TrackReportesFiltros = {


    obtenerParametros() {

        const vehiculoId =
            document
                .getElementById(
                    "filtroReporteVehiculo"
                )
                ?.value || "";


        const fechaDesde =
            document
                .getElementById(
                    "filtroReporteDesde"
                )
                ?.value || "";


        const fechaHasta =
            document
                .getElementById(
                    "filtroReporteHasta"
                )
                ?.value || "";


        const estado =
            document
                .getElementById(
                    "filtroReporteEstado"
                )
                ?.value || "";


        const parametros = {

            tipo:
                window.TrackReportesState
                    ?.tipoActual
                || "resumen",

            limite:
                300,

        };


        if (vehiculoId) {

            parametros.vehiculo_id =
                vehiculoId;

        }


        if (fechaDesde) {

            parametros.fecha_desde =
                this.fechaInicioTimestamp(
                    fechaDesde
                );

        }


        if (fechaHasta) {

            parametros.fecha_hasta =
                this.fechaFinTimestamp(
                    fechaHasta
                );

        }


        if (estado) {

            parametros.estado =
                estado;

        }


        return parametros;

    },


    pintarVehiculos(
        vehiculos = []
    ) {

        const select =
            document.getElementById(
                "filtroReporteVehiculo"
            );


        if (!select) {
            return;
        }


        const valorActual =
            select.value;


        select.innerHTML = `

            <option value="">
                Todos los vehículos
            </option>

            ${vehiculos
                .map((vehiculo) => `

                    <option
                        value="${Number(
                            vehiculo.id
                        )}"
                    >
                        ${this.escapeHtml(
                            vehiculo.nombre ||
                            "Vehículo"
                        )}
                        ${
                            vehiculo.placa
                                ? ` · ${this.escapeHtml(
                                    vehiculo.placa
                                )}`
                                : ""
                        }
                    </option>

                `)
                .join("")}

        `;


        const existe =
            [...select.options].some(
                (opcion) =>
                    opcion.value ===
                    valorActual
            );


        if (existe) {

            select.value =
                valorActual;

        }

    },


    actualizarFiltroEstado(
        tipoReporte
    ) {

        const grupo =
            document.getElementById(
                "grupoFiltroEstadoReporte"
            );


        const select =
            document.getElementById(
                "filtroReporteEstado"
            );


        if (
            !grupo ||
            !select
        ) {
            return;
        }


        let opciones = [];


        if (tipoReporte === "alertas") {

            opciones = [

                {
                    valor: "",
                    texto: "Todos los estados",
                },

                {
                    valor: "pendiente",
                    texto: "Pendientes",
                },

                {
                    valor: "atendida",
                    texto: "Atendidas",
                },

            ];

        }


        else if (
            tipoReporte === "vehiculos"
        ) {

            opciones = [

                {
                    valor: "",
                    texto: "Todos los estados",
                },

                {
                    valor: "activo",
                    texto: "Activos",
                },

                {
                    valor: "inactivo",
                    texto: "Inactivos",
                },

            ];

        }


        else if (
            tipoReporte === "servicios"
        ) {

            opciones = [

                {
                    valor: "",
                    texto: "Todos los estados",
                },

                {
                    valor: "pendiente",
                    texto: "Pendientes",
                },

                {
                    valor: "realizado",
                    texto: "Realizados",
                },

                {
                    valor: "cancelado",
                    texto: "Cancelados",
                },

            ];

        }


        else {

            grupo.hidden = true;

            select.innerHTML = `

                <option value="">
                    Todos los estados
                </option>

            `;

            return;

        }


        grupo.hidden = false;


        select.innerHTML =
            opciones
                .map((opcion) => `

                    <option
                        value="${opcion.valor}"
                    >
                        ${opcion.texto}
                    </option>

                `)
                .join("");

    },


    limpiar() {

        const ids = [

            "filtroReporteVehiculo",
            "filtroReporteDesde",
            "filtroReporteHasta",
            "filtroReporteEstado",

        ];


        ids.forEach((id) => {

            const elemento =
                document.getElementById(id);


            if (elemento) {

                elemento.value = "";

            }

        });

    },


    fechaInicioTimestamp(
        valor
    ) {

        const fecha =
            new Date(
                `${valor}T00:00:00`
            );


        return Math.floor(
            fecha.getTime() / 1000
        );

    },


    fechaFinTimestamp(
        valor
    ) {

        const fecha =
            new Date(
                `${valor}T23:59:59`
            );


        return Math.floor(
            fecha.getTime() / 1000
        );

    },


    escapeHtml(valor) {

        return String(
            valor ?? ""
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    },

};