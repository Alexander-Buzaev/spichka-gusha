// Кофейная гуща · общие детали экранов phone / code / sky.
//
// Ни одного собственного кадра и ни одной своей частицы: всё видимое рисует ядро sand.js,
// здесь только раскладка, хит-зоны и служебный DOM-текст мелким системным sans.
//
// Главное здесь — вырез текста в залитой таблетке (pillHole). Ядро такого не умеет: его
// shape('pill') даёт сплошную заливку. В Figma выбранный таб и кнопка «Продолжить» — белая
// плашка с синими буквами, то есть буквы это ДЫРКА в песке, а не песок поверх песка.
// Маска строится тем же шрифтом и тем же кеглем, что и надпись, и расширяется обводкой
// (strokeText поверх fillText) — так у буквы остаётся чистый контур, а не рваный край.
//
// Границы нащупаны снимками, а не выведены из головы. Считать тут нечего: читается дырка,
// то есть ОТСУТСТВИЕ крупинок, а её ширина меряется в шагах решётки 1/√плотность.
//  · плотность заливки 0.80 крупинки на пиксель (шаг 1.12 px). При 0.45 и ниже дырка тонет
//    в шуме, при 0.62 буквы ещё мылит;
//  · кегль надписи от 22 px: при 18 px внутренние просветы «о», «д», «ж» уже 2.5 px, и pad
//    съедает их целиком — слово превращается в кляксу (так и вышло на первом прогоне);
//  · насыщенность ровно 400: на 600 и 700 стойки от дилатации слипаются, и вместо слова
//    получается сплошной прямоугольник;
//  · pad 0.4–0.5 px: он расширяет стойку, но сужает просвет, поэтому берём минимум, какой
//    ещё держит контур. 0.9 px и больше читаемо только на коротких словах вроде SMS.
//  · заливка с вырезом — только для широких таблеток; круглым кнопкам и иконкам нужна
//    кромка с песочным рисунком, дырка шириной в три крупинки не читается вовсе.

const SANS = '-apple-system, "SF Pro Text", Arial, sans-serif';
const SERIF = 'Cormorant, Georgia, serif';
export const FONT = { sans: SANS, serif: SERIF };

// Вертикальная посадка надписи в таблетку.
//
// sand.text с baseline:'middle' центрирует не буквы, а БЛОК строки: высота блока
// lineHeight·size + 0.36·size, базовая линия на 0.90·size от верха. Насколько при этом буквы
// уедут вверх, зависит от шрифта (у Cormorant прописная — 0.66 кегля, у системного sans —
// 0.72) и от того, есть ли в слове выносные элементы. Считать это по формуле значит
// подгонять коэффициент под каждое слово; проверено снимками — так и выходит: цифра в слоте
// кода уезжала на 14 px вверх при подписи таба, севшей ровно.
//
// Поэтому смещение не угадываем, а меряем: растеризуем надпись, находим верх и низ чернил и
// сажаем середину чернил туда, куда просили. Один getImageData на надпись, кэш по ключу.
export const VCENTER = 0.19;                     // оставлено для совместимости, не используется

const inkCache = new Map();
const kc = document.createElement('canvas');     // отдельный холст: общий с маской затирался бы
const kx = kc.getContext('2d', { willReadFrequently: true });
function inkMid(label, o) {
  const size = o.size || 16, weight = o.weight || 400, font = o.font || SANS;
  const key = label + '|' + size + '|' + weight + '|' + font;
  let c = inkCache.get(key);
  if (c != null) return c;
  const W = Math.max(8, Math.ceil(size * (label.length + 2))), H = Math.max(8, Math.ceil(size * 3));
  kc.width = W; kc.height = H;
  kx.clearRect(0, 0, W, H);
  kx.font = weight + ' ' + size + 'px ' + font;
  kx.textAlign = 'center'; kx.textBaseline = 'alphabetic';
  kx.fillStyle = '#fff';
  const B = Math.round(H * .6);
  kx.fillText(label, W / 2, B);
  const d = kx.getImageData(0, 0, W, H).data;
  let lo = -1, hi = -1;
  for (let y = 0; y < H; y++) {
    let ink = 0;
    for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { ink = 1; break; }
    if (ink) { if (lo < 0) lo = y; hi = y; }
  }
  c = lo < 0 ? 0 : (lo + hi) / 2 - B;             // середина чернил относительно базовой линии
  inkCache.set(key, c);
  return c;
}

