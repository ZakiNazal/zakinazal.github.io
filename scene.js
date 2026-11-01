/* =========================================================
   scene.js — the fixed WebGL backdrop behind the page.

   No object competing with the copy: the background itself
   moves. Each theme names a palette and a style — "aurora"
   (light curtains) or "liquid" (drifting colour fields) — and
   switching eases every uniform, so themes morph, not cut.
   Scroll drifts and quickens the flow; the pointer adds a
   soft light. Rendered at half resolution: it's all soft.
   ========================================================= */

import * as THREE from "three";

export const THEMES = {
  aurora:   { name: "Aurora",   bg: "#06070a", c: ["#b9a7ff", "#6ee7f9", "#ffd1f2"], mode: 0, light: 0 },
  ocean:    { name: "Ocean",    bg: "#040a12", c: ["#5eead4", "#60a5fa", "#c4b5fd"], mode: 0, light: 0 },
  ember:    { name: "Ember",    bg: "#0b0807", c: ["#ffb36b", "#ff5f7e", "#ffd9a8"], mode: 1, light: 0 },
  daylight: { name: "Daylight", bg: "#f4f1ec", c: ["#b9a2ff", "#7fdcef", "#ffb5d8"], mode: 1, light: 1 },
};

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const current = () => (THEMES[root.dataset.theme] ? root.dataset.theme : "ember");

/* ---------- theme switcher (works without WebGL too) ---------- */
const listeners = [];

function setTheme(id) {
  if (!THEMES[id]) return;
  root.dataset.theme = id;
  try { localStorage.setItem("theme", id); } catch (e) { /* private mode */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES[id].bg);
  listeners.forEach((fn) => fn(id));
}

function mountSwitcher() {
  const group = document.createElement("div");
  group.className = "theme-switch";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Theme");
  for (const [id, t] of Object.entries(THEMES)) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.theme = id;
    b.title = t.name;
    const sw = document.createElement("i");
    sw.style.background = `conic-gradient(from 200deg, ${t.c[0]}, ${t.c[1]}, ${t.c[2]}, ${t.c[0]})`;
    sw.style.boxShadow = `inset 0 0 0 3px ${t.bg}`;
    const label = document.createElement("span");
    label.textContent = t.name;
    b.append(sw, label);
    b.addEventListener("click", () => setTheme(id));
    group.appendChild(b);
  }
  const sync = (id) => group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.theme === id)));
  listeners.push(sync);
  sync(current());

  // sits in the nav, before the call to action
  const cta = document.querySelector(".nav__cta");
  if (cta) {
    const end = document.createElement("div");
    end.className = "nav__end";
    cta.replaceWith(end);
    end.append(group, cta);
  } else {
    document.body.appendChild(group);
  }
}
mountSwitcher();
// the command palette and terminal switch themes through this
window.portfolioTheme = { set: setTheme, get: current, list: THEMES };

