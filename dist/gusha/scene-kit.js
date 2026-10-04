// Общий жизненный цикл новых экранов: цели пересчитываются только при событии,
// поля остаются теми же DOM-узлами при открытии системной клавиатуры.
import { ensureStyle, sandButton, FONT, midY } from './ui-kit.js';

let insets;
export function viewport(sand) {
  if (!insets) {
    insets = document.createElement('div');
    insets.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);';
    document.body.appendChild(insets);
  }
  const css = getComputedStyle(insets), vv = window.visualViewport;
  const top = (vv?.offsetTop || 0) + (parseFloat(css.paddingTop) || 0);
  const bottom = (vv?.offsetTop || 0) + Math.min(sand.h, vv?.height || innerHeight) - (parseFloat(css.paddingBottom) || 0);
  return { W: sand.w, H: bottom - top, top, bottom, cx: sand.w / 2,
    pad: Math.max(22, Math.min(40, sand.w * .075)) };
}

export function fitText(sand, text, opts, maxHeight, minSize = 18) {
  let size = opts.size;
  while (size > minSize && sand.measure(text, { ...opts, size }).h > maxHeight) size--;
  return { ...opts, size };
}

export function createScene(ctx, prefix) {
  ensureStyle();
  ctx.root.classList.add('groot');
  const sand = ctx.sand, buttons = new Map(), texts = new Map(), offs = [];
  let dead = false, leaving = false, timer;
  const sr = document.createElement('div');
  sr.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
  sr.setAttribute('aria-live', 'polite'); ctx.root.appendChild(sr);
  function text(key, value, o = {}) {
    if (dead) return;
    const id = prefix + key;
    const opts = { font: FONT.sans, density: 2, wob: .007, arrive: 'wave-x', rise: .32, span: .22, ...o };
    const signature = JSON.stringify([value, opts.size, opts.font, opts.maxWidth, opts.lineHeight, opts.density]);
    const prev = texts.get(key);
    if (prev?.signature === signature && sand.has(id)) sand.updateTargets(id, sand.text(null, value, opts));
    else sand.text(id, value, opts);
    let node = prev?.node;
    if (!node) { node = document.createElement('p'); sr.appendChild(node); }
    node.textContent = value;
    texts.set(key, { signature, node });
  }
  function button(key, opts) {
    const prev = buttons.get(key);
    const signature = JSON.stringify([opts.w, opts.h, opts.size, opts.font, opts.label, !!opts.draw]);
    if (prev?.signature === signature) {
      prev.api.move(opts.x, opts.y);
      prev.api.setFilled(!!opts.filled);
      return prev.api;
    }
    prev?.api.destroy();
    const api = sandButton(ctx, prefix + key, { font: FONT.sans, size: 22,
      density: 2, pad: .48, labelDensity: 2, edge: { thickness: 2.8, density: 1.1 },
      wob: .007, rise: .32, arrive: 'wave-x', span: .22, ...opts });
    buttons.set(key, { api, signature });
    return api;
  }
  function remove(key) {
    buttons.get(key)?.api.destroy(); buttons.delete(key);
    texts.get(key)?.node.remove(); texts.delete(key); sand.drop(prefix + key);
  }
  function clear() {
    for (const { api } of buttons.values()) api.destroy(); buttons.clear();
    for (const { node } of texts.values()) node.remove(); texts.clear();
    for (const id of sand.groups) if (id.startsWith(prefix)) sand.drop(id);
  }
  function listen(el, type, fn) { el?.addEventListener(type, fn); offs.push(() => el?.removeEventListener(type, fn)); }
  function onResize(fn) {
    // sand.resize() в app.js отложен на 120 мс: раскладка должна идти ПОСЛЕ него.
    const update = () => { clearTimeout(timer); timer = setTimeout(() => { if (!dead && !leaving) fn(); }, 180); };
    listen(window, 'resize', update); listen(window.visualViewport, 'resize', update);
    listen(window.visualViewport, 'scroll', update);
  }
  async function go(name) {
    if (dead || leaving) return;
    leaving = true;
    for (const id of sand.groups) if (id.startsWith(prefix)) sand.release(id, { style: 'split-spiral', power: .45 });
    if (!sand.reduced) await new Promise(resolve => setTimeout(resolve, 180));
    if (!dead) ctx.go(name);
  }
  function destroy() {
    dead = true; clearTimeout(timer); offs.forEach(fn => fn()); clear(); sr.remove();
  }
  return { ctx, sand, prefix, text, button, remove, clear, listen, onResize, go, destroy,
    get dead() { return dead; }, get leaving() { return leaving; } };
}

