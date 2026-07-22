document.addEventListener("DOMContentLoaded", () => {

  const AUTO_ADVANCE_MS = 10000;


  const dashboardViews = [

    {
      title: "Monitoreo general",
      subtitle: "Consulta el estado actual de tus unidades, indicadores principales y la información más importante de tu operación desde un solo panel.",
      image: "/static/img/public/dashboard/monitoreo-general.png",
      icon: "fa-solid fa-home"
    },

    {
      title: "Gestion de vehículos",
      subtitle: "Administra la información de tus unidades, controla dispositivos asociados y organiza tu flota de manera eficiente.",
      image: "/static/img/public/dashboard/vehiculos.png",
      icon: "fa-solid fa-truck"
    },

    {
      title: "Alertas de la flota",
      subtitle: "Recibe notificaciones sobre eventos importantes, detecta situaciones sospechosas y responde rápidamente ante incidentes.",
      image: "/static/img/public/dashboard/alertas.png",
      icon: "fa-solid fa-warning"
    },

    {
      title: "Historial general",
      subtitle: "Analiza recorridos anteriores, consulta eventos registrados y obtén información para mejorar la operación.",
      image: "/static/img/public/dashboard/historial.png",
      icon: "fa-solid fa-route"
    },

    {
      title: "Reportes",
      subtitle: "Genera reportes detallados de la actividad de tu flota para facilitar el análisis y la toma de decisiones.",
      image: "/static/img/public/dashboard/reportes.png",
      icon: "fa-solid fa-chart-simple"
    },

    {
      title: "Usuarios",
      subtitle: "Gestiona los usuarios de la plataforma, administra permisos y mantén un control seguro del acceso al sistema.",
      image: "/static/img/public/dashboard/usuarios.png",
      icon: "fa-solid fa-user"
    }

  ];


  const dashboardSelector = document.getElementById("dashboardSelector");
  const dashboardMain = document.getElementById("dashboardMain");

  const dashboardTitle = document.getElementById("dashboardTitle");
  const dashboardSubtitle = document.getElementById("dashboardSubtitle");


  let currentIndex = 0;
  let autoTimer = null;



  // Crear botones de selección
  dashboardViews.forEach((dashboard, index) => {


    const thumb = document.createElement("div");

    thumb.className = "dashboard-thumb";


    thumb.innerHTML = `
      <i class="${dashboard.icon}"></i>
    `;


    thumb.addEventListener("click", () => {

      selectDashboard(index);
      resetAutoAdvance();

    });


    dashboardSelector.appendChild(thumb);


  });



  const thumbs = document.querySelectorAll(".dashboard-thumb");



  function selectDashboard(index){


    currentIndex = index;

    const dashboard = dashboardViews[index];


    // Animación imagen
    dashboardMain.style.animation = "none";
    void dashboardMain.offsetWidth;
    dashboardMain.style.animation = "";


    dashboardMain.src = dashboard.image;


    dashboardTitle.textContent = dashboard.title;

    dashboardSubtitle.textContent = dashboard.subtitle;



    thumbs.forEach(thumb => {

      thumb.classList.remove("active");

    });


    thumbs[index].classList.add("active");


  }



  function resetAutoAdvance(){


    clearInterval(autoTimer);


    autoTimer = setInterval(()=>{


      let next = currentIndex + 1;


      if(next >= dashboardViews.length){

        next = 0;

      }


      selectDashboard(next);


    }, AUTO_ADVANCE_MS);


  }



  // Inicializar
  selectDashboard(0);

  resetAutoAdvance();


});

document.addEventListener("DOMContentLoaded", () => {
  const dashboardOverlay = document.querySelector(".dashboard-overlay");
 
  if (dashboardOverlay) {
    dashboardOverlay.addEventListener("click", () => {
      dashboardOverlay.classList.toggle("expanded");
    });
  }
});