/* =========================================================
   script.js — everything on the page that isn't WebGL.
   Every block is progressive: if GSAP or Lenis fail to load,
   the content is already in the HTML and simply sits still.
   ========================================================= */

(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";

  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (hasGsap && window.Flip) gsap.registerPlugin(Flip);

  /* ---------- small facts ---------- */
  $("#year").textContent = new Date().getFullYear();

  function tickTime() {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Amman",
      hour: "2-digit",
      minute: "2-digit",
    });
    const now = fmt.format(new Date());
    $("#localTime").textContent = now;
    const n = $("#nowLocalTime");
    if (n) n.textContent = now + " local time";
  }
  tickTime();
  setInterval(tickTime, 30000);

  /* ---------- hero wordmark: sized to fill the column exactly ---------- */
  const mark = $(".hero__mark");
  if (mark) {
    const word = $(".split", mark);
    // read everything, then write once: the type scales linearly with
    // font-size, so one measurement is exact and no layout is forced twice
    const fit = () => {
      const size = parseFloat(getComputedStyle(mark).fontSize);
      const ratio = mark.clientWidth / word.offsetWidth;
      if (Math.abs(ratio - 1) > 0.002) mark.style.fontSize = size * ratio + "px";
    };
    fit();
    let fitQueued = false;
    window.addEventListener("resize", () => {
      if (fitQueued) return;
      fitQueued = true;
      requestAnimationFrame(() => { fitQueued = false; fit(); });
    });
    if (document.fonts) document.fonts.ready.then(fit);
  }

  /* ---------- split text into letters ---------- */
  function splitChars(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          [...child.textContent].forEach((ch) => {
            if (ch === " ") {
              frag.appendChild(document.createTextNode(" "));
            } else {
              const s = document.createElement("span");
              s.className = "char";
              s.textContent = ch;
              frag.appendChild(s);
            }
          });
          child.replaceWith(frag);
        } else if (child.tagName === "EM") {
          // gradient text: background-clip breaks if its letters are transformed
          // one by one, so the whole phrase moves as a single unit
          child.classList.add("char");
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    return $$(".char", el);
  }

  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) return frag.appendChild(document.createTextNode(" "));
            const s = document.createElement("span");
            s.className = "word";
            s.textContent = w;
            frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    return $$(".word", el);
  }

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4) });
    window.__lenis = lenis; // features.js scrolls through it too
    if (hasGsap && window.ScrollTrigger) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  }

  // in-page links go through Lenis so they glide instead of jump
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id === "#top" ? document.body : $(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(id === "#top" ? 0 : target, { offset: -20 });
      else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  /* ---------- nav: hide on scroll down, active section ---------- */
  const nav = $("#nav");
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    nav.classList.toggle("is-hidden", y > lastY && y > 400);
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  const navLinks = $$(".nav__links a");
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  ["work", "stack", "timeline", "about", "contact"].forEach((id) => $("#" + id) && spy.observe($("#" + id)));


  /* ---------- marquee: drifts, and leans into scroll speed ---------- */
  const track = $("#marquee");
  if (track) {
    track.innerHTML += track.innerHTML; // two copies for a seamless loop
    let x = 0;
    let speed = 1;
    let prev = window.scrollY;
    // measured once, not per frame: reading layout right after writing a
    // transform forces a synchronous reflow every frame
    // and not straight after the innerHTML write above either: wait a frame
    let half = 0;
    requestAnimationFrame(() => (half = track.scrollWidth / 2));
    window.addEventListener("resize", () => (half = track.scrollWidth / 2));
    document.fonts && document.fonts.ready.then(() => (half = track.scrollWidth / 2));
    let onScreen = true;
    new IntersectionObserver(([en]) => (onScreen = en.isIntersecting)).observe(track);
    const loop = () => {
      requestAnimationFrame(loop);
      if (!onScreen) return;
      const y = window.scrollY;
      const v = (y - prev) * 0.25;
      prev = y;
      speed += ((reduceMotion ? 0 : 1) + Math.abs(v) - speed) * 0.08;
      const dir = v < 0 ? -1 : 1;
      x -= speed * dir * 0.9;
      if (x <= -half) x += half;
      if (x > 0) x -= half;
      track.style.transform = `translate3d(${x}px,0,0)`;
    };
    requestAnimationFrame(loop);
  }

  /* ---------- scroll reveals ---------- */
  let projReveal = []; // the project cards' triggers; the filters retire them
  if (hasGsap && window.ScrollTrigger && !reduceMotion) {
    // section titles: letters rise out of a mask
    $$("[data-reveal-text]").forEach((el) => {
      el.innerHTML = `<span class="line"><span class="split">${el.innerHTML}</span></span>`;
      const chars = splitChars(el);
      gsap.from(chars, {
        yPercent: 110,
        duration: 1.1,
        ease: "expo.out",
        stagger: 0.025,
        scrollTrigger: { trigger: el, start: "top 85%" },
      });
    });

    gsap.utils.toArray(".section__head").forEach((head) => {
      gsap.from($$(".section__num, .section__meta", head), {
        opacity: 0,
        y: 12,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: head, start: "top 85%" },
      });
    });

    // project cards: each rises and fades in, its cover settles, then the copy
    // follows. Transform and opacity only (no clip-path or 3D, which repaint every
    // frame), and props are cleared after so hover and the Flip filters start clean.
    gsap.set(".proj", { opacity: 0, y: 56 });
    projReveal = ScrollTrigger.batch(".proj", {
      start: "top 90%",
      once: true,
      onEnter: (batch) => {
        gsap.timeline({ defaults: { ease: "power3.out" } })
          .to(batch, { opacity: 1, y: 0, duration: 1, stagger: 0.1, clearProps: "transform,opacity" })
          .from(batch.map((b) => $(".proj__cover", b)), { scale: 0.94, duration: 1.2, stagger: 0.1, clearProps: "transform" }, 0)
          .from(batch.flatMap((b) => [...$(".proj__body", b).children]),
            { opacity: 0, y: 16, duration: 0.8, stagger: 0.04, clearProps: "transform,opacity" }, 0.15);
      },
    });

    // stack copy
    gsap.from(".stack__lead, .stack__list li", {
      y: 30,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger: ".stack", start: "top 75%" },
    });

    // timeline: the rail fills as you read, dots light up
    gsap.to("#tlFill", {
      scaleY: 1,
      ease: "none",
      scrollTrigger: { trigger: "#tl", start: "top 60%", end: "bottom 60%", scrub: 0.6 },
    });
    $$(".tl__item").forEach((item) => {
      ScrollTrigger.create({
        trigger: item,
        start: "top 60%",
        onEnter: () => item.classList.add("is-on"),
        onLeaveBack: () => item.classList.remove("is-on"),
      });
      gsap.from(item.children, {
        x: -30,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: item, start: "top 82%" },
      });
    });

    // tally: count up
    $$(".tally dd").forEach((dd) => {
      const to = +dd.dataset.to;
      const o = { v: 0 };
      dd.textContent = "0";
      gsap.to(o, {
        v: to,
        duration: 1.6,
        ease: "power3.out",
        scrollTrigger: { trigger: dd, start: "top 88%" },
        onUpdate: () => (dd.textContent = Math.round(o.v)),
      });
    });
    gsap.from(".tally", {
      y: 40,
      opacity: 0,
      duration: 1.2,
      ease: "expo.out",
      scrollTrigger: { trigger: ".tally", start: "top 90%" },
    });

    // about: words brighten as you scroll through them
    const lead = $("[data-words]");
    if (lead) {
      const words = splitWords(lead);
      gsap.fromTo(words, { opacity: 0.12 }, {
        opacity: 1,
        stagger: 0.05,
        ease: "none",
        scrollTrigger: { trigger: lead, start: "top 80%", end: "bottom 45%", scrub: true },
      });
    }
    gsap.from(".card", {
      y: 60,
      opacity: 0,
      duration: 1.2,
      ease: "expo.out",
      stagger: 0.1,
      scrollTrigger: { trigger: ".about__cards", start: "top 85%" },
    });

    // contact headline
    const contactChars = $$(".contact__title .split").flatMap(splitChars);
    gsap.from(contactChars, {
      yPercent: 115,
      duration: 1.3,
      ease: "expo.out",
      stagger: 0.015,
      scrollTrigger: { trigger: ".contact__title", start: "top 80%" },
    });
    gsap.from(".contact__email, .contact__links", {
      y: 30,
      opacity: 0,
      duration: 1.1,
      ease: "power3.out",
      stagger: 0.12,
      scrollTrigger: { trigger: ".contact__email", start: "top 90%" },
    });

    // hero drifts up and fades as it leaves
    gsap.to(".hero__inner", {
      yPercent: -18,
      opacity: 0.15,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });

    window.addEventListener("load", () => ScrollTrigger.refresh());
  }

  /* ---------- filters (Flip) ---------- */
  const filters = $("#workFilters");
  const grid = $("#workGrid");
  if (filters && grid) {
    const cards = $$(".proj", grid);
    let flip = null;
    const btns = $$(".filters__btn", filters);
    const glider = $(".filters__glider", filters);
    const countOf = (f) => (f === "all" ? cards.length : cards.filter((c) => c.dataset.tags.split(" ").includes(f)).length);
    btns.forEach((b) => ($("b", b).textContent = countOf(b.dataset.filter)));
    filters.hidden = false;

    const moveGlider = (btn) => {
      glider.style.width = btn.offsetWidth + "px";
      glider.style.transform = `translateX(${btn.offsetLeft}px)`;
    };
    requestAnimationFrame(() => moveGlider(btns[0]));
    window.addEventListener("resize", () => moveGlider($('[aria-pressed="true"]', filters)));

    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = btn.dataset.filter;
        btns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        moveGlider(btn);
        $("#workCount").textContent = `${countOf(f)} ${countOf(f) === 1 ? "project" : "projects"}`;

        const apply = () =>
          cards.forEach((c) => c.classList.toggle("is-hidden", f !== "all" && !c.dataset.tags.split(" ").includes(f)));

        if (hasGsap && window.Flip && !reduceMotion) {
          // Once someone filters, every card counts as revealed: a scroll reveal
          // still pending would fight the Flip over opacity and position.
          projReveal.forEach((t) => t.kill());
          projReveal = [];
          // A click mid-animation: land the last one first, so we measure real layout.
          if (flip) flip.progress(1);
          gsap.killTweensOf(grid);
          // stop reveals still playing on the cards or inside them, or they keep
          // moving the cards while Flip measures, and cards fly across the grid
          const parts = cards.flatMap((c) => [c, $(".proj__cover", c), ...$(".proj__body", c).children]);
          gsap.killTweensOf(parts);
          gsap.set(parts, { clearProps: "opacity,transform" });

          // absolute: true lifts the cards out of the flow while they move, which
          // collapsed the grid and pulled the next section up underneath them.
          // Hold the grid's height and ease it to the new one instead.
          const from = grid.offsetHeight;
          const state = Flip.getState(cards);
          apply();
          const to = grid.offsetHeight;
          gsap.fromTo(grid, { height: from }, { height: to, duration: 0.8, ease: "expo.inOut", clearProps: "height" });
          flip = Flip.from(state, {
            duration: 0.8,
            ease: "expo.inOut",
            scale: true,
            absolute: true,
            onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.2 }),
            onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.94, duration: 0.3 }),
            onComplete: () => {
              flip = null;
              if (window.ScrollTrigger) ScrollTrigger.refresh();
            },
          });
        } else {
          apply();
        }
      });
    });
  }

  /* ---------- pointer toys: spotlight, tilt, magnetic ---------- */
  if (finePointer && !reduceMotion) {
    // project cards: spotlight only, at most once per frame. (No 3D tilt here:
    // tilting a big card full of images re-rasterises it on every move.)
    $$(".proj").forEach((card) => {
      let pending = null;
      card.addEventListener("pointermove", (e) => {
        if (!pending) requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          card.style.setProperty("--mx", pending.x - r.left + "px");
          card.style.setProperty("--my", pending.y - r.top + "px");
          pending = null;
        });
        pending = { x: e.clientX, y: e.clientY };
      });
    });

    // about cards: stronger tilt
    $$("[data-tilt]").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--gx", (px + 0.5) * 100 + "%");
        card.style.setProperty("--gy", (py + 0.5) * 100 + "%");
        if (hasGsap) gsap.to(card, { rotateY: px * 10, rotateX: -py * 10, transformPerspective: 900, duration: 0.5, ease: "power3.out" });
      });
      card.addEventListener("pointerleave", () => {
        if (hasGsap) gsap.to(card, { rotateY: 0, rotateX: 0, duration: 1, ease: "elastic.out(1, 0.5)" });
      });
    });

    // magnetic buttons
    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        if (hasGsap) gsap.to(el, { x: x * 0.3, y: y * 0.4, duration: 0.5, ease: "power3.out" });
      });
      el.addEventListener("pointerleave", () => {
        if (hasGsap) gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" });
      });
    });

  }

  /* ---------- word sphere ---------- */
  const sphere = $("#sphere");
  if (sphere) {
    const words = $$("span", sphere);
    const n = words.length;
    // Fibonacci sphere: evenly spread points
    const pts = words.map((_, i) => {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = Math.PI * (3 - Math.sqrt(5)) * i;
      return [Math.cos(th) * r, y, Math.sin(th) * r];
    });
    sphere.classList.add("is-3d");

    let rx = 0.3, ry = 0, vx = 0.0018, vy = 0.004;
    let dragging = false, px = 0, py = 0;
    let visible = false;
    new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(sphere);

    sphere.addEventListener("pointerdown", (e) => {
      dragging = true;
      px = e.clientX;
      py = e.clientY;
      sphere.setPointerCapture(e.pointerId);
    });
    sphere.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      vy = (e.clientX - px) * 0.0009;
      vx = -(e.clientY - py) * 0.0009;
      px = e.clientX;
      py = e.clientY;
    });
    const stop = () => (dragging = false);
    sphere.addEventListener("pointerup", stop);
    sphere.addEventListener("pointercancel", stop);

    const render = () => {
      if (visible) {
        if (!dragging) {
          // ease back to a slow idle spin
          vx += (0.0012 - vx) * 0.02;
          vy += ((reduceMotion ? 0 : 0.0035) - vy) * 0.02;
        }
        rx += vx;
        ry += vy;
        const R = sphere.clientWidth * 0.4;
        const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry);
        words.forEach((w, i) => {
          let [x, y, z] = pts[i];
          // rotate around Y then X
          const x1 = x * cY + z * sY;
          const z1 = -x * sY + z * cY;
          const y1 = y * cX - z1 * sX;
          const z2 = y * sX + z1 * cX;
          const scale = 0.6 + (z2 + 1) * 0.35;
          w.style.transform = `translate(-50%,-50%) translate3d(${x1 * R}px,${y1 * R}px,0) scale(${scale})`;
          w.style.opacity = (0.15 + (z2 + 1) * 0.42).toFixed(3);
          w.style.zIndex = Math.round(z2 * 100) + 100;
          w.style.color = z2 > 0.55 ? "var(--accent)" : "";
        });
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  /* ---------- copy email ---------- */
  const email = $("#copyEmail");
  if (email && navigator.clipboard) {
    email.addEventListener("click", (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(email.dataset.email).then(
        () => {
          $("#copyLabel").textContent = "Copied ✓";
          $("#copyStatus").textContent = "Email address copied to clipboard";
          setTimeout(() => ($("#copyLabel").textContent = "Click to copy"), 2200);
        },
        () => (window.location.href = email.href)
      );
    });
  }

})();
