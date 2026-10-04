// Экран 4 «Чашка» для отдельного билда «Кофейная гуща».
//
// Что рисуем: круглую чашку видом сверху по фото-референсу, без выдуманного блюдца.
// Фарфор и диагональная ручка сохраняют светотень фотографии; кофе — отдельный
// непрерывный вихрь из песка, внутри которого живёт меняющийся знак.
// Внутри кофе идёт бесконечная серия созвездий, перетекающих одно в другое
// через абстрактную форму: цели той же группы прогоняются по бездивергентному полю течения
// (curl), поэтому рисунок не пропадает, а расплывается в дым и собирается следующим знаком.
// Группа остаётся занятой на всех переходах: песок меняет форму без пополнения и пропажи.
//
// Ниже проявляется послание (налетает слева-направо), под ним мелкое толкование, у которого
// последние слова живут отдельной группой: их тон чуть гаснет к концу строки, но координаты
// букв остаются неподвижны — иначе мелкий текст превращался в кашу.
//
// Кнопки — таблетки песком с ВЫРЕЗАННОЙ подписью: точки заливки отфильтрованы по маске
// текста (ядро дырок не умеет, и это здесь дешевле, чем менять контракт).
//
// Контракт экрана: mount(ctx) / unmount(ctx) → Promise,
//   ctx = { sand, root, go(name), session, sensors?, onFrame? }.

import { CONSTELLATIONS } from '../../assets/sky-data.js';
import { sandPoints } from '../zodiac.js';
import { revealRoute } from '../flow.js';

const TAU = Math.PI * 2;
let cupPhoto = null, cupPhotoLoading = null, shareIcon = null;
function loadCupPhoto() {
  if (cupPhotoLoading) return cupPhotoLoading;
  const img = new Image(); img.decoding = 'async'; img.src = '/gusha/assets/coffee-reference.jpg';
  const share = new Image(); share.decoding = 'async'; share.src = '/gusha/assets/share-outline.svg';
  cupPhotoLoading = Promise.all([img.decode(), share.decode()]).then(() => { cupPhoto = img; shareIcon = share; });
  return cupPhotoLoading;
}

const MESSAGE = 'Ваш путь вымощен золотом, но туман скрывает поворот впереди';
const NOTE_HEAD = 'Перед вами откроется тайна или решится сложная задача, над которой вы думали';
const NOTE_TAIL = 'дольше, чем стоило';
const CTA = 'Раскрыть полностью';

// Порядок созвездий в чашке: сначала самые узнаваемые, дальше — по всему небу,
// чтобы у зрителя не возникало ощущения короткой петли.
const SERIES = [
  'ursa-major', 'orion', 'cassiopeia', 'cygnus', 'scorpius', 'lyra',
  'leo', 'pegasus', 'sagittarius', 'perseus', 'aquila', 'taurus',
  'andromeda', 'bootes', 'gemini', 'corona-borealis'
];

// --- мелкая утварь -------------------------------------------------------------------------

function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Мягкое ограничение радиуса: до R почти тождественно, за R плавно прижимает.
// Жёсткий обрез собирал бы крупинки валом по кромке.
function softCircle(pts, cx, cy, R) {
  for (let i = 0; i < pts.length; i += 2) {
    const dx = pts[i] - cx, dy = pts[i + 1] - cy;
    const d = Math.hypot(dx, dy);
    if (d < 1e-4) continue;
    const k = 1 / Math.pow(1 + Math.pow(d / R, 8), 0.125);
    pts[i] = cx + dx * k; pts[i + 1] = cy + dy * k;
  }
  return pts;
}

