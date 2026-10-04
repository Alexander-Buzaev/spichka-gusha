// Экран 6 · «Проверочный код».
//
// Четыре слота-выреза, клавиатура 3×4 и три полноэкранных состояния из Figma: повторная
// отправка с кулдауном, ошибка и успех. Всё белое — песок.
//
// Цифры и стрелка лежат песком внутри одинаковых обводок. Раньше «дальше» имела вдвое более
// плотную кромку и спорила со всем полем; теперь её отличает только сдержанная тёплая примесь.
// Короткие действия «Не приходит код?» и «Изменить номер» тоже получили песочную обводку.
//
// Общее правило экранов, выведенное из снимков: заливка с вырезом — только широкая таблетка
// с подписью от 22 px и не больше одной на экран. Всё мелкое и все иконки — кромка плюс
// песочный рисунок.
//
// Стирание не повторяет само себя: стиль рассыпания цифры берётся случайно из четырёх,
// поэтому ластик каждый раз выглядит иначе — это прямое требование брифа.

import {
  ensureStyle, caption, sandButton, boxed,
  ARROW, BACK, ERASE, formatPhone, FONT, midY, sleep
} from '../ui-kit.js';
import { signIn } from '../flow.js';

const OK_CODE = '1234';
const COOLDOWN = 24;
const ERASE_STYLES = ['burst', 'strands', 'drip', 'vortex'];

let S = null;
const rnd = a => a[(Math.random() * a.length) | 0];

export async function mount(ctx) {
  ensureStyle();
  ctx.root.classList.add('groot');
  const sand = ctx.sand;
  const session = ctx.session || (ctx.session = {});
  await sand.ready;

  const W = sand.w, H = sand.h, cx = W / 2;
  const s = S = {
    ctx, sand, root: ctx.root, session, dead: false, view: null, busy: false, turning: false,
    code: '', btns: [], nodes: [], cd: 0, cdTimer: 0, W, H, cx
  };
  s.phone = formatPhone(session.phone || '1234567890', session.countryCode || '7');

  showEntry(s, true);

  // Поворот экрана: ядро пересчитывает холст, но ЦЕЛИ не переносит — раскладку экран
  // перестраивает сам. Перерисовываем текущий вид, сохраняя введённые цифры и кулдаун.
  s.onResize = () => {
    clearTimeout(s.rt);
    s.rt = setTimeout(() => {
      if (s.dead) return;
      const view = s.view, cd = s.cd;
      clearInterval(s.cdTimer);
      wipe(s);
      s.W = sand.w; s.H = sand.h; s.cx = sand.w / 2;
      if (view === 'resend') { showResend(s); s.cd = cd; paintCooldown(s, false); }
      else if (view === 'error') { s.view = 'entry'; showEntry(s, false); }
      else if (view === 'ok') { showSuccess(s); }
      else showEntry(s, false);
    }, 280);
  };
  addEventListener('resize', s.onResize);
  return s;
}

export async function unmount() {
  const s = S; if (!s) return;
  s.dead = true; S = null;
  clearInterval(s.cdTimer); clearTimeout(s.rt);
  removeEventListener('resize', s.onResize);
  wipe(s);
}

// --- общее ---
function wipe(s) {
  for (const b of s.btns) b.destroy();
  s.btns.length = 0;
  for (const n of s.nodes) n.remove();
  s.nodes.length = 0;
  for (const id of s.sand.groups) if (id.startsWith('cd-')) s.sand.drop(id);
}
async function leave(s, style) {
  for (const b of s.btns) b.release(style);
  for (const id of s.sand.groups) if (id.startsWith('cd-')) s.sand.release(id, { style });
  for (const n of s.nodes) n.style.transition = 'opacity .3s linear', n.style.opacity = '0';
  await sleep(250);
  for (const b of s.btns) b.destroy();
  s.btns.length = 0;
  for (const n of s.nodes) n.remove();
  s.nodes.length = 0;
}

