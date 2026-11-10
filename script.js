/* ===== Ваши контакты: поменяйте здесь ===== */
const CONFIG = {
  whatsapp: '79261408245',      // номер без «+»: +7 926 140-82-45
  telegram: 'kvtiucodd',        // ник без «@»
  message: 'Здравствуйте! Хочу бесплатное демо сайта. Мой бизнес: ',
  hours: [9, 22]                // когда вы «на связи» (по Москве) — для индикатора в шапке
};
/* ========================================== */

(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = t => t * t * (3 - 2 * t);

  // Ссылки на мессенджеры
  $$('[data-wa]').forEach(a => {
    a.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.message)}`;
    a.target = '_blank'; a.rel = 'noopener';
  });
  $$('[data-tg]').forEach(a => {
    a.href = `https://t.me/${CONFIG.telegram}`;
    a.target = '_blank'; a.rel = 'noopener';
  });

  /* ---------- Разбивка текста на слова ---------- */
  const splitWords = (el, cls, inner) => {
    const text = el.textContent.trim();
    const words = text.split(/ +/);
    el.setAttribute('aria-label', text);
    el.innerHTML = words.map((w, i) => inner
      ? `<span class="w" aria-hidden="true"><span class="${cls}" style="--i:${i}">${w}</span></span>`
      : `<span class="${cls}" aria-hidden="true" style="--i:${i}">${w}</span>`).join(' ');
    el.style.setProperty('--n', words.length);
  };
  $$('[data-words]').forEach(h => { splitWords(h, 'wi', true); if (!h.dataset.end) h.dataset.end = '.62'; });
  $$('[data-lit]').forEach(p => splitWords(p, 'lw', false));

  /* ---------- Появление заголовков при подъезде к экрану ---------- */
  const scrubEls = $$('[data-words], [data-fade]').map(el => ({
    el,
    start: parseFloat(el.dataset.start ?? 1),
    end: parseFloat(el.dataset.end ?? .7),
    last: -1
  }));
  const updateScrubs = () => {
    const vh = innerHeight;
    for (const s of scrubEls) {
      const r = s.el.getBoundingClientRect();
      let p;
      if (r.top > vh * 1.6) p = 0;
      else if (r.bottom < -vh * 0.6) p = 1;
      else p = reduce ? 1 : Math.round(clamp((s.start * vh - r.top) / ((s.start - s.end) * vh)) * 1000) / 1000;
      if (p !== s.last) { s.el.style.setProperty('--p', p); s.last = p; }
    }
  };

  /* ---------- Сцена 1: тексты рядом с 3D-телефоном ---------- */
  const stage = $('.stage');
  const panels = $$('.panel', stage);
  const ticks = $$('.stage-progress span', stage);
  const hint = $('.scroll-hint', stage);
  const BOUNDS = [0, 0.22, 0.48, 0.74];
  let current = -1;
  const sectionProgress = el => {
    const r = el.getBoundingClientRect();
    const total = el.offsetHeight - innerHeight;
    return total > 0 ? clamp(-r.top / total) : 0;
  };
  const updateStage = () => {
    const p = sectionProgress(stage);
    let i = 0;
    BOUNDS.forEach((b, k) => { if (p >= b) i = k; });
    if (i !== current) {
      panels.forEach((el, k) => {
        el.classList.toggle('is-active', k === i);
        el.classList.toggle('is-past', k < i);
        el.setAttribute('aria-hidden', k !== i);
      });
      ticks.forEach((t, k) => t.classList.toggle('on', k <= i));
      current = i;
    }
    if (hint) hint.classList.toggle('gone', p > 0.02);
  };

  /* ---------- Закреплённые сцены: прогресс → --sp ---------- */
  const pins = $$('.scene-pin').map(el => ({
    el,
    last: -1,
    decks: $$('.deck', el).map(d => ({
      el: d,
      cards: [...d.children],
      range: (d.dataset.range || '0.08,0.9').split(',').map(Number)
    })),
    nav: $$('.deck-nav li', el),
    count: $('.deck-count', el)
  }));

  const layoutDeck = (pin, d, sp) => {
    const n = d.cards.length;
    if (reduce) {
      d.cards.forEach(c => { c.inert = false; c.style.removeProperty('--ci'); c.style.removeProperty('--depth'); });
      return;
    }
    const [a, b] = d.range;
    const seg = (b - a) / (n - 1);
    const ci = d.cards.map((_, k) => k === 0 ? 1 : smooth(clamp((sp - (a + (k - 1) * seg)) / (seg * 0.8))));
    let active = 0;
    d.cards.forEach((c, k) => {
      let depth = 0;
      for (let j = k + 1; j < n; j++) depth += ci[j];
      c.style.setProperty('--ci', ci[k].toFixed(3));
      c.style.setProperty('--depth', depth.toFixed(3));
      if (ci[k] > 0.5) active = k;
    });
    d.cards.forEach((c, k) => { c.inert = k !== active; });
    pin.nav.forEach((li, k) => li.classList.toggle('on', k === active));
    if (pin.count) pin.count.textContent = `${active + 1} / ${n}`;
  };

  const updatePins = () => {
    for (const pin of pins) {
      const r = pin.el.getBoundingClientRect();
      if (r.top > innerHeight * 1.2 || r.bottom < -innerHeight * 0.2) {
        const edge = r.top > 0 ? 0 : 1;
        if (pin.last === edge) continue;
      }
      const total = pin.el.offsetHeight - innerHeight;
      const sp = reduce ? 1 : (total > 0 ? Math.round(clamp(-r.top / total) * 10000) / 10000 : 1);
      if (sp === pin.last) continue;
      pin.last = sp;
      pin.el.style.setProperty('--sp', sp);
      pin.decks.forEach(d => layoutDeck(pin, d, sp));
    }
  };

  /* ---------- Сцена 3: услуги — вертикальный скролл → лента вбок ---------- */
  const svc = $('.services');
  const track = $('.track', svc);
  const svcCards = $$('.svc', svc);
  const svcCount = $('.svc-count', svc);
  let overflow = 0;
  const layoutServices = () => {
    if (reduce) { svc.style.height = ''; svc.style.setProperty('--sp', .2); return; }
    track.style.transform = 'none';
    overflow = Math.max(0, track.scrollWidth - svc.clientWidth);
    svc.style.height = `${innerHeight + overflow * 1.05}px`;
  };
  const updateServices = () => {
    if (reduce) return;
    const r = svc.getBoundingClientRect();
    if (r.bottom < -100 || r.top > innerHeight + 100) return;
    const p = sectionProgress(svc);
    track.style.transform = `translate3d(${(-p * overflow).toFixed(1)}px,0,0)`;
    svc.style.setProperty('--sp', p.toFixed(4));
    const cx = innerWidth / 2;
    svcCards.forEach(c => {
      const cr = c.getBoundingClientRect();
      const off = (cr.left + cr.width / 2 - cx) / innerWidth;
      const a = Math.min(1, Math.abs(off));
      c.style.setProperty('--ry', `${clamp(off * -38, -32, 32).toFixed(2)}deg`);
      c.style.setProperty('--sc', (1 - a * 0.1).toFixed(3));
      c.style.setProperty('--op', (1 - a * 0.45).toFixed(3));
      c.style.setProperty('--cp', clamp(1.25 - a * 2.4).toFixed(3));
    });
    svcCount.textContent = `${Math.min(svcCards.length, Math.round(p * (svcCards.length - 1)) + 1)} / ${svcCards.length}`;
  };

  /* ---------- Шапка: стекло после прокрутки и бегунок под текущим разделом ---------- */
  const topBar = $('.top'), navEl = $('.nav'), navBar = $('.nav-bar');
  const spyLinks = $$('.nav a[data-spy]');
  const spySections = spyLinks.map(a => document.getElementById(a.dataset.spy));
  let spyActive = -2, hoverLink = null;
  const moveBar = a => {
    if (!a) { navBar.style.setProperty('--o', 0); return; }
    navBar.style.setProperty('--x', `${a.offsetLeft}px`);
    navBar.style.setProperty('--w', `${a.offsetWidth}px`);
    navBar.style.setProperty('--o', 1);
  };
  const updateTop = () => {
    topBar.classList.toggle('is-scrolled', scrollY > 8);
    const mid = innerHeight * 0.45;
    let idx = -1;
    spySections.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= mid) idx = i; });
    if (idx === 0 && sectionProgress(stage) < BOUNDS[1] - 0.02) idx = -1;   // первый экран — ещё не «Работы»
    if (idx !== spyActive) {
      spyActive = idx;
      spyLinks.forEach((a, i) => {
        a.classList.toggle('is-active', i === idx);
        if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      if (!hoverLink) moveBar(spyLinks[idx]);
    }
  };
  spyLinks.forEach(a => {
    a.addEventListener('pointerenter', () => { hoverLink = a; moveBar(a); });
    a.addEventListener('focus', () => { hoverLink = a; moveBar(a); });
    a.addEventListener('blur', () => { hoverLink = null; moveBar(spyLinks[spyActive]); });
  });
  navEl.addEventListener('pointerleave', () => { hoverLink = null; moveBar(spyLinks[spyActive]); });

  /* ---------- Выезжающее меню (телефон и планшет) ---------- */
  const menu = $('#menu'), menuBtn = $('.menu-btn'), backdrop = $('.menu-backdrop');
  const setMenu = open => {
    menu.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    topBar.classList.toggle('menu-open', open);
    menu.inert = !open;
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Меню');
  };
  menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setMenu(false));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });
  matchMedia('(min-width: 1000px)').addEventListener?.('change', () => setMenu(false));

  /* ---------- Общий цикл ---------- */
  const root = document.documentElement;
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = root.scrollHeight - innerHeight;
    root.style.setProperty('--page', max > 0 ? (scrollY / max).toFixed(4) : 0);
    updateTop();
    updateStage();
    updateScrubs();
    updatePins();
    updateServices();
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });

  const relayout = () => {
    layoutServices();
    pins.forEach(p => { p.last = -1; });
    update();
    moveBar(hoverLink || spyLinks[spyActive]);   // ширина ссылок меняется после загрузки шрифта
  };
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(relayout, 120); });
  relayout();
  document.fonts && document.fonts.ready.then(relayout);
  addEventListener('load', relayout);

  // «Работы» — сразу к первому примеру
  $$('[data-jump]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const y = stage.offsetTop + (BOUNDS[+a.dataset.jump] + 0.03) * (stage.offsetHeight - innerHeight);
    scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }));

  // Если 3D не загрузилось — показать картинку
  setTimeout(() => {
    if (!document.documentElement.classList.contains('has-3d')) document.documentElement.classList.add('no-3d');
  }, 6000);

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Магнитные кнопки ---------- */
  if (fine && !reduce) {
    $$('.btn').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--bx', `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
        b.style.setProperty('--by', `${((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1)}px`);
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--bx', '0px'); b.style.setProperty('--by', '0px'); });
    });
  }

  /* ---------- Подсветка карточек ---------- */
  if (fine) {
    $$('.spot').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sx', `${(e.clientX - r.left).toFixed(0)}px`);
        el.style.setProperty('--sy', `${(e.clientY - r.top).toFixed(0)}px`);
        el.style.setProperty('--so', 1);
      });
      el.addEventListener('pointerleave', () => el.style.setProperty('--so', 0));
    });
  }

  /* ---------- Искры при нажатии ---------- */
  if (!reduce) {
    const cv = document.createElement('canvas');
    cv.className = 'sparks'; cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    let parts = [], running = false;
    const size = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      cv.width = innerWidth * d; cv.height = innerHeight * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    size(); addEventListener('resize', size);
    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter(p => p.life > 0);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.vx *= 0.96; p.life -= 0.028;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r += p.vr);
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(tick); else running = false;
    };
    addEventListener('pointerdown', e => {
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4.5;
        parts.push({
          x: e.clientX, y: e.clientY, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2,
          life: 1, s: 3 + Math.random() * 4, r: Math.random() * 3, vr: (Math.random() - 0.5) * 0.4,
          c: Math.random() < 0.6 ? '#FFB547' : '#B8B2FF'
        });
      }
      if (!running) { running = true; requestAnimationFrame(tick); }
    }, { passive: true });
  }

  /* ---------- Слова фразы разбегаются от курсора ---------- */
  const mf = $('.manifesto');
  const mWords = $$('.mf-text .lw');
  if (fine && !reduce && mf) {
    let mx = -1e4, my = -1e4, active = false;
    const st = mWords.map(() => ({ x: 0, y: 0 }));
    const mLoop = () => {
      let moving = false;
      mWords.forEach((w, i) => {
        const r = w.getBoundingClientRect();
        const cx = r.left + r.width / 2 - st[i].x, cy = r.top + r.height / 2 - st[i].y;
        const dx = cx - mx, dy = cy - my, d = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 1 - d / 190);
        const tx = dx / d * f * 38, ty = dy / d * f * 38;
        st[i].x += (tx - st[i].x) * 0.2; st[i].y += (ty - st[i].y) * 0.2;
        if (Math.abs(tx - st[i].x) > 0.1 || Math.abs(ty - st[i].y) > 0.1) moving = true;
        w.style.setProperty('--rx', `${st[i].x.toFixed(1)}px`);
        w.style.setProperty('--ry', `${st[i].y.toFixed(1)}px`);
      });
      if (moving || mx > -1e4) requestAnimationFrame(mLoop); else active = false;
    };
    mf.addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY;
      if (!active) { active = true; requestAnimationFrame(mLoop); }
    });
    mf.addEventListener('pointerleave', () => { mx = -1e4; my = -1e4; });
  }
  mWords.forEach(w => w.addEventListener('click', () => {
    w.classList.remove('bounce'); void w.offsetWidth; w.classList.add('bounce');
  }));

  /* ---------- Кубик «3D» можно крутить ---------- */
  const v3d = $('.v-3d'), cube = $('.cube');
  if (v3d && cube && !reduce) {
    let dx = 0, dy = 0, vx = 0, vy = 0, drag = false, lx = 0, ly = 0, spinning = false;
    const apply = () => { cube.style.setProperty('--dx', `${dx.toFixed(1)}deg`); cube.style.setProperty('--dy', `${dy.toFixed(1)}deg`); };
    const inertia = () => {
      if (drag) { spinning = false; return; }
      dx += vx; dy += vy; vx *= 0.94; vy *= 0.94; apply();
      if (Math.abs(vx) + Math.abs(vy) > 0.05) requestAnimationFrame(inertia); else spinning = false;
    };
    v3d.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; vx = vy = 0; v3d.setPointerCapture(e.pointerId); });
    v3d.addEventListener('pointermove', e => {
      if (!drag) return;
      const mx = e.clientX - lx, my = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      vx = mx * 0.9; vy = -my * 0.9; dx += vx; dy += vy; apply();
    });
    const end = () => { if (!drag) return; drag = false; if (!spinning) { spinning = true; requestAnimationFrame(inertia); } };
    v3d.addEventListener('pointerup', end); v3d.addEventListener('pointercancel', end);
  }

  /* ---------- Песочница: детали сайта с физикой ---------- */
  const initPlayground = () => {
    const box = $('.play-box');
    if (!box) return;
    const toys = $$('.toy', box);
    if (!window.Matter || reduce) { box.classList.add('static'); return; }
    const { Engine, Bodies, Body, Composite, Constraint } = window.Matter;
    const engine = Engine.create();
    engine.gravity.y = 1.15;
    engine.positionIterations = 10;
    engine.velocityIterations = 8;
    const world = engine.world;
    let W = 0, H = 0, walls = [];
    const items = toys.map(el => ({ el, w: 0, h: 0, body: null }));

    const buildWalls = () => {
      if (walls.length) Composite.remove(world, walls);
      W = box.clientWidth; H = box.clientHeight;
      const t = 400;
      walls = [
        Bodies.rectangle(W / 2, H + t / 2, W + t * 2, t, { isStatic: true, friction: 0.6 }),
        Bodies.rectangle(-t / 2, H / 2 - H * 1.5, t, H * 5, { isStatic: true }),
        Bodies.rectangle(W + t / 2, H / 2 - H * 1.5, t, H * 5, { isStatic: true })
      ];
      Composite.add(world, walls);
    };
    const makeBodies = () => {
      items.forEach(it => {
        if (it.body) Composite.remove(world, it.body);
        it.w = it.el.offsetWidth; it.h = it.el.offsetHeight;
        it.body = Bodies.rectangle(0, 0, it.w, it.h, {
          chamfer: { radius: 4 }, restitution: 0.38, friction: 0.35, frictionAir: 0.014, density: 0.0018
        });
        Composite.add(world, it.body);
      });
    };
    const dropAll = () => {
      items.forEach((it, i) => {
        Body.setPosition(it.body, { x: it.w / 2 + Math.random() * Math.max(1, W - it.w), y: -it.h - i * 60 - Math.random() * 60 });
        Body.setVelocity(it.body, { x: 0, y: 0 });
        Body.setAngle(it.body, (Math.random() - 0.5) * 1.2);
        Body.setAngularVelocity(it.body, 0);
      });
    };
    const sync = () => items.forEach(it => {
      const { x, y } = it.body.position;
      it.el.style.transform = `translate3d(${(x - it.w / 2).toFixed(1)}px,${(y - it.h / 2).toFixed(1)}px,0) rotate(${it.body.angle.toFixed(3)}rad)`;
    });

    buildWalls(); makeBodies(); dropAll(); sync();

    // Детали не уходят за боковые стенки и в пол
    const MAX_V = 24;
    const keepInside = () => {
      items.forEach(it => {
        const b = it.body;
        const v = b.velocity, sp = Math.hypot(v.x, v.y);
        if (sp > MAX_V) Body.setVelocity(b, { x: v.x / sp * MAX_V, y: v.y / sp * MAX_V });
        const bb = b.bounds;
        let dx = 0, dy = 0;
        if (bb.min.x < 0) dx = -bb.min.x;
        else if (bb.max.x > W) dx = W - bb.max.x;
        if (bb.max.y > H) dy = H - bb.max.y;
        if (dx || dy) {
          Body.setPosition(b, { x: b.position.x + dx, y: b.position.y + dy });
          Body.setVelocity(b, {
            x: dx ? -b.velocity.x * 0.3 : b.velocity.x,
            y: dy ? Math.min(0, b.velocity.y) : b.velocity.y
          });
        }
      });
    };

    let running = false, last = 0, acc = 0;
    const STEP = 1000 / 60;
    const tick = now => {
      if (!running) return;
      acc += Math.min(50, now - (last || now)); last = now;
      let n = 0;
      while (acc >= STEP && n < 4) { Engine.update(engine, STEP); keepInside(); acc -= STEP; n++; }
      sync();
      requestAnimationFrame(tick);
    };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!running) { running = true; last = 0; acc = 0; requestAnimationFrame(tick); }
      } else if (running) {
        running = false; dropAll(); sync();          // при возвращении детали упадут снова
      }
    }, { threshold: 0.2 }).observe(box);

    // Перетаскивание
    // Точка захвата не выходит за пределы поля (сверху можно подбросить)
    const local = e => {
      const r = box.getBoundingClientRect();
      return { x: clamp(e.clientX - r.left, 6, W - 6), y: Math.min(e.clientY - r.top, H - 6) };
    };
    let drag = null;
    items.forEach(it => {
      it.el.addEventListener('pointerdown', e => {
        e.preventDefault();
        it.el.setPointerCapture(e.pointerId);
        const p = local(e);
        const c = Constraint.create({
          pointA: p, bodyB: it.body,
          pointB: { x: p.x - it.body.position.x, y: p.y - it.body.position.y },
          stiffness: 0.22, damping: 0.08, length: 0
        });
        Composite.add(world, c);
        drag = { it, c, start: p, t: performance.now(), moved: 0 };
        it.el.classList.add('grabbed');
      });
      it.el.addEventListener('pointermove', e => {
        if (!drag || drag.it !== it) return;
        const p = local(e);
        drag.moved = Math.max(drag.moved, Math.hypot(p.x - drag.start.x, p.y - drag.start.y));
        drag.c.pointA = p;
      });
      const end = () => {
        if (!drag || drag.it !== it) return;
        Composite.remove(world, drag.c);
        if (drag.moved < 6 && performance.now() - drag.t < 300) {
          Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 6, y: -13 - Math.random() * 4 });
          Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.5);
        }
        it.el.classList.remove('grabbed');
        drag = null;
      };
      it.el.addEventListener('pointerup', end);
      it.el.addEventListener('pointercancel', end);
    });

    // Встряхнуть
    $('.play-shake').addEventListener('click', () => {
      items.forEach(it => {
        Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 22, y: -10 - Math.random() * 14 });
        Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.6);
      });
    });

    let lastW = innerWidth;
    addEventListener('resize', () => {
      if (innerWidth === lastW) return;
      lastW = innerWidth;
      setTimeout(() => { buildWalls(); makeBodies(); dropAll(); sync(); }, 150);
    });
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(initPlayground);

  /* ---------- Заявка → Telegram-бот (/api/contact) ---------- */
  const form = $('.lead-form');
  if (form) {
    const body = $('.form-body', form), doneBox = $('.form-done', form), limitBox = $('.form-limit', form);
    const msg = $('.form-msg', form), submit = $('.form-submit', form);
    const consentLabel = $('.consent', form);
    const againBtn = $('.form-again', form);

    // Не больше 2 заявок за сутки (сервер проверяет то же самое по IP и контакту)
    const LIMIT = 2, DAY = 24 * 3600 * 1000, KEY = 'kv_leads';
    const sentList = () => {
      try {
        const now = Date.now();
        return (JSON.parse(localStorage.getItem(KEY)) || []).filter(t => now - t < DAY);
      } catch (_) { return []; }
    };
    const saveSent = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (_) {} };
    const showLimit = () => { body.hidden = true; doneBox.hidden = true; limitBox.hidden = false; };
    if (sentList().length >= LIMIT) showLimit();

    // Телефон (10–15 цифр) или ник Telegram (5–32 символа)
    const contactOk = v => {
      v = v.trim();
      const digits = v.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 15 && !/[A-Za-zА-Яа-я]/.test(v)) return true;
      return /^(?:https?:\/\/)?(?:t\.me\/|@)?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v);
    };
    const waLink = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.message)}`;
    const fallback = `Не получилось отправить. Напишите в <a href="${waLink}" target="_blank" rel="noopener">WhatsApp</a> или <a href="https://t.me/${CONFIG.telegram}" target="_blank" rel="noopener">Telegram</a>.`;

    form.addEventListener('input', e => {
      if (e.target.matches('input, textarea')) e.target.removeAttribute('aria-invalid');
      if (e.target.name === 'consent') consentLabel.classList.remove('invalid');
      msg.textContent = '';
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (submit.getAttribute('aria-busy') === 'true') return;
      const f = form.elements;
      const data = {
        name: f.name.value.trim(),
        contact: f.contact.value.trim(),
        type: (form.querySelector('input[name="type"]:checked') || {}).value || '',
        message: f.message.value.trim(),
        consent: f.consent.checked ? 'yes' : '',
        website: f.website.value,
        elapsed: Math.round(performance.now())   // сколько мс страница открыта: боты шлют мгновенно
      };
      if (sentList().length >= LIMIT) { showLimit(); return; }
      const empty = ['name', 'contact', 'message'].filter(k => !data[k]);
      empty.forEach(k => f[k].setAttribute('aria-invalid', 'true'));
      if (empty.length) { msg.textContent = 'Заполните имя, контакт и сообщение.'; f[empty[0]].focus(); return; }
      if (!contactOk(data.contact)) {
        f.contact.setAttribute('aria-invalid', 'true'); f.contact.focus();
        msg.textContent = 'Укажите телефон или ник в Telegram (например, @nickname).';
        return;
      }
      if (!data.consent) { consentLabel.classList.add('invalid'); msg.textContent = 'Отметьте согласие на обработку данных.'; return; }

      submit.setAttribute('aria-busy', 'true');
      submit.textContent = 'Отправляю…';
      msg.textContent = '';
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // русские буквы кодируем как \uXXXX: тело запроса — только ASCII,
          // иначе Python на Vercel неверно считает его длину и обрезает
          body: JSON.stringify(data).replace(/[\u007f-￿]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))
        });
        let out = {};
        try { out = await res.json(); } catch (_) { /* не JSON — сервер без бота */ }
        if (res.ok && out.ok) {
          const list = sentList(); list.push(Date.now()); saveSent(list);
          body.hidden = true; doneBox.hidden = false;
          againBtn.hidden = list.length >= LIMIT;
          form.reset();
        } else if (res.status === 429 && out.limit) {
          const list = sentList(); while (list.length < LIMIT) list.push(Date.now()); saveSent(list);
          showLimit();
        } else if ([400, 403, 429].includes(res.status) && out.error) {
          msg.textContent = out.error + '.';
        } else {
          msg.innerHTML = fallback;
        }
      } catch (_) {
        msg.innerHTML = fallback;
      } finally {
        submit.removeAttribute('aria-busy');
        submit.textContent = 'Отправить заявку';
      }
    });

    againBtn.addEventListener('click', () => {
      if (sentList().length >= LIMIT) { showLimit(); return; }
      doneBox.hidden = true; body.hidden = false;
      form.elements.name.focus();
    });
  }

  /* ---------- Московское время ---------- */
  const msk = () => {
    const d = new Date();
    return new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60000);
  };
  const pad = n => String(n).padStart(2, '0');

  /* ---------- Шапка: индикатор «на связи» и часы по Москве ---------- */
  const hud = $('.hud');
  if (hud) {
    const [FROM, TO] = CONFIG.hours;
    const renderHud = () => {
      const now = msk();
      const online = now.getHours() >= FROM && now.getHours() < TO;
      hud.classList.toggle('is-off', !online);
      $('.hud-text', hud).textContent = online ? 'На связи' : 'Отвечу утром';
      $('.hud-clock b', hud).textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    };
    renderHud();
    setInterval(renderHud, 20000);
  }

  /* ---------- Статус «Открыто / Закрыто» ---------- */
  const statusCard = $('.card-status');
  const OPEN = 8, CLOSE = 22;
  const renderStatus = () => {
    const now = msk();
    const h = now.getHours() + now.getMinutes() / 60;
    const open = h >= OPEN && h < CLOSE;
    statusCard.classList.toggle('is-closed', !open);
    $('.status-text', statusCard).textContent = open ? `Открыто до ${CLOSE}:00` : `Закрыто, откроемся в ${OPEN}:00`;
    $('.status-clock b', statusCard).textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };
  renderStatus();
  setInterval(renderStatus, 20000);

  /* ---------- Онлайн-запись ---------- */
  const book = $('.card-book');
  const daysEl = $('.days', book), slotsEl = $('.slots', book);
  const bookBtn = $('.book-btn', book), done = $('.book-done', book);
  const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const TIMES = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:30', '16:30', '17:30', '18:30', '19:30', '20:30'];
  const booked = new Set();
  let day = 0, slot = null;

  const days = Array.from({ length: 6 }, (_, i) => {
    const d = msk(); d.setDate(d.getDate() + i);
    return {
      label: i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : WD[d.getDay()],
      text: i === 0 ? 'сегодня' : i === 1 ? 'завтра' : `${d.getDate()} ${MON[d.getMonth()]}`,
      date: `${d.getDate()} ${MON[d.getMonth()]}`,
      seed: d.getDate() * 7 + d.getMonth()
    };
  });

  const isBusy = (di, ti) => {
    if (booked.has(`${di}-${ti}`)) return true;
    if (di === 0) {
      const now = msk(); const [hh, mm] = TIMES[ti].split(':').map(Number);
      if (hh * 60 + mm <= now.getHours() * 60 + now.getMinutes() + 30) return true;
    }
    return ((days[di].seed + ti * 5) * 13) % 7 < 3;
  };

  const renderDays = () => {
    daysEl.innerHTML = days.map((d, i) =>
      `<button class="day" type="button" aria-pressed="${i === day}" data-d="${i}">${d.label}<small>${d.date}</small></button>`
    ).join('');
  };
  const renderSlots = () => {
    slotsEl.innerHTML = TIMES.map((t, i) => {
      const busy = isBusy(day, i);
      return `<button class="slot" type="button" data-t="${i}" ${busy ? 'disabled aria-label="' + t + ', занято"' : ''} aria-pressed="${slot === i}">${t}</button>`;
    }).join('');
    bookBtn.disabled = slot === null;
    bookBtn.textContent = slot === null ? 'Выберите время' : `Записаться на ${days[day].text}, ${TIMES[slot]}`;
  };

  daysEl.addEventListener('click', e => {
    const b = e.target.closest('.day'); if (!b) return;
    day = +b.dataset.d; slot = null; done.textContent = '';
    renderDays(); renderSlots();
  });
  slotsEl.addEventListener('click', e => {
    const b = e.target.closest('.slot'); if (!b || b.disabled) return;
    slot = +b.dataset.t; done.textContent = '';
    renderSlots();
  });
  bookBtn.addEventListener('click', () => {
    if (slot === null) return;
    done.textContent = `Готово! Ждём вас ${days[day].text} в ${TIMES[slot]}. Это демо, заявка никуда не ушла.`;
    booked.add(`${day}-${slot}`); slot = null;
    renderSlots();
  });
  if (TIMES.filter((_, i) => !isBusy(0, i)).length < 3) day = 1;
  renderDays(); renderSlots();

  /* ---------- Калькулятор ---------- */
  const calc = $('.card-calc');
  const sumEl = $('.calc-sum', calc);
  const fmt = n => n.toLocaleString('ru-RU').replace(/ | /g, ' ') + ' ₽';
  let shown = 0, raf = 0;
  const renderSum = () => {
    const target = $$('input', calc).filter(i => i.checked).reduce((s, i) => s + +i.dataset.price, 0);
    cancelAnimationFrame(raf);
    if (reduce) { shown = target; sumEl.textContent = fmt(target); return; }
    const from = shown, t0 = performance.now(), dur = 320;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      shown = Math.round(from + (target - from) * e);
      sumEl.textContent = fmt(shown);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  calc.addEventListener('change', renderSum);
  renderSum();
})();
