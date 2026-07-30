// Bandera compartida: cuando el menú móvil está abierto,
// el navbar no debe reaccionar al scroll
let isMobileMenuOpen = false;

document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.querySelector(".navbar");
const SCROLL_THRESHOLD = 40;

let lastScrollY = window.scrollY;
let ticking = false;

function handleScroll() {
// Si el menú móvil está abierto, no tocar el navbar
if (isMobileMenuOpen) {
ticking = false;
return;
  }

const currentScrollY = window.scrollY;

// Fondo/sombra al bajar del umbral (tu lógica original)
if (currentScrollY > SCROLL_THRESHOLD) {
navbar.classList.add("scrolled");
    } else {
navbar.classList.remove("scrolled");
    }

// Ocultar al bajar, mostrar al subir
if (currentScrollY > lastScrollY && currentScrollY > SCROLL_THRESHOLD) {
// scrolleando hacia abajo y ya pasamos el umbral
navbar.classList.add("nav-hidden");
    } else {
// scrolleando hacia arriba
navbar.classList.remove("nav-hidden");
    }

lastScrollY = currentScrollY;
ticking = false;
  }

window.addEventListener("scroll", () => {
if (!ticking) {
window.requestAnimationFrame(handleScroll);
ticking = true;
    }
  });

handleScroll(); // por si la página carga ya scrolleada
});

document.addEventListener("DOMContentLoaded", () => {
const navToggle = document.getElementById("navToggle");
const mobileMenu = document.getElementById("mobileMenu");

if (!navToggle || !mobileMenu) return;

// Guarda el scroll actual para restaurarlo al cerrar el menú
let scrollYAlAbrir = 0;

function closeMenu() {
navToggle.classList.remove("active");
mobileMenu.classList.remove("active");
navToggle.setAttribute("aria-expanded", "false");
document.body.classList.remove("mobile-menu-open");

isMobileMenuOpen = false;

// Restaurar posición de scroll (necesario por el truco de position:fixed)
document.body.style.top = "";
window.scrollTo(0, scrollYAlAbrir);
  }

function openMenu() {
scrollYAlAbrir = window.scrollY;

navToggle.classList.add("active");
mobileMenu.classList.add("active");
navToggle.setAttribute("aria-expanded", "true");
document.body.classList.add("mobile-menu-open");

// Fija el body en su posición actual para que
// no se pueda hacer scroll ni con touch ni con rueda
document.body.style.top = `-${scrollYAlAbrir}px`;

isMobileMenuOpen = true;
  }

navToggle.addEventListener("click", () => {
const isOpen = mobileMenu.classList.contains("active");
isOpen ? closeMenu() : openMenu();
  });

// Cierra el menú al hacer click en cualquier link dentro de él
mobileMenu.querySelectorAll("a").forEach((link) => {
link.addEventListener("click", closeMenu);
  });

// Cierra el menú si la pantalla vuelve a tamaño desktop
// (evita que quede "abierto" atrás si el usuario redimensiona la ventana)
window.addEventListener("resize", () => {
if (window.innerWidth > 900) {
closeMenu();
    }
  });
});