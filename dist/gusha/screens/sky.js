// Экран 7 · «Взгляните на созвездия / Пока мы ждём послания».
//
// Экран — окно в небо. Курс и наклон телефона (assets/sensors.js) задают направление взгляда,
// assets/sky-data.js и ../sky-extra.js — где какие звёзды. По кадру течёт свободный песок ядра;
// когда взгляд подходит к фигуре, часть крупинок намагничивается на звёзды и пунктир линий.
//
// Что здесь важно понимать.
//
// 1. Небо поворачивается ОДНОЙ подстановкой, а не пересчётом астрономии. Вектор звезды в
//    экваториальной системе e = (cosδ·cos ra, −cosδ·sin ra, sinδ) не зависит от времени; переход
//    в горизонт — поворот на местное звёздное время вокруг полюса плюс наклон на широту.
//    Значит рисунок можно посеять песком один раз и дальше только умножать. Ни одного acos
//    на крупинку за кадр — только на центры фигур, а их полсотни.
//
// 2. Проекция стереографическая: экран = (a,b)·2f/(1+c). Она конформна, то есть не корёжит
//    форму созвездия у края кадра, и не взрывается на широком поле. Гномоническая «честная
//    перспектива» на телефоне дала бы поле около 30° по ширине, а Ковш шире 25° — не влез бы.
//
// 3. Конус магнита 24° по прямому указанию: при 20 созвездиях пользователь видел сектора,
//    где не происходило ничего. Теперь объектов 53 (20 исходных + 13 фигур + 20 россыпей),
//    и при конусе 24° покрыто 98–100 % направлений над горизонтом (проверено счётом по сетке).
//
// 4. Крупинки не пересобираются каждый кадр: группа регистрируется один раз (setTargets), а
//    дальше только ездят её цели (updateTargets). Иначе каждое движение руки стоило бы полного
//    переназначения 46 000 крупинок, и песок бы телепортировался вместо того, чтобы течь.

import { createSensors, needsGesture } from '/assets/sensors.js';
import { CONSTELLATIONS, lst } from '/assets/sky-data.js';
import { EXTRA_CONSTELLATIONS, SCATTERS, LATIN_EXTRA } from '../sky-extra.js';
import { ensureStyle, caption, el, FONT, sleep } from '../ui-kit.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180, HOUR = Math.PI / 12;

const CONE = 24 * DEG;          // конус магнита
const DROP = 32 * DEG;          // гистерезис: отпускаем позже, чем ловим
const FOV = 18 * DEG;           // половина поля по короткой стороне кадра
const MAXLIVE = 7;              // сколько фигур держим собранными разом
const BUDGET = 16000;           // потолок крупинок в сборе: фон не должен обеднеть
const MINALT = -3 * DEG;
const GUIDE_COUNT = 3;

const LATIN = {
  'ursa-major': 'URSA MAIOR', cassiopeia: 'CASSIOPEIA', orion: 'ORION', cygnus: 'CYGNUS',
  lyra: 'LYRA', aquila: 'AQUILA', leo: 'LEO', 'ursa-minor': 'URSA MINOR', scorpius: 'SCORPIUS',
  sagittarius: 'SAGITTARIUS', pegasus: 'PEGASUS', andromeda: 'ANDROMEDA', perseus: 'PERSEUS',
  taurus: 'TAURUS', gemini: 'GEMINI', auriga: 'AURIGA', 'canis-major': 'CANIS MAIOR',
  bootes: 'BOOTES', virgo: 'VIRGO', 'corona-borealis': 'CORONA BOREALIS', ...LATIN_EXTRA
};
const CARD = ['С', 'ССВ', 'СВ', 'ВСВ', 'В', 'ВЮВ', 'ЮВ', 'ЮЮВ', 'Ю', 'ЮЮЗ', 'ЮЗ', 'ЗЮЗ', 'З', 'ЗСЗ', 'СЗ', 'ССЗ'];

const clamp1 = v => v < -1 ? -1 : v > 1 ? 1 : v;
const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Свой поток случайности: посев неба не должен зависеть от того, сколько раз до него
// подёргали Math.random в других экранах — иначе рисунок звёзд шевелится между заходами.
let rs = 0x2f6e2b1;
const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; };
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;

