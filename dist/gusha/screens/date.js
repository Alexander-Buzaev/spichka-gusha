// Экран 3 «Дата рождения» — три кольцевых колеса из песка.
//
// Замысел (см. figma node 2029-1344, кадр f-date.png): день, месяц и год лежат дугами внизу
// экрана, выбранное значение стоит на вершине дуги, соседние уезжают по окружности и наклоняются
// вместе с ней. В Figma края дуг затянуты градиентом; здесь вместо градиента работает песок —
// к краю значение рассыпается на крупинки и уносится за вьюпорт, а с противоположной стороны
// из потока собирается следующее. Направление определяется тем, куда крутит человек.
//
// Сверху — заголовок, созвездие знака (zodiac.js) и его имя в родительном падеже. При смене
// знака прежние крупинки переезжают в новый рисунок, без роспуска группы.
//
// Экран не рисует сам: он двигает цели ядра sand.js и держит собственный rAF только под логику
// колёс. tick/draw остаются за app.js.

import { signFor, sandPoints, starsToScreen } from '../zodiac.js';
import { pillHole } from '../ui-kit.js';

const MONTHS = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
const YEAR_MIN = 1940, YEAR_MAX = 2010;
const PHI = 0.6180339887498949;
const TAU = Math.PI * 2;

// Направления для рассыпания: золотой угол даёт равномерный веер без повторов и без хеш-шума.
const DIRS = (() => {
  const n = 97, a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const t = i * 2.399963229728653; a[i * 2] = Math.cos(t); a[i * 2 + 1] = Math.sin(t); }
  return a;
})();

const MAXV = 4.6;                    // значений в секунду: быстрее глаз уже не читает ни одного
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const daysInMonth = (m, y) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

let S = null;                       // экран на странице один; состояние держим здесь

// ---------------------------------------------------------------------------- вёрстка

function layout(sand) {
  const W = sand.w, H = sand.h, cx = W / 2;
  const k = clamp(H / 844, .58, 1.18);
  const L = { W, H, cx };
  // Кегли ограничены и по ширине, и по высоте: в альбоме экран низкий, и «05» кеглем в 48 px
  // съедает половину кадра.
  L.dSize = Math.min(W * .123, H * .088);
  L.mSize = Math.min(W * .087, H * .062);
  L.ySize = Math.min(W * .077, H * .055);

  // низ собираем от нижней кромки: кнопка, затем три дуги вверх
  L.btnH = Math.round(Math.min(56, H * .085));
  L.btnW = Math.round(Math.min(80 * k, W * .30));
  // Все дуги и разделители концентричны, как три окружности в макете 375×720.
  L.btnY = Math.min(H * (674 / 720), H - L.btnH / 2 - 20);
  L.rows = [H * (405 / 720), H * (505 / 720), H * (592 / 720)];
  L.arcCy = H * (781 / 720);

  // верх — сверху вниз, остаток отдаём созвездию
  L.titleSize = Math.min(42, W * .108, H * .060);
  L.titleY = Math.max(12, H * (27 / 720));
  L.nameSize = Math.min(40, W * .102, H * .056);
  const nameH = L.nameSize * 1.54;
  L.signH = Math.max(40, Math.min(H * .16, L.rows[0] - H * .19));
  L.signW = W * .62;
  L.signCy = H * (183 / 720);
  L.nameY = H * (245 / 720);
  L.hintY = H * (301 / 720);
  L.hintOn = L.hintY > L.nameY + nameH - 4;
  return L;
}

// ---------------------------------------------------------------------------- колёса

function makeWheel(st, key, opts) {
  const w = {
    key, ...opts,
    off: 0, v: 0, rev: 0, drag: null, lastOff: NaN, dirty: true,
    cache: new Map(), live: new Map()
  };
  w.cy = w.rowY + w.R;
  const b = labelBase(st, w, w.probe);            // самый широкий ярлык задаёт угол ухода
  w.hw = b.hw; w.hh = b.hh;
  w.hide = hideAngle(st.L, w);
  return w;
}

