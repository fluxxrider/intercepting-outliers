// Shared on every page: the floating nav and scroll reveals.
(() => {
  const root = document.documentElement,
    nav = document.querySelector("[data-nav]");

  if (nav) {
    // Space the page leaves for the bar (measured while the tabs are showing).
    const space = () => {
      if (nav.classList.contains("is-compact")) return;
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

    // Past the top, the tabs fold into an arrow. Hover (or tap the arrow) to bring them back.
    const more = nav.querySelector(".nav-more");
    let compact = false,
      open = false,
      openY = 0,
      raf = 0;
    const setOpen = (o) => {
      open = o;
      openY = scrollY;
      nav.classList.toggle("is-open", o);
      more && more.setAttribute("aria-expanded", String(o));
    };
    more &&
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(!open);
      });
    document.addEventListener("click", (e) => open && !nav.contains(e.target) && setOpen(false));
    addEventListener("keydown", (e) => open && e.key === "Escape" && (setOpen(false), more && more.focus()));

    // The bottom edge tracks reading progress.
    const tick = () => {
      raf = 0;
      const y = scrollY,
        c = y > 60;
      c !== compact && (nav.classList.toggle("is-compact", (compact = c)), c || setOpen(false));
      open && Math.abs(y - openY) > 120 && setOpen(false);
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
