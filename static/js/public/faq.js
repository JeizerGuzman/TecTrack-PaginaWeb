(function () {
    "use strict";

    // --- Diccionario centralizado: agrega/edita preguntas solo aquí ---
    const PREGUNTAS_FAQ = [

        {
            pregunta: "¿Hay un plan gratuito disponible?",
            respuesta: "No contamos con un plan gratuito, pero puedes solicitar una demostración para conocer el sistema antes de contratar."
        },

        {
            pregunta: "¿Puedo cambiar de plan más adelante?",
            respuesta: "Sí, puedes subir o bajar de plan cuando lo necesites. Contáctanos y ajustamos tu suscripción sin perder el historial de tus unidades."
        },

        {
            pregunta: "¿Se integra con otros sistemas?",
            respuesta: "El plan Premium incluye integración con sistemas externos y configuración personalizada según las necesidades de tu operación."
        },

        {
            pregunta: "¿Cómo se instala el dispositivo GPS en mi unidad?",
            respuesta: "La instalación la realiza nuestro equipo técnico y toma entre 30 y 60 minutos por unidad. Se configura mediante Bluetooth desde la app."
        },

        {
            pregunta: "¿Mis datos están seguros?",
            respuesta: "Sí, la información de tus unidades y recorridos se almacena de forma cifrada y solo tú tienes acceso a tu dashboard."
        }

    ];

    function crearItemFaq(item, indice) {

        const numero = String(indice + 1).padStart(2, "0");

        const article = document.createElement("article");

        article.className = "faq-item";
        article.dataset.index = indice;

        // --- cambiado: ya no usamos "hidden", ahora hay un wrapper que se anima ---
        article.innerHTML = `

            <button
                type="button"
                class="faq-item__pregunta"
                id="faq-btn-${indice}"
                aria-expanded="false"
                aria-controls="faq-respuesta-${indice}"
            >
                <span class="faq-item__numero">${numero}</span>

                <span class="faq-item__contenido">

                    <span class="faq-item__texto">${item.pregunta}</span>

                </span>

                <span class="faq-item__icono">
                    <i class="fa-solid fa-plus"></i>
                </span>

            </button>

            <div class="faq-item__respuesta-wrapper" id="faq-respuesta-${indice}">
                <div class="faq-item__respuesta">
                    ${item.respuesta}
                </div>
            </div>

        `;

        const boton = article.querySelector(".faq-item__pregunta");
        const icono = article.querySelector(".faq-item__icono i");

        boton.addEventListener("click", () => {

            const estaAbierto = boton.getAttribute("aria-expanded") === "true";

            boton.setAttribute("aria-expanded", String(!estaAbierto));

            article.classList.toggle("is-abierto", !estaAbierto);

            icono.className = estaAbierto
                ? "fa-solid fa-plus"
                : "fa-solid fa-minus";

        });

        return article;

    }

    function renderFaq() {

        const contenedor = document.getElementById("faq-lista");

        if (!contenedor) {
            return;
        }

        PREGUNTAS_FAQ.forEach((item, indice) => {

            const elemento = crearItemFaq(item, indice);

            contenedor.appendChild(elemento);

        });

    }

    document.addEventListener("DOMContentLoaded", renderFaq);

})();