// Угол, на котором ярлык уже целиком за кадром: дальше держать его в сборе незачем.
function hideAngle(L, w) {
  let a = Math.PI * .5;
  for (let t = .02; t < 1.56; t += .01) {
    const x = L.cx + w.R * Math.sin(t), y = w.cy - w.R * Math.cos(t);
    if (x - w.hw > L.W + 4 || y - w.hh > L.H + 4) { a = t; break; }
  }
  return Math.min(a, w.step * 2.6);
}

function wheelValue(w, i) {
  if (w.key === 'd') return mod(i, w.n) + 1;
  if (w.key === 'm') return mod(i, w.n);
  return YEAR_MIN + clamp(i, 0, w.n - 1);
}
function wheelLabel(w, v) {
  if (w.key === 'd') return String(v).padStart(2, '0');
  if (w.key === 'm') return MONTHS[v];
  return String(v);
}

// Крупинки одного ярлыка: строим один раз на значение и центрируем по чернилам, а не по коробке
// шрифта — иначе «МАР» и «ФЕВ» встанут на дуге с разной высотой.
function labelBase(st, w, v) {
  const hit = w.cache.get(v);
  if (hit) return hit;
  const pts = st.sand.text(null, wheelLabel(w, v), {
    x: 0, y: 0, size: w.size, weight: w.weight, align: 'center', baseline: 'middle', density: 1.65
  });
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i], y = pts[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
  for (let i = 0; i < pts.length; i += 2) { pts[i] -= ox; pts[i + 1] -= oy; }
  const b = { pts, tone: pts.tone, hw: (maxX - minX) / 2, hh: (maxY - minY) / 2 };
  w.cache.set(v, b);
  return b;
}

// Ярлык на дуге: поворот вокруг центра колеса, масштаб и яркость падают к краю, а сам штрих
// у края начинает разлетаться — это и есть «магическая замена блюра».
function place(L, w, it, th) {
  const u = clamp(Math.abs(th) / w.hide, 0, 1);
  const s = 1 - .22 * u;
  const dim = Math.max(.06, 1 - .92 * Math.pow(u, 1.25));
  const spread = 36 * Math.pow(u, 5.5);   // штрих цел почти до самого края и рвётся уже на уходе
  const c = Math.cos(th), sn = Math.sin(th);
  const bp = it.b.pts, bt = it.b.tone, out = it.pts, ot = it.tone;
  const n = out.length >> 1;
  for (let j = 0; j < n; j++) {
    const d = (j % 97) * 2;
    let qx = bp[j * 2] * s, qy = bp[j * 2 + 1] * s - w.R;
    if (spread > .35) {
      const g = spread * (.35 + 1.3 * ((j * PHI) % 1));
      qx += DIRS[d] * g; qy += DIRS[d + 1] * g;
    }
    out[j * 2] = L.cx + qx * c - qy * sn;
    out[j * 2 + 1] = w.cy + qx * sn + qy * c;
    ot[j] = bt[j] * dim;
  }
}

// Ярлык колеса живёт в двух местах сразу: в w.live и — пока досыпается — в списке роспуска.
// Поэтому id обязан быть уникальным на ВСЮ жизнь экрана, а не на пару «колесо + номер». Иначе
// смена длины месяца (июль→июнь) отправляет старый ярлык в роспуск и тут же создаёт замену с тем
// же id: setTargets молча отбирает крупинки у уходящего, а через ~0.7 с stepDissolve зовёт
// sand.drop(id) и убивает уже ЗАМЕНУ. Колесо дня после этого пустое, и ранний выход syncWheel
// не даёт ему собраться заново.
function createItem(st, w, i) {
  const b = labelBase(st, w, wheelValue(w, i));
  const n = b.pts.length >> 1;
  const it = { i, rev: w.rev, b, id: `dt:${w.key}:${i}#${++st.seq}`, pts: new Float32Array(n * 2), tone: new Float32Array(n) };
  it.pts.tone = it.tone;
  place(st.L, w, it, (i - w.off) * w.step);
  // чем быстрее крутят, тем короче сбор: иначе значение доезжает до середины дуги облаком
  const fast = Math.min(1, Math.abs(w.v) / 3);
  st.sand.setTargets(it.id, it.pts, {
    arrive: 'flow', span: .26 - .19 * fast, rise: .50 - .32 * fast, gold: .10, wob: .60
  });
  w.live.set(i, it);
}

