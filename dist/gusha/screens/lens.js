// Кофейная гуща · экран 2 «Расскажите чаше».
//
// Наверху — картинка-настроение, снизу три варианта и стрелка. Всё белое из Figma здесь песок.
//
// Картинки берутся из трёх кадров Figma и растеризуются только как цели крупинок.
// Оригинальные фотографии не показываются: светлое собирается песком, тёмное остаётся небом.
//
// Активный вариант — Filled: плотная песочная таблетка с вырезанной надписью.
// Остальные варианты — читаемый текст с мягкой градиентной песочной кромкой.
// Каждый таб сохраняет собственные крупинки, а фото меняется коротким вихрем.

import { pillHole, midY, sandButton } from '../ui-kit.js';

const ID = {
  img: 'lens:img', title: 'lens:title', sub: 'lens:sub',
  ring: 'lens:ring', note: 'lens:note', tab: i => 'lens:tab' + i
};
let TAB_GRAINS = 13000;
const tabCache = new Map();
const TAB_CACHE_LIMIT = 18;

const DEFAULT_OPTIONS = [
  { id: 'love', label: 'Отношения' },
  { id: 'career', label: 'Карьера' },
  { id: 'self', label: 'Самопознание' }
];

let OPTIONS = DEFAULT_OPTIONS;
let TITLE = 'Расскажите чаше';
let SUB = 'Что вас заботит сегодня?';
let sphereMode = false;
const SANS = '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

const T = { img: .08, title: .30, sub: .52, opts: .75, ring: 1.15 };

const CSS = `
.gl-root{position:absolute;inset:0;pointer-events:none;-webkit-user-select:none;user-select:none}
.gl-hit{position:absolute;margin:0;padding:0;border:0;background:none;-webkit-appearance:none;
  appearance:none;pointer-events:auto;cursor:pointer;touch-action:manipulation;
  color:transparent;font:1px/1 ${SANS};overflow:hidden}
.gl-hit{transition:background .24s ease,color .24s ease,opacity .24s ease;
  display:flex;align-items:center;justify-content:center}
.gl-hit.readable{color:transparent;text-shadow:none}
.gl-hit.readable:not(.active){box-shadow:none}
.gl-hit.active.settled{color:transparent;background:none;box-shadow:none}
.gl-hit.next{color:transparent;font:400 36px/1 ${SANS};
  display:flex;align-items:center;justify-content:center}
.gl-hit.next.settled{background:none}
`;

let cssDone = false;
function ensureCss() {
  if (cssDone) return;
  const s = document.createElement('style');
  s.dataset.gusha = 'lens';
  s.textContent = CSS;
  document.head.appendChild(s);
  cssDone = true;
}

// ─────────── фото Figma и резервные процедурные маски ───────────
//
// Свет всегда идёт от горизонта: вверху поле темнеет, у горизонта белое, вниз уходит в тень.
// Так песок сам собой плотнее в середине кадра и редеет к краям, и картинка не выглядит
// наклейкой с резкой границей.

const MOOD_W = 512, MOOD_H = 524;
const PHOTO = {
  love: ['/gusha/assets/lens-love.png', null],
  career: ['/gusha/assets/lens-career.png', null],
  self: ['/gusha/assets/lens-self.png', { x: 320, y: 300, w: 384, h: 383 }]
};
let photoCanvases = null, photoLoading = null;

function loadPhotos() {
  if (photoLoading) return photoLoading;
  photoLoading = Promise.all(Object.entries(PHOTO).map(async ([kind, [url, crop]]) => {
    const img = new Image();
    img.decoding = 'async'; img.src = url;
    await img.decode();
    const r = crop || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    // Не растягиваем разные фотографии в общий квадрат: песочная выборка должна
    // иметь ровно ту же пропорцию, что исходный кадр или его явный crop.
    const c = document.createElement('canvas'); c.width = MOOD_W;
    c.height = Math.round(MOOD_W * r.h / r.w);
    const x = c.getContext('2d');
    x.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    // Мягкая кромка принадлежит распределению песка, не рисует поверх фото градиент.
    x.globalCompositeOperation = 'destination-in';
    const fade = x.createLinearGradient(0, 0, 0, c.height);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(.67, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = fade; x.fillRect(0, 0, c.width, c.height);
    return [kind, c];
  })).then(entries => { photoCanvases = Object.fromEntries(entries); return photoCanvases; });
  return photoLoading;
}

function moodCanvas(kind) {
  if (photoCanvases?.[kind]) return photoCanvases[kind];
  const c = document.createElement('canvas');
  c.width = MOOD_W; c.height = MOOD_H;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, MOOD_W, MOOD_H);
  if (kind === 'career') sceneCity(x);
  else if (kind === 'self') sceneNight(x);
  else sceneShore(x);
  return c;
}

