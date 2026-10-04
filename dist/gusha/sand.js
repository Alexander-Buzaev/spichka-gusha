// Кофейная гуща · ядро песка.
//
// Один холст WebGL1 на весь экран, одно облако крупинок. Всё белое из Figma — текст, кнопки,
// колёса, чашка, картинки — это ЭТИ ЖЕ крупинки, собранные в группу целей; фон между ними —
// свободный поток с золотыми разводами (принцип sky.js).
//
// Три решения, на которых держится ядро.
//
// 1. У крупинки есть масса. Пружина + вязкость (KS/KD, как в card.js), поэтому сборка — это
//    прилёт с отставанием и лёгким перелётом, а не телепорт. Назначение крупинок на цели ищется
//    тем же дешёвым способом: случайные пары меняются целями, если суммарный путь короче.
//
// 2. Никаких сумм синусов по ВРЕМЕНИ. Поток — три сдвиговые моды с фиксированными
//    ПРОСТРАНСТВЕННЫМИ частотами (поле бездивергентно: v = (∂ψ/∂y, −∂ψ/∂x)), а их фазы и
//    амплитуды едут процессами Орнштейна–Уленбека. Спектральных линий нет, ритм не считывается.
//    Косинус берётся из таблицы: быстрее, и никакого хеш-шума fract(sin(x)*43758) в шейдере
//    (точность GLSL sin не определена стандартом).
//
// 3. То же поле течения, что гонит свободный песок, слегка деформирует СОБРАННЫЕ глифы:
//    цель смещается на WOB·v(x,y). Буква дышит, но остаётся читаемой — и дышит от того же
//    источника, что и фон.
//
// Блик. Крупинка — не плоский кружок: нормаль берётся из gl_PointCoord как полусфера,
// тёплый ключ стоит сверху-справа, холодный синий подсвечивает снизу, спекуляр даёт искру.
// Плюс кинетический блик: крупинка ярче и крупнее, когда её скорость сонаправлена со светом —
// поэтому летящий песок «искрит», а лежащий спокоен.
//
// Система координат снаружи — пиксели экрана, y вниз, начало в левом верхнем углу холста.

const TAU = Math.PI * 2;
const PHI2 = 0.7548776662;      // ряд Роберта: равномерная раскладка без сгустков

// --- случайность и таблица косинуса ---
let rs = 0;
try { rs = crypto.getRandomValues(new Uint32Array(1))[0] >>> 0; } catch { rs = 0; }
if (!rs) rs = (Date.now() ^ 0x9e3779b9) >>> 0;
const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; };
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;
const LN = 4096, LUT = new Float32Array(LN + 1);
for (let i = 0; i <= LN; i++) LUT[i] = Math.cos(i / LN * TAU);
// Косинус берут прямо из LUT с линейной добивкой — формула развёрнута по месту использования
// (шаг крупинки, единственный её потребитель, считается сорок шесть тысяч раз в кадр).
const sstep = t => t * t * (3 - 2 * t);

export const RELEASE_STYLES = ['burst', 'vortex', 'split-spiral', 'stream', 'strands', 'drip', 'wave-x'];
export const ARRIVE_MODES = ['wave-x', 'burst', 'flow'];

