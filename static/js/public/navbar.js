document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.querySelector(".navbar");
  const SCROLL_THRESHOLD = 40;

  function handleScroll() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  }

  window.addEventListener("scroll", handleScroll);
  handleScroll(); // por si la página carga ya scrolleada
});