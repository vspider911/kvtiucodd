import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.querySelector('.scene');
const stage = document.querySelector('.stage');
const sticky = canvas.parentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');

const BOUNDS = [0, 0.22, 0.48, 0.74];        // совпадает с script.js
const FLIPS = BOUNDS.slice(1);               // где телефон переворачивается
const ACCENTS = ['#FFB547', '#E9A15E', '#E0463A', '#FFC400'];

/* ---------- Экраны телефона (рисуются на canvas) ---------- */
const SW = 640, SH = 1400;

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}

const loadImg = src => new Promise((res, rej) => {
  const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src;
});

function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
function rect(ctx, x, y, w, h, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function txt(ctx, s, x, y, font, color, align = 'left') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
}
function button(ctx, y, bg, fg, label, outline) {
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(48, y, SW - 96, 96, 8); ctx.stroke(); }
  else rect(ctx, 48, y, SW - 96, 96, 8, bg);
  txt(ctx, label, SW / 2, y + 60, '700 32px Manrope', fg, 'center');
}
function statusBar(ctx, color) {
  txt(ctx, '9:41', 56, 70, '700 28px Manrope', color);
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(SW - 108, 48, 52, 26, 6); ctx.stroke();
  rect(ctx, SW - 104, 52, 36, 18, 3, color);
  rect(ctx, SW / 2 - 92, 26, 184, 54, 27, '#000');
}
function shadeTop(ctx, h, a = 0.6) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, h);
}
function fadeTo(ctx, y0, y1, color) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, color + '00'); g.addColorStop(1, color);
  ctx.fillStyle = g; ctx.fillRect(0, y0, SW, y1 - y0);
}
function chip(ctx, x, y, label, bg, fg, dot) {
  ctx.font = '700 24px Manrope';
  const w = ctx.measureText(label).width + (dot ? 58 : 36);
  rect(ctx, x - w, y, w, 48, 8, bg);
  if (dot) { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x - w + 26, y + 24, 7, 0, Math.PI * 2); ctx.fill(); }
  txt(ctx, label, x - 18, y + 33, '700 24px Manrope', fg, 'right');
}

function screenSplash() {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, SW, SH);
  g.addColorStop(0, '#2A2580'); g.addColorStop(1, '#100E30');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
  // мягкое свечение
  const r = ctx.createRadialGradient(SW * 0.8, 260, 10, SW * 0.8, 260, 420);
  r.addColorStop(0, 'rgba(255,181,71,.35)'); r.addColorStop(1, 'rgba(255,181,71,0)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, SW, SH);
  statusBar(ctx, '#F3F1FF');

  txt(ctx, 'Здесь будет', 56, 250, '600 30px Manrope', '#A6A4D2');
  txt(ctx, 'Ваше', 52, 350, '800 84px Unbounded', '#F3F1FF');
  txt(ctx, 'название', 52, 444, '800 84px Unbounded', '#F3F1FF');

  txt(ctx, '★★★★★', 56, 540, '400 34px Manrope', '#FFB547');
  txt(ctx, '4,9  ·  312 оценок', 232, 538, '700 28px Manrope', '#F3F1FF');
  ctx.fillStyle = '#5BE38F'; ctx.beginPath(); ctx.arc(66, 593, 9, 0, Math.PI * 2); ctx.fill();
  txt(ctx, 'Открыто до 21:00', 90, 603, '600 28px Manrope', '#D9D7F5');

  // услуги-заглушки
  const rows = ['от 1 000 ₽', 'от 1 800 ₽', 'от 2 500 ₽'];
  rows.forEach((p, i) => {
    const y = 700 + i * 110;
    rect(ctx, 56, y, 250 - i * 40, 22, 6, 'rgba(243,241,255,.18)');
    rect(ctx, 56, y + 38, 150 + i * 30, 16, 6, 'rgba(243,241,255,.09)');
    txt(ctx, p, SW - 56, y + 30, '700 30px Manrope', '#FFB547', 'right');
    ctx.fillStyle = 'rgba(243,241,255,.1)'; ctx.fillRect(56, y + 82, SW - 112, 2);
  });

  button(ctx, 1110, '#FFB547', '#2A1A00', 'Записаться');
  button(ctx, 1226, null, '#F3F1FF', 'Позвонить', 'rgba(243,241,255,.35)');
  return c;
}