// Абстракция между созвездиями: точки сносит поле течения ψ с ФИКСИРОВАННЫМИ
// ПРОСТРАНСТВЕННЫМИ частотами и случайными фазами; v = (∂ψ/∂y, −∂ψ/∂x) — поле
// бездивергентно, поэтому рисунок закручивается, а не схлопывается в точку.
// Времени в формуле нет: это статическая деформация целей, ритма глазу не видно.
function curlWarp(pts, amount, seed, L) {
  const rnd = seeded(seed);
  const modes = [];
  for (let k = 0; k < 3; k++) {
    // длина волны поля соразмерна САМОМУ рисунку: при длинной волне созвездие просто
    // уезжает целиком, и вместо завитка видно сдвиг.
    const base = TAU / L * (1 + k * 0.85);
    modes.push({
      kx: base * (rnd() < .5 ? -1 : 1) * (0.85 + rnd() * 0.3),
      ky: base * (rnd() < .5 ? -1 : 1) * (0.85 + rnd() * 0.3),
      px: rnd() * TAU, py: rnd() * TAU,
      a: 1 - k * 0.38
    });
  }
  const field = (x, y, v) => {
    let vx = 0, vy = 0;
    for (let m = 0; m < modes.length; m++) {
      const M = modes[m];
      const ax = M.kx * x + M.px, ay = M.ky * y + M.py;
      vx += M.a * Math.sin(ax) * Math.cos(ay) * M.ky;
      vy -= M.a * Math.cos(ax) * Math.sin(ay) * M.kx;
    }
    v[0] = vx; v[1] = vy;
  };
  // масштаб шага считаем по самому облаку: аналитическая оценка длины вектора врёт в разы,
  // а промах здесь сразу виден — либо рисунок не шевельнулся, либо улетел из чашки
  const v = [0, 0];
  let mean = 0;
  for (let i = 0; i < pts.length; i += 2) { field(pts[i], pts[i + 1], v); mean += Math.hypot(v[0], v[1]); }
  mean = mean / (pts.length >> 1) || 1e-6;
  const steps = 6, h = amount / (steps * mean);
  const out = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    let x = pts[i], y = pts[i + 1];
    for (let s = 0; s < steps; s++) { field(x, y, v); x += v[0] * h; y += v[1] * h; }
    out[i] = x; out[i + 1] = y;
  }
  if (pts.tone) out.tone = pts.tone;
  return out;
}

// --- маска: вырезаем подпись из заливки таблетки --------------------------------------------

const mc = document.createElement('canvas');
const mx = mc.getContext('2d', { willReadFrequently: true });

// draw(ctx, w, h) рисует белым то, что должно стать ДЫРКОЙ. Обводка той же кистью
// расширяет маску на полпикселя — песок не липнет к буквам.
function carve(pts, box, draw) {
  const S = 2;
  mc.width = Math.max(2, Math.ceil(box.w * S));
  mc.height = Math.max(2, Math.ceil(box.h * S));
  mx.setTransform(S, 0, 0, S, 0, 0);
  mx.clearRect(0, 0, box.w, box.h);
  mx.fillStyle = '#fff'; mx.strokeStyle = '#fff';
  mx.lineJoin = 'round'; mx.lineCap = 'round';
  draw(mx, box.w, box.h);
  const d = mx.getImageData(0, 0, mc.width, mc.height).data;
  const n = pts.length >> 1, src = pts.tone;
  const keep = new Float32Array(pts.length), tn = src ? new Float32Array(n) : null;
  let got = 0;
  for (let i = 0; i < n; i++) {
    const px = (pts[i * 2] - box.x) * S | 0, py = (pts[i * 2 + 1] - box.y) * S | 0;
    let a = 0;
    if (px >= 0 && py >= 0 && px < mc.width && py < mc.height) a = d[(py * mc.width + px) * 4 + 3];
    if (a > 40) continue;
    keep[got * 2] = pts[i * 2]; keep[got * 2 + 1] = pts[i * 2 + 1];
    if (tn) tn[got] = src[i];
    got++;
  }
  const out = keep.slice(0, got * 2);
  if (tn) out.tone = tn.slice(0, got);
  return out;
}

// Подпись-дырка. Пишем по букве с разрядкой: при кегле 15 и обычном трекинге просветы
// внутри букв уже шага крупинок (≈1.4 px), и подпись сливается в щель. Крупнее и разреженнее —
// читается. Обводкой не раздуваем: она съедает внутренние просветы первой.
function label(c, str, cx, cy, size, track) {
  c.font = '400 ' + size + 'px -apple-system, "SF Pro Text", Arial, sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'middle';
  const ch = [...str];
  let w = 0;
  for (const g of ch) w += c.measureText(g).width + track;
  w -= track;
  let x = cx - w / 2;
  c.lineWidth = .9;
  for (const g of ch) {
    c.strokeText(g, x, cy); c.fillText(g, x, cy);
    x += c.measureText(g).width + track;
  }
}

// Иконка «поделиться» в клетке 24×24: скруглённый ящик с выломанным правым верхом и стрелка.
function shareGlyph(c, w, h) {
  if (shareIcon) {
    c.drawImage(shareIcon, (w - 24) / 2, (h - 24) / 2, 24, 24);
    return;
  }
  const k = 1, ox = (w - 24) / 2, oy = (h - 24) / 2;
  c.save(); c.translate(ox, oy); c.scale(k, k);
  c.lineWidth = 2.1;
  c.beginPath();
  c.moveTo(14.5, 6.5); c.lineTo(8, 6.5);
  c.arcTo(5, 6.5, 5, 9.5, 3); c.lineTo(5, 18);
  c.arcTo(5, 21, 8, 21, 3); c.lineTo(16, 21);
  c.arcTo(19, 21, 19, 18, 3); c.lineTo(19, 13.5);
  c.stroke();
  c.beginPath(); c.moveTo(11.4, 13.6); c.lineTo(19.6, 5.1); c.stroke();
  c.beginPath(); c.moveTo(13.9, 4.6); c.lineTo(20.2, 4.6); c.lineTo(20.2, 11.1); c.stroke();
  c.restore();
}