function vgrad(x, y0, y1, stops) {
  const g = x.createLinearGradient(0, y0, 0, y1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

// мелкая рябь: короткие светлые штрихи, к низу реже и тусклее
function ripples(x, y0, y1, n, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const t = Math.pow(rnd(), .7);
    const y = y0 + (y1 - y0) * t;
    const w = 30 + rnd() * 150 * (1 - t * .6);
    const px = rnd() * MOOD_W - w / 2;
    x.strokeStyle = `rgba(255,255,255,${(.5 - t * .42).toFixed(3)})`;
    x.lineWidth = 1 + rnd() * 2.4;
    x.beginPath(); x.moveTo(px, y); x.lineTo(px + w, y); x.stroke();
  }
}

// --- фигуры ---
// Силуэт собирается из немногих крупных кусков: на песке всё тоньше 4 px пропадает.

function head(x, cx, cy, r, tilt = 0) {
  x.save(); x.translate(cx, cy); x.rotate(tilt);
  x.beginPath(); x.ellipse(0, 0, r * .92, r, 0, 0, 7); x.fill();
  x.restore();
}

function limb(x, x0, y0, x1, y1, w0, w1) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  x.beginPath();
  x.moveTo(x0 + nx * w0, y0 + ny * w0);
  x.lineTo(x1 + nx * w1, y1 + ny * w1);
  x.lineTo(x1 - nx * w1, y1 - ny * w1);
  x.lineTo(x0 - nx * w0, y0 - ny * w0);
  x.closePath(); x.fill();
}

function neck(x, cx, headY, shY, r) {
  limb(x, cx, headY, cx, shY + 6, r * .52, r * .74);
}

function torso(x, cx, shY, hipY, shW, hipW) {
  x.beginPath();
  x.moveTo(cx - shW, shY);
  x.quadraticCurveTo(cx - shW * 1.02, shY + (hipY - shY) * .55, cx - hipW, hipY);
  x.lineTo(cx + hipW, hipY);
  x.quadraticCurveTo(cx + shW * 1.02, shY + (hipY - shY) * .55, cx + shW, shY);
  x.quadraticCurveTo(cx, shY - shW * .42, cx - shW, shY);
  x.closePath(); x.fill();
}

function legs(x, cx, hipY, feetY, hipW, footW) {
  const gap = hipW * .28;
  limb(x, cx - hipW * .5, hipY, cx - gap - footW * .2, feetY, hipW * .52, footW);
  limb(x, cx + hipW * .5, hipY, cx + gap + footW * .2, feetY, hipW * .52, footW);
}

