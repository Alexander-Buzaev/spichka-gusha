// Зодиак «Кофейной гущи»: двенадцать знаков, их созвездия и проекция на экран под песок.
//
// Экран даты спрашивает «Вы рождены под созвездием Рака?» и держит над колёсами рисунок знака.
// Отсюда три вещи: знак по дате, звёзды знака и их места в пикселях.
//
// Звёзды — те же J2000, что и в assets/sky-data.js (ra в десятичных часах, dec в градусах,
// mag — видимая величина). Шесть зодиакальных созвездий там уже есть, и мы берём именно их:
// у экрана даты и у неба должен быть один и тот же рисунок, иначе пользователь увидит
// в чаше одного Тельца, а на небе другого. Недостающие шесть лежат здесь.

import { CONSTELLATIONS } from '../assets/sky-data.js';

const HOUR = Math.PI / 12;
const DEG = Math.PI / 180;

// Созвездия, которых нет в sky-data.js. Как только они там появятся, эти уступят место тем:
// см. figure() ниже.
const LOCAL = {
  aries: {
    id: 'aries', name: 'Овен',
    stars: [
      { id: 'hamal',      name: 'Хамаль',    ra: 2.1195, dec: 23.4624, mag: 2.00 },
      { id: 'sheratan',   name: 'Шератан',   ra: 1.9105, dec: 20.8080, mag: 2.64 },
      { id: 'mesarthim',  name: 'Мезартим',  ra: 1.8925, dec: 19.2940, mag: 3.88 },
      { id: 'bharani',    name: '41 Овна',   ra: 2.8330, dec: 27.2607, mag: 3.61 },
      { id: 'botein',     name: 'Ботейн',    ra: 3.1949, dec: 19.7268, mag: 4.35 }
    ],
    lines: [['mesarthim', 'sheratan'], ['sheratan', 'hamal'], ['hamal', 'bharani'], ['bharani', 'botein']]
  },
  cancer: {
    id: 'cancer', name: 'Рак',
    stars: [
      { id: 'acubens',  name: 'Акубенс',    ra: 8.9747, dec: 11.8577, mag: 4.25 },
      { id: 'altarf',   name: 'Альтарф',    ra: 8.2752, dec:  9.1856, mag: 3.53 },
      { id: 'asellus-a', name: 'Асселюс Австралис', ra: 8.7448, dec: 18.1543, mag: 3.94 },
      { id: 'asellus-b', name: 'Асселюс Бореалис',  ra: 8.7215, dec: 21.4685, mag: 4.66 },
      { id: 'iota-cnc', name: 'ι Рака',     ra: 8.7783, dec: 28.7600, mag: 4.02 }
    ],
    lines: [['altarf', 'asellus-a'], ['asellus-a', 'acubens'], ['asellus-a', 'asellus-b'], ['asellus-b', 'iota-cnc']]
  },
  libra: {
    id: 'libra', name: 'Весы',
    stars: [
      { id: 'zubeneschamali', name: 'Зубенешамали', ra: 15.2831, dec:  -9.3829, mag: 2.61 },
      { id: 'zubenelgenubi',  name: 'Зубенельгенуби', ra: 14.8479, dec: -16.0418, mag: 2.75 },
      { id: 'zubenelakrab',   name: 'Зубенелькраб', ra: 15.5964, dec: -14.7894, mag: 3.91 },
      { id: 'brachium',       name: 'Брахиум',     ra: 15.0679, dec: -25.2819, mag: 3.29 },
      { id: 'ups-lib',        name: 'υ Весов',     ra: 15.6099, dec: -28.1350, mag: 3.58 },
      { id: 'tau-lib',        name: 'τ Весов',     ra: 15.6156, dec: -29.7772, mag: 3.66 }
    ],
    lines: [
      ['brachium', 'zubenelgenubi'], ['zubenelgenubi', 'zubeneschamali'],
      ['zubeneschamali', 'zubenelakrab'], ['zubenelakrab', 'zubenelgenubi'],
      ['zubenelakrab', 'ups-lib'], ['ups-lib', 'tau-lib']
    ]
  },
  capricornus: {
    id: 'capricornus', name: 'Козерог',
    stars: [
      { id: 'algedi',      name: 'Альгеди',      ra: 20.3003, dec: -12.5447, mag: 3.57 },
      { id: 'dabih',       name: 'Дабих',        ra: 20.3502, dec: -14.7814, mag: 3.05 },
      { id: 'nashira',     name: 'Нашира',       ra: 21.6683, dec: -16.6623, mag: 3.67 },
      { id: 'deneb-algedi', name: 'Денеб Альгеди', ra: 21.7840, dec: -16.1273, mag: 2.85 },
      { id: 'omega-cap',   name: 'ω Козерога',   ra: 20.8639, dec: -26.9192, mag: 4.11 },
      { id: 'zeta-cap',    name: 'ζ Козерога',   ra: 21.4457, dec: -22.4113, mag: 3.74 },
      { id: 'theta-cap',   name: 'θ Козерога',   ra: 21.0983, dec: -17.2328, mag: 4.07 },
      { id: 'psi-cap',     name: 'ψ Козерога',   ra: 20.7692, dec: -25.2705, mag: 4.13 }
    ],
    lines: [
      ['algedi', 'dabih'], ['dabih', 'psi-cap'], ['psi-cap', 'omega-cap'], ['omega-cap', 'zeta-cap'],
      ['zeta-cap', 'deneb-algedi'], ['deneb-algedi', 'nashira'], ['nashira', 'theta-cap'], ['theta-cap', 'algedi']
    ]
  },
  aquarius: {
    id: 'aquarius', name: 'Водолей',
    stars: [
      { id: 'sadalsuud',  name: 'Садальсууд',  ra: 21.5260, dec:  -5.5712, mag: 2.90 },
      { id: 'sadalmelik', name: 'Садальмелик', ra: 22.0964, dec:  -0.3199, mag: 2.95 },
      { id: 'sadachbia',  name: 'Садахбия',    ra: 22.3605, dec:  -1.3873, mag: 3.84 },
      { id: 'zeta-aqr',   name: 'ζ Водолея',   ra: 22.4808, dec:  -0.0201, mag: 3.65 },
      { id: 'eta-aqr',    name: 'η Водолея',   ra: 22.5878, dec:  -0.1175, mag: 4.02 },
      { id: 'skat',       name: 'Скат',        ra: 22.9108, dec: -15.8208, mag: 3.27 },
      { id: 'lambda-aqr', name: 'λ Водолея',   ra: 22.8767, dec:  -7.5796, mag: 3.74 },
      { id: 'albali',     name: 'Альбали',     ra: 20.7947, dec:  -9.4958, mag: 3.77 }
    ],
    lines: [
      ['albali', 'sadalsuud'], ['sadalsuud', 'sadalmelik'], ['sadalmelik', 'sadachbia'],
      ['sadachbia', 'zeta-aqr'], ['zeta-aqr', 'eta-aqr'],
      ['sadalmelik', 'lambda-aqr'], ['lambda-aqr', 'skat']
    ]
  },
  pisces: {
    id: 'pisces', name: 'Рыбы',
    stars: [
      { id: 'alrescha',  name: 'Альриша',  ra:  2.0337, dec:  2.7639, mag: 3.82 },
      { id: 'alpherg',   name: 'Альферг',  ra:  1.5249, dec: 15.3459, mag: 3.62 },
      { id: 'eps-psc',   name: 'ε Рыб',    ra:  1.0455, dec:  7.8903, mag: 4.27 },
      { id: 'del-psc',   name: 'δ Рыб',    ra:  0.8112, dec:  7.5850, mag: 4.43 },
      { id: 'ome-psc',   name: 'ω Рыб',    ra: 23.9930, dec:  6.8637, mag: 4.01 },
      { id: 'iot-psc',   name: 'ι Рыб',    ra: 23.6604, dec:  5.6269, mag: 4.13 },
      { id: 'gam-psc',   name: 'γ Рыб',    ra: 23.2860, dec:  3.2823, mag: 3.69 },
      { id: 'bet-psc',   name: 'β Рыб',    ra: 23.0398, dec:  3.8203, mag: 4.48 }
    ],
    lines: [
      ['bet-psc', 'gam-psc'], ['gam-psc', 'iot-psc'], ['iot-psc', 'ome-psc'],
      ['ome-psc', 'del-psc'], ['del-psc', 'eps-psc'], ['eps-psc', 'alrescha'],
      ['alrescha', 'alpherg']
    ]
  }
};

