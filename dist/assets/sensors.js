// Датчики ориентации для автономных экспериментов СПИЧКИ.
// Один вход для золотого блика (наклон = направление света) и для созвездий (курс по компасу).
//
// Контракт: createSensors({ onFrame, loopPeriod }) → { start, stop, state, mode }.
// state — живой объект, обновляемый раз в кадр:
// { pitch, roll, heading, yaw, gx, gy, gz, live, mode }.
// Все углы в радианах. Страница может либо получать onFrame(state, dt), либо читать state
// из своего requestAnimationFrame — поддержано и то и другое: модуль всегда крутит свой
// лёгкий цикл, а state — тот же объект, который читает страница.
//
// Когда датчиков нет (десктоп, headless, отказ в разрешении) — модуль не замирает, а выдаёт
// синтетический дрейф: суммы процессов Орнштейна–Уленбека. У ОУ нет спектральных линий,
// поэтому петля не считывается глазом как повтор, в отличие от суммы синусов.
// Переход loop↔live идёт через затухающее смещение, поэтому скачка на стыке нет.

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const wrap2 = a => { a %= TAU; return a < 0 ? a + TAU : a; };
const num = v => typeof v === 'number' && isFinite(v);

// iOS 13+ требует жеста пользователя. Флаг и вызов вынесены наружу: страница рисует тихую
// подсказку и дёргает requestPermission() из обработчика тапа.
export const needsGesture = typeof DeviceOrientationEvent !== 'undefined'
  && typeof DeviceOrientationEvent.requestPermission === 'function';

let permission = needsGesture ? 'prompt' : 'granted';
export function getPermission() { return permission; }
export async function requestPermission() {
  if (!needsGesture) return permission = 'granted';
  try { permission = await DeviceOrientationEvent.requestPermission(); }
  catch { permission = 'denied'; }
  return permission;
}

// --- случайность: один xorshift на модуль, засеянный crypto ---
let rs = 0;
try { rs = crypto.getRandomValues(new Uint32Array(1))[0] >>> 0; } catch { rs = 0; }
if (!rs) rs = (Date.now() ^ 0x9e3779b9) >>> 0;
const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; };
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2; // std ≈ 1

// Банк ОУ-процессов с несоизмеримыми временами релаксации: сумма трёх шкал даёт и крупный
// снос, и мелкое дыхание, но нигде не повторяется — это шум, а не квазипериодика.
function makeBank(taus, weights) {
  const x = new Float64Array(taus.length);
  let norm = 0; for (const w of weights) norm += w * w; norm = Math.sqrt(norm) || 1;
  return dt => {
    let s = 0;
    for (let i = 0; i < taus.length; i++) {
      const a = Math.exp(-dt / taus[i]);
      x[i] = x[i] * a + gauss() * Math.sqrt(Math.max(0, 1 - a * a));
      s += x[i] * weights[i];
    }
    return s / norm;
  };
}

export function screenAngle() {
  const o = typeof screen !== 'undefined' && screen.orientation;
  if (o && num(o.angle)) return o.angle;
  if (typeof window !== 'undefined' && num(window.orientation)) return window.orientation;
  return 0;
}