// Уход значения за кадр. Цели не отпускаем ядру сразу: ведём их сами — так песок уходит именно
// в ту сторону, куда крутят, а не по симметричному взрыву.
function startDissolve(st, w, it, th) {
  const sand = st.sand;
  if (sand.reduced) { sand.drop(it.id); return; }
  const dir = th >= 0 ? 1 : -1;
  const tx = Math.cos(th) * dir, ty = Math.sin(th) * dir;      // вдоль движения по дуге
  const rx = Math.sin(th), ry = -Math.cos(th);                 // наружу от центра колеса
  let cx0 = 0, cy0 = 0;
  const n = it.pts.length >> 1;
  for (let j = 0; j < n; j++) { cx0 += it.pts[j * 2]; cy0 += it.pts[j * 2 + 1]; }
  st.dis.push({
    id: it.id, src: it.pts.slice(), pts: it.pts, tone: it.tone, base: it.b.tone, n,
    cx: cx0 / n, cy: cy0 / n, t: 0, dur: .72 - .30 * Math.min(1, Math.abs(w.v) / 3.2),
    ax: tx + rx * .34, ay: ty + ry * .34,
    mode: (st.disN++) % 4, spin: st.disN % 2 ? 1 : -1
  });
  while (st.dis.length > 16) { const old = st.dis.shift(); sand.drop(old.id); }
}

function stepDissolve(st, dt) {
  for (let q = st.dis.length - 1; q >= 0; q--) {
    const D = st.dis[q];
    D.t += dt;
    const span = Math.max(.18, D.dur - .30);
    for (let j = 0; j < D.n; j++) {
      const k = clamp((D.t - ((j * PHI) % 1) * .30) / span, 0, 1);
      const d = (j % 97) * 2;
      const jx = DIRS[d], jy = DIRS[d + 1];
      let x = D.src[j * 2], y = D.src[j * 2 + 1];
      const kk = k * k;
      if (D.mode === 1) {                                   // вихрь: закручивается и расходится
        const a = D.spin * k * 1.55, c = Math.cos(a), s = Math.sin(a), g = 1 + k * .55;
        const dx = (x - D.cx) * g, dy = (y - D.cy) * g;
        x = D.cx + dx * c - dy * s; y = D.cy + dx * s + dy * c;
        x += D.ax * kk * 300; y += D.ay * kk * 300;
      } else if (D.mode === 2) {                            // пряди: четыре косы под своим углом
        const t = ((j & 3) - 1.5) * .40, c = Math.cos(t), s = Math.sin(t);
        x += (D.ax * c - D.ay * s) * kk * 430;
        y += (D.ax * s + D.ay * c) * kk * 430;
        x += jx * k * 34; y += jy * k * 34;
      } else if (D.mode === 3) {                            // стекание: сносит и роняет вниз
        x += D.ax * kk * 210 + jx * k * 40;
        y += D.ay * kk * 210 + jy * k * 40 + kk * 330;
      } else {                                              // веер вдоль дуги
        x += D.ax * kk * 390 + jx * k * 96 * (.3 + ((j * PHI) % 1));
        y += D.ay * kk * 390 + jy * k * 96 * (.3 + ((j * PHI) % 1));
      }
      D.pts[j * 2] = x; D.pts[j * 2 + 1] = y;
      D.tone[j] = D.base[j] * Math.max(0, 1 - k * 1.25);
    }
    st.sand.updateTargets(D.id, D.pts);
    if (D.t >= D.dur) { st.sand.drop(D.id); st.dis.splice(q, 1); }
  }
}

