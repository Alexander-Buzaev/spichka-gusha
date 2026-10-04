import { FONT, formatPhone } from '../ui-kit.js';
import { createScene, viewport, fitText } from '../scene-kit.js';
import { openReading, persistAccount, signOut } from '../flow.js';

let state;
export async function mount(ctx) {
  await ctx.sand.ready;
  const scene = createScene(ctx, 'pf-'), session = ctx.session;
  const s = state = { scene, page: 0 };
  persistAccount(session);
  function layout() {
    scene.clear();
    const { W, H, top, bottom, cx, pad } = viewport(ctx.sand);
    const wide = W > H * 1.3;
    const p = session.profile || {};
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Ваш профиль';
    const left = wide ? W * .43 : pad, width = wide ? W * .57 - pad : W - pad * 2;
    scene.text('title', name, { x: pad, y: top + 28,
      ...fitText(ctx.sand, name, { size: 37, font: FONT.serif,
        maxWidth: wide ? W * .38 : W - pad * 2, align: 'left' }, H * .14, 25) });
    scene.text('phone', session.phone ? formatPhone(session.phone, session.countryCode) : 'Сохраните свой разбор', {
      x: pad, y: top + (wide ? 118 : 103), size: 17, maxWidth: wide ? W * .38 : W - pad * 2, align: 'left' });
    scene.button('edit', { x: pad + 65, y: top + (wide ? 171 : 156), w: 130, h: 38, size: 18,
      label: session.logged ? 'Изменить' : 'Войти', onTap: () => {
        session.nameReturn = 'profile'; scene.go(session.logged ? 'name' : 'phone');
      } });
    const listTop = wide ? top + 24 : top + 211;
    scene.text('listTitle', 'Ваши предсказания', { x: left, y: listTop, size: 25, font: FONT.serif, align: 'left' });
    const listBottom = bottom - 185;
    const cardTop = listTop + 49;
    const count = Math.max(1, Math.min(3, Math.floor((listBottom - cardTop) / 105)));
    const readings = Array.isArray(session.readings) ? session.readings : [];
    const totalPages = Math.max(1, Math.ceil(readings.length / count));
    s.page = Math.min(s.page, totalPages - 1);
    const visible = readings.slice(s.page * count, (s.page + 1) * count);
    if (!visible.length) scene.text('empty', 'Здесь появятся ваши\nсохранённые разборы', { x: left,
      y: cardTop + 20, size: 22, font: FONT.serif, align: 'left', maxWidth: width });
    visible.forEach((r, i) => {
      const y = cardTop + i * 105;
      const date = new Date(r.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      const label = date + ' · ' + r.label;
      scene.text('date' + i, label, { x: left + 15, y: y + 9, size: 13, align: 'left', maxWidth: width - 30 });
      const options = fitText(ctx.sand, r.summary, { size: 22, font: FONT.serif,
        maxWidth: width - 36, align: 'left', lineHeight: 1.12 }, 46, 18);
      scene.text('reading' + i, r.summary, { x: left + 15, y: y + 33, ...options });
      const frame = scene.button('card' + i, { x: left + width / 2, y: y + 47, w: width, h: 94,
        label: '', aria: 'Открыть: ' + r.label, onTap: () => { if (openReading(session, r.id)) scene.go('stories'); } });
      frame.zone.dataset.reading = r.id;
    });
    if (totalPages > 1) {
      scene.button('older', { x: left + width * .75, y: listBottom + 12, w: 120, h: 34,
        label: 'Далее', size: 17, onTap: () => { s.page = (s.page + 1) % totalPages; layout(); } });
      scene.button('newer', { x: left + width * .25, y: listBottom + 12, w: 120, h: 34,
        label: 'Назад', size: 17, onTap: () => { s.page = (s.page - 1 + totalPages) % totalPages; layout(); } });
    }
    scene.button('new', { x: cx, y: bottom - 111, w: Math.min(340, W - pad * 2), h: 56,
      label: 'Новое предсказание', filled: true, onTap: () => scene.go('hello') });
    scene.button('logout', { x: cx, y: bottom - 41, w: 160, h: 38, size: 18,
      label: session.logged ? 'Выйти' : 'На главную', onTap: () => { signOut(session); scene.go('hello'); } });
  }
  scene.onResize(layout); layout();
  return s;
}
export function unmount() { if (state) { state.scene.destroy(); state = null; } }