function screenCoffee(img) {
  const BG = '#F3E9DA';
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, SW, SH);
  cover(ctx, img, 0, 0, SW, 700);
  shadeTop(ctx, 260, 0.62);
  fadeTo(ctx, 520, 702, BG);
  statusBar(ctx, '#FFFFFF');
  txt(ctx, 'Зерно', 52, 172, '800 52px Unbounded', '#FFFFFF');
  chip(ctx, SW - 48, 132, 'Открыто', 'rgba(255,255,255,.94)', '#2A1A10', '#2DBE6C');

  txt(ctx, 'Кофе с собой', 52, 770, '700 50px Unbounded', '#2A1A10');
  txt(ctx, 'за 3 минуты', 52, 834, '700 50px Unbounded', '#2A1A10');
  const menu = [['Капучино', '220 ₽'], ['Флэт уайт', '260 ₽'], ['Раф ванильный', '290 ₽']];
  menu.forEach(([n, p], i) => {
    const y = 930 + i * 84;
    txt(ctx, n, 52, y, '600 32px Manrope', '#3A2618');
    txt(ctx, p, SW - 52, y, '800 32px Manrope', '#6B3E26', 'right');
    ctx.fillStyle = '#DCCBB4'; ctx.fillRect(52, y + 28, SW - 104, 2);
  });
  button(ctx, 1190, '#6B3E26', '#F3E9DA', 'Заказать заранее');
  txt(ctx, 'Будет готов к вашему приходу', SW / 2, 1340, '600 26px Manrope', '#8A6F5A', 'center');
  return c;
}

function screenBarber(img) {
  const BG = '#111111';
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, SW, SH);
  cover(ctx, img, 0, 0, SW, 660);
  shadeTop(ctx, 240, 0.55);
  fadeTo(ctx, 440, 662, BG);
  statusBar(ctx, '#FFFFFF');
  txt(ctx, 'СТАЛЬ', 52, 172, '800 52px Unbounded', '#FFFFFF');
  chip(ctx, SW - 48, 132, '★ 4,9', '#C8372D', '#FFFFFF');

  txt(ctx, 'Стрижка', 52, 720, '700 58px Unbounded', '#FFFFFF');
  txt(ctx, 'и борода', 52, 790, '700 58px Unbounded', '#FFFFFF');
  txt(ctx, 'Свободно сегодня', 52, 872, '600 28px Manrope', '#9A9A9A');

  const T = ['11:00', '12:30', '14:00', '15:30', '17:00', '18:30', '19:00', '20:00', '21:00'];
  const busy = new Set([1, 3, 4, 7]); const sel = 5;
  const cw = (SW - 104 - 32) / 3;
  T.forEach((t, i) => {
    const x = 52 + (i % 3) * (cw + 16), y = 900 + Math.floor(i / 3) * 92;
    if (i === sel) rect(ctx, x, y, cw, 76, 8, '#C8372D');
    else if (!busy.has(i)) rect(ctx, x, y, cw, 76, 8, '#232323');
    else { ctx.strokeStyle = '#2E2E2E'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, cw, 76, 8); ctx.stroke(); }
    const col = busy.has(i) ? '#555555' : '#FFFFFF';
    txt(ctx, t, x + cw / 2, y + 49, '700 30px Manrope', col, 'center');
    if (busy.has(i)) { ctx.fillStyle = '#555555'; ctx.fillRect(x + cw / 2 - 44, y + 38, 88, 3); }
  });
  button(ctx, 1200, '#C8372D', '#FFFFFF', 'Записаться на 18:30');
  txt(ctx, 'Мастер: Артём', SW / 2, 1346, '600 26px Manrope', '#8A8A8A', 'center');
  return c;
}

