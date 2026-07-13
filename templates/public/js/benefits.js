document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".panel-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");

      // Si ya está activo, no hacer nada
      if (btn.classList.contains("active")) return;

      // Actualizar estado de los botones
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Actualizar panel visible con transición
      panels.forEach((panel) => {
        if (panel.id === targetId) {
          panel.classList.add("active");
        } else {
          panel.classList.remove("active");
        }
      });
    });
  });
});