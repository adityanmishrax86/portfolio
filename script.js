document.documentElement.classList.add("js");

const header = document.querySelector(".site-header");
const toggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelectorAll(".site-nav a");
const revealItems = document.querySelectorAll(".reveal");
const sections = document.querySelectorAll("main section[id]");
const analyticsNodes = {
  totalVisits: document.querySelector("[data-analytics-total-visits]"),
  recentWindow: document.querySelector("[data-analytics-last-seven-days]"),
};

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

const updateAnalyticsValue = (node, value) => {
  if (!node) {
    return;
  }

  node.textContent = value;
};

const renderAnalyticsSummary = (summary) => {
  if (!summary) {
    return;
  }

  updateAnalyticsValue(analyticsNodes.totalVisits, String(summary.totalVisits ?? 0));
  updateAnalyticsValue(analyticsNodes.recentWindow, `${summary.last7Days ?? 0} visits in the last 7 days`);
};

const analyticsPayload = () => ({
  page: window.location.pathname,
  referrer: document.referrer,
  language: navigator.language,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight,
  },
  screen: {
    width: window.screen?.width || 0,
    height: window.screen?.height || 0,
  },
});

const fetchAnalyticsSummary = async () => {
  const response = await fetch("/api/analytics/summary", {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to load analytics summary.");
  }

  return response.json();
};

const logVisit = async () => {
  try {
    if (sessionStorage.getItem("portfolio-visit-logged") !== "1") {
      await fetch("/api/analytics/visit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(analyticsPayload()),
        keepalive: true,
      });

      sessionStorage.setItem("portfolio-visit-logged", "1");
    }

    const summary = await fetchAnalyticsSummary();
    renderAnalyticsSummary(summary);
  } catch {}
};

if (window.fetch && (analyticsNodes.totalVisits || analyticsNodes.recentWindow)) {
  logVisit();
}