// Тропический зодиак: границы дат те же, что у астрологов, а рисунок — настоящий, астрономический.
// from — первый день знака; знак длится до дня перед from следующего. Козерог перешагивает Новый год,
// поэтому список начинается с Овна, а поиск идёт по «номеру дня» month*100+day.
const SIGNS = [
  { id: 'aries',       nameGen: 'Овна',      glyph: '♈', from: [3, 21],  to: [4, 19],  dates: '21 марта — 19 апреля' },
  { id: 'taurus',      nameGen: 'Тельца',    glyph: '♉', from: [4, 20],  to: [5, 20],  dates: '20 апреля — 20 мая' },
  { id: 'gemini',      nameGen: 'Близнецов', glyph: '♊', from: [5, 21],  to: [6, 20],  dates: '21 мая — 20 июня' },
  { id: 'cancer',      nameGen: 'Рака',      glyph: '♋', from: [6, 21],  to: [7, 22],  dates: '21 июня — 22 июля' },
  { id: 'leo',         nameGen: 'Льва',      glyph: '♌', from: [7, 23],  to: [8, 22],  dates: '23 июля — 22 августа' },
  { id: 'virgo',       nameGen: 'Девы',      glyph: '♍', from: [8, 23],  to: [9, 22],  dates: '23 августа — 22 сентября' },
  { id: 'libra',       nameGen: 'Весов',     glyph: '♎', from: [9, 23],  to: [10, 22], dates: '23 сентября — 22 октября' },
  { id: 'scorpius',    nameGen: 'Скорпиона', glyph: '♏', from: [10, 23], to: [11, 21], dates: '23 октября — 21 ноября' },
  { id: 'sagittarius', nameGen: 'Стрельца',  glyph: '♐', from: [11, 22], to: [12, 21], dates: '22 ноября — 21 декабря' },
  { id: 'capricornus', nameGen: 'Козерога',  glyph: '♑', from: [12, 22], to: [1, 19],  dates: '22 декабря — 19 января' },
  { id: 'aquarius',    nameGen: 'Водолея',   glyph: '♒', from: [1, 20],  to: [2, 18],  dates: '20 января — 18 февраля' },
  { id: 'pisces',      nameGen: 'Рыб',       glyph: '♓', from: [2, 19],  to: [3, 20],  dates: '19 февраля — 20 марта' }
];

