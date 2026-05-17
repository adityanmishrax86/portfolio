document.documentElement.classList.add("js");

const header = document.querySelector(".site-header");
const toggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelectorAll(".site-nav a");
const revealItems = document.querySelectorAll(".reveal");
const sections = document.querySelectorAll("main section[id]");

if (toggle && header) {
  toggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (header?.classList.contains("is-open")) {
      header.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && header?.classList.contains("is-open")) {
    header.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
  }
});

const syncHeaderState = () => {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 18);
};

syncHeaderState();
window.addEventListener("scroll", syncHeaderState, { passive: true });

if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const targetId = entry.target.getAttribute("id");

        navLinks.forEach((link) => {
          const isActive = link.getAttribute("href") === `#${targetId}`;
          link.setAttribute("aria-current", String(isActive));
        });
      });
    },
    {
      threshold: 0.45,
      rootMargin: "-15% 0px -45% 0px",
    }
  );

  sections.forEach((section) => sectionObserver.observe(section));
}

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