// --- экран ----------------------------------------------------------------------------------

// Крюк для QA: последний нарисованный битмап чашки (см. test-cup.html).
export let __bitmapRef = null;

export function mount(ctx) {
  const sand = ctx.sand;
  const root = ctx.root || document.body;
  const reduced = !!sand.reduced;

  const S = {
    t: 0, paused: false, alive: true, raf: 0, off: null,
    plan: [], geo: null, els: [], series: null, note: null, seed: 1,
    coffeeBase: null, coffeeTargets: null, coffeeTick: 0
  };

  // --- геометрия под текущий холст --------------------------------------------------------
  //
  // Считаем по НАСТОЯЩИМ коробкам текста (sand.measure), а не по угаданной высоте строки:
  // послание переносится по словам, и на широком экране оно складывается в одну строку, а на
  // узком — в пять. Если колонка не влезает, уменьшаем кегль и чашку, пока не сядет.
  const NOTE_FONT = '-apple-system, "SF Pro Text", Arial, sans-serif';
  const NOTE_SIZE = 16, NOTE_LH = 1.5;

  function layout() {
    const W = sand.w, H = sand.h, gut = 24;
    if (W > H * 1.3 && H < 600) {
      const cx = Math.min(W * .235, H * .53), cy = H * .43;
      const Rs = Math.min(H * .35, W * .19);
      const textCx = (W + cx * 2) / 2;
      const msgW = Math.min(W - cx * 2 - 36, 440);
      const msgSize = Math.min(34, H * .087), noteSize = Math.min(17, H * .045);
      const msgY = Math.max(18, H * .065);
      const msgBox = sand.measure(MESSAGE, { x: textCx - msgW / 2, y: msgY,
        size: msgSize, weight: 500, align: 'left', maxWidth: msgW, lineHeight: 1.12 });
      const noteY = msgY + msgBox.h + 8;
      const btnH = Math.min(50, H * .13), shareD = btnH, gap = 12;
      const actionLeft = textCx - msgW / 2, actionRight = textCx + msgW / 2;
      const ctaW = actionRight - actionLeft - shareD - gap;
      return { W, H, cx, textCx, cy, Rs, Rc: Rs * .634, Rk: Rs * .452,
        msgY, msgSize, msgW, noteY, noteSize,
        btnCY: H - btnH / 2 - 20, btnH, ctaW, shareD,
        ctaCX: actionLeft + ctaW / 2, shareCX: actionRight - shareD / 2 };
    }
    const msgW = Math.min(W - gut * 2 - 6, 342);
    let k = 1;
    for (let pass = 0; pass < 6; pass++) {
      const msgSize = Math.min(42, W * 0.11, H * 0.059) * k;
      const noteSize = Math.max(14, NOTE_SIZE * Math.min(1, k + .12));
      const btnH = Math.min(56, Math.max(44, H * 0.066));
      const Rs = Math.min(W * 0.44, H * 0.215) * Math.min(1, k + .06);
      const cx = W / 2, cy = Math.max(Rs * 1.05, H * 0.19);
      const msgY = cy + Rs + Math.max(60, H * 0.07);
      const msgBox = sand.measure(MESSAGE, { x: cx - msgW / 2, y: msgY, size: msgSize, weight: 500, align: 'left', maxWidth: msgW, lineHeight: 1.12 });
      const noteY = msgY + msgBox.h + Math.max(8, H * 0.014);
      const noteBox = sand.measure(NOTE_HEAD + ' ' + NOTE_TAIL, { x: cx - msgW / 2, y: noteY, size: noteSize, align: 'left', maxWidth: msgW, lineHeight: NOTE_LH, font: NOTE_FONT });
      const bottom = noteY + noteBox.h;
      const shareD = btnH, gap = Math.min(12, W * 0.035);
      const actionGut = Math.min(16, W * 0.045);
      const ctaW = W - actionGut * 2 - shareD - gap;
      // Нижняя зона действий — под большой палец, как в Figma (20 px до края на 720 px).
      let btnCY = H - Math.max(46, H * 0.075);
      btnCY = Math.min(H - btnH / 2 - 12, Math.max(btnCY, bottom + btnH / 2 + 16));
      if (bottom + btnH + 26 > H && pass < 5) { k *= 0.87; continue; }
      return {
        W, H, cx, textCx: cx, cy, Rs, Rc: Rs * 0.634, Rk: Rs * 0.452,
        msgY, msgSize, msgW, noteY, noteSize,
        btnCY, btnH, ctaW, shareD,
        ctaCX: actionGut + ctaW / 2, shareCX: W - actionGut - shareD / 2
      };
    }
  }

  // --- чашка и кофейный водоворот ---------------------------------------------------------
  //
  // Референс 612×612: центр чашки (309,260), ручка идёт вниз-влево. Берём квадратный
  // фрагмент 512×512 от (50,40), чтобы не растягивать круг и не захватывать белый фон.
  const N = 512, CROP_X = 50, CROP_Y = 40;
  const CUP_X = 309 - CROP_X, CUP_Y = 260 - CROP_Y;
  const src = document.createElement('canvas');
  src.width = src.height = N;
  const srcCtx = src.getContext('2d', { willReadFrequently: true });
  let srcData = null;
  const cc = document.createElement('canvas');
  const coffeeCanvas = document.createElement('canvas');
  cc.width = cc.height = coffeeCanvas.width = coffeeCanvas.height = N;

  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  function pixels() {
    if (!srcData) {
      srcCtx.drawImage(cupPhoto, CROP_X, CROP_Y, N, N, 0, 0, N, N);
      srcData = srcCtx.getImageData(0, 0, N, N).data;
    }
    return srcData;
  }
  function handleDistance(x, y) {
    // Ось настоящей ручки на фото; это не добавленная справа геометрическая петля.
    const ax = 194, ay = 416, bx = 129, by = 505;
    const vx = bx - ax, vy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x - ax - vx * t, y - ay - vy * t);
  }
  function tonalBitmap(kind) {
    const canvas = kind === 'body' ? cc : coffeeCanvas;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    const raw = pixels(), out = c.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const sx = x + CROP_X, sy = y + CROP_Y;
      const dx = sx - 309, dy = sy - 260, r = Math.hypot(dx, dy);
      const i = (y * N + x) * 4;
      const lum = (raw[i] * .299 + raw[i + 1] * .587 + raw[i + 2] * .114) / 255;
      let v;
      if (kind === 'body') {
        const porcelain = smooth(162, 170, r) * (1 - smooth(204, 213, r));
        const handle = (1 - smooth(25, 35, handleDistance(sx, sy))) * smooth(181, 199, r);
        const rim = Math.exp(-(((r - 176) / 6) ** 2));
        const shade = .15 + .9 * Math.pow(Math.max(0, (lum - .38) / .62), 1.7);
        v = Math.min(1, Math.max(porcelain, handle) * (shade + .16 * rim));
      } else {
        const a = Math.atan2(dy, dx);
        const crema = Math.max(0, (lum - .35) * 1.45);
        const arm = Math.pow((1 + Math.sin(a * 3 - r * .087 + Math.sin(r * .045) * .6)) / 2, 4);
        const core = .08 + .92 * smooth(57, 128, r);
        v = (1 - smooth(156, 169, r)) * core * (.055 + .25 * crema + .55 * arm);
      }
      const gray = Math.round(255 * v);
      out.data[i] = out.data[i + 1] = out.data[i + 2] = gray;
      out.data[i + 3] = 255;
    }
    c.putImageData(out, 0, 0);
    return canvas;
  }
  function cupBitmap() {
    __bitmapRef = tonalBitmap('body');
    return __bitmapRef;
  }
  function buildCup() {
    const g = S.geo, d = g.Rs * 2 / .985 * 1.10;
    const x = g.cx - CUP_X / N * d, y = g.cy - CUP_Y / N * d;
    sand.image('cup:body', cupBitmap(), {
      x, y, w: d, h: d, sample: 320, gamma: 1, floor: .05, count: 25000,
      arrive: reduced ? 'burst' : 'flow', span: reduced ? 0 : .62,
      tone: 1, gold: -.48, wob: .006
    });
    const base = sand.image(null, tonalBitmap('coffee'), {
      x, y, w: d, h: d, sample: 280, gamma: .95, floor: .04, count: 9000
    });
    S.coffeeBase = base;
    S.coffeeTargets = new Float32Array(base.length);
    S.coffeeTargets.tone = base.tone;
    sand.setTargets('cup:coffee', base, {
      arrive: reduced ? 'burst' : 'flow', span: reduced ? 0 : .72,
      tone: .31, gold: -.55, wob: .004
    });
  }
  function stepCoffee(dt) {
    if (reduced || !S.coffeeBase || !sand.has('cup:coffee')) return;
    S.coffeeTick += dt;
    if (S.coffeeTick < .05) return;
    S.coffeeTick = 0;
    const base = S.coffeeBase, out = S.coffeeTargets, g = S.geo;
    const R = g.Rs * .78;
    for (let i = 0; i < base.length; i += 2) {
      const dx = base[i] - g.cx, dy = base[i + 1] - g.cy;
      const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const depth = Math.max(0, 1 - r / R);
      const theta = a + S.t * (.58 + depth * depth * 1.45);
      out[i] = g.cx + Math.cos(theta) * r;
      out[i + 1] = g.cy + Math.sin(theta) * r;
    }
    sand.updateTargets('cup:coffee', out);
  }

  // --- созвездия --------------------------------------------------------------------------
  function figures() {
    const by = new Map(CONSTELLATIONS.map(c => [c.id, c]));
    const list = SERIES.map(id => by.get(id)).filter(Boolean);
    return list.length ? list : CONSTELLATIONS.slice(0, 8);
  }

  // Точки знака, упорядоченные по углу вокруг центра чашки. Порядок здесь — не мелочь:
  // updateTargets сопоставляет цели по индексу, и если оставить исходный порядок (звезда за
  // звездой, потом нити), крупинка из левого края одного созвездия поедет в правый край
  // другого, и перетекание рассыпается в мельтешение. По углу пути коротки и согласованы.
  function signPoints(fig) {
    const g = S.geo;
    const pts = softCircle(sandPoints(fig, {
      x: g.cx, y: g.cy, size: g.Rk * 1.34,
      perStar: Math.round(g.Rk * 2.2), perLine: 68
    }), g.cx, g.cy, g.Rk * 0.88);
    const n = pts.length >> 1, ix = new Int32Array(n), key = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const dx = pts[i * 2] - g.cx, dy = pts[i * 2 + 1] - g.cy;
      ix[i] = i; key[i] = Math.atan2(dy, dx) * 64 + Math.hypot(dx, dy) / g.Rk;
    }
    const ord = Array.from(ix).sort((a, b) => key[a] - key[b]);
    const out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { out[i * 2] = pts[ord[i] * 2]; out[i * 2 + 1] = pts[ord[i] * 2 + 1]; }
    return out;
  }

  function startSeries() {
    const figs = figures();
    const S0 = { i: 0, figs, cur: null, phase: 0, next: 6.0 };   // первый знак стоит, а не морфится с порога
    S.series = S0;
    S0.cur = signPoints(figs[0]);
    sand.setTargets('cup:sign', S0.cur, { arrive: 'burst', span: .22, delay: reduced ? 0 : 1.05, tone: 1, gold: .12, wob: 1.35 });
  }

  // Состояния: держим знак → общая песочная абстракция → следующий знак.
  // Группа cup:sign остаётся одной: её частицы не исчезают и не пополняются.
  function stepSeries(dt) {
    const s = S.series; if (!s || reduced) return;
    s.next -= dt;
    if (s.next > 0) return;
    const g = S.geo;
    if (s.phase === 0) {
      s.warpSeed = (S.seed = (S.seed * 1664525 + 1013904223) >>> 0);
      if (sand.has('cup:sign')) sand.updateTargets('cup:sign', softCircle(curlWarp(s.cur, g.Rk * .50, s.warpSeed, g.Rk * 1.5), g.cx, g.cy, g.Rk * 0.97));
      s.phase = 1; s.next = .82; return;
    }
    if (s.phase === 1) {
      s.i = (s.i + 1) % s.figs.length;
      s.cur = signPoints(s.figs[s.i]);
      if (sand.has('cup:sign')) sand.updateTargets('cup:sign', softCircle(curlWarp(s.cur, g.Rk * .48, s.warpSeed ^ 0x9e3779b9, g.Rk * 1.5), g.cx, g.cy, g.Rk * 0.97));
      s.phase = 2; s.next = .82; return;
    }
    if (s.phase === 2) {
      if (sand.has('cup:sign')) sand.updateTargets('cup:sign', s.cur);
      s.phase = 0; s.next = 4.3; return;
    }
  }

  // --- текст ------------------------------------------------------------------------------
  function buildMessage() {
    const g = S.geo;
    sand.text('cup:msg', MESSAGE, {
      x: g.textCx - g.msgW / 2, y: g.msgY, size: g.msgSize, weight: 500, align: 'left',
      maxWidth: g.msgW, lineHeight: 1.12, count: 6500,
      arrive: reduced ? 'burst' : 'wave-x', span: reduced ? 0 : 1.2, tone: 1, gold: -.16, wob: .025
    });
  }

  // Мелкое толкование строим одним блоком, чтобы переносы остались точными. Потом маской
  // выделяем именно слова «дольше, чем стоило», даже если они попали на разные строки.
  function buildNote() {
    const g = S.geo;
    const fullText = NOTE_HEAD + ' ' + NOTE_TAIL;
    const all = sand.text(null, fullText, {
      x: g.textCx - g.msgW / 2, y: g.noteY, size: g.noteSize, weight: 400, align: 'left',
      maxWidth: g.msgW, lineHeight: NOTE_LH, count: 3600, font: NOTE_FONT
    });
    const n = all.length >> 1;
    const scale = 2, mask = document.createElement('canvas');
    mask.width = Math.ceil(all.box.w * scale); mask.height = Math.ceil(all.box.h * scale);
    const m = mask.getContext('2d', { willReadFrequently: true });
    m.font = `400 ${g.noteSize * scale}px ${NOTE_FONT}`;
    m.textBaseline = 'alphabetic'; m.fillStyle = '#fff'; m.strokeStyle = '#fff';
    m.lineWidth = scale * .9; m.lineJoin = 'round';
    const words = fullText.split(/\s+/), tailFrom = NOTE_HEAD.split(/\s+/).length;
    const lines = []; let line = [];
    for (let wi = 0; wi < words.length; wi++) {
      const test = [...line.map(v => v.word), words[wi]].join(' ');
      if (line.length && m.measureText(test).width / scale > g.msgW) { lines.push(line); line = []; }
      line.push({ word: words[wi], index: wi });
    }
    if (line.length) lines.push(line);
    lines.forEach((row, ri) => {
      let prefix = '';
      for (const item of row) {
        if (item.index >= tailFrom) {
          const x = g.noteSize * .25 + m.measureText(prefix ? prefix + ' ' : '').width / scale;
          const y = g.noteSize * .90 + g.noteSize * NOTE_LH * ri;
          m.strokeText(item.word, x * scale, y * scale);
          m.fillText(item.word, x * scale, y * scale);
        }
        prefix += (prefix ? ' ' : '') + item.word;
      }
    });
    const maskPixels = m.getImageData(0, 0, mask.width, mask.height).data;
    let maxY = -1e9;
    for (let i = 0; i < n; i++) maxY = Math.max(maxY, all[i * 2 + 1]);

    const head = [], headT = [], headD = [], tail = [], tailT = [], tailD = [];
    const firstY = Math.min(...Array.from({ length: n }, (_, i) => all[i * 2 + 1]));
    const rowH = g.noteSize * NOTE_LH;
    const rows = Math.max(1, Math.round((maxY - firstY) / rowH) + 1);
    for (let i = 0; i < n; i++) {
      const x = all[i * 2], y = all[i * 2 + 1], t = all.tone ? all.tone[i] : 1;
      const row = Math.max(0, Math.min(rows - 1, Math.round((y - firstY) / rowH)));
      const order = (row + Math.max(0, Math.min(1, (x - (g.textCx - g.msgW / 2)) / g.msgW))) / rows;
      const px = Math.floor((x - all.box.x) * scale), py = Math.floor((y - all.box.y) * scale);
      const inTail = px >= 0 && py >= 0 && px < mask.width && py < mask.height &&
        maskPixels[(py * mask.width + px) * 4 + 3] > 36;
      if (inTail) {
        tail.push(x, y); tailT.push(t * (1 - order * order * .25)); tailD.push(order);
      } else { head.push(x, y); headT.push(t); headD.push(order); }
    }
    const fh = new Float32Array(head); fh.tone = new Float32Array(headT);
    const ft = new Float32Array(tail); ft.tone = new Float32Array(tailT);
    fh.delay = new Float32Array(headD); ft.delay = new Float32Array(tailD);
    const moving = new Float32Array(ft.length); moving.tone = new Float32Array(ft.tone);
    S.note = { head: fh, tail: ft, order: new Float32Array(tailD), moving, cycle: 0 };
    sand.setTargets('cup:noteHead', fh, {
      arrive: reduced ? 'burst' : 'wave-x', span: reduced ? 0 : 1.45,
      tone: 1, gold: -.22, wob: .01
    });
    if (ft.length) sand.setTargets('cup:noteTail', ft, {
      arrive: reduced ? 'burst' : 'wave-x', span: reduced ? 0 : 1.45,
      tone: 1, gold: -.22, wob: .008
    });
  }

  // Только хвост фразы течёт в двух плавных полях: буквы рассыпаются и снова собираются,
  // но «тело» послания остаётся на исходной сетке и читаетcя без помех.
  function stepNote(dt) {
    const N = S.note; if (!N || reduced || !N.tail.length) return;
    N.cycle -= dt;
    if (N.cycle > 0) return;
    const t = S.t, p = N.moving;
    for (let i = 0; i < N.tail.length / 2; i++) {
      const x = N.tail[i * 2], y = N.tail[i * 2 + 1];
      const strength = 4.2 + 5.8 * N.order[i];
      const grain = Math.sin(i * 12.9898 + t * 3.1);
      p[i * 2] = x + strength * (.59 * Math.sin(y * .13 + t * 2.2 + Math.sin(x * .06 + t * .7)) + .31 * Math.sin(x * .17 - t * 1.1) + .10 * grain);
      p[i * 2 + 1] = y + strength * (.43 * Math.cos(x * .11 - t * 1.9) + .29 * Math.sin(y * .19 + t * 2.8) + .12 * Math.cos(i * 7.13 - t * 2.7));
      p.tone[i] = N.tail.tone[i] * (.48 + .52 * Math.sin(t * 2.1 + x * .08) ** 2);
    }
    sand.updateTargets('cup:noteTail', p);
    N.cycle = .05;
  }

  // --- кнопки -----------------------------------------------------------------------------
  function buildButtons() {
    const g = S.geo;
    const ctaBox = { x: g.ctaCX - g.ctaW / 2, y: g.btnCY - g.btnH / 2, w: g.ctaW, h: g.btnH };
    const ctaPts = carve(
      // Плотность и кегль выреза — по границе читаемости, снятой в ui-kit: ниже 0.80 крупинки
      // на пиксель дырка тонет, ниже 22 px просветы внутри букв уже шага решётки. На .58 и 19 px
      // «Раскрыть полностью» читалось кашей (зум DPR 3 при сшивке билда).
      sand.shape(null, 'pill', { x: g.ctaCX, y: g.btnCY, w: g.ctaW, h: g.btnH, density: 2.0 }),
      ctaBox,
      (c, w, h) => label(c, CTA, w / 2, h / 2 + .5,
        Math.min(22, Math.max(18, g.btnH * .40)), Math.min(22, Math.max(18, g.btnH * .40)) * .045));
    sand.setTargets('cup:cta', ctaPts, { arrive: reduced ? 'burst' : 'wave-x', span: reduced ? 0 : .42, tone: 1, gold: .2, wob: .008 });

    const shBox = { x: g.shareCX - g.shareD / 2, y: g.btnCY - g.shareD / 2, w: g.shareD, h: g.shareD };
    const shPts = carve(
      sand.shape(null, 'pill', { x: g.shareCX, y: g.btnCY, w: g.shareD, h: g.shareD, density: 2.0 }),
      shBox, shareGlyph);
    sand.setTargets('cup:share', shPts, { arrive: reduced ? 'burst' : 'wave-x', span: reduced ? 0 : .3, delay: reduced ? 0 : .1, tone: 1, gold: .2, wob: .008 });

    // хит-зоны поверх песка: сам песок кликов не ловит
    S.els.push(hitButton(ctaBox, CTA, () => {
      for (const b of S.els) b.style.opacity = '0';
      sand.release('cup:cta', { style: 'wave-x', power: 1.25 });
      sand.release('cup:share', { style: 'wave-x', power: 1.1 });
      const route = revealRoute(ctx.session || {});
      if (typeof ctx.go === 'function') ctx.go(route); else location.hash = '#' + route;
    }));
    S.els.push(hitButton(shBox, 'Поделиться', () => {
      sand.hit(g.shareCX, g.btnCY, g.shareD * .9, 380);
      if (navigator.share) navigator.share({ title: 'Кофейная гуща', text: MESSAGE }).catch(() => { });
    }));
  }

  function hitButton(box, name, onTap) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', name);
    if (name === 'Поделиться') {
      const icon = document.createElement('img');
      icon.src = '/gusha/assets/share-outline.svg'; icon.alt = '';
      icon.width = 24; icon.height = 24;
      b.appendChild(icon);
    } else b.textContent = name;
    if (name === 'Поделиться') b.firstChild.style.visibility = 'hidden';
    b.style.cssText = 'position:absolute;margin:0;padding:0;border:0;background:none;' +
      'color:transparent;font:600 18px/1.2 -apple-system,Helvetica Neue,Arial,sans-serif;' +
      'opacity:1;' +
      '-webkit-appearance:none;appearance:none;cursor:pointer;' +
      'left:' + box.x + 'px;top:' + box.y + 'px;width:' + box.w + 'px;height:' + box.h + 'px;' +
      'border-radius:' + (box.h / 2) + 'px;box-shadow:none;' +
      '-webkit-tap-highlight-color:transparent;touch-action:manipulation';
    b.addEventListener('click', onTap);
    root.appendChild(b);
    return b;
  }

  // --- расписание -------------------------------------------------------------------------
  function at(t, fn) { S.plan.push({ t, fn, done: false }); }

  // instant — пересборка на лету (поворот экрана): показывать интро заново некому,
  // пользователь уже дочитал послание.
  function schedule(instant) {
    S.plan.length = 0;
    buildCup();
    startSeries();
    if (reduced || instant) { buildMessage(); buildNote(); buildButtons(); return; }
    at(1.5, buildMessage);
    at(2.5, buildNote);
    at(3.4, buildButtons);
  }

  function advance(dt) {
    if (!S.alive) return;
    S.t += dt;
    for (const p of S.plan) if (!p.done && S.t >= p.t) { p.done = true; p.fn(); }
    stepCoffee(dt);
    stepSeries(dt);
    stepNote(dt);
  }

  // --- касание по чашке -------------------------------------------------------------------
  function onPointer(e) {
    if (e.target && e.target.tagName === 'BUTTON') return;
    const r = (sand.canvas || root).getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (e.type === 'pointermove' && !e.buttons) return;
    sand.hit(x, y, e.type === 'pointerdown' ? 84 : 56, e.type === 'pointerdown' ? 430 : 220);
  }

  function onResize() {
    const seen = S.t > 8.2;
    sand.resize();
    S.geo = layout();
    for (const el of S.els) el.remove();
    S.els.length = 0;
    for (const id of sand.groups) if (id.startsWith('cup:')) sand.drop(id);
    S.t = 0; S.note = null; S.series = null;
    S.coffeeBase = null; S.coffeeTargets = null; S.coffeeTick = 0;
    schedule(seen);
  }

  // --- запуск -----------------------------------------------------------------------------
  // хит-зоны ставим абсолютно — контейнеру нужна система координат
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';

  const ready = Promise.all([sand.ready || Promise.resolve(), loadCupPhoto()]).then(() => {
    if (!S.alive) return;
    S.geo = layout();
    schedule();
    root.addEventListener('pointerdown', onPointer);
    root.addEventListener('pointermove', onPointer);
    addEventListener('resize', onResize);

    if (typeof ctx.onFrame === 'function') {
      S.off = ctx.onFrame(advance);
    } else {
      let last = performance.now();
      const loop = now => {
        S.raf = requestAnimationFrame(loop);
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        if (!S.paused && !document.hidden) advance(dt);
      };
      S.raf = requestAnimationFrame(loop);
    }
  });

  // Остановка обязана быть явной: без неё старый цикл продолжает крутиться после ухода с
  // экрана и через несколько секунд достраивает послание поверх следующего экрана.
  function stop() {
    if (!S.alive) return;
    S.alive = false; S.paused = true;
    if (S.raf) cancelAnimationFrame(S.raf);
    if (typeof S.off === 'function') S.off();
    S.off = null; S.raf = 0;
    root.removeEventListener('pointerdown', onPointer);
    root.removeEventListener('pointermove', onPointer);
    removeEventListener('resize', onResize);
    for (const el of S.els) el.remove();
    S.els.length = 0;
  }

  ctx.cup = {
    get t() { return S.t; },
    get paused() { return S.paused; }, set paused(v) { S.paused = !!v; },
    advance, stop, layout: () => S.geo, ready,
    series: () => S.series && { i: S.series.i, id: S.series.figs[S.series.i].id, phase: S.series.phase },
    note: () => {
      if (!S.note) return null;
      const n = S.note.tail.length >> 1;
      let shift = 0;
      for (let i = 0; i < n; i++) shift += Math.hypot(
        S.note.moving[i * 2] - S.note.tail[i * 2],
        S.note.moving[i * 2 + 1] - S.note.tail[i * 2 + 1]
      );
      return { head: S.note.head.length >> 1, tail: n, shift: n ? shift / n : 0 };
    }
  };
  if (typeof window !== 'undefined') window.__cup = ctx.cup;

  return ready;
}

export function unmount(ctx) {
  const sand = ctx.sand;
  const api = ctx.cup;
  if (api && api.stop) api.stop(); else if (api) api.paused = true;
  if (typeof window !== 'undefined' && window.__cup === api) window.__cup = null;
  for (const id of sand.groups) if (id.startsWith('cup:')) {
    const image = id === 'cup:body' || id === 'cup:sign';
    sand.release(id, { style: image ? 'vortex' : 'wave-x', power: image ? .72 : .85 });
  }
  return new Promise(r => setTimeout(r, sand.reduced ? 0 : 180));
}