// ─────────────── ввод кода ───────────────
function showEntry(s, first) {
  const { sand, W, H, cx } = s;
  s.view = 'entry';
  // Раскладка набирается стопкой сверху и снизу навстречу друг другу, а не долями высоты:
  // доли сходятся только на 390x844, а в альбоме и на коротких экранах клавиатура налезает на
  // слоты. Здесь заголовок, подпись, ссылка и слоты набираются сверху, клавиатура прижата
  // снизу, и если между ними не остаётся места — сжимаются сперва зазоры, потом сами клавиши.
  const TITLE = { size: 32, weight: 500, font: FONT.serif };
  const tBox = sand.measure('Проверочный код', TITLE);
  const spacious = H >= 700;
  const L = { title: spacious ? Math.round(H * .075) : Math.max(14, Math.round(H * .050)), slotGap: 15, keyGapX: 14 };
  L.sub = L.title + tBox.h + (spacious ? 10 : 2);
  // В WebKit строка телефона имеет более высокий фактический ink box, чем в Chromium:
  // прежние 26 px ставили песочную кромку ссылки прямо поверх цифр номера.
  L.link = L.sub + (spacious ? 44 : 38);

  // Слоты и клавиатура делят то, что осталось под ссылкой. В альбоме (844x390) полноразмерные
  // слоты и клавиши вместе требуют 377 px при 235 доступных — сжать только клавиатуру мало,
  // она упирается в свой минимум и лезет на слоты (видно на снимке). Поэтому сперва схлопываем
  // зазор между рядами, а потом ужимаем слоты и клавиши одним коэффициентом, сохраняя пропорции.
  const bottom = spacious ? Math.max(66, Math.round(H * .095)) : Math.max(18, Math.round(H * .090));
  const slotTopGap = spacious ? 66 : 34;
  const slotKeyGap = spacious ? 92 : 24;
  const avail = H - (L.link + slotTopGap) - bottom;
  let slotH = spacious ? 98 : 92, keyH = spacious ? 62 : 56, gapY = spacious ? 24 : 13;
  const stack = () => slotH + slotKeyGap + 4 * keyH + 3 * gapY;
  if (stack() > avail) {
    gapY = Math.max(5, gapY - (stack() - avail) / 3);
    if (stack() > avail) {
      const k = Math.max(.42, (avail - slotKeyGap - 3 * gapY) / (slotH + 4 * keyH));
      slotH = Math.max(40, slotH * k); keyH = Math.max(30, keyH * k);
    }
  }
  L.slotH = slotH; L.keyH = keyH; L.keyGapY = gapY;
  L.slotW = Math.min(slotH * (66 / 92), (W - 40 - 3 * L.slotGap) / 4);
  L.keyW = Math.min(104, (W - 78) / 3);
  L.slotCy = L.link + slotTopGap + L.slotH / 2;
  L.rowStep = L.keyH + L.keyGapY;
  L.row0 = H - bottom - L.keyH / 2 - 3 * L.rowStep;
  s.L = L;

  sand.text('cd-title', 'Проверочный код', {
    x: cx, y: L.title, ...TITLE, align: 'center', density: .95,
    arrive: 'wave-x', span: first ? .62 : .34
  });
  sand.text('cd-sub', 'Отправлен на номер ' + s.phone, {
    x: cx, y: L.sub, size: 16, font: FONT.sans, align: 'center',
    density: 1.9, wob: .015, arrive: 'wave-x', span: .38, delay: .25
  });
  const lk = caption(s.root, '<span class="glink">Не приходит код?</span>', L.link, 'dim');
  lk.style.opacity = '0';
  setTimeout(() => { if (!s.dead && s.view === 'entry' && lk.isConnected)
    {
      const w = Math.min(W - 36, sand.measure('Не приходит код?', { size: 17, font: FONT.sans }).w + 30);
      sand.shape('cd-linkFrame', 'pillEdge', { x: cx, y: L.link + 10, w, h: 28,
        thickness: 2.5, density: .84, tone: .75, wob: .008, arrive: 'wave-x', span: .3 });
      sand.text('cd-link', 'Не приходит код?', {
        x: cx, y: L.link, size: 17, font: FONT.sans, align: 'center',
        density: 1.9, tone: .9, wob: .008, arrive: 'wave-x', span: .3
      });
    }
  }, s.sand.reduced ? 0 : first ? 900 : 440);
  lk.querySelector('.glink').addEventListener('click', () => toResend(s));
  s.nodes.push(lk);

  // слоты
  const totalW = L.slotW * 4 + L.slotGap * 3;
  s.slotX = [];
  for (let i = 0; i < 4; i++) {
    const x = cx - totalW / 2 + L.slotW / 2 + i * (L.slotW + L.slotGap);
    s.slotX.push(x);
    sand.shape('cd-slot' + i, 'pillEdge', {
      x, y: L.slotCy, w: L.slotW, h: L.slotH, r: L.slotW * .46, thickness: 2.7, density: .76,
      arrive: 'flow', delay: .22 + i * .06, tone: .9
    });
  }

  // клавиатура
  const kx0 = cx - (L.keyW * 3 + L.keyGapX * 2) / 2 + L.keyW / 2;
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0', 'next'];
  const ERASE_ICON = boxed(ERASE, 40, 26), NEXT_ICON = boxed(ARROW, 42, 24);
  KEYS.forEach((k, i) => {
    const col = i % 3, row = (i / 3) | 0;
    const x = kx0 + col * (L.keyW + L.keyGapX), y = L.row0 + row * L.rowStep;
    const accent = k === 'next';
    s.btns.push(sandButton(s.ctx, 'cd-k' + i, {
      x, y, w: L.keyW, h: L.keyH,
      label: (k === 'erase' || accent) ? null : k,
      draw: k === 'erase' ? ERASE_ICON : accent ? NEXT_ICON : null,
      size: Math.min(30, L.keyH * .54), font: FONT.serif, weight: 400, labelDensity: 1.0,
      filled: false, iconCount: k === 'erase' ? 520 : 560,
      gold: accent ? .14 : 0, tone: accent ? 1 : .96,
      aria: k === 'erase' ? 'Стереть' : accent ? 'Дальше' : 'Цифра ' + k,
      arrive: 'flow', delay: .34 + (row * 3 + col) * .035, span: .3,
      onTap: () => tap(s, k)
    }));
  });

  paintDigits(s);
}

