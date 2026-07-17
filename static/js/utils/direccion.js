window.TrackDireccion = {

    obtenerTexto(vehiculo) {

        const direccion =
            vehiculo?.direccion;

        if (
            direccion
            &&
            String(direccion).trim() !== ""
        ) {

            return String(direccion).trim();

        }

        return "Dirección no disponible";

    },


    tieneDireccion(vehiculo) {

        return Boolean(
            vehiculo?.direccion
            &&
            String(vehiculo.direccion).trim() !== ""
        );

    },


    renderDireccion(vehiculo) {

        const direccion =
            this.obtenerTexto(
                vehiculo
            );

        const disponible =
            this.tieneDireccion(
                vehiculo
            );

        return `
            <div class="direccion-vehiculo-card ${disponible ? "" : "direccion-vehiculo-card--vacia"}">
                <div class="direccion-vehiculo-icono">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1 1 18 0Z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                </div>

                <div class="direccion-vehiculo-info">
                    <span>
                        Dirección aproximada
                    </span>

                    <strong>
                        ${direccion}
                    </strong>
                </div>
            </div>
        `;

    }

};