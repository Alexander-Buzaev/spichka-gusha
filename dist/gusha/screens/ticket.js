// Билет Oracle Cup: восемь цифр — отдельный шаг перед датой рождения.
// Это не четырёхзначный SMS-код. DOM-input принимает системную клавиатуру и
// вставку целого кода; все видимые слоты и цифры остаются песочными.
import { ensureStyle, sandButton, FONT, midY } from '../ui-kit.js';
import { beginTicket } from '../flow.js';

const TEST_CODE = '00000000';
let state = null;

export async function mount(ctx) {
  ensureStyle();
  ctx.root.classList.add('groot');
  const sand = ctx.sand;
  await sand.ready;
  const sphere = ctx.screen === 'sphere-ticket';
  const hint = sphere ? 'Второй билет — у бариста за отзыв в 2ГИС' : 'Код указан на обратной стороне билета';
  const s = state = {
    ctx, sand, dead: false, input: null, buttons: [], timers: [], value: '',
    layoutWidth: innerWidth, baseHeight: innerHeight, keyboard: false
  };
  const draw = () => {
    if (s.dead) return;
    const W = sand.w, H = sand.h, cx = W / 2;
    s.W = W; s.H = H;
    const landscape = W > H * 1.25;
    const titleY = landscape ? 24 : Math.max(52, H * .19);
    const slotY = landscape ? H * .48 : H * .39;
    const buttonY = landscape ? H - 48 : H - Math.max(74, H * .16);
    const gap = Math.max(5, Math.min(10, W * .018));
    const columns = landscape ? 8 : 4;
    const slotW = Math.min(64, Math.max(25, (W - 60 - (columns - 1) * gap) / columns));
    const slotH = Math.min(76, Math.max(49, H * .10));
    const x0 = cx - (slotW * columns + gap * (columns - 1)) / 2 + slotW / 2;
    const rowGap = 15;
    const positions = Array.from({ length: 8 }, (_, i) => ({
      x: x0 + (i % columns) * (slotW + gap),
      y: slotY + Math.floor(i / columns) * (slotH + rowGap)
    }));
    s.baseLayout = { cx, slotY, slotW, slotH, gap, x0, buttonY, positions, columns,
      titleY, hintY: titleY + 54 };
    s.layout = { ...s.baseLayout };
    sand.text('tk-title', 'Введите код билета', {
      x: cx, y: titleY, size: Math.min(37, Math.max(25, W * .082)), font: FONT.serif,
      align: 'center', density: 1.55, wob: .02, arrive: 'wave-x', span: .55
    });
    sand.text('tk-hint', hint, {
      x: cx, y: titleY + 54, size: Math.min(16, Math.max(12, W * .038)),
      font: FONT.sans, align: 'center', maxWidth: W - 40,
      density: 1.8, wob: .01, arrive: 'wave-x', span: .4, delay: .18
    });
    for (let i = 0; i < 8; i++) {
      const { x, y } = positions[i];
      sand.shape('tk-slot' + i, 'pillEdge', {
        x, y, w: slotW, h: slotH, r: slotW * .42,
        thickness: 2.6, density: .9, wob: .008,
        arrive: 'flow', delay: .2 + i * .045, span: .35
      });
    }
    if (s.buttons.length) for (const b of s.buttons) b.destroy();
    s.buttons = [];
    s.buttons.push(sandButton(ctx, 'tk-next', {
      x: cx, y: buttonY, w: Math.min(W - 52, 310), h: 56,
      label: 'Активировать', size: 22, font: FONT.sans,
      filled: s.value.length === 8, density: 2, pad: .48,
      onTap: submit, arrive: 'wave-x', span: .35
    }));
    s.buttons.push(sandButton(ctx, 'tk-back', {
      x: 35, y: Math.max(28, titleY - 40),
      w: 48, h: 48, label: '‹', size: 32, font: FONT.sans,
      filled: false, onTap: () => ctx.go(sphere ? 'sphere' : 'hello'), arrive: 'flow', span: .2
    }));
    s.buttons.push(sandButton(ctx, 'tk-erase', {
      x: cx, y: positions[7].y + slotH / 2 + 37,
      w: 124, h: 42, label: 'Стереть', size: 19, font: FONT.sans,
      filled: false, labelDensity: 1.8, onTap: erase,
      arrive: 'flow', delay: .5, span: .25
    }));
    // Кнопка не должна закрывать системную клавиатуру: после стирания можно
    // сразу вводить исправленную цифру.
    s.buttons[2].zone?.addEventListener('pointerdown', e => e.preventDefault());
    for (let i = 0; i < s.value.length; i++) paintDigit(i);
    placeInput();
    updateKeyboardLayout();
  };
  function paintDigit(i) {
    const L = s.layout;
    const { x, y } = L.positions[i];
    const size = Math.min(42, L.slotH * .56);
    sand.text('tk-digit' + i, s.value[i], {
      x, y: midY(s.value[i], { size, font: FONT.serif }, y),
      size, font: FONT.serif, align: 'center', baseline: 'middle',
      density: 1.4, wob: .006, arrive: 'burst', span: .14
    });
  }
  function placeInput() {
    if (!s.input || !s.layout) return;
    const L = s.layout;
    s.input.style.left = (L.x0 - L.slotW / 2) + 'px';
    s.input.style.top = (L.slotY - L.slotH / 2) + 'px';
    s.input.style.width = (L.slotW * L.columns + L.gap * (L.columns - 1)) + 'px';
    s.input.style.height = (L.columns === 8 ? L.slotH : 2 * L.slotH + 15) + 'px';
  }
  const input = s.input = document.createElement('input');
  input.className = 'gin'; input.type = 'text'; input.inputMode = 'numeric';
  input.autocomplete = 'off'; input.maxLength = 8;
  input.setAttribute('aria-label', 'Восьмизначный код билета');
  input.style.fontSize = '16px'; input.style.caretColor = 'transparent';
  ctx.root.appendChild(input);
  function erase() {
    if (s.dead || !s.value.length) return;
    const i = s.value.length - 1;
    s.value = s.value.slice(0, -1);
    input.value = s.value;
    sand.release('tk-digit' + i, { style: 'burst', power: .38 });
    sand.drop('tk-error');
    s.buttons[0]?.setFilled(false, { arrive: 'flow', span: .2 });
    input.focus({ preventScroll: true });
    updateKeyboardLayout();
  }
  input.addEventListener('input', () => {
    const next = input.value.replace(/\D/g, '').slice(0, 8);
    if (input.value !== next) input.value = next;
    const prev = s.value; s.value = next;
    for (let i = 0; i < 8; i++) {
      if (prev[i] === next[i]) continue;
      if (prev[i]) sand.release('tk-digit' + i, { style: 'burst', power: .38 });
      if (next[i]) paintDigit(i);
    }
    s.buttons[0]?.setFilled(next.length === 8, { arrive: 'flow', span: .2 });
    sand.drop('tk-error');
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });
  input.addEventListener('focus', () => requestAnimationFrame(updateKeyboardLayout));
  input.addEventListener('blur', () => setTimeout(updateKeyboardLayout, 100));
  function updateKeyboardLayout() {
    if (s.dead || !s.baseLayout || !s.input) return;
    const vv = window.visualViewport;
    const visibleTop = vv?.offsetTop || 0;
    const visibleH = vv?.height || innerHeight;
    const visibleBottom = visibleTop + visibleH;
    const keyboard = document.activeElement === input &&
      s.baseHeight - visibleH > 120;
    const B = s.baseLayout;
    let titleY = B.titleY, hintY = B.hintY, slotH = B.slotH;
    let positions = B.positions, buttonY = B.buttonY;
    if (keyboard) {
      titleY = visibleTop + Math.max(12, Math.min(25, visibleH * .05));
      hintY = titleY + 43;
      slotH = Math.min(B.slotH, Math.max(39, visibleH * .13));
      const firstY = hintY + 48 + slotH / 2;
      const rowGap = 9;
      positions = B.positions.map((p, i) => ({
        x: p.x, y: firstY + Math.floor(i / B.columns) * (slotH + rowGap)
      }));
      buttonY = visibleBottom - 56;
    }
    const moved = s.keyboard !== keyboard ||
      Math.abs(s.layout.buttonY - buttonY) > 2 ||
      Math.abs(s.layout.slotH - slotH) > 2;
    if (!moved) return;
    s.keyboard = keyboard;
    s.layout = { ...B, titleY, hintY, slotH, slotY: positions[0].y,
      positions, buttonY };
    sand.updateTargets('tk-title', sand.text(null, 'Введите код билета', {
      x: B.cx, y: titleY, size: Math.min(37, Math.max(25, B.cx * 2 * .082)),
      font: FONT.serif, align: 'center'
    }));
    sand.updateTargets('tk-hint', sand.text(null, hint, {
      x: B.cx, y: hintY, size: Math.min(16, Math.max(12, B.cx * 2 * .038)),
      font: FONT.sans, align: 'center', maxWidth: B.cx * 2 - 40
    }));
    for (let i = 0; i < 8; i++) {
      const { x, y } = positions[i];
      sand.updateTargets('tk-slot' + i, sand.shape(null, 'pillEdge', {
        x, y, w: B.slotW, h: slotH, r: B.slotW * .42,
        thickness: 2.6, density: .9
      }));
      if (i < s.value.length) {
        const size = Math.min(42, slotH * .56);
        sand.updateTargets('tk-digit' + i, sand.text(null, s.value[i], {
          x, y: midY(s.value[i], { size, font: FONT.serif }, y),
          size, font: FONT.serif, align: 'center', baseline: 'middle'
        }));
      }
    }
    s.buttons[0]?.move(B.cx, buttonY);
    s.buttons[1]?.move(35, keyboard ? visibleTop + 28 : Math.max(28, B.titleY - 40));
    s.buttons[2]?.move(B.cx, positions[7].y + slotH / 2 + (keyboard ? 25 : 37));
    placeInput();
    sand.drop('tk-error');
  }
  function submit() {
    if (s.dead || s.busy || s.value.length !== 8) return;
    if (s.value !== TEST_CODE) {
      sand.text('tk-error', 'Для пробы используйте билет 00000000', {
        x: s.layout.cx, y: s.layout.buttonY - 85,
        size: 15, font: FONT.sans, maxWidth: sand.w - 32,
        align: 'center', density: 1.7, wob: .01, arrive: 'wave-x', span: .3
      });
      return;
    }
    s.busy = true;
    beginTicket(ctx.session, sphere);
    input.blur();
    for (const id of sand.groups) if (id.startsWith('tk-')) sand.release(id, { style: 'vortex', power: .6 });
    s.timers.push(setTimeout(() => { if (!s.dead) ctx.go(sphere ? 'stories' : 'brewing'); }, 330));
  }
  s.onResize = () => {
    requestAnimationFrame(updateKeyboardLayout);
    // Виртуальная клавиатура меняет только высоту. Пересборка на каждый её resize
    // запускала бы цифры и слоты заново прямо под пальцем, как раньше на #phone.
    if (Math.abs(innerWidth - s.layoutWidth) < 2) return;
    clearTimeout(s.resizeT);
    s.resizeT = setTimeout(() => {
      if (s.dead) return;
      s.layoutWidth = innerWidth;
      for (const id of sand.groups) if (id.startsWith('tk-')) sand.drop(id);
      draw();
    }, 180);
  };
  addEventListener('resize', s.onResize);
  s.onVisualResize = () => requestAnimationFrame(updateKeyboardLayout);
  window.visualViewport?.addEventListener('resize', s.onVisualResize);
  window.visualViewport?.addEventListener('scroll', s.onVisualResize);
  draw();
  return s;
}

export async function unmount() {
  const s = state; if (!s) return;
  state = null; s.dead = true;
  clearTimeout(s.resizeT);
  for (const t of s.timers) clearTimeout(t);
  removeEventListener('resize', s.onResize);
  window.visualViewport?.removeEventListener('resize', s.onVisualResize);
  window.visualViewport?.removeEventListener('scroll', s.onVisualResize);
  for (const b of s.buttons) b.destroy();
  s.input?.remove();
  for (const id of s.sand.groups) if (id.startsWith('tk-')) s.sand.drop(id);
}