// --- сферическая мелочь ---
const e0Of = (raH, decDeg) => {
  const ra = raH * HOUR, d = decDeg * DEG, cd = Math.cos(d);
  return [cd * Math.cos(ra), -cd * Math.sin(ra), Math.sin(d)];
};
const unit = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function tangent(e) {
  const h = Math.abs(e[2]) > .9 ? [1, 0, 0] : [0, 0, 1];
  const d = h[0] * e[0] + h[1] * e[1] + h[2] * e[2];
  const u = unit([h[0] - e[0] * d, h[1] - e[1] * d, h[2] - e[2] * d]);
  const v = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]];
  return [u, v];
}
const nudge = (e, u, v, a, b) => unit([e[0] + u[0] * a + v[0] * b, e[1] + u[1] * a + v[1] * b, e[2] + u[2] * a + v[2] * b]);
function slerp(a, b, t) {
  const d = clamp1(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]), o = Math.acos(d);
  if (o < 1e-6) return a.slice();
  const s = Math.sin(o), k1 = Math.sin((1 - t) * o) / s, k2 = Math.sin(t * o) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

// --- каталог ---
export const OBJECTS = [
  ...CONSTELLATIONS.map(c => ({ src: c, kind: 'con' })),
  ...EXTRA_CONSTELLATIONS.map(c => ({ src: c, kind: 'con' })),
  ...SCATTERS.map(c => ({ src: c, kind: 'dust' }))
].map(({ src, kind }) => {
  const byId = {}; let cx = 0, cy = 0, cz = 0;
  for (const s of src.stars) { const e = byId[s.id] = e0Of(s.ra, s.dec); cx += e[0]; cy += e[1]; cz += e[2]; }
  const c = unit([cx, cy, cz]);
  // Угловой радиус фигуры нужен, чтобы понимать, влезает ли она в кадр целиком.
  let rad = 0;
  for (const s of src.stars) {
    const e = byId[s.id];
    const a = Math.acos(clamp1(e[0] * c[0] + e[1] * c[1] + e[2] * c[2]));
    if (a > rad) rad = a;
  }
  return {
    id: src.id, name: src.name, kind, byId, lines: src.lines || [], stars: src.stars,
    cx: c[0], cy: c[1], cz: c[2], rad, seed: null, buf: null, tone: null,
    live: false, str: 0, sx: 0, sy: 0, ang: Math.PI, alt: 0, az: 0, el: null
  };
});

// Посев: 55 % крупинок на звёзды (по яркости), 45 % на пунктир линий (по длине).
// У россыпи линий нет, все крупинки уходят в узелки — она и должна читаться как горсть.
function seedObject(o, N) {
  if (o.seed && o.seed.n >= N) return o.seed;
  const E = [], TN = [];
  const wStar = o.stars.map(s => Math.max(.25, 4.6 - s.mag));
  const sumS = wStar.reduce((a, b) => a + b, 0) || 1;
  const segs = [];
  let sumL = 0;
  for (const [ia, ib] of o.lines) {
    const ea = o.byId[ia], eb = o.byId[ib]; if (!ea || !eb) continue;
    const ang = Math.acos(clamp1(ea[0] * eb[0] + ea[1] * eb[1] + ea[2] * eb[2]));
    segs.push({ ea, eb, ang }); sumL += ang;
  }
  const nLine = segs.length ? Math.round(N * .45) : 0, nStar = N - nLine;
  o.stars.forEach((s, i) => {
    const e = o.byId[s.id];
    const n = Math.max(8, Math.round(nStar * wStar[i] / sumS));
    const bright = Math.max(0, Math.min(1, (3.6 - s.mag) / 3.4));
    const sig = (.11 + .17 * bright) * DEG;
    const [u, v] = tangent(e);
    for (let k = 0; k < n; k++) {
      const r = sig * Math.sqrt(-2 * Math.log(1 - rnd() * .94)), th = rnd() * TAU;
      const p = nudge(e, u, v, r * Math.cos(th), r * Math.sin(th));
      E.push(p[0], p[1], p[2]);
      const core = Math.exp(-.5 * (r / sig) * (r / sig));
      TN.push(.42 + .58 * core);
    }
  });
  for (const sg of segs) {
    const n = Math.max(6, Math.round(nLine * sg.ang / (sumL || 1)));
    const dash = Math.max(1, Math.round(sg.ang / (1.5 * DEG)));
    for (let k = 0; k < n; k++) {
      const d = (k % dash + .30 + rnd() * .40) / dash;                 // пунктир, а не сплошная нить
      const p0 = slerp(sg.ea, sg.eb, Math.max(0, Math.min(1, d)));
      const [u, v] = tangent(p0);
      const p = nudge(p0, u, v, gauss() * .055 * DEG, gauss() * .055 * DEG);
      E.push(p[0], p[1], p[2]); TN.push(.34 + .18 * rnd());
    }
  }
  const n = TN.length;
  o.seed = { n, E: new Float32Array(E), tone: new Float32Array(TN) };
  o.buf = new Float32Array(n * 2);
  o.buf.tone = new Float32Array(n);
  return o.seed;
}

