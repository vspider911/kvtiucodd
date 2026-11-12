import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* 3D-сцена первого экрана и работ.
   Одна и та же лента-плёнка: на первом экране крутится петлёй, при прокрутке раскручивается,
   встаёт в центр и превращается в ленту работ, которая едет вбок (window.__reel из script.js). */

const canvas = document.querySelector('.scene');
const hero = document.querySelector('.hero');
const sticky = canvas.parentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');

const SHOTS = ['zerno', 'tekstura', 'techbox', 'freya'].map(n => `img/works/${n}-d.webp`);

const loadImg = src => new Promise((res, rej) => {
  const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src;
});

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* Плёнка: 4 кадра в ряд, сверху и снизу перфорация.
   Кадр 1024×780 текселей: скриншот 1000×616 по центру, полосы перфорации по 70 px. */
const TEX_FW = 1024, TEX_FH = 780, PERF = 70, GAP = 12;
function filmTexture(imgs) {
  const c = document.createElement('canvas'); c.width = TEX_FW * imgs.length; c.height = TEX_FH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0B0A1E'; ctx.fillRect(0, 0, c.width, c.height);
  // перфорация
  ctx.fillStyle = 'rgba(243,241,255,.16)';
  for (let x = 14; x < c.width; x += 44) {
    ctx.beginPath(); ctx.roundRect(x, 22, 24, 26, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, TEX_FH - 48, 24, 26, 4); ctx.fill();
  }
  imgs.forEach((img, i) => {
    const x = i * TEX_FW + GAP, y = PERF + GAP, w = TEX_FW - GAP * 2, h = TEX_FH - PERF * 2 - GAP * 2;
    const sc = Math.max(w / img.width, h / img.height);
    const sw = w / sc, sh = h / sc;
    ctx.drawImage(img, (img.width - sw) / 2, 0, sw, sh, x, y, w, h);
    ctx.strokeStyle = 'rgba(184,178,255,.35)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/* Лента: в атрибутах — позиция в петле (position), место вдоль ленты (aU) и сторона (aV).
   Длина петли подогнана под длину 4 кадров, чтобы кадры не растягивались ни в петле, ни в ленте. */
const STRIP_W = 2.5;                                  // ширина плёнки (вместе с перфорацией)
const FRAME_LEN = STRIP_W * TEX_FW / TEX_FH;          // длина одного кадра
const STRIP_LEN = FRAME_LEN * 4;
function ribbonGeometry(segs = 480) {
  const P0 = t => new THREE.Vector3(Math.cos(t) * 2.4, Math.sin(2 * t) * 0.6 + Math.sin(t) * 0.5, Math.sin(t) * 1.6);
  let len = 0; for (let i = 0; i < 2000; i++) len += P0((i + 1) / 2000 * Math.PI * 2).distanceTo(P0(i / 2000 * Math.PI * 2));
  const k = STRIP_LEN / len;
  const P = t => P0(t).multiplyScalar(k);
  const pos = [], au = [], av = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, t = u * Math.PI * 2;
    const p = P(t);
    const tan = P(t + 0.001).sub(P(t - 0.001)).normalize();
    const b = new THREE.Vector3().crossVectors(tan, up).normalize();
    const n = new THREE.Vector3().crossVectors(b, tan).normalize();
    const w = n.multiplyScalar(Math.cos(t)).add(b.multiplyScalar(Math.sin(t))).multiplyScalar(STRIP_W / 2);
    pos.push(p.x + w.x, p.y + w.y, p.z + w.z, p.x - w.x, p.y - w.y, p.z - w.z);
    au.push(u, u); av.push(1, -1);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1));
  g.setAttribute('aV', new THREE.Float32BufferAttribute(av, 1));
  g.setIndex(idx);
  return g;
}

async function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-3d');
    return;
  }
  const imgs = await Promise.all(SHOTS.map(loadImg));

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.add(new THREE.AmbientLight(0x8a84ff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, 6, 8); scene.add(key);

  /* ---------- Лента из скриншотов ---------- */
  const film = filmTexture(imgs);
  film.anisotropy = renderer.capabilities.getMaxAnisotropy();
  // Морфинг в вершинном шейдере: петля (position) → дуга ленты работ. Раскручивается от одного конца к другому.
  const ribbonMat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: film }, uMorph: { value: 0 }, uOffset: { value: 0 }, uR: { value: 4.8 },
      uL: { value: STRIP_LEN }, uW: { value: STRIP_W }, uTexShift: { value: 0 }
    },
    vertexShader: /* glsl */`
      attribute float aU; attribute float aV;
      uniform float uMorph, uOffset, uR, uL, uW, uTexShift;
      varying vec2 vUv; varying float vShade;
      void main() {
        float m = clamp(uMorph * 1.7 - aU * 0.7, 0.0, 1.0); m = m * m * (3.0 - 2.0 * m);
        float s = aU * uL - uOffset;
        float phi = s / uR;
        vec3 b = vec3(uR * sin(phi), aV * uW * 0.5, uR * cos(phi) - uR);   // дуга: края уходят в глубину
        vec3 p = mix(position, b, m);
        vUv = vec2(aU + uTexShift, aV * 0.5 + 0.5);
        vShade = mix(1.0, clamp(cos(phi) * 1.6 - 0.55, 0.22, 1.0), m);    // боковые кадры притушены
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; varying vec2 vUv; varying float vShade;
      void main() {
        vec4 c = texture2D(map, vUv);
        gl_FragColor = vec4(c.rgb * 0.92 * vShade, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide
  });
  const ribbon = new THREE.Mesh(ribbonGeometry(), ribbonMat);
  ribbon.frustumCulled = false;
  const pivot = new THREE.Group(); pivot.add(ribbon); scene.add(pivot);

  // Свечение за лентой
  const glowMat = new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color('#FFB547'), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Sprite(glowMat); scene.add(glow);

  /* ---------- Звёздная пыль ---------- */
  const COUNT = innerWidth < 768 ? 260 : 600;
  const pp = new Float32Array(COUNT * 3), pc = new Float32Array(COUNT * 3);
  const cA = new THREE.Color('#FFB547'), cB = new THREE.Color('#B8B2FF');
  for (let i = 0; i < COUNT; i++) {
    pp[i * 3] = (Math.random() - 0.5) * 30; pp[i * 3 + 1] = (Math.random() - 0.5) * 22; pp[i * 3 + 2] = -12 + Math.random() * 14;
    const c = Math.random() < 0.35 ? cA : cB;
    pc[i * 3] = c.r; pc[i * 3 + 1] = c.g; pc[i * 3 + 2] = c.b;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.09, map: dotTexture(), vertexColors: true, transparent: true, opacity: 0.8,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  scene.add(points);

  /* ---------- Вихрь-галактика ---------- */
  const vortexMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uTwist: { value: 0 }, uOpacity: { value: 0 },
      uColA: { value: new THREE.Color('#5A4BE0') },
      uColB: { value: new THREE.Color('#FFB547') }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime, uTwist, uOpacity;
      uniform vec3 uColA, uColB;
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; } return v; }
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float sw = a + 3.2 * log(r + 0.05) - uTime * 0.16 + uTwist;
        vec2 q = vec2(cos(sw), sin(sw)) * (0.6 + r * 1.8);
        float n = fbm(q * 2.2 + uTime * 0.03);
        float arms = 0.5 + 0.5 * sin(sw * 2.0 + n * 2.6);
        float band = smoothstep(0.2, 1.0, arms) * (0.22 + 0.95 * n);
        float fall = pow(1.0 - r, 1.5);
        float hole = smoothstep(0.04, 0.3, r);
        float rim = exp(-pow((r - 0.2) / 0.075, 2.0));
        float v = band * fall * hole * 1.0 + rim * 0.16 * (0.55 + 0.45 * arms);
        vec3 col = mix(uColA, uColB, clamp(0.2 + n * 0.9 + rim * 0.6 - r * 0.35, 0.0, 1.0));
        gl_FragColor = vec4(col * v * uOpacity, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const vortex = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), vortexMat);
  vortex.renderOrder = -1;
  scene.add(vortex);

  /* ---------- Парящие кубы ---------- */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  const cubeMat = new THREE.MeshPhysicalMaterial({ color: 0x0D0B22, metalness: 0.8, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 0.45 });
  const edgeMats = [
    new THREE.LineBasicMaterial({ color: 0xFFB547, transparent: true, opacity: 0.95 }),
    new THREE.LineBasicMaterial({ color: 0xB8B2FF, transparent: true, opacity: 0.85 })
  ];
  const CUBES = innerWidth < 768 ? 6 : 11;
  const cubes = [];
  for (let i = 0; i < CUBES; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(boxGeo, cubeMat));
    g.add(new THREE.LineSegments(edgeGeo, edgeMats[i % 2]));
    const z = -7 + Math.random() * 5;                 // кубы — позади ленты
    const c = {
      g, z,
      size: 0.2 + Math.pow(Math.random(), 2) * 0.8,
      R: 5.5 + Math.random() * 5,
      a0: Math.random() * Math.PI * 2,
      bob: Math.random() * 6.28,
      spinV: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.9)
    };
    c.speed = 0.06 / (0.4 + c.R * 0.18);
    g.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    cubes.push(c); scene.add(g);
  }

  /* ---------- Раскладка ---------- */
  const layout = { x: 0, y: 0, s: 1, mobile: false };
  function resize() {
    const w = sticky.clientWidth, h = sticky.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    layout.mobile = w < 900 || camera.aspect < 0.85;
    layout.visH = visH; layout.h = h;
    if (layout.mobile) {
      layout.s = Math.min(visW / 6.4, visH * 0.36 / 4.2);
      layout.x = 0; layout.y = visH * 0.2;
    } else {
      layout.s = Math.min(visW * 0.47 / 5.6, visH * 0.86 / 4.2);
      layout.x = visW * 0.24; layout.y = visH * 0.03;
    }
  }
  resize();
  addEventListener('resize', resize);

  /* ---------- Анимация ---------- */
  const heroY = () => -hero.getBoundingClientRect().top;
  const wrapPi = a => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

  let tmx = 0, tmy = 0, mx = 0, my = 0;
  addEventListener('pointermove', e => {
    tmx = (e.clientX / innerWidth) * 2 - 1;
    tmy = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  // Крутить ленту пальцем или мышкой, по нажатию — толчок и вспышка
  let spin = 0, spinVel = 0, dragging = false, lastX = 0, downX = 0, downT = 0, boost = 0;
  canvas.addEventListener('pointerdown', e => {
    dragging = true; lastX = downX = e.clientX; downT = performance.now(); spinVel = 0;
    canvas.classList.add('dragging');
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    spin += dx * 0.008; spinVel = dx * 0.008;
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false; canvas.classList.remove('dragging');
    if (e.type === 'pointerup' && Math.abs(e.clientX - downX) < 6 && performance.now() - downT < 280) { spinVel += 0.18; boost = 1; }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  const clock = new THREE.Clock();
  let ySm = heroY(), texShift = 0;
  let intro = reduceMQ.matches ? 1 : 0;

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    const reduce = reduceMQ.matches;
    const t = reduce ? 20 : clock.elapsedTime;
    const tilt = reduce ? 0 : 1;

    const R = window.__reel || { A: innerHeight * 0.8, M: innerHeight, T: innerHeight * 2.4, k: 0, box: { cx: innerWidth / 2, cy: innerHeight / 2, fw: 600 } };
    const y = heroY();
    ySm += (y - ySm) * (reduce ? 1 : 1 - Math.exp(-dt * 14));
    const pS = Math.min(1, Math.max(0, ySm / R.A));                          // первый экран 0…1
    const mo = reduce ? (y > R.A + R.M * 0.5 ? 1 : 0) : Math.min(1, Math.max(0, (ySm - R.A) / R.M)); // раскручивание
    const e = smooth(Math.min(1, mo * 1.15));                                // перелёт в центр
    if (intro < 1 && !document.documentElement.classList.contains('intro-on')) intro = Math.min(1, intro + dt / 1.4);
    const ie = 1 - Math.pow(1 - intro, 3);
    const out = e;

    mx += (tmx - mx) * (1 - Math.exp(-dt * 4));
    my += (tmy - my) * (1 - Math.exp(-dt * 4));
    if (!dragging) { spin += spinVel; spinVel *= reduce ? 0 : 0.95; }
    boost = Math.max(0, boost - dt * 1.6);
    canvas.style.cursor = mo > 0.3 ? 'default' : '';

    // Петля на первом экране
    const hx = layout.x - mx * 0.3 * tilt, hy = layout.y + Math.sin(t * 0.9) * 0.12 * tilt, hz = -10 * (1 - ie);
    const hs = layout.s * (0.7 + 0.3 * ie) * (1 + pS * 0.25 + Math.sin(boost * Math.PI) * 0.05);
    const hrx = 0.42 + my * 0.18 * tilt + pS * 0.4;
    const hry = wrapPi(t * 0.12 * tilt + pS * 2.2 + spin + mx * 0.25 * tilt - 1.4 * (1 - ie));
    const hrz = -0.34 + pS * 0.25;
    // Лента работ: в центре, кадр размером с рамку подписи (fw px)
    const pxPerWorld = layout.h / layout.visH;
    const rs = R.box.fw / (FRAME_LEN * pxPerWorld);
    const ry = (layout.h / 2 - R.box.cy) / pxPerWorld;
    pivot.position.set(hx + (0 - hx) * e, hy + (ry - hy) * e, hz * (1 - e));
    pivot.scale.setScalar(hs + (rs - hs) * e);
    pivot.rotation.set(hrx * (1 - e) + my * 0.015 * tilt * e, hry * (1 - e) + mx * 0.02 * tilt * e, hrz * (1 - e));

    // кадры едут по петле, к ленте работ встают на место
    if (!reduce) texShift = (t * 0.012) % 1;
    const ts = texShift + (Math.round(texShift) - texShift) * smooth(Math.min(1, mo * 2));
    ribbonMat.uniforms.uTexShift.value = ts;
    ribbonMat.uniforms.uMorph.value = mo;
    ribbonMat.uniforms.uOffset.value = STRIP_LEN * (R.k + 0.5) / 4;           // кадр R.k — в центре
    ribbonMat.uniforms.uR.value = layout.mobile ? 3.6 : 4.8;

    glow.position.set(pivot.position.x, pivot.position.y, pivot.position.z - 3);
    glow.scale.setScalar(layout.s * 15 * (1 + boost * 0.3));
    glowMat.opacity = (0.3 + boost * 0.35) * ie * (1 - out * 0.7);

    points.rotation.y = t * 0.025 * tilt + pS * 0.9 + mo * 0.6;
    points.position.y = pS * 1.5;

    const cx = layout.x * (1 - e), cy = layout.y + (ry - layout.y) * e;
    vortex.position.set(cx - mx * 0.25 * tilt, cy + my * 0.15 * tilt, -7.5 - 9 * (1 - ie));
    vortex.scale.setScalar(layout.s * (layout.mobile ? 46 : 34) * (1 + boost * 0.06));
    vortex.rotation.set(-0.32 + my * 0.05 * tilt, mx * 0.06 * tilt, 0);
    vortexMat.uniforms.uTime.value = t;
    vortexMat.uniforms.uTwist.value = -pS * 2 - mo * 2 - (R.k || 0) * 0.8 - spin * 0.25;
    vortexMat.uniforms.uOpacity.value = ie * (0.8 - out * 0.45 + boost * 0.3);

    for (let i = 0; i < cubes.length; i++) {
      const c = cubes[i];
      const ang = c.a0 + t * c.speed + pS * (0.9 + 2.2 / c.R);
      const depth = (c.z + 7) / 5;
      c.g.position.set(
        cx + Math.cos(ang) * c.R * layout.s * 1.5 - mx * (0.2 + depth * 0.6) * tilt,
        cy + Math.sin(ang) * c.R * 0.62 * layout.s * 1.5 + Math.sin(t * 0.6 + c.bob) * 0.16 * tilt,
        c.z - 9 * (1 - ie)
      );
      c.g.scale.setScalar(c.size * (0.6 + 0.4 * ie));
      if (!reduce) { c.g.rotation.x += c.spinV.x * dt; c.g.rotation.y += c.spinV.y * dt; c.g.rotation.z += c.spinV.z * dt; }
    }

    renderer.render(scene, camera);
  }
  frame();
  document.documentElement.classList.add('has-3d');
  document.documentElement.classList.remove('no-3d');
}

init().catch(err => {
  console.error(err);
  document.documentElement.classList.add('no-3d');
});