function figure(id) {
  const shared = CONSTELLATIONS.find(c => c.id === id);
  const fig = shared || LOCAL[id];
  if (!fig) throw new Error(`zodiac: нет созвездия «${id}» ни в sky-data.js, ни здесь`);
  return fig;
}

export const ZODIAC = SIGNS.map(s => {
  const fig = figure(s.id);
  return {
    id: s.id,
    name: fig.name,          // «Рак» — именительный
    nameGen: s.nameGen,      // «Рака» — для «Вы рождены под созвездием Рака?»
    glyph: s.glyph,
    dates: s.dates,
    from: s.from,
    to: s.to,
    stars: fig.stars,
    lines: fig.lines
  };
});

export const BY_ID = Object.fromEntries(ZODIAC.map(z => [z.id, z]));

// Знак по дате рождения. day 1..31, month 1..12. Год не нужен: границы знаков не плавают
// настолько, чтобы это было видно пользователю.
export function signFor(day, month) {
  const key = month * 100 + day;
  for (const z of ZODIAC) {
    const a = z.from[0] * 100 + z.from[1], b = z.to[0] * 100 + z.to[1];
    if (a <= b ? (key >= a && key <= b) : (key >= a || key <= b)) return z;
  }
  return BY_ID.capricornus;   // сюда не попасть: интервалы кроют год без щелей
}

