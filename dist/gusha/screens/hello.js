// Кофейная гуща · экран 1 «Hello».
//
// Восемь секунд пролива эспрессо идут не видеоплеером, а песком: ключи из hello-frames.bin
// раздают крупинкам цели, между ключами движение доигрывает пружина ядра. Живого <video>
// на экране нет вовсе — картинка целиком собрана из тех же крупинок, что текут фоном.
//
// Три вещи, которые здесь важны.
//
// 1. Кадр обрезан при сборке ключей. На экране убрана только верхняя полоска;
//    второй тесной обрезки нет: иначе кофемашина исчезает из композиции.
//
// 2. Ключ переставляется ТОЛЬКО когда сменился его номер (20 раз в секунду), через
//    updateTargets. Позиции крупинок закреплены; меняется полутон, без перелётов кластерами.
//    Кадры идут вперёд, назад и снова вперёд: оба разворота бесшовны.
//
// 3. Filled-кнопка имеет песочную заливку с вырезанной надписью;
//    DOM существует лишь как прозрачная хит-зона.

import { loadHelloFrames, helloTargets, boomerangFrameIndex } from '../hello-frames.js';
import { pillHole } from '../ui-kit.js';

const ID = {
  video: 'hello:video', title: 'hello:title', sub: 'hello:sub',
  fill: 'hello:fill'
};
const IDS = [ID.video, ID.title, ID.sub, ID.fill];

// hello-frames.bin уже вырезан из исходного ролика вокруг кофемашины. Повторная
// тесная обрезка оставляла только струю и фрагмент стакана.
const CROP = { x0: 0, y0: 20, x1: 120, y1: 212 };

// Ширина окна после обрезки остаётся равной исходной сетке: полутона не усредняем повторно.
const CROP_W = 120;
const CROP_GAMMA = 1.0;              // тон уже выставлен при сборке ключей
const VIDEO_GRAINS = 32000;

// Фотография не должна дышать, как строка стиха: при полном WOB кромка стакана расплывается.
const VIDEO_WOB = 0.22;

// расписание появления, в секундах от монтирования
const T = { video: 0.18, title: 1.50, sub: 1.95, pill: 2.50 };

const TITLE = 'Кофе знает больше,\nчем вы думаете';
const SUB = 'Раскройте, что приготовил\nдля вас сегодняшний день';
const CTA = 'Получить предсказание';

const SANS = '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

const CSS = `
.gh-root{position:absolute;inset:0;pointer-events:none;-webkit-user-select:none;user-select:none}
.gh-cta{position:absolute;margin:0;padding:0;border:0;border-radius:999px;background:none;-webkit-appearance:none;
  appearance:none;pointer-events:auto;cursor:pointer;touch-action:manipulation;
  color:#102e83;font:500 16px/1.2 ${SANS};overflow:hidden;
  display:flex;align-items:center;justify-content:center;gap:7px;opacity:0;
  transition:opacity .28s ease,transform .25s ease;transform:scale(.985)}
.gh-cta.settled{opacity:1;background:none;transform:scale(1);box-shadow:none}
.gh-cta,.gh-cta .star{color:transparent!important;text-shadow:none!important}
.gh-cta.leaving{opacity:0;transform:scale(1.04)}
.gh-cta .star{font-size:20px;line-height:1}
`;

let cssDone = false;
function ensureCss() {
  if (cssDone) return;
  const s = document.createElement('style');
  s.dataset.gusha = 'hello';
  s.textContent = CSS;
  document.head.appendChild(s);
  cssDone = true;
}

