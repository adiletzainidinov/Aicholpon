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

  // ---------------- Admin ----------------
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
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
    const real = errors.filter((e) => !/401|429|Failed to load resource/.test(e));
    assert.deepEqual(real, []);
  });

  await browser.close();
  console.log(results.join('\n'));
})();
