/* =========================================================
   ZAKI NAZZAL — behaviour
   ========================================================= */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- THE MEASURED HEADLINE ----------
   The numbers under and beside the hero are the real rendered size of the
   box, read back from layout. They re-measure on resize, so they stay true. */
(() => {
  const box = document.getElementById("measure");
  const wOut = document.getElementById("dimW");
  const hOut = document.getElementById("dimH");
  if (!box || !wOut || !hOut) return;

  let played = false;
  const frames = new Map();

  // Any in-flight count-up must be cancelled before writing, or a stale
  // animation will finish after a re-measure and leave a wrong number on screen.
  const write = (el, value, animate) => {
    const prev = frames.get(el);
    if (prev) cancelAnimationFrame(prev);
    frames.delete(el);

    const target = Math.round(value);
    if (!animate) {
      el.textContent = target + " px";
      return;
    }
    const t0 = performance.now();
    const dur = 700;
    const tick = (now) => {
      const t = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + " px";
      if (t < 1) frames.set(el, requestAnimationFrame(tick));
      else frames.delete(el);
    };
    frames.set(el, requestAnimationFrame(tick));
  };

  const measure = (animate) => {
    const r = box.getBoundingClientRect();
    write(wOut, r.width, animate);
    write(hOut, r.height, animate);
  };

  // Count up once, only after the display face has loaded — Bricolage reflows
  // the headline, so measuring before then reads the fallback font's box.
  let animating = false;

  const playOnce = () => {
    if (played) return;
    played = true;
    animating = !reduceMotion;
    measure(animating);
    if (animating) setTimeout(() => { animating = false; }, 750);
  };

  measure(false); // never leave the labels blank
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(playOnce);
    setTimeout(playOnce, 1500); // fonts blocked or offline
  } else {
    playOnce();
  }

  // While the count-up is running, a resize re-targets it rather than cancelling
  // it, so the labels animate once and still always land on the true value.
  const remeasure = () => {
    if (played) measure(animating);
  };

  if ("ResizeObserver" in window) {
    new ResizeObserver(remeasure).observe(box);
  } else {
    window.addEventListener("resize", remeasure);
  }
})();

/* ---------- HERO: DIAGONAL MARQUEE ----------
   Three slanted rows of covers drifting behind the headline. Each row is a
   track holding its set repeated enough times to cross the (rotated, scaled-up)
   stage, then that whole run cloned once — so translating the track by exactly
   -50% lands on an identical frame and the loop has no seam. */
(() => {
  const root = document.getElementById("heroMarquee");
  if (!root) return;

  const rows = Array.from(root.querySelectorAll(".dmc__row"));
  if (!rows.length) return;

  const card = (name) => {
    const fig = document.createElement("figure");
    fig.className = "dmc__card";
    const img = document.createElement("img");
    img.src = "covers/" + name + ".jpeg";
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 800;
    img.height = 500;
    fig.append(img);
    return fig;
  };

  const build = () => {
    // The stage is scaled 1.3x and turned, so a row has to be wider than the hero.
    const stage = (root.getBoundingClientRect().width || window.innerWidth) * 1.45;

    rows.forEach((row) => {
      const set = (row.dataset.set || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!set.length) return;

      const track = document.createElement("div");
      track.className = "dmc__track";
      track.style.setProperty("--dur", (row.dataset.speed || 60) + "s");

      set.forEach((n) => track.append(card(n)));
      row.replaceChildren(track);

      // One pass is laid out now, so it can be measured rather than guessed at.
      const pass = track.scrollWidth;
      const passes = pass > 0 ? Math.max(1, Math.ceil(stage / pass)) : 1;
      for (let i = 1; i < passes; i++) set.forEach((n) => track.append(card(n)));

      track.append(...Array.from(track.children).map((n) => n.cloneNode(true)));
    });
  };

  build();

  // Rebuilding re-requests every cover, so only do it once the width has moved
  // far enough to actually open a gap — not on every resize tick.
  let lastW = window.innerWidth;
  let settle;
  window.addEventListener("resize", () => {
    if (Math.abs(window.innerWidth - lastW) < 140) return;
    clearTimeout(settle);
    settle = setTimeout(() => {
      lastW = window.innerWidth;
      build();
    }, 250);
  });
})();

/* ---------- STACK: TEXT ON A PATH ----------
   The words follow an SVG curve, and scrolling slides them along it. The phrase
   is repeated until it comfortably overruns the path, so the visible stretch is
   never half-empty at either end of the travel. */
