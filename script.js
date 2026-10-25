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
  const t0 = performance.now();

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

  /* ---------- loader + intro ---------- */
  const heroChars = $$(".hero__title .split").flatMap(splitChars);
  const heroBits = $$("[data-hero]");

  function intro() {
    document.documentElement.classList.remove("is-loading");
    const loader = $("#loader");
    if (!hasGsap || reduceMotion) {
      loader.remove();
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(loader, { clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: "expo.inOut" })
      .set(loader, { display: "none" })
      .from(heroChars, { yPercent: 115, rotate: 6, duration: 1.4, stagger: 0.018 }, "-=0.45")
      .from(heroBits, { y: 24, opacity: 0, duration: 1.1, stagger: 0.08 }, "-=1.1")
      .from(nav, { y: -30, opacity: 0, duration: 1, clearProps: "transform,opacity" }, "<");
  }

  if (hasGsap && !reduceMotion) {
    document.documentElement.classList.add("is-loading");
    const num = $("#loaderNum");
    const bar = $("#loaderBar");
    const state = { p: 0 };
    let loaded = document.readyState === "complete";
    window.addEventListener("load", () => (loaded = true));
    // count to 80 on its own, then wait for load (or 2.5s) before finishing
    gsap.to(state, {
      p: 80,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => {
        num.textContent = Math.round(state.p);
        bar.style.transform = `scaleX(${state.p / 100})`;
      },
      onComplete: () => {
        const finish = () =>
          gsap.to(state, {
            p: 100,
            duration: 0.45,
            ease: "power2.inOut",
            onUpdate: () => {
              num.textContent = Math.round(state.p);
              bar.style.transform = `scaleX(${state.p / 100})`;
            },
            onComplete: intro,
          });
        if (loaded) return finish();
        const wait = setTimeout(finish, 1400);
        window.addEventListener("load", () => {
          clearTimeout(wait);
          finish();
        }, { once: true });
      },
    });
  } else {
    intro();
  }

  /* ---------- marquee: drifts, and leans into scroll speed ---------- */
  const track = $("#marquee");
  if (track) {
    track.innerHTML += track.innerHTML; // two copies for a seamless loop
    let x = 0;
    let speed = 1;
    let prev = window.scrollY;
    // measured once, not per frame: reading layout right after writing a
    // transform forces a synchronous reflow every frame
    let half = track.scrollWidth / 2;
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

    // project cards: rise in, cover image unmasks
    gsap.set(".proj", { opacity: 0 });
    ScrollTrigger.batch(".proj", {
      start: "top 88%",
      onEnter: (batch) => {
        gsap.fromTo(
          batch,
          { y: 80, opacity: 0, rotateX: -8 },
          { y: 0, opacity: 1, rotateX: 0, duration: 1.3, ease: "expo.out", stagger: 0.12, overwrite: true }
        );
        gsap.fromTo(
          batch.map((b) => $(".proj__cover", b)),
          { clipPath: "inset(18% 12% 18% 12% round 14px)" },
          { clipPath: "inset(0% 0% 0% 0% round 10px)", duration: 1.5, ease: "expo.out", stagger: 0.12 }
        );
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
          const state = Flip.getState(cards);
          apply();
          Flip.from(state, {
            duration: 0.8,
            ease: "expo.inOut",
            scale: true,
            absolute: true,
            onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6 }),
            onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.4 }),
            onComplete: () => window.ScrollTrigger && ScrollTrigger.refresh(),
          });
        } else {
          apply();
        }
      });
    });
  }

  /* ---------- pointer toys: tilt, spotlight, magnetic, cursor ---------- */
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
        if (hasGsap) gsap.to(card, { rotateY: px * 14, rotateX: -py * 14, duration: 0.5, ease: "power3.out" });
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

    // custom cursor
    const cursor = $("#cursor");
    const dot = $("#cursorDot");
    const label = $("#cursorLabel");
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    window.addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      dot.style.transform = `translate3d(${tx}px,${ty}px,0)`;
    }, { passive: true });
    const follow = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      cursor.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);

    document.addEventListener("pointerover", (e) => {
      const labeled = e.target.closest("[data-cursor]");
      const hot = e.target.closest("a, button, summary, .sphere");
      cursor.classList.toggle("is-label", !!labeled);
      cursor.classList.toggle("is-hover", !labeled && !!hot);
      label.textContent = labeled ? labeled.dataset.cursor : "";
    });
    document.addEventListener("pointerleave", () => cursor.classList.remove("is-hover", "is-label"));
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

  /* ---------- colophon: what this page actually cost ---------- */
  window.addEventListener("load", () => {
    const out = $("#colophonSpec");
    if (!out || !performance.getEntriesByType) return;
    setTimeout(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const res = performance.getEntriesByType("resource");
      const bytes = res.reduce((a, r) => a + (r.transferSize || 0), nav ? nav.transferSize || 0 : 0);
      const ms = Math.round(performance.now() - t0);
      if (bytes > 0) out.textContent = `Hand-written · three.js · ${(bytes / 1024).toFixed(0)} KB · ${ms} ms to interactive`;
    }, 300);
  });
})();
