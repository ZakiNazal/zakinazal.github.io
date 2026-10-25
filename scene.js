/* =========================================================
   scene.js — the fixed WebGL stage behind the page.

   An iridescent, noise-displaced blob, a particle field that
   morphs between a sphere and a spiral galaxy, and a few orbit
   rings. Each section names a pose; the scene eases toward the
   pose of whichever section holds the middle of the viewport.
   Scroll speed and the pointer feed the distortion.
   ========================================================= */

import * as THREE from "three";

const canvas = document.getElementById("stage");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isSmall = () => window.innerWidth < 760;

// Poses per section. x/y are in world units, morph 0 = sphere, 1 = galaxy,
// dim darkens the blob where it sits behind text. `anchor` pins the pose to an
// element's centre instead of fixed coordinates.
const POSES = {
  top:      { x: 1.55, y: 0.15, s: 1.0,  morph: 0.0,  distort: 1.0, hue: 0.0,  ring: 1.0, dim: 0.0 },
  work:     { x: 2.9,  y: -0.6, s: 0.55, morph: 1.0,  distort: 0.6, hue: 0.18, ring: 0.3, dim: 0.2 },
  stack:    { x: 2.2,  y: -1.0, s: 0.42, morph: 0.55, distort: 1.4, hue: 0.42, ring: 1.0, dim: 0.0, anchor: "#sphere" },
  timeline: { x: 3.05, y: 0.15, s: 0.45, morph: 1.0,  distort: 0.7, hue: 0.6,  ring: 0.2, dim: 0.0 },
  about:    { x: 3.0,  y: 0.5,  s: 0.55, morph: 0.3,  distort: 0.9, hue: 0.78, ring: 0.6, dim: 0.0 },
  contact:  { x: 0.0,  y: 0.1,  s: 0.95, morph: 0.0,  distort: 1.5, hue: 0.95, ring: 1.0, dim: 0.6 },
};
// Phones: one column of text everywhere, so the blob goes above the hero copy
// and parks, dimmed, in the top corner for the rest of the page.
const SMALL_POSES = {
  top:     { x: 0.2, y: 2.35, s: 0.62 },
  contact: { x: 0,   y: 0.4,  s: 0.75, dim: 0.65 },
  default: { x: 1.9, y: 3.0,  s: 0.5,  dim: 0.45 },
};

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

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return; // no WebGL — the page stands on its own without the stage
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 8);

  const root = new THREE.Group(); // pose transforms apply here
  scene.add(root);

  /* ---------- blob ---------- */
  const blobUniforms = {
    uTime: { value: 0 },
    uDistort: { value: 1 },
    uKick: { value: 0 },
    uHue: { value: 0 },
    uDim: { value: 0 },
    uMouse: { value: new THREE.Vector2() },
  };

  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.25, isSmall() ? 40 : 64),
    new THREE.ShaderMaterial({
      uniforms: blobUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime, uDistort, uKick;
        uniform vec2 uMouse;
        varying vec3 vPos;
        varying vec3 vView;
        varying float vNoise;
        ${NOISE}
        void main(){
          vec3 p = position;
          float t = uTime * 0.28;
          // two octaves: slow swell plus finer ripples that speed up with scroll
          float n = snoise(p * 0.9 + vec3(t, t * 0.6, -t) + vec3(uMouse * 0.6, 0.));
          float r = snoise(p * 2.6 - vec3(t * 2.0)) * (0.12 + uKick * 0.25);
          float d = (n * 0.32 + r) * uDistort;
          p += normal * d;
          vNoise = n;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          vPos = mv.xyz;
          vView = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uHue, uDim;
        varying vec3 vPos;
        varying vec3 vView;
        varying float vNoise;
        // Inigo Quilez cosine palette
        vec3 pal(float t){
          vec3 a=vec3(.55,.5,.65), b=vec3(.45,.4,.45), c=vec3(1.), d=vec3(.70,.85,.0);
          return a + b * cos(6.28318 * (c * t + d));
        }
        void main(){
          vec3 nrm = normalize(cross(dFdx(vPos), dFdy(vPos)));
          vec3 v = normalize(vView);
          float fres = pow(1. - max(dot(nrm, v), 0.), 2.2);
          float t = dot(nrm, vec3(.4, .6, .3)) * .5 + vNoise * .35 + uTime * .03 + uHue;
          vec3 col = pal(t);
          col = mix(col * .35, col, smoothstep(-.4, .9, nrm.y * .5 + .5));
          col += fres * vec3(.75, .7, 1.) * 1.1;
          // soft key light
          float spec = pow(max(dot(reflect(-v, nrm), normalize(vec3(.5, .8, .6))), 0.), 24.);
          col += spec * .55;
          col *= 1. - uDim * .75;
          gl_FragColor = vec4(col, .92 - uDim * .35);
        }`,
      transparent: true,
    })
  );
  root.add(blob);

  /* ---------- particles: sphere <-> galaxy ---------- */
  const COUNT = isSmall() ? 3500 : 7000;
  const sphere = new Float32Array(COUNT * 3);
  const galaxy = new Float32Array(COUNT * 3);
  const rand = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    // sphere shell
    const u = Math.random(), v = Math.random();
    const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
    const r = 2.1 + Math.pow(Math.random(), 3) * 2.4;
    sphere[i * 3] = r * Math.sin(ph) * Math.cos(th);
    sphere[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    sphere[i * 3 + 2] = r * Math.cos(ph);
    // three-armed spiral
    const arm = (i % 3) * ((Math.PI * 2) / 3);
    const gr = Math.pow(Math.random(), 0.7) * 5.2 + 0.4;
    const spin = gr * 0.9;
    const scatter = (Math.random() - 0.5) * (0.35 + gr * 0.12);
    galaxy[i * 3] = Math.cos(arm + spin) * gr + scatter;
    galaxy[i * 3 + 1] = (Math.random() - 0.5) * 0.3 * (1.2 - gr / 6);
    galaxy[i * 3 + 2] = Math.sin(arm + spin) * gr + (Math.random() - 0.5) * (0.35 + gr * 0.12);
    rand[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(sphere, 3));
  pGeo.setAttribute("aGalaxy", new THREE.BufferAttribute(galaxy, 3));
  pGeo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));

  const pUniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uPixel: { value: renderer.getPixelRatio() },
    uHue: { value: 0 },
  };
  const points = new THREE.Points(
    pGeo,
    new THREE.ShaderMaterial({
      uniforms: pUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime, uMorph, uPixel;
        attribute vec3 aGalaxy;
        attribute float aRand;
        varying float vRand;
        varying float vDepth;
        ${NOISE}
        void main(){
          // stagger the morph per particle so it reads as a flow, not a cross-fade
          float m = smoothstep(aRand * .45, .55 + aRand * .45, uMorph);
          vec3 g = aGalaxy;
          float a = uTime * (.05 + .1 / (length(g.xz) + .5));
          g.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * g.xz;
          vec3 p = mix(position, g, m);
          p += .12 * vec3(
            snoise(p * .5 + uTime * .1),
            snoise(p * .5 + 13. + uTime * .1),
            snoise(p * .5 + 27. + uTime * .1));
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_Position = projectionMatrix * mv;
          float tw = .6 + .4 * sin(uTime * 2. + aRand * 40.);
          gl_PointSize = (1.2 + aRand * 2.6) * tw * uPixel * (7. / -mv.z);
          vRand = aRand;
          vDepth = -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uHue;
        varying float vRand;
        varying float vDepth;
        void main(){
          float d = length(gl_PointCoord - .5);
          float a = smoothstep(.5, .0, d);
          vec3 c1 = vec3(.73, .65, 1.), c2 = vec3(.43, .91, .98), c3 = vec3(1., .82, .95);
          float k = fract(vRand + uHue);
          vec3 col = k < .5 ? mix(c1, c2, k * 2.) : mix(c2, c3, (k - .5) * 2.);
          gl_FragColor = vec4(col, a * .75 * smoothstep(16., 5., vDepth));
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  points.rotation.x = 0.35;
  root.add(points);

  /* ---------- orbit rings ---------- */
  const rings = new THREE.Group();
  const ringMat = new THREE.LineBasicMaterial({ color: 0xb9a7ff, transparent: true, opacity: 0.22 });
  [[1.9, 0.6, 0.2], [2.3, -0.9, 0.7], [2.75, 0.25, -0.5]].forEach(([r, rx, rz]) => {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.36, 0));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
    line.rotation.set(rx, 0, rz);
    rings.add(line);
  });
  root.add(rings);

  /* ---------- input ---------- */
  const mouse = new THREE.Vector2();
  const mouseEased = new THREE.Vector2();
  window.addEventListener("pointermove", (e) => {
    mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  }, { passive: true });

  let lastY = window.scrollY;
  let velocity = 0;

  const sections = Object.keys(POSES).map((id) => document.getElementById(id)).filter(Boolean);
  const { anchor: _a, ...current } = POSES.top;
  let targetId = "top";

  // Page-space boxes, measured only when layout changes. Reading
  // getBoundingClientRect inside the render loop forced a layout every frame.
  let boxes = [];
  let anchorBoxes = {};
  function measure() {
    const sy = window.scrollY;
    boxes = sections.map((s) => {
      const r = s.getBoundingClientRect();
      return { id: s.id, top: r.top + sy, bottom: r.bottom + sy };
    });
    anchorBoxes = {};
    for (const id in POSES) {
      const el = POSES[id].anchor && document.querySelector(POSES[id].anchor);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      anchorBoxes[id] = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 + sy };
    }
  }
  measure();
  new ResizeObserver(measure).observe(document.body);
  window.addEventListener("load", measure);

  function pickPose() {
    const mid = window.scrollY + window.innerHeight / 2;
    for (const b of boxes) {
      if (b.top <= mid && b.bottom >= mid) {
        targetId = b.id;
        return;
      }
    }
  }

  // Resolve the pose to aim for this frame: phone overrides, then anchoring.
  function resolvePose() {
    const base = POSES[targetId];
    const pose = isSmall() ? { ...base, ...(SMALL_POSES[targetId] || SMALL_POSES.default) } : { ...base };
    const a = anchorBoxes[targetId];
    if (a) {
      // unproject the element's centre onto the z = 0 plane
      const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const halfW = halfH * camera.aspect;
      pose.x = (a.cx / window.innerWidth * 2 - 1) * halfW;
      pose.y = -((a.cy - window.scrollY) / window.innerHeight * 2 - 1) * halfH;
      pose.dim = 0;
      if (isSmall()) pose.s = 0.42;
    }
    return pose;
  }

  /* ---------- resize ---------- */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the scene's width roughly constant on narrow screens
    camera.position.z = w / h < 1 ? 8 / Math.max(w / h, 0.55) * 0.8 : 8;
    camera.updateProjectionMatrix();
    pUniforms.uPixel.value = renderer.getPixelRatio();
  }
  window.addEventListener("resize", resize);
  resize();

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) {
      clock.getDelta();
      requestAnimationFrame(tick);
    }
  });

  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  let time = 0;

  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt * (reduceMotion ? 0.15 : 1);

    // scroll velocity, normalised and decayed
    const y = window.scrollY;
    velocity = damp(velocity, Math.min(Math.abs(y - lastY) / 40, 1.5), 6, dt);
    lastY = y;

    pickPose();
    const pose = resolvePose();
    // anchored poses follow their element closely; the rest glide
    const follow = pose.anchor ? 6 : 2.2;
    for (const k in current) current[k] = damp(current[k], pose[k], k === "x" || k === "y" ? follow : 2.2, dt);

    mouseEased.x = damp(mouseEased.x, mouse.x, 3, dt);
    mouseEased.y = damp(mouseEased.y, mouse.y, 3, dt);

    root.position.set(current.x, current.y, 0);
    root.scale.setScalar(current.s);

    blob.rotation.y = time * 0.12 + mouseEased.x * 0.5;
    blob.rotation.x = mouseEased.y * -0.35;
    blobUniforms.uTime.value = time;
    blobUniforms.uDistort.value = current.distort;
    blobUniforms.uKick.value = velocity;
    blobUniforms.uHue.value = current.hue;
    blobUniforms.uDim.value = current.dim;
    blobUniforms.uMouse.value.copy(mouseEased);

    pUniforms.uTime.value = time;
    pUniforms.uMorph.value = current.morph;
    pUniforms.uHue.value = current.hue;
    points.rotation.y = time * 0.03 + mouseEased.x * 0.15;

    rings.rotation.y = time * 0.2;
    rings.rotation.z = time * 0.05;
    ringMat.opacity = 0.22 * current.ring;

    camera.position.x = damp(camera.position.x, mouseEased.x * 0.35, 2, dt);
    camera.position.y = damp(camera.position.y, mouseEased.y * 0.25, 2, dt);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(() => {
    tick();
    canvas.classList.add("is-ready");
  });
}

init();
