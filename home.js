// "What we believe" + "Who we are": one pinned stage. Scrolling morphs each chart into the next:
// the old chart fades, its particles crowd into a swirling cluster, then spread into the next chart's
// particles while that chart draws itself in. The text swaps at the midpoint.
(() => {
  const IO = window.IO,
    root = document.querySelector("[data-morph]");
  if (!IO || !IO.debug || !IO.figure || !root) return;
  const pin = root.querySelector(".morph-pin"),
    cv = root.querySelector(".morph-dots"),
    steps = [...root.querySelectorAll(".morph-step")],
    figs = steps.map((s) => s.querySelector("[data-fig]")),
    names = figs.map((f) => f.dataset.fig),
    copies = steps.map((s) => s.querySelector(".copy")),
    pills = copies.map((c) => c.querySelector(".pill-ink")),
    N = steps.length,
    figure0 = IO.figure,
    items = names.map((n) => figure0(n));
  if (N < 2 || !pin || !cv || items.some((it) => !it)) return;

  const { seg, lerp } = IO,
    io = IO.ease.inOut,
    sm = IO.ease.smooth,
    reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // Timeline, in screen heights scrolled since the stage pinned.
  const DRAW = [-0.6, 0.3], // first chart draws in as the stage arrives
    HOLD = 0.35, // pause on each chart
    TR = 0.9, // one chart turning into the next
    TAIL = 0.45, // pause on the last chart before the page moves on
    start = (i) => DRAW[1] + HOLD + i * (TR + HOLD),
    SPAN = start(N - 2) + TR + TAIL,
    PAD = 48; // room around the chart for particles in flight

  let live = false,
    cur = 0,
    last = null,
    raf = 0,
    gen = 0,
    sys = null,
    dotsOn = false,
    flockHidden = false;

  const drive = (i, p) => {
    p = Math.round(p * 1000) / 1000;
    (!items[i].inst || items[i].p !== p) && IO.debug.set(names[i], p);
  };
  const hideOwn = (i, h) => {
    const it = items[i],
      fl = it.inst && it.inst.flock;
    if (!fl || (it._mi === it.inst && it._mh === h)) return;
    try {
      fl.hide(h);
    } catch (e) {
      console.error("[morph] hide " + names[i], e);
    }
    (it._mi = it.inst), (it._mh = h);
  };
  const ptsOf = (i, mount) => {
    if (!items[i].inst) {
      if (!mount || !live) return [];
      IO.debug.set(names[i], items[i].p || 0);
    }
    const fl = items[i].inst && items[i].inst.flock;
    try {
      return (fl && fl.pts()) || [];
    } catch (e) {
      console.error("[morph] pts " + names[i], e);
      return [];
    }
  };
  const fade = (el, o, y = 0) => {
    const k = o.toFixed(3) + "," + y.toFixed(1);
    if (el._mk === k) return;
    (el._mk = k), (el.style.opacity = o), (el.style.transform = y ? `translate3d(0,${y.toFixed(1)}px,0)` : "");
  };
  const unfade = (el) => {
    el._mk = null;
    el.style.removeProperty("opacity");
    el.style.removeProperty("transform");
  };

  // The page's flock (particles flying figure to figure) treats the whole stage as one stop.
  const liveArr = [];
  function refreshLive(mount) {
    const pts = ptsOf(live ? cur : N - 1, mount);
    liveArr.length = 0;
    for (const q of pts) liveArr.push(q);
  }
  const morphItem = {
    name: "morph",
    story: !1,
    held: null,
    p: 1,
    get fig() {
      return live ? figs[cur] : figs[N - 1];
    },
    inst: {
      flock: {
        pts() {
          refreshLive(!0);
          return liveArr;
        },
        hide(h) {
          flockHidden = !!h;
          if (!live) return hideOwn(N - 1, flockHidden);
          last && render(...last);
        },
      },
    },
  };
  IO.figure = (n) => (n === "morph" ? morphItem : figure0(n));

  const rgb = (c) => {
    if (c && c[0] === "#") {
      let h = c.slice(1);
      h.length === 3 && (h = [...h].map((x) => x + x).join(""));
      const v = parseInt(h, 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    }
    const m = c && c.match(/[\d.]+/g);
    return m && m.length >= 3 ? m.slice(0, 3).map(Number) : [17, 17, 17];
  };
  const rnd = (k) => {
    const v = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  // Pair every particle of chart i with one of chart i+1, through a slot in the cluster.
  // Both sets are ordered by angle around their own centre, so neighbours stay neighbours.
  function build(i) {
    const a = ptsOf(i, !0),
      b = ptsOf(i + 1, !0),
      s = { i, gen, ia: items[i].inst, ib: items[i + 1].inst, P: [] };
    if (!a.length || !b.length) return s;
    const mid = (p) => {
        let x = 0,
          y = 0;
        for (const q of p) (x += q.x), (y += q.y);
        return { x: x / p.length, y: y / p.length };
      },
      ca = mid(a),
      cb = mid(b),
      byAngle = (c) => (p, q) => Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(q.y - c.y, q.x - c.x),
      sa = a.slice().sort(byAngle(ca)),
      sb = b.slice().sort(byAngle(cb)),
      n = Math.max(sa.length, sb.length),
      R = Math.sqrt(n) * 2.1;
    s.C = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
    s.AC = rgb(IO.css("--accent") || "#4e28c4");
    for (let k = 0; k < n; k++) {
      const ia = Math.floor((k * sa.length) / n),
        ib = Math.floor((k * sb.length) / n),
        th = -Math.PI + (2 * Math.PI * (k + 0.5)) / n + (rnd(k * 1.7) - 0.5) * 0.5,
        rr = R * Math.sqrt(rnd(k * 3.3));
      s.P.push({
        s: sa[ia],
        d: sb[ib],
        sc: rgb(sa[ia].c),
        dc: rgb(sb[ib].c),
        ox: Math.cos(th) * rr,
        oy: Math.sin(th) * rr,
        dg: rnd(k * 5.1) * 0.14,
        ds: rnd(k * 7.9) * 0.14,
        bow: (rnd(k * 2.3) - 0.5) * 70,
        born: k > 0 && Math.floor(((k - 1) * sa.length) / n) === ia,
        merge: k < n - 1 && Math.floor(((k + 1) * sb.length) / n) === ib,
      });
    }
    return s;
  }

  function draw(t) {
    const { ctx, w, h } = IO.fit(cv);
    ctx.clearRect(0, 0, w, h);
    if (!sys.P.length) return;
    const rot = (t - 0.5) * 2.4,
      cr = Math.cos(rot),
      sr = Math.sin(rot),
      tight = 1 - 0.35 * Math.sin(Math.PI * seg(t, 0.25, 0.75)),
      C = sys.C,
      AC = sys.AC;
    let fill = "";
    for (const q of sys.P) {
      const g = io(seg(t, q.dg, 0.46)),
        s = io(seg(t, 0.54, 1 - q.ds)),
        bx = C.x + (q.ox * cr - q.oy * sr) * tight,
        by = C.y + (q.ox * sr + q.oy * cr) * tight;
      let x0, y0, x1, y1, k, r, a, c0, c1;
      if (s <= 0)
        (x0 = q.s.x), (y0 = q.s.y), (x1 = bx), (y1 = by), (k = g), (c0 = q.sc), (c1 = AC),
          (r = lerp(q.s.r, 1.3, g)), (a = lerp(q.s.a, 0.9, g) * (q.born ? g : 1));
      else
        (x0 = bx), (y0 = by), (x1 = q.d.x), (y1 = q.d.y), (k = s), (c0 = AC), (c1 = q.dc),
          (r = lerp(1.3, q.d.r, s)), (a = lerp(0.9, q.d.a, s) * (q.merge ? 1 - s : 1));
      if (a < 0.01) continue;
      const dx = x1 - x0,
        dy = y1 - y0,
        L = Math.hypot(dx, dy) || 1,
        bw = Math.sin(Math.PI * k) * q.bow * Math.min(1, L / 160),
        col = `rgb(${Math.round(lerp(c0[0], c1[0], k))},${Math.round(lerp(c0[1], c1[1], k))},${Math.round(lerp(c0[2], c1[2], k))})`;
      col !== fill && (ctx.fillStyle = fill = col);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(PAD + x0 + dx * k - (dy / L) * bw, PAD + y0 + dy * k + (dx / L) * bw, Math.max(0.3, r), 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // c: chart we're on (or leaving), t: 0..1 through the turn into c+1, pp: draw-in of the first chart
  function render(c, t, pp) {
    last = [c, t, pp];
    const moving = t > 0 && t < 1;
    moving && IO.flock && IO.flock.land && IO.flock.land("morph");
    const now = moving && t >= 0.5 ? c + 1 : c;
    now !== cur && ((cur = now), refreshLive(!1));
    const same =
      moving && pills[c] && pills[c + 1] && pills[c].textContent.trim() === pills[c + 1].textContent.trim();
    for (let k = 0; k < N; k++) {
      const a = k === c,
        b = moving && k === c + 1;
      let fo = 0,
        co = 0,
        cy = 0;
      if (a) {
        fo = moving ? 1 - sm(seg(t, 0.04, 0.42)) : 1;
        drive(k, k === 0 ? pp : 1);
        const e = moving ? sm(seg(t, 0.28, 0.46)) : 0;
        (co = 1 - e), (cy = -14 * e);
      } else if (b) {
        fo = sm(seg(t, 0.5, 0.62));
        drive(k, io(seg(t, 0.5, 0.96)));
        const e = sm(seg(t, 0.54, 0.72));
        (co = e), (cy = 14 * (1 - e));
      }
      fade(figs[k], fo);
      for (const el of copies[k].children)
        same && (a || b) && el === pills[k] ? fade(el, (a ? t < 0.5 : t >= 0.5) ? 1 : 0) : fade(el, co, cy);
      hideOwn(k, moving ? a || b : a && flockHidden);
      steps[k].style.pointerEvents = k === now ? "" : "none";
    }
    if (moving) {
      (!sys || sys.i !== c || sys.gen !== gen || sys.ia !== items[c].inst || sys.ib !== items[c + 1].inst) &&
        (sys = build(c));
      dotsOn || ((dotsOn = !0), (cv.style.opacity = 1));
      draw(t);
    } else if (dotsOn) (dotsOn = !1), (cv.style.opacity = 0);
  }

  function frame() {
    raf = 0;
    if (!live) return;
    const r = root.getBoundingClientRect(),
      H = pin.offsetHeight || innerHeight;
    if (r.top > 2 * H || r.bottom < -H) return;
    const u = -r.top / H;
    let c = 0,
      t = 0;
    for (let i = 0; i < N - 1; i++) {
      const a = start(i);
      if (u >= a + TR) (c = i + 1), (t = 0);
      else {
        u > a && ((c = i), (t = (u - a) / TR));
        break;
      }
    }
    render(c, t, io(seg(u, DRAW[0], DRAW[1])));
  }

  function setLive(on) {
    live = on;
    root.classList.toggle("morph-live", on);
    on && root.style.setProperty("--span", SPAN.toFixed(3));
    items.forEach((it, i) => {
      if (on) return void (it.frozen = !0);
      unfade(figs[i]);
      for (const el of copies[i].children) unfade(el);
      steps[i].style.removeProperty("pointer-events");
      hideOwn(i, !1);
    });
    if (!on) {
      names.forEach((n) => IO.debug.release(n));
      (dotsOn = !1), (cv.style.opacity = 0), (sys = null), (last = null);
    }
  }
  // Copies share one height so the pill and heading stay put while the text swaps.
  function equalize() {
    copies.forEach((c) => (c.style.minHeight = ""));
    if (!live) return;
    const h = Math.max(...copies.map((c) => c.offsetHeight));
    copies.forEach((c) => (c.style.minHeight = h + "px"));
  }
  // If the tallest step doesn't fit on screen, fall back to the plain stacked layout.
  const fits = () => Math.max(...steps.map((s) => s.firstElementChild.offsetHeight)) <= pin.clientHeight - 40;
  function place() {
    const pr = pin.getBoundingClientRect(),
      fr = figs[0].getBoundingClientRect();
    Object.assign(cv.style, {
      left: `${fr.left - pr.left - PAD}px`,
      top: `${fr.top - pr.top - PAD}px`,
      width: `${fr.width + 2 * PAD}px`,
      height: `${fr.height + 2 * PAD}px`,
    });
  }
  function layout() {
    const want = !reduce.matches;
    want !== live && setLive(want);
    equalize();
    live && !fits() && (setLive(!1), equalize());
    live && place();
    gen++;
    copies.forEach((c) => c.children && [...c.children].forEach((el) => (el._mk = null)));
    figs.forEach((f) => (f._mk = null));
    refreshLive(!1);
    frame();
  }

  let rt = 0;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(layout, 220);
  });
  reduce.addEventListener && reduce.addEventListener("change", layout);
  addEventListener("scroll", () => raf || (raf = requestAnimationFrame(frame)), { passive: !0 });
  document.fonts && document.fonts.ready.then(layout);
  layout();
})();
;
(()=>{const sec=document.querySelector(".intro"),p=sec&&sec.querySelector("[data-type]");if(!p||matchMedia("(prefers-reduced-motion: reduce)").matches)return;const cta=sec.querySelector(".intro-cta"),text=p.textContent.trim(),chars=[],live=document.createElement("span");live.setAttribute("aria-hidden","true");for(const part of text.split(/(\s+)/)){if(!part)continue;const gap=/^\s+$/.test(part),w=gap?live:live.appendChild(document.createElement("span"));gap||(w.className="tw-w");for(const ch of gap?" ":part){const c=document.createElement("span");c.className="tw-c",c.textContent=ch,w.appendChild(c),chars.push(c)}}const sr=document.createElement("span");sr.className="sr-only",sr.textContent=text,p.replaceChildren(sr,live),sec.classList.add("tw-live");let n=-1,raf=0,idle=0;const set=k=>{if(k===n)return;chars.forEach((c,i)=>{c.classList.toggle("on",i<k),c.classList.toggle("cur",k>0&&i===k-1),c.classList.toggle("cur0",k===0&&i===0)}),n>=0&&(p.classList.add("is-typing"),clearTimeout(idle),idle=setTimeout(()=>p.classList.remove("is-typing"),450)),cta.classList.toggle("on",k===chars.length),n=k},update=()=>{raf=0;const r=sec.getBoundingClientRect(),vh=innerHeight,a=vh*.2,b=-vh*.75,t=Math.min(1,Math.max(0,(a-r.top)/(a-b)));set(Math.round(t*chars.length))},req=()=>{raf||(raf=requestAnimationFrame(update))};addEventListener("scroll",req,{passive:!0}),addEventListener("resize",req),update()})();