function paintDigits(s) {
  const { sand, L } = s;
  for (let i = 0; i < 4; i++) {
    const id = 'cd-d' + i;
    if (i < s.code.length) {
      const dz = Math.min(52, L.slotH * .57);
      if (!sand.has(id)) sand.text(id, s.code[i], {
        x: s.slotX[i], y: midY(s.code[i], { size: dz, weight: 500, font: FONT.serif }, L.slotCy),
        size: dz, weight: 500, font: FONT.serif,
        density: .9, align: 'center', baseline: 'middle', arrive: 'burst', span: .14, rise: .34, gold: .16
      });
    } else if (sand.has(id)) sand.release(id, { style: rnd(ERASE_STYLES) });
  }
}

function tap(s, k) {
  if (s.dead || s.busy || s.view !== 'entry') return;
  if (k === 'erase') {
    if (!s.code.length) return;
    s.code = s.code.slice(0, -1); paintDigits(s); return;
  }
  if (k === 'next') { if (s.code.length === 4) check(s); return; }
  if (s.code.length >= 4) return;
  s.code += k; paintDigits(s);
  // Четыре цифры — ещё не подтверждение: человек может заметить опечатку и стереть её.
}

async function check(s) {
  if (s.busy || s.code.length !== 4) return;
  s.busy = true;
  const ok = s.code === OK_CODE;
  await leave(s, ok ? 'stream' : 'burst');
  if (s.dead) return;
  if (ok) {
    // Небо больше не забирает экран сразу после успеха: освобождаем остатки
    // клавиатуры перед долгоживущим финалом, иначе старые группы занимают песок.
    wipe(s);
    s.session.code = s.code;
    signIn(s.session);
    await showSuccess(s);
  }
  else { s.code = ''; await showError(s); }
  s.busy = false;
}

// ─────────────── ошибка ───────────────
async function showError(s) {
  const { sand, W, H, cx } = s;
  s.view = 'error';
  sand.text('cd-err', 'Не знаем\nтакого кода', {
    x: cx, y: Math.round(H * .20), size: 36, weight: 500, align: 'center', density: .95,
    font: FONT.serif, lineHeight: 1.16, arrive: 'wave-x', span: .66
  });
  // Подзаголовок появляется вслед за заголовком, а не раньше песочной сборки букв.
  setTimeout(() => {
    if (!s.dead && s.view === 'error')
      sand.text('cd-try', 'Попробуйте ещё раз', {
        x: cx, y: Math.round(H * .345), size: 17, font: FONT.sans,
        align: 'center', density: 1.9, wob: .015, arrive: 'wave-x', span: .3
      });
  }, s.sand.reduced ? 0 : 880);
  s.btns.push(sandButton(s.ctx, 'cd-eb', {
    x: cx, y: Math.round(H * .58), w: 62, h: 44, r: 22, label: null, draw: boxed(BACK, 30, 20),
    filled: false, iconCount: 340, arrive: 'burst', delay: .5,
    aria: 'Назад к вводу кода', onTap: () => backToEntry(s)
  }));
  await sleep(4000);
  if (s.dead || s.view !== 'error') return;
  await backToEntry(s);
}
async function backToEntry(s) {
  if (s.view === 'entry' || s.turning) return;
  s.turning = true;
  await leave(s, 'wave-x');
  if (s.dead) return;
  s.view = 'entry';
  showEntry(s, false);
  s.turning = false;
}

