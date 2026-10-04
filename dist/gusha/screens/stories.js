import { FONT, boxed, ARROW, BACK } from '../ui-kit.js';
import { createScene, viewport, fitText } from '../scene-kit.js';
import { currentReading } from '../flow.js';

let state;
// Пагинация по реальным метрикам шрифта: текст не обрезается и не превращается
// в мелкую подпись. При повороте сохраняется глава и ближайший абзац.
function pagesFor(sand, reading, width, height, size) {
  const pages = [];
  reading.chapters.forEach((chapter, c) => {
    chapter.paragraphs.forEach((paragraph, p) => {
      let text = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = text ? text + ' ' + word : word;
        if (text && sand.measure(candidate, { size, font: FONT.sans, maxWidth: width, lineHeight: 1.38 }).h > height) {
          pages.push({ c, p, text, chapter }); text = word;
        } else text = candidate;
      }
      if (text) pages.push({ c, p, text, chapter });
    });
  });
  return pages;
}

export async function mount(ctx) {
  await ctx.sand.ready;
  const scene = createScene(ctx, 'st-'), reading = currentReading(ctx.session);
  const s = state = { scene, reading, pages: [], cursor: ctx.session.storyCursor || 0,
    summary: false, width: 0, height: 0, swap: false, shareTimer: null };
  ctx.root.style.touchAction = 'pan-y';
  const next = () => turn(1), prev = () => turn(-1);
  function layout(resize = false) {
    const { W, H, top, bottom, cx, pad } = viewport(ctx.sand);
    const wide = W > H * 1.3;
    const contentX = wide ? W * .44 : pad;
    const contentW = wide ? W * .56 - pad : W - pad * 2;
    const titleSize = Math.max(27, Math.min(39, W * .092));
    const titleY = top + (wide ? 56 : Math.max(76, H * .13));
    // Резерв под любую главу и лид одинаков: при смене страницы текст не прыгает.
    const maxTitleH = Math.max(...reading.chapters.map(c => ctx.sand.measure(c.title,
      { size: titleSize, font: FONT.serif, maxWidth: contentW }).h));
    const leadSize = wide ? 18 : Math.min(22, Math.max(19, W * .052));
    const leadH = Math.max(...reading.chapters.map(c => c.lead ? ctx.sand.measure(c.lead,
      { size: leadSize, font: FONT.serif, maxWidth: contentW, lineHeight: 1.22 }).h : 0));
    const leadY = titleY + maxTitleH + 18;
    const bodyY = leadY + leadH + (leadH ? 23 : 0);
    const bodyBottom = bottom - (wide ? 75 : 158);
    const bodyH = Math.max(62, bodyBottom - bodyY);
    const bodySize = Math.min(22, Math.max(18, Math.round(W * .051)));
    if (s.width !== W || s.height !== H || !s.pages.length) {
      const anchor = s.pages[s.cursor];
      const wasSummary = s.summary || s.pages.length > 0 && s.cursor === s.pages.length;
      s.pages = pagesFor(ctx.sand, reading, contentW, bodyH, bodySize);
      if (wasSummary) s.cursor = s.pages.length;
      else if (resize && anchor) s.cursor = Math.max(0, s.pages.findIndex(p => p.c === anchor.c && p.p === anchor.p));
      else s.cursor = Math.min(s.cursor, s.pages.length);
      s.width = W; s.height = H;
    }
    s.summary = s.cursor === s.pages.length;
    ctx.session.storyCursor = s.cursor;
    ctx.root.dataset.chapter = s.summary ? 'summary' : String(s.pages[s.cursor].c);
    ctx.root.dataset.page = String(s.cursor);
    scene.button('close', { x: pad + 39, y: top + 30, w: 78, h: 36, label: 'Назад', size: 16,
      onTap: () => scene.go(ctx.session.storyFromProfile ? 'profile' : reading.kind === 'full' ? 'cup' : 'sphere') });
    const label = reading.kind === 'full' ? 'Полный разбор' : reading.kind === 'love' ? 'Отношения' : 'Бизнес';
    scene.text('label', label, { x: cx, y: top + 24, size: 14, maxWidth: W - 180, align: 'center' });
    const n = reading.chapters.length, gap = 6, barW = (W - pad * 2 - gap * (n - 1)) / n;
    const currentChapter = s.summary ? n : s.pages[s.cursor].c;
    for (let i = 0; i < n; i++) {
      const id = 'st-progress' + i, opts = { x: pad + barW / 2 + i * (barW + gap), y: top + 60,
        w: barW, h: i <= currentChapter ? 3.8 : 1.2, density: 2, wob: .003 };
      // Полутона progress читаются количеством крупинок, не прозрачностью.
      ctx.sand.shape(id, 'pill', { ...opts, arrive: 'burst', span: .06 });
    }
    if (s.summary) {
      for (const key of ['title', 'lead', 'body', 'symbol', 'position']) scene.remove(key);
      scene.remove('prev'); scene.remove('next');
      scene.text('summaryTitle', 'Твой день одним взглядом', { x: pad, y: top + Math.max(94, H * .18),
        ...fitText(ctx.sand, 'Твой день одним взглядом', { size: 38, font: FONT.serif, maxWidth: W - pad * 2,
          align: 'left' }, H * .19, 28) });
      scene.text('summaryBody', reading.summary, { x: pad, y: top + H * .38,
        ...fitText(ctx.sand, reading.summary, { size: 29, font: FONT.serif, maxWidth: W - pad * 2,
          lineHeight: 1.2, align: 'left' }, H * .24, 22) });
      if (reading.kind === 'full') {
        scene.button('sphere', { x: cx, y: bottom - 124, w: Math.min(370, W - pad * 2), h: 56,
          label: 'Разбор по сфере', filled: true, onTap: () => { ctx.session.storyFromProfile = false; scene.go('sphere'); } });
      } else scene.remove('sphere');
      scene.button('profile', { x: cx, y: bottom - 48, w: Math.min(300, W - pad * 2), h: 52,
        label: 'В профиль', filled: reading.kind !== 'full', onTap: () => scene.go('profile') });
      scene.button('replay', { x: W - pad - 45, y: top + 30, w: 90, h: 36, size: 15,
        label: 'Сначала', onTap: () => { s.cursor = 0; s.summary = false; scene.clear(); layout(); } });
    } else {
      for (const key of ['summaryTitle', 'summaryBody', 'sphere', 'profile', 'replay']) scene.remove(key);
      const page = s.pages[s.cursor], chapter = page.chapter;
      scene.text('title', chapter.title, { x: contentX, y: titleY,
        size: titleSize, font: FONT.serif, maxWidth: contentW, align: 'left', lineHeight: 1.18 });
      if (chapter.lead) scene.text('lead', chapter.lead, { x: contentX, y: leadY,
        size: leadSize, font: FONT.serif, maxWidth: contentW, align: 'left', lineHeight: 1.22 });
      else scene.remove('lead');
      scene.text('body', page.text, { x: contentX, y: bodyY, size: bodySize,
        font: FONT.sans, maxWidth: contentW, align: 'left', lineHeight: 1.38 });
      // Символ живёт в боковой колонке в альбоме; в портрете тексту оставляем место.
      if (wide && chapter.symbol) scene.text('symbol', chapter.symbol, { x: W * .22, y: top + H * .35,
        size: Math.min(100, H * .24), font: FONT.serif, align: 'center' });
      else scene.remove('symbol');
      const within = s.pages.filter(p => p.c === page.c);
      const position = within.indexOf(page) + 1;
      scene.text('position', `${page.c + 1} / ${n}   ·   ${position} / ${within.length}`, {
        x: cx, y: bottom - (wide ? 47 : 116), size: 15, align: 'center' });
      scene.button('prev', { x: pad + 32, y: bottom - 47, w: 64, h: 52,
        label: null, draw: boxed(BACK, 34, 22), aria: 'Предыдущая страница', onTap: prev });
      scene.button('next', { x: W - pad - 32, y: bottom - 47, w: 64, h: 52,
        label: null, draw: boxed(ARROW, 38, 24), aria: 'Следующая страница', onTap: next });
    }
    if (!s.summary) scene.button('share', { x: cx, y: bottom - 47, w: Math.min(145, W - pad * 2 - 160), h: 46,
      size: 18, label: 'Поделиться', onTap: share });
    else scene.remove('share');
  }
  function turn(dir) {
    if (scene.leaving || s.swap) return;
    const cursor = Math.max(0, Math.min(s.pages.length, s.cursor + dir));
    if (cursor === s.cursor) return;
    s.cursor = cursor; s.summary = cursor === s.pages.length;
    layout();
  }
  async function share() {
    const page = s.pages[s.cursor];
    const text = page ? `${page.chapter.title}\n\n${page.text}` : reading.summary;
    try {
      if (navigator.share) await navigator.share({ title: reading.label, text });
      else { await navigator.clipboard.writeText(text); if (scene.dead) return;
        scene.text('shareStatus', 'Текст скопирован', {
        x: ctx.sand.w / 2, y: viewport(ctx.sand).bottom - 86, size: 16, align: 'center' });
        clearTimeout(s.shareTimer); s.shareTimer = setTimeout(() => scene.remove('shareStatus'), 1800); }
    } catch (e) { if (e.name !== 'AbortError') scene.text('shareStatus', 'Не удалось поделиться', {
      x: ctx.sand.w / 2, y: viewport(ctx.sand).bottom - 86, size: 16, align: 'center' }); }
  }
  let start;
  scene.listen(ctx.root, 'pointerdown', e => { if (e.target.closest('button')) return; start = [e.clientX, e.clientY]; });
  scene.listen(ctx.root, 'pointerup', e => { if (!start) return;
    const dx = e.clientX - start[0], dy = e.clientY - start[1]; start = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) turn(dx < 0 ? 1 : -1); });
  scene.listen(ctx.root, 'pointercancel', () => { start = null; });
  scene.listen(window, 'keydown', e => {
    if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') scene.go('profile');
  });
  scene.onResize(() => layout(true)); layout();
  return s;
}
export function unmount() { if (state) { clearTimeout(state.shareTimer); state.scene.destroy(); state = null; } }
export const _state = () => state ? { cursor: state.cursor, pages: state.pages.length,
  chapters: state.reading.chapters.length, kind: state.reading.kind, summary: state.summary } : null;
