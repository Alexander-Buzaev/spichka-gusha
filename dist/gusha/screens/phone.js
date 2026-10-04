// Экран 5 · «Введите ваш номер телефона».
//
// Всё белое из Figma здесь — песок: заголовок, рамка поля, код страны (1–3 цифры),
// национальный номер, три таба и кнопка.
// Служебные строки мелким системным sans остаются в DOM (так договорено в брифе).
//
// Табы — главный жест экрана. Выбранный таб ЗАЛИТ песком, невыбранные держат только кромку.
// Переключение идёт не перерисовкой, а перекладкой тех же крупинок: старую группу отпускаем
// молча (drop), и следующая группа забирает ближайшие свободные крупинки — то есть ровно те,
// что только что лежали на кромке. Отсюда и читается «песок стекает от кромки к центру»
// и обратно «растекается по кромке, оставляя в середине только текст».
//
// Надпись на залитом табе — дырка в песке (pillHole), а не песок поверх песка: иначе
// светлое на светлом не читается, и от Figma не остаётся ничего.

import {
  ensureStyle, caption, zone, sandButton, icon, CROSS, formatPhone, FONT, midY, sleep
} from '../ui-kit.js';
import { authMode, nextAfterPhone } from '../flow.js';

export const CHANNELS = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'sms', label: 'SMS' }
];

let S = null;

