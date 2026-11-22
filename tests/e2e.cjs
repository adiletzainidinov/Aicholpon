/**
 * End-to-end checks. Run against a server started with AICHOLPON_MOCK=1
 * (in-memory data – real guests are never touched):
 *   AICHOLPON_MOCK=1 PORT=3100 npm start & BASE=http://localhost:3100 npm run test:e2e
 * Set SHOTS=dir to save screenshots. Set QUALITY=lite|balanced|high to force a tier.
 */
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = process.env.SHOTS;
const PASSWORD = process.env.ADMIN_PASSWORD || 'mock-admin-password';
const results = [];

async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push(`✓ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    results.push(`✗ ${name}: ${e.message.split('\n')[0]}`);
    process.exitCode = 1;
  }
}

async function openInvitation(page, query) {
  await page.goto(`${BASE}/${query}`, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Чакырууну ачуу' }).click();
  // the 3D timeline is ~7 s; under software rendering GSAP lag-smoothing stretches it
  await page.waitForFunction(() => !document.documentElement.classList.contains('locked'), null, { timeout: 60000 });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const watch = (page, label) => {
    page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${label} console: ${m.text()}`));
  };

  for (const [label, device, quality] of [
    ['iPhone 13 (WebKit UA, lite)', devices['iPhone 13'], 'lite'],
    ['Pixel 7 (balanced)', devices['Pixel 7'], 'balanced'],
  ]) {
    const ctx = await browser.newContext({ ...device });
    const page = await ctx.newPage();
    watch(page, label);

    await step(`${label}: legacy ?token= link shows guest name`, async () => {
      await openInvitation(page, `?token=demo-token-1&quality=${quality}`);
      await page.getByRole('heading', { name: /Урматтуу/ }).getByText('Асан ага жана Үсөн эже').waitFor({ timeout: 10000 });
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${quality}-after-open.png` });
    });

    await step(`${label}: RSVP "Келе албайм" hides people field and saves 0`, async () => {
      await page.locator('#rsvp').scrollIntoViewIfNeeded();
      await page.getByRole('radio', { name: 'Келем' }).check();
      await page.getByTestId('people-wrap').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Көбөйтүү' }).click();
      assert.equal(await page.getByTestId('people-count').textContent(), '2');
      await page.getByRole('radio', { name: 'Келе албайм' }).check();
      await page.getByTestId('people-wrap').waitFor({ state: 'hidden', timeout: 3000 });
      const res = page.waitForResponse((r) => r.url().endsWith('/api/rsvp'));
      await page.getByRole('button', { name: 'Жөнөтүү' }).click();
      const body = await (await res).json();
      assert.equal(body.ok, true);
      assert.equal(body.people, 0);
      await page.getByTestId('rsvp-saved').waitFor();
    });

    await step(`${label}: RSVP "Келем" saves people count`, async () => {
      await page.getByRole('button', { name: 'Жоопту өзгөртүү' }).click();
      await page.getByRole('radio', { name: 'Келем' }).check();
      while (Number(await page.getByTestId('people-count').textContent()) > 1) await page.getByRole('button', { name: 'Азайтуу' }).click();
      await page.getByRole('button', { name: 'Көбөйтүү' }).click();
      await page.getByRole('button', { name: 'Көбөйтүү' }).click();
      const res = page.waitForResponse((r) => r.url().endsWith('/api/rsvp'));
      await page.getByRole('button', { name: 'Жөнөтүү' }).click();
      const body = await (await res).json();
      assert.equal(body.ok, true);
      assert.equal(body.people, 3);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${quality}-rsvp-saved.png` });
    });
    await step(`${label}: music toggles off and on`, async () => {
      const btn = page.getByRole('button', { name: /Музыканы/ });
      assert.equal(await btn.getAttribute('aria-pressed'), 'true');
      await btn.click();
      await page.waitForFunction(() => document.querySelector('.music')?.getAttribute('aria-pressed') === 'false');
      await btn.click();
      await page.waitForFunction(() => document.querySelector('.music')?.getAttribute('aria-pressed') === 'true');
    });

    await step(`${label}: scroll cue glides to the next scene`, async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      const cue = page.getByRole('button', { name: 'Кийинки бөлүмгө өтүү' });
      await cue.waitFor();
      const box = await cue.boundingBox();
      const vp = page.viewportSize();
      assert.ok(box && box.y + box.height <= vp.height, 'cue inside the viewport');
      await cue.click({ force: true }); // it floats continuously, so it is never "stable" for Playwright
      await page.waitForFunction(() => window.scrollY > innerHeight * 0.8, null, { timeout: 5000 });
      await page.waitForFunction(() => document.querySelector('.scroll-cue')?.getAttribute('data-hidden') === 'true');
    });
    await step(`${label}: "Жооп берүү" shortcut jumps to the RSVP form`, async () => {
      await page.evaluate(() => window.scrollTo(0, innerHeight * 1.2));
      const pill = page.locator('.rsvp-shortcut');
      await page.waitForFunction(() => document.querySelector('.rsvp-shortcut')?.getAttribute('data-show') === 'true');
      await pill.click();
      await page.waitForFunction(() => {
        const r = document.getElementById('rsvp')?.getBoundingClientRect();
        return r && Math.abs(r.top) < 40;
      }, null, { timeout: 6000 });
      await page.waitForFunction(() => document.querySelector('.rsvp-shortcut')?.getAttribute('data-show') === 'false');
    });
    await ctx.close();
  }

  await step('Unknown token shows a friendly notice, page still works', async () => {
    const page = await browser.newPage();
    watch(page, 'unknown-token');
    await openInvitation(page, '?token=does-not-exist&quality=lite');
    await page.getByText('Жеке чакыруу шилтемеси табылган жок', { exact: false }).waitFor();
    await page.close();
  });

  await step('API validation: invalid RSVP rejected, cross-site POST rejected', async () => {
    const r1 = await fetch(`${BASE}/api/rsvp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify({ name: '', attending: true }) });
    assert.equal(r1.status, 400);
    const r2 = await fetch(`${BASE}/api/rsvp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: JSON.stringify({ name: 'x', attending: true, people: 1 }) });
    assert.equal(r2.status, 403);
    const r3 = await fetch(`${BASE}/api/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify({ action: 'list' }) });
    assert.equal(r3.status, 401);
  });

  await step('No horizontal page scroll at 320–430 px (invitation + admin)', async () => {
    for (const w of [320, 360, 375, 390, 412, 430]) {
      const c = await browser.newContext({ viewport: { width: w, height: 760 }, isMobile: true, hasTouch: true });
      const p = await c.newPage();
      await openInvitation(p, '?quality=lite&token=demo-token-2');
      for (const y of [0, 800, 1600, 2400, 3200, 4000]) {
        await p.evaluate((yy) => window.scrollTo(0, yy), y);
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), w, `invitation ${w}px @${y}`);
      }
      await p.goto(`${BASE}/admin`);
      await p.getByLabel('Пароль').fill(PASSWORD);
      await p.getByRole('button', { name: 'Войти' }).click();
      await p.getByRole('heading', { name: 'Список гостей' }).waitFor();
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), w, `admin guests ${w}px`);
      await p.getByRole('tab', { name: 'Статистика' }).click();
      await p.getByText('Просмотры по дням').waitFor();
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), w, `admin stats ${w}px`);
      await p.getByRole('button', { name: '14 дн.' }).click();
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), w, `admin chart 14d ${w}px`);
      await c.close();
    }
  });

  // ---------------- Admin ----------------
  const ctx = await browser.newContext({ ...devices['iPhone 13'], permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  watch(page, 'admin');
  page.on('dialog', (d) => d.accept());

  await step('Admin: legacy /admin/ URL opens and wrong password is refused', async () => {
    await page.goto(`${BASE}/admin/`);
    await page.getByLabel('Пароль').fill('wrong-password');
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.getByRole('alert').getByText('Неверный пароль').waitFor({ timeout: 10000 });
  });

  await step('Admin: login with password, httpOnly session cookie', async () => {
    await page.getByLabel('Пароль').fill(PASSWORD);
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.getByRole('heading', { name: 'Список гостей' }).waitFor({ timeout: 10000 });
    const cookies = await ctx.cookies(BASE + '/api/admin');
    const c = cookies.find((x) => x.name === 'aicholpon_admin');
    assert.ok(c, 'session cookie set');
    assert.equal(c.httpOnly, true);
    assert.equal(c.sameSite, 'Strict');
    assert.equal(await page.evaluate(() => document.cookie.includes('aicholpon_admin')), false);
  });

  await step('Admin: RSVP answers from the invitation are visible', async () => {
    const card = page.getByTestId('guest').filter({ hasText: 'Асан ага жана Үсөн эже' });
    await card.getByText('Придёт · 3 чел.').waitFor();
  });

  await step('Admin: copy link and WhatsApp share', async () => {
    const card = page.getByTestId('guest').filter({ hasText: 'Мээрим' });
    await card.getByRole('button', { name: 'Копировать' }).click();
    await card.getByRole('button', { name: '✓ Скопировано' }).waitFor();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(clip, /\/\?token=demo-token-2$/);
    // wa.me is not reachable from the test sandbox: capture the URL instead of following it
    await page.evaluate(() => {
      window.open = (u) => ((window.__opened = String(u)), null);
    });
    await card.getByRole('button', { name: 'WhatsApp' }).click();
    const url = decodeURIComponent(await page.evaluate(() => window.__opened));
    assert.ok(url.startsWith('https://wa.me/?text='), url);
    assert.ok(url.includes('token=demo-token-2'), 'personal link in the message');
  });

  const tmpName = 'Тест-конок ' + Date.now();
  await step('Admin: create, search, rename and delete a temporary invitation', async () => {
    await page.getByLabel('Имя гостя').fill(tmpName);
    await page.getByRole('button', { name: 'Создать ссылку' }).click();
    await page.getByTestId('guest-name').filter({ hasText: tmpName }).waitFor();
    await page.getByLabel('Поиск по имени').fill('Тест-конок');
    assert.equal(await page.getByTestId('guest').count(), 1);
    const card = page.getByTestId('guest').filter({ hasText: tmpName });
    await card.getByRole('button', { name: 'Изменить' }).click();
    await page.getByLabel('Новое имя').fill(tmpName + ' 2');
    await page.getByRole('button', { name: 'OK' }).click();
    await page.getByTestId('guest-name').filter({ hasText: tmpName + ' 2' }).waitFor();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin-guests.png` });
    await page.getByTestId('guest').filter({ hasText: tmpName + ' 2' }).getByRole('button', { name: 'Удалить' }).click();
    await page.getByTestId('guest-name').filter({ hasText: tmpName }).waitFor({ state: 'detached' });
    await page.getByLabel('Поиск по имени').fill('');
  });

  await step('Admin: statistics count views, opens and RSVPs', async () => {
    await page.getByRole('tab', { name: 'Статистика' }).click();
    const val = async (label) => Number(await page.getByText(label, { exact: true }).locator('xpath=following-sibling::div').textContent());
    assert.ok((await val('Просмотры сайта')) >= 3);
    assert.ok((await val('Открытия конверта')) >= 3);
    assert.ok((await val('Ответы через сайт')) >= 4);
    await page.getByRole('button', { name: '14 дн.' }).click();
    await page.getByRole('button', { name: '7 дн.' }).click();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin-stats.png`, fullPage: true });
  });

  await step('Admin: CSV export downloads', async () => {
    await page.getByRole('tab', { name: 'Гости' }).click();
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    assert.equal(d.suggestedFilename(), 'aicholpon-guests.csv');
  });

  await step('Admin: logout clears the session', async () => {
    await page.getByRole('button', { name: 'Выйти' }).click();
    await page.getByLabel('Пароль').waitFor();
    const r = await page.evaluate(async () => (await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"list"}' })).status);
    assert.equal(r, 401);
  });

  await step('Admin page does not load three.js', async () => {
    const p = await ctx.newPage();
    const scripts = [];
    p.on('response', (r) => r.url().includes('/_next/static/chunks/') && scripts.push(r.url()));
    await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    const bodies = await Promise.all(scripts.map((u) => fetch(u).then((r) => r.text())));
    assert.ok(!bodies.some((b) => b.includes('WebGLRenderer')), 'three.js chunk loaded on /admin');
  });

  await step('Login brute-force protection returns 429', async () => {
    let last = 0;
    for (let i = 0; i < 10; i++) {
      const r = await fetch(`${BASE}/api/admin/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE, 'x-real-ip': '203.0.113.9' }, body: JSON.stringify({ password: 'nope' + i }) });
      last = r.status;
      if (last === 429) break;
    }
    assert.equal(last, 429);
  });

  await step('No JavaScript errors', async () => {
    const real = errors.filter((e) => !/401|429|Failed to load resource|ERR_TUNNEL|ERR_PROXY|wa\.me/.test(e));
    assert.deepEqual(real, []);
  });

  await browser.close();
  console.log(results.join('\n'));
})();