// y для sand.text(baseline:'middle'), при котором середина чернил встанет ровно на cy.
export function midY(label, o, cy) {
  const size = o.size || 16, lh = (o.lineHeight || 1.18) * size;
  const lines = String(label).split('\n').length;
  const bh = lines * lh + size * .36;
  return cy + bh / 2 - size * .90 - inkMid(String(label).split('\n')[0], o) - (lines - 1) * lh / 2;
}

const STYLE_ID = 'gusha-kit-style';
const CSS = `
.groot{position:fixed;inset:0;z-index:3;pointer-events:none}
.gz{position:absolute;margin:0;padding:0;border:0;background:none;color:transparent;
  font:inherit;cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent;
  -webkit-appearance:none;appearance:none;touch-action:manipulation}
.gz:focus{outline:none}
.gz:focus-visible{outline:1px solid rgba(240,215,154,.45);outline-offset:3px;border-radius:999px}
.gs{position:absolute;left:0;right:0;margin:0;text-align:center;pointer-events:none;
  font:400 13px/1.45 ${SANS};letter-spacing:.02em;color:#8d99bd}
.gs.dim{color:#6f7ba1}
.gs.warm{color:#c9b590}
.glink{pointer-events:auto;cursor:pointer;color:#a9b6d8;text-decoration:underline;
  text-underline-offset:3px;-webkit-tap-highlight-color:transparent}
.glink:active{color:#f0d79a}
.gin{position:absolute;margin:0;border:0;background:none;outline:none;pointer-events:auto;
  color:transparent;caret-color:#f0d79a;font:400 26px/1 ${SERIF};text-align:center;
  letter-spacing:.04em;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent}
.gin::selection{background:rgba(240,215,154,.22)}
.gname{position:absolute;left:0;top:0;transform:translate(-50%,-50%);white-space:nowrap;
  text-align:center;pointer-events:none;opacity:0;transition:opacity .5s linear;
  font:400 23px/1 ${SERIF};letter-spacing:.09em;color:#f0d79a;text-shadow:0 0 22px rgba(240,215,154,.3)}
.gname i{display:block;font:400 9.5px/1.4 ${SANS};font-style:normal;letter-spacing:.22em;
  color:#7d88ab;margin-top:6px;text-transform:uppercase;text-shadow:none}
.ghud{position:absolute;left:0;right:0;pointer-events:none;text-align:center;
  font:400 12px/1.5 ${SANS};letter-spacing:.1em;color:#7d88ab;font-variant-numeric:tabular-nums}
.ghud b{font-weight:400;color:#f0d79a}
@media (prefers-reduced-motion:reduce){.gname{transition:none}}
`;

export function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID; s.textContent = CSS;
  document.head.appendChild(s);
}

export function el(tag, cls, parent, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  if (parent) parent.appendChild(n);
  return n;
}

// Служебная строка системным sans: y — верх строки в px экрана.
export function caption(parent, text, y, cls) {
  const p = el('p', 'gs' + (cls ? ' ' + cls : ''), parent, text);
  p.style.top = y + 'px';
  return p;
}

// Прозрачная хит-зона поверх песочной кнопки. Песок не умеет ловить тап, DOM умеет.
export function zone(parent, { x, y, w, h, label, onTap, round = true }) {
  const b = el('button', 'gz', parent);
  b.type = 'button';
  b.style.left = (x - w / 2) + 'px'; b.style.top = (y - h / 2) + 'px';
  b.style.width = w + 'px'; b.style.height = h + 'px';
  if (round) b.style.borderRadius = '999px';
  if (label) b.setAttribute('aria-label', label);
  if (onTap) {
    b.addEventListener('click', e => { e.preventDefault(); onTap(e); });
  }
  return b;
}

// --- маска надписи для выреза ---
const mc = document.createElement('canvas');
const mx = mc.getContext('2d', { willReadFrequently: true });
const MS = 2;                                    // масштаб маски: край буквы не должен рвать песок