export function sandField(scene, key, { label, value = '', autocomplete = 'off', onInput, onEnter }) {
  const { sand, ctx, prefix } = scene;
  const input = document.createElement('input');
  input.className = 'gin'; input.type = 'text'; input.autocomplete = autocomplete;
  input.setAttribute('aria-label', label); input.maxLength = 40;
  input.style.cssText = 'position:absolute;font-size:16px;text-align:left;caret-color:transparent;color:transparent;';
  input.value = value; ctx.root.appendChild(input);
  let box, shown = '', chars = [], displaySize = 24;
  const measure = document.createElement('canvas').getContext('2d');
  function paint() {
    if (!box || scene.dead) return;
    const next = Array.from(input.value), { x, y, w, h } = box;
    displaySize = 24;
    measure.font = `400 ${displaySize}px ${FONT.sans}`;
    while (displaySize > 17 && measure.measureText(input.value).width > w - 34)
      measure.font = `400 ${--displaySize}px ${FONT.sans}`;
    // Длинное имя не вылезает в соседнее поле: показываем конец строки,
    // само значение остаётся полностью доступно в настоящем input.
    let left = x - w / 2 + 17 - Math.max(0, measure.measureText(input.value).width - (w - 34));
    for (let i = 0; i < Math.max(chars.length, next.length); i++) {
      const id = prefix + key + ':char' + i, ch = next[i];
      if (!ch) { sand.drop(id); continue; }
      const width = measure.measureText(ch).width;
      const opts = { x: left + width / 2, y: midY(ch, { size: displaySize, font: FONT.sans }, y),
        size: displaySize, font: FONT.sans, baseline: 'middle', align: 'center', density: 2,
        wob: .005, arrive: 'burst', span: .12 };
      if (ch.trim() && left >= x - w / 2 + 12 && left + width <= x + w / 2 - 12) {
        if (chars[i] === ch && sand.has(id)) sand.updateTargets(id, sand.text(null, ch, opts));
        else sand.text(id, ch, opts);
      } else sand.drop(id);
      left += width;
    }
    chars = next; shown = input.value;
  }
  scene.listen(input, 'input', () => { if (shown === input.value) return; paint(); onInput?.(input.value); });
  scene.listen(input, 'keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); onEnter?.(); } });
  return { input,
    place(nextBox) {
      box = nextBox;
      const { x, y, w, h } = box;
      scene.text(key + ':label', label, { x: x - w / 2 + 4, y: y - h / 2 - 25,
        size: 17, align: 'left' });
      const id = prefix + key + ':frame', opts = { x, y, w, h, r: h / 2, thickness: 2.8, density: 1.1, wob: .005 };
      if (sand.has(id)) sand.updateTargets(id, sand.shape(null, 'pillEdge', opts));
      else sand.shape(id, 'pillEdge', { ...opts, arrive: 'wave-x', span: .3 });
      input.style.left = (x - w / 2 + 12) + 'px'; input.style.top = (y - h / 2) + 'px';
      input.style.width = (w - 24) + 'px'; input.style.height = h + 'px';
      paint();
    }, destroy() { input.remove(); }
  };
}
