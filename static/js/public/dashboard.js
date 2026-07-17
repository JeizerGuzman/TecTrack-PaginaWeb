document.addEventListener("DOMContentLoaded", () => {

  const AUTO_ADVANCE_MS = 10000;


  const dashboardViews = [

    {
      title: "Moniteo general",
      subtitle: "Consulta el estado actual de tus unidades, indicadores principales y la información más importante de tu operación desde un solo panel.",
      image: "dashboard-main.png",
      icon: "fa-solid fa-chart-simple"
    },

    {
      title: "Monitoreo de la flota",
      subtitle: "Visualiza la ubicación de cada vehículo en tiempo real, revisa recorridos y mantén seguimiento constante de tus unidades.",
      image: "dashboard-gps.png",
      icon: "fa-solid fa-location-dot"
    },

    {
      title: "Gestion de vehículos",
      subtitle: "Administra la información de tus unidades, controla dispositivos asociados y organiza tu flota de manera eficiente.",
      image: "dashboard-alertas.png",
      icon: "fa-solid fa-truck"
    },

    {
      title: "Alertas de la flota",
      subtitle: "Recibe notificaciones sobre eventos importantes, detecta situaciones sospechosas y responde rápidamente ante incidentes.",
      image: "dashboard-history.png",
      icon: "fa-solid fa-bell"
    },

    {
      title: "Historial general",
      subtitle: "Analiza recorridos anteriores, consulta eventos registrados y obtén información para mejorar la operación.",
      image: "dashboard-fleet.png",
      icon: "fa-solid fa-route"
    },

    {
      title: "Reportes",
      subtitle: "Genera reportes detallados de la actividad de tu flota para facilitar el análisis y la toma de decisiones.",
      image: "dashboard-fleet.png",
      icon: "fa-solid fa-file-lines"
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