// Маска выреза в локальных координатах таблетки. Либо надпись (o.label), либо произвольный
// рисунок (o.draw) — стрелка «назад» в Figma тоже синяя на белом, то есть тоже дырка.
function makeMask(w, h, o) {
  const W = Math.max(2, Math.ceil(w * MS)), H = Math.max(2, Math.ceil(h * MS));
  mc.width = W; mc.height = H;
  mx.setTransform(1, 0, 0, 1, 0, 0);
  mx.clearRect(0, 0, W, H);
  mx.save(); mx.scale(MS, MS);
  mx.fillStyle = '#fff'; mx.strokeStyle = '#fff';
  mx.lineJoin = 'round'; mx.lineCap = 'round';
  if (o.draw) o.draw(mx, w, h);
  else {
    const mid = inkMid(o.label, o);              // дырка садится по чернилам, а не по em-коробке
    mx.font = (o.weight || 400) + ' ' + o.size + 'px ' + (o.font || SANS);
    mx.textAlign = 'center'; mx.textBaseline = 'alphabetic';
    mx.lineWidth = (o.pad != null ? o.pad : .45) * 2;
    const cx = w / 2, cy = h / 2 - mid + (o.dy || 0);
    mx.strokeText(o.label, cx, cy);              // обводка = дилатация: контур буквы не рвётся
    mx.fillText(o.label, cx, cy);
  }
  mx.restore();
  const d = mx.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(W * H);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  return { m, W, H };
}

// Заливка таблетки с вырезанным текстом. Возвращает Float32Array готовых целей.
export function pillHole(sand, o) {
  const w = o.w, h = o.h, x = o.x, y = o.y;
  const pts = sand.shape(null, 'pill', {
    x, y, w, h, r: o.r != null ? o.r : h / 2, density: o.density != null ? o.density : .80
  });
  if (!o.label && !o.draw) return pts;
  const { m, W, H } = makeMask(w, h, o);
  const x0 = x - w / 2, y0 = y - h / 2;
  const keep = new Float32Array(pts.length);
  let k = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const px = (pts[i] - x0) * MS, py = (pts[i + 1] - y0) * MS;
    const ix = px | 0, iy = py | 0;
    if (ix >= 0 && ix < W && iy >= 0 && iy < H && m[iy * W + ix]) continue;
    keep[k++] = pts[i]; keep[k++] = pts[i + 1];
  }
  return keep.subarray(0, k);
}