function screenAuto(img) {
  const BG = '#16181C', Y = '#FFC400';
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, SW, SH);
  cover(ctx, img, 0, 0, SW, 640);
  shadeTop(ctx, 260, 0.65);
  fadeTo(ctx, 420, 642, BG);
  statusBar(ctx, '#FFFFFF');
  rect(ctx, 52, 128, 18, 48, 3, Y);
  txt(ctx, 'QuickMade', 84, 172, '800 46px Unbounded', '#FFFFFF');

  txt(ctx, 'Ремонт', 52, 690, '700 54px Unbounded', '#FFFFFF');
  txt(ctx, 'без сюрпризов', 52, 756, '700 54px Unbounded', '#FFFFFF');
  const items = [['Замена масла', '1 500 ₽', 1], ['Диагностика', '900 ₽', 1], ['Колодки', '1 800 ₽', 0], ['Шиномонтаж', '2 400 ₽', 0]];
  items.forEach(([n, p, on], i) => {
    const y = 830 + i * 84;
    if (on) {
      rect(ctx, 52, y, 42, 42, 6, Y);
      ctx.strokeStyle = '#16181C'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(62, y + 22); ctx.lineTo(70, y + 30); ctx.lineTo(85, y + 13); ctx.stroke();
    } else { ctx.strokeStyle = '#4A4E57'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(53, y + 1, 40, 40, 6); ctx.stroke(); }
    txt(ctx, n, 116, y + 32, '600 31px Manrope', on ? '#FFFFFF' : '#8B909A');
    txt(ctx, p, SW - 52, y + 32, '700 31px Manrope', on ? '#FFFFFF' : '#8B909A', 'right');
  });
  ctx.fillStyle = '#2A2D33'; ctx.fillRect(52, 1172, SW - 104, 2);
  txt(ctx, 'Итого от', 52, 1232, '600 30px Manrope', '#8B909A');
  txt(ctx, '2 400 ₽', SW - 52, 1236, '800 46px Unbounded', Y, 'right');
  button(ctx, 1270, Y, '#16181C', 'Записаться в бокс');
  return c;
}

function backTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 1100;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 512, 1100);
  g.addColorStop(0, '#3A3290'); g.addColorStop(0.55, '#221E5E'); g.addColorStop(1, '#16133F');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 1100);
  txt(ctx, 'kvtiucodd', 256, 640, '800 46px Unbounded', 'rgba(255,181,71,.9)', 'center');
  return c;
}

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* ---------- Геометрия ---------- */
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function rrPlane(w, h, r) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 20);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  uv.needsUpdate = true;
  return g;
}

