import { FONT } from '../ui-kit.js';
import { createScene, viewport, sandField, fitText } from '../scene-kit.js';
import { persistAccount } from '../flow.js';

let state;
export async function mount(ctx) {
  await ctx.sand.ready;
  const scene = createScene(ctx, 'nm-'), session = ctx.session;
  const edit = session.nameReturn === 'profile';
  const s = state = { scene, fields: [], submitted: false };
  const profile = session.profile || {};
  const valid = () => s.fields.length === 2 && s.fields.every(f => f.input.value.trim().length > 0);
  function submit() {
    if (!valid() || s.submitted) return;
    s.submitted = true;
    session.profile = { firstName: s.fields[0].input.value.trim(), lastName: s.fields[1].input.value.trim() };
    persistAccount(session);
    s.fields.forEach(f => f.input.blur());
    session.nameReturn = 'stories';
    scene.go(edit ? 'profile' : 'stories');
  }
  function ready() {
    const b = document.querySelector('[data-screen="name"] button[aria-label="' + (edit ? 'Сохранить' : 'Продолжить') + '"]');
    b?.setAttribute('aria-disabled', String(!valid()));
    layout();
  }
  s.fields.push(sandField(scene, 'first', { label: 'Имя', value: profile.firstName || '',
    autocomplete: 'given-name', onInput: ready, onEnter: () => s.fields[1].input.focus() }));
  s.fields.push(sandField(scene, 'last', { label: 'Фамилия', value: profile.lastName || '',
    autocomplete: 'family-name', onInput: ready, onEnter: submit }));
  function layout() {
    const { W, H, top, bottom, cx, pad } = viewport(ctx.sand);
    const wide = W > H * 1.4, title = edit ? 'Как к вам обращаться?' : 'Как к вам обращаться?';
    const titleY = top + (H < 500 ? 20 : Math.max(48, H * .11));
    const opts = fitText(ctx.sand, title, { size: Math.min(38, W * .09),
      font: FONT.serif, maxWidth: W - pad * 2, align: 'center' }, 85, 26);
    scene.text('title', title, { x: cx, y: titleY, ...opts });
    const titleH = ctx.sand.measure(title, opts).h;
    const fieldH = H < 400 ? 44 : 54;
    const fieldY = wide ? top + H * .47 : titleY + titleH + 38 + fieldH / 2;
    const w = wide ? Math.min(300, (W - pad * 3) / 2) : Math.min(380, W - pad * 2);
    s.fields[0].place({ x: wide ? cx - w / 2 - 10 : cx, y: fieldY, w, h: fieldH });
    s.fields[1].place({ x: wide ? cx + w / 2 + 10 : cx,
      y: wide ? fieldY : fieldY + fieldH + (H < 400 ? 34 : 40), w, h: fieldH });
    const next = scene.button('next', { x: cx, y: bottom - 48, w: Math.min(320, W - 52), h: 56,
      label: edit ? 'Сохранить' : 'Продолжить', filled: valid(), onTap: submit });
    next.zone?.setAttribute('aria-disabled', String(!valid()));
    scene.button('back', { x: wide ? pad + 35 : cx, y: wide ? bottom - 48 : bottom - 116,
      w: 124, h: 38, size: 18, label: edit ? 'Отмена' : 'Назад', filled: false,
      onTap: () => { session.nameReturn = 'stories'; scene.go(edit ? 'profile' : 'phone'); } });
    // При клавиатуре кнопка отмены занимает отдельную компактную область сверху:
    // две формы и CTA не должны делить одну и ту же полосу.
    if (!wide && H < 550) {
      scene.button('back', { x: W - 52, y: top + 22, w: 86, h: 34, size: 16,
        label: edit ? 'Отмена' : 'Назад', filled: false,
        onTap: () => { session.nameReturn = 'stories'; scene.go(edit ? 'profile' : 'phone'); } });
      scene.text('title', title, { x: cx, y: top + 64, ...opts });
      const compactY = top + 64 + titleH + 28 + fieldH / 2;
      s.fields[0].place({ x: cx, y: compactY, w, h: fieldH });
      s.fields[1].place({ x: cx, y: compactY + fieldH + 34, w, h: fieldH });
    }
  }
  scene.onResize(layout); layout();
  return s;
}
export function unmount() {
  if (!state) return;
  state.fields.forEach(f => f.destroy()); state.scene.destroy(); state = null;
}
