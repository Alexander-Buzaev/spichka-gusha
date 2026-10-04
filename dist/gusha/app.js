// «Кофейная гуща» — сшивка отдельного билда.
//
// Здесь ровно четыре обязанности и ни одной сцены:
//   1) один экземпляр ядра песка на весь поток и единственный кадровый цикл;
//   2) маршрут по location.hash с ожиданием unmount прежнего экрана;
//   3) свой DOM-контейнер каждому экрану (контракты у экранов разошлись — см. ниже);
//   4) session в sessionStorage, чтобы перезагрузка посреди потока не теряла выбор.
//
// Экраны ядро НЕ тикают: sand.tick/draw зовёт только этот файл.

import { createSand } from './sand.js';

// Небо выключено. SMS — условная ветка (?auth=full), lens — отдельный визуальный стенд.
const ORDER = ['hello', 'ticket', 'brewing', 'date', 'cup', 'phone', 'code', 'name',
  'stories', 'sphere', 'sphere-ticket', 'profile', 'lens'];

const LOADERS = {
  hello: () => import('./screens/hello.js'),
  ticket: () => import('./screens/ticket.js'),
  brewing: () => import('./screens/brewing.js'),
  lens:  () => import('./screens/lens.js'),
  date:  () => import('./screens/date.js'),
  cup:   () => import('./screens/cup.js'),
  phone: () => import('./screens/phone.js'),
  code:  () => import('./screens/code.js'),
  name: () => import('./screens/name.js'),
  stories: () => import('./screens/stories.js'),
  sphere: () => import('./screens/lens.js'),
  'sphere-ticket': () => import('./screens/ticket.js'),
  profile: () => import('./screens/profile.js')
};

// Префиксы групп песка по экранам. Нужны страховкой: если mount упал на полдороге или
// экран забыл свою группу, крупинки навсегда останутся занятыми и следующий экран
// соберётся обеднённым. После unmount подбираем хвосты по префиксу.
const PREFIX = {
  hello: ['hello:'], ticket: ['tk-'], brewing: ['br-'], lens: ['lens:'], date: ['dt:'], cup: ['cup:'],
  phone: ['ph-'], code: ['cd-'], name: ['nm-'], stories: ['st-'],
  sphere: ['lens:'], 'sphere-ticket': ['tk-'], profile: ['pf-']
};

// Чашка слушает pointerdown на СВОЁМ root (локальное рассыпание под пальцем), поэтому
// её контейнер обязан принимать указатель. Все остальные экраны ловят касание на холсте
// и требуют обратного — прозрачного контейнера.
const ROOT_POINTER = { cup: 'auto', stories: 'auto' };

const q = new URLSearchParams(location.search);
const COUNT = Math.max(4000, Math.min(120000, parseInt(q.get('count'), 10) || 80000));
const memory = navigator.deviceMemory || 0;
const cores = navigator.hardwareConcurrency || 0;
const lowPower = q.get('lowPower') === '1' ||
  (memory > 0 && memory <= 4) || (cores > 0 && cores <= 2);
const ua = navigator.userAgent || '';
const webkit = /iP(hone|ad|od)/.test(ua) ||
  (/Safari/.test(ua) && !/(Chrome|Chromium|Android|Edg|OPR)/.test(ua));
const flowChoice = q.get('flow');

const canvas = document.getElementById('sand');
const host = document.getElementById('screens');
const boot = document.getElementById('boot');

// Два кадра дают браузеру показать лёгкую песочную заставку до синхронного
// создания WebGL-ядра. Это улучшает первый отклик, не добавляя пауз в маршруте.
await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const sand = createSand(canvas, {
  count: COUNT, flow: 'sky', dprCap: lowPower ? 1.5 : 2,
  sharedFlow: flowChoice === 'baked' || (flowChoice !== 'direct' && webkit),
  cacheLimit: lowPower ? 8 * 1024 * 1024 : 24 * 1024 * 1024
});

// ─────────────────────────────── session ───────────────────────────────
// Пишут её сами экраны, каждый своим полем: lens → session.lens, date → birth/signId,
// phone → phone/channel, code → code. Ловим запись прокси и складываем в sessionStorage:
// перезагрузка на #code не должна терять номер, иначе подпись «отправлен на …» соврёт.
const SKEY = 'gusha.session.v1';

function readSession() {
  try {
    const raw = sessionStorage.getItem(SKEY);
    const o = raw ? JSON.parse(raw) : null;
    return (o && typeof o === 'object') ? o : {};
  } catch (_) { return {}; }
}
function writeSession(o) {
  try { sessionStorage.setItem(SKEY, JSON.stringify(o)); } catch (_) { /* приватный режим */ }
}

const rawSession = readSession();
const session = new Proxy(rawSession, {
  set(t, k, v) { t[k] = v; writeSession(t); return true; },
  deleteProperty(t, k) { delete t[k]; writeSession(t); return true; }
});

// ─────────────────────────────── кадр ───────────────────────────────
// Один rAF на весь билд. Экраны, которым нужен собственный таймлайн, либо крутят свой
// rAF (date, hello, lens, sky), либо подписываются сюда через ctx.onFrame (cup).
const frameSubs = new Set();
const onFrame = fn => {
  if (typeof fn !== 'function') return () => {};
  frameSubs.add(fn);
  return () => frameSubs.delete(fn);
};