let S = null;

export async function mount(ctx) {
  ensureStyle();
  ctx.root.classList.add('groot');
  const sand = ctx.sand;
  await sand.ready;

  const q = new URLSearchParams(location.search);
  const s = S = {
    ctx, sand, root: ctx.root, dead: false, nodes: [], raf: 0, phase: 'title',
    lat: q.has('lat') ? parseFloat(q.get('lat')) : 43.2389,
    lon: q.has('lon') ? parseFloat(q.get('lon')) : 76.8897,
    tOff: 0, live: [], guides: [], last: 0, slow: 0, labelCache: new Map()
  };
  const tFix = q.get('t') ? Date.parse(q.get('t')) : NaN;
  if (isFinite(tFix)) s.tOff = tFix - Date.now();

  // --- заголовок ---
  const W = sand.w, H = sand.h;
  const titleScale = Math.min(1.12, W / 375, H / 720);
  sand.text('sk-title', 'Взгляните\nна созвездия', {
    x: W / 2, y: Math.round(H - 181 * titleScale), size: Math.round(52 * titleScale),
    weight: 500, align: 'center', density: 1.08,
    font: FONT.serif, lineHeight: 1.16, arrive: 'wave-x', span: .84
  });
  sand.text('sk-sub', 'Пока мы ждём послания', {
    x: W / 2, y: Math.round(H - 59 * titleScale), size: 17, font: FONT.sans,
    align: 'center', density: 1.8, tone: .78, wob: .015,
    arrive: 'wave-x', span: .44, delay: .28
  });

  // --- сцена ---
  s.labels = el('div', null, s.root);
  s.labels.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  for (let i = 0; i < GUIDE_COUNT; i++) {
    const name = el('div', 'gname', s.labels);
    name.style.fontSize = '14px';
    name.style.letterSpacing = '.04em';
    name.style.visibility = 'hidden';
    s.guides.push({ id: 'sk-guide-' + i, object: null, name, points: new Float32Array(320) });
  }
  const hud = el('div', 'ghud', s.root);
  hud.style.bottom = 'max(18px,env(safe-area-inset-bottom))';
  hud.style.opacity = '0'; hud.style.transition = 'none';
  s.hudEl = hud;
  s.course = el('div', null, hud);
  s.near = el('div', null, hud);
  s.near.style.cssText = 'margin-top:5px;font-size:11px;letter-spacing:.14em;opacity:.72';
  s.nodes.push(s.labels, hud);

  // --- датчики ---
  s.sensors = ctx.sensors || createSensors({ loopPeriod: 9 });
  s.ownSensors = !ctx.sensors;
  s.sensors.start();
  if (needsGesture && s.sensors.permission === 'prompt') {
    const g = caption(s.root, '<span class="glink">Коснитесь, чтобы включить датчики</span>', Math.round(H * .72), 'dim');
    g.querySelector('.glink').style.color = 'transparent';
    sand.text('sk-permission', 'Коснитесь, чтобы включить датчики', {
      x: W / 2, y: Math.round(H * .72), size: 16, font: FONT.sans,
      align: 'center', density: 1.8, wob: .015, arrive: 'wave-x', span: .4
    });
    g.querySelector('.glink').addEventListener('click', async () => {
      await s.sensors.requestPermission(); g.remove(); sand.drop('sk-permission');
    });
    s.nodes.push(g);
  }

  // касание распыляет песок под пальцем — небо можно потрогать
  s.onPointer = e => {
    const r = sand.canvas.getBoundingClientRect();
    sand.hit(e.clientX - r.left, e.clientY - r.top, 88, e.type === 'pointerdown' ? 400 : 200);
  };
  s.onDrag = ev => { if (ev.buttons) s.onPointer(ev); };
  sand.canvas.addEventListener('pointerdown', s.onPointer);
  sand.canvas.addEventListener('pointermove', s.onDrag);

  // Небо само по себе не зависит от раскладки: проекция считается от текущего размера холста
  // каждый кадр. Переставить нужно только заголовок, пока он ещё на экране.
  s.onResize = () => {
    clearTimeout(s.rt);
    s.rt = setTimeout(() => {
      if (s.dead) return;
      if (s.phase === 'title' && sand.has('sk-title')) {
        const k = Math.min(1.12, sand.w / 375, sand.h / 720);
        sand.text('sk-title', 'Взгляните\nна созвездия', {
          x: sand.w / 2, y: Math.round(sand.h - 181 * k), size: Math.round(52 * k),
          weight: 500, align: 'center', density: 1.08,
          font: FONT.serif, lineHeight: 1.16, arrive: 'burst', span: .2
        });
        sand.text('sk-sub', 'Пока мы ждём послания', {
          x: sand.w / 2, y: Math.round(sand.h - 59 * k), size: 17, font: FONT.sans,
          align: 'center', density: 1.8, tone: .78, wob: .015,
          arrive: 'burst', span: .16
        });
      }
      for (const o of s.live) {
        sand.drop(o.id); o.live = false;
        dropSandLabel(s, 'sk-name-' + o.id); dropSandLabel(s, 'sk-latin-' + o.id);
        if (o.el) { o.el.remove(); o.el = null; }
      }
      for (const g of s.guides) dropSandLabel(s, g.id + '-label');
      dropSandLabel(s, 'sk-course'); dropSandLabel(s, 'sk-near');
      s.live.length = 0;
    }, 280);
  };
  addEventListener('resize', s.onResize);

  camera(s, 0);                      // начальная рама, чтобы первый кадр уже смотрел на фигуру
  s.last = performance.now();
  s.raf = requestAnimationFrame(t => frame(s, t));

  // Заголовок держим ровно столько, чтобы его прочли, и уводим той же волной.
  (async () => {
    await sleep(sand.reduced ? 0 : 2700);
    if (s.dead || s.phase !== 'title') return;
    s.phase = 'sky';
    sand.release('sk-title', { style: 'wave-x' });
    sand.release('sk-sub', { style: 'wave-x' });
  })();

  return s;
}

