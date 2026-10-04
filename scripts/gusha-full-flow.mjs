// Полный продуктовый маршрут: оба билета, оба разбора сферы, профиль,
// восстановление истории, режимы входа и мобилка с системной клавиатурой.
import pkg from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { webkit } = pkg;
const BASE = process.env.GUSHA_BASE || 'http://localhost:5173';
const OUT = process.argv[2] || '/tmp/gusha-full-flow';
mkdirSync(OUT, { recursive: true });
const browser = await webkit.launch(), errors = [], checks = [];
const pass = name => { checks.push(name); console.log('OK ' + name); };
function watch(page) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
}
const wait = (p, name) => p.waitForFunction(n => window.gusha?.screen === n && !window.gusha.busy,
  name, { timeout: 30000, polling: 80 });
const click = (p, name) => p.getByRole('button', { name, exact: true }).click();
const snap = async (p, name) => { await p.waitForTimeout(2200); await p.screenshot({ path: `${OUT}/${name}.png` }); };
async function finishStories(p, expectedKind) {
  let turns = 0;
  while (await p.locator('.gscreen[data-screen="stories"]').getAttribute('data-chapter') !== 'summary') {
    await click(p, 'Следующая страница');
    assert.ok(++turns < 120, 'страницы должны закончиться');
  }
  assert.equal(await p.evaluate(() => window.gusha.session.readingKind || 'full'), expectedKind);
}
function geometry(p) {
  return p.evaluate(() => {
    const boxes = [...document.querySelectorAll('button,input')].map(e => {
      const r = e.getBoundingClientRect(); return { name: e.getAttribute('aria-label'),
        x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height };
    }).filter(b => b.w > 0 && b.h > 0);
    const bad = boxes.filter(b => b.x < -1 || b.y < -1 || b.r > innerWidth + 1 || b.b > innerHeight + 1);
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (Math.min(a.r, b.r) - Math.max(a.x, b.x) > 3 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 3)
        overlaps.push(a.name + '/' + b.name);
    }
    return { bad, overlaps, boxes };
  });
}
try {
  const c = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await c.newPage(); watch(p);
  await p.goto(`${BASE}/gusha/#hello`); await wait(p, 'hello');
  await click(p, 'Получить предсказание'); await wait(p, 'ticket');
  await p.getByRole('textbox', { name: 'Восьмизначный код билета' }).fill('00000000');
  await click(p, 'Активировать'); await wait(p, 'date');
  await click(p, 'Дальше, к чаше'); await wait(p, 'cup');
  await click(p, 'Раскрыть полностью'); await wait(p, 'phone');
  assert.equal(await p.getByRole('button', { name: 'SMS', exact: true }).count(), 0);
  await p.getByRole('textbox', { name: 'Номер телефона', exact: true }).fill('555123456');
  await p.getByRole('textbox', { name: 'Код страны', exact: true }).fill('996');
  await p.evaluate(() => { window.__ph = document.querySelector('input[aria-label="Номер телефона"]'); });
  await p.setViewportSize({ width: 393, height: 530 }); await p.waitForTimeout(450);
  const pg = await geometry(p);
  assert.deepEqual(pg.bad, [], 'phone: CTA не должна уйти за клавиатуру');
  assert.equal(await p.evaluate(() => window.__ph === document.querySelector('input[aria-label="Номер телефона"]')), true);
  await snap(p, 'phone-keyboard');
  await p.setViewportSize({ width: 393, height: 852 }); await p.waitForTimeout(200);
  await click(p, 'Продолжить'); await wait(p, 'name');
  pass('phone_only: телефон ведёт сразу к имени, системная клавиатура не сбрасывает ввод');
  await p.getByRole('textbox', { name: 'Имя', exact: true }).fill('Тест');
  assert.equal(await p.getByRole('button', { name: 'Продолжить', exact: true }).getAttribute('aria-disabled'), 'true');
  await p.getByRole('textbox', { name: 'Фамилия', exact: true }).fill('Пример');
  await p.evaluate(() => { window.__name = document.querySelector('input[aria-label="Фамилия"]'); });
  await p.setViewportSize({ width: 393, height: 530 }); await p.waitForTimeout(450);
  const ng = await geometry(p); assert.deepEqual(ng.bad, []); assert.deepEqual(ng.overlaps, []);
  assert.equal(await p.evaluate(() => window.__name === document.querySelector('input[aria-label="Фамилия"]')), true);
  await snap(p, 'name-keyboard');
  await p.setViewportSize({ width: 393, height: 852 }); await p.waitForTimeout(200);
  await click(p, 'Продолжить'); await wait(p, 'stories');
  await snap(p, 'full-first');
  await p.setViewportSize({ width: 844, height: 390 }); await snap(p, 'full-rotated');
  assert.deepEqual((await geometry(p)).bad, []);
  assert.equal(await p.locator('.gscreen[data-screen="stories"]').getAttribute('data-chapter'), '0');
  await p.setViewportSize({ width: 393, height: 852 }); await snap(p, 'full-portrait-again');
  await click(p, 'Следующая страница'); const pageNumber = await p.locator('.gscreen[data-screen="stories"]').getAttribute('data-page');
  await click(p, 'Предыдущая страница'); assert.equal(pageNumber, '1');
  assert.equal(await p.locator('.gscreen[data-screen="stories"]').getAttribute('data-page'), '0');
  const full = await p.evaluate(() => window.gusha.session.activeReadingId);
  await p.reload(); await wait(p, 'stories');
  assert.equal(await p.evaluate(() => window.gusha.session.activeReadingId), full);
  assert.equal(await p.evaluate(() => window.gusha.session.readings.length), 1);
  await finishStories(p, 'full'); await snap(p, 'full-summary');
  pass('Имя и фамилия обязательны; полный разбор сохраняется без дублей после reload');
  await click(p, 'Разбор по сфере'); await wait(p, 'sphere');
  assert.equal(await p.locator('button.gl-hit:not(.next)').count(), 2);
  await snap(p, 'sphere-love');
  await click(p, 'Бизнес'); await snap(p, 'sphere-business'); await click(p, 'Отношения');
  await click(p, 'Дальше'); await wait(p, 'sphere-ticket');
  await p.getByRole('textbox', { name: 'Восьмизначный код билета' }).fill('00000000');
  await click(p, 'Активировать'); await wait(p, 'stories');
  assert.equal(await p.evaluate(() => window.gusha.session.readings.length), 2);
  await snap(p, 'love-first'); await finishStories(p, 'love');
  await click(p, 'В профиль'); await wait(p, 'profile'); await snap(p, 'profile');
  pass('Отношения: второй билет открывает отдельный разбор и сохраняет его в профиле');
  await click(p, 'Открыть: Полный разбор'); await wait(p, 'stories');
  assert.equal(await p.evaluate(() => window.gusha.session.activeReadingId), full);
  await finishStories(p, 'full'); await click(p, 'Разбор по сфере'); await wait(p, 'sphere');
  await click(p, 'Бизнес'); await click(p, 'Дальше'); await wait(p, 'sphere-ticket');
  await p.getByRole('textbox', { name: 'Восьмизначный код билета' }).fill('00000000');
  await click(p, 'Активировать'); await wait(p, 'stories');
  await finishStories(p, 'career'); await click(p, 'В профиль'); await wait(p, 'profile');
  assert.equal(await p.evaluate(() => window.gusha.session.readings.length), 3);
  const archive = await p.evaluate(() => ({ ...window.gusha.session,
    readingKind: 'full', activeReadingId: window.gusha.session.readings.find(r => r.kind === 'full').id,
    storyCursor: 0, storyFromProfile: true }));
  await click(p, 'Изменить'); await wait(p, 'name');
  assert.equal(await p.getByRole('textbox', { name: 'Имя', exact: true }).inputValue(), 'Тест');
  await p.getByRole('textbox', { name: 'Имя', exact: true }).fill('Новое');
  await click(p, 'Сохранить'); await wait(p, 'profile');
  assert.equal(await p.evaluate(() => window.gusha.session.profile.firstName), 'Новое');
  await click(p, 'Выйти'); await wait(p, 'hello');
  await p.goto(`${BASE}/gusha/#phone`); await wait(p, 'phone');
  await p.getByRole('textbox', { name: 'Код страны', exact: true }).fill('996');
  await p.getByRole('textbox', { name: 'Номер телефона', exact: true }).fill('555123456');
  await click(p, 'Продолжить'); await wait(p, 'name');
  assert.equal(await p.getByRole('textbox', { name: 'Имя', exact: true }).inputValue(), 'Новое');
  assert.equal(await p.evaluate(() => window.gusha.session.readings.length), 3);
  pass('Бизнес, повторное открытие сохранённого разбора, редактирование и повторный вход с архивом');
  await c.close();

  for (const mode of ['full', 'disabled']) {
    const mc = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const mp = await mc.newPage(); watch(mp);
    await mp.goto(`${BASE}/gusha/?auth=${mode}#${mode === 'full' ? 'phone' : 'cup'}`);
    await wait(mp, mode === 'full' ? 'phone' : 'cup');
    if (mode === 'full') {
      await mp.getByRole('textbox', { name: 'Номер телефона', exact: true }).fill('5551234567');
      await click(mp, 'Продолжить'); await wait(mp, 'code');
      for (const n of '1234') await click(mp, 'Цифра ' + n);
      assert.equal(await mp.getByRole('button', { name: 'Продолжить', exact: true }).count(), 0);
      await click(mp, 'Дальше');
      await mp.getByRole('button', { name: 'Продолжить', exact: true }).waitFor();
      await click(mp, 'Продолжить'); await wait(mp, 'name');
    } else { await click(mp, 'Раскрыть полностью'); await wait(mp, 'stories'); }
    pass('Режим входа ' + mode); await mc.close();
  }
  const adaptive = [];
  for (const [width, height] of [[320,568], [393,659], [430,932], [844,390], [320,350]]) {
    const ac = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    await ac.addInitScript(data => sessionStorage.setItem('gusha.session.v1', JSON.stringify(data)), archive);
    const ap = await ac.newPage(); watch(ap);
    for (const screen of ['name', 'stories', 'sphere', 'sphere-ticket', 'profile']) {
      if (height === 350 && screen !== 'name') continue;
      await ap.goto(`${BASE}/gusha/#${screen}`); await wait(ap, screen);
      const g = await geometry(ap);
      if (g.bad.length || g.overlaps.length) adaptive.push({ width, height, screen, bad:g.bad, overlaps:g.overlaps });
      if (screen === 'stories') {
        await finishStories(ap, 'full');
        const summary = await geometry(ap);
        if (summary.bad.length || summary.overlaps.length) adaptive.push({ width,height,screen:'summary',bad:summary.bad,overlaps:summary.overlaps });
      }
      await snap(ap, `${width}-${height}-${screen}`);
    }
    await ac.close();
  }
  assert.deepEqual(adaptive, [], 'мобильная геометрия');
  pass('Мобильная матрица: маленький экран, панели браузера, большой телефон, альбом и клавиатура');
  assert.deepEqual(errors, [], 'консоль и запросы');
  console.log(`\n${checks.length} сценариев прошли. Снимки: ${OUT}`);
} finally { await browser.close(); }