// --- песочная кнопка ---
// filled: заливка с вырезанной надписью (выбранный таб, главная кнопка).
// иначе: кромка + надпись внутри — «песок растекается по кромке, в середине только текст».
export function sandButton(ctx, id, o) {
  const sand = ctx.sand;
  const fid = id + '~f', eid = id + '~e', lid = id + '~l';
  const st = {
    id, x: o.x, y: o.y, w: o.w, h: o.h, r: o.r,
    label: o.label, size: o.size || 16, font: o.font || SANS, weight: o.weight || 400,
    filled: !!o.filled, tone: o.tone != null ? o.tone : 1, gold: o.gold || 0,
    density: o.density, pad: o.pad, draw: o.draw || null, edge: o.edge || null, dead: false
  };
  let zn = null;

  function paint(a = {}) {
    if (st.dead) return;
    const arrive = a.arrive || 'flow', delay = a.delay || 0, span = a.span;
    const tone = st.tone, gold = st.gold;
    if (st.filled) {
      sand.drop(eid); sand.drop(lid);
      const pts = pillHole(sand, {
        x: st.x, y: st.y, w: st.w, h: st.h, r: st.r, label: st.label, draw: st.draw,
        size: st.size, font: st.font, weight: st.weight,
        density: st.density != null ? st.density : .80, pad: st.pad
      });
      sand.setTargets(fid, pts, { arrive, delay, span, tone, gold, rise: o.rise, wob: o.wob });
    } else {
      sand.drop(fid);
      sand.shape(eid, 'pillEdge', {
        x: st.x, y: st.y, w: st.w, h: st.h, r: st.r,
        thickness: st.edge && st.edge.thickness || 2.7, density: st.edge && st.edge.density || .78,
        arrive, delay, span, tone: tone * .94, gold, rise: o.rise, wob: o.wob
      });
      if (st.draw) icon(sand, lid, st.draw, {
        x: st.x, y: st.y, w: st.w, h: st.h, count: o.iconCount || 420,
        arrive, delay: delay + .04, span, tone, gold, rise: o.rise, wob: o.wob
      });
      else sand.text(lid, st.label, {
        x: st.x, y: midY(st.label, st, st.y), size: st.size, font: st.font, weight: st.weight,
        density: o.labelDensity, align: 'center', baseline: 'middle',
        arrive, delay: delay + .04, span, tone, gold, rise: o.rise, wob: o.wob
      });
    }
  }

  const api = {
    get filled() { return st.filled; },
    get label() { return st.label; },
    get tone() { return st.tone; }, set tone(v) { st.tone = v; },
    get gold() { return st.gold; }, set gold(v) { st.gold = v; },
    paint,
    // Переключение заливки: сперва отпускаем старую группу, и новая берёт ИМЕННО эти крупинки
    // (claimNear ищет ближайшую свободную). Отсюда и читается «от кромки до центра».
    setFilled(v, a) { if (st.filled === !!v) return; st.filled = !!v; paint(a || { arrive: 'burst', span: .22 }); },
    setLabel(t, a) { if (st.label === t) return; st.label = t; paint(a || { arrive: 'burst', span: .18 }); },
    move(x, y) {
      if (st.x === x && st.y === y) return;
      st.x = x; st.y = y;
      if (zn) { zn.style.left = (x - st.w / 2) + 'px'; zn.style.top = (y - st.h / 2) + 'px'; }
      // Переносим существующие крупинки, не пересобирая кнопку: это особенно
      // важно, когда системная клавиатура поднимает CTA над собой.
      if (st.filled) {
        sand.updateTargets(fid, pillHole(sand, {
          x, y, w: st.w, h: st.h, r: st.r, label: st.label, draw: st.draw,
          size: st.size, font: st.font, weight: st.weight,
          density: st.density != null ? st.density : .80, pad: st.pad
        }));
      } else {
        sand.updateTargets(eid, sand.shape(null, 'pillEdge', {
          x, y, w: st.w, h: st.h, r: st.r,
          thickness: st.edge && st.edge.thickness || 2.7,
          density: st.edge && st.edge.density || .78
        }));
        const pts = st.draw ? icon(sand, null, st.draw, {
          x, y, w: st.w, h: st.h, count: o.iconCount || 420
        }) : sand.text(null, st.label, {
          x, y: midY(st.label, st, y), size: st.size, font: st.font,
          weight: st.weight, density: o.labelDensity, align: 'center', baseline: 'middle'
        });
        sand.updateTargets(lid, pts);
      }
    },
    release(style) {
      sand.release(fid, { style: style || 'burst' });
      sand.release(eid, { style: style || 'burst' });
      sand.release(lid, { style: style || 'burst' });
    },
    drop() { sand.drop(fid); sand.drop(eid); sand.drop(lid); },
    destroy() { st.dead = true; api.drop(); if (zn) zn.remove(); zn = null; },
    get zone() { return zn; }
  };

  if (o.onTap !== false) {
    zn = zone(ctx.root, {
      x: st.x, y: st.y, w: st.w + 6, h: st.h + 8, label: o.aria || st.label,
      onTap: e => { if (o.onTap) o.onTap(e, api); }
    });
    // Нажатие честно рассыпает песок под пальцем и собирает обратно — отклика в DOM нет вовсе.
    zn.addEventListener('pointerdown', e => {
      const r = sand.canvas.getBoundingClientRect();
      sand.hit(e.clientX - r.left, e.clientY - r.top, Math.min(st.w, st.h) * .62, 210);
    });
  }
  paint({ arrive: o.arrive || 'flow', delay: o.delay || 0, span: o.span });
  return api;
}

