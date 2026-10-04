// Общая обвязка тест-страниц экранов 5–7: холст, цикл кадров, HUD и крюки для QA.
// В настоящем билде эту работу делает app.js интегратора; здесь ровно тот же контракт ctx.

import { createSand } from '/gusha/sand.js';

export async function harness(modules, first) {
  const canvas = document.getElementById('sand');
  const root = document.getElementById('root');
  const sand = createSand(canvas, { count: 46000 });
  const session = { phone: '', channel: 'telegram' };
  const ctx = { sand, root, session, go, screens: modules };
  let cur = null, curName = null, busy = false;

  async function go(name) {
    if (busy || !modules[name]) return;
    busy = true;
    if (cur && cur.unmount) await cur.unmount(ctx);
    cur = modules[name]; curName = name;
    location.hash = '#' + name;
    await cur.mount(ctx);
    busy = false;
    window.screenName = name;
  }
  ctx.go = go;

  const elFps = document.getElementById('fps'), elFree = document.getElementById('freeN');
  let last = performance.now(), acc = 0, frames = 0, hudT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = (now - last) / 1000; last = now;
    if (document.hidden || window.paused) return;
    sand.tick(dt); sand.draw();
    acc += dt; frames++; hudT += dt;
    if (hudT > .5 && elFps) {
      elFps.textContent = (frames / acc).toFixed(0);
      if (elFree) elFree.textContent = sand.free;
      acc = 0; frames = 0; hudT = 0;
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) last = performance.now(); });
  requestAnimationFrame(frame);

  addEventListener('resize', () => sand.resize());

  // крюки QA: ровно N кадров по 1/60, чтобы снимок брался в точный момент
  window.sand = sand; window.ctx = ctx; window.paused = false;
  window.step = (seconds, fps = 60) => {
    const dt = 1 / fps;
    for (let i = 0; i < Math.round(seconds * fps); i++) sand.tick(dt);
    sand.draw();
  };
  window.go = go;
  window.fpsProbe = (ms = 1500) => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; (performance.now() - t0 < ms) ? requestAnimationFrame(tick) : res(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
    requestAnimationFrame(tick);
  });

  const start = (location.hash || '').slice(1);
  await go(modules[start] ? start : first);
  return ctx;
}