export async function unmount() {
  const s = S; if (!s) return;
  s.dead = true; S = null;
  if (s.raf) cancelAnimationFrame(s.raf);
  clearTimeout(s.rt); removeEventListener('resize', s.onResize);
  s.sand.canvas.removeEventListener('pointerdown', s.onPointer);
  s.sand.canvas.removeEventListener('pointermove', s.onDrag);
  if (s.ownSensors) s.sensors.stop();
  for (const o of s.live) { s.sand.drop(o.id); o.live = false; if (o.el) { o.el.remove(); o.el = null; } }
  for (const g of s.guides) s.sand.drop(g.id);
  s.live.length = 0;
  for (const n of s.nodes) n.remove();
  for (const id of s.sand.groups) if (id.startsWith('sk-')) s.sand.drop(id);
}

// ─────────────── камера ───────────────
// Без датчиков камера не замирает: она сама обходит небо от фигуры к фигуре, а поверх лежит
// дрожь руки — два процесса Орнштейна–Уленбека. У ОУ нет спектральных линий, поэтому обход
// не считывается как заученная петля.
const tourState = () => ({
  az: 0, alt: 1, fromAz: 0, fromAlt: 1, toAz: 0, toAlt: 1, t: 0, phase: 'hold',
  last: -1, init: false, hold: 7.5, dur: 6.5, a: 0, b: 0, tAz: 0, tAlt: 0
});
function pickTarget(s) {
  const T = s.tour;
  let best = null, bestD = 1e9, any = null, anyD = 1e9;
  for (let i = 0; i < OBJECTS.length; i++) {
    const c = OBJECTS[i];
    if (c.kind !== 'con' || c.alt < 16 * DEG) continue;
    let d = (c.az - T.az) % TAU; if (d < 0) d += TAU;
    if (d < anyD) { anyD = d; any = { i, az: c.az, alt: c.alt }; }
    if (i === T.last || d < 12 * DEG) continue;
    if (d < bestD) { bestD = d; best = { i, az: c.az, alt: c.alt }; }
  }
  return best || any;
}
function camera(s, dt) {
  if (!s.tour) { s.tour = tourState(); s.liveMix = 0; s.cam = { az: 0, alt: 1, roll: 0 }; }
  const T = s.tour, st = s.sensors ? s.sensors.state : null;
  const live = st && st.mode === 'live';
  s.liveMix += ((live ? 1 : 0) - s.liveMix) * (1 - Math.exp(-dt / .8));

  if (!s.sand.reduced && dt > 0) {
    const k = Math.exp(-dt / 5.5), sg = Math.sqrt(1 - k * k);
    T.a = T.a * k + gauss() * sg; T.b = T.b * k + gauss() * sg;
    T.tAz = Math.tanh(T.a) * .024; T.tAlt = Math.tanh(T.b) * .017;   // дрожь руки, ~1.4°
  }
  if (!T.init) {
    placeAll(s);
    const g = pickTarget(s);
    if (g) { T.az = T.fromAz = T.toAz = g.az; T.alt = T.fromAlt = T.toAlt = g.alt; T.last = g.i; T.init = true; }
  } else if (!s.sand.reduced && dt > 0) {
    T.t += dt;
    if (T.phase === 'hold') {
      if (T.t >= T.hold) {
        const g = pickTarget(s); T.t = 0;
        if (g) {
          T.fromAz = T.az; T.fromAlt = T.alt;
          T.toAz = T.az + wrapPi(g.az - T.az); T.toAlt = g.alt; T.last = g.i; T.phase = 'move';
        }
      }
    } else {
      const u = Math.min(1, T.t / T.dur), e = u * u * u * (u * (u * 6 - 15) + 10);
      T.az = T.fromAz + (T.toAz - T.fromAz) * e;
      T.alt = T.fromAlt + (T.toAlt - T.fromAlt) * e;
      if (u >= 1) { T.phase = 'hold'; T.t = 0; }
    }
  }
  const tAz = T.az + T.tAz, tAlt = Math.max(-.20, Math.min(1.46, T.alt + T.tAlt));
  const lAz = st ? st.heading : tAz;
  const lAlt = st ? Math.max(-.30, Math.min(1.46, Math.PI / 2 - st.pitch)) : tAlt;
  const az = tAz + wrapPi(lAz - tAz) * s.liveMix;
  const alt = tAlt + (lAlt - tAlt) * s.liveMix;
  const roll = st ? st.roll * (.45 + .55 * s.liveMix) : 0;
  s.cam.az = az; s.cam.alt = alt; s.cam.roll = roll;

  const ca = Math.cos(alt), sa = Math.sin(alt), cz = Math.cos(az), sz = Math.sin(az);
  const Fx = ca * sz, Fy = sa, Fz = ca * cz;                 // взгляд: восток, верх, север
  const r0x = cz, r0z = -sz;
  const u0x = Fy * r0z, u0y = Fz * r0x - Fx * r0z, u0z = -Fy * r0x;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  s.F = [Fx, Fy, Fz];
  s.R = [r0x * cr + u0x * sr, u0y * sr, r0z * cr + u0z * sr];
  s.U = [-r0x * sr + u0x * cr, u0y * cr, -r0z * sr + u0z * cr];
}