// Иконка из канвы → полутон песком. Рисуем белым по прозрачному, ядро само берёт яркость.
export function icon(sand, id, draw, o) {
  const s = 2, w = Math.round(o.w), h = Math.round(o.h);
  const c = document.createElement('canvas');
  c.width = w * s; c.height = h * s;
  const g = c.getContext('2d');
  g.scale(s, s);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g, w, h);
  return sand.image(id, c, {
    x: o.x - w / 2, y: o.y - h / 2, w, h, sample: Math.min(160, w * s),
    count: o.count || 460, gamma: o.gamma != null ? o.gamma : 1.0, floor: .04,
    arrive: o.arrive || 'flow', delay: o.delay || 0, span: o.span, tone: o.tone, gold: o.gold,
    rise: o.rise, wob: o.wob
  });
}

// Вписать рисунок иконки в коробку bw×bh по центру площадки w×h. k — множитель толщины
// штриха: линия, вырезанная в песке, должна быть заметно толще нарисованной песком, иначе
// дырка шириной в две крупинки не читается вовсе.
export const boxed = (draw, bw, bh, k) => (g, w, h) => {
  g.save(); g.translate((w - bw) / 2, (h - bh) / 2); draw(g, bw, bh, k); g.restore();
};

export const ARROW = (g, w, h, k = 1) => {       // стрелка «дальше»
  const y = h / 2, x0 = w * .18, x1 = w * .82;
  g.lineWidth = Math.max(1.6, h * .085) * k;
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  g.beginPath(); g.moveTo(x1 - h * .26, y - h * .26); g.lineTo(x1, y); g.lineTo(x1 - h * .26, y + h * .26); g.stroke();
};
export const BACK = (g, w, h, k = 1) => {        // стрелка «назад»
  const y = h / 2, x0 = w * .18, x1 = w * .82;
  g.lineWidth = Math.max(1.6, h * .085) * k;
  g.beginPath(); g.moveTo(x1, y); g.lineTo(x0, y); g.stroke();
  g.beginPath(); g.moveTo(x0 + h * .26, y - h * .26); g.lineTo(x0, y); g.lineTo(x0 + h * .26, y + h * .26); g.stroke();
};
export const ERASE = (g, w, h, k = 1) => {       // ластик: тот же силуэт, что в «Словах великих»
  const lw = Math.max(1.6, h * .10) * k;
  g.lineWidth = lw;
  g.save();
  g.translate(w * .5, h * .5); g.rotate(-Math.PI / 4);
  const bw = w * .62, bh = h * .40;
  g.beginPath();
  const r = bh * .26;
  g.moveTo(-bw / 2 + r, -bh / 2); g.lineTo(bw / 2 - r, -bh / 2);
  g.quadraticCurveTo(bw / 2, -bh / 2, bw / 2, -bh / 2 + r);
  g.lineTo(bw / 2, bh / 2 - r); g.quadraticCurveTo(bw / 2, bh / 2, bw / 2 - r, bh / 2);
  g.lineTo(-bw / 2 + r, bh / 2); g.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, bh / 2 - r);
  g.lineTo(-bw / 2, -bh / 2 + r); g.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 2 + r, -bh / 2);
  g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(-bw * .06, -bh / 2); g.lineTo(-bw * .06, bh / 2); g.stroke();
  g.restore();
};
export const CROSS = (g, w, h) => {              // крестик «очистить»
  const m = Math.min(w, h) * .28;
  g.lineWidth = Math.max(1.4, Math.min(w, h) * .09);
  g.beginPath(); g.moveTo(w / 2 - m, h / 2 - m); g.lineTo(w / 2 + m, h / 2 + m); g.stroke();
  g.beginPath(); g.moveTo(w / 2 + m, h / 2 - m); g.lineTo(w / 2 - m, h / 2 + m); g.stroke();
};

// Номер телефона: национальная часть + вводимый код страны (1–3 цифры).
export function formatPhone(digits, country = '7') {
  const d = String(digits).replace(/\D/g, '').slice(0, 12);
  const cc = String(country).replace(/\D/g, '').slice(0, 3) || '7';
  let s = '+' + cc;
  if (d.length) s += ' ' + d.slice(0, 3);
  if (d.length > 3) s += ' ' + d.slice(3, 6);
  if (d.length > 6) s += ' ' + d.slice(6, 8);
  if (d.length > 8) s += ' ' + d.slice(8, 10);
  if (d.length > 10) s += ' ' + d.slice(10, 12);
  return s;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