/* ---------- shared GLSL: Ashima simplex noise ---------- */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime, uScroll, uVel, uMode, uLight;
  uniform vec2 uRes, uMouse;
  uniform vec3 uBg, uC1, uC2, uC3;
  varying vec2 vUv;
  ${NOISE}

  vec3 tri(float k){
    k = fract(k) * 3.;
    return k < 1. ? mix(uC1, uC2, k) : k < 2. ? mix(uC2, uC3, k - 1.) : mix(uC3, uC1, k - 2.);
  }

  // three curtains of light, rising as the page scrolls
  vec3 aurora(vec2 uv, float t){
    vec3 acc = vec3(0.);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float base = .7 - fi * .12 - uScroll * .28;
      float wave = snoise(vec3(uv.x * .8 + fi * 4.1, t * .05 + fi, fi * 2.)) * .17
                 + snoise(vec3(uv.x * 2.2 - fi, t * .09, fi + 9.)) * .045;
      float y = uv.y - base - wave;
      float rays = .5 + .5 * snoise(vec3(uv.x * 9. + fi * 3., t * .18, fi));
      float band = exp(-y * y * (40. + fi * 14.));
      float tail = step(0., y) * exp(-y * (4.5 + fi)) * .55;
      acc += tri(uv.x * .3 + fi * .33 + t * .012) * (band * (.6 + .4 * rays) + tail * rays) * (1. - fi * .2);
    }
    return acc;
  }

  // four soft colour fields drifting through a warped space
  vec3 liquid(vec2 uv, float t){
    float asp = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * asp, uv.y);
    vec2 w = p + .3 * vec2(snoise(vec3(p * .8, t * .045)), snoise(vec3(p * .8 + 7., t * .045)));
    vec3 acc = vec3(0.);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 c = vec2((.5 + .42 * sin(t * .05 * (1. + fi * .3) + fi * 1.7)) * asp,
                    .5 + .36 * cos(t * .043 * (1. + fi * .2) + fi * 2.3) + (uScroll - .5) * .9 * (fi - 1.5) * .5);
      float d = length(w - c);
      acc += tri(fi * .27 + t * .008) * exp(-d * d * 4.2);
    }
    return acc;
  }

  void main(){
    vec2 uv = vUv;
    float t = uTime;
    float asp = uRes.x / uRes.y;

    vec3 E;
    if (uMode < .01) E = aurora(uv, t);
    else if (uMode > .99) E = liquid(uv, t);
    else E = mix(aurora(uv, t), liquid(uv, t), uMode);

    vec2 d = (uv - uMouse) * vec2(asp, 1.);
    E += uC1 * exp(-dot(d, d) * 9.) * .22;   // light that follows the pointer
    E *= 1. + uVel * .35;                   // scrolling quickens and brightens it

    // dark themes: additive glow with a vignette; light: a tinted wash
    vec3 dark = uBg + E * mix(.62, .3, uMode);   // liquid fills the frame, so it glows less
    dark *= 1. - .35 * smoothstep(.35, 1.1, length((uv - .5) * vec2(asp, 1.) * .9));
    float a = clamp(dot(E, vec3(.333)), 0., 1.);
    vec3 hue = E / max(max(E.r, max(E.g, E.b)), 1e-3);
    vec3 light = mix(uBg, hue * .95 + .05, a * .5);
    vec3 col = mix(dark, light, uLight);

    col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 255.;  // dither
    gl_FragColor = vec4(col, 1.);
  }`;

// hex -> raw sRGB triplet (no colour management: the shader works in display space)
const rgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

function init() {
  const canvas = document.getElementById("stage");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  } catch (e) {
    return; // no WebGL: the page background colour stands in
  }
  renderer.setPixelRatio(0.5);

  const t0 = THEMES[current()];
  const target = { bg: rgb(t0.bg), c1: rgb(t0.c[0]), c2: rgb(t0.c[1]), c3: rgb(t0.c[2]), mode: t0.mode, light: t0.light };
  const u = {
    uTime: { value: 0 }, uScroll: { value: 0 }, uVel: { value: 0 },
    uMode: { value: t0.mode }, uLight: { value: t0.light },
    uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(0.7, 0.6) },
    uBg: { value: target.bg.clone() }, uC1: { value: target.c1.clone() }, uC2: { value: target.c2.clone() }, uC3: { value: target.c3.clone() },
  };
  listeners.push((id) => {
    const t = THEMES[id];
    target.bg = rgb(t.bg); target.c1 = rgb(t.c[0]); target.c2 = rgb(t.c[1]); target.c3 = rgb(t.c[2]);
    target.mode = t.mode; target.light = t.light;
  });

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  scene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    })
  ));

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    u.uRes.value.set(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize);
  resize();

  const mouse = new THREE.Vector2(0.7, 0.6);
  window.addEventListener("pointermove", (e) => {
    mouse.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
  }, { passive: true });

  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const clock = new THREE.Clock();
  let running = true, lastY = window.scrollY, vel = 0, time = 0;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) { clock.getDelta(); requestAnimationFrame(tick); }
  });

  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const y = window.scrollY;
    vel = damp(vel, Math.min(Math.abs(y - lastY) / 40, 1.5), 5, dt);
    lastY = y;
    time += dt * (reduceMotion ? 0.2 : 1) * (1 + vel * 1.5);

    const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    u.uTime.value = time;
    u.uVel.value = vel;
    u.uScroll.value = damp(u.uScroll.value, y / max, 4, dt);
    u.uMouse.value.x = damp(u.uMouse.value.x, mouse.x, 2.5, dt);
    u.uMouse.value.y = damp(u.uMouse.value.y, mouse.y, 2.5, dt);

    // themes morph rather than cut
    const k = 1 - Math.exp(-2.6 * dt);
    u.uBg.value.lerp(target.bg, k);
    u.uC1.value.lerp(target.c1, k);
    u.uC2.value.lerp(target.c2, k);
    u.uC3.value.lerp(target.c3, k);
    u.uMode.value = damp(u.uMode.value, target.mode, 2.2, dt);
    u.uLight.value = damp(u.uLight.value, target.light, 2.6, dt);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(() => {
    tick();
    canvas.classList.add("is-ready");
  });
}

init();