// Окно кадра → сетка dw×dh: усреднение по площади (каждый пиксель источника учтён ровно
// один раз), гамма и угасание к кромке. Производный клип — свой объект, и у него свой кэш
// выборки внутри hello-frames.js. Сто шестьдесят ключей считаются один раз при монтировании.
const cropCache = new WeakMap();
function cropClip(clip, r, gamma, dw) {
  let c = cropCache.get(clip);
  if (c) return c;
  const sw = Math.min(clip.w, r.x1) - r.x0, sh = Math.min(clip.h, r.y1) - r.y0;
  const w = dw, h = Math.max(1, Math.round(sh * dw / sw));
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(v / 255, gamma));
  // границы ячеек считаем один раз: усреднение по площади, без размытия и без пропусков
  const bx = new Int32Array(w + 1), by = new Int32Array(h + 1);
  for (let i = 0; i <= w; i++) bx[i] = Math.round(i * sw / w);
  for (let i = 0; i <= h; i++) by[i] = Math.round(i * sh / h);
  c = {
    w, h, fps: clip.fps, count: clip.count, duration: clip.duration,
    frames: clip.frames.map(f => {
      const dst = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        const y0 = by[y], y1 = Math.max(y0 + 1, by[y + 1]), fy = edge(y, h, 5);
        for (let x = 0; x < w; x++) {
          const x0 = bx[x], x1 = Math.max(x0 + 1, bx[x + 1]);
          let acc = 0, n = 0;
          for (let sy = y0; sy < y1; sy++) {
            const ro = (r.y0 + sy) * clip.w + r.x0;
            for (let sx = x0; sx < x1; sx++) { acc += f[ro + sx]; n++; }
          }
          const bottom = Math.max(0, Math.min(1, (h * .89 - y) / (h * .27)));
          dst[y * w + x] = lut[(acc / n) | 0] * fy * edge(x, w, 3) * bottom;
        }
      }
      return dst;
    })
  };
  cropCache.set(clip, c);
  return c;
}

// плавное угасание к краю окна: 0 на самой кромке, 1 через n пикселей
function edge(i, n, f) {
  const d = Math.min(i, n - 1 - i);
  return d >= f ? 1 : (d / f) * (d / f) * (3 - 2 * (d / f));
}

// Раскладка. Картинка занимает верх во всю ширину, заголовок идёт сразу под кадром,
// кнопка стоит от низа.
function layout(sand, clip) {
  const W = sand.w, H = sand.h;
  const k = Math.min(1.12, Math.max(0.58, Math.min(W / 375, H / 720)));
  if (W > H * 1.3 && H < 600) {
    const leftW = Math.min(W * .48, H * 1.12);
    const videoH = H * .94, videoW = videoH * clip.w / clip.h;
    const textX = leftW + (W - leftW) / 2;
    const pillH = Math.max(42, Math.min(50, H * .13));
    return {
      W, H, k, textX, titleTop: Math.max(22, H * .13), titleSize: Math.min(33, H * .085),
      subTop: H * .45, subSize: Math.min(16, H * .043), ctaSize: 18,
      video: { x: (leftW - videoW) / 2, y: (H - videoH) / 2, w: videoW, h: videoH },
      pill: { x: textX, y: H - pillH / 2 - 32, w: Math.min(320, W - leftW - 48), h: pillH }
    };
  }
  // кегль не опускаем ниже читаемого: мелкий песочный шрифт рассыпается в крупу
  const titleSize = Math.max(24, Math.round(42 * k));
  const subSize = Math.max(13, Math.round(16 * k));
  const pillH = Math.max(40, Math.round(54 * k));
  // Сначала считаем, сколько места забирает низ экрана, и только остаток отдаём кадру.
  // Если делить по ширине, в альбомной ориентации кнопка наезжает на подпись.
  const vh = Math.min(H * (H < 700 ? .60 : .69), W * clip.h / clip.w);
  const vw = W;
  const compact = H < 620;
  const titleTop = Math.round(H < 700 ? vh + 10 : H * (441 / 720));
  const subTop = Math.round(H < 700 ? titleTop + titleSize * 2.3 + 8 : H * (542 / 720));
  const pillY = Math.round(Math.min(compact ? H - 40 : H * (672 / 720), H - pillH / 2 - 32));
  return {
    W, H, k, textX: W / 2,
    video: { x: (W - vw) / 2, y: 0, w: vw, h: vh },
    titleTop, titleSize, subTop, subSize,
    pill: { x: W / 2, y: pillY, w: Math.min(W - 40, Math.round(271 * k)), h: pillH }
  };
}

// Дыхание глифа должно быть по росту буквы. Поле течения сдвигает цель на единицы пикселей;
// для заголовка в 34 px это жизнь, а для подписи в 12 px — каша из налезающих букв
// (видно в альбомной ориентации, где весь кегль падает вдвое).
const twob = size => Math.max(.30, Math.min(1, size / 30));

let cur = null;