// alpha/beta/gamma (порядок Z-X'-Y'', мир: X восток, Y север, Z вверх) → экранная рама.
// Возвращает { pitch, roll, heading } либо null, если событие пустое (iOS до разрешения).
export function parseOrientation(ev, angleDeg) {
  const { alpha, beta, gamma } = ev;
  if (!num(alpha) || !num(beta) || !num(gamma)) return null;
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  // Столбцы R (device → world): оси прибора, выраженные в мире.
  const xw0 = cA * cG - sA * sB * sG, xw1 = cG * sA + cA * sB * sG, xw2 = -cB * sG;
  const yw0 = -cB * sA, yw1 = cA * cB, yw2 = sB;
  const zw0 = cA * sG + cG * sA * sB, zw1 = sA * sG - cA * cG * sB, zw2 = cB * cG;
  // Гравитация в раме прибора — минус третья строка R.
  const gx = -xw2, gy = -yw2, gz = -zw2;
  // Экранная рама повёрнута относительно прибора на -angle вокруг Z:
  // screenRight = (cosθ, −sinθ, 0), screenUp = (sinθ, cosθ, 0).
  const th = (num(angleDeg) ? angleDeg : screenAngle()) * DEG, cT = Math.cos(th), sT = Math.sin(th);
  const gsx = gx * cT - gy * sT, gsy = gx * sT + gy * cT, gsz = gz;
  // Крен и тангаж обязаны быть развязаны. Общий знаменатель (−gsz) даёт скачок крена на ±π,
  // как только телефон переваливает за вертикаль (beta > 90° — обычная поза «смотрю сверху»),
  // и всё окружение у потребителя встаёт вверх ногами. Поэтому крен берём как наклон
  // гравитации от плоскости экрана-«вертикали»: atan2(gsx, |(gsy,gsz)|) = asin(gsx), диапазон
  // ±π/2, знаменатель всегда ≥ 0 — крен непрерывен, а тангаж спокойно уходит за π/2 к π.
  const pitch = Math.atan2(-gsy, -gsz);              // 0 — лежит, +π/2 — стоит экраном к лицу, π — лежит экраном вниз
  const roll = Math.atan2(gsx, Math.hypot(gsy, gsz)); // + — правый край экрана опущен
  // Курс: смотрим туда, куда «глядит» верх экрана лёжа и затылок телефона стоя.
  const ux = sT * xw0 + cT * yw0, uy = sT * xw1 + cT * yw1;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const vx = ux * cp - zw0 * sp, vy = uy * cp - zw1 * sp;
  let heading = Math.atan2(vx, vy); // atan2(восток, север) — по часовой от севера
  // iOS отдаёт настоящий компас; он привязан к раме прибора, экранный поворот добавляем сами.
  if (num(ev.webkitCompassHeading)) heading = ev.webkitCompassHeading * DEG + th;
  return { pitch, roll, heading: wrap2(heading), gx: gsx, gy: gsy, gz: gsz };
}