function syncWheel(st, w, force) {
  if (!force && !w.dirty && Math.abs(w.off - w.lastOff) < 1e-5) return;
  w.lastOff = w.off; w.dirty = false;
  const L = st.L, LEAD = .28;
  const span = Math.ceil((w.hide + LEAD) / w.step) + 1;
  const lo = Math.floor(w.off - span), hi = Math.ceil(w.off + span);
  // θ·v > 0 — значение едет к середине дуги; такое заводим заранее, за кромкой экрана, чтобы оно
  // успело собраться из потока. Уходящее распускаем ровно на кромке — там, где в Figma градиент.
  const inbound = th => th * w.v > 0 && Math.abs(w.v) > .5;

  for (const [i, it] of [...w.live]) {
    const th = (i - w.off) * w.step, a = Math.abs(th);
    const gone = a > w.hide + LEAD + .04 || (a > w.hide && !inbound(th));
    if (it.rev !== w.rev || gone) { startDissolve(st, w, it, th); w.live.delete(i); }
  }
  for (let i = lo; i <= hi; i++) {
    if (!w.cyclic && (i < 0 || i >= w.n)) continue;
    const th = (i - w.off) * w.step, a = Math.abs(th);
    if (a > w.hide - .02 && !(a <= w.hide + LEAD && inbound(th))) continue;
    if (!w.live.has(i)) createItem(st, w, i);
  }
  for (const [i, it] of w.live) {
    place(L, w, it, (i - w.off) * w.step);
    st.sand.updateTargets(it.id, it.pts);
  }
}

function physics(st, w, dt) {
  if (w.drag) return;
  if (Math.abs(w.v) > 1.9) {
    w.v *= Math.exp(-dt / .95);
    w.off += w.v * dt;
  } else {
    const t = Math.round(w.off);
    w.v += ((t - w.off) * 34 - w.v * 8.6) * dt;
    w.off += w.v * dt;
    if (Math.abs(t - w.off) < .0015 && Math.abs(w.v) < .03) { w.off = t; w.v = 0; }
  }
  if (!w.cyclic) {
    if (w.off < 0) { w.off = 0; w.v = 0; }
    if (w.off > w.n - 1) { w.off = w.n - 1; w.v = 0; }
  }
}

// ---------------------------------------------------------------------------- статика экрана

function triangle(cx, cy, w, h, down) {
  const n = Math.max(48, Math.round(w * h * .5 * 1.7));
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const t = u + v;                                 // t=0 — вершина, t=1 — основание
    const bx = (u - v) * w;
    out[i * 2] = cx + bx * .5;
    out[i * 2 + 1] = down ? cy + h * (.5 - t) : cy + h * (t - .5);
  }
  return out;
}

// Кнопка «дальше»: песок заливает таблетку, стрелка остаётся дыркой в песке — как белая плашка
// с синей стрелкой в Figma, только наоборот собранная.
function buttonPoints(sand, L) {
  return pillHole(sand, { x: L.cx, y: L.btnY, w: L.btnW, h: L.btnH, density: 2.0,
    draw(g, w, h) { const x = w / 2, y = h / 2;
      g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x + 12, y);
      g.moveTo(x + 3, y - 10); g.lineTo(x + 13, y); g.lineTo(x + 3, y + 10); g.stroke();
    } });
}

