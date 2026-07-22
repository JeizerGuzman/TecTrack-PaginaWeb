(function () {
    "use strict";

    let PLANES = [];

    async function cargarPlanes() {

        try {

            const response = await fetch("/api/publico/planes");

            if (!response.ok) {
                throw new Error("No fue posible obtener los planes.");
            }

            PLANES = await response.json();

            inicializarPlanes();

        } catch (error) {

            console.error(error);

        }

    }

    function inicializarPlanes() {

        const planes = PLANES;

        if (!planes.length) {
            return;
        }

        const indiceRecomendado = planes.length >= 3 ? 1 : -1;

        const selectorTrack = document.getElementById("selector-track");
        selectorTrack.innerHTML = `
            <span class="selector__indicator" id="selector-indicator">
                <span class="selector__pulso"></span>
            </span>
        `;

        selectorTrack.style.setProperty(
            "--total-opciones",
            planes.length
        );

        planes.forEach((plan, i) => {

            const btn = document.createElement("button");

            btn.type = "button";
            btn.className =
                "selector__opcion" +
                (i === 0 ? " is-active" : "");

            btn.dataset.index = i;

            btn.textContent = plan.nombre;

            btn.addEventListener("click", () => seleccionarPlan(i));

            selectorTrack.appendChild(btn);

        });

        const indicator = document.getElementById("selector-indicator");

        const opciones = Array.from(
            document.querySelectorAll(".selector__opcion")
        );

        const tarjeta = document.getElementById("tarjeta-principal");

        const elBadge = document.getElementById("tp-badge");

        const elNombre = document.getElementById("tp-nombre");

        const elDescripcion = document.getElementById("tp-descripcion");

        const elCaracteristicas = document.getElementById("tp-caracteristicas");

        const elRetenciones = document.getElementById("tp-retenciones");

        const elCta = document.getElementById("tp-cta");

        const elMiniPlanes = document.getElementById("mini-planes");

        let indiceActual = 0;

        function textoRetencion(dias) {

            return dias == null
                ? `<span class="retencion-item__valor retencion-item__valor--na">
                    No aplica
                   </span>`
                : `<span class="retencion-item__valor">
                    ${dias} días
                   </span>`;

        }

        function renderRetenciones(retenciones) {

            const items = [

                {
                    label: "GPS",
                    valor: retenciones.gps
                },

                {
                    label: "Alertas",
                    valor: retenciones.alertas
                },

                {
                    label: "Evidencias",
                    valor: retenciones.evidencias
                }

            ];

            elRetenciones.innerHTML = items.map(item => `

                <div class="retencion-item">

                    ${textoRetencion(item.valor)}

                    <span class="retencion-item__label">

                        ${item.label}

                    </span>

                </div>

            `).join("");

        }

        function renderCaracteristicas(caracteristicas) {

            elCaracteristicas.innerHTML = caracteristicas
                .map((c) => {

                    const clase = c.incluida
                        ? "caracteristica--incluida"
                        : "caracteristica--excluida";

                    const icono = c.incluida
                        ? "fa-check"
                        : "fa-xmark";

                    return `

                        <li class="${clase}">

                            <span class="icono-estado">

                                <i class="fa-solid ${icono}"></i>

                            </span>

                            <span>${c.etiqueta}</span>

                        </li>

                    `;

                })
                .join("");

        }

        function renderMiniPlanes(indiceSeleccionado) {

            const otros = planes
                .map((p, i) => ({
                    ...p,
                    indice: i
                }))
                .filter(p => p.indice !== indiceSeleccionado);

            elMiniPlanes.innerHTML = otros.map(p => `

                <div class="mini-plan"

                    data-index="${p.indice}"

                    tabindex="0">

                    <p class="mini-plan__nombre">

                        ${p.nombre}

                    </p>

                    <p class="mini-plan__descripcion">

                        ${p.descripcion}

                    </p>

                    <span class="mini-plan__cambiar">

                        Ver este plan

                    </span>

                </div>

            `).join("");

            elMiniPlanes
                .querySelectorAll(".mini-plan")
                .forEach(card => {

                    card.onclick = () =>
                        seleccionarPlan(Number(card.dataset.index));

                });

        }

        function moverIndicador(indice) {

            indicator.style.transform =
                `translateX(${indice * 100}%)`;

        }

        function renderTarjetaPrincipal(plan, indice) {

            elBadge.hidden =
                indice !== indiceRecomendado;

            elNombre.textContent =
                plan.nombre;

            elDescripcion.textContent =
                plan.descripcion;

            renderCaracteristicas(
                plan.caracteristicas
            );

            renderRetenciones(
                plan.retenciones
            );

            elCta.dataset.planId =
                plan.id;

            elCta.innerHTML =
                `Solicitar ${plan.nombre}
                <i class="fa-solid fa-arrow-right"></i>`;

        }

        function seleccionarPlan(indice) {

            indiceActual = indice;

            moverIndicador(indice);

            opciones.forEach((btn, i) => {

                btn.classList.toggle(
                    "is-active",
                    i === indice
                );

            });

            tarjeta.classList.add("is-cambiando");

            setTimeout(() => {

                renderTarjetaPrincipal(
                    planes[indice],
                    indice
                );

                tarjeta.classList.remove(
                    "is-cambiando"
                );

            }, 180);

            renderMiniPlanes(indice);

        }

        moverIndicador(0);

        renderTarjetaPrincipal(
            planes[0],
            0
        );

        renderMiniPlanes(0);

    }

    document.addEventListener(
        "DOMContentLoaded",
        cargarPlanes
    );

})();