// ─────────────── небо → экран ───────────────
function skyMatrix(s) {
  const th = lst(s.lon, new Date(Date.now() + s.tOff));
  s.cT = Math.cos(th); s.sT = Math.sin(th);
  const phi = s.lat * DEG;
  s.cP = Math.cos(phi); s.sP = Math.sin(phi);
}
// e (экватор) → горизонт (x восток, y вверх, z север) → камера
function horizon(s, ex, ey, ez, out) {
  const A = s.cT * ex - s.sT * ey, B = s.sT * ex + s.cT * ey, C = ez;
  out[0] = -B; out[1] = A * s.cP + C * s.sP; out[2] = -A * s.sP + C * s.cP;
}
// До первого кадра рамы камеры ещё нет: здесь нужны только высота и азимут центров,
// по ним обход выбирает, куда смотреть первым делом.
function placeAll(s) {
  skyMatrix(s);
  const h = [0, 0, 0];
  for (const o of OBJECTS) {
    horizon(s, o.cx, o.cy, o.cz, h);
    o.hx = h[0]; o.hy = h[1]; o.hz = h[2];
    o.alt = Math.asin(clamp1(h[1]));
    o.az = (Math.atan2(h[0], h[2]) + TAU) % TAU;
  }
}

// ─────────────── кадр ───────────────
function frame(s, now) {
  if (s.dead) return;
  s.raf = requestAnimationFrame(t => frame(s, t));
  const dt = Math.min(.05, Math.max(.001, (now - s.last) / 1000));
  s.last = now;
  if (document.hidden) return;
  if (s.sand.reduced) { s.slow += dt; if (s.slow < 1.2) return; s.slow = 0; }

  const sand = s.sand;
  s.W2 = sand.w / 2; s.H2 = sand.h / 2;
  s.foc = (Math.min(sand.w, sand.h) / 2) / (2 * Math.tan(FOV / 2));
  s.diag = Math.hypot(s.W2, s.H2) * 1.35;

  camera(s, sand.reduced ? 0 : dt);
  skyMatrix(s);
  sand.wind(s.sensors ? s.sensors.state : null);
  // Свет держится у верхней кромки и слегка ходит с наклоном: блик на крупинках оживает,
  // но источник остаётся одним и узнаваемым, а не бегает по кадру.
  if (s.sensors) {
    const st = s.sensors.state;
    sand.light({ x: .48 + .22 * Math.tanh(st.roll), y: -.58, z: .62 });
  }

  const h = [0, 0, 0];
  const want = [];
  for (const o of OBJECTS) {
    horizon(s, o.cx, o.cy, o.cz, h);
    o.hx = h[0]; o.hy = h[1]; o.hz = h[2];
    o.alt = Math.asin(clamp1(h[1]));
    o.az = (Math.atan2(h[0], h[2]) + TAU) % TAU;
    const c = h[0] * s.F[0] + h[1] * s.F[1] + h[2] * s.F[2];
    o.ang = Math.acos(clamp1(c));
    const k = 2 * s.foc / Math.max(.25, 1 + c);
    o.sx = s.W2 + (h[0] * s.R[0] + h[1] * s.R[1] + h[2] * s.R[2]) * k;
    o.sy = s.H2 - (h[0] * s.U[0] + h[1] * s.U[1] + h[2] * s.U[2]) * k;
    const gate = o.live ? DROP : CONE;
    if (o.alt > MINALT && o.ang < gate + o.rad * .55) want.push(o);
  }
  want.sort((a, b) => a.ang - b.ang);

  if (s.phase === 'sky') {
    // отпускаем то, что ушло из конуса
    for (let i = s.live.length - 1; i >= 0; i--) {
      const o = s.live[i];
      if (want.indexOf(o) < 0 || s.live.indexOf(o) >= MAXLIVE) {
        sand.release(o.id, { style: o.kind === 'dust' ? 'stream' : pickRelease() });
        o.live = false; s.live.splice(i, 1);
        dropSandLabel(s, 'sk-name-' + o.id);
        dropSandLabel(s, 'sk-latin-' + o.id);
        if (o.el) { o.el.remove(); o.el = null; }
      }
    }
    // ловим новое, пока есть бюджет
    let used = 0;
    for (const o of s.live) used += o.seed ? o.seed.n : 0;
    // sand.free — честный перебор всех крупинок; за кадр его спрашиваем ровно один раз
    // и дальше считаем сами, иначе полсотни кандидатов дадут два миллиона лишних шагов.
    let freeNow = -1;
    for (const o of want) {
      if (o.live) continue;
      if (s.live.length >= MAXLIVE) break;
      const N = o.kind === 'dust' ? 420 : Math.min(1900, 340 + o.stars.length * 110 + o.lines.length * 62);
      if (used + N > BUDGET) continue;
      if (freeNow < 0) freeNow = sand.free;
      if (freeNow < N + 900) break;
      seedObject(o, N);
      project(s, o);
      sand.setTargets(o.id, o.buf, {
        arrive: 'flow', span: .55, rise: .8, tone: .95,
        gold: o.kind === 'dust' ? .18 : .34, wob: .55
      });
      o.live = true; used += o.seed.n; freeNow -= o.seed.n; s.live.push(o);
      if (o.kind === 'con') {
        o.el = el('div', 'gname', s.labels, o.name + '<i>' + (LATIN[o.id] || '') + '</i>');
        o.el.style.visibility = 'hidden';
      }
    }
  }

  // цели едут, группы не пересобираются
  for (const o of s.live) {
    o.str += (smooth01(CONE + 4 * DEG, CONE - 12 * DEG, o.ang) - o.str) * Math.min(1, dt * 2.6);
    project(s, o);
    sand.updateTargets(o.id, o.buf);
    if (o.el) {
      // Подпись садится ПОД рисунок: на звёздах она спорит с фигурой, а фигура здесь главное.
      // Если внизу места нет — уходит наверх; по горизонтали зажимаем, чтобы не резалась кромкой.
      const W = s.W2 * 2, H = s.H2 * 2;
      let ly = o.by1 + 26;
      if (ly > H - 96) ly = Math.max(52, o.by0 - 34);
      const lx = Math.max(78, Math.min(W - 78, o.bx));
      ly = Math.max(48, Math.min(H - 84, ly));
      o.el.style.transform = 'translate(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px) translate(-50%,-50%)';
      o.el.style.opacity = (.14 + .76 * o.str).toFixed(3);
      paintSandLabel(s, 'sk-name-' + o.id, o.name, lx, ly - 8, 23, .9);
      if (LATIN[o.id]) paintSandLabel(s, 'sk-latin-' + o.id, LATIN[o.id], lx, ly + 16, 12, .65);
    }
  }

  if (s.phase === 'sky') { guides(s); hud(s); }
}

