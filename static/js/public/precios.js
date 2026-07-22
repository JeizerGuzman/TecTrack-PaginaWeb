/**
 * precios.js — TecTrack Security (versión standalone, sin backend)
 *
 * PLANES_EJEMPLO tiene la misma forma que le pedirás luego a tu API
 * (/api/planes). Cuando conectes tu backend, solo reemplaza este
 * arreglo por el fetch() correspondiente — el resto del archivo no
 * necesita cambiar.
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------
  // DATOS DE EJEMPLO — reemplazar por fetch("/api/planes") cuando
  // tengas el backend listo. La forma de cada plan es la misma.
  // ---------------------------------------------------------------
  const PLANES_EJEMPLO = [
    {
      id: 1,
      nombre: "Básico",
      descripcion:
        "GPS en tiempo real, sensores, botón de pánico, sirena, dashboard web, aplicación móvil, instalación y soporte.",
      retenciones: { gps: 15, alertas: 90, evidencias: null },
      caracteristicas: [
        { etiqueta: "GPS en tiempo real", icono: "fa-location-crosshairs", incluida: true },
        { etiqueta: "Sensor de vibración", icono: "fa-wave-square", incluida: true },
        { etiqueta: "Sensor de apertura de puertas", icono: "fa-door-closed", incluida: true },
        { etiqueta: "Botón de pánico", icono: "fa-triangle-exclamation", incluida: true },
        { etiqueta: "Sirena de alerta", icono: "fa-bullhorn", incluida: true },
        { etiqueta: "Dashboard web", icono: "fa-desktop", incluida: true },
        { etiqueta: "Aplicación móvil", icono: "fa-mobile-screen", incluida: true },
        { etiqueta: "Procesamiento FPGA", icono: "fa-microchip", incluida: false },
        { etiqueta: "Cámara de evidencia", icono: "fa-video", incluida: false },
        { etiqueta: "Captura automática de evidencia", icono: "fa-file-shield", incluida: false },
      ],
    },
    {
      id: 2,
      nombre: "Profesional",
      descripcion:
        "Incluye todas las funciones del plan Básico y procesamiento FPGA Tang Nano 9K para monitoreo avanzado.",
      retenciones: { gps: 90, alertas: 365, evidencias: null },
      caracteristicas: [
        { etiqueta: "GPS en tiempo real", icono: "fa-location-crosshairs", incluida: true },
        { etiqueta: "Sensor de vibración", icono: "fa-wave-square", incluida: true },
        { etiqueta: "Sensor de apertura de puertas", icono: "fa-door-closed", incluida: true },
        { etiqueta: "Botón de pánico", icono: "fa-triangle-exclamation", incluida: true },
        { etiqueta: "Sirena de alerta", icono: "fa-bullhorn", incluida: true },
        { etiqueta: "Dashboard web", icono: "fa-desktop", incluida: true },
        { etiqueta: "Aplicación móvil", icono: "fa-mobile-screen", incluida: true },
        { etiqueta: "Procesamiento FPGA", icono: "fa-microchip", incluida: true },
        { etiqueta: "Cámara de evidencia", icono: "fa-video", incluida: false },
        { etiqueta: "Captura automática de evidencia", icono: "fa-file-shield", incluida: false },
      ],
    },
    {
      id: 3,
      nombre: "Premium",
      descripcion:
        "Incluye todas las funciones del plan Profesional, cámara de evidencia y captura automática de evidencia fotográfica.",
      retenciones: { gps: 365, alertas: 730, evidencias: 180 },
      caracteristicas: [
        { etiqueta: "GPS en tiempo real", icono: "fa-location-crosshairs", incluida: true },
        { etiqueta: "Sensor de vibración", icono: "fa-wave-square", incluida: true },
        { etiqueta: "Sensor de apertura de puertas", icono: "fa-door-closed", incluida: true },
        { etiqueta: "Botón de pánico", icono: "fa-triangle-exclamation", incluida: true },
        { etiqueta: "Sirena de alerta", icono: "fa-bullhorn", incluida: true },
        { etiqueta: "Dashboard web", icono: "fa-desktop", incluida: true },
        { etiqueta: "Aplicación móvil", icono: "fa-mobile-screen", incluida: true },
        { etiqueta: "Procesamiento FPGA", icono: "fa-microchip", incluida: true },
        { etiqueta: "Cámara de evidencia", icono: "fa-video", incluida: true },
        { etiqueta: "Captura automática de evidencia", icono: "fa-file-shield", incluida: true },
      ],
    },
  ];

  const planes = PLANES_EJEMPLO;
  const indiceRecomendado = planes.length >= 3 ? 1 : -1;

  // ---------------------------------------------------------------
  // Construcción del selector (botones + indicador deslizante)
  // ---------------------------------------------------------------
  const selectorTrack = document.getElementById("selector-track");
  selectorTrack.style.setProperty("--total-opciones", planes.length);

  planes.forEach((plan, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "selector__opcion" + (i === 0 ? " is-active" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
    btn.dataset.index = i;
    btn.textContent = plan.nombre;
    btn.addEventListener("click", () => seleccionarPlan(i));
    selectorTrack.appendChild(btn);
  });

  const indicator = document.getElementById("selector-indicator");
  const opciones = Array.from(document.querySelectorAll(".selector__opcion"));

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
    return dias === null || dias === undefined
      ? '<span class="retencion-item__valor retencion-item__valor--na">No aplica</span>'
      : `<span class="retencion-item__valor">${dias} d</span>`;
  }

  function renderRetenciones(retenciones) {
    const items = [
      { valor: retenciones.gps, label: "Retención GPS" },
      { valor: retenciones.alertas, label: "Retención alertas" },
      { valor: retenciones.evidencias, label: "Retención evidencias" },
    ];

    elRetenciones.innerHTML = items
      .map(
        (item) => `
        <div class="retencion-item">
          ${textoRetencion(item.valor)}
          <span class="retencion-item__label">${item.label}</span>
        </div>`
      )
      .join("");
  }

  function renderCaracteristicas(caracteristicas) {
    elCaracteristicas.innerHTML = caracteristicas
      .map((c) => {
        const clase = c.incluida ? "caracteristica--incluida" : "caracteristica--excluida";
        const icono = c.incluida ? "fa-check" : "fa-xmark";
        return `
          <li class="${clase}">
            <span class="icono-estado"><i class="fa-solid ${icono}"></i></span>
            <span>${c.etiqueta}</span>
          </li>`;
      })
      .join("");
  }

  function renderMiniPlanes(indiceSeleccionado) {
    const otros = planes
      .map((p, i) => ({ ...p, indice: i }))
      .filter((p) => p.indice !== indiceSeleccionado);

    elMiniPlanes.innerHTML = otros
      .map(
        (p) => `
          <div class="mini-plan" data-index="${p.indice}" role="button" tabindex="0">
            <p class="mini-plan__nombre">${p.nombre}</p>
            <p class="mini-plan__descripcion">${p.descripcion}</p>
            <span class="mini-plan__cambiar"><i class="fa-solid fa-arrows-left-right"></i> Ver este plan</span>
          </div>`
      )
      .join("");

    elMiniPlanes.querySelectorAll(".mini-plan").forEach((card) => {
      const ir = () => seleccionarPlan(Number(card.dataset.index));
      card.addEventListener("click", ir);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ir();
        }
      });
    });
  }

  function moverIndicador(indice) {
    indicator.style.transform = `translateX(${indice * 100}%)`;
  }

  function renderTarjetaPrincipal(plan, indice) {
    elBadge.hidden = indice !== indiceRecomendado;
    elNombre.textContent = plan.nombre;
    elDescripcion.textContent = plan.descripcion;

    renderCaracteristicas(plan.caracteristicas);
    renderRetenciones(plan.retenciones);
    elCta.dataset.planId = plan.id;
    elCta.innerHTML = `Solicitar ${plan.nombre} <i class="fa-solid fa-arrow-right"></i>`;
  }

  function seleccionarPlan(indice) {
    if (indice === indiceActual) return;

    indiceActual = indice;
    moverIndicador(indice);

    opciones.forEach((btn, i) => {
      const activo = i === indice;
      btn.classList.toggle("is-active", activo);
      btn.setAttribute("aria-selected", String(activo));
    });

    tarjeta.classList.add("is-cambiando");
    window.setTimeout(() => {
      renderTarjetaPrincipal(planes[indice], indice);
      tarjeta.classList.remove("is-cambiando");
    }, 180);

    renderMiniPlanes(indice);
  }

  moverIndicador(indiceActual);
  renderTarjetaPrincipal(planes[indiceActual], indiceActual);
  renderMiniPlanes(indiceActual);
})();