function fitSize(sign, maxW, maxH) {
  const p = starsToScreen(sign, { x: 0, y: 0, size: 1000 });
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < p.length; i += 2) {
    const x = p[i], y = p[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  return Math.min(maxW * 1000 / w, maxH * 1000 / h);
}

function applySign(st, sign) {
  if (st.sign && st.sign.id === sign.id) return;
  const sand = st.sand, L = st.L, first = !st.sign;
  st.sign = sign;
  if (!first && sand.has('dt:name')) sand.release('dt:name', { style: 'wave-x' });
  const draw = () => {
    if (!st.alive || st.sign !== sign) return;
    const size = fitSize(sign, L.signW, L.signH);
    const raw = sandPoints(sign, { x: L.cx, y: L.signCy, size, perStar: 380, perLine: 95 });
    // Угловой порядок сохраняет короткие пути крупинок при смене фигуры.
    const order = Array.from({ length: raw.length / 2 }, (_, i) => i);
    order.sort((a, b) => {
      const ax = raw[a * 2] - L.cx, ay = raw[a * 2 + 1] - L.signCy;
      const bx = raw[b * 2] - L.cx, by = raw[b * 2 + 1] - L.signCy;
      return Math.atan2(ay, ax) - Math.atan2(by, bx) || Math.hypot(ax, ay) - Math.hypot(bx, by);
    });
    const pts = new Float32Array(raw.length);
    for (let i = 0; i < order.length; i++) { pts[i * 2] = raw[order[i] * 2]; pts[i * 2 + 1] = raw[order[i] * 2 + 1]; }
    if (sand.has('dt:sign')) sand.updateTargets('dt:sign', pts);
    else sand.setTargets('dt:sign', pts, { arrive: 'flow', span: .52, gold: .22 });
    sand.text('dt:name', sign.nameGen + '?', {
      x: L.cx, y: L.nameY, size: L.nameSize, weight: 500, align: 'center',
      density: 1.65, arrive: 'wave-x', span: .42, gold: .12, wob: .16
    });
    if (st.dom.live) st.dom.live.textContent =
      `${st.sel.d} ${MONTHS[st.sel.m - 1].toLowerCase()} ${st.sel.y}, знак ${sign.name}`;
  };
  draw();
}

function buildStatic(st) {
  const sand = st.sand, L = st.L;
  sand.text('dt:title', 'Вы рождены под созвездием', {
    x: L.cx, y: L.titleY, size: L.titleSize, weight: 500, align: 'center',
    maxWidth: L.W - 64, lineHeight: 1.16, density: 1.70, arrive: 'wave-x', span: .66, wob: .16
  });
  if (L.hintOn) sand.text('dt:hint', 'Введите дату колёсиками ниже', {
    x: L.cx, y: L.hintY, size: 15, font: '-apple-system, Arial, sans-serif',
    align: 'center', density: 1.9, tone: .8, wob: .02,
    arrive: 'wave-x', span: .34, delay: .22
  });
  const aw = (r) => {
    const s = Math.min(.99, (L.W / 2 + 18) / r);
    return Math.asin(s);
  };
  const r1 = L.arcCy - (L.rows[0] + L.rows[1]) / 2, r2 = L.arcCy - (L.rows[1] + L.rows[2]) / 2;
  const d1 = aw(r1), d2 = aw(r2);
  sand.shape('dt:arc0', 'arc', {
    x: L.cx, y: L.arcCy, r: r1, a0: -Math.PI / 2 - d1, a1: -Math.PI / 2 + d1,
    width: 1.2, count: 760, arrive: 'flow', span: .5, delay: .30, tone: .72, wob: .12
  });
  sand.shape('dt:arc1', 'arc', {
    x: L.cx, y: L.arcCy, r: r2, a0: -Math.PI / 2 - d2, a1: -Math.PI / 2 + d2,
    width: 1.2, count: 600, arrive: 'flow', span: .5, delay: .36, tone: .72, wob: .12
  });
  sand.setTargets('dt:mark0', triangle(L.cx, (L.hintY + L.rows[0]) / 2 + 10, 13, 8, true), { arrive: 'burst', delay: .5, tone: .95, wob: .05 });
  sand.setTargets('dt:mark1', triangle(L.cx, (L.rows[2] + L.btnY - L.btnH / 2) / 2 + 2, 13, 8, false), { arrive: 'burst', delay: .55, tone: .95, wob: .05 });
  sand.setTargets('dt:btn', buttonPoints(sand, L), { arrive: 'flow', span: .4, delay: .42, gold: .16, wob: .22 });
}

// ---------------------------------------------------------------------------- DOM

const CSS = `
.gd-hint{position:absolute;left:0;right:0;margin:0;text-align:center;color:#8d98bb;
  font:400 13px/1.3 -apple-system,'SF Pro Text',Arial,sans-serif;letter-spacing:.02em;opacity:.85}
.gd-next{position:absolute;-webkit-appearance:none;appearance:none;background:none;border:0;padding:0;
  cursor:pointer;pointer-events:auto;border-radius:999px;color:transparent;
  font:400 36px/1 -apple-system,'SF Pro Text',Arial,sans-serif;
  display:flex;align-items:center;justify-content:center}
.gd-next:focus-visible{outline:1px solid rgba(240,215,154,.6);outline-offset:4px}
.gd-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;

function buildDom(st) {
  const root = st.ctx.root, L = st.L;
  root.innerHTML = '';
  root.style.pointerEvents = 'none';
  if (!document.getElementById('gd-css')) {
    const s = document.createElement('style'); s.id = 'gd-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  const hint = document.createElement('p');
  hint.className = 'gd-hint'; hint.textContent = 'Введите дату колёсиками ниже';
  hint.style.top = L.hintY + 'px';
  hint.style.display = 'none';   // видимая подпись собирается крупинками
  const btn = document.createElement('button');
  btn.className = 'gd-next'; btn.type = 'button'; btn.setAttribute('aria-label', 'Дальше, к чаше');
  btn.textContent = '→';
  btn.style.left = (L.cx - L.btnW / 2) + 'px';
  btn.style.top = (L.btnY - L.btnH / 2) + 'px';
  btn.style.width = L.btnW + 'px'; btn.style.height = L.btnH + 'px';
  btn.style.fontSize = Math.round(Math.min(36, L.btnH * .65)) + 'px';
  btn.addEventListener('click', () => next(st));
  const live = document.createElement('p');
  live.className = 'gd-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  root.append(hint, btn, live);
  st.dom = { hint, btn, live };
}

// ---------------------------------------------------------------------------- жест

function pick(st, x, y) {
  let best = null, bd = 62;
  for (const w of st.wheels) {
    const d = Math.abs(Math.hypot(x - st.L.cx, y - w.cy) - w.R);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

function addListeners(st) {
  const c = st.sand.canvas;
  st.prevTouch = c.style.touchAction;
  c.style.touchAction = 'none';
  const local = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  st.onDown = e => {
    const [x, y] = local(e);
    const w = pick(st, x, y);
    st.pointer = { id: e.pointerId, x, y, x0: x, y0: y, moved: 0, w, t: performance.now() };
    if (w) {
      w.drag = { a: Math.atan2(y - w.cy, x - st.L.cx), t: performance.now() };
      w.v = 0;
      if (c.setPointerCapture) { try { c.setPointerCapture(e.pointerId); } catch (_) { } }
    }
  };
  st.onMove = e => {
    const p = st.pointer; if (!p || p.id !== e.pointerId) return;
    const [x, y] = local(e);
    p.moved += Math.hypot(x - p.x, y - p.y); p.x = x; p.y = y;
    const w = p.w; if (!w || !w.drag) return;
    const a = Math.atan2(y - w.cy, x - st.L.cx);
    let da = a - w.drag.a;
    while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    const now = performance.now(), dt = Math.max(.008, (now - w.drag.t) / 1000);
    let d = -da / w.step;
    if (!w.cyclic) {                                   // за краями года ход вязнет, как в резинке
      const over = w.off + d < 0 ? -(w.off + d) : w.off + d > w.n - 1 ? (w.off + d) - (w.n - 1) : 0;
      if (over > 0) d *= .34;
    }
    w.off += d;
    w.v = clamp(w.v * .55 + (d / dt) * .45, -MAXV, MAXV);
    w.drag.a = a; w.drag.t = now;
  };
  st.onUp = e => {
    const p = st.pointer; if (!p || p.id !== e.pointerId) return;
    st.pointer = null;
    if (c.releasePointerCapture) { try { c.releasePointerCapture(e.pointerId); } catch (_) { } }
    if (p.w) { p.w.drag = null; p.w.v = clamp(p.w.v, -MAXV, MAXV); }
    else if (p.moved < 9 && performance.now() - p.t < 500) st.sand.hit(p.x, p.y, 88, 430);
  };
  c.addEventListener('pointerdown', st.onDown);
  c.addEventListener('pointermove', st.onMove);
  c.addEventListener('pointerup', st.onUp);
  c.addEventListener('pointercancel', st.onUp);

  st.onKey = e => {
    const w = st.wheels[st.focus || 0];
    if (e.key === 'ArrowLeft') { w.off -= 1; w.v = 0; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { w.off += 1; w.v = 0; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { st.focus = mod((st.focus || 0) - 1, 3); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { st.focus = mod((st.focus || 0) + 1, 3); e.preventDefault(); }
  };
  addEventListener('keydown', st.onKey);

  st.onResize = () => { clearTimeout(st.rz); st.rz = setTimeout(() => rebuild(st), 220); };
  addEventListener('resize', st.onResize);
  addEventListener('orientationchange', st.onResize);
}

function removeListeners(st) {
  const c = st.sand.canvas;
  c.removeEventListener('pointerdown', st.onDown);
  c.removeEventListener('pointermove', st.onMove);
  c.removeEventListener('pointerup', st.onUp);
  c.removeEventListener('pointercancel', st.onUp);
  removeEventListener('keydown', st.onKey);
  removeEventListener('resize', st.onResize);
  removeEventListener('orientationchange', st.onResize);
  c.style.touchAction = st.prevTouch || '';
  clearTimeout(st.rz);
}

// ---------------------------------------------------------------------------- кадр

function selection(st) {
  const [wd, wm, wy] = st.wheels;
  return {
    d: wheelValue(wd, Math.round(wd.off)),
    m: wheelValue(wm, Math.round(wm.off)) + 1,
    y: wheelValue(wy, Math.round(wy.off))
  };
}

function step(st, dt) {
  for (const w of st.wheels) physics(st, w, dt);

  const sel = selection(st);
  if (sel.d !== st.sel.d || sel.m !== st.sel.m || sel.y !== st.sel.y) {
    st.sel = sel; st.settle = 0;
    const s = st.ctx.session; if (s) { s.birth = { ...sel }; s.signId = signFor(sel.d, sel.m).id; }
  } else if (st.settle < 9) {
    st.settle += dt;
    if (st.settle > .26 && !st.applied) { st.applied = true; applySign(st, signFor(sel.d, sel.m)); }
  }
  if (sel.d !== st.lastSel) { st.lastSel = sel.d; st.applied = false; }
  if (sel.m !== st.lastSelM) { st.lastSelM = sel.m; st.applied = false; dayCount(st); }
  if (sel.y !== st.lastSelY) { st.lastSelY = sel.y; dayCount(st); }

  for (const w of st.wheels) syncWheel(st, w, false);
  stepDissolve(st, dt);
}

// Февраль короче марта: число значений в колесе дня зависит от месяца и года. Меняем n, двигаем
// выбор в допустимый предел и помечаем живые ярлыки устаревшими — они уйдут песком и вернутся
// уже с новыми числами.
function dayCount(st) {
  const wd = st.wheels[0];
  const n = daysInMonth(st.sel.m, st.sel.y);
  if (n === wd.n) return;
  const cur = wheelValue(wd, Math.round(wd.off));
  const next = Math.min(cur, n);
  wd.n = n; wd.rev++;
  wd.off = Math.round(wd.off) + (next - cur);
  wd.dirty = true;
}

function loop(st, now) {
  if (!st.alive) return;
  st.raf = requestAnimationFrame(t => loop(st, t));
  const dt = Math.min(.05, Math.max(.001, (now - st.last) / 1000));
  st.last = now;
  if (st.paused) return;
  step(st, dt);
}

function later(st, fn, ms) { const t = setTimeout(() => { st.timers.delete(t); fn(); }, ms); st.timers.add(t); return t; }

function next(st) {
  if (st.leaving) return;
  st.leaving = true;
  const s = st.ctx.session; if (s) { s.birth = { ...st.sel }; s.signId = signFor(st.sel.d, st.sel.m).id; }
  st.ctx.go('cup');
}

function rebuild(st) {
  const sand = st.sand;
  sand.resize();
  const off = st.wheels.map(w => w.off);
  for (const id of sand.groups) if (id.startsWith('dt:')) sand.drop(id);
  st.dis.length = 0;
  st.L = layout(sand);
  buildDom(st);
  buildStatic(st);
  st.wheels = wheels(st);
  st.wheels.forEach((w, i) => { w.off = off[i]; });
  const sign = st.sign; st.sign = null;
  applySign(st, sign || signFor(st.sel.d, st.sel.m));
  for (const w of st.wheels) syncWheel(st, w, true);
}

function wheels(st) {
  const L = st.L;
  return [
    makeWheel(st, 'd', { rowY: L.rows[0], R: L.arcCy - L.rows[0], step: .30, size: L.dSize, weight: 500, n: daysInMonth(st.sel.m, st.sel.y), cyclic: true, probe: 28 }),
    makeWheel(st, 'm', { rowY: L.rows[1], R: L.arcCy - L.rows[1], step: .40, size: L.mSize, weight: 500, n: 12, cyclic: true, probe: 11 }),
    makeWheel(st, 'y', { rowY: L.rows[2], R: L.arcCy - L.rows[2], step: .54, size: L.ySize, weight: 500, n: YEAR_MAX - YEAR_MIN + 1, cyclic: false, probe: 1988 })
  ];
}

// ---------------------------------------------------------------------------- контракт экрана

export async function mount(ctx) {
  const sand = ctx.sand;
  await sand.ready;
  const st = S = {
    ctx, sand, alive: true, raf: 0, last: performance.now(),
    sel: { d: 5, m: 7, y: 2000 }, sign: null, settle: 0, applied: false,
    dis: [], disN: 0, seq: 0, timers: new Set(), pointer: null, focus: 0, leaving: false, dom: {}
  };
  const b = ctx.session && ctx.session.birth;
  if (b && b.d && b.m && b.y) st.sel = { d: b.d, m: b.m, y: clamp(b.y, YEAR_MIN, YEAR_MAX) };
  st.lastSel = st.sel.d; st.lastSelM = st.sel.m; st.lastSelY = st.sel.y;

  st.L = layout(sand);
  buildDom(st);
  buildStatic(st);
  st.wheels = wheels(st);
  st.wheels[0].off = st.sel.d - 1;
  st.wheels[1].off = st.sel.m - 1;
  st.wheels[2].off = st.sel.y - YEAR_MIN;
  for (const w of st.wheels) syncWheel(st, w, true);
  applySign(st, signFor(st.sel.d, st.sel.m));
  addListeners(st);
  st.raf = requestAnimationFrame(t => loop(st, t));
  return st;
}

export async function unmount(ctx) {
  const st = S; if (!st) return;
  st.alive = false;
  cancelAnimationFrame(st.raf);
  for (const t of st.timers) clearTimeout(t);
  st.timers.clear();
  removeListeners(st);
  const sand = st.sand;
  const styles = ['strands', 'stream', 'vortex', 'wave-x', 'drip'];
  let k = 0;
  for (const id of sand.groups) if (id.startsWith('dt:')) sand.release(id, { style: styles[k++ % styles.length] });
  st.dis.length = 0;
  if (ctx && ctx.root) ctx.root.innerHTML = '';
  S = null;
  if (sand.reduced) return;
  await new Promise(r => setTimeout(r, 180));
}

// крюки для QA: состояние выбора и программная прокрутка колеса
export function debug() {
  if (!S) return null;
  return {
    sel: { ...S.sel }, sign: S.sign && S.sign.id,
    off: S.wheels.map(w => +w.off.toFixed(3)),
    live: S.wheels.map(w => w.live.size),
    dissolving: S.dis.length,
    hide: S.wheels.map(w => +w.hide.toFixed(3))
  };
}
export function pause(v) { if (S) { S.paused = !!v; S.last = performance.now(); } }
export function advance(dt) { if (S) step(S, dt); }
export function spin(which, delta, velocity) {
  if (!S) return;
  const w = S.wheels[{ d: 0, m: 1, y: 2 }[which] ?? which];
  if (!w) return;
  if (delta) w.off += delta;
  if (velocity != null) w.v = clamp(velocity, -MAXV, MAXV);
  w.dirty = true;
}