/* ---------- Сцена ---------- */
async function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-3d');
    return;
  }

  const fontText = 'Ваше название Зерно СТАЛЬ QuickMade Ремонт 0123456789₽★';
  await Promise.all([
    document.fonts.load('800 80px Unbounded', fontText),
    document.fonts.load('700 50px Unbounded', fontText),
    document.fonts.load('700 30px Manrope', fontText),
    document.fonts.load('600 30px Manrope', fontText),
    document.fonts.load('800 30px Manrope', fontText)
  ]).catch(() => {});
  const [imgCoffee, imgBarber, imgAuto] = await Promise.all(
    ['img/coffee.webp', 'img/barber.webp', 'img/auto.webp'].map(loadImg)
  );

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
  const rim = new THREE.PointLight(0xB8B2FF, 60, 40); rim.position.set(-6, 4, -4); scene.add(rim);
  const warm = new THREE.PointLight(0xFFB547, 40, 40); warm.position.set(6, -4, 5); scene.add(warm);

  // Текстуры экранов
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const toTex = cnv => {
    const t = new THREE.CanvasTexture(cnv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    return t;
  };
  const screens = [screenSplash(), screenCoffee(imgCoffee), screenBarber(imgBarber), screenAuto(imgAuto)].map(toTex);

  // Телефон
  const W = 3, H = 6.3;
  const pivot = new THREE.Group(); scene.add(pivot);
  const phone = new THREE.Group(); pivot.add(phone);

  const bodyGeo = new THREE.ExtrudeGeometry(rrShape(W - 0.12, H - 0.12, 0.42), {
    depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 6, curveSegments: 28
  });
  bodyGeo.center();
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x2E2A66, metalness: 0.85, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  phone.add(new THREE.Mesh(bodyGeo, bodyMat));

  const glass = new THREE.Mesh(rrPlane(W - 0.1, H - 0.1, 0.44), new THREE.MeshPhysicalMaterial({ color: 0x050510, roughness: 0.15, metalness: 0.2 }));
  glass.position.z = 0.172; phone.add(glass);

  const screenMat = new THREE.MeshBasicMaterial({ map: screens[0], toneMapped: false });
  const screen = new THREE.Mesh(rrPlane(W - 0.26, H - 0.26, 0.34), screenMat);
  screen.position.z = 0.175; phone.add(screen);

  const sheen = new THREE.Mesh(rrPlane(W - 0.1, H - 0.1, 0.44), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.05, metalness: 1, depthWrite: false
  }));
  sheen.position.z = 0.178; phone.add(sheen);

  const backMap = toTex(backTexture());
  const back = new THREE.Mesh(rrPlane(W - 0.1, H - 0.1, 0.44), new THREE.MeshPhysicalMaterial({ map: backMap, metalness: 0.55, roughness: 0.35, clearcoat: 1 }));
  back.position.z = -0.172; back.rotation.y = Math.PI; phone.add(back);

  // Блок камер
  const camBlock = new THREE.Mesh(new RoundedBoxGeometry(1.15, 1.15, 0.1, 4, 0.04), new THREE.MeshPhysicalMaterial({ color: 0x241F55, metalness: 0.7, roughness: 0.25, clearcoat: 1 }));
  camBlock.position.set(0.72, 2.32, -0.22); phone.add(camBlock);
  const lensGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 40);
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x05050c, metalness: 0.4, roughness: 0.05, clearcoat: 1 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x8C86C8, metalness: 1, roughness: 0.25 });
  [[0.48, 2.56], [0.48, 2.08], [0.96, 2.32]].forEach(([x, y]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 40), ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y, -0.27); phone.add(ring);
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.rotation.x = Math.PI / 2; lens.position.set(x, y, -0.29); phone.add(lens);
  });
  // Кнопки сбоку
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x3A3580, metalness: 0.9, roughness: 0.3 });
  [[W / 2 + 0.01, 1.2, 0.8], [-W / 2 - 0.01, 1.6, 0.45], [-W / 2 - 0.01, 0.9, 0.7]].forEach(([x, y, h]) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.06, h, 0.14, 2, 0.025), btnMat);
    b.position.set(x, y, 0); phone.add(b);
  });

  // Свечение за телефоном
  const glowMat = new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(ACCENTS[0]), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Sprite(glowMat); scene.add(glow);

  // Частицы
  const COUNT = innerWidth < 768 ? 260 : 600;
  const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3);
  const cA = new THREE.Color('#FFB547'), cB = new THREE.Color('#B8B2FF');
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
    pos[i * 3 + 2] = -12 + Math.random() * 14;
    const c = Math.random() < 0.35 ? cA : cB;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.09, map: dotTexture(), vertexColors: true, transparent: true, opacity: 0.8,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  scene.add(points);

  /* ---------- «Вселенная»: вихрь-галактика за телефоном ---------- */
  const vortexMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uTwist: { value: 0 }, uOpacity: { value: 0 },
      uColA: { value: new THREE.Color('#5A4BE0') },
      uColB: { value: new THREE.Color(ACCENTS[0]) }
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
        // логарифмическая спираль: чем ближе к центру, тем сильнее закручено
        float sw = a + 3.2 * log(r + 0.05) - uTime * 0.16 + uTwist;
        vec2 q = vec2(cos(sw), sin(sw)) * (0.6 + r * 1.8);
        float n = fbm(q * 2.2 + uTime * 0.03);
        float arms = 0.5 + 0.5 * sin(sw * 2.0 + n * 2.6);
        float band = smoothstep(0.2, 1.0, arms) * (0.22 + 0.95 * n);
        float fall = pow(1.0 - r, 1.5);                       // гаснет к краю
        float hole = smoothstep(0.04, 0.3, r);                // тёмный центр
        float rim = exp(-pow((r - 0.2) / 0.075, 2.0));        // светящийся ободок
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

  /* ---------- Парящие кубы: тёмное стекло со светящимися гранями ---------- */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  const cubeMat = new THREE.MeshPhysicalMaterial({ color: 0x0D0B22, metalness: 0.8, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 0.45 });
  const edgeMats = [
    new THREE.LineBasicMaterial({ color: 0xFFB547, transparent: true, opacity: 0.95 }),
    new THREE.LineBasicMaterial({ color: 0xB8B2FF, transparent: true, opacity: 0.85 })
  ];
  const CUBES = innerWidth < 768 ? 9 : 16;
  const cubes = [];
  for (let i = 0; i < CUBES; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(boxGeo, cubeMat));
    g.add(new THREE.LineSegments(edgeGeo, edgeMats[i % 2]));
    const big = i < 2;                                  // пара крупных у краёв, близко к камере
    const z = big ? 3 + Math.random() * 1.5 : -6 + Math.random() * 8.5;
    const minR = z > -1 ? 5.2 : 2.6;                    // ближние не перекрывают телефон
    const c = {
      g, z,
      size: big ? 1.5 + Math.random() * 0.6 : 0.2 + Math.pow(Math.random(), 2) * 0.85,
      R: big ? 8.2 + i * 1.4 : minR + Math.random() * (9.5 - minR),
      a0: big ? (i ? 2.25 : -0.5) : Math.random() * Math.PI * 2,     // крупные — справа внизу и сверху, не под заголовком
      speed: 0,
      bob: Math.random() * 6.28,
      spinV: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(big ? 0.25 : 0.9)
    };
    c.speed = (big ? 0.012 : 0.06) / (0.4 + c.R * 0.18);   // ближе к центру — быстрее
    g.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    cubes.push(c);
    scene.add(g);
  }

  /* ---------- Раскладка ---------- */
  const layout = { x: 0, y: 0, s: 1, mobile: false };
  function resize() {
    const w = sticky.clientWidth, h = sticky.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    layout.mobile = w < 768 || camera.aspect < 0.85;
    if (layout.mobile) {
      layout.s = Math.min(visH * 0.42 / H, visW * 0.5 / W);
      layout.x = 0;
      layout.y = visH * 0.165;
    } else {
      layout.s = Math.min(visH * 0.66 / H, visW * 0.28 / W);
      layout.x = Math.min(visW * 0.24, visW / 2 - W * layout.s * 0.9);
      layout.y = -visH * 0.01;
    }
  }
  resize();
  addEventListener('resize', resize);

  /* ---------- Анимация ---------- */
  const stageProgress = () => {
    const r = stage.getBoundingClientRect();
    const total = r.height - innerHeight;
    return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
  };
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

  let tmx = 0, tmy = 0, mx = 0, my = 0;
  addEventListener('pointermove', e => {
    tmx = (e.clientX / innerWidth) * 2 - 1;
    tmy = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);

  // Крутить телефон пальцем / мышкой, по нажатию — оборот и вспышка
  let spin = 0, spinVel = 0, dragging = false, lastX = 0, downX = 0, downT = 0, boost = 0;
  canvas.addEventListener('pointerdown', e => {
    dragging = true; lastX = downX = e.clientX; downT = performance.now();
    spinVel = 0;
    canvas.classList.add('dragging');
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    spin += dx * 0.012; spinVel = dx * 0.012;
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false; canvas.classList.remove('dragging');
    if (e.type === 'pointerup' && Math.abs(e.clientX - downX) < 6 && performance.now() - downT < 280) {
      spinVel += 0.32; boost = 1;
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  const clock = new THREE.Clock();
  let pS = stageProgress();
  let intro = reduceMQ.matches ? 1 : 0;
  let shownScreen = 0;
  const glowTarget = new THREE.Color();
  const FW = 0.1;   // ширина переворота в долях прокрутки

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    const t = clock.elapsedTime;
    const reduce = reduceMQ.matches;

    const p = stageProgress();
    pS += (p - pS) * (reduce ? 1 : 1 - Math.exp(-dt * 10));

    if (intro < 1) intro = Math.min(1, intro + dt / 1.1);
    const ie = 1 - Math.pow(1 - intro, 3);

    // Перевороты и смена экранов
    let flip = 0, idx = 0;
    FLIPS.forEach((f, i) => {
      if (!reduce) flip += smooth((pS - (f - FW / 2)) / FW) * Math.PI * 2;
      if (pS >= f) idx = i + 1;
    });
    if (idx !== shownScreen) { screenMat.map = screens[idx]; shownScreen = idx; }

    // Первый экран → примеры
    const h = smooth((pS - 0.06) / 0.14);
    const segStart = BOUNDS[idx], segEnd = BOUNDS[idx + 1] ?? 1;
    const local = (pS - segStart) / (segEnd - segStart);
    const sway = reduce ? 0 : (local - 0.5) * 0.55 * (idx === 0 ? h : 1);

    mx += (tmx - mx) * (1 - Math.exp(-dt * 4));
    my += (tmy - my) * (1 - Math.exp(-dt * 4));
    const tilt = reduce ? 0 : 1;
    const float = reduce ? 0 : Math.sin(t * 1.4) * 0.1;

    // Инерция кручения, потом мягко возвращаемся экраном к зрителю
    if (!dragging) {
      spin += spinVel;
      spinVel *= reduce ? 0 : 0.94;
      if (Math.abs(spinVel) < 0.004) {
        const target = Math.round(spin / (Math.PI * 2)) * Math.PI * 2;
        spin += (target - spin) * (1 - Math.exp(-dt * 4));
      }
    }
    boost = Math.max(0, boost - dt * 1.6);

    const heroYaw = layout.mobile ? -0.32 : -0.5;
    pivot.position.set(
      layout.x,
      layout.y + float * layout.s,
      -9 * (1 - ie)
    );
    pivot.scale.setScalar(layout.s * (1 - 0.05 * h));
    pivot.rotation.set(
      -0.1 * (1 - h) + my * 0.22 * tilt,
      heroYaw * (1 - h) + flip + sway + mx * 0.35 * tilt - 1.6 * (1 - ie) + spin,
      0.07 * (1 - h)
    );

    // Цвет свечения под нишу
    glowTarget.set(ACCENTS[idx]);
    glowMat.color.lerp(glowTarget, 1 - Math.exp(-dt * 5));
    warm.color.copy(glowMat.color);
    glow.position.set(pivot.position.x, pivot.position.y, pivot.position.z - 2);
    glow.scale.setScalar(layout.s * 11 * (0.95 + Math.sin(t * 1.2) * 0.04 * tilt + boost * 0.35));
    glowMat.opacity = (0.42 + boost * 0.4) * ie;
    pivot.scale.multiplyScalar(1 + Math.sin(boost * Math.PI) * 0.05);

    points.rotation.y = (reduce ? 0 : t * 0.025) + pS * 0.9;
    points.position.y = pS * 3;

    // Вихрь: центр за телефоном, закручивается от времени, прокрутки и кручения телефона
    const vt = reduce ? 20 : t;
    const cx = layout.x, cy = layout.y - 0.2 * layout.s;
    vortex.position.set(cx - mx * 0.25 * tilt, cy + my * 0.15 * tilt, -5.5 - 9 * (1 - ie));
    vortex.scale.setScalar(layout.s * (layout.mobile ? 30 : 27) * (1 + boost * 0.06));
    vortex.rotation.set(-0.32 + my * 0.05 * tilt, mx * 0.06 * tilt, 0);
    vortexMat.uniforms.uTime.value = vt;
    vortexMat.uniforms.uTwist.value = -pS * 2.4 - spin * 0.25;
    vortexMat.uniforms.uOpacity.value = ie * (0.85 - 0.3 * h + boost * 0.35);
    vortexMat.uniforms.uColB.value.copy(glowMat.color);

    // Кубы кружат вокруг вихря
    for (let i = 0; i < cubes.length; i++) {
      const c = cubes[i];
      const ang = c.a0 + vt * c.speed + pS * (0.9 + 2.2 / c.R);
      const depth = (c.z + 6) / 11;                     // 0 — далеко, 1 — близко
      c.g.position.set(
        cx + Math.cos(ang) * c.R * layout.s - mx * (0.2 + depth * 0.9) * tilt,
        cy + Math.sin(ang) * c.R * 0.62 * layout.s + Math.sin(vt * 0.6 + c.bob) * 0.16 * tilt + my * (0.15 + depth * 0.5) * tilt,
        c.z - 9 * (1 - ie)
      );
      c.g.scale.setScalar(c.size * layout.s * (0.6 + 0.4 * ie));
      if (!reduce) {
        c.g.rotation.x += c.spinV.x * dt;
        c.g.rotation.y += c.spinV.y * dt;
        c.g.rotation.z += c.spinV.z * dt;
      }
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
