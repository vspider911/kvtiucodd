import * as THREE from 'three';

/* Фон всей страницы как одна анимация:
   1) живой дым, меняет цвет под раздел;
   2) рой частиц, перетекает из фигуры в фигуру при прокрутке;
   3) световая волна: на стыке разделов через экран проходит светящаяся волна-шторка. */

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = innerWidth < 768;
const bgCanvas = document.querySelector('.bg-gl');
const wipeCanvas = document.querySelector('.wipe-gl');
const root = document.documentElement;
const SECTIONS = ['hero', 'works', 'about', 'inside', 'steps', 'contact', 'lead']
  .map(id => document.getElementById(id)).filter(Boolean);

// [глубокий тон дыма, светлые прожилки] для каждого раздела
const PALETTE = [
  ['#15123F', '#FFB547'], ['#22130A', '#FFB547'], ['#17123F', '#B8B2FF'],
  ['#170C38', '#C9A7FF'], ['#260A10', '#FF6A3D'], ['#24160A', '#FFC56E'], ['#110F35', '#B8B2FF']
];

const NOISE = /* glsl */`
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(3.1, 1.7); a *= 0.5; } return v; }
`;
const FULL_VS = /* glsl */`void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/* ---------- Фигуры для роя: рисуем на холсте и берём точки ---------- */
function sample(draw, w, h, n) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
  draw(x, w, h);
  const d = x.getImageData(0, 0, w, h).data, pts = [];
  for (let y = 0; y < h; y += 2) for (let X = 0; X < w; X += 2) if (d[(y * w + X) * 4 + 3] > 128) pts.push(X, y);
  const out = new Float32Array(n * 3), s = 2 / Math.max(w, h);
  for (let i = 0; i < n; i++) {
    const k = ((Math.random() * pts.length / 2) | 0) * 2;
    out[i * 3] = (pts[k] - w / 2) * s + (Math.random() - 0.5) * s * 3;
    out[i * 3 + 1] = -(pts[k + 1] - h / 2) * s + (Math.random() - 0.5) * s * 3;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
  }
  return out;
}
function galaxy(n) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const arm = i % 3, r = Math.pow(Math.random(), 0.7) * 1.05;
    const a = arm * 2.094 + r * 4.2 + (Math.random() - 0.5) * 0.6;
    out[i * 3] = Math.cos(a) * r; out[i * 3 + 1] = Math.sin(a) * r * 0.55; out[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  return out;
}
const SHAPES = n => [
  galaxy(n),
  sample((x) => {           // монитор и телефон
    x.lineWidth = 16; x.strokeRect(40, 40, 440, 280); x.fillRect(220, 330, 80, 40); x.fillRect(170, 366, 180, 14);
    x.lineWidth = 10; [[80, 90, 260], [80, 130, 180], [80, 250, 120]].forEach(([a, b, c]) => { x.beginPath(); x.moveTo(a, b); x.lineTo(a + c, b); x.stroke(); });
    x.fillRect(80, 175, 150, 50);
    x.lineWidth = 14; x.strokeRect(460, 150, 130, 240); x.fillRect(485, 330, 80, 30);
  }, 640, 420, n),
  sample((x, w, h) => { x.font = '800 170px Unbounded'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('kvtiucodd', w / 2, h / 2 + 6); }, 1100, 260, n),
  sample((x) => {           // сетка онлайн-записи
    x.lineWidth = 12;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const X = 30 + c * 140, Y = 30 + r * 120;
      if (r === 1 && c === 2) x.fillRect(X, Y, 110, 90); else x.strokeRect(X, Y, 110, 90);
      if ((r + c) % 3 === 0 && !(r === 1 && c === 2)) { x.beginPath(); x.moveTo(X + 15, Y + 45); x.lineTo(X + 95, Y + 45); x.stroke(); }
    }
  }, 600, 400, n),
  sample((x, w, h) => { x.font = '800 230px Unbounded'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('1 2 3', w / 2, h / 2 + 10); }, 900, 300, n),
  sample((x) => {           // бумажный самолётик
    x.beginPath(); x.moveTo(30, 200); x.lineTo(560, 30); x.lineTo(400, 380); x.lineTo(300, 260); x.closePath(); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.lineWidth = 14;
    x.beginPath(); x.moveTo(300, 260); x.lineTo(560, 30); x.stroke();
  }, 600, 410, n),
  sample((x) => { x.lineWidth = 70; x.beginPath(); x.moveTo(60, 230); x.lineTo(200, 360); x.lineTo(480, 60); x.stroke(); }, 540, 420, n)
];

async function init() {
  const make = cv => { try { return new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, premultipliedAlpha: true }); } catch (e) { return null; } };
  const renderer = make(bgCanvas);
  if (!renderer) return;
  const wipeR = reduce ? null : make(wipeCanvas);
  await document.fonts.load('800 170px Unbounded', 'kvtiucodd 123').catch(() => {});

  const BG_DPR = mobile ? 0.5 : 0.75;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * BG_DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  if (wipeR) wipeR.setPixelRatio(Math.min(devicePixelRatio, 2) * (mobile ? 0.6 : 0.8));

  /* ---------- Дым ---------- */
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uDeep: { value: new THREE.Color(PALETTE[1][0]) }, uWisp: { value: new THREE.Color(PALETTE[1][1]) }, uFlow: { value: 0 } },
    vertexShader: FULL_VS,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime, uFlow; uniform vec2 uRes; uniform vec3 uDeep, uWisp;
      ${NOISE}
      void main() {
        vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
        vec2 q = vec2(fbm(p * 1.5 + uTime * 0.035), fbm(p * 1.5 + vec2(5.2, 1.3) - uTime * 0.03));
        vec2 r = vec2(fbm(p * 1.7 + 2.0 * q + vec2(1.7, 9.2) + uFlow), fbm(p * 1.7 + 2.0 * q + vec2(8.3, 2.8) - uFlow * 0.6));
        float f = fbm(p * 1.3 + 2.3 * r);
        vec3 base = vec3(0.0030, 0.0027, 0.0091);   // #0A0918 в линейном цвете
        vec3 col = mix(base, uDeep, smoothstep(0.25, 0.85, f) * 0.95);
        col = mix(col, uWisp, smoothstep(0.68, 1.0, f) * 0.09);
        col *= 0.7 + 0.3 * smoothstep(1.3, 0.2, length(p));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), smokeMat);
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* ---------- Рой частиц ---------- */
  const N = mobile ? 1800 : 4200;
  const shapes = SHAPES(N);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N);
  const cA = new THREE.Color('#FFB547'), cB = new THREE.Color('#B8B2FF'), cW = new THREE.Color('#FFF3DC');
  for (let i = 0; i < N; i++) {
    const r = Math.random(), c = r < 0.45 ? cA : r < 0.85 ? cB : cW;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; seed[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: (mobile ? 3.2 : 3.6) * renderer.getPixelRatio() * 1.6 }, uAlpha: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aSeed; varying vec3 vCol; varying float vTw;
      uniform float uSize, uTime;
      void main() {
        vCol = color; vTw = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 40.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * (0.6 + aSeed * 0.8) * (3.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vTw; uniform float uAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vCol * a * vTw * uAlpha, a * uAlpha);
      }`,
    vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
  });
  const swarm = new THREE.Points(pGeo, pMat);
  const pScene = new THREE.Scene(); pScene.add(swarm);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 20); cam.position.z = 3;

  /* ---------- Прожиг ---------- */
  /* ---------- Световая волна на стыке разделов ---------- */
  let wipeMat, wipeScene;
  if (wipeR) {
    wipeMat = new THREE.ShaderMaterial({
      uniforms: { uIn: { value: 0 }, uOut: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uDir: { value: 1 } },
      vertexShader: FULL_VS,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform float uIn, uOut, uTime, uDir; uniform vec2 uRes;
        ${NOISE}
        void main() {
          vec2 uv = gl_FragCoord.xy / uRes;
          float x = uv.x, y = uv.y;
          // волнистая кромка: две синусоиды и немного шума, всё живое
          float wave = sin(x * 7.5 + uTime * 1.7) * 0.03 + sin(x * 16.0 - uTime * 2.4) * 0.012 + (noise(vec2(x * 5.0, uTime * 0.6)) - 0.5) * 0.04;
          float a, d;
          if (uOut <= 0.0) { float L = uIn * 1.22 - 0.11 + wave; a = smoothstep(L + 0.003, L - 0.003, y); d = y - L; }
          else             { float L = uOut * 1.22 - 0.11 + wave; a = smoothstep(L - 0.003, L + 0.003, y); d = y - L; }
          vec3 lilac = vec3(0.48, 0.45, 1.0), amber = vec3(1.0, 0.46, 0.06);
          vec3 edge = mix(lilac, amber, smoothstep(0.1, 0.9, x + sin(uTime * 0.8) * 0.15));
          float core = exp(-pow(d / 0.006, 2.0));
          float halo = exp(-pow(d / 0.05, 2.0)) * 0.55;
          // шторка: тёмная, с лёгкими вертикальными бликами
          float streak = smoothstep(0.75, 1.0, noise(vec2(x * 60.0, y * 2.0 + uTime))) * 0.06;
          vec3 cover = vec3(0.003, 0.0027, 0.009) + edge * (streak + exp(-abs(d) * 9.0) * 0.12);
          vec3 col = cover * a + edge * (core * 1.6 + halo) + vec3(1.0) * core * 0.35;
          float alpha = clamp(max(a, core + halo * 0.7), 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }`,
      transparent: true, depthTest: false, depthWrite: false
    });
    wipeScene = new THREE.Scene(); wipeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), wipeMat));
  }

  /* ---------- Размеры ---------- */
  const lay = { x: 0, y: 0, s: 1, a: 0.8 };
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    const b = renderer.getDrawingBufferSize(new THREE.Vector2()); smokeMat.uniforms.uRes.value.copy(b);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    const visH = 2 * cam.position.z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), visW = visH * cam.aspect;
    if (w < 900) { lay.x = 0; lay.y = visH * 0.12; lay.s = Math.min(visW * 0.44, visH * 0.26); lay.a = 0.32; }
    else { lay.x = visW * 0.2; lay.y = 0; lay.s = Math.min(visW * 0.24, visH * 0.38); lay.a = 0.42; }
    if (wipeR) { wipeR.setSize(w, h, false); wipeMat.uniforms.uRes.value.copy(wipeR.getDrawingBufferSize(new THREE.Vector2())); }
  }
  resize(); addEventListener('resize', resize);

  /* ---------- Где мы на странице ---------- */
  // s: 0…(разделов−1) — сколько стыков пройдено (дробно); k: индекс активного стыка и его прогресс
  const where = () => {
    const vh = innerHeight; let s = 0, k = -1, q = 0;
    for (let i = 1; i < SECTIONS.length; i++) {
      const top = SECTIONS[i].getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (vh - top) / vh));
      s += p;
      if (p > 0 && p < 1) { k = i; q = p; }
    }
    return { s, k, q };
  };
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const cDeep = new THREE.Color(), cWisp = new THREE.Color(), tmpA = new THREE.Color(), tmpB = new THREE.Color();

  const clock = new THREE.Clock();
  let sS = where().s, fade = 0, wipeVisible = false;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = reduce ? 10 : clock.elapsedTime;
    const w = where();
    sS += (w.s - sS) * (reduce ? 1 : 1 - Math.exp(-dt * 8));
    const a = Math.min(SECTIONS.length - 1, Math.floor(sS)), b = Math.min(SECTIONS.length - 1, a + 1), m = sS - a;

    // дым
    tmpA.set(PALETTE[a][0]); tmpB.set(PALETTE[b][0]); cDeep.copy(tmpA).lerp(tmpB, m);
    tmpA.set(PALETTE[a][1]); tmpB.set(PALETTE[b][1]); cWisp.copy(tmpA).lerp(tmpB, m);
    smokeMat.uniforms.uDeep.value.copy(cDeep); smokeMat.uniforms.uWisp.value.copy(cWisp);
    smokeMat.uniforms.uTime.value = t; smokeMat.uniforms.uFlow.value = sS * 0.6;

    // рой: с каждого стыка перетекает в следующую фигуру, посередине разлетается
    const A = shapes[a], B = shapes[b], burst = Math.sin(Math.PI * m) * (reduce ? 0 : 1);
    for (let i = 0; i < N; i++) {
      const j = i * 3, sd = seed[i];
      const e = smooth(Math.min(1, Math.max(0, m * 1.5 - sd * 0.5)));
      const sw = reduce ? 0 : 0.012;
      pos[j] = A[j] + (B[j] - A[j]) * e + Math.sin(t * 0.9 + sd * 30) * sw + Math.cos(sd * 61) * burst * 0.55;
      pos[j + 1] = A[j + 1] + (B[j + 1] - A[j + 1]) * e + Math.cos(t * 0.8 + sd * 20) * sw + Math.sin(sd * 47) * burst * 0.45;
      pos[j + 2] = A[j + 2] + (B[j + 2] - A[j + 2]) * e + Math.sin(sd * 13) * burst * 0.6;
    }
    pGeo.attributes.position.needsUpdate = true;
    swarm.position.set(lay.x, lay.y, 0);
    swarm.scale.setScalar(lay.s);
    swarm.rotation.y = reduce ? 0 : Math.sin(t * 0.3) * 0.25;
    swarm.rotation.x = reduce ? 0 : Math.cos(t * 0.23) * 0.12;
    // на первом экране рой прячется (там своя 3D-сцена), дальше проявляется
    fade = Math.min(1, Math.max(0, (sS - 1.3) * 1.6));   // рой — с «Обо мне», на первом экране и в работах своя лента
    pMat.uniforms.uAlpha.value = lay.a * fade; pMat.uniforms.uTime.value = t;

    renderer.clear();
    renderer.render(quadScene, ortho);
    renderer.render(pScene, cam);

    // световая волна на стыке: q 0.12…0.88 → шторка поднимается, закрывает экран и уходит вверх
    if (wipeR) {
      const r = w.k > 0 && !('nowipe' in SECTIONS[w.k].dataset) ? Math.min(1, Math.max(0, (w.q - 0.12) / 0.76)) : 0;
      const on = r > 0 && r < 1;
      if (on !== wipeVisible) { wipeCanvas.style.visibility = on ? 'visible' : 'hidden'; wipeVisible = on; }
      if (on) {
        wipeMat.uniforms.uIn.value = r < 0.5 ? r * 2 : 1;
        wipeMat.uniforms.uOut.value = r < 0.5 ? 0 : (r - 0.5) * 2;
        wipeMat.uniforms.uTime.value = t;
        wipeR.render(wipeScene, ortho);
      }
    }
  }
  frame();
  root.classList.add('has-bg');
}

init().catch(err => console.error(err));
