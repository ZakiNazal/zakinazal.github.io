/* =========================================================
   scene.js — the fixed WebGL backdrop behind the page.

   Four soft grey fields drifting through a warped
   space, washed over the paper background. Scroll drifts and
   quickens them; the pointer adds a little light. Rendered at
   half resolution — it's all soft, and that keeps it cheap.
   ========================================================= */

import * as THREE from "three";

const BG = "#f2f2f0";
const COLORS = ["#d4d4d0", "#ecece9", "#c9c9c5"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  uniform float uTime, uScroll, uVel;
  uniform vec2 uRes, uMouse;
  uniform vec3 uBg, uC1, uC2, uC3;
  varying vec2 vUv;
  ${NOISE}

  vec3 tri(float k){
    k = fract(k) * 3.;
    return k < 1. ? mix(uC1, uC2, k) : k < 2. ? mix(uC2, uC3, k - 1.) : mix(uC3, uC1, k - 2.);
  }

  void main(){
    float asp = uRes.x / uRes.y;
    vec2 p = vec2(vUv.x * asp, vUv.y);
    float t = uTime;

    vec2 w = p + .3 * vec2(snoise(vec3(p * .8, t * .045)), snoise(vec3(p * .8 + 7., t * .045)));
    vec3 E = vec3(0.);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 c = vec2((.5 + .42 * sin(t * .05 * (1. + fi * .3) + fi * 1.7)) * asp,
                    .5 + .36 * cos(t * .043 * (1. + fi * .2) + fi * 2.3) + (uScroll - .5) * .9 * (fi - 1.5) * .5);
      float d = length(w - c);
      E += tri(fi * .27 + t * .008) * exp(-d * d * 4.2);
    }

    vec2 m = (vUv - uMouse) * vec2(asp, 1.);
    E += uC1 * exp(-dot(m, m) * 9.) * .22;   // light that follows the pointer
    E *= 1. + uVel * .35;                   // scrolling quickens and brightens it

    // a tinted wash over the paper
    float a = clamp(dot(E, vec3(.333)), 0., 1.);
    vec3 hue = E / max(max(E.r, max(E.g, E.b)), 1e-3);
    vec3 col = mix(uBg, hue * .95 + .05, a * .5);

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

  const u = {
    uTime: { value: 0 }, uScroll: { value: 0 }, uVel: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(0.7, 0.6) },
    uBg: { value: rgb(BG) }, uC1: { value: rgb(COLORS[0]) }, uC2: { value: rgb(COLORS[1]) }, uC3: { value: rgb(COLORS[2]) },
  };

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

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(() => {
    tick();
    canvas.classList.add("is-ready");
  });
}

init();
