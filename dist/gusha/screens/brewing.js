// Короткое «заваривание» между билетом и датой; одно ядро песка остаётся живым.
import { FONT } from '../ui-kit.js';

let state = null;
export async function mount(ctx) {
  const sand = ctx.sand;
  await sand.ready;
  const s = state = { dead: false, timers: [], ctx, sand };
  const cx = sand.w / 2, cy = sand.h / 2;
  sand.shape('br-ring', 'pillEdge', {
    x: cx, y: cy - 28, w: Math.min(sand.w - 80, 260), h: 112,
    thickness: 3, density: 1.2, wob: .04, arrive: 'flow', span: .38
  });
  sand.text('br-title', 'Завариваем кофе…', {
    x: cx, y: cy - 46, size: 31, font: FONT.serif, align: 'center',
    density: 1.55, wob: .025, arrive: 'wave-x', span: .4
  });
  let p = 0;
  const progress = () => {
    if (s.dead) return;
    p = Math.min(100, p + 20);
    sand.text('br-progress', `${p}%`, {
      x: cx, y: cy + 18, size: 24, font: FONT.sans, align: 'center',
      density: 1.7, wob: .01, arrive: 'burst', span: .1
    });
    if (p < 100) s.timers.push(setTimeout(progress, 220));
    else s.timers.push(setTimeout(() => { if (!s.dead) ctx.go('date'); }, 240));
  };
  s.timers.push(setTimeout(progress, 180));
  return s;
}
export async function unmount() {
  const s = state; if (!s) return;
  state = null; s.dead = true;
  for (const t of s.timers) clearTimeout(t);
  for (const id of s.sand.groups) if (id.startsWith('br-')) s.sand.drop(id);
}