// --- шейдеры ---
// aState = (x, y, alpha, shine); aGold — тёплая примесь; aTone — статический разброс размера.
const VS = `attribute vec4 aState;attribute float aGold;attribute float aTone;
uniform vec2 uSize;uniform float uDpr;
varying float vA;varying float vShine;varying float vGold;
void main(){
gl_Position=vec4(aState.x/uSize.x*2.-1.,1.-aState.y/uSize.y*2.,0.,1.);
vA=aState.z;vShine=aState.w;vGold=max(aGold,0.);
float fine=aGold < -1. ? clamp(1.+(aGold+1.)*.6667,.5,1.) : 1.;
float boost=aGold < -1. ? 0. : max(-aGold,0.)*1.20;
gl_PointSize=uDpr*(1.02+aTone*.86+aState.w*1.40+boost)*fine;}`;
const FS = `precision mediump float;
varying float vA;varying float vShine;varying float vGold;
uniform vec3 uKey;uniform vec3 uFill;uniform vec3 uSand;uniform vec3 uWarm;uniform vec3 uCool;
void main(){
vec2 p=(gl_PointCoord-.5)*2.;
float r2=dot(p,p);
if(r2>1.)discard;
vec3 n=vec3(p.x,-p.y,sqrt(max(0.,1.-r2)));
float key=max(dot(n,uKey),0.);
float fil=max(dot(n,uFill),0.);
vec3 h=normalize(uKey+vec3(0.,0.,1.));
float spec=pow(max(dot(n,h),0.),24.);
vec3 col=uSand*(.44+.56*key)+uCool*(fil*.26)+uWarm*(spec*(.34+1.5*vShine));
col=mix(col,uWarm,vGold*.62);
float a=(1.-smoothstep(.72,1.,r2))*vA;
gl_FragColor=vec4(col*a,a);}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

export function createSand(canvas, opts = {}) {
  const COUNT = Math.max(1000, opts.count || 46000);
  const reduced = opts.reduced != null ? !!opts.reduced
    : matchMedia('(prefers-reduced-motion:reduce)').matches;

  // --- холст ---
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: false, depth: false, premultipliedAlpha: true, powerPreference: 'low-power'
  });
  let W = 1, H = 1, dpr = 1, M = 40;            // M — поля за кадром, где живёт свободный песок
  let prog = null, uSize = null, uDpr = null, uKey = null, uFill = null;

  // --- состояние крупинок ---
  const pos = new Float32Array(COUNT * 2), vel = new Float32Array(COUNT * 2);
  const tgt = new Float32Array(COUNT * 2);
  const tone = new Float32Array(COUNT);         // статический разброс: размер и яркость зерна
  const grp = new Int32Array(COUNT).fill(-1);   // индекс группы или −1 (свободна)
  const slot = new Int32Array(COUNT).fill(-1);  // номер цели внутри группы
  const stun = new Float32Array(COUNT);         // касание временно отпускает крупинку
  const gvt = new Float32Array(COUNT);          // остаток «стекания вниз» после release drip
  const fly = new Float32Array(COUNT);          // свободный полёт: поток пока не переучивает крупинку
  const hot = new Float32Array(COUNT);          // яркость, с которой крупинка гаснет после роспуска
  const out = new Float32Array(COUNT * 5);      // x, y, alpha, shine, gold — один interleave
  for (let i = 0; i < COUNT; i++) { const u = rnd(); tone[i] = .24 + .76 * u * u; }

  // --- поток: три сдвиговые моды, фазы и амплитуды — процессы Орнштейна–Уленбека ---
  const MODE = [[470, .70, 1.00, .50], [255, 2.30, .55, .30], [720, 4.10, .78, .20]].map(([lam, dir, a0, w]) => ({
    kx: TAU / lam * Math.cos(dir), ky: TAU / lam * Math.sin(dir),
    ph: rnd() * TAU, vp: gauss(), am: gauss(), a0, w, A: a0
  }));
  let gustX = gauss(), gustY = gauss();
  let windX = 0, windY = 0;                     // внешняя погода (датчики)
  let flowMode = 'sky', SP = 1700, GU = 18, calm = 1;
  function stepField(dt) {
    for (const m of MODE) {
      const k1 = Math.exp(-dt / 3.4); m.vp = m.vp * k1 + gauss() * Math.sqrt(1 - k1 * k1);
      const k2 = Math.exp(-dt / 7.5); m.am = m.am * k2 + gauss() * Math.sqrt(1 - k2 * k2);
      m.ph += m.vp * .55 * dt * calm; m.A = m.a0 * (.55 + .45 * Math.tanh(m.am));
    }
    const kg = Math.exp(-dt / 4.5), s = Math.sqrt(1 - kg * kg);
    gustX = gustX * kg + gauss() * s; gustY = gustY * kg + gauss() * s;
  }

  // Временные микропартии вместо жёстких пространственных кластеров. У каждой
  // крупинки своё значение поля; за кадр обновляется четверть массива,
  // остальные идут по запечённому значению не дольше 50 мс. Ячейки с одной
  // общей скоростью на длинном прогоне сгущали песок в полосы — здесь границ нет.
  let sharedFlow = opts.sharedFlow === true;
  const bakedX = new Float32Array(COUNT), bakedY = new Float32Array(COUNT), bakedCloud = new Float32Array(COUNT);
  let bakePhase = 0, bakeReady = false;

  // --- свет ---
  let Lx = .55, Ly = -.55, Lz = .62;            // экранное направление на свет (y вниз, z к зрителю)
  let lsx = 0, lsy = 0;                         // та же ось для кинетического блика
  function setLight(v) {
    const x = v.x != null ? v.x : .55, y = v.y != null ? v.y : -.55, z = v.z != null ? v.z : .62;
    const l = Math.hypot(x, y, z) || 1;
    Lx = x / l; Ly = y / l; Lz = z / l;
    lsx = Lx; lsy = Ly;
    if (gl && uKey) { gl.useProgram(prog); gl.uniform3f(uKey, Lx, -Ly, Lz); gl.uniform3f(uFill, -Lx * .5, Ly * .8 - .5, .5); }
  }
  lsx = Lx; lsy = Ly;

  // --- группы ---
  const groups = new Map();
  let liveGroups = [];
  const refresh = () => { liveGroups = [...groups.values()]; };

  // --- сетка свободных крупинок: назначение берёт ближайшую, а не случайную ---
  const CELL = 46;
  let gw = 1, gh = 1;
  let cstart = new Int32Array(1), citem = new Int32Array(1);
  const claimed = new Uint8Array(COUNT);
  let freeList = new Int32Array(COUNT), freeN = 0, freePtr = 0;
  function buildGrid() {
    gw = Math.max(1, Math.ceil((W + 2 * M) / CELL) + 1);
    gh = Math.max(1, Math.ceil((H + 2 * M) / CELL) + 1);
    const nc = gw * gh;
    if (cstart.length < nc + 1) cstart = new Int32Array(nc + 1); else cstart.fill(0, 0, nc + 1);
    freeN = 0;
    for (let i = 0; i < COUNT; i++) {
      if (grp[i] >= 0) continue;
      freeList[freeN++] = i;
      cstart[cellOf(pos[i * 2], pos[i * 2 + 1]) + 1]++;
    }
    for (let c = 0; c < nc; c++) cstart[c + 1] += cstart[c];
    if (citem.length < freeN) citem = new Int32Array(freeN);
    const cur = new Int32Array(nc);
    for (let f = 0; f < freeN; f++) {
      const i = freeList[f], c = cellOf(pos[i * 2], pos[i * 2 + 1]);
      citem[cstart[c] + cur[c]++] = i;
    }
    claimed.fill(0); freePtr = 0;
  }
  function cellOf(x, y) {
    let cx = ((x + M) / CELL) | 0; if (cx < 0) cx = 0; else if (cx >= gw) cx = gw - 1;
    let cy = ((y + M) / CELL) | 0; if (cy < 0) cy = 0; else if (cy >= gh) cy = gh - 1;
    return cy * gw + cx;
  }
  // ближайшая непойманная крупинка вокруг (x,y); кольца растут, пока кто-нибудь не найдётся
  function claimNear(x, y) {
    let bx = ((x + M) / CELL) | 0, by = ((y + M) / CELL) | 0;
    for (let r = 0; r <= 7; r++) {
      let best = -1, bd = 1e18;
      const x0 = bx - r, x1 = bx + r, y0 = by - r, y1 = by + r;
      for (let cy = y0; cy <= y1; cy++) {
        if (cy < 0 || cy >= gh) continue;
        const edge = (cy === y0 || cy === y1);
        for (let cx = x0; cx <= x1; cx += (edge ? 1 : (x1 - x0) || 1)) {
          if (cx < 0 || cx >= gw) continue;
          const c = cy * gw + cx, e = cstart[c + 1];
          for (let p = cstart[c]; p < e; p++) {
            const i = citem[p]; if (claimed[i]) continue;
            const dx = pos[i * 2] - x, dy = pos[i * 2 + 1] - y, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = i; }
          }
        }
      }
      if (best >= 0) { claimed[best] = 1; return best; }
    }
    while (freePtr < freeN) { const i = freeList[freePtr++]; if (!claimed[i]) { claimed[i] = 1; return i; } }
    return -1;
  }

  // --- регистрация группы ---
  function setTargets(id, points, o = {}) {
    if (groups.has(id)) dropGroup(id, true);
    const total = points.length >> 1;
    if (!total) return 0;
    buildGrid();
    const cap = Math.max(0, freeN - 200);
    const n = Math.min(total, cap);
    if (!n) return 0;
    const stride = total / n;

    const gidx = idIndex(id);
    const arrive = o.arrive || 'flow';
    const rise = o.rise != null ? o.rise : .62;
    const base = o.delay || 0;
    const span = o.span != null ? o.span : (arrive === 'wave-x' ? .60 : arrive === 'burst' ? .06 : .34);
    const srcTone = points.tone || null;
    const srcDelay = points.delay || null;

    const pts = new Float32Array(n * 2), dly = new Float32Array(n);
    const ptone = new Float32Array(n), mem = new Int32Array(n).fill(-1);
    let minX = 1e9, maxX = -1e9;
    for (let j = 0; j < n; j++) {
      const s = (j * stride) | 0;
      const x = points[s * 2], y = points[s * 2 + 1];
      pts[j * 2] = x; pts[j * 2 + 1] = y;
      ptone[j] = srcTone ? srcTone[s] : 1;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
    }
    const wx = maxX - minX || 1;
    // откуда прилетает песок: волна тянет крупинки с той стороны, откуда идёт
    const dirX = arrive === 'wave-x' ? -1 : 0;
    const fb = arrive === 'flow' ? 1 : 0;
    for (let j = 0; j < n; j++) {
      const x = pts[j * 2], y = pts[j * 2 + 1];
      dly[j] = base + (srcDelay ? srcDelay[(j * stride) | 0] * span + rnd() * .035 : arrive === 'wave-x'
        ? (x - minX) / wx * span + rnd() * .13
        : arrive === 'burst' ? rnd() * span : rnd() * span + sstep(rnd()) * span * .5);
      const sx = x + dirX * (150 + rnd() * 120) + fb * gauss() * 70;
      const sy = y + (dirX ? gauss() * 60 : fb * gauss() * 70);
      const i = claimNear(sx, sy);
      if (i < 0) continue;
      mem[j] = i; grp[i] = gidx; slot[i] = j; fly[i] = 0; gvt[i] = 0; hot[i] = 0;
      tgt[i * 2] = x; tgt[i * 2 + 1] = y;
    }
    const G = {
      id, n, pts, dly, ptone, mem, rise,
      age: 0, rel: -1, relStyle: 'burst', rdly: null, spin: rnd() < .5 ? -1 : 1,
      strand: null, tone: o.tone != null ? o.tone : 1, gold: o.gold || 0,
      opacityByTone: !!o.opacityByTone,
      wob: o.wob != null ? o.wob : 1, settle: 0
    };
    groups.set(id, G);
    refresh(); reindex();
    if (reduced) {                                     // без движения: состояние сразу собрано
      for (let j = 0; j < n; j++) {
        const i = mem[j]; if (i < 0) continue;
        pos[i * 2] = pts[j * 2]; pos[i * 2 + 1] = pts[j * 2 + 1];
        vel[i * 2] = 0; vel[i * 2 + 1] = 0; dly[j] = 0;
      }
      G.age = 9; G.settle = 9;
    }
    return n;
  }
  // grp хранит порядковый номер в liveGroups; держим таблицу id → индекс
  const order = new Map();
  function idIndex(id) {
    if (!order.has(id)) order.set(id, order.size);
    return order.get(id);
  }
  // Группа по своему номеру. Таблица нужна на КАЖДУЮ собранную крупинку, но меняется она только
  // при появлении и уходе групп — поэтому её собирают там, а не на каждом кадре: раньше кадр
  // создавал новую Map шестьдесят раз в секунду впустую.
  let idx2g = new Map();
  function reindex() {
    idx2g.clear();
    for (const G of groups.values()) idx2g.set(idIndex(G.id), G);
  }

  function updateTargets(id, points) {
    const G = groups.get(id); if (!G) return false;
    const total = points.length >> 1; if (!total) return false;
    const stride = total / G.n;
    const srcTone = points.tone || null;
    for (let j = 0; j < G.n; j++) {
      const s = Math.min(total - 1, (j * stride) | 0);
      G.pts[j * 2] = points[s * 2]; G.pts[j * 2 + 1] = points[s * 2 + 1];
      if (srcTone) G.ptone[j] = srcTone[s];
      const i = G.mem[j]; if (i < 0) continue;
      tgt[i * 2] = G.pts[j * 2]; tgt[i * 2 + 1] = G.pts[j * 2 + 1];
      if (reduced) { pos[i * 2] = tgt[i * 2]; pos[i * 2 + 1] = tgt[i * 2 + 1]; }
    }
    return true;
  }

  // --- роспуск ---
  function dropGroup(id, silent) {
    const G = groups.get(id); if (!G) return;
    for (let j = 0; j < G.n; j++) {
      const i = G.mem[j]; if (i < 0) continue;
      grp[i] = -1; slot[i] = -1;
      if (!silent) { vel[i * 2] += gauss() * 40; vel[i * 2 + 1] += gauss() * 40; }
    }
    groups.delete(id); refresh(); reindex();
  }
  function release(id, o = {}) {
    const G = groups.get(id); if (!G) return false;
    const style = RELEASE_STYLES.includes(o.style) ? o.style : 'burst';
    G.relStyle = style; G.rel = 0; G.relPow = o.power != null ? o.power : 1;
    const rdly = new Float32Array(G.n);
    let minX = 1e9, maxX = -1e9, cx0 = 0, cy0 = 0;
    for (let j = 0; j < G.n; j++) { const x = G.pts[j * 2]; cx0 += x; cy0 += G.pts[j * 2 + 1]; if (x < minX) minX = x; if (x > maxX) maxX = x; }
    G.cx = cx0 / G.n; G.cy = cy0 / G.n;
    const wx = maxX - minX || 1;
    if (style === 'strands') {
      // пряди нарезаются по углу вокруг центра: рядом стоящие крупинки уходят вместе,
      // и глаз видит отдельные космы, а не равномерный веер
      const k = 3 + ((rnd() * 3) | 0);
      G.strand = new Float32Array(k * 2); G.sidx = new Uint8Array(G.n); G.strandK = k;
      for (let t = 0; t < k; t++) {
        const a = (t + .5) / k * TAU + gauss() * .22, sp = .78 + rnd() * .55;
        G.strand[t * 2] = Math.cos(a) * sp; G.strand[t * 2 + 1] = Math.sin(a) * sp;
      }
      for (let j = 0; j < G.n; j++) {
        const an = Math.atan2(G.pts[j * 2 + 1] - G.cy, G.pts[j * 2] - G.cx);
        const t = ((an + Math.PI) / TAU * k) | 0;
        G.sidx[j] = t >= k ? k - 1 : t;
        rdly[j] = G.sidx[j] * .085 + rnd() * .07;
      }
    } else if (style === 'split-spiral') {
      // Обе половины уходят одновременно; лёгкий разброс делает поток живым,
      // но не заставляет соседние буквы рассыпаться в разное время.
      for (let j = 0; j < G.n; j++) rdly[j] = rnd() * .10;
    } else if (style === 'wave-x') {
      for (let j = 0; j < G.n; j++) rdly[j] = (G.pts[j * 2] - minX) / wx * .52 + rnd() * .10;
    } else if (style === 'drip') {
      for (let j = 0; j < G.n; j++) rdly[j] = rnd() * rnd() * .70;
    } else {
      for (let j = 0; j < G.n; j++) rdly[j] = rnd() * (style === 'burst' ? .24 : .34);
    }
    G.rdly = rdly;
    if (reduced) dropGroup(id, true);
    return true;
  }
  function kick(i, G, fx, fy) {
    const k = i * 2, s = slot[i], pw = G.relPow;
    // пока летит — поток почти не вмешивается, иначе форма рассыпания смазывается за полсекунды
    fly[i] = 1.45 + rnd() * .95;
    hot[i] = (.34 + .66 * G.tone) * (.54 + .46 * tone[i]);
    const dx = pos[k] - G.cx, dy = pos[k + 1] - G.cy, d = Math.hypot(dx, dy) + 1;
    switch (G.relStyle) {
      case 'split-spiral': {
        const side = G.pts[s * 2] < W / 2 ? -1 : 1;
        const qx = pos[k] - (W / 2 + side * W * .25);
        const qy = pos[k + 1] - H * .45;
        const qr = Math.hypot(qx, qy) + 1;
        const spin = -side;
        const swirl = (145 + rnd() * 85) * pw;
        vel[k] += side * (220 + rnd() * 95) * pw - qy / qr * spin * swirl + qx / qr * 45 * pw;
        vel[k + 1] += qx / qr * spin * swirl + qy / qr * 45 * pw + gauss() * 18;
        fly[i] = 2.2 + rnd() * .45;
        break;
      }
      case 'vortex': {                                     // спираль: твёрдое вращение + медленный разлёт
        // У соседних крупинок близкий курс, но в поле есть мягкие вторичные завитки:
        // один жёсткий вращающийся диск читался механическим поворотом фотографии.
        const a = Math.atan2(dy, dx);
        const eddy = Math.sin(a * 3.1 + d * .024) * .44
          + Math.sin(dx * .021 - dy * .017) * .27;
        const om = (1.42 + eddy + rnd() * 1.0) * G.spin * pw;
        const ra = (22 + 20 * Math.cos(a * 2.3 + d * .013) + rnd() * 45) * pw;
        const dd = Math.min(210, d);
        vel[k] += -dy / d * dd * om + dx / d * ra + gauss() * 23;
        vel[k + 1] += dx / d * dd * om + dy / d * ra + gauss() * 23;
        break;
      }
      case 'stream': {                                     // струя вдоль поля течения
        const f = (2.6 + rnd() * 1.5) * pw;
        vel[k] += fx * SP * f + gustX * 62 + gauss() * 15;
        vel[k + 1] += fy * SP * f + gustY * 62 + gauss() * 15;
        break;
      }
      case 'strands': {                                    // распад на пряди: у каждой свой курс
        const t = G.sidx[s] * 2, f = (78 + rnd() * 54) * pw;
        vel[k] += G.strand[t] * f + gauss() * 11;
        vel[k + 1] += G.strand[t + 1] * f + gauss() * 11;
        break;
      }
      case 'drip': {                                       // стекание вниз
        vel[k] += gauss() * 18;
        vel[k + 1] += (20 + rnd() * 40) * pw;
        gvt[i] = 1.3 + rnd() * 1.0; fly[i] = 2.1 + rnd() * .7;
        break;
      }
      case 'wave-x': {                                     // текст уходит той же волной, какой пришёл
        const f = (60 + rnd() * 78) * pw;
        vel[k] += f + gauss() * 16; vel[k + 1] += gauss() * 22;
        break;
      }
      default: {                                           // burst
        const f = (58 + rnd() * 96) * pw;
        vel[k] += dx / d * f + gauss() * f * .32;
        vel[k + 1] += dy / d * f + gauss() * f * .32;
      }
    }
    grp[i] = -1; slot[i] = -1;
  }

  // --- касание: локальное рассыпание с возвратом ---
  function hit(x, y, radius = 90, power = 430) {
    const r2 = radius * radius;
    for (let i = 0; i < COUNT; i++) {
      const k = i * 2, dx = pos[k] - x, dy = pos[k + 1] - y, d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2) + 1, t = 1 - d / radius, f = power * t * (.6 + rnd() * .8);
      vel[k] += dx / d * f + gauss() * f * .22;
      vel[k + 1] += dy / d * f + gauss() * f * .22;
      if (grp[i] >= 0) { const s = .32 + .5 * t; if (s > stun[i]) stun[i] = s; }
      else fly[i] = Math.max(fly[i], .38 + .35 * t);
    }
  }

  // --- шаг ---
  // Свободная крупинка должна СЛЕДОВАТЬ полю, а не тащиться за ним по инерции. Инерционные
  // частицы в вихревом поле центрифугируются из вихрей и слипаются в полосы: за минуту кадр
  // разваливается на плотные сгустки и пустоту (проверено: CV плотности 0.035 → 1.77 за 70 с).
  // Малое время релаксации TF убирает слипание, диффузия DIF добивает остаток.
  const KS = 30, KD = 7.4, JIT = 22, WOB = 300, TF = .19, DIF = 135;

  // Шаг крупинки считается сорок шесть тысяч раз в кадр, поэтому в теле цикла нет ни одного
  // вызова: таблица косинуса, толчок и зажимы развёрнуты прямо в строки, а поля мод сняты
  // в локальные переменные до цикла. Разница не косметическая: под холодным JIT (WebKit
  // доводит функцию до верхнего уровня не всегда) вызов стоит дороже самой формулы, и на
  // экране hello — самом тяжёлом — кадр из-за этого проваливался с 60 до 43.
  //
  // Толчок берётся из готовой таблицы GT: те же (rnd+rnd+rnd−1.5)·2, посчитанные один раз.
  // Начало обхода таблицы каждый кадр сдвигается случайно, поэтому крупинка не получает из
  // кадра в кадр один и тот же ряд и никакого ритма в шуме не заводится.
  const GN = 8192, GM = GN - 1, GT = new Float32Array(GN);
  for (let i = 0; i < GN; i++) GT[i] = gauss();
  let gp = 0;
  const INV_TAU = 1 / TAU;

  function tick(dt) {
    dt = Math.min(.034, Math.max(.001, dt));
    stepField(dt);
    const phase = bakePhase;
    bakePhase = (bakePhase + 1) & 3;
    const firstBake = !bakeReady;
    const m0 = MODE[0], m1 = MODE[1], m2 = MODE[2];
    const A0 = m0.A * calm, A1 = m1.A * calm, A2 = m2.A * calm;
    const k0x = m0.kx, k0y = m0.ky, ph0 = m0.ph, w0 = m0.w;
    const k1x = m1.kx, k1y = m1.ky, ph1 = m1.ph, w1 = m1.w;
    const k2x = m2.kx, k2y = m2.ky, ph2 = m2.ph, w2 = m2.w;
    const swirlOn = flowMode === 'sky', dim = reduced ? 0 : 1;
    const invA = 1 - Math.exp(-dt / TF);
    const xlo = -M, xhi = W + M, ylo = -M, yhi = H + M, wW = xhi - xlo, wH = yhi - ylo;
    // Всё, что цикл читает, снимается в локальные имена. Переменная замыкания — это обращение
    // к объекту области видимости: на сорока шести тысячах крупинок оно заметно, а на холодном
    // JIT оно и есть главная цена кадра.
    const Ppos = pos, Pvel = vel, Ptgt = tgt, Pout = out, Ptone = tone;
    const Pgrp = grp, Pslot = slot, Pstun = stun, Pgvt = gvt, Pfly = fly, Phot = hot;
    const TBL = LUT, TN = LN, GTB = GT, G2 = idx2g;
    const BX = bakedX, BY = bakedY, BC = bakedCloud;
    const sp0 = SP, gu0 = GU, gX = gustX, gY = gustY, wX = windX, wY = windY, lx = lsx, ly = lsy;
    let g = (gp + ((rnd() * GN) | 0)) & GM;

    for (const G of liveGroups) {
      G.age += dt;
      if (G.rel >= 0) G.rel += dt;
      if (G.settle < 9) G.settle += dt;
      if (G.settle < 2.6 && !reduced) optimise(G, Math.min(700, G.n));
    }

    for (let i = 0; i < COUNT; i++) {
      const k = i * 2;
      let x = Ppos[k], y = Ppos[k + 1];
      let fx, fy, cloud;
      if (!sharedFlow || firstBake || (i & 3) === phase) {
        // Точное значение в текущей точке; контрольный полный расчёт по ?flow=direct.
        let u0 = (k0x * x + k0y * y + ph0) * INV_TAU; u0 -= Math.floor(u0);
        const q0 = u0 * TN, j0 = q0 | 0, c0 = TBL[j0] + (TBL[j0 + 1] - TBL[j0]) * (q0 - j0);
        let u1 = (k1x * x + k1y * y + ph1) * INV_TAU; u1 -= Math.floor(u1);
        const q1 = u1 * TN, j1 = q1 | 0, c1 = TBL[j1] + (TBL[j1 + 1] - TBL[j1]) * (q1 - j1);
        let u2 = (k2x * x + k2y * y + ph2) * INV_TAU; u2 -= Math.floor(u2);
        const q2 = u2 * TN, j2 = q2 | 0, c2 = TBL[j2] + (TBL[j2 + 1] - TBL[j2]) * (q2 - j2);
        fx = A0 * k0y * c0 + A1 * k1y * c1 + A2 * k2y * c2;
        fy = -(A0 * k0x * c0 + A1 * k1x * c1 + A2 * k2x * c2);
        cloud = .5 + .5 * (w0 * c0 + w1 * c1 + w2 * c2);
        if (sharedFlow) { BX[i] = fx; BY[i] = fy; BC[i] = cloud; }
      } else { fx = BX[i]; fy = BY[i]; cloud = BC[i]; }

      let sn = Pstun[i];
      if (sn > 0) { sn -= dt / .95; if (sn < 0) sn = 0; Pstun[i] = sn; }
      let vx = Pvel[k], vy = Pvel[k + 1];
      const gi = Pgrp[i];
      let a = 0, gt = 1, gg = 0, toneAlpha = false;
      if (gi >= 0) {
        const G = G2.get(gi);
        if (G) {
          const s = Pslot[i];
          if (G.rel >= 0 && G.rel >= G.rdly[s]) { kick(i, G, fx, fy); vx = Pvel[k]; vy = Pvel[k + 1]; }
          else {
            const t = (G.age - G.dly[s]) / G.rise;
            a = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
            if (sn > 0) a *= 1 - sn;
            gt = G.tone * G.ptone[s]; gg = G.gold; toneAlpha = G.opacityByTone;
            // собранный глиф дышит тем же полем, что гонит фон: цель едет, буква живёт
            const w = WOB * G.wob;
            const ax = Ptgt[k] + fx * w, ay = Ptgt[k + 1] + fy * w;
            const sw = a * dt;
            g = (g + 1) & GM; vx += ((ax - x) * KS - vx * KD) * sw + GTB[g] * JIT * sw;
            g = (g + 1) & GM; vy += ((ay - y) * KS - vy * KD) * sw + GTB[g] * JIT * sw;
          }
        } else { Pgrp[i] = -1; Pslot[i] = -1; }
      }
      const gv = Pgvt[i];
      if (gv > 0) { Pgvt[i] = gv - dt; vy += 230 * dt; }
      let fw = 1;
      let fl = Pfly[i];
      if (fl > 0) {
        fl -= dt; Pfly[i] = fl; fw = .13;
        const dr = 1.15 * dt; vx -= vx * dr; vy -= vy * dr;
      }
      if (a < 1) {
        const w = (1 - a) * invA * fw;
        g = (g + 1) & GM; vx += (fx * sp0 + gX * gu0 + wX - vx) * w + GTB[g] * DIF * w;
        g = (g + 1) & GM; vy += (fy * sp0 + gY * gu0 + wY - vy) * w + GTB[g] * DIF * w;
      }
      Pvel[k] = vx; Pvel[k + 1] = vy;
      x += vx * dt; y += vy * dt;
      if (a < .02) {                                  // свободный песок заворачивается по кадру
        if (x < xlo) x += wW; else if (x > xhi) x -= wW;
        if (y < ylo) y += wH; else if (y > yhi) y -= wH;
      }
      Ppos[k] = x; Ppos[k + 1] = y;

      const tn = Ptone[i];
      let cl = (cloud - .28) * 1.75; cl = cl < 0 ? 0 : cl > 1 ? 1 : cl;
      let free = dim * (.025 + .030 * cl + .11 * cl * cl) * (.42 + .58 * tn);
      const ht = Phot[i];
      if (ht > 0) {                                     // роспуск: яркость сходит за время полёта
        const glow = fl > 0 ? (fl > 1.2 ? 1 : fl / 1.2) : 0;
        if (glow <= 0) Phot[i] = 0; else { const lit = ht * glow; if (lit > free) free = lit; }
      }
      const bound = (toneAlpha ? Math.max(0, Math.min(1, gt)) : .34 + .66 * gt) * (.54 + .46 * tn);
      const sp = Math.sqrt(vx * vx + vy * vy);
      // кинетический блик: скорость по свету — крупинка вспыхивает
      let al = sp > 6 ? (vx * lx + vy * ly) / sp : 0;
      al = al < 0 ? 0 : al > 1 ? 1 : al;
      let sl = sp * (1 / 300); sl = sl > 1 ? 1 : sl;
      const shine = al * al * sl * (.35 + .65 * tn);
      const o = i * 5;
      Pout[o] = x; Pout[o + 1] = y;
      Pout[o + 2] = a <= 0 ? free : free + (bound - free) * a;
      Pout[o + 3] = shine;
      let swirl = 0;
      if (swirlOn) { const sw2 = (cl - .52) * 2.1; swirl = (sw2 < 0 ? 0 : sw2 > 1 ? 1 : sw2) * .85; }
      Pout[o + 4] = a <= 0 ? swirl : swirl * (1 - a) + gg * a;
    }
    if (sharedFlow) bakeReady = true;
    gp = g;
    // группы, отпущенные целиком, убираем
    for (const G of liveGroups) {
      if (G.rel < 0) continue;
      let live = 0;
      for (let j = 0; j < G.n; j++) { const i = G.mem[j]; if (i >= 0 && grp[i] >= 0 && slot[i] === j) live++; }
      if (!live) { groups.delete(G.id); refresh(); reindex(); }
    }
  }
  // дешёвый поиск назначения: пара меняется целями, если суммарный путь короче
  function optimise(G, pairs) {
    const mem = G.mem, n = G.n;
    for (let q = 0; q < pairs; q++) {
      const a = (rnd() * n) | 0, b = (rnd() * n) | 0; if (a === b) continue;
      const i = mem[a], j = mem[b]; if (i < 0 || j < 0) continue;
      if (grp[i] < 0 || grp[j] < 0) continue;
      const xi = pos[i * 2], yi = pos[i * 2 + 1], xj = pos[j * 2], yj = pos[j * 2 + 1];
      const ai = tgt[i * 2], bi = tgt[i * 2 + 1], aj = tgt[j * 2], bj = tgt[j * 2 + 1];
      const cur = (xi - ai) ** 2 + (yi - bi) ** 2 + (xj - aj) ** 2 + (yj - bj) ** 2;
      const swp = (xi - aj) ** 2 + (yi - bj) ** 2 + (xj - ai) ** 2 + (yj - bi) ** 2;
      if (swp < cur) {
        mem[a] = j; mem[b] = i;
        slot[i] = b; slot[j] = a;               // задержка и тон живут в цели, а не в крупинке
        tgt[i * 2] = aj; tgt[i * 2 + 1] = bj; tgt[j * 2] = ai; tgt[j * 2 + 1] = bi;
      }
    }
  }

  // --- рисование ---
  let stateBuf = null, toneBuf = null;
  if (gl) {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    stateBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, stateBuf);
    gl.bufferData(gl.ARRAY_BUFFER, out, gl.DYNAMIC_DRAW);
    const aState = gl.getAttribLocation(prog, 'aState');
    gl.enableVertexAttribArray(aState); gl.vertexAttribPointer(aState, 4, gl.FLOAT, false, 20, 0);
    const aGold = gl.getAttribLocation(prog, 'aGold');
    gl.enableVertexAttribArray(aGold); gl.vertexAttribPointer(aGold, 1, gl.FLOAT, false, 20, 16);
    toneBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, toneBuf);
    gl.bufferData(gl.ARRAY_BUFFER, tone, gl.STATIC_DRAW);
    const aTone = gl.getAttribLocation(prog, 'aTone');
    gl.enableVertexAttribArray(aTone); gl.vertexAttribPointer(aTone, 1, gl.FLOAT, false, 0, 0);
    uSize = gl.getUniformLocation(prog, 'uSize'); uDpr = gl.getUniformLocation(prog, 'uDpr');
    uKey = gl.getUniformLocation(prog, 'uKey'); uFill = gl.getUniformLocation(prog, 'uFill');
    gl.uniform3f(gl.getUniformLocation(prog, 'uSand'), .910, .824, .667);
    gl.uniform3f(gl.getUniformLocation(prog, 'uWarm'), 1.0, .855, .565);
    gl.uniform3f(gl.getUniformLocation(prog, 'uCool'), .40, .54, .92);
    setLight({ x: Lx, y: Ly, z: Lz });
  }
  function draw() {
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, stateBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, out);
    gl.drawArrays(gl.POINTS, 0, COUNT);
  }

  function resize() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    dpr = Math.min(devicePixelRatio || 1, opts.dprCap || 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (gl) { gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(prog); gl.uniform2f(uSize, W, H); gl.uniform1f(uDpr, dpr); }
  }
  function setFlowSampling(mode) {
    const next = mode !== 'direct';
    if (next === sharedFlow) return;
    sharedFlow = next;
    if (next) bakeReady = false;
  }
  resize();
  for (let i = 0; i < COUNT; i++) { pos[i * 2] = -M + rnd() * (W + 2 * M); pos[i * 2 + 1] = -M + rnd() * (H + 2 * M); }

  // ─────────── построение целей ───────────

  // общий полутон: веса → кумулятивная кривая → низкодискрепантный ряд.
  // Крупинка j всегда берёт u = frac(j·φ): при смене кадра цели едут непрерывно, а не тасуются.
  const PHI = .61803398875;
  // Готовые локальные цели для повторяющихся надписей и неизменных фотографий.
  // Позиция на экране не входит в ключ: одну форму можно перенести без повторной
  // растеризации. Ключ содержит ширину холста и кегль, поэтому адаптивная
  // раскладка после поворота не получает цели от прежнего формата.
  const targetCache = new Map();
  const CACHE_LIMIT = opts.cacheLimit || 24 * 1024 * 1024;
  let cacheBytes = 0, cacheHits = 0, cacheMisses = 0;
  function cacheGet(key) {
    const item = targetCache.get(key);
    if (!item) { cacheMisses++; return null; }
    targetCache.delete(key); targetCache.set(key, item);
    cacheHits++;
    return item;
  }
  function cachePut(key, points, box) {
    const bytes = points.byteLength + (points.tone?.byteLength || 0);
    if (bytes > CACHE_LIMIT) return;
    while (cacheBytes + bytes > CACHE_LIMIT && targetCache.size) {
      const first = targetCache.keys().next().value;
      cacheBytes -= targetCache.get(first).bytes;
      targetCache.delete(first);
    }
    targetCache.set(key, { points, box, bytes });
    cacheBytes += bytes;
  }
  function placed(item, x, y) {
    const src = item.points, pts = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 2) {
      pts[i] = src[i] + x; pts[i + 1] = src[i + 1] + y;
    }
    // Некоторые экраны меняют тон полученной формы: кэш остаётся неизменным.
    if (src.tone) pts.tone = src.tone.slice();
    pts.box = { x, y, w: item.box.w, h: item.box.h };
    return pts;
  }
  function sampleWeights(w, W0, H0, n, ox, oy, sx, sy) {
    let sum = 0;
    for (let i = 0; i < w.length; i++) sum += w[i];
    if (sum <= 1e-6) return new Float32Array(0);
    const cdf = new Float32Array(w.length);
    let acc = 0;
    for (let i = 0; i < w.length; i++) { acc += w[i] / sum; cdf[i] = acc; }
    const pts = new Float32Array(n * 2), tn = new Float32Array(n);
    let hi0 = w.length - 1;
    for (let j = 0; j < n; j++) {
      const u = (j * PHI + .5) % 1;
      let lo = 0, hi = hi0;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
      const px = lo % W0, py = (lo / W0) | 0;
      pts[j * 2] = ox + (px + rnd()) * sx;
      pts[j * 2 + 1] = oy + (py + rnd()) * sy;
      tn[j] = .55 + .45 * Math.min(1, w[lo]);
    }
    pts.tone = tn;
    return pts;
  }

  // --- текст ---
  const tc = document.createElement('canvas');
  const tx2 = tc.getContext('2d', { willReadFrequently: true });
  const fonts = (document.fonts ? document.fonts.load('500 40px Cormorant').catch(() => { }) : Promise.resolve());
  if (document.fonts) {
    document.fonts.addEventListener?.('loadingdone', () => { targetCache.clear(); cacheBytes = 0; });
    fonts.then(() => { targetCache.clear(); cacheBytes = 0; });
  }
  function textLayout(str, o = {}) {
    const size = o.size || 34, weight = o.weight || 400, SS = 2;
    const font = weight + ' ' + (size * SS) + 'px ' + (o.font || 'Cormorant, Georgia, serif');
    tx2.font = font;
    const lh = (o.lineHeight || 1.18) * size;
    // перенос по словам, если задан maxWidth
    let lines = String(str).split('\n');
    if (o.maxWidth) {
      const wrapped = [];
      for (const ln of lines) {
        const words = ln.split(/\s+/); let cur = '';
        for (const wd of words) {
          const t = cur ? cur + ' ' + wd : wd;
          if (tx2.measureText(t).width / SS > o.maxWidth && cur) { wrapped.push(cur); cur = wd; }
          else cur = t;
        }
        wrapped.push(cur);
      }
      lines = wrapped;
    }
    let mw = 1;
    for (const ln of lines) mw = Math.max(mw, tx2.measureText(ln).width / SS);
    const bw = Math.ceil(mw + size * .5), bh = Math.ceil(lines.length * lh + size * .36);
    return { size, weight, SS, font, lines, lh, bw, bh, align: o.align || 'center' };
  }
  function text(id, str, o = {}) {
    const size = o.size || 34, align = o.align || 'center';
    const key = JSON.stringify(['text', W, str, size, o.weight || 400, o.font || 'Cormorant, Georgia, serif',
      o.lineHeight || 1.18, o.maxWidth || 0, align, o.density || 0, o.count || 0]);
    let item = cacheGet(key);
    if (item) {
      const { w: bw, h: bh } = item.box;
      const ax = align === 'left' ? (o.x || 0) : align === 'right' ? (o.x || 0) - bw : (o.x || 0) - bw / 2;
      const ay = o.baseline === 'middle' ? (o.y || 0) - bh / 2 : (o.y || 0);
      const pts = placed(item, ax, ay);
      if (id) setTargets(id, pts, o);
      return pts;
    }
    const { SS, font, lines, lh, bw, bh } = textLayout(str, o);
    const ax = align === 'left' ? (o.x || 0) : align === 'right' ? (o.x || 0) - bw : (o.x || 0) - bw / 2;
    const ay = o.baseline === 'middle' ? (o.y || 0) - bh / 2 : (o.y || 0);
    tc.width = Math.max(2, bw * SS); tc.height = Math.max(2, bh * SS);
    tx2.font = font; tx2.fillStyle = '#fff'; tx2.textBaseline = 'alphabetic';
    tx2.textAlign = align;
    tx2.clearRect(0, 0, tc.width, tc.height);
    for (let i = 0; i < lines.length; i++) {
      const lineX = align === 'left' ? size * .25 * SS : align === 'right' ? tc.width - size * .25 * SS : tc.width / 2;
      tx2.fillText(lines[i], lineX, (size * .90 + lh * i) * SS);
    }
    const d = tx2.getImageData(0, 0, tc.width, tc.height).data;
    const w = new Float32Array(tc.width * tc.height);
    let ink = 0;
    for (let i = 0; i < w.length; i++) { const v = d[i * 4 + 3] / 255; w[i] = v * v; ink += v; }
    const area = ink / (SS * SS);
    // мелкий кегль требует больше крупинок на пиксель, иначе штрих распадается
    const dens = o.density || .50 * Math.max(1, Math.min(2.7, 34 / size));
    const n = Math.max(24, Math.min(o.count || Math.round(area * dens), 26000));
    const local = sampleWeights(w, tc.width, tc.height, n, 0, 0, 1 / SS, 1 / SS);
    item = { points: local, box: { w: bw, h: bh } };
    cachePut(key, local, item.box);
    const pts = placed(item, ax, ay);
    if (id) setTargets(id, pts, o);
    return pts;
  }
  function measure(str, o = {}) {
    const { bw, bh, align } = textLayout(str, o);
    return {
      x: align === 'left' ? (o.x || 0) : align === 'right' ? (o.x || 0) - bw : (o.x || 0) - bw / 2,
      y: o.baseline === 'middle' ? (o.y || 0) - bh / 2 : (o.y || 0), w: bw, h: bh
    };
  }

  // --- картинка полутоном ---
  const ic = document.createElement('canvas');
  const ix = ic.getContext('2d', { willReadFrequently: true });
  function image(id, src, o = {}) {
    const sw = src.width || src.videoWidth || 1, sh = src.height || src.videoHeight || 1;
    const w0 = Math.max(1, Math.min(o.sample || 150, sw)), h0 = Math.max(1, Math.round(w0 * sh / sw));
    const bw = o.w || w0, bh = o.h || (bw * h0 / w0);
    const n = Math.max(24, Math.min(o.count || 7000, 30000));
    const ax = o.x != null ? o.x : 0, ay = o.y != null ? o.y : 0;
    // Явный cacheKey обязателен: некоторые экраны передают живой canvas, который
    // меняет пиксели при тех же размерах. Линзы используют неизменные фото.
    const key = o.cacheKey == null ? null : JSON.stringify(['image', W, o.cacheKey, sw, sh, w0, h0,
      bw, bh, n, o.gamma != null ? o.gamma : 1.25, !!o.invert, o.floor != null ? o.floor : .06]);
    if (key) {
      const item = cacheGet(key);
      if (item) {
        const pts = placed(item, ax, ay);
        if (id) setTargets(id, pts, o);
        return pts;
      }
    }
    ic.width = w0; ic.height = h0;
    ix.clearRect(0, 0, w0, h0);
    ix.drawImage(src, 0, 0, w0, h0);
    const d = ix.getImageData(0, 0, w0, h0).data, w = new Float32Array(w0 * h0);
    const gamma = o.gamma != null ? o.gamma : 1.25, inv = !!o.invert, floor = o.floor != null ? o.floor : .06;
    for (let i = 0; i < w0 * h0; i++) {
      let L = (d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114) / 255;
      if (inv) L = 1 - L;
      L *= d[i * 4 + 3] / 255;
      L = L < floor ? 0 : (L - floor) / (1 - floor);
      w[i] = Math.pow(L, gamma);
    }
    const local = sampleWeights(w, w0, h0, n, 0, 0, bw / w0, bh / h0);
    const item = { points: local, box: { w: bw, h: bh } };
    if (key) cachePut(key, local, item.box);
    const pts = placed(item, ax, ay);
    if (id) setTargets(id, pts, o);
    return pts;
  }

  // --- фигуры ---
  function roundRectSDF(px, py, hw2, hh2, r) {
    const qx = Math.abs(px) - (hw2 - r), qy = Math.abs(py) - (hh2 - r);
    const mx = Math.max(qx, 0), my = Math.max(qy, 0);
    return Math.hypot(mx, my) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function shape(id, kind, p = {}) {
    let pts = null;
    if (kind === 'ring' || kind === 'arc') {
      const r = p.r || 60, th = p.width != null ? p.width : 6;
      const a0 = kind === 'arc' ? (p.a0 || 0) : 0, a1 = kind === 'arc' ? (p.a1 != null ? p.a1 : Math.PI) : TAU;
      const arc = Math.abs(a1 - a0);
      const n = p.count || Math.max(120, Math.round(r * arc * Math.max(1.4, th) * .30));
      pts = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const t = (i * PHI) % 1;
        const a = a0 + (a1 - a0) * ((i + .5) / n);
        const rr = r + (t - .5) * th + gauss() * th * .16;
        pts[i * 2] = (p.x || 0) + Math.cos(a) * rr;
        pts[i * 2 + 1] = (p.y || 0) + Math.sin(a) * rr;
      }
    } else if (kind === 'circle') {
      const r = p.r || 60, n = p.count || Math.max(150, Math.round(Math.PI * r * r * .12));
      pts = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const rr = r * Math.sqrt((i + .5) / n), a = i * 2.39996323;
        pts[i * 2] = (p.x || 0) + Math.cos(a) * rr + gauss() * .6;
        pts[i * 2 + 1] = (p.y || 0) + Math.sin(a) * rr + gauss() * .6;
      }
    } else if (kind === 'pill' || kind === 'pillEdge') {
      const w = p.w || 200, h = p.h || 56, r = Math.min(p.r != null ? p.r : h / 2, Math.min(w, h) / 2);
      const th = p.thickness != null ? p.thickness : 2.6;
      const area = kind === 'pill' ? w * h : (2 * (w + h) * th);
      const n = p.count || Math.max(150, Math.round(area * (p.density || (kind === 'pill' ? .34 : .80))));
      const arr = new Float32Array(n * 2);
      const cx = (p.x || 0), cy = (p.y || 0), hw2 = w / 2, hh2 = h / 2;
      let got = 0, guard = 0;
      while (got < n && guard++ < n * 60) {
        const px = (rnd() - .5) * w, py = (rnd() - .5) * h;
        const s = roundRectSDF(px, py, hw2, hh2, r);
        const ok = kind === 'pill' ? (s < -.5) : (s > -th && s < .4);
        if (!ok) continue;
        arr[got * 2] = cx + px; arr[got * 2 + 1] = cy + py; got++;
      }
      pts = got === n ? arr : arr.slice(0, got * 2);
    } else {
      pts = new Float32Array(0);
    }
    if (id && pts.length) setTargets(id, pts, p);
    return pts;
  }

  // --- поток и погода ---
  function setFlow(mode) {
    flowMode = mode === 'calm' ? 'calm' : 'sky';
    if (flowMode === 'calm') { SP = 620; GU = 7; calm = .45; }
    else { SP = 1700; GU = 18; calm = 1; }
  }
  setFlow(opts.flow || 'sky');
  function wind(st) {
    if (!st) { windX = 0; windY = 0; return; }
    if (st.roll != null || st.pitch != null) {
      windX = Math.tanh(st.roll || 0) * 90;
      windY = Math.tanh((st.pitch || 0) - .6) * 60;
    } else { windX = st.x || 0; windY = st.y || 0; }
  }

  // --- прогрев горячего цикла ---
  //
  // Шаг крупинки — одна функция на сорок шесть тысяч повторов, и WebKit решает, КАК её
  // компилировать, по первым же сотням витков. Если к этому моменту ни одна крупинка не
  // собрана в группу, ветка сборки помечается недостижимой. Когда группа наконец появляется
  // (на #sky — через несколько секунд после входа, на #hello — как повезёт), функцию
  // выбрасывает из оптимизированного кода, и дальше кадр считается вдесятеро медленнее:
  // 2.1 мс → 22 мс, то есть 60 fps → 43. Возврата нет, сколько бы кадров ни прошло.
  //
  // Поэтому самые первые такты делаются с понарошку собранной и тут же отпущенной группой:
  // компилятор видит сразу все ветки — сборку, толчок роспуска, полёт, стекание, свечение.
  // Состояние крупинок после прогрева возвращается на место, на экране он никак не виден.
  function prime() {
    if (reduced || !COUNT) return;
    const n = Math.min(512, COUNT);
    const pts = new Float32Array(n * 2), pt = new Float32Array(n);
    pts.tone = pt;
    for (let j = 0; j < n; j++) {
      pts[j * 2] = W * (.25 + .5 * ((j * PHI2) % 1));
      pts[j * 2 + 1] = H * (.25 + .5 * ((j * .5698402909) % 1));
      pt[j] = 1;
    }
    const p0 = pos.slice(), v0 = vel.slice();
    setTargets('__prime', pts, { arrive: 'burst', span: .02, rise: .05 });
    hit(W * .5, H * .5, Math.max(W, H), 40);            // ветка касания: stun
    tick(1 / 60);                                       // сборка + касание
    release('__prime', { style: 'drip' });
    tick(1 / 60);                                       // толчок роспуска, полёт, стекание
    dropGroup('__prime', true);
    grp[0] = 32767; slot[0] = 0;                         // ветка осиротевшей крупинки
    tick(1 / 60);                                       // свечение после роспуска
    pos.set(p0); vel.set(v0);
    stun.fill(0); gvt.fill(0); fly.fill(0); hot.fill(0);
  }
  prime();

  const api = {
    gl, canvas, count: COUNT, reduced, ready: fonts,
    get flowSampling() { return sharedFlow ? 'baked' : 'direct'; },
    setFlowSampling,
    get w() { return W; }, get h() { return H; },
    get free() { let n = 0; for (let i = 0; i < COUNT; i++) if (grp[i] < 0) n++; return n; },
    get groups() { return [...groups.keys()]; },
    get cacheStats() { return { hits: cacheHits, misses: cacheMisses, entries: targetCache.size, bytes: cacheBytes }; },
    has: id => groups.has(id),
    setTargets, updateTargets, release, drop: id => dropGroup(id, true),
    clear: () => { for (const id of [...groups.keys()]) dropGroup(id, true); },
    text, measure, image, shape, hit, light: setLight, wind, setFlow, tick, draw, resize,
    positions: pos
  };
  return api;
}