export async function mount(ctx) {
  const sand = ctx.sand;
  ensureCss();

  const st = {
    alive: true, raf: 0, timers: [], listeners: [], resizeT: 0,
    lastKey: -1, videoOff: false, started: 0, leaving: false,
    pts: null, tone: null, clip: null, L: null, root: null, cta: null
  };
  cur = st;

  const host = ctx.root || document.body;
  const root = document.createElement('div');
  root.className = 'gh-root';
  host.appendChild(root);
  st.root = root;

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'gh-cta';
  cta.textContent = CTA;
  const star = document.createElement('span'); star.className = 'star';
  star.textContent = '✦'; star.setAttribute('aria-hidden', 'true'); cta.appendChild(star);
  cta.setAttribute('aria-label', CTA);
  root.appendChild(cta);
  st.cta = cta;

  const on = (el, ev, fn) => { el.addEventListener(ev, fn); st.listeners.push(() => el.removeEventListener(ev, fn)); };
  const after = (ms, fn) => { st.timers.push(setTimeout(() => { if (st.alive) fn(); }, ms)); };

  on(cta, 'pointerdown', e => { e.preventDefault(); leave(); });

  // касание по фону: локальное рассыпание с возвратом
  const local = e => {
    const r = sand.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  on(sand.canvas, 'pointerdown', e => { const [x, y] = local(e); sand.hit(x, y, 92, 430); });
  on(sand.canvas, 'pointermove', e => { if (e.buttons) { const [x, y] = local(e); sand.hit(x, y, 58, 230); } });

  await sand.ready;
  if (!st.alive) return;
  const full = await loadHelloFrames();
  if (!st.alive) return;

  st.clip = cropClip(full, CROP, CROP_GAMMA, CROP_W);
  st.L = layout(sand, st.clip);
  place(st);

  st.pts = new Float32Array(VIDEO_GRAINS * 2);
  st.tone = new Float32Array(VIDEO_GRAINS);
  st.pts.tone = st.tone;

  const reduced = sand.reduced;

  // instant:true — пересборка после поворота экрана, без второго «пролёта» текста
  function build(instant) {
    const L = st.L, cx = L.textX;
    const d = (t) => (instant || reduced) ? 0 : t - T.video;
    st.videoOff = false;
    if (key(st, reduced || instant ? 40 : 0)) {
      sand.setTargets(ID.video, st.pts, { arrive: instant ? 'burst' : 'flow', span: instant ? .12 : .55,
        rise: .72, wob: VIDEO_WOB, gold: -.12, opacityByTone: true });
    }
    sand.text(ID.title, TITLE, {
      x: cx, y: L.titleTop, size: L.titleSize, weight: 500, align: 'center', lineHeight: 1.18,
      density: 3.0, wob: .12, gold: -1.5,
      arrive: instant ? 'burst' : 'wave-x', span: instant ? .12 : .70, delay: d(T.title)
    });
    sand.text(ID.sub, SUB, {
      x: cx, y: L.subTop, size: L.subSize, font: SANS, align: 'center', count: 6600, tone: 1,
      wob: .06, gold: -1.5,
      arrive: instant ? 'burst' : 'wave-x', span: instant ? .12 : .52, delay: d(T.sub)
    });
    const arr = instant ? 'burst' : 'wave-x', sp = instant ? .12 : .50;
    st.cta.classList.remove('settled', 'leaving');
    const button = pillHole(sand, { x: L.pill.x, y: L.pill.y,
      w: L.pill.w, h: L.pill.h, label: CTA, size: L.ctaSize || Math.max(16, 19 * L.k),
      font: SANS, weight: 400, density: 2.8, pad: .48 });
    sand.setTargets(ID.fill, button, { arrive: arr, span: sp, delay: d(T.pill), wob: .008 });
    after((d(T.pill) + sp + .18) * 1000, () => {
      if (!st.leaving) st.cta.classList.add('settled');
    });
  }

  if (reduced) { build(true); return; }

  after(T.video * 1000, () => build(false));

  // --- кадр экрана: только ключи видео; tick/draw ведёт приложение ---
  st.started = performance.now();
  const loop = now => {
    if (!st.alive) return;
    st.raf = requestAnimationFrame(loop);
    if (document.hidden || st.leaving) return;
    const t = (now - st.started) / 1000 - T.video;
    if (t < 0) return;
    const f = boomerangFrameIndex(st.clip, t);
    if (f === st.lastKey) return;
    const lit = key(st, f);
    if (!lit) {                                   // пустой ключ: картинки нет, песок уходит в поток
      if (!st.videoOff && sand.has(ID.video)) { sand.release(ID.video, { style: 'drip' }); st.videoOff = true; }
      return;
    }
    if (st.videoOff || !sand.has(ID.video)) {     // картинка вернулась — собираем заново
      sand.setTargets(ID.video, st.pts, { arrive: 'flow', span: .35, rise: .6, wob: VIDEO_WOB, gold: -.12, opacityByTone: true });
      st.videoOff = false;
    } else sand.updateTargets(ID.video, st.pts);
  };
  st.raf = requestAnimationFrame(loop);

  // поворот экрана: ядро не переносит цели, экран перестраивает свои группы сам
  on(window, 'resize', () => {
    clearTimeout(st.resizeT);
    st.resizeT = setTimeout(() => {
      if (!st.alive || st.leaving) return;
      sand.resize();
      st.L = layout(sand, st.clip);
      place(st);
      for (const id of IDS) sand.drop(id);
      st.lastKey = -1;
      build(true);
    }, 180);
  });

  function leave() {
    if (st.leaving) return;
    st.leaving = true;
    st.cta.classList.add('leaving');
    for (const id of IDS) sand.release(id, { style: 'split-spiral', power: id === ID.video ? 1.18 : 1.05 });
    // Даём разлёту пройти через края кадра до появления следующей сцены.
    setTimeout(() => { if (st.alive && ctx.go) ctx.go('ticket'); }, 560);
  }
}

// раздать цели по ключу f; false — ключ пустой, картинки нет
function key(st, f) {
  const n = helloTargets(st.clip, f, st.L.video, st.pts, st.tone);
  st.lastKey = f;
  if (!n) return false;
  // Каждая закреплённая крупинка либо видна полностью, либо отсутствует. Яркость
  // кадра задаёт ДОЛЮ видимых точек, а постоянный порог каждой точки не даёт
  // полутонам мигать и не сдвигает зерно кластерами при смене видеоключа.
  for (let i = 0; i < n; i++) {
    const v = Math.min(1, Math.sqrt(st.tone[i]) * 3);
    st.tone[i] = v > hashGrain(i) ? 1 : 0;
  }
  return true;
}

function hashGrain(i) {
  i = Math.imul(i ^ (i >>> 16), 0x7feb352d);
  i = Math.imul(i ^ (i >>> 15), 0x846ca68b);
  return ((i ^ (i >>> 16)) >>> 0) / 4294967296;
}

function place(st) {
  const c = st.cta, p = st.L.pill, pad = 8;
  c.style.left = (p.x - p.w / 2 - pad) + 'px';
  c.style.top = (p.y - p.h / 2 - pad) + 'px';
  c.style.width = (p.w + pad * 2) + 'px';
  c.style.height = (p.h + pad * 2) + 'px';
  c.style.fontSize = Math.max(12, Math.round(16 * st.L.k)) + 'px';
}

export async function unmount(ctx) {
  const st = cur;
  if (!st) return;
  cur = null;
  const alreadyLeaving = st.leaving;
  st.alive = false;
  st.leaving = true;
  if (st.raf) cancelAnimationFrame(st.raf);
  clearTimeout(st.resizeT);
  for (const h of st.timers) clearTimeout(h);
  for (const f of st.listeners) f();
  const sand = ctx.sand;
  if (!sand.reduced && !alreadyLeaving) {
    for (const id of IDS) if (sand.has(id)) sand.release(id, { style: id === ID.video ? 'drip' : 'wave-x' });
    await new Promise(r => setTimeout(r, 180));
  }
  for (const id of IDS) sand.drop(id);
  if (st.root && st.root.parentNode) st.root.parentNode.removeChild(st.root);
}

// QA: номер видимого видеоключа для проверки бесшовного повтора.
export function _frame() { return cur ? cur.lastKey : -1; }
export function _elapsed() { return cur ? (performance.now() - cur.started) / 1000 - T.video : -1; }