// Свет кадра. Песок садится по яркости, поэтому светлое пятно — это и есть «сколько песка».
// Оно держится вокруг фигур и мягко гаснет к краям: песок не обрывается прямоугольником,
// а растворяется в потоке. Важно, что фигуры целиком стоят ВНУТРИ светлого пятна —
// иначе ноги проваливаются в тёмную воду и силуэт перестаёт читаться.
function feather(x, cx, cy, r) {
  x.save();
  x.globalCompositeOperation = 'multiply';
  const g = x.createRadialGradient(cx, cy, r * .34, cx, cy, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(.62, '#d2d2d2');
  g.addColorStop(.86, '#5a5a5a');
  g.addColorStop(1, '#000000');
  x.fillStyle = g; x.fillRect(0, 0, MOOD_W, MOOD_H);
  x.restore();
  const b = x.createLinearGradient(0, MOOD_H * .86, 0, MOOD_H);
  b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(1, '#000');
  x.fillStyle = b; x.fillRect(0, MOOD_H * .86, MOOD_W, MOOD_H * .14);
}

// 1. Отношения: двое на берегу лицом друг к другу, его рука у неё на плече
function sceneShore(x) {
  const hz = 286, feet = 446;
  x.fillStyle = vgrad(x, 0, hz, [[0, '#585858'], [.38, '#a4a4a4'], [.84, '#f6f6f6'], [1, '#ffffff']]);
  x.fillRect(0, 0, MOOD_W, hz);
  // вода остаётся светлой до самых ног: силуэт должен читаться по всей высоте
  x.fillStyle = vgrad(x, hz, MOOD_H, [[0, '#f0f0f0'], [.42, '#c4c4c4'], [.76, '#8e8e8e'], [1, '#5a5a5a']]);
  x.fillRect(0, hz, MOOD_W, MOOD_H - hz);
  ripples(x, hz + 6, MOOD_H - 24, 220, 7391);
  x.fillStyle = 'rgba(0,0,0,.58)';                                       // дальний берег
  x.fillRect(0, hz - 7, MOOD_W, 7);
  x.fillRect(392, hz - 28, 6, 28); x.fillRect(456, hz - 18, 5, 18);

  x.fillStyle = '#000';
  // он
  const mx = 310, mh = 268;
  neck(x, mx, feet - mh + 23, feet - mh + 60, 23);
  head(x, mx, feet - mh + 23, 23, -.16);
  torso(x, mx, feet - mh + 60, feet - mh * .46, 38, 26);
  legs(x, mx, feet - mh * .46, feet, 26, 13);
  limb(x, mx - 28, feet - mh + 70, mx - 84, feet - mh + 78, 14, 10);     // рука к её плечу
  limb(x, mx + 26, feet - mh + 70, mx + 36, feet - mh * .44, 13, 9);
  // она: волосы каре, длинное платье с лёгким разлётом подола
  const wx = 206, wh = 246;
  x.beginPath();                                                          // волосы за головой
  x.moveTo(wx - 20, feet - wh + 10);
  x.quadraticCurveTo(wx - 32, feet - wh + 50, wx - 18, feet - wh + 64);
  x.quadraticCurveTo(wx + 2, feet - wh + 70, wx + 14, feet - wh + 58);
  x.quadraticCurveTo(wx + 20, feet - wh + 24, wx + 8, feet - wh + 4);
  x.closePath(); x.fill();
  neck(x, wx, feet - wh + 21, feet - wh + 54, 21);
  head(x, wx, feet - wh + 21, 21, .16);
  torso(x, wx, feet - wh + 54, feet - wh * .50, 28, 21);
  x.beginPath();                                                          // подол
  x.moveTo(wx - 21, feet - wh * .50);
  x.bezierCurveTo(wx - 34, feet - 86, wx - 52, feet - 44, wx - 62, feet + 2);
  x.quadraticCurveTo(wx - 30, feet - 12, wx + 2, feet + 4);
  x.quadraticCurveTo(wx + 30, feet - 10, wx + 44, feet + 2);
  x.bezierCurveTo(wx + 38, feet - 48, wx + 26, feet - 88, wx + 21, feet - wh * .50);
  x.closePath(); x.fill();
  limb(x, wx + 20, feet - wh + 64, mx - 30, feet - mh + 92, 12, 9);      // её рука к нему
  x.beginPath(); x.ellipse(258, feet + 8, 112, 12, 0, 0, 7); x.fill();
  feather(x, 256, 316, 288);
}

// 2. Карьера: двое у панорамного окна, рукопожатие, за стеклом город
function sceneCity(x) {
  const hz = 344, feet = 452;
  x.fillStyle = vgrad(x, 0, hz, [[0, '#606060'], [.46, '#b4b4b4'], [1, '#fcfcfc']]);
  x.fillRect(0, 0, MOOD_W, hz);
  // Город рисуем СВЕТЛЫМ силуэтом, а не тёмным. Тёмная башня — это дыра в песке, и десять
  // дыр наверху спорят с двумя фигурами: на снимке кадр читался как три светлых блока.
  // Лёгкая дымка вместо силуэта оставляет весь верх песком, и дыры только две — люди.
  x.fillStyle = 'rgba(0,0,0,.12)';
  const towers = [[8, 178, 54], [66, 228, 40], [110, 152, 46], [160, 258, 34], [200, 206, 52],
  [256, 244, 44], [306, 170, 50], [360, 220, 40], [404, 192, 56], [464, 248, 44]];
  for (const [tx, top, tw] of towers) x.fillRect(tx, top, tw, hz - top);
  x.fillStyle = 'rgba(0,0,0,.24)';
  x.fillRect(0, hz - 6, MOOD_W, 6);
  x.fillStyle = vgrad(x, hz, MOOD_H, [[0, '#ededed'], [.46, '#c0c0c0'], [1, '#7c7c7c']]);
  x.fillRect(0, hz, MOOD_W, MOOD_H - hz);
  ripples(x, hz + 10, MOOD_H - 20, 80, 4177);

  x.fillStyle = '#000';
  const h = 292;
  for (const s of [-1, 1]) {
    const cx = 256 + s * 96;
    neck(x, cx, feet - h + 24, feet - h + 60, 23);
    head(x, cx, feet - h + 24, 23, s * .05);
    torso(x, cx, feet - h + 60, feet - h * .45, 43, 28);                 // пиджак шире плеч
    legs(x, cx, feet - h * .45, feet, 28, 14);
    limb(x, cx - s * 32, feet - h + 70, 256 - s * 20, feet - h * .49, 14, 10);
    limb(x, cx + s * 32, feet - h + 70, cx + s * 44, feet - h * .43, 14, 10);
  }
  x.beginPath(); x.ellipse(256, feet - h * .49, 24, 14, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(256, feet + 8, 124, 12, 0, 0, 7); x.fill();
  feather(x, 256, 300, 306);
}

// 3. Самопознание: фигура со спины, полная луна, вода
function sceneNight(x) {
  const hz = 322, base = 438;
  x.fillStyle = vgrad(x, 0, hz, [[0, '#3a3a3a'], [.42, '#8c8c8c'], [.92, '#e4e4e4'], [1, '#f0f0f0']]);
  x.fillRect(0, 0, MOOD_W, hz);
  const moon = x.createRadialGradient(256, 176, 18, 256, 176, 168);
  moon.addColorStop(0, 'rgba(255,255,255,1)');
  moon.addColorStop(.36, 'rgba(255,255,255,.84)');
  moon.addColorStop(.66, 'rgba(255,255,255,.34)');
  moon.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = moon; x.fillRect(0, 0, MOOD_W, hz + 20);
  x.fillStyle = '#fff';
  x.beginPath(); x.arc(256, 168, 92, 0, 7); x.fill();
  x.fillStyle = vgrad(x, hz, MOOD_H, [[0, '#e8e8e8'], [.40, '#bcbcbc'], [.78, '#8a8a8a'], [1, '#606060']]);
  x.fillRect(0, hz, MOOD_W, MOOD_H - hz);
  ripples(x, hz + 4, MOOD_H - 22, 170, 9931);
  x.fillStyle = 'rgba(255,255,255,.40)';                                 // лунная дорожка
  for (let i = 0; i < 18; i++) {
    const y = hz + 6 + i * 11, w = 100 - i * 4.6;
    if (w < 8) break;
    x.fillRect(256 - w / 2, y, w, 4);
  }

  x.fillStyle = '#000';
  // фигуру держим ВЫШЕ нижнего угасания: скрещённые ноги, попав в тень, пропадают,
  // и силуэт читается горой, а не человеком
  x.save(); x.translate(256, 442); x.scale(.82, .82); x.translate(-256, -base);
  x.beginPath(); x.ellipse(256, base - 20, 112, 36, 0, Math.PI, 0); x.fill();   // скрещённые ноги
  x.fillRect(144, base - 22, 224, 24);
  x.beginPath(); x.ellipse(156, base - 24, 32, 22, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(356, base - 24, 32, 22, 0, 0, 7); x.fill();
  x.beginPath();                                                                // спина
  x.moveTo(212, base - 32);
  x.bezierCurveTo(204, base - 116, 212, base - 150, 232, base - 166);
  x.lineTo(280, base - 166);
  x.bezierCurveTo(300, base - 150, 308, base - 116, 300, base - 32);
  x.closePath(); x.fill();
  head(x, 256, base - 192, 28);
  x.beginPath();                                                                // волосы по спине
  x.moveTo(229, base - 198);
  x.bezierCurveTo(209, base - 176, 207, base - 118, 218, base - 74);
  x.quadraticCurveTo(256, base - 60, 294, base - 74);
  x.bezierCurveTo(305, base - 118, 303, base - 176, 283, base - 198);
  x.closePath(); x.fill();
  limb(x, 222, base - 138, 172, base - 40, 16, 11);
  limb(x, 290, base - 138, 340, base - 40, 16, 11);
  x.restore();
  feather(x, 256, 300, 296);
}

// ─────────── раскладка ───────────
function layout(sand, kind = 'love') {
  const W = sand.w, H = sand.h;
  const k = Math.min(1.12, Math.max(0.58, Math.min(W / 390, H / 844)));
  const ratio = photoCanvases?.[kind]
    ? photoCanvases[kind].height / photoCanvases[kind].width
    : kind === 'love' ? 1931 / 2027 : kind === 'career' ? 1 : 383 / 384;
  if (W > H * 1.3 && H < 600) {
    const photoW = Math.min(H * 1.05, W * .48);
    const paneX = photoW + (W - photoW) / 2;
    const tabW = Math.min(320, W - photoW - 36);
    return {
      W, H, k: Math.max(.72, k), textX: paneX, tabX: paneX, tabW,
      titleTop: Math.max(18, H * .055), titleSize: Math.min(34, H * .085),
      subTop: H * .195, subSize: Math.min(16, H * .042),
      optSize: Math.max(24, Math.min(29, H * .075)), pillH: Math.min(46, H * .12),
      img: { x: 0, y: (H - photoW * ratio) / 2,
        w: photoW, h: photoW * ratio },
      optY: i => Math.round(H * .36 + i * H * .15),
      ring: { x: paneX, y: H - 58, r: 23 }
    };
  }
  const titleSize = Math.max(24, Math.round(42 * k));
  const subSize = Math.max(12, Math.round(16 * k));
  const optSize = Math.max(25, Math.round(34 * k));
  const compact = H < 650;
  const pillH = compact ? Math.max(34, Math.round(52 * k)) : Math.max(40, Math.round(56 * k));
  // Figma: кадр шире экрана на ~15%, верх намеренно уходит за край.
  const imgW = Math.round(W * 1.15);
  // У фотографий разная исходная высота: резервируем реальную пропорцию выбранного кадра.
  const imgH = Math.round(imgW * ratio);
  const imgY = -Math.round(39 * k);
  // У фото мягкий нижний сход: композиционная высота — 86% файла, не вся его рамка.
  // Пропорция при этом своя у каждого исходника, поэтому заголовок едет вместе с ним.
  const titleTop = Math.round(Math.min(H * .50, imgY + imgH * .86 + 20 * k));
  const subTop = Math.round(titleTop + titleSize * 1.18 + 10 * k);
  const ringR = compact ? Math.max(19, Math.round(27 * k)) : Math.max(22, Math.round(30 * k));
  const ringY = H - Math.round(compact ? 50 : Math.max(52, 64 * k));
  // Список вариантов живёт между подписью и кольцом. Шаг считаем от свободного места,
  // иначе в альбоме первый вариант садится прямо на подпись.
  const top = Math.round(subTop + subSize * (compact ? 1.6 : 1.9) + (compact ? 14 : 18) * k) + pillH / 2;
  const bottom = ringY - ringR - Math.round((sphereMode ? 62 : 32) * k) - pillH / 2;
  const room = Math.max(0, bottom - top);
  const intervals = Math.max(1, OPTIONS.length - 1);
  const step = Math.min(Math.round(80 * k), room / intervals);
  const first = top + Math.max(0, room - step * intervals) * .5;
  return {
    W, H, k, textX: W / 2, tabX: W / 2, tabW: Math.min(W - 40, 287 * k),
    titleTop, titleSize, subTop, subSize, optSize, pillH,
    img: { x: (W - imgW) / 2, y: imgY, w: imgW, h: imgH },
    optY: i => Math.round(first + step * i),
    ring: { x: W / 2, y: ringY, r: ringR }
  };
}

const hash = n => {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

function fitPoints(src, n) {
  const total = src.length >> 1, pts = new Float32Array(n * 2);
  const tone = new Float32Array(n);
  const occupied = new Set();
  let got = 0;
  // По одной точке на маленькую ячейку: заливка остаётся мелкой и равномерной,
  // а не слипается в случайные крупные острова от повторного выбора целей.
  for (let k = 0; k < total && got < n; k++) {
    const x = src[k * 2], y = src[k * 2 + 1];
    const cell = Math.floor(x / 1.1) + ':' + Math.floor(y / 1.1);
    if (occupied.has(cell)) continue;
    occupied.add(cell);
    pts[got * 2] = x; pts[got * 2 + 1] = y;
    tone[got++] = src.tone ? src.tone[k] : 1;
  }
  for (let j = got; j < n; j++) {
    const k = Math.min(total - 1, Math.floor(j * total / n));
    pts[j * 2] = src[k * 2]; pts[j * 2 + 1] = src[k * 2 + 1];
    tone[j] = src.tone ? src.tone[k] : 1;
  }
  pts.tone = tone;
  return pts;
}

// Полутоновая кромка: одинаково яркие мелкие точки, но их число убывает с
// удалением от контура. Прозрачность здесь не кодирует тон — иначе рамка мутнеет.
function stippledEdge(L, i, n, x, y, w, h) {
  const out = new Float32Array(n * 2), r = h / 2;
  const straight = w - 2 * r, arc = Math.PI * r;
  const perimeter = 2 * straight + 2 * arc;
  const sigma = 4.4 * L.k, maxDepth = Math.min(h / 2 - .5, 18 * L.k);
  const spread = 1 - Math.exp(-maxDepth / sigma);
  for (let j = 0; j < n; j++) {
    let u = (((j + .5) * .61803398875 + i * .137) % 1) * perimeter;
    let px, py, nx, ny;
    if (u < straight) {
      px = -w / 2 + r + u; py = -h / 2; nx = 0; ny = -1;
    } else if ((u -= straight) < arc) {
      const a = -Math.PI / 2 + u / r;
      nx = Math.cos(a); ny = Math.sin(a);
      px = w / 2 - r + r * nx; py = r * ny;
    } else if ((u -= arc) < straight) {
      px = w / 2 - r - u; py = h / 2; nx = 0; ny = 1;
    } else {
      u -= straight;
      const a = Math.PI / 2 + u / r;
      nx = Math.cos(a); ny = Math.sin(a);
      px = -w / 2 + r + r * nx; py = r * ny;
    }
    const depth = -sigma * Math.log(1 - hash(j + i * 100003 + 17) * spread);
    out[j * 2] = x + px - nx * depth + (hash(j * 3 + i * 7919) - .5) * .45;
    out[j * 2 + 1] = y + py - ny * depth + (hash(j * 5 + i * 15427) - .5) * .45;
  }
  return out;
}

// У каждого таба навсегда одни и те же крупинки. В невыбранном состоянии они
// живут лишь в читаемом лейбле и мягкой кромке; в выбранном — заполняют таблетку
// за вычетом точного трафарета букв. Никакого обмена песком между табами.
function tabPoints(sand, L, i, active) {
  const x = L.tabX, y = L.optY(i), w = L.tabW, h = L.pillH;
  // Геометрия и кегль задаются адаптивной раскладкой. При повторном выборе
  // возвращаем те же точки, не пересеивая полутоновую кромку и вырез букв.
  const key = [sand.w, sand.h, OPTIONS[i].label, TAB_GRAINS, i, +active, x, y, w, h, L.optSize].join('|');
  const cached = tabCache.get(key);
  if (cached) { tabCache.delete(key); tabCache.set(key, cached); return cached; }
  let result;
  if (active) result = fitPoints(pillHole(sand, { x, y, w, h,
    label: OPTIONS[i].label, size: L.optSize, font: 'Cormorant, Georgia, serif',
    weight: 400, density: 1.75, pad: .55 }), TAB_GRAINS);
  else {
    const labelN = 3500;
    const label = sand.text(null, OPTIONS[i].label, {
      x, y: midY(OPTIONS[i].label, { size: L.optSize, font: 'Cormorant, Georgia, serif', weight: 400 }, y),
      size: L.optSize, font: 'Cormorant, Georgia, serif', weight: 400,
      align: 'center', baseline: 'middle', count: labelN });
    const edge = stippledEdge(L, i, TAB_GRAINS - labelN, x, y, w, h);
    const pts = new Float32Array(TAB_GRAINS * 2), tone = new Float32Array(TAB_GRAINS);
    for (let j = 0; j < TAB_GRAINS; j++) {
      const isLabel = j < labelN, src = isLabel ? label : edge;
      const k = isLabel ? j % (label.length >> 1) : (j - labelN) % (edge.length >> 1);
      pts[j * 2] = src[k * 2]; pts[j * 2 + 1] = src[k * 2 + 1];
      tone[j] = 1;
    }
    pts.tone = tone;
    result = pts;
  }
  if (tabCache.size >= TAB_CACHE_LIMIT) tabCache.delete(tabCache.keys().next().value);
  tabCache.set(key, result);
  return result;
}

// Дыхание глифа — по росту буквы: поле течения двигает цель на единицы пикселей,
// и то, что для 32 px жизнь, для 13 px превращается в кашу из налезающих букв.
let cur = null;

export async function mount(ctx) {
  const sand = ctx.sand;
  ensureCss();
  sphereMode = ctx.screen === 'sphere';
  OPTIONS = sphereMode ? [{ id: 'love', label: 'Отношения' }, { id: 'career', label: 'Бизнес' }] : DEFAULT_OPTIONS;
  TITLE = sphereMode ? 'Разбор по сфере' : 'Расскажите чаше';
  SUB = sphereMode ? 'Что вы хотите узнать?' : 'Что вас заботит сегодня?';
  TAB_GRAINS = sphereMode ? 17000 : 13000;

  const st = {
    alive: true, timers: [], off: [], resizeT: 0, swapT: 0, imageEpoch: 0,
    active: 0, leaving: false, root: null, hits: [], L: null, tabYs: null, imagePoints: null
  };
  cur = st;

  const session = ctx.session || {};
  const pre = OPTIONS.findIndex(o => o.id === (sphereMode ? session.sphere : session.lens));
  if (pre >= 0) st.active = pre;

  const host = ctx.root || document.body;
  const root = document.createElement('div');
  root.className = 'gl-root';
  host.appendChild(root);
  st.root = root;

  const on = (el, ev, fn) => { el.addEventListener(ev, fn); st.off.push(() => el.removeEventListener(ev, fn)); };
  const after = (ms, fn) => { st.timers.push(setTimeout(() => { if (st.alive) fn(); }, ms)); };

  // хит-зоны: прозрачные кнопки поверх песочных подписей
  for (let i = 0; i < OPTIONS.length; i++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gl-hit';
    b.setAttribute('aria-label', OPTIONS[i].label);
    b.textContent = OPTIONS[i].label;
    b.classList.toggle('active', i === st.active);
    root.appendChild(b); st.hits.push(b);
    on(b, 'pointerdown', e => { e.preventDefault(); pick(i); });
  }
  const next = document.createElement('button');
  next.type = 'button'; next.className = 'gl-hit';
  next.setAttribute('aria-label', 'Дальше');
  next.textContent = '→'; next.classList.add('next');
  root.appendChild(next); st.next = next;
  on(next, 'pointerdown', e => { e.preventDefault(); leave(); });

  const local = e => {
    const r = sand.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  on(sand.canvas, 'pointerdown', e => { const [x, y] = local(e); sand.hit(x, y, 92, 430); });
  on(sand.canvas, 'pointermove', e => { if (e.buttons) { const [x, y] = local(e); sand.hit(x, y, 58, 230); } });

  await Promise.all([sand.ready, loadPhotos()]);
  if (!st.alive) return;

  st.L = layout(sand, OPTIONS[st.active].id);
  st.tabYs = OPTIONS.map((_, i) => st.L.optY(i));
  place(st);
  const reduced = sand.reduced;

  function imagePoints() {
    const L = st.L;
    const points = sand.image(null, moodCanvas(OPTIONS[st.active].id), {
      x: L.img.x, y: L.img.y, w: L.img.w, h: L.img.h,
      sample: 260, count: 26000,
      cacheKey: `lens:${OPTIONS[st.active].id}`,
      gamma: OPTIONS[st.active].id === 'self' ? 1.5 : 1.08,
      floor: OPTIONS[st.active].id === 'self' ? .16 : .07,
      invert: OPTIONS[st.active].id === 'self'
    });
    // Фотографический тон уже задан ЧАСТОТОЙ целей; не приглушаем отдельные зёрна альфой.
    if (points.tone) points.tone.fill(1);
    return points;
  }

  function buildImage(instant) {
    st.imagePoints = imagePoints();
    sand.setTargets(ID.img, st.imagePoints, {
      arrive: 'burst', span: instant ? .12 : .38, rise: .5, wob: .035,
      delay: instant ? 0 : T.img
    });
  }

  function build(instant) {
    const L = st.L, cx = L.textX;
    const d = t => (instant || reduced) ? 0 : t;
    buildImage(instant || reduced);
    sand.text(ID.title, TITLE, {
      x: cx, y: L.titleTop, size: L.titleSize, weight: 500, align: 'center', density: 1.8,
      wob: .04,
      arrive: instant ? 'burst' : 'wave-x', span: instant ? .12 : .62, delay: d(T.title)
    });
    sand.text(ID.sub, SUB, {
      x: cx, y: L.subTop, size: L.subSize, font: SANS, align: 'center', tone: 1, count: 2800,
      wob: .025,
      arrive: instant ? 'burst' : 'wave-x', span: instant ? .12 : .40, delay: d(T.sub)
    });
    // Стрелку резервируем до трёх табов: она не может пропасть из-за лимита пула.
    const arrowButton = pillHole(sand, { x: L.ring.x, y: L.ring.y,
      w: 80 * L.k, h: 56 * L.k, density: 2.0,
      draw(g, w, h) { const x = w / 2, y = h / 2;
        g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x + 12, y);
        g.moveTo(x + 3, y - 10); g.lineTo(x + 13, y); g.lineTo(x + 3, y + 10); g.stroke();
      } });
    sand.setTargets(ID.ring, arrowButton, { wob: .04, gold: -1.45,
      arrive: instant ? 'burst' : 'flow', span: .30, delay: d(T.ring) });
    for (let i = 0; i < OPTIONS.length; i++) {
      sand.setTargets(ID.tab(i), tabPoints(sand, L, i, i === st.active), {
        wob: .004, gold: -1.25, arrive: instant ? 'burst' : 'wave-x',
        span: instant ? .12 : .45, delay: d(T.opts + i * .10)
      });
    }
    if (sphereMode) {
      sand.text(ID.note, 'Второй билет — у бариста за отзыв в 2ГИС', {
        x: L.tabX, y: L.ring.y - Math.max(67, 73 * L.k), size: Math.max(12, 14 * L.k),
        font: SANS, maxWidth: L.tabW + 20, align: 'center', density: 2, wob: .008,
        arrive: 'wave-x', span: .3
      });
      st.back?.destroy();
      st.back = sandButton(ctx, 'lens:back', { x: 35, y: 30, w: 46, h: 38,
        label: '‹', aria: 'Назад', size: 32, filled: false,
        onTap: () => ctx.go(session.storyFromProfile ? 'profile' : 'stories') });
    }
    // DOM остаётся только семантической хит-зоной: подписи всегда видимы в песке.
  }

  build(reduced);

  function pick(i) {
    if (st.leaving || i === st.active || !st.alive) return;
    const prev = st.active;
    st.active = i;
    st.L = layout(sand, OPTIONS[i].id);
    st.L.optY = j => st.tabYs[j];
    place(st);
    st.hits[prev].classList.remove('active', 'settled');
    st.hits[i].classList.add('active');
    st.hits[i].classList.remove('settled');
    if (sphereMode) session.sphere = OPTIONS[i].id; else session.lens = OPTIONS[i].id;
    // Обновляются только два затронутых таба; третий сохраняет цели и крупинки.
    sand.updateTargets(ID.tab(prev), tabPoints(sand, st.L, prev, false));
    sand.updateTargets(ID.tab(i), tabPoints(sand, st.L, i, true));
    st.hits[i].classList.add('settled');
    sand.updateTargets(ID.title, sand.text(null, TITLE, {
      x: st.L.textX, y: st.L.titleTop, size: st.L.titleSize,
      weight: 500, align: 'center', density: 1.8 }));
    sand.updateTargets(ID.sub, sand.text(null, SUB, {
      x: st.L.textX, y: st.L.subTop, size: st.L.subSize,
      font: SANS, align: 'center', count: 2800 }));
    // Фото расходится вихрем из СВОИХ точек и собирается обратно теми же
    // 26 тысячами крупинок — нет пустого окна, пока старая группа освобождается.
    const epoch = ++st.imageEpoch;
    const old = st.imagePoints, next = imagePoints();
    if (old && !sand.reduced) {
      const swirl = new Float32Array(old.length), cx = st.L.img.x + st.L.img.w / 2, cy = st.L.img.y + st.L.img.h * .52;
      swirl.tone = old.tone;
      for (let j = 0; j < old.length / 2; j++) {
        const dx = old[j * 2] - cx, dy = old[j * 2 + 1] - cy;
        const a = .38 + hash(j + epoch * 2971) * .52;
        const r = 1.10 + hash(j ^ 0x395a) * .35;
        swirl[j * 2] = cx + (dx * Math.cos(a) - dy * Math.sin(a)) * r;
        swirl[j * 2 + 1] = cy + (dx * Math.sin(a) + dy * Math.cos(a)) * r;
      }
      sand.updateTargets(ID.img, swirl);
    }
    after(sand.reduced ? 0 : 190, () => {
      if (!st.leaving && epoch === st.imageEpoch) {
        sand.updateTargets(ID.img, next);
        st.imagePoints = next;
      }
    });
  }

  function leave() {
    if (st.leaving) return;
    st.leaving = true;
    for (const hit of st.hits) hit.classList.remove('settled', 'readable');
    st.next.classList.remove('settled');
    if (sphereMode) session.sphere = OPTIONS[st.active].id; else session.lens = OPTIONS[st.active].id;
    sand.release(ID.ring, { style: 'vortex', power: 1.1 });
    for (let i = 0; i < OPTIONS.length; i++) sand.release(ID.tab(i), { style: 'wave-x' });
    sand.release(ID.title, { style: 'wave-x' });
    sand.release(ID.sub, { style: 'wave-x' });
    sand.release(ID.img, { style: 'vortex', power: .85 });
    setTimeout(() => { if (st.alive && ctx.go) ctx.go(sphereMode ? 'sphere-ticket' : 'date'); }, 230);
  }

  on(window, 'resize', () => {
    clearTimeout(st.resizeT);
    st.resizeT = setTimeout(() => {
      if (!st.alive || st.leaving) return;
      sand.resize();
      st.L = layout(sand, OPTIONS[st.active].id);
      st.tabYs = OPTIONS.map((_, i) => st.L.optY(i));
      place(st);
      for (const id of ids()) sand.drop(id);
      build(true);
    }, 180);
  });
}

function ids() {
  const a = [ID.img, ID.title, ID.sub, ID.ring, ID.note];
  for (let i = 0; i < OPTIONS.length; i++) a.push(ID.tab(i));
  return a;
}

function place(st) {
  const L = st.L;
  for (let i = 0; i < st.hits.length; i++) {
    const b = st.hits[i], h = L.pillH, w = L.tabW;
    b.style.left = (L.tabX - w / 2) + 'px';
    b.style.top = (L.optY(i) - h / 2) + 'px';
    b.style.width = w + 'px'; b.style.height = h + 'px';
    b.style.fontSize = L.optSize + 'px';
  }
  // Зона касания покрывает песочную стрелку, но не съедает нижний системный край
  // и не касается последнего таба на коротком Safari viewport.
  const n = st.next, r = Math.max(24, 40 * L.k, L.ring.r + 6);
  n.style.left = (L.ring.x - r) + 'px';
  n.style.top = (L.ring.y - r) + 'px';
  n.style.width = (r * 2) + 'px'; n.style.height = (r * 2) + 'px';
  n.style.fontSize = Math.round(36 * L.k) + 'px';
}

export async function unmount(ctx) {
  const st = cur;
  if (!st) return;
  cur = null;
  st.alive = false;
  st.leaving = true;
  st.back?.destroy();
  clearTimeout(st.resizeT); clearTimeout(st.swapT);
  for (const h of st.timers) clearTimeout(h);
  for (const f of st.off) f();
  const sand = ctx.sand;
  if (!sand.reduced) {
    for (const id of ids()) if (sand.has(id)) sand.release(id, { style: id === ID.img ? 'vortex' : 'wave-x' });
    await new Promise(r => setTimeout(r, 170));
  }
  for (const id of ids()) sand.drop(id);
  if (st.root && st.root.parentNode) st.root.parentNode.removeChild(st.root);
}

// крюк для QA: посмотреть исходную картинку-настроение до раздачи целей
export { moodCanvas as _moodCanvas };
