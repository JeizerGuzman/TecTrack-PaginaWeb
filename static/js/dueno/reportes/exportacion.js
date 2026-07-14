/* ============================================================
   EXPORTACIÓN DE REPORTES - TrackSecurity
   ============================================================ */


window.TrackReportesExportacion = {


    exportarCSV(
        registros,
        columnas,
        tipoReporte
    ) {

        if (
            !Array.isArray(registros) ||
            !registros.length
        ) {

            alert(
                "No hay registros para exportar."
            );

            return;
        }


        if (
            !Array.isArray(columnas) ||
            !columnas.length
        ) {

            alert(
                "No hay columnas disponibles para exportar."
            );

            return;
        }


        const encabezados =
            columnas.map(
                (columna) =>
                    this.escaparCSV(
                        columna.titulo
                    )
            );


        const filas =
            registros.map((registro) => {

                return columnas
                    .map((columna) => {

                        let valor =
                            registro[
                                columna.clave
                            ];


                        if (
                            columna.clave ===
                                "timestamp" ||
                            columna.clave ===
                                "fecha_creacion"
                        ) {

                            valor =
                                this.formatearFechaCSV(
                                    valor
                                );

                        }


                        return this.escaparCSV(
                            valor
                        );

                    })
                    .join(",");

            });


        const contenido = [

            encabezados.join(","),

            ...filas,

        ].join("\n");


        const blob =
            new Blob(
                [
                    "\uFEFF",
                    contenido,
                ],
                {
                    type:
                        "text/csv;charset=utf-8;",
                }
            );


        const url =
            URL.createObjectURL(blob);


        const enlace =
            document.createElement("a");


        const fecha =
            new Date()
                .toISOString()
                .slice(0, 10);


        enlace.href = url;

        enlace.download =
            `tracksecurity_${tipoReporte}_${fecha}.csv`;


        document.body.appendChild(
            enlace
        );


        enlace.click();


        enlace.remove();


        URL.revokeObjectURL(url);

    },


    escaparCSV(
        valor
    ) {

        const texto =
            String(
                valor ?? ""
            )
                .replaceAll(
                    '"',
                    '""'
                );


        return `"${texto}"`;

    },


    formatearFechaCSV(
        timestamp
    ) {

        const numero =
            Number(timestamp);


        if (
            !Number.isFinite(numero) ||
            numero <= 0
        ) {

            return "";

        }


        return new Date(
            numero * 1000
        ).toLocaleString(
            "es-MX"
        );

    },

};