/* ===== Ваши контакты: поменяйте здесь ===== */
const CONFIG = {
  whatsapp: '79261408245',      // номер без «+»: +7 926 140-82-45
  telegram: 'kvtiucodd',        // ник без «@»
  message: 'Здравствуйте! Хочу бесплатное демо сайта. Мой бизнес: ',
  hours: [9, 22],               // когда вы «на связи» (по Москве) — для индикатора в шапке
  // Куда уходят заявки. Сайт лежит на GitHub Pages (там нет сервера),
  // поэтому заявки принимает функция на Vercel и пересылает их в Telegram.
  api: 'https://kvtiucodd.vercel.app/api/contact'
};
/* ========================================== */

(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = t => t * t * (3 - 2 * t);

  /* ---------- Плавная прокрутка (как в референсе) ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
    const loop = time => { lenis.raf(time); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    // ссылки на разделы — плавно, с учётом Lenis
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.6 });
    });
  }
  const scrollToY = y => (lenis ? lenis.scrollTo(y, { duration: 1.2 }) : scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }));

  /* ---------- Заставка ---------- */
  const intro = $('.intro');
  if (document.documentElement.classList.contains('intro-on')) {
    if (lenis) lenis.stop();
    scrollTo(0, 0);
    const num = $('.intro-count b', intro);
    const t0 = performance.now(), MIN = 1700;
    let loaded = document.readyState === 'complete';
    addEventListener('load', () => { loaded = true; });
    const tick = now => {
      const k = Math.min(1, (now - t0) / MIN);
      const shown = Math.round((loaded ? k : Math.min(k, 0.9)) * 100);
      num.textContent = shown;
      if (shown >= 100 || now - t0 > 4500) {
        intro.classList.add('done');
        try { sessionStorage.setItem('kv_intro', '1'); } catch (_) {}
        setTimeout(() => {
          document.documentElement.classList.remove('intro-on');
          intro.remove();
          if (lenis) lenis.start();
        }, 950);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } else if (intro) intro.remove();

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

  const sectionProgress = el => {
    const r = el.getBoundingClientRect();
    const total = el.offsetHeight - innerHeight;
    return total > 0 ? clamp(-r.top / total) : 0;
  };

  /* ---------- Первый экран: текст уходит по мере прокрутки ---------- */
  const hero = $('.hero');
  const updateHero = () => {
    hero.style.setProperty('--hero', reduce ? 0 : sectionProgress(hero).toFixed(3));
  };

  /* ---------- Работы: листалка, привязанная к прокрутке ---------- */
  const worksSec = $('#works');
  const workEls = $$('.work', worksSec);
  const worksNum = $('.works-count b', worksSec), worksBar = $('.works-bar i', worksSec);
  const worksPrev = $('.works-prev', worksSec), worksNext = $('.works-next', worksSec);
  const W_FROM = 0.05, W_TO = 0.93;          // участок сцены, на котором листаются работы
  let workActive = -1;
  const updateWorks = () => {
    const n = workEls.length;
    const p = reduce ? 0 : sectionProgress(worksSec);
    const raw = clamp((p - W_FROM) / (W_TO - W_FROM)) * (n - 1);
    const i0 = Math.min(n - 2, Math.floor(raw)), fr = raw - i0;
    const x = i0 + smooth(clamp((fr - 0.32) / 0.36));               // работа стоит, смена — быстро посередине
    const active = Math.round(x);
    workEls.forEach((el, k) => {
      const d = reduce ? 0 : clamp(k - x, -1, 1);
      el.style.setProperty('--d', d.toFixed(3));
      el.style.setProperty('--a', Math.abs(d).toFixed(3));
    });
    if (active !== workActive) {
      workActive = active;
      workEls.forEach((el, k) => { el.classList.toggle('is-active', reduce || k === active); el.inert = !reduce && k !== active; });
      worksNum.textContent = String(active + 1).padStart(2, '0');
      worksPrev.disabled = active === 0; worksNext.disabled = active === n - 1;
    }
    worksBar.style.setProperty('--wp', ((x + 1) / n).toFixed(3));
  };
  const goWork = k => {
    const n = workEls.length; k = clamp(k, 0, n - 1);
    const total = worksSec.offsetHeight - innerHeight;
    const p = W_FROM + (k / (n - 1)) * (W_TO - W_FROM);
    scrollToY(worksSec.offsetTop + p * total);
  };
  worksPrev.addEventListener('click', () => goWork(workActive - 1));
  worksNext.addEventListener('click', () => goWork(workActive + 1));

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

  /* ---------- Переходы между сценами на весь экран ---------- */
  // --en: 0 → 1, пока сцена въезжает снизу; --lv: 0 → 1, пока уезжает вверх
  const shells = $$('.scene-pin').map(sec => ({
    sec, inner: sec.querySelector('.pin-inner'), en: -1, lv: -1
  }));
  const updateShells = () => {
    if (reduce) return;
    const vh = innerHeight;
    for (const s of shells) {
      const r = s.sec.getBoundingClientRect();
      if (r.top > vh * 1.2 || r.bottom < -vh * 0.2) continue;
      const en = Math.round(clamp(1 - r.top / vh) * 1000) / 1000;
      const lv = Math.round(clamp(1 - r.bottom / vh) * 1000) / 1000;
      if (en !== s.en) { s.inner.style.setProperty('--en', en); s.en = en; }
      if (lv !== s.lv) { s.inner.style.setProperty('--lv', lv); s.lv = lv; }
    }
  };

  /* ---------- Общий цикл ---------- */
  const root = document.documentElement;
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = root.scrollHeight - innerHeight;
    root.style.setProperty('--page', max > 0 ? (scrollY / max).toFixed(4) : 0);
    updateTop();
    updateHero();
    updateShells();
    updateScrubs();
    updatePins();
    updateWorks();
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });

  const relayout = () => {
    pins.forEach(p => { p.last = -1; });
    update();
    moveBar(hoverLink || spyLinks[spyActive]);   // ширина ссылок меняется после загрузки шрифта
  };
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(relayout, 120); });
  relayout();
  document.fonts && document.fonts.ready.then(relayout);
  addEventListener('load', relayout);

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
        // локально (main.py) и на самом Vercel — свой сервер, на GitHub Pages — сервер на Vercel
        const sameServer = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.hostname.endsWith('.vercel.app');
        const res = await fetch(sameServer ? '/api/contact' : CONFIG.api, {
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
      const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      $('.hud-clock b', hud).textContent = hhmm;
      $$('.msk-clock').forEach(el => { el.textContent = hhmm; });
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