// --- проекция на экран ---------------------------------------------------------------------
//
// Гномоническая проекция на плоскость, касательную к небу в центре созвездия: прямые на небе
// остаются прямыми, а рисунок не косит, как это делает прямоугольная развёртка у полюса.
// Ориентация — как на печатных картах неба: север вверх, восток влево.
function project(stars) {
  let cx = 0, cy = 0, cz = 0;
  for (const s of stars) {
    const a = s.ra * HOUR, d = s.dec * DEG, c = Math.cos(d);
    cx += c * Math.cos(a); cy += c * Math.sin(a); cz += Math.sin(d);
  }
  const len = Math.hypot(cx, cy, cz) || 1;
  const a0 = Math.atan2(cy / len, cx / len);
  const d0 = Math.asin(Math.max(-1, Math.min(1, cz / len)));
  const sd0 = Math.sin(d0), cd0 = Math.cos(d0);
  return stars.map(s => {
    const a = s.ra * HOUR, d = s.dec * DEG;
    const ca = Math.cos(a - a0), sa = Math.sin(a - a0), cd = Math.cos(d), sd = Math.sin(d);
    const cosc = sd0 * sd + cd0 * cd * ca;
    const k = 1 / Math.max(cosc, 0.05);        // созвездие мельче полусферы, но подстрахуемся
    return { x: -k * cd * sa, y: -k * (cd0 * sd - sd0 * cd * ca) };
  });
}

// Звёзды знака в пикселях экрана: вписаны в квадрат size, центр в (x, y), y вниз.
// Порядок точек тот же, что у sign.stars, — по нему рисуют и линии, и подписи.
// Возвращает Float32Array [x0,y0, x1,y1, ...].
export function starsToScreen(sign, { x = 0, y = 0, size = 200 } = {}) {
  const p = project(sign.stars);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of p) {
    if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y; if (s.y > maxY) maxY = s.y;
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const k = size / span;                       // пропорции созвездия не трогаем
  const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
  const out = new Float32Array(p.length * 2);
  for (let i = 0; i < p.length; i++) {
    out[i * 2] = x + (p[i].x - ox) * k;
    out[i * 2 + 1] = y + (p[i].y - oy) * k;
  }
  return out;
}

// Линии созвездия как пары индексов в массиве starsToScreen. Неизвестные id молча пропускаем:
// рисунок из sky-data.js может ссылаться на звезду, которой у нас нет.
export function signLines(sign) {
  const index = new Map(sign.stars.map((s, i) => [s.id, i]));
  const out = [];
  for (const [a, b] of sign.lines) {
    const i = index.get(a), j = index.get(b);
    if (i !== undefined && j !== undefined) out.push([i, j]);
  }
  return out;
}

// Детерминированный шум: один и тот же знак всегда рассыпается одинаково, поэтому повторный
// вызов не перетряхивает уже собранный рисунок.
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Готовые цели для песка: узелки на звёздах плюс нить вдоль линий.
// Яркая звезда получает более толстый узелок — величина читается размером, как на небе.
//   perStar — крупинок на звезду нулевой величины, слабые получают меньше
//   Значения по умолчанию рассчитаны на знак размером в треть экрана; для мелкой иконки их снижают.
//   perLine — крупинок на сто пикселей нити
// Возвращает Float32Array xy, готовую для sand.setTargets().
export function sandPoints(sign, { x = 0, y = 0, size = 200, perStar = 240, perLine = 64 } = {}) {
  const pts = starsToScreen(sign, { x, y, size });
  const lines = signLines(sign);
  const rnd = seeded(sign.id.length * 2654435761 + sign.stars.length * 40503);
  const out = [];
  sign.stars.forEach((s, i) => {
    const bright = Math.max(0.28, Math.min(1, (5.2 - s.mag) / 4.4));
    const n = Math.max(12, Math.round(perStar * bright));
    const r = size * 0.012 * (0.7 + bright);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, d = r * Math.sqrt(rnd());
      out.push(pts[i * 2] + Math.cos(a) * d, pts[i * 2 + 1] + Math.sin(a) * d);
    }
  });
  for (const [i, j] of lines) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(6, Math.round(len / 100 * perLine));
    for (let k = 0; k < n; k++) {
      const t = (k + rnd() * 0.9) / n;
      const jitter = (rnd() - 0.5) * size * 0.012;   // нить живая, а не чертёжная
      const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
      out.push(ax + (bx - ax) * t + nx * jitter, ay + (by - ay) * t + ny * jitter);
    }
  }
  return new Float32Array(out);
}