let last = performance.now();
let fpsAcc = 0, fpsN = 0;
window.fps = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = (now - last) / 1000;
  last = now;
  if (document.hidden || window.paused) return;          // скрытая вкладка не рисует
  const d = Math.min(.05, Math.max(.001, dt));
  for (const fn of frameSubs) { try { fn(d); } catch (e) { report('frame', e); } }
  sand.tick(d);
  sand.draw();
  fpsAcc += d; fpsN++;
  if (fpsAcc > .5) { window.fps = +(fpsN / fpsAcc).toFixed(1); fpsAcc = 0; fpsN = 0; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) last = performance.now(); });
requestAnimationFrame(frame);

// Холст пересчитываем раньше, чем экраны начнут перестраивать раскладку (у них дебаунс
// 180–280 мс): им нужен уже новый sand.w/sand.h.
let resizeT = 0;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => sand.resize(), 120);
});
addEventListener('orientationchange', () => { clearTimeout(resizeT); resizeT = setTimeout(() => sand.resize(), 120); });

// ─────────────────────────────── маршрут ───────────────────────────────
const ctx = { sand, root: null, session, go, onFrame, screen: null, order: ORDER };

const mods = new Map();
async function load(name) {
  if (mods.has(name)) return mods.get(name);
  const m = await LOADERS[name]();
  mods.set(name, m);
  return m;
}

function report(where, e) {
  // Одно место, где ошибка экрана становится видимой: без него сломанный mount просто
  // оставлял бы пустой синий экран и молчаливую консоль.
  console.error('[gusha] ' + where + ': ' + (e && e.message ? e.message : e));
  if (e && e.stack) console.error(e.stack);
}

function makeRoot(name) {
  const el = document.createElement('div');
  el.className = 'gscreen';
  el.dataset.screen = name;
  el.style.pointerEvents = ROOT_POINTER[name] || 'none';
  host.appendChild(el);
  return el;
}

let cur = null;              // { name, mod, root }
let busy = false;
let queued = null;

async function teardown() {
  const c = cur;
  if (!c) return;
  cur = null;
  try { await c.mod.unmount(ctx); } catch (e) { report('unmount ' + c.name, e); }
  // Чашка вешает свой отладочный пульт на ctx; без уборки он переживёт экран.
  if (ctx.cup) { try { delete ctx.cup; } catch (_) { ctx.cup = undefined; } }
  const pre = PREFIX[c.name] || [];
  for (const id of sand.groups) {
    for (const p of pre) if (id.indexOf(p) === 0) { sand.drop(id); break; }
  }
  if (c.root && c.root.parentNode) c.root.parentNode.removeChild(c.root);
}

async function go(name) {
  if (!LOADERS[name]) name = 'hello';
  if (busy) { queued = name; return; }
  busy = true;
  try {
    for (;;) {
      queued = null;
      await teardown();
      let mod;
      try { mod = await load(name); }
      catch (e) { report('load ' + name, e); break; }

      const root = makeRoot(name);
      ctx.root = root;
      ctx.screen = name;
      cur = { name, mod, root };
      setHash(name);
      document.body.dataset.screen = name;
      window.screenName = name;

      // После поворота браузер может отдать новый innerWidth раньше, чем обновит
      // clientWidth фиксированного canvas. Монтируем сцену только после layout-кадра.
      await new Promise(resolve => setTimeout(resolve, 16));
      sand.resize();
      try { await mod.mount(ctx); }
      catch (e) { report('mount ' + name, e); }

      hideBoot();
      if (queued && queued !== name) { name = queued; continue; }
      queued = null;
      break;
    }
  } finally { busy = false; }
}

function setHash(name) {
  const want = '#' + name;
  if (location.hash === want) return;
  // replaceState вместо hash=: маршрут ведут сами экраны, и плодить записи истории
  // на каждом шаге потока незачем — «назад» тогда возвращал бы в середину анимации.
  try { history.replaceState(null, '', location.pathname + location.search + want); }
  catch (_) { location.hash = want; }
}

addEventListener('hashchange', () => {
  const n = (location.hash || '').slice(1);
  if (!n || n === ctx.screen) return;
  go(n);
});

let booted = false;
function hideBoot() {
  if (booted || !boot) return;
  booted = true;
  boot.classList.add('off');
  setTimeout(() => {
    window.stopBootParticles?.();
    if (boot.parentNode) boot.parentNode.removeChild(boot);
  }, 600);
}

// ─────────────────────────────── крюки QA ───────────────────────────────
// В проде безвредны, но без них снимок Playwright запаздывает на сотни миллисекунд
// и любое рассыпание выглядит мгновенным.
window.sand = sand;
window.ctx = ctx;
window.go = go;
window.paused = false;
window.step = (seconds, rate = 60) => {
  const dt = 1 / rate;
  const n = Math.round(seconds * rate);
  for (let i = 0; i < n; i++) {
    for (const fn of frameSubs) { try { fn(dt); } catch (_) {} }
    sand.tick(dt);
  }
  sand.draw();
};
window.fpsProbe = (ms = 1500) => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const tick = () => {
    n++;
    (performance.now() - t0 < ms) ? requestAnimationFrame(tick)
      : res(+(n / ((performance.now() - t0) / 1000)).toFixed(1));
  };
  requestAnimationFrame(tick);
});
window.gusha = {
  get screen() { return ctx.screen; },
  get busy() { return busy; },
  get free() { return sand.free; },
  get groups() { return sand.groups; },
  get session() { return { ...rawSession }; },
  reduced: sand.reduced,
  count: COUNT,
  lowPower,
  get flowSampling() { return sand.flowSampling; },
  reset() { try { sessionStorage.removeItem(SKEY); } catch (_) {} }
};

// ─────────────────────────────── старт ───────────────────────────────
const start = (location.hash || '').slice(1);
go(LOADERS[start] ? start : 'hello');