// ─────────────── успех ───────────────
async function showSuccess(s) {
  const { sand, H, cx } = s;
  s.view = 'ok';
  sand.text('cd-ok', 'Код подтверждён', {
    x: cx, y: Math.round(H * .35), size: Math.min(38, Math.max(30, s.W * .085)), weight: 500,
    align: 'center', density: 1.3, font: FONT.serif,
    arrive: 'burst', span: .10, rise: .38, wob: .012, gold: .26
  });
  sand.text('cd-ok-sub', 'Продолжите, чтобы открыть разбор', {
    x: cx, y: Math.round(H * .49), size: Math.min(19, Math.max(16, s.W * .043)),
    font: FONT.sans, align: 'center', maxWidth: s.W - 40, density: 1.6,
    arrive: 'burst', span: .10, rise: .38, delay: .12, wob: .008
  });
  s.btns.push(sandButton(s.ctx, 'cd-continue', { x: cx, y: H - Math.max(65, H * .15),
    w: Math.min(320, s.W - 52), h: 56, label: 'Продолжить', filled: true,
    size: 22, font: FONT.sans, density: 2, pad: .48,
    onTap: () => s.ctx.go('name'), arrive: 'wave-x', span: .3 }));
}

// ─────────────── повторная отправка ───────────────
async function toResend(s) {
  if (s.busy || s.view !== 'entry') return;
  s.busy = true;
  await leave(s, 'wave-x');
  if (s.dead) return;
  showResend(s);
  s.busy = false;
}

function showResend(s) {
  const { sand, W, H, cx } = s;
  s.view = 'resend';

  sand.text('cd-ph', s.phone, {
    x: cx, y: Math.round(H * .27), size: 34, weight: 400, align: 'center', density: 1.05,
    font: FONT.serif, arrive: 'wave-x', span: .5
  });
  const ch = caption(s.root, '<span class="glink">Изменить номер</span>', Math.round(H * .33), 'dim');
  ch.querySelector('.glink').style.color = 'transparent';
  sand.text('cd-change', 'Изменить номер', {
    x: cx, y: Math.round(H * .33), size: 17, font: FONT.sans,
    align: 'center', density: 1.9, tone: .78, wob: .015,
    arrive: 'wave-x', span: .3, delay: .2
  });
  const changeW = Math.min(W - 36, sand.measure('Изменить номер', { size: 17, font: FONT.sans }).w + 30);
  sand.shape('cd-changeFrame', 'pillEdge', {
    x: cx, y: Math.round(H * .33) + 12, w: changeW, h: 34,
    thickness: 2.5, density: .84, tone: .75, wob: .008,
    arrive: 'wave-x', span: .3, delay: .2
  });
  ch.querySelector('.glink').addEventListener('click', async () => {
    if (s.busy) return; s.busy = true;
    await leave(s, 'strands');
    if (!s.dead && s.ctx.go) s.ctx.go('phone');
  });
  s.nodes.push(ch);

  // Кулдаун: статичная часть подписи и счётчик — РАЗНЫЕ группы. Если пересобирать всю
  // строку каждую секунду, вся надпись раз в секунду вздрагивает; так шевелятся две цифры.
  const cdY = Math.round(H * .655), SZ = 15;
  const lblText = 'Отправить SMS заново через';
  const wl = sand.measure(lblText, { size: SZ, font: FONT.sans }).w;
  const wn = sand.measure('00', { size: SZ, font: FONT.sans }).w;
  const inner = wl + 8 + wn;
  const pw = Math.min(W - 44, inner + 46);
  s.cdPill = { x: cx, y: cdY, w: pw, h: 46 };
  const cdFont = { size: SZ, font: FONT.sans };
  s.cdText = { lx: cx - inner / 2 + wl / 2, nx: cx + inner / 2 - wn / 2, y: midY(lblText, cdFont, cdY), yn: midY('00', cdFont, cdY), size: SZ };

  s.cd = COOLDOWN;
  paintCooldown(s, true);
  clearInterval(s.cdTimer);
  s.cdTimer = setInterval(() => {
    if (s.dead || s.view !== 'resend') { clearInterval(s.cdTimer); return; }
    s.cd--;
    if (s.cd > 0) paintCooldown(s, false);
    else { clearInterval(s.cdTimer); paintReady(s); }
  }, 1000);

  // WhatsApp / Telegram
  const alt = [{ id: 'whatsapp', label: 'WhatsApp' }, { id: 'telegram', label: 'Telegram' }];
  const ws = alt.map(a => Math.round(sand.measure(a.label, { size: 16, font: FONT.sans }).w) + 30);
  const tot = ws[0] + ws[1] + 14;
  let ax = cx - tot / 2;
  alt.forEach((a, i) => {
    const x = ax + ws[i] / 2; ax += ws[i] + 14;
    s.btns.push(sandButton(s.ctx, 'cd-alt' + i, {
      x, y: Math.round(H * .735), w: ws[i], h: 46, label: a.label, size: 16, font: FONT.sans,
      filled: false, arrive: 'flow', delay: .35 + i * .08,
      onTap: () => sendAgain(s, a.id)
    }));
  });

  s.btns.push(sandButton(s.ctx, 'cd-back', {
    x: cx, y: H - Math.round(H * .105), w: 62, h: 44, r: 22, label: null, draw: boxed(BACK, 30, 20),
    filled: false, iconCount: 340, arrive: 'burst', delay: .55,
    aria: 'Назад к вводу кода', onTap: () => backToEntry(s)
  }));
}

