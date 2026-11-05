/* =========================================================
   features.js — the interactive extras.

   A playground of the shipped sites (full-page captures in a
   browser / phone frame that tours itself), a command palette
   (Ctrl/⌘ K), a terminal in the About section, and a live
   pulse of public GitHub activity. Each one mounts only if
   its markup is on the page; none of them is load-bearing.
   ========================================================= */

(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  const EMAIL = "zakinazal112@gmail.com";
  const GH_USER = "ZakiNazal";

  function scrollToEl(el) {
    if (!el) return;
    if (window.__lenis) window.__lenis.scrollTo(el, { offset: -20 });
    else el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }

  function openUrl(url) {
    window.open(url, "_blank", "noopener");
  }

  function downloadResume() {
    const a = document.createElement("a");
    a.href = "resume.pdf";
    a.download = "Zaki-Nazzal-Resume.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- toast ---------- */
  let toastTimer = 0;
  function toast(msg) {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 2200);
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      toast("Email copied — " + EMAIL);
    } catch (e) {
      window.location.href = "mailto:" + EMAIL;
    }
  }

  /* ---------- GitHub activity (shared by the pulse and `git log`) ---------- */
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  function ago(iso) {
    const s = (new Date(iso).getTime() - Date.now()) / 1000;
    const steps = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"], [Infinity, "year"]];
    let v = s;
    for (const [n, unit] of steps) {
      if (Math.abs(v) < n) return rtf.format(Math.round(v), unit);
      v /= n;
    }
    return "";
  }

  function describe(ev) {
    const repo = ev.repo.name.split("/")[1] || ev.repo.name;
    const p = ev.payload || {};
    const msg = p.commits && p.commits.length ? p.commits[p.commits.length - 1].message.split("\n")[0] : "";
    switch (ev.type) {
      case "PushEvent": return { verb: "pushed to", repo, msg };
      case "PullRequestEvent": return { verb: `${p.action || "opened"} a PR in`, repo, msg: p.pull_request ? p.pull_request.title : "" };
      case "CreateEvent": return { verb: `created a ${p.ref_type || "repo"} in`, repo, msg: p.ref || "" };
      case "ReleaseEvent": return { verb: "released", repo, msg: p.release ? p.release.name || p.release.tag_name : "" };
      case "WatchEvent": return { verb: "starred", repo, msg: "" };
      case "IssuesEvent": return { verb: `${p.action || "opened"} an issue in`, repo, msg: p.issue ? p.issue.title : "" };
      default: return { verb: ev.type.replace(/Event$/, "").toLowerCase() + " ·", repo, msg: "" };
    }
  }

  let eventsPromise = null;
  function githubEvents() {
    if (eventsPromise) return eventsPromise;
    eventsPromise = (async () => {
      const KEY = "gh-events";
      try {
        const c = JSON.parse(sessionStorage.getItem(KEY) || "null");
        if (c && Date.now() - c.at < 10 * 60 * 1000) return c.events; // unauthenticated API: 60 requests/hour
      } catch (e) { /* storage blocked */ }
      const r = await fetch(`https://api.github.com/users/${GH_USER}/events/public?per_page=30`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!r.ok) throw new Error("GitHub " + r.status);
      const events = (await r.json()).filter((e) => e.public);
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), events })); } catch (e) { /* ignore */ }
      return events;
    })();
    eventsPromise.catch(() => { eventsPromise = null; });
    return eventsPromise;
  }

  (function pulse() {
    const el = $("#ghPulse");
    if (!el) return;
    githubEvents().then((events) => {
      const ev = events.find((e) => e.type === "PushEvent") || events[0];
      if (!ev) return;
      const d = describe(ev);
      $(".pulse__what", el).textContent = `${d.verb} ${d.repo}`;
      $(".pulse__msg", el).textContent = d.msg ? `“${d.msg}”` : "";
      const t = $(".pulse__when", el);
      t.textContent = ago(ev.created_at);
      t.setAttribute("datetime", ev.created_at);
      el.href = `https://github.com/${ev.repo.name}`;
      el.hidden = false;
    }).catch(() => { /* offline or rate-limited: the pulse simply stays hidden */ });
  })();

  /* ---------- playground: tour the live sites ---------- */
  const SITES = [
    { id: "scvn", name: "SCORVYN.™", url: "https://scorvyn.shop", note: "Streetwear storefront: numbered drops, Stripe checkout.", d: [1200, 4898], m: [540, 8778] },
    { id: "qbook", name: "QBooking", url: "https://qbooking.app", note: "Booking pages and a shared schedule for appointment teams.", d: [1200, 3718], m: [540, 9064] },
    { id: "dieters", name: "Dieters Diet", url: "https://dietersdiet.fit", note: "Meal plans written meal by meal and in grams. Arabic-first.", d: [1200, 5453], m: [540, 12462] },
    { id: "brim", name: "Brim", url: "https://brim3d.vercel.app/", note: "A 3D design studio that runs in the browser.", d: [1200, 750], m: [540, 1169] },
    { id: "coco", name: "CocoStudy", url: "https://cocostudy.space/", note: "Turns a lecture or messy notes into a study guide.", d: [1200, 750], m: [540, 1169] },
  ];

  (function playground() {
    const device = $("#pgDevice");
    if (!device) return;
    const tabs = $("#pgTabs");
    const screen = $("#pgScreen");
    const shot = $("#pgShot");
    const host = $("#pgHost");
    const open = $("#pgOpen");
    const caption = $("#pgCaption");
    const bar = $("#pgProgress");
    const hint = $("#pgHint");
    const views = $$(".pg__view");

    let site = SITES[0];
    let view = window.innerWidth < 760 ? "mobile" : "desktop";
    let driving = false; // the visitor has taken over the scroll
    let resumeAt = 0;

    SITES.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pg__tab";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(i === 0));
      b.setAttribute("aria-controls", "pgScreen");
      b.innerHTML = "<i aria-hidden='true'></i>";
      b.append(s.name);
      b.addEventListener("click", () => show(s));
      tabs.appendChild(b);
    });
    tabs.hidden = false;
    $(".pg__views").hidden = false;

    function show(next, nextView = view) {
      if (next === site && nextView === view && shot.dataset.ready) return;
      site = next;
      view = nextView;
      $$(".pg__tab", tabs).forEach((b, i) => b.setAttribute("aria-selected", String(SITES[i] === site)));
      views.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
      device.dataset.view = view;
      host.textContent = new URL(site.url).host;
      open.href = site.url;
      caption.querySelector("b").textContent = site.name;
      caption.querySelector("span").textContent = site.note;
      screen.setAttribute("aria-label", `Scrollable capture of ${host.textContent}`);

      // fade out, swap, fade back in once decoded
      shot.classList.add("is-swapping");
      const [w, h] = view === "mobile" ? site.m : site.d;
      const src = `playground/${site.id}-${view}.webp`;
      const img = new Image();
      img.src = src;
      const swap = () => {
        shot.src = src;
        shot.width = w;
        shot.height = h;
        shot.alt = `Full-page capture of ${host.textContent} (${view})`;
        shot.dataset.ready = "1";
        screen.scrollTop = 0;
        requestAnimationFrame(() => shot.classList.remove("is-swapping"));
      };
      const wait = new Promise((r) => setTimeout(r, reduceMotion ? 0 : 260));
      Promise.all([img.decode().catch(() => { }), wait]).then(swap);
    }

    views.forEach((b) => b.addEventListener("click", () => show(site, b.dataset.view)));

    // the visitor drives while hovering, touching or focused; the tour resumes after a pause
    const take = () => { driving = true; hint.textContent = "You're driving. Scroll inside the window."; };
    const release = () => { driving = false; resumeAt = performance.now() + 2200; hint.textContent = "Touring on its own. Hover to take over."; };
    screen.addEventListener("pointerenter", take);
    screen.addEventListener("pointerleave", release);
    screen.addEventListener("touchstart", take, { passive: true });
    screen.addEventListener("focus", take);
    screen.addEventListener("blur", release);

    screen.addEventListener("scroll", () => {
      const max = screen.scrollHeight - screen.clientHeight;
      bar.style.transform = `scaleY(${max > 0 ? screen.scrollTop / max : 1})`;
    }, { passive: true });

    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.35 }).observe(device);

    // the tour: glide down, rest at the bottom, ease back up
    let last = performance.now();
    let hold = 0;
    let pos = 0;
    function tour(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!reduceMotion && visible && !driving && now > resumeAt && shot.dataset.ready) {
        const max = screen.scrollHeight - screen.clientHeight;
        if (Math.abs(pos - screen.scrollTop) > 2) pos = screen.scrollTop; // the visitor moved it
        if (max > 4) {
          if (hold > 0) {
            hold -= dt;
            if (hold <= 0 && pos >= max - 1) {
              screen.scrollTo({ top: 0, behavior: "smooth" });
              pos = 0;
              hold = 1.6;
            }
          } else {
            pos = Math.min(pos + dt * (view === "mobile" ? 70 : 90), max);
            screen.scrollTop = pos;
            if (pos >= max) hold = 1.4;
          }
        }
      }
      requestAnimationFrame(tour);
    }
    requestAnimationFrame(tour);

    // nothing loads until the section is near: the capture is the heaviest
    // thing on the page and most visits never reach it
    shot.removeAttribute("src");
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      near.disconnect();
      show(site, view);
    }, { rootMargin: "800px 0px" });
    near.observe(device);
    release();
  })();

  /* ---------- command palette ---------- */
  (function palette() {
    const sections = [
      ["top", "Top"], ["work", "Projects"], ["playground", "Playground"], ["stack", "Stack"],
      ["timeline", "Timeline"], ["about", "About"], ["contact", "Contact"],
    ].filter(([id]) => document.getElementById(id));

    const projects = $$(".proj").map((p) => {
      const a = $(".proj__name a", p);
      return a && { name: a.textContent.trim(), url: a.href, card: p };
    }).filter(Boolean);

    function items() {
      const list = [];
      sections.forEach(([id, label]) => list.push({
        group: "Go to", label, icon: "→", keys: "section jump " + id,
        run: () => scrollToEl(id === "top" ? document.body : document.getElementById(id)),
      }));
      projects.forEach((p) => list.push({
        group: "Projects", label: p.name, icon: "↗", hint: new URL(p.url).host, keys: "project open visit",
        run: () => openUrl(p.url),
      }));
      list.push(
        { group: "Actions", label: "Copy email address", icon: "@", hint: EMAIL, keys: "mail contact", run: copyEmail },
        { group: "Actions", label: "Write me an email", icon: "✉", keys: "mail contact hire", run: () => { window.location.href = "mailto:" + EMAIL; } },
        { group: "Actions", label: "Download résumé", icon: "↓", keys: "cv resume pdf", run: downloadResume },
        { group: "Actions", label: "GitHub profile", icon: "↗", hint: "github.com/" + GH_USER, keys: "code repos", run: () => openUrl("https://github.com/" + GH_USER) },
        { group: "Actions", label: "LinkedIn", icon: "↗", keys: "social", run: () => openUrl("https://www.linkedin.com/in/zakinazzal/") },
        { group: "Actions", label: "Open the terminal", icon: "›", keys: "shell console cli", run: () => { scrollToEl($("#term")); setTimeout(() => $("#termInput")?.focus({ preventScroll: true }), 700); } },
      );
      return list;
    }

    // contiguous matches rank above scattered ones; earlier matches above later ones
    function score(item, q) {
      if (!q) return 1;
      const hay = (item.label + " " + item.group + " " + (item.keys || "")).toLowerCase();
      const i = hay.indexOf(q);
      if (i >= 0) return 100 - i;
      let j = 0;
      for (const ch of hay) if (ch === q[j]) j++;
      return j === q.length ? 10 : 0;
    }

    const root = document.createElement("div");
    root.className = "cmdk";
    root.hidden = true;
    root.innerHTML = `
      <div class="cmdk__backdrop" data-close></div>
      <div class="cmdk__panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="cmdk__search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input type="text" placeholder="Search projects, sections, actions…" role="combobox" aria-expanded="true"
            aria-controls="cmdkList" aria-autocomplete="list" autocomplete="off" spellcheck="false" />
          <kbd data-close>esc</kbd>
        </div>
        <ul class="cmdk__list" id="cmdkList" role="listbox" data-lenis-prevent></ul>
        <div class="cmdk__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> select</span>
          <span><kbd>${isMac ? "⌘" : "Ctrl"}</kbd><kbd>K</kbd> toggle</span>
        </div>
      </div>`;
    document.body.appendChild(root);
    const input = $("input", root);
    const list = $(".cmdk__list", root);

    let shown = [];
    let active = 0;
    let lastFocus = null;

    function render() {
      const q = input.value.trim().toLowerCase();
      shown = items().map((it) => ({ it, s: score(it, q) })).filter((x) => x.s > 0);
      if (q) shown.sort((a, b) => b.s - a.s);
      shown = shown.map((x) => x.it);
      active = Math.min(active, Math.max(shown.length - 1, 0));
      list.textContent = "";
      if (!shown.length) {
        const li = document.createElement("li");
        li.className = "cmdk__empty";
        li.textContent = `Nothing matches “${input.value}”.`;
        list.appendChild(li);
        return;
      }
      let group = "";
      shown.forEach((it, i) => {
        if (!q && it.group !== group) {
          group = it.group;
          const h = document.createElement("li");
          h.className = "cmdk__group";
          h.setAttribute("role", "presentation");
          h.textContent = group;
          list.appendChild(h);
        }
        const li = document.createElement("li");
        li.className = "cmdk__item";
        li.id = "cmdk-" + i;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === active));
        const ic = document.createElement("i");
        ic.textContent = it.icon;
        ic.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.textContent = it.label;
        li.append(ic, label);
        if (it.hint) {
          const h = document.createElement("small");
          h.textContent = it.hint;
          li.appendChild(h);
        }
        li.addEventListener("pointermove", () => setActive(i));
        li.addEventListener("click", () => run(i));
        list.appendChild(li);
      });
      input.setAttribute("aria-activedescendant", "cmdk-" + active);
    }

    function setActive(i) {
      if (i === active) return;
      $$('.cmdk__item[aria-selected="true"]', list).forEach((el) => el.setAttribute("aria-selected", "false"));
      active = i;
      const el = document.getElementById("cmdk-" + i);
      if (el) {
        el.setAttribute("aria-selected", "true");
        el.scrollIntoView({ block: "nearest" });
      }
      input.setAttribute("aria-activedescendant", "cmdk-" + i);
    }

    function run(i) {
      const it = shown[i];
      if (!it) return;
      close();
      setTimeout(it.run, 60);
    }

    function openPalette() {
      if (!root.hidden) return;
      lastFocus = document.activeElement;
      root.hidden = false;
      input.value = "";
      active = 0;
      render();
      window.__lenis?.stop();
      requestAnimationFrame(() => {
        root.classList.add("is-open");
        input.focus();
      });
    }

    function close() {
      if (root.hidden) return;
      root.classList.remove("is-open");
      window.__lenis?.start();
      setTimeout(() => { root.hidden = true; }, reduceMotion ? 0 : 220);
      lastFocus?.focus?.({ preventScroll: true });
    }

    input.addEventListener("input", () => { active = 0; render(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1) % Math.max(shown.length, 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((active - 1 + shown.length) % Math.max(shown.length, 1)); }
      else if (e.key === "Enter") { e.preventDefault(); run(active); }
      else if (e.key === "Tab") e.preventDefault(); // focus stays in the palette
    });
    root.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });

    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        root.hidden ? openPalette() : close();
      } else if (e.key === "Escape") {
        close();
      } else if (e.key === "/" && root.hidden && !e.target.closest("input, textarea, [contenteditable]")) {
        e.preventDefault();
        openPalette();
      }
    });

    // a trigger in the nav, beside the call to action
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cmdk-trigger";
    // no aria-label: the visible text is the name, so "click Search" works by voice
    btn.setAttribute("aria-keyshortcuts", isMac ? "Meta+K" : "Control+K");
    btn.setAttribute("aria-haspopup", "dialog");
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <span>Search</span><kbd>${isMac ? "⌘" : "Ctrl"} K</kbd>`;
    btn.addEventListener("click", openPalette);
    const cta = $(".nav__cta");
    if (cta) {
      const end = document.createElement("div");
      end.className = "nav__end";
      cta.replaceWith(end);
      end.append(btn, cta);
    }

    window.portfolioPalette = { open: openPalette };
  })();

  /* ---------- terminal ---------- */
  (function terminal() {
    const body = $("#termBody");
    const form = $("#termForm");
    const input = $("#termInput");
    if (!body || !form) return;
    form.hidden = false;

    const projects = $$(".proj").map((p, i) => {
      const a = $(".proj__name a", p);
      return a && { n: i + 1, name: a.textContent.trim(), url: a.href, tags: (p.dataset.tags || "").split(" ").filter(Boolean) };
    }).filter(Boolean);
    const stack = $$("#sphere span").map((s) => s.textContent.trim());

    function line(parts, cls) {
      const div = document.createElement("div");
      div.className = "term__out" + (cls ? " " + cls : "");
      (Array.isArray(parts) ? parts : [parts]).forEach((p) => {
        if (typeof p === "string") div.append(p);
        else if (p.href) {
          const a = document.createElement("a");
          a.href = p.href;
          a.textContent = p.text;
          if (/^https?:/.test(p.href)) { a.target = "_blank"; a.rel = "noopener"; }
          div.append(a);
        } else {
          const s = document.createElement("span");
          s.className = p.cls;
          s.textContent = p.text;
          div.append(s);
        }
      });
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
      return div;
    }
    const echo = (cmd) => line([{ cls: "term__prompt", text: "~ %" }, " " + cmd], "term__cmd");
    const dim = (t) => ({ cls: "term__dim", text: t });
    const hl = (t) => ({ cls: "term__hl", text: t });

    const COMMANDS = {
      help() {
        [
          ["whoami", "who's behind this page"], ["projects", "what I've built"], ["open <n|name>", "open a project"],
          ["stack", "tools I use"], ["git log", "latest public GitHub activity"],
          ["contact", "how to reach me"], ["resume", "download my CV"], ["date", "time where I am"], ["clear", "clear the screen"],
        ].forEach(([c, d]) => line([hl(c.padEnd(14, " ")), dim(d)]));
        line(dim("Psst: there's a sudo command too."));
      },
      whoami() {
        line("Zaki Nazzal — software developer, Flutter & the web.");
        line(dim("Intern mobile application developer at Housing Bank; BSc Computer Science at APU, Kuala Lumpur."));
        line(dim("Building from Amman, Jordan."));
      },
      projects() {
        projects.forEach((p) => line([hl(String(p.n).padStart(2, "0")), "  " + p.name + "  ", dim(p.tags.join(" · "))]));
        line(dim("Try: open 1   or   open brim"));
      },
      open(args) {
        const q = args.join(" ").toLowerCase();
        if (!q) return line(dim("usage: open <number|name>"));
        const p = projects.find((x) => String(x.n) === q || x.name.toLowerCase().startsWith(q) || x.name.toLowerCase().includes(q));
        if (!p) return line(`open: no project matches “${q}”. Try projects.`, "term__err");
        line(["Opening ", { href: p.url, text: p.name }, "…"]);
        openUrl(p.url);
      },
      ls() {
        line([hl("projects/  "), "stack.txt  contact.txt  resume.pdf"]);
      },
      cat(args) {
        const f = (args[0] || "").toLowerCase();
        if (f === "stack.txt") return COMMANDS.stack();
        if (f === "contact.txt") return COMMANDS.contact();
        if (f === "resume.pdf") return line(dim("cat: resume.pdf is a binary file. Try resume."));
        line(`cat: ${f || "?"}: No such file`, "term__err");
      },
      stack() {
        line(stack.join(" · "));
      },
      contact() {
        line(["email     ", { href: "mailto:" + EMAIL, text: EMAIL }]);
        line(["github    ", { href: "https://github.com/" + GH_USER, text: "github.com/" + GH_USER }]);
        line(["linkedin  ", { href: "https://www.linkedin.com/in/zakinazzal/", text: "linkedin.com/in/zakinazzal" }]);
      },
      email() { copyEmail(); line(dim("Copied " + EMAIL + " to your clipboard.")); },
      resume() { line(dim("Downloading Zaki-Nazzal-Resume.pdf…")); downloadResume(); },
      github() { line(["Opening ", { href: "https://github.com/" + GH_USER, text: "github.com/" + GH_USER }]); openUrl("https://github.com/" + GH_USER); },
      date() {
        const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", weekday: "long", hour: "2-digit", minute: "2-digit" });
        line(fmt.format(new Date()) + dim(" — Amman (UTC+3)").text);
      },
      git(args) {
        if (args[0] !== "log") return line(dim("Only git log works here."));
        const wait = line(dim("Fetching github.com/" + GH_USER + "…"));
        githubEvents().then((events) => {
          wait.remove();
          if (!events.length) return line(dim("No public activity lately."));
          events.slice(0, 6).forEach((ev) => {
            const d = describe(ev);
            line([hl(ago(ev.created_at).padEnd(16, " ")), `${d.verb} ${d.repo}`, d.msg ? dim("  " + d.msg) : ""]);
          });
        }).catch(() => { wait.remove(); line("git: couldn't reach GitHub right now.", "term__err"); });
      },
      echo(args) { line(args.join(" ")); },
      clear() { body.textContent = ""; },
      exit() { line(dim("There's no leaving. Try contact instead.")); },
      sudo(args) {
        if (args.join(" ") === "hire-me" || args.join(" ") === "hire me") {
          line(dim("[sudo] password for recruiter: ••••••••"));
          setTimeout(() => {
            line(["Access granted. ", hl("Opening a draft email…")]);
            window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Let's work together")}`;
          }, 700);
          return;
        }
        line(dim("Nice try. (Hint: sudo hire-me)"));
      },
    };
    COMMANDS.whois = COMMANDS.whoami;
    COMMANDS.about = COMMANDS.whoami;

    const history = [];
    let hIdx = 0;

    function exec(raw) {
      const cmd = raw.trim();
      echo(cmd);
      if (!cmd) return;
      history.push(cmd);
      hIdx = history.length;
      const [name, ...args] = cmd.split(/\s+/);
      const fn = COMMANDS[name.toLowerCase()];
      if (fn) fn(args);
      else line([`zsh: command not found: ${name}. `, dim("Type help.")], "term__err");
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      exec(input.value);
      input.value = "";
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" && history.length) {
        e.preventDefault();
        hIdx = Math.max(hIdx - 1, 0);
        input.value = history[hIdx];
      } else if (e.key === "ArrowDown" && history.length) {
        e.preventDefault();
        hIdx = Math.min(hIdx + 1, history.length);
        input.value = history[hIdx] || "";
      } else if (e.key === "Tab") {
        const v = input.value.trim().toLowerCase();
        const hit = v && Object.keys(COMMANDS).find((c) => c.startsWith(v));
        if (hit) { e.preventDefault(); input.value = hit + " "; }
      }
    });

    $("#term").addEventListener("click", (e) => {
      if (!e.target.closest("a") && !window.getSelection().toString()) input.focus({ preventScroll: true });
    });

    // once it scrolls into view, type the first command
    const intro = () => {
      const cmd = "whoami";
      if (reduceMotion) { exec(cmd); line(["Type ", hl("help"), " to see what else this does."]); return; }
      let i = 0;
      const tick = () => {
        input.value = cmd.slice(0, ++i);
        if (i < cmd.length) setTimeout(tick, 90 + Math.random() * 70);
        else setTimeout(() => {
          input.value = "";
          exec(cmd);
          line(["Type ", hl("help"), " to see what else this does."]);
        }, 350);
      };
      setTimeout(tick, 400);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { io.disconnect(); intro(); }
    }, { threshold: 0.5 });
    io.observe($("#term"));
  })();
})();