(() => {
  const wrap = document.getElementById("pathScroll");
  const curve = document.getElementById("stackCurve");
  const textPath = document.getElementById("stackTextPath");
  const ruler = document.getElementById("stackMeasure");
  const text = document.getElementById("stackText");
  if (!wrap || !curve || !textPath || !ruler || !text) return;
  if (typeof curve.getTotalLength !== "function") return;

  const items = (text.dataset.items || "").split("|").map((s) => s.trim()).filter(Boolean);
  if (!items.length) return;

  const SEP = " · "; // the dots never break off their neighbours
  const plain = items.map((w) => w + SEP).join("");
  const marked = items
    .map((w) => `<tspan>${w}</tspan><tspan class="pathfx__sep">${SEP}</tspan>`)
    .join("");

  let start = 0;
  let travel = 0;
  let ready = false;

  const build = () => {
    const L = curve.getTotalLength();
    ruler.textContent = plain;
    const one = ruler.getComputedTextLength();
    if (!L || !one) {
      ready = false;
      return;
    }

    const reps = Math.max(2, Math.ceil((L * 3) / one));
    textPath.innerHTML = marked.repeat(reps);

    const total = one * reps;
    start = L * 0.12;
    // Cap the sweep at ~1.2 path lengths. Further is only faster, not more
    // interesting, and the tail would eventually run out of glyphs.
    travel = Math.max(L * 0.2, Math.min(total + start - L * 1.05, L * 1.2));
    ready = true;
  };

  const place = (p) => {
    if (ready) textPath.setAttribute("startOffset", (start - p * travel).toFixed(1));
  };

  // Progress runs 0 → 1 as the block crosses the viewport, bottom edge to top.
  const progress = () => {
    const r = wrap.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const span = vh + r.height;
    if (span <= 0) return 0.5;
    return Math.min(Math.max((vh - r.top) / span, 0), 1);
  };

  // Parked mid-sweep when motion is unwelcome — composed, not cut off.
  const settle = () => place(reduceMotion ? 0.5 : progress());

  build();
  settle();

  if (!reduceMotion) {
    let queued = false;
    window.addEventListener(
      "scroll",
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          place(progress());
        });
      },
      { passive: true }
    );
  }

  window.addEventListener("resize", () => {
    build();
    settle();
  });

  // Bricolage sets different advance widths than the fallback face, so the
  // repeat count measured before it loads is wrong.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      build();
      settle();
    });
  }
})();

/* ---------- THEME ---------- */
(() => {
  const btn = document.getElementById("themeToggle");
  const label = document.getElementById("themeLabel");
  if (!btn || !label) return;

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  const isDark = () => {
    const set = document.documentElement.getAttribute("data-theme");
    return set ? set === "dark" : systemDark.matches;
  };

  const paint = () => {
    const dark = isDark();
    // The button names what you'll get, not what you're in.
    label.textContent = dark ? "light" : "dark";
    btn.setAttribute("aria-pressed", String(dark));
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };

  btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
    paint();
  });

  // Follow the OS only while the user hasn't picked a side.
  systemDark.addEventListener("change", () => {
    if (!document.documentElement.getAttribute("data-theme")) paint();
  });

  paint();
})();

/* ---------- COPY EMAIL ---------- */
(() => {
  const link = document.getElementById("copyEmail");
  const chip = document.getElementById("copyLabel");
  const status = document.getElementById("copyStatus");
  if (!link || !chip) return;

  let resetId;
  link.addEventListener("click", (e) => {
    if (!navigator.clipboard) return; // let the mailto through
    e.preventDefault();
    navigator.clipboard.writeText(link.dataset.email).then(
      () => {
        chip.textContent = "Copied";
        if (status) status.textContent = "Email address copied to clipboard.";
      },
      () => {
        chip.textContent = "Press ⌘C";
        if (status) status.textContent = "Couldn't copy. Select the address and copy it.";
      }
    );
    clearTimeout(resetId);
    resetId = setTimeout(() => {
      chip.textContent = "Click to copy";
      if (status) status.textContent = "";
    }, 2400);
  });
})();

/* ---------- LOCAL TIME (Kuala Lumpur, where he actually is) ---------- */
(() => {
  const el = document.getElementById("localTime");
  if (!el) return;
  const render = () => {
    try {
      el.textContent = new Date().toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kuala_Lumpur",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      el.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  };
  render();
  setInterval(render, 30_000);
})();

/* ---------- FOOTER YEAR ---------- */
(() => {
  const el = document.getElementById("year");
  if (el) el.textContent = new Date().getFullYear();
})();

/* ---------- NAV: mark the section you're reading ---------- */
(() => {
  if (!("IntersectionObserver" in window)) return;
  const links = new Map();
  document.querySelectorAll(".masthead__nav a").forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    const section = document.getElementById(id);
    if (section) links.set(section, a);
  });
  if (!links.size) return;

  // Track visibility per section, then pick a single winner each time anything
  // changes — otherwise a section leaving without another entering clears the
  // highlight entirely, and two overlapping sections can both stay marked.
  const visible = new Set();

  const paint = () => {
    let winner = null;
    links.forEach((_, section) => {
      if (!visible.has(section)) return;
      if (!winner || section.offsetTop < winner.offsetTop) winner = section;
    });
    links.forEach((a, section) => {
      if (section === winner) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  };

  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      paint();
    },
    { rootMargin: "-20% 0px -70% 0px" }
  );
  links.forEach((_, section) => spy.observe(section));
})();

/* ---------- SCROLL REVEALS ----------
   Only hide content if we have an observer that can bring it back. */
(() => {
  if (!("IntersectionObserver" in window)) {
    document.querySelector(".colophon__mark")?.classList.add("in");
    return;
  }

  if (!reduceMotion) {
    [".band__head", ".proj", ".tl__item", ".about__lead", ".facts__row", ".contact__lead", ".contact__row"]
      .forEach((sel) => {
        document.querySelectorAll(sel).forEach((el, i) => {
          el.classList.add("anim");
          el.style.setProperty("--i", i % 5);
        });
      });
  }

  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        reveal.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
  );

  document.querySelectorAll(".anim, .colophon__mark").forEach((el) => reveal.observe(el));
})();
