(function () {
    "use strict";

    // --- Diccionario centralizado: agrega/edita capturas solo aquí ---
    const CAPTURAS_APP = [

        { src: "img/public/aplicacion/captura-1.jpeg", alt: "Vista de monitoreo general en la app", descripcion: "Monitoreo general de tu flota en tiempo real." },
        { src: "img/public/aplicacion/captura-2.jpeg", alt: "Vista de alertas en la app", descripcion: "Consulta y administra tus vehículos de forma rápida y segura." },
        { src: "img/public/aplicacion/captura-3.jpeg", alt: "Vista de historial de recorridos", descripcion: "Recibe alertas en tiempo real para actuar de inmediato." },
        { src: "img/public/aplicacion/captura-4.jpeg", alt: "Vista de gestión de unidades", descripcion: "Visualiza la ubicación de tu flota en tiempo real." },
        { src: "img/public/aplicacion/captura-5.jpeg", alt: "Vista de reportes", descripcion: "    Administra tu información y preferencias." },
        { src: "img/public/aplicacion/captura-6.jpeg", alt: "Vista de configuración", descripcion: "    Conéctate y mantén el control de tus vehículos." }

    ];

    const TOTAL = CAPTURAS_APP.length;   // 6
    const AUTOPLAY_MS = 4000;            // 4 segundos
    const BREAKPOINT_MOVIL = 640;        // px: debajo de esto, 1 foto a la vez

    const PEEK_MOVIL = 0.78; // debe coincidir con el % del CSS en @media (max-width: 640px)

    let VISIBLES = calcularVisibles();
    let centroOffset = Math.floor(VISIBLES / 2);

    let indice = TOTAL;      // arrancamos parados en la 1ra copia "real" (índice medio)
    let animando = false;
    let autoplayTimer = null;

    const modal = document.getElementById("galeriaModal");
    const backdrop = document.getElementById("galeriaBackdrop");
    const btnAbrir = document.getElementById("btnAbrirGaleria");
    const btnCerrar = document.getElementById("galeriaCerrar");
    const btnAnterior = document.getElementById("galeriaAnterior");
    const btnSiguiente = document.getElementById("galeriaSiguiente");
    const viewport = document.getElementById("galeriaViewport");
    const track = document.getElementById("galeriaTrack");
    const descripcion = document.getElementById("galeriaDescripcion");
    const contador = document.getElementById("galeriaContador");

    function calcularVisibles() {

        return window.innerWidth <= BREAKPOINT_MOVIL ? 1 : 3;

    }

    function rutaEstatica(ruta) {

        // Ajusta este prefijo si tu url_for de static no es "/static/"
        return `/static/${ruta}`;

    }

    // --- Construye 3 copias seguidas de las 6 fotos = 18 slides ---
    function construirSlides() {

        const arreglo = [...CAPTURAS_APP, ...CAPTURAS_APP, ...CAPTURAS_APP];

        track.innerHTML = arreglo.map(item => `

            <div class="galeria-modal__slide">
                <img src="${rutaEstatica(item.src)}" alt="${item.alt}">
            </div>

        `).join("");

    }

    // --- Posiciona el track según "indice" y cuántas fotos caben (VISIBLES) ---
    function posicionar(instantaneo) {
        const proporcion = VISIBLES === 1 ? PEEK_MOVIL : (1 / VISIBLES);
        const anchoSlide = viewport.clientWidth * proporcion;

        let desplazamiento;
        if (VISIBLES === 1) {
            // Centra el slide activo dejando ver el pedacito de los vecinos
            desplazamiento = -(indice * anchoSlide) + (viewport.clientWidth - anchoSlide) / 2;
        } else {
            desplazamiento = -indice * anchoSlide;
        }

        track.style.transition = instantaneo ? "none" : "transform 0.5s ease";
        track.style.transform = `translateX(${desplazamiento}px)`;

        marcarCentro();
        actualizarInfo();
    }

    // --- Resalta visualmente la foto del centro del bloque visible ---
    function marcarCentro() {

        Array.from(track.children).forEach(slide => {
            slide.classList.remove("is-centro");
        });

        const centro = track.children[indice + centroOffset];

        if (centro) {
            centro.classList.add("is-centro");
        }

    }

    // --- Índice real (0-5) de la foto que está en el centro ---
    function indiceRealCentro() {

        return ((indice + centroOffset - TOTAL) % TOTAL + TOTAL) % TOTAL;

    }

    function actualizarInfo() {

        const real = indiceRealCentro();
        const item = CAPTURAS_APP[real];

        descripcion.textContent = item.descripcion;
        contador.textContent = `${real + 1} / ${TOTAL}`;

    }

    function mover(direccion) {

        if (animando) {
            return;
        }

        animando = true;
        indice += direccion;

        posicionar(false);

    }

    // --- Salta a una foto real específica sin animación larga ---
    function irACentro(indiceReal) {

        indice = TOTAL + indiceReal - centroOffset;

        posicionar(true);

    }

    // --- Al terminar la transición, si nos salimos del bloque "real" del medio, brincamos sin animar ---
    track.addEventListener("transitionend", () => {

        if (indice >= TOTAL * 2) {
            indice -= TOTAL;
            posicionar(true);
        } else if (indice < TOTAL) {
            indice += TOTAL;
            posicionar(true);
        }

        animando = false;

    });

    function iniciarAutoplay() {

        autoplayTimer = setInterval(() => mover(1), AUTOPLAY_MS);

    }

    function detenerAutoplay() {

        clearInterval(autoplayTimer);

    }

    function reiniciarAutoplay() {

        detenerAutoplay();
        iniciarAutoplay();

    }

    // --- Si cambia el ancho de ventana y cruza el breakpoint, recalcula VISIBLES ---
    function manejarResize() {

        const nuevoVisibles = calcularVisibles();

        if (nuevoVisibles !== VISIBLES) {

            const real = indiceRealCentro();

            VISIBLES = nuevoVisibles;
            centroOffset = Math.floor(VISIBLES / 2);

            irACentro(real);

        } else {

            posicionar(true);

        }

    }

    function abrirModal() {

        modal.classList.add("is-abierto");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        VISIBLES = calcularVisibles();
        centroOffset = Math.floor(VISIBLES / 2);
        indice = TOTAL;

        construirSlides();
        posicionar(true);

        iniciarAutoplay();

    }

    function cerrarModal() {

        modal.classList.remove("is-abierto");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";

        detenerAutoplay();

    }

    function manejarTeclado(e) {

        if (!modal.classList.contains("is-abierto")) {
            return;
        }

        if (e.key === "Escape") cerrarModal();
        if (e.key === "ArrowRight") { mover(1); reiniciarAutoplay(); }
        if (e.key === "ArrowLeft") { mover(-1); reiniciarAutoplay(); }

    }

    btnAbrir.addEventListener("click", abrirModal);
    btnCerrar.addEventListener("click", cerrarModal);
    backdrop.addEventListener("click", cerrarModal);

    btnAnterior.addEventListener("click", () => { mover(-1); reiniciarAutoplay(); });
    btnSiguiente.addEventListener("click", () => { mover(1); reiniciarAutoplay(); });

    viewport.addEventListener("mouseenter", detenerAutoplay);
    viewport.addEventListener("mouseleave", iniciarAutoplay);

    window.addEventListener("resize", manejarResize);

    document.addEventListener("keydown", manejarTeclado);

})();