function paintCooldown(s, first) {
  const { sand } = s, P = s.cdPill, T = s.cdText;
  if (first) {
    sand.shape('cd-cdp', 'pillEdge', {
      x: P.x, y: P.y, w: P.w, h: P.h, thickness: 2.7, density: .78,
      arrive: 'flow', delay: .22, tone: .74
    });
    sand.text('cd-cdl', 'Отправить SMS заново через', {
      x: T.lx, y: T.y, size: T.size, font: FONT.sans, align: 'center', baseline: 'middle',
      arrive: 'flow', delay: .28, tone: .74
    });
  }
  sand.text('cd-cdn', String(s.cd), {
    x: T.nx, y: T.yn, size: T.size, font: FONT.sans, align: 'center', baseline: 'middle',
    arrive: 'burst', span: .10, rise: .26, tone: .82, gold: .2
  });
}
function paintReady(s) {
  const { sand } = s, P = s.cdPill;
  sand.release('cd-cdp', { style: 'stream' });
  sand.release('cd-cdl', { style: 'stream' });
  sand.release('cd-cdn', { style: 'stream' });
  setTimeout(() => {
    if (s.dead || s.view !== 'resend') return;
    s.btns.push(sandButton(s.ctx, 'cd-send', {
      x: P.x, y: P.y, w: P.w, h: P.h, label: 'Отправить SMS заново', size: 20, font: FONT.sans,
      filled: true, density: .80, pad: .45, gold: .18, arrive: 'burst', span: .26,
      onTap: () => sendAgain(s, 'sms')
    }));
  }, 420);
}

function sendAgain(s, channel) {
  if (s.dead) return;
  s.session.channel = channel;
  const b = s.btns.find(x => x.label === 'Отправить SMS заново');
  if (b) b.destroy();
  s.btns = s.btns.filter(x => x !== b);
  s.cd = COOLDOWN;
  paintCooldown(s, true);
  clearInterval(s.cdTimer);
  s.cdTimer = setInterval(() => {
    if (s.dead || s.view !== 'resend') { clearInterval(s.cdTimer); return; }
    s.cd--;
    if (s.cd > 0) paintCooldown(s, false); else { clearInterval(s.cdTimer); paintReady(s); }
  }, 1000);
}

// Для отладки и e2e.
export function _type(str) {
  const s = S; if (!s) return false;
  for (const ch of String(str)) tap(s, ch === '<' ? 'erase' : ch);
  return true;
}
export function _view() { return S ? S.view : null; }
export function _layout() { return S ? S.L : null; }
export function _skip(sec) { const s = S; if (s && s.view === 'resend') { s.cd = Math.max(1, s.cd - sec); paintCooldown(s, false); } }