export function createSensors(opts = {}) {
  const onFrame = typeof opts.onFrame === 'function' ? opts.onFrame : null;
  const T = num(opts.loopPeriod) && opts.loopPeriod > 0 ? opts.loopPeriod : 9;
  const GAP = num(opts.gap) ? opts.gap : 1.5;         // с — молчание, после которого включается петля
  const SMOOTH = num(opts.smooth) ? opts.smooth : .12; // с — сглаживание живого сигнала
  const BLEND = 1 / 3.2;                               // τ затухания смещения: ~1 с до незаметного

  // gx/gy/gz — единичный вектор гравитации в экранной раме (x вправо, y вверх, z к зрителю).
  // Он восстановлен из сглаженных углов, поэтому непрерывен и в live, и в петле; потребителю
  // лучше строить раму окружения по нему, а не по паре углов — тогда развязка не важна вовсе.
  const state = { pitch: 0, roll: 0, heading: 0, yaw: 0, gx: 0, gy: 0, gz: -1, live: false, mode: 'loop' };

  // --- синтетика ---
  const bank = [
    makeBank([T * .53, T * 1.31, T * 3.11], [1, .62, .38]),
    makeBank([T * .61, T * 1.49, T * 3.67], [1, .62, .38]),
    makeBank([T * .47, T * 1.19, T * 2.83], [1, .58, .41]),
  ];
  const sm = [0, 0, 0];
  const DRIFT = TAU / (T * 7);   // рад/с — оборот курса примерно за 63 с при T = 9
  let loopT = 0, armed = 0;      // armed: плавный ввод амплитуды за первые ~1 с
  const loop = { pitch: 0, roll: 0, yaw: 0 };

  function stepLoop(dt) {
    loopT += dt;
    armed += (1 - armed) * (1 - Math.exp(-dt / .45));
    const k = 1 - Math.exp(-dt / .28);
    for (let i = 0; i < 3; i++) sm[i] += (bank[i](dt) - sm[i]) * k;
    // tanh отрезает редкие хвосты ОУ: телефон в петле не встаёт в неправдоподобную позу,
    // но внутри ±1σ отклик почти линейный — характер дрейфа не страдает
    loop.pitch = (.62 + .38 * Math.tanh(sm[0])) * armed;
    loop.roll = (.34 * Math.tanh(sm[1])) * armed;
    loop.yaw = DRIFT * loopT + .70 * Math.tanh(sm[2]) * armed;
  }

  // --- живой канал ---
  let tgtP = 0, tgtR = 0, tgtY = 0;          // цели из событий (yaw уже развёрнут)
  let liveP = 0, liveR = 0, liveY = 0;       // сглаженные
  let haveLive = false, seeded = false;
  let offP = 0, offR = 0, offY = 0;          // смещение выхода к последнему значению петли
  let now = 0, lastEvent = -1e9;
  const out = { pitch: 0, roll: 0, yaw: 0 }; // последнее выданное значение — якорь для стыков

  function onEvent(ev) {
    const p = parseOrientation(ev);
    if (!p) return;
    lastEvent = now;
    if (!seeded) { tgtP = p.pitch; tgtR = p.roll; tgtY = p.heading; seeded = true; }
    else {
      tgtP += wrapPi(p.pitch - tgtP);
      tgtR += wrapPi(p.roll - tgtR);
      tgtY += wrapPi(p.heading - tgtY);      // непрерывный yaw: 2π→0 не даёт скачка
    }
    if (!haveLive) {                          // стык петля → живое: встаём ровно там, где были
      haveLive = true;
      liveP = tgtP; liveR = tgtR; liveY = tgtY;
      offP = out.pitch - liveP; offR = out.roll - liveR;
      offY = out.yaw - liveY - Math.round((out.yaw - liveY) / TAU) * TAU;
    }
  }

  function frame(dt) {
    now += dt;
    stepLoop(dt);
    if (haveLive && now - lastEvent >= GAP) { // живое пропало: стык живое → петля
      haveLive = false;
      offP = out.pitch - loop.pitch; offR = out.roll - loop.roll;
      offY = out.yaw - loop.yaw - Math.round((out.yaw - loop.yaw) / TAU) * TAU;
    }
    const decay = Math.exp(-dt / BLEND);
    offP *= decay; offR *= decay; offY *= decay;
    if (haveLive) {
      const k = 1 - Math.exp(-dt / SMOOTH);
      liveP += (tgtP - liveP) * k; liveR += (tgtR - liveR) * k; liveY += (tgtY - liveY) * k;
      out.pitch = liveP + offP; out.roll = liveR + offR; out.yaw = liveY + offY;
      state.live = true; state.mode = 'live';
    } else {
      out.pitch = loop.pitch + offP; out.roll = loop.roll + offR; out.yaw = loop.yaw + offY;
      state.live = false; state.mode = permission === 'denied' ? 'denied' : 'loop';
    }
    state.pitch = wrapPi(out.pitch); state.roll = wrapPi(out.roll);
    state.yaw = out.yaw; state.heading = wrap2(out.yaw);
    // обратная сборка гравитации: gsx = sin(roll), |(gsy,gsz)| = cos(roll), направление — тангаж
    const cr = Math.cos(state.roll), sr = Math.sin(state.roll);
    state.gx = sr; state.gy = -cr * Math.sin(state.pitch); state.gz = -cr * Math.cos(state.pitch);
    if (onFrame) onFrame(state, dt);
  }

  // --- запуск ---
  let raf = 0, prev = 0, running = false, listening = false, absolute = false;
  const handlerAbs = ev => { absolute = true; onEvent(ev); };
  const handlerRel = ev => { if (!absolute) onEvent(ev); };

  function tick(t) {
    if (!running) return;
    const dt = Math.min(.1, Math.max(1 / 240, (t - prev) / 1000 || 1 / 60));
    prev = t; frame(dt); raf = requestAnimationFrame(tick);
  }
  function listen() {
    if (listening || typeof window === 'undefined') return;
    listening = true;
    window.addEventListener('deviceorientationabsolute', handlerAbs, false);
    window.addEventListener('deviceorientation', handlerRel, false);
  }
  function unlisten() {
    if (!listening || typeof window === 'undefined') return;
    listening = false;
    window.removeEventListener('deviceorientationabsolute', handlerAbs, false);
    window.removeEventListener('deviceorientation', handlerRel, false);
  }

  function start() {
    if (running) return api;
    running = true; prev = performance.now();
    if (permission !== 'denied') listen();
    raf = requestAnimationFrame(tick);
    return api;
  }
  function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    unlisten();
    return api;
  }
  // Разрешение спрашиваем только из жеста; после «granted» подписка появляется на лету.
  async function permit() {
    const r = await requestPermission();
    if (r === 'granted') { if (running) listen(); }
    else { unlisten(); state.mode = 'denied'; state.live = false; }
    return r;
  }

  const api = {
    start, stop, state, needsGesture, requestPermission: permit,
    get mode() { return state.mode; },
    get permission() { return permission; },
  };
  return api;
}
