document.addEventListener("DOMContentLoaded", () => {
    const cards = document.querySelectorAll(".service-card, .service-card-img");

    const observer = new IntersectionObserver(
        (entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
            // Retraso escalonado (stagger) según el orden de aparición
            const delay = index * 90;
            setTimeout(() => {
                entry.target.classList.add("in-view");
            }, delay);

            observer.unobserve(entry.target);
            }
        });
        },
        {
        threshold: 0.15,
        }
    );

    cards.forEach((card) => observer.observe(card));
});