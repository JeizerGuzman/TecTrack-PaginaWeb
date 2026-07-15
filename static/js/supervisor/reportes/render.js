/* ============================================================
   RENDER DE REPORTES - TrackSecurity
   ============================================================ */


window.TrackReportesRender = {


    pintarMetricas(
        metricas = {}
    ) {

        this.asignarTexto(
            "statReportesVehiculos",
            Number(
                metricas.vehiculos || 0
            )
        );


        this.asignarTexto(
            "statReportesAlertas",
            Number(
                metricas.alertas || 0
            )
        );


        this.asignarTexto(
            "statReportesPendientes",
            Number(
                metricas.alertas_pendientes || 0
            )
        );


        this.asignarTexto(
            "statReportesServicios",
            Number(
                metricas.servicios || 0
            )
        );

    },


    pintarReporte(
        respuesta
    ) {

        const registros =
            Array.isArray(
                respuesta?.registros
            )
                ? respuesta.registros
                : [];


        const columnas =
            Array.isArray(
                respuesta?.columnas
            )
                ? respuesta.columnas
                : [];


        const estado =
            document.getElementById(
                "estadoReporte"
            );


        const contenedor =
            document.getElementById(
                "contenedorTablaReporte"
            );


        const head =
            document.getElementById(
                "tablaReporteHead"
            );


        const body =
            document.getElementById(
                "tablaReporteBody"
            );


        if (
            !estado ||
            !contenedor ||
            !head ||
            !body
        ) {
            return;
        }


        this.actualizarCantidad(
            registros.length
        );


        if (!registros.length) {

            contenedor.hidden = true;

            estado.hidden = false;


            estado.innerHTML = `

                <strong>
                    No hay registros para mostrar
                </strong>

                <p>
                    No se encontró información
                    con los filtros seleccionados.
                </p>

            `;


            return;

        }


        estado.hidden = true;

        contenedor.hidden = false;


        head.innerHTML = `

            <tr>

                ${columnas
                    .map((columna) => `

                        <th>
                            ${this.escapeHtml(
                                columna.titulo
                            )}
                        </th>

                    `)
                    .join("")}

                <th class="reportes-actions-column">
                    Acciones
                </th>

            </tr>

        `;


        body.innerHTML =
            registros
                .map((registro, indice) => `

                    <tr>

                        ${columnas
                            .map((columna) => `

                                <td>

                                    ${this.formatearCelda(
                                        columna.clave,
                                        registro[
                                            columna.clave
                                        ],
                                        registro
                                    )}

                                </td>

                            `)
                            .join("")}

                        <td class="reportes-actions-cell">

                            <button
                                type="button"
                                class="reportes-detail-btn"
                                data-reporte-indice="${indice}"
                            >
                                Ver detalle
                            </button>

                        </td>

                    </tr>

                `)
                .join("");


        body
            .querySelectorAll(
                "[data-reporte-indice]"
            )
            .forEach((boton) => {

                boton.addEventListener(
                    "click",
                    () => {

                        const indice =
                            Number(
                                boton.dataset
                                    .reporteIndice
                            );


                        const registro =
                            registros[indice];


                        this.abrirModalDetalle(
                            registro
                        );

                    }
                );

            });

    },


    formatearCelda(
        clave,
        valor,
        registro
    ) {

        if (
            clave === "timestamp" ||
            clave === "fecha_creacion"
        ) {

            return this.escapeHtml(
                this.formatearFecha(valor)
            );

        }


        if (clave === "costo") {

            return this.escapeHtml(
                this.formatearMoneda(valor)
            );

        }


        if (
            clave === "nivel"
        ) {

            return `

                <span class="
                    reporte-nivel-texto
                    reporte-nivel-${this.normalizar(
                        valor
                    )}
                ">
                    ${this.escapeHtml(
                        this.formatearTexto(valor)
                    )}
                </span>

            `;

        }


        if (
            clave === "estado"
        ) {

            return `

                <span class="
                    reporte-estado-texto
                    reporte-estado-${this.normalizar(
                        valor
                    )}
                ">
                    ${this.escapeHtml(
                        this.formatearTexto(valor)
                    )}
                </span>

            `;

        }


        if (
            clave === "estado_instalacion"
        ) {

            return `

                <span class="
                    reporte-estado-con-punto
                    reporte-estado-texto
                    reporte-instalacion-${this.normalizar(
                        valor
                    )}
                ">
                    ${this.escapeHtml(
                        this.formatearTexto(valor)
                    )}
                </span>

            `;

        }


        if (
            valor === null ||
            valor === undefined ||
            valor === ""
        ) {

            return `

                <span class="reporte-empty-value">
                    —
                </span>

            `;

        }


        return this.escapeHtml(
            valor
        );

    },


    abrirModalDetalle(
        registro
    ) {

        if (!registro) {
            return;
        }


        const modal =
            document.getElementById(
                "modalDetalleReporte"
            );


        const titulo =
            document.getElementById(
                "modalDetalleReporteTitulo"
            );


        const contenido =
            document.getElementById(
                "modalDetalleReporteContenido"
            );


        if (
            !modal ||
            !titulo ||
            !contenido
        ) {
            return;
        }


        const tipoReporte =
            window.TrackReportesState
                ?.tipoActual
            || "resumen";


        titulo.textContent =
            registro.tipo_texto ||
            registro.vehiculo ||
            "Detalle del registro";


        contenido.innerHTML =
            this.crearDetalleReporte(
                registro,
                tipoReporte
            );


        modal.classList.add(
            "open"
        );


        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.classList.add(
            "modal-open"
        );

    },


    cerrarModalDetalle() {

        const modal =
            document.getElementById(
                "modalDetalleReporte"
            );


        if (!modal) {
            return;
        }


        modal.classList.remove(
            "open"
        );


        modal.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.classList.remove(
            "modal-open"
        );

    },


    mostrarError(
        mensaje
    ) {

        const estado =
            document.getElementById(
                "estadoReporte"
            );


        const contenedor =
            document.getElementById(
                "contenedorTablaReporte"
            );


        if (contenedor) {

            contenedor.hidden = true;

        }


        if (estado) {

            estado.hidden = false;


            estado.innerHTML = `

                <strong>
                    No se pudo generar el reporte
                </strong>

                <p>
                    ${this.escapeHtml(
                        mensaje ||
                        "Ocurrió un error inesperado."
                    )}
                </p>

            `;

        }

    },


    mostrarCargando() {

        const estado =
            document.getElementById(
                "estadoReporte"
            );


        const contenedor =
            document.getElementById(
                "contenedorTablaReporte"
            );


        if (contenedor) {

            contenedor.hidden = true;

        }


        if (estado) {

            estado.hidden = false;


            estado.innerHTML = `

                <strong>
                    Generando reporte...
                </strong>

                <p>
                    Espera mientras se consulta
                    la información.
                </p>

            `;

        }

    },


    actualizarCantidad(
        cantidad
    ) {

        this.asignarTexto(
            "cantidadRegistrosReporte",
            cantidad === 1
                ? "1 registro"
                : `${cantidad} registros`
        );

    },


    actualizarTitulo(
        tipo
    ) {

        const configuracion = {

            resumen: {
                titulo:
                    "Resumen general",

                descripcion:
                    "Actividad consolidada por cada vehículo.",
            },

            alertas: {
                titulo:
                    "Reporte de alertas",

                descripcion:
                    "Incidentes registrados y estado de atención.",
            },

            vehiculos: {
                titulo:
                    "Reporte de vehículos",

                descripcion:
                    "Inventario actual de la flota y asignaciones.",
            },

            servicios: {
                titulo:
                    "Reporte de servicios",

                descripcion:
                    "Trabajos técnicos y mantenimientos registrados.",
            },

        };


        const actual =
            configuracion[tipo]
            ||
            configuracion.resumen;


        this.asignarTexto(
            "tituloReporteActual",
            actual.titulo
        );


        this.asignarTexto(
            "descripcionReporteActual",
            actual.descripcion
        );

    },


    nombreCampo(
        clave
    ) {

        const nombres = {

            vehiculo:
                "Vehículo",

            identificador:
                "Identificador",

            placa:
                "Placa",

            tipo:
                "Tipo interno",

            tipo_texto:
                "Tipo",

            nivel:
                "Nivel",

            descripcion:
                "Descripción",

            estado:
                "Estado",

            atendida:
                "Atendida",

            condicion_activa:
                "Condición activa",

            atendida_por:
                "Atendida por",

            fecha_atencion:
                "Fecha de atención",

            timestamp:
                "Fecha",

            lat:
                "Latitud",

            lng:
                "Longitud",

            marca:
                "Marca",

            modelo:
                "Modelo",

            anio:
                "Año",

            chofer:
                "Chofer",

            estado_instalacion:
                "Estado de instalación",

            fecha_creacion:
                "Fecha de creación",

            costo:
                "Costo",

            dispositivo_id:
                "Dispositivo",

            alertas:
                "Alertas",

            alertas_pendientes:
                "Alertas pendientes",

            eventos:
                "Eventos",

            servicios:
                "Servicios",

            puntos_gps:
                "Puntos GPS",

            activo:
                "Activo",

        };


        return nombres[clave]
            ||
            this.formatearTexto(clave);

    },


    formatearDetalle(
        clave,
        valor
    ) {

        if (
            clave === "timestamp" ||
            clave === "fecha_creacion" ||
            clave === "fecha_atencion"
        ) {

            return this.formatearFecha(valor);

        }


        if (clave === "costo") {

            return this.formatearMoneda(valor);

        }


        if (
            typeof valor === "boolean"
        ) {

            return valor
                ? "Sí"
                : "No";

        }


        if (
            valor === null ||
            valor === undefined ||
            valor === ""
        ) {

            return "No disponible";

        }


        if (
            clave === "estado_instalacion" ||
            clave === "nivel" ||
            clave === "estado"
        ) {

            return this.formatearTexto(valor);

        }


        return String(valor);

    },


    formatearFecha(
        timestamp
    ) {

        const numero =
            Number(timestamp);


        if (
            !Number.isFinite(numero) ||
            numero <= 0
        ) {

            return "No disponible";

        }


        return new Date(
            numero * 1000
        ).toLocaleString(
            "es-MX",
            {
                dateStyle:
                    "medium",

                timeStyle:
                    "short",
            }
        );

    },


    formatearMoneda(
        valor
    ) {

        const numero =
            Number(valor);


        if (!Number.isFinite(numero)) {

            return "$0.00";

        }


        return numero.toLocaleString(
            "es-MX",
            {
                style:
                    "currency",

                currency:
                    "MXN",
            }
        );

    },


    formatearTexto(
        valor
    ) {

        return String(
            valor || ""
        )
            .replaceAll("_", " ")
            .replace(
                /\b\w/g,
                (letra) =>
                    letra.toUpperCase()
            );

    },


    normalizar(
        valor
    ) {

        return String(
            valor || ""
        )
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /[^a-z0-9_-]/g,
                "-"
            );

    },


    asignarTexto(
        id,
        valor
    ) {

        const elemento =
            document.getElementById(id);


        if (elemento) {

            elemento.textContent =
                valor;

        }

    },


    escapeHtml(
        valor
    ) {

        return String(
            valor ?? ""
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    },

    crearDetalleReporte(
        registro,
        tipoReporte
    ) {

        if (tipoReporte === "alertas") {

            return `

                <section class="reporte-detalle-section">

                    <h4>
                        Información de la alerta
                    </h4>


                    <div class="reporte-detalle-grid">

                        ${this.crearCampoDetalle(
                            "Vehículo",
                            registro.vehiculo
                        )}

                        ${this.crearCampoDetalle(
                            "Placa",
                            registro.placa
                        )}

                        ${this.crearCampoDetalle(
                            "Tipo",
                            registro.tipo_texto
                        )}

                        ${this.crearCampoDetalle(
                            "Nivel",
                            this.formatearTexto(
                                registro.nivel
                            )
                        )}

                        ${this.crearCampoDetalle(
                            "Estado",
                            registro.estado
                        )}

                        ${this.crearCampoDetalle(
                            "Fecha",
                            this.formatearFecha(
                                registro.timestamp
                            )
                        )}

                    </div>

                </section>


                <section class="reporte-detalle-section">

                    <h4>
                        Descripción
                    </h4>

                    <div class="reporte-detalle-description">

                        ${this.escapeHtml(
                            registro.descripcion ||
                            "Sin descripción disponible."
                        )}

                    </div>

                </section>


                ${
                    registro.lat !== null &&
                    registro.lng !== null

                        ? `

                            <section class="reporte-detalle-section">

                                <h4>
                                    Ubicación registrada
                                </h4>

                                <div class="reporte-detalle-location">

                                    ${Number(
                                        registro.lat
                                    ).toFixed(6)},

                                    ${Number(
                                        registro.lng
                                    ).toFixed(6)}

                                </div>

                            </section>

                        `

                        : ""
                }

            `;

        }


        if (tipoReporte === "vehiculos") {

            return `

                <section class="reporte-detalle-section">

                    <h4>
                        Información del vehículo
                    </h4>


                    <div class="reporte-detalle-grid">

                        ${this.crearCampoDetalle(
                            "Nombre",
                            registro.vehiculo
                        )}

                        ${this.crearCampoDetalle(
                            "Identificador",
                            registro.identificador
                        )}

                        ${this.crearCampoDetalle(
                            "Placa",
                            registro.placa
                        )}

                        ${this.crearCampoDetalle(
                            "Marca",
                            registro.marca
                        )}

                        ${this.crearCampoDetalle(
                            "Modelo",
                            registro.modelo
                        )}

                        ${this.crearCampoDetalle(
                            "Año",
                            registro.anio
                        )}

                        ${this.crearCampoDetalle(
                            "Chofer",
                            registro.chofer
                        )}

                        ${this.crearCampoDetalle(
                            "Estado",
                            registro.estado
                        )}

                        ${this.crearCampoDetalle(
                            "Instalación",
                            this.formatearTexto(
                                registro.estado_instalacion
                            )
                        )}

                    </div>

                </section>

            `;

        }


        if (tipoReporte === "servicios") {

            return `

                <section class="reporte-detalle-section">

                    <h4>
                        Información del servicio
                    </h4>


                    <div class="reporte-detalle-grid">

                        ${this.crearCampoDetalle(
                            "Tipo",
                            registro.tipo_texto
                        )}

                        ${this.crearCampoDetalle(
                            "Vehículo",
                            registro.vehiculo
                        )}

                        ${this.crearCampoDetalle(
                            "Placa",
                            registro.placa
                        )}

                        ${this.crearCampoDetalle(
                            "Estado",
                            this.formatearTexto(
                                registro.estado
                            )
                        )}

                        ${this.crearCampoDetalle(
                            "Costo",
                            this.formatearMoneda(
                                registro.costo
                            )
                        )}

                        ${this.crearCampoDetalle(
                            "Fecha",
                            this.formatearFecha(
                                registro.timestamp
                            )
                        )}

                    </div>

                </section>


                <section class="reporte-detalle-section">

                    <h4>
                        Descripción
                    </h4>

                    <div class="reporte-detalle-description">

                        ${this.escapeHtml(
                            registro.descripcion ||
                            "Sin descripción disponible."
                        )}

                    </div>

                </section>

            `;

        }


        return `

            <section class="reporte-detalle-section">

                <h4>
                    Resumen del vehículo
                </h4>


                <div class="reporte-detalle-grid">

                    ${this.crearCampoDetalle(
                        "Vehículo",
                        registro.vehiculo
                    )}

                    ${this.crearCampoDetalle(
                        "Placa",
                        registro.placa
                    )}

                    ${this.crearCampoDetalle(
                        "Alertas",
                        registro.alertas
                    )}

                    ${this.crearCampoDetalle(
                        "Alertas pendientes",
                        registro.alertas_pendientes
                    )}

                    ${this.crearCampoDetalle(
                        "Eventos",
                        registro.eventos
                    )}

                    ${this.crearCampoDetalle(
                        "Servicios",
                        registro.servicios
                    )}

                    ${this.crearCampoDetalle(
                        "Puntos GPS",
                        registro.puntos_gps
                    )}

                </div>

            </section>

        `;

    },

    crearCampoDetalle(
        etiqueta,
        valor
    ) {

        return `

            <div class="reporte-detalle-field">

                <span>
                    ${this.escapeHtml(
                        etiqueta
                    )}
                </span>

                <strong>
                    ${this.escapeHtml(
                        valor === null ||
                        valor === undefined ||
                        valor === ""
                            ? "No disponible"
                            : valor
                    )}
                </strong>

            </div>

        `;

    },

};