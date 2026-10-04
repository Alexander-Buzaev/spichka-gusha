// Видеоключи экрана Hello: восемь секунд пролива эспрессо, проигранные песком.
//
// Кадры лежат готовыми в hello-frames.bin (120x212, 20 fps, 160 кадров, байт яркости на пиксель),
// их делает scripts/build-hello-frames.py из Refs/hello-video.mp4. Живое <video> в рантайме
// не нужно: WebKit в headless не всегда декодирует mp4, а исходник весит 14 МБ против 4 МБ здесь.
// Кто захочет — может поверх подмешать настоящее видео, формат целей от этого не меняется.
//
// Тон уже сведён на сборке. Крупинки закреплены на псевдослучайной решётке;
// экран hello превращает яркость в число непрозрачных точек без движения кластеров.

const hash01 = n => {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

let cached = null;

// Читает hello-frames.bin. Возвращает {w,h,fps,duration,frames:Uint8Array[]}.
// Повторные вызовы отдают тот же промис: экран может звать её сколько угодно раз.
export function loadHelloFrames(url) {
  if (cached) return cached;
  const src = url || new URL('./hello-frames.bin', import.meta.url).href;
  cached = fetch(src).then(async r => {
    if (!r.ok) throw new Error(`hello-frames.bin: HTTP ${r.status}`);
    const buf = await r.arrayBuffer();
    return decode(buf);
  });
  return cached;
}

// Разбор контейнера: 'HSF1' + w,h,fps,n (uint16 LE), дальше n·w·h байт, строки сверху вниз.
export function decode(buffer) {
  const head = new Uint8Array(buffer, 0, 4);
  if (head[0] !== 72 || head[1] !== 83 || head[2] !== 70 || head[3] !== 49) {
    throw new Error('hello-frames: не тот формат, ожидался HSF1');
  }
  const meta = new DataView(buffer, 4, 8);
  const w = meta.getUint16(0, true), h = meta.getUint16(2, true);
  const fps = meta.getUint16(4, true), n = meta.getUint16(6, true);
  const px = w * h;
  if (buffer.byteLength < 12 + px * n) throw new Error('hello-frames: файл оборван');
  const frames = new Array(n);
  for (let i = 0; i < n; i++) frames[i] = new Uint8Array(buffer, 12 + i * px, px);
  return { w, h, fps, count: n, duration: n / fps, frames };
}

// Номер ключа для момента t (в секундах). loop — зациклить, иначе держать последний кадр.
export function frameIndexAt(clip, t, loop = true) {
  const i = Math.floor(t * clip.fps);
  if (loop) return ((i % clip.count) + clip.count) % clip.count;
  return i < 0 ? 0 : i >= clip.count ? clip.count - 1 : i;
}

// Без повторения крайних ключей: 0 → последний → 0 → следующий.
// Так пролив возвращается к исходному кадру и снова идёт вперёд без скачка.
export function boomerangFrameIndex(clip, t) {
  const last = clip.count - 1;
  if (last <= 0) return 0;
  const period = last * 2;
  const i = ((Math.floor(Math.max(0, t) * clip.fps) % period) + period) % period;
  return i <= last ? i : period - i;
}

// Прямоугольник, в который ложится кадр внутри области rect, с сохранением пропорций.
export function fitRect(clip, rect, fit = 'contain') {
  const { x, y, w, h } = rect;
  if (fit === 'fill') return { x, y, w, h };
  const a = clip.w / clip.h, b = w / h;
  const wide = fit === 'cover' ? a < b : a > b;
  const fw = wide ? w : h * a, fh = wide ? w / a : h;
  return { x: x + (w - fw) / 2, y: y + (h - fh) / 2, w: fw, h: fh };
}

// Раздаёт count крупинкам закреплённые цели и полутон ключа frame.
//   clip   — то, что вернула loadHelloFrames
//   frame  — номер ключа
//   rect   — куда положить кадр на экране, {x,y,w,h} в px, y вниз
//   points — Float32Array(count*2), заполняется xy; её владелец — вызывающий
//   tone   — необязательная Float32Array(count): 0..1, яркость в точке
// Возвращает постоянное число крупинок: даже чёрный кадр не пересоздаёт группу.
export function helloTargets(clip, frame, rect, points, tone) {
  const count = points.length >> 1;
  const { w, h } = clip, px = clip.frames[frame];
  // Закреплённая псевдослучайная решётка: у крупинки не меняется адрес из-за того,
  // что где-то в кадре потемнел пиксель. Меняется только её полутон. Старый CDF
  // с кривой Гильберта перекидывал длинные группы по всему изображению — это и
  // выглядело как заметное движение кластерами.
  const aspect = rect.w / rect.h;
  const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  for (let i = 0; i < count; i++) {
    const x = i % cols, y = (i / cols) | 0;
    const jx = hash01(i ^ 0x71e11a), jy = hash01(i ^ 0x54f37b);
    const u = (x + .12 + .76 * jx) / cols, v = (y + .12 + .76 * jy) / rows;
    points[i * 2] = rect.x + u * rect.w;
    points[i * 2 + 1] = rect.y + v * rect.h;
    if (tone) {
      const sx = Math.min(w - 1, Math.max(0, u * w - .5));
      const sy = Math.min(h - 1, Math.max(0, v * h - .5));
      const x0 = sx | 0, y0 = sy | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const a = px[y0 * w + x0] * (1 - fx) + px[y0 * w + x1] * fx;
      const b = px[y1 * w + x0] * (1 - fx) + px[y1 * w + x1] * fx;
      tone[i] = (a * (1 - fy) + b * fy) / 255;
    }
  }
  return count;
}

// Быстрая справка: сколько «чернил» в ключе (0..1). По ней экран решает, сколько крупинок
// отдать кадру, а сколько оставить потоку — на тёмных кадрах песок не сгущается зря.
export function frameInk(clip, frame) {
  const px = clip.frames[frame];
  let acc = 0;
  for (let i = 0; i < px.length; i++) acc += px[i];
  return acc / (px.length * 255);
}