// Три ближайшие фигуры за кромкой экрана. Метка и стрелка состоят из тех же
// крупинок, что и звёзды; индекс крупинки в группе не меняется при повороте.
function guides(s) {
  const W = s.W2 * 2, H = s.H2 * 2;
  const candidates = OBJECTS.filter(o => o.kind === 'con' && !o.live && o.alt > MINALT &&
    o.ang < 78 * DEG && (o.sx < 28 || o.sx > W - 28 || o.sy < 48 || o.sy > H - 108));
  candidates.sort((a, b) => a.ang - b.ang);
  const chosen = [];
  for (const g of s.guides) {
    if (g.object && candidates.includes(g.object) &&
        g.object.ang < (candidates[0]?.ang || 0) + 9 * DEG) chosen.push(g.object);
  }
  for (const o of candidates) if (chosen.length < GUIDE_COUNT && !chosen.includes(o)) chosen.push(o);
  for (let j = 0; j < GUIDE_COUNT; j++) {
    const g = s.guides[j], o = chosen[j];
    if (!o) { if (g.object) s.sand.release(g.id, { style: 'stream' }); g.object = null; g.name.style.opacity = '0'; dropSandLabel(s, g.id + '-label'); continue; }
    const dx = o.sx - s.W2, dy = o.sy - s.H2;
    const edge = Math.min((s.W2 - 35) / Math.max(1, Math.abs(dx)),
      (s.H2 - 126) / Math.max(1, Math.abs(dy)));
    const x = s.W2 + dx * edge, y = s.H2 + dy * edge;
    const a = Math.atan2(dy, dx), ux = Math.cos(a), uy = Math.sin(a);
    const nx = -uy, ny = ux, p = g.points;
    // Острие + облако позади него: локальная случайность фиксирована по индексу.
    for (let i = 0; i < 160; i++) {
      const q = (i * 0.61803398875) % 1, v = (i * 0.7548776662) % 1;
      const back = 3 + Math.sqrt(q) * 14;
      const side = (v - .5) * (2 + back * .42);
      p[i * 2] = x - ux * back + nx * side;
      p[i * 2 + 1] = y - uy * back + ny * side;
    }
    if (g.object) s.sand.updateTargets(g.id, p);
    else s.sand.setTargets(g.id, p, { arrive: 'flow', span: .45, tone: 1, gold: .55, wob: .16 });
    if (g.object !== o) g.name.textContent = o.name;
    g.object = o;
    const lx = Math.max(75, Math.min(W - 75, x - ux * 58));
    const ly = Math.max(42, Math.min(H - 116, y - uy * 42));
    g.name.style.transform = `translate(${Math.round(lx)}px,${Math.round(ly)}px) translate(-50%,-50%)`;
    g.name.style.opacity = '.8';
    paintSandLabel(s, g.id + '-label', o.name, lx, ly, 15, .8);
  }
}

