// Shared on every page: the floating nav and scroll reveals.
(() => {
  const root = document.documentElement,
    nav = document.querySelector("[data-nav]");

  if (nav) {
    // Space the page leaves for the bar.
    const space = () => {
      const top = parseFloat(getComputedStyle(nav).top) || 0;
      root.style.setProperty("--nav-space", Math.round(nav.offsetHeight + 2 * top) + "px");
    };
    space();
    addEventListener("resize", space);
    document.fonts && document.fonts.ready.then(space);

    // Links to sections on this page light up while that section is on screen.
    const spy = [...nav.querySelectorAll(".nav-links a")]
      .map((a) => {
        const u = new URL(a.href, location.href);
        const el = u.pathname === location.pathname && u.hash && document.getElementById(u.hash.slice(1));
        return el ? [a, el] : null;
      })
      .filter(Boolean);

    // Hide on the way down, come back on the way up; the bottom edge tracks reading progress.
    let lastY = scrollY,
      hidden = false,
      raf = 0;
    const setHidden = (h) => h !== hidden && nav.classList.toggle("is-hidden", (hidden = h));
    const tick = () => {
      raf = 0;
      const y = scrollY,
        dy = y - lastY;
      if (Math.abs(dy) > 8 || y < 80) {
        setHidden(dy > 0 && y > 80 && !nav.contains(document.activeElement));
        lastY = y;
      }
      const max = root.scrollHeight - innerHeight;
      nav.style.setProperty("--p", max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
      if (spy.length) {
        const line = innerHeight * 0.4;
        let on = null;
        for (const [a, el] of spy) {
          const r = el.getBoundingClientRect();
          r.top < line && r.bottom > line && (on = a);
        }
        for (const [a] of spy) a.classList.toggle("is-on", a === on);
      }
    };
    addEventListener("scroll", () => raf || (raf = requestAnimationFrame(tick)), { passive: true });
    nav.addEventListener("focusin", () => setHidden(false));
    tick();
  }

  // Fade things up as they arrive. Content stays visible if this never runs.
  const items = [...document.querySelectorAll("[data-reveal]")];
  if (!items.length) return;
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  root.classList.add("reveal-on");
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }),
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
  );
  items.forEach((el) => io.observe(el));
})();