export async function mount(ctx) {
  ensureStyle();
  ctx.root.classList.add('groot');
  const sand = ctx.sand;
  const session = ctx.session || (ctx.session = {});
  const withCode = authMode() === 'full';
  await sand.ready;

  const W = sand.w, H = sand.h, cx = W / 2;

  // Раскладка набирается стопкой, а не долями высоты. Доли сходятся ровно на одном формате:
  // на 390x844 всё ровно, а в альбоме (844x390) подпись про способ доставки наезжает на табы —
  // это было видно на снимке первого прогона. Здесь сверху набирается заголовок с полем,
  // снизу прижата кнопка, а табы центрируются в оставшейся полосе с гарантированными зазорами.
  const TITLE = { size: 33, weight: 500, font: FONT.serif, maxWidth: W - 56, lineHeight: 1.14 };
  const titleBox = sand.measure('Введите ваш номер телефона', TITLE);

  // Кегль подписи таба выбран по читаемости ВЫРЕЗА (см. ui-kit): ниже 22 px внутренние
  // просветы букв тонут. Если три таба такой ширины не влезают, ужимаем поля, а потом кегль —
  // но не ниже 18 px, иначе выбранный таб перестанет читаться вовсе.
  let TSIZE = 22, TPAD = 24;
  const TH = 50, TGAP = 10;
  let widths, total;
  const fitTabs = () => {
    widths = CHANNELS.map(c => Math.round(sand.measure(c.label, { size: TSIZE, font: FONT.sans }).w) + TPAD);
    total = widths.reduce((a, b) => a + b, 0) + TGAP * (CHANNELS.length - 1);
    return total <= W - 16;
  };
  if (!fitTabs()) { TPAD = 14; if (!fitTabs()) { TSIZE = 19; TPAD = 16; if (!fitTabs()) { TSIZE = 18; TPAD = 12; fitTabs(); } } }

  const FH = 58, NH = 56;
  const L = {
    title: Math.max(18, Math.round(H * .055)),
    field: { w: Math.min(338, W - 52), h: FH },
    next: { w: Math.min(294, W - 96), h: NH }
  };
  L.sub = L.title + titleBox.h + 6;
  L.field.cy = L.sub + 40 + FH / 2;
  L.next.cy = H - Math.max(44, Math.round(H * .128));
  {
    const top = L.field.cy + FH / 2 + 26, bot = L.next.cy - NH / 2 - 22;
    let cy = (top + bot) / 2 + 6;
    cy = Math.max(top + 24 + TH / 2, Math.min(bot - TH / 2, cy));
    L.tabs = Math.round(cy);
    L.hint = Math.round(cy - TH / 2 - 26);
  }

  const s = S = {
    ctx, sand, root: ctx.root, dead: false,
    digits: String(session.phone || '').replace(/\D/g, '').slice(0, 12),
    country: String(session.countryCode || '7').replace(/\D/g, '').slice(0, 3) || '7',
    channel: session.channel || 'telegram',
    tabs: [], next: null, input: null, nodes: [], L, layoutWidth: window.innerWidth
  };

  // --- заголовок и служебные строки ---
  sand.text('ph-title', 'Введите ваш номер телефона', {
    x: cx, y: L.title, ...TITLE, align: 'center', density: 1.15, arrive: 'wave-x', span: .70
  });
  sand.text('ph-sub', 'Он необходим для продолжения', {
    x: cx, y: L.sub, size: 16, font: FONT.sans, align: 'center',
    density: 2.0, wob: .015, arrive: 'wave-x', span: .42, delay: .22
  });

  // --- поле номера ---
  const F = L.field;
  sand.shape('ph-frame', 'pillEdge', {
    x: cx, y: F.cy, w: F.w, h: F.h, thickness: 2.7, density: .78,
    arrive: 'flow', delay: .28, tone: .92
  });
  const numSize = Math.min(26, (F.w - 57) / 12.4);
  const numLeft = cx - F.w / 2 + 20;
  const numFont = `400 ${numSize}px ${FONT.serif}`;
  const numCanvas = document.createElement('canvas').getContext('2d');
  numCanvas.font = numFont;
  const digitPrefix = i => {
    const template = '000 000 00 00 00';
    const positions = [0, 1, 2, 4, 5, 6, 8, 9, 11, 12, 14, 15];
    return '+' + s.country + ' ' + template.slice(0, positions[i]);
  };
  const digitOptions = (i, value) => {
    const pre = digitPrefix(i);
    return {
      x: numLeft + numCanvas.measureText(pre).width + numCanvas.measureText(value).width / 2,
      y: F.cy, size: numSize, weight: 400, font: FONT.serif,
      density: 2.0, align: 'center', baseline: 'middle', wob: .025
    };
  };
  function drawDigit(i, value, first) {
    sand.text('ph-digit' + i, value, {
      ...digitOptions(i, value),
      arrive: first ? 'flow' : 'burst', span: first ? .24 : .13, delay: first ? .36 : 0
    });
  }
  let shownDigits = '';
  const prefixOptions = () => ({ x: numLeft, y: F.cy, size: numSize,
    font: FONT.serif, align: 'left', baseline: 'middle', density: 1.8,
    wob: .025 });
  sand.text('ph-prefix', '+' + s.country, { ...prefixOptions(), arrive: 'flow', span: .25 });
  function paintNumber(first) {
    if (s.dead) return;
    for (let i = 0; i < Math.max(shownDigits.length, s.digits.length); i++) {
      if (shownDigits[i] === s.digits[i]) continue;
      if (shownDigits[i]) sand.release('ph-digit' + i, { style: 'vortex', power: .42 });
      if (s.digits[i]) drawDigit(i, s.digits[i], first);
    }
    shownDigits = s.digits;
  }
  paintNumber(true);

  // Невидимый настоящий input: без него на телефоне не поднимется системная клавиатура,
  // а рисовать вторую клавиатуру ради номера — лишний экран. Текст прозрачный: число рисует песок.
  const inp = s.input = document.createElement('input');
  inp.className = 'gin';
  inp.type = 'tel'; inp.inputMode = 'numeric'; inp.autocomplete = 'tel-national';
  inp.setAttribute('aria-label', 'Номер телефона');
  inp.maxLength = 20;
  // Поле не накрываем своей хит-зоной: она перехватывала бы касание, и системная каретка
  // никогда не вставала бы туда, куда ткнули (Playwright это и поймал — кнопка «Ввести номер»
  // перекрывала input). Input сам занимает рамку, только уступая справа место крестику.
  inp.style.left = (cx - F.w / 2) + 'px'; inp.style.top = (F.cy - F.h / 2) + 'px';
  inp.style.width = (F.w - 52) + 'px'; inp.style.height = F.h + 'px';
  inp.style.fontSize = '16px';                    // ниже 16px iOS зумит страницу на фокусе
  inp.style.caretColor = 'transparent';
  const placeInputs = () => {
    const prefixW = numCanvas.measureText('+' + s.country + ' ').width;
    const nationalLeft = numLeft + prefixW;
    inp.style.left = nationalLeft + 'px';
    inp.style.width = Math.max(32, cx + F.w / 2 - 52 - nationalLeft) + 'px';
    if (s.countryInput) {
      s.countryInput.style.left = (numLeft - 5) + 'px';
      s.countryInput.style.width = (prefixW + 8) + 'px';
    }
  };
  placeInputs();
  // В поле лежат ГОЛЫЕ цифры, а «+7 916 …» рисует песок. Если держать в input форматированную
  // строку, маска ломается от положения каретки: тап по центру поля ставит её внутрь «+7»,
  // и первая же цифра уезжает перед префиксом — Playwright поймал это на «+7 971 612 34 56»
  // вместо «+7 916 123 45 67». С голыми цифрами позиция каретки вообще ни на что не влияет.
  inp.value = s.digits;
  s.root.appendChild(inp);
  inp.addEventListener('pointerdown', e => {
    const r = sand.canvas.getBoundingClientRect();
    sand.hit(e.clientX - r.left, e.clientY - r.top, 32, 210);
  });
  inp.addEventListener('input', () => {
    let d = inp.value.replace(/\D/g, '');
    if (s.country === '7' && d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
    d = d.slice(0, 12);
    if (inp.value !== d) inp.value = d;
    if (d === s.digits) return;
    s.digits = d;
    paintNumber(false); syncNext();
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

  // Код страны редактируется отдельно от национального номера: длина 1–3 цифры
  // не угадывается по вставленной строке и не ломает каретку в десяти цифрах справа.
  const ci = s.countryInput = document.createElement('input');
  ci.className = 'gin ph-country-input';
  ci.type = 'tel'; ci.inputMode = 'numeric'; ci.autocomplete = 'tel-country-code';
  ci.setAttribute('aria-label', 'Код страны'); ci.maxLength = 3; ci.value = s.country;
  ci.style.top = (F.cy - F.h / 2) + 'px'; ci.style.height = F.h + 'px';
  ci.style.fontSize = '16px'; ci.style.caretColor = 'transparent';
  s.root.appendChild(ci);
  placeInputs();
  ci.addEventListener('input', () => {
    const value = ci.value.replace(/\D/g, '').slice(0, 3);
    if (ci.value !== value) ci.value = value;
    if (value === s.country) return;
    s.country = value;
    sand.text('ph-prefix', '+' + value, { ...prefixOptions(), arrive: 'burst', span: .13 });
    for (let i = 0; i < s.digits.length; i++)
      sand.updateTargets('ph-digit' + i, sand.text(null, s.digits[i], digitOptions(i, s.digits[i])));
    placeInputs(); syncNext();
  });
  ci.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.focus(); } });

  // крестик «очистить» — песочная иконка со своей хит-зоной
  const clearX = cx + F.w / 2 - 30;
  icon(sand, 'ph-clear', CROSS, { x: clearX, y: F.cy, w: 22, h: 22, count: 220, delay: .5, tone: .8 });
  s.nodes.push(zone(s.root, {
    x: clearX, y: F.cy, w: 46, h: 46, label: 'Очистить номер',
    onTap: () => {
      if (!s.digits) return;
      s.digits = ''; inp.value = '';
      paintNumber(false);
      syncNext();
    }
  }));

  // --- табы ---
  if (withCode) sand.text('ph-hint', 'Как лучше отправить код?', {
    x: cx, y: L.hint, size: 16, font: FONT.sans, align: 'center',
    density: 1.8, wob: .015, tone: .78, arrive: 'wave-x', span: .35, delay: .35
  });
  let tx = cx - total / 2;
  if (withCode) CHANNELS.forEach((c, i) => {
    const w = widths[i], x = tx + w / 2;
    tx += w + TGAP;
    const b = sandButton(ctx, 'ph-tab' + i, {
      x, y: L.tabs, w, h: TH, label: c.label, size: TSIZE, font: FONT.sans,
      filled: c.id === s.channel, density: 2.0, pad: .5,
      arrive: 'flow', delay: .6 + i * .07, span: .3,
      gold: c.id === s.channel ? .22 : 0,
      onTap: () => pick(i)
    });
    s.tabs.push({ ...c, btn: b });
  });

  function pick(i) {
    if (s.dead) return;
    const want = s.tabs[i];
    if (want.id === s.channel) return;
    s.channel = session.channel = want.id;
    s.tabs.forEach((t, j) => {
      const on = j === i;
      t.btn.gold = on ? .22 : 0;
      t.btn.setFilled(on, { arrive: on ? 'burst' : 'flow', span: on ? .20 : .26 });
    });
  }

  // --- «Продолжить» ---
  const N = L.next;
  s.next = sandButton(ctx, 'ph-next', {
    x: cx, y: N.cy, w: N.w, h: N.h, label: 'Продолжить', size: 22, font: FONT.sans,
    filled: s.digits.length >= 7 && !!s.country, density: 2.0, pad: .5,
    tone: s.digits.length >= 7 && s.country ? 1 : .6,
    arrive: 'wave-x', delay: .8, span: .45, onTap: submit
  });
  const consent = y => ({ x: cx, y, size: 14, font: FONT.sans,
    maxWidth: W - 56, align: 'center', density: 2, wob: .005 });
  if (!withCode) sand.text('ph-consent', 'Нажав «Продолжить», вы соглашаетесь\nс условиями предоставления услуг', {
    ...consent(N.cy - 105), arrive: 'wave-x', span: .3
  });
  const base = { title: L.title, sub: L.sub, fieldY: F.cy, tabs: L.tabs,
    hint: L.hint, next: N.cy, height: innerHeight };
  function keyboardLayout() {
    if (s.dead || !s.next) return;
    const vv = window.visualViewport;
    const top = vv?.offsetTop || 0, visibleH = vv?.height || innerHeight;
    const keyboard = base.height - visibleH > 120;
    const titleY = keyboard ? top + 12 : base.title;
    const subY = keyboard ? titleY + titleBox.h + 2 : base.sub;
    F.cy = keyboard ? subY + 26 + FH / 2 : base.fieldY;
    const nextY = keyboard ? top + visibleH - 56 : base.next;
    sand.updateTargets('ph-title', sand.text(null, 'Введите ваш номер телефона', {
      x: cx, y: titleY, ...TITLE, align: 'center', density: 1.15 }));
    sand.updateTargets('ph-sub', sand.text(null, 'Он необходим для продолжения', {
      x: cx, y: subY, size: 16, font: FONT.sans, align: 'center', density: 2 }));
    sand.updateTargets('ph-frame', sand.shape(null, 'pillEdge', {
      x: cx, y: F.cy, w: F.w, h: F.h, thickness: 2.7, density: .78 }));
    sand.updateTargets('ph-prefix', sand.text(null, '+' + s.country, prefixOptions()));
    for (let i = 0; i < s.digits.length; i++)
      sand.updateTargets('ph-digit' + i, sand.text(null, s.digits[i], digitOptions(i, s.digits[i])));
    inp.style.top = ci.style.top = (F.cy - F.h / 2) + 'px';
    sand.updateTargets('ph-clear', icon(sand, null, CROSS, { x: clearX, y: F.cy, w: 22, h: 22, count: 220 }));
    s.nodes[0].style.top = (F.cy - 23) + 'px';
    s.next.move(cx, nextY);
    if (withCode) {
      const tabY = keyboard ? (F.cy + F.h / 2 + nextY - NH / 2) / 2 + 8 : base.tabs;
      const hintY = keyboard ? tabY - TH / 2 - 30 : base.hint;
      sand.updateTargets('ph-hint', sand.text(null, 'Как лучше отправить код?', {
        x: cx, y: hintY, size: 16, font: FONT.sans, align: 'center', density: 1.8 }));
      s.tabs.forEach(t => { const rect = t.btn.zone.getBoundingClientRect(); t.btn.move(rect.x + rect.width / 2, tabY); });
    } else sand.updateTargets('ph-consent', sand.text(null,
      'Нажав «Продолжить», вы соглашаетесь\nс условиями предоставления услуг', consent(nextY - 105)));
  }
  s.onVisualResize = () => { clearTimeout(s.keyboardT); s.keyboardT = setTimeout(keyboardLayout, 80); };
  window.visualViewport?.addEventListener('resize', s.onVisualResize);
  window.visualViewport?.addEventListener('scroll', s.onVisualResize);
  function syncNext() {
    if (s.dead || !s.next) return;
    const ok = s.digits.length >= 7 && !!s.country;
    s.next.tone = ok ? 1 : .6;
    s.next.setFilled(ok, { arrive: ok ? 'burst' : 'flow', span: ok ? .24 : .3 });
  }

  async function submit() {
    if (s.dead || s.digits.length < 7 || !s.country || s.busy) return;
    s.busy = true;
    session.phone = s.digits;
    session.countryCode = s.country;
    session.channel = s.channel;
    try { inp.blur(); } catch { }
    await leave('wave-x');
    if (!s.dead && ctx.go) ctx.go(nextAfterPhone(session));
  }

  // Пересобираем только при настоящей смене ширины/ориентации. Открытие системной
  // клавиатуры меняет высоту viewport и тоже посылает resize; remount в этот момент
  // зацикливал появление заголовка и всех цифр прямо под пальцем пользователя.
  s.onResize = () => {
    s.onVisualResize();
    if (Math.abs(window.innerWidth - s.layoutWidth) < 2) return;
    clearTimeout(s.rt);
    s.rt = setTimeout(async () => {
      if (s.dead || s.busy) return;
      if (Math.abs(window.innerWidth - s.layoutWidth) < 2) return;
      session.phone = s.digits; session.countryCode = s.country; session.channel = s.channel;
      await unmount(ctx); await mount(ctx);
    }, 280);
  };
  addEventListener('resize', s.onResize);

  async function leave(style) {
    for (const id of sand.groups) if (id.startsWith('ph-')) sand.release(id, { style });
    await sleep(260);
  }
  s.leave = leave;

  return s;
}

export async function unmount(ctx) {
  const s = S; if (!s) return;
  clearTimeout(s.numTimer);
  s.dead = true; S = null;
  clearTimeout(s.rt);
  clearTimeout(s.keyboardT);
  removeEventListener('resize', s.onResize);
  window.visualViewport?.removeEventListener('resize', s.onVisualResize);
  window.visualViewport?.removeEventListener('scroll', s.onVisualResize);
  const sand = s.sand;
  for (const t of s.tabs) t.btn.destroy();
  if (s.next) s.next.destroy();
  for (const n of s.nodes) n.remove();
  if (s.input) s.input.remove();
  if (s.countryInput) s.countryInput.remove();
  for (const id of sand.groups) if (id.startsWith('ph-')) sand.drop(id);
}

// Для отладки и e2e: подставить номер без системной клавиатуры.
export function _set(digits) {
  const s = S; if (!s) return false;
  s.input.value = digits; s.input.dispatchEvent(new Event('input'));
  return true;
}