function project(s, o) {
  const sd = o.seed, E = sd.E, T = sd.tone, out = o.buf, tn = out.tone;
  const cT = s.cT, sT = s.sT, cP = s.cP, sP = s.sP;
  const Fx = s.F[0], Fy = s.F[1], Fz = s.F[2];
  const Rx = s.R[0], Ry = s.R[1], Rz = s.R[2];
  const Ux = s.U[0], Uy = s.U[1], Uz = s.U[2];
  const W2 = s.W2, H2 = s.H2, foc = s.foc, lim = s.diag;
  const str = .34 + .66 * o.str;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0, j = 0; i < sd.n; i++, j += 3) {
    const ex = E[j], ey = E[j + 1], ez = E[j + 2];
    const A = cT * ex - sT * ey, B = sT * ex + cT * ey;
    const X = -B, Y = A * cP + ez * sP, Z = -A * sP + ez * cP;
    const c = X * Fx + Y * Fy + Z * Fz;
    let k = 2 * foc / Math.max(.25, 1 + c);
    let px = (X * Rx + Y * Ry + Z * Rz) * k, py = (X * Ux + Y * Uy + Z * Uz) * k;
    // За спиной проекция уходит в бесконечность: крупинка улетела бы из кадра насовсем.
    // Зажимаем радиус — цель остаётся у кромки, и песок возвращается, едва фигура войдёт в кадр.
    const r = Math.hypot(px, py);
    if (r > lim) { const f = lim / r; px *= f; py *= f; }
    const sx = W2 + px, sy = H2 - py;
    out[i * 2] = sx; out[i * 2 + 1] = sy;
    if (sx < x0) x0 = sx; if (sx > x1) x1 = sx;
    if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    tn[i] = T[i] * str;
  }
  o.bx = (x0 + x1) / 2; o.by1 = y1; o.by0 = y0;
}

const RELEASES = ['burst', 'stream', 'strands', 'vortex'];
let relN = 0;
const pickRelease = () => RELEASES[(relN++) % RELEASES.length];

function dropSandLabel(s, id) {
  if (s.labelCache.delete(id)) s.sand.drop(id);
}

function paintSandLabel(s, id, label, x, y, size, tone = .85) {
  const now = performance.now(), prev = s.labelCache.get(id);
  if (prev && prev.label === label && now - prev.t < 520 &&
      Math.hypot(x - prev.x, y - prev.y) < 12) return;
  const base = prev && prev.label === label ? prev.base : s.sand.text(null, label, {
    x: 0, y: 0, size, font: size < 17 ? FONT.sans : FONT.serif, align: 'center',
    density: 1.65, count: size < 17 ? 900 : 1700
  });
  const points = new Float32Array(base.length); points.tone = base.tone;
  for (let i = 0; i < base.length; i += 2) {
    points[i] = base[i] + x; points[i + 1] = base[i + 1] + y;
  }
  if (prev && prev.label === label && s.sand.has(id)) s.sand.updateTargets(id, points);
  else s.sand.setTargets(id, points, { arrive: 'flow', span: .26, tone, wob: .025 });
  s.labelCache.set(id, { label, x, y, t: now, base });
}

function hud(s) {
  const deg = (s.cam.az * 180 / Math.PI % 360 + 360) % 360;
  const card = CARD[Math.round(deg / 22.5) % 16];
  const line = '<b>' + card + '</b> · ' + Math.round(deg) + '°';
  if (line !== s.courseTxt) { s.courseTxt = line; s.course.innerHTML = line; }
  const H = s.H2 * 2, W = s.W2 * 2;
  paintSandLabel(s, 'sk-course', card + ' · ' + Math.round(deg / 5) * 5 + '°', W / 2, H - 49, 16, .85);
  let best = null;
  for (const o of s.live) if (o.kind === 'con' && (!best || o.ang < best.ang)) best = o;
  if (!best) for (const o of OBJECTS) if (o.kind === 'con' && o.alt > MINALT && (!best || o.ang < best.ang)) best = o;
  const nm = best ? (best.ang < CONE ? best.name : 'ближе всего · ' + best.name) : '';
  if (nm !== s.nearTxt) { s.nearTxt = nm; s.near.textContent = nm; }
  if (nm) paintSandLabel(s, 'sk-near', nm, W / 2, H - 29, 15, .72);
  else dropSandLabel(s, 'sk-near');
}

// Для отладки и e2e.
export function _state() {
  const s = S; if (!s) return null;
  return {
    phase: s.phase, az: s.cam ? s.cam.az : 0, alt: s.cam ? s.cam.alt : 0,
    live: s.live.map(o => ({ id: o.id, kind: o.kind, ang: +(o.ang / DEG).toFixed(1), n: o.seed.n, str: +o.str.toFixed(2) })),
    guides: s.guides.map(g => g.object?.id || null),
    free: s.sand.free
  };
}
export function _look(azDeg, altDeg) {
  const s = S; if (!s) return false;
  s.tour.az = azDeg * DEG; s.tour.alt = altDeg * DEG;
  s.tour.toAz = s.tour.az; s.tour.toAlt = s.tour.alt; s.tour.phase = 'hold'; s.tour.t = 0;
  s.tour.tAz = 0; s.tour.tAlt = 0; s.tour.a = 0; s.tour.b = 0;
  s.tour.hold = 1e9;
  return true;
}
export function _skipTitle() {
  const s = S; if (!s || s.phase !== 'title') return false;
  s.phase = 'sky'; s.sand.release('sk-title', { style: 'wave-x' });
  s.nodes[0].style.opacity = '0'; s.hudEl.style.opacity = '1';
  return true;
}
