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
      await p.getByRole('heading', { name: /^Приглашения/ }).waitFor();
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), w, `admin invitations ${w}px`);
      await p.getByRole('tab', { name: /Ответы/ }).click();
      await p.getByRole('heading', { name: /Ответы гостей/ }).waitFor();
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), w, `admin responses ${w}px`);
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
    await page.getByRole('heading', { name: /^Приглашения/ }).waitFor({ timeout: 10000 });
    const cookies = await ctx.cookies(BASE + '/api/admin');
    const c = cookies.find((x) => x.name === 'aicholpon_admin');
    assert.ok(c, 'session cookie set');
    assert.equal(c.httpOnly, true);
    assert.equal(c.sameSite, 'Strict');
    assert.equal(await page.evaluate(() => document.cookie.includes('aicholpon_admin')), false);
  });

  // ---- full scenario: create → share → guest answers → answers tab → statistics ----
  const stamp = Date.now();
  const yesName = `Тест-үй-бүлө ${stamp}`;
  const noName = `Тест-конок ${stamp}`;
  const created = {};
  const statVal = async (label) => Number(await page.getByText(label, { exact: true }).locator('xpath=following-sibling::div').first().textContent());
  let before = {};

  await step('Scenario 0: remember statistics before', async () => {
    await page.getByRole('tab', { name: /Статистика/ }).click();
    for (const l of ['Всего приглашений', 'Ответили', 'Придут (семей)', 'Отказались', 'Людей придёт', 'Просмотры сайта']) before[l] = await statVal(l);
    await page.getByRole('tab', { name: /Приглашения/ }).click();
  });

  await step('Scenario 1: admin creates invitations and immediately gets link + share buttons', async () => {
    for (const n of [yesName, noName]) {
      await page.getByLabel('Имя гостя').fill(n);
      await page.getByRole('button', { name: 'Создать приглашение' }).click();
      const panel = page.getByTestId('created-invite');
      await panel.getByText(n).waitFor();
      const link = await panel.getByLabel('Персональная ссылка').inputValue();
      assert.match(link, /\/\?token=[A-Za-z0-9_-]+$/);
      created[n] = link;
      await panel.getByRole('link', { name: 'Посмотреть' }).waitFor();
      await panel.getByRole('button', { name: 'Отправить в WhatsApp' }).waitFor();
    }
    await page.getByTestId('invite-name').filter({ hasText: yesName }).waitFor();
  });

  await step('Scenario 2: copy link and WhatsApp carry the personal link; "Посмотреть" is a preview', async () => {
    const card = page.getByTestId('invite').filter({ hasText: yesName });
    await card.getByRole('button', { name: 'Копировать ссылку' }).click();
    await card.getByRole('button', { name: '✓ Скопировано' }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), created[yesName]);
    await page.evaluate(() => {
      window.open = (u) => ((window.__opened = String(u)), null);
    });
    await card.getByRole('button', { name: 'Отправить в WhatsApp' }).click();
    const wa = decodeURIComponent(await page.evaluate(() => window.__opened));
    assert.ok(wa.startsWith('https://wa.me/?text='), wa);
    assert.ok(wa.includes(created[yesName]), 'WhatsApp message contains the personal link');
    const href = await card.getByRole('link', { name: 'Посмотреть' }).getAttribute('href');
    assert.equal(href, created[yesName] + '&preview=1');
  });

  await step('Scenario 3: the answers tab has no unanswered invitations yet and no share buttons', async () => {
    await page.getByRole('tab', { name: /Ответы/ }).click();
    const list = page.getByTestId('response-list');
    assert.equal(await list.getByText(yesName).count(), 0);
    assert.equal(await page.getByRole('button', { name: /WhatsApp|Копировать/ }).count(), 0);
    assert.equal(await page.getByRole('link', { name: /token=|Посмотреть/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /Без ответа/ }).count(), 0);
    for (const f of ['Все', 'Придут', 'Не придут']) await page.getByRole('button', { name: new RegExp('^' + f) }).waitFor();
  });

  const guestAnswers = async (link, answer, extraPeople) => {
    const g = await browser.newContext({ ...devices['Pixel 7'] });
    const gp = await g.newPage();
    watch(gp, 'guest');
    await openInvitation(gp, link.replace(BASE + '/', '') + '&quality=lite');
    const expected = link === created[yesName] ? yesName : noName;
    await gp.getByRole('heading', { name: /Урматтуу/ }).getByText(expected).waitFor({ timeout: 10000 });
    await gp.locator('#rsvp').scrollIntoViewIfNeeded();
    // a choice is mandatory
    let posted = 0;
    gp.on('request', (r) => r.url().endsWith('/api/rsvp') && posted++);
    await gp.getByRole('button', { name: 'Жөнөтүү' }).click();
    await gp.getByRole('alert').getByText(/Жоопту тандаңыз/).waitFor();
    assert.equal(posted, 0, 'no request without a choice');
    await gp.getByRole('radio', { name: answer }).check();
    if (answer === 'Келем') for (let i = 0; i < extraPeople; i++) await gp.getByRole('button', { name: 'Көбөйтүү' }).click();
    else await gp.getByTestId('people-wrap').waitFor({ state: 'hidden' });
    const res = gp.waitForResponse((r) => r.url().endsWith('/api/rsvp'));
    await gp.getByRole('button', { name: 'Жөнөтүү' }).click();
    const body = await (await res).json();
    assert.equal(body.ok, true);
    await gp.getByTestId('rsvp-saved').waitFor();
    await g.close();
    return body;
  };

  await step('Scenario 4: guests answer "Келем" (3 people) and "Келе албайм" (saved as 0)', async () => {
    const a = await guestAnswers(created[yesName], 'Келем', 2);
    assert.equal(a.people, 3);
    const b = await guestAnswers(created[noName], 'Келе албайм', 0);
    assert.equal(b.people, 0);
    // answering again through the same personal link updates the record (no duplicate)
    const c = await guestAnswers(created[yesName], 'Келем', 1);
    assert.equal(c.people, 2);
  });

  await step('Scenario 5: answers appear in the answers tab with status, people and time', async () => {
    await page.getByRole('button', { name: 'Обновить' }).click();
    await page.getByRole('tab', { name: /Ответы/ }).click();
    const yesRow = page.getByTestId('response').filter({ hasText: yesName });
    await yesRow.waitFor();
    assert.equal(await yesRow.count(), 1, 'one row per personal link (no duplicate)');
    assert.match(await yesRow.getByTestId('response-status').innerText(), /Придёт\s+2 чел\./);
    assert.match(await yesRow.innerText(), /\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/);
    const noRow = page.getByTestId('response').filter({ hasText: noName });
    assert.equal((await noRow.getByTestId('response-status').innerText()).trim(), 'Не придёт');
    await page.getByRole('button', { name: /^Придут/ }).click();
    assert.equal(await page.getByTestId('response').filter({ hasText: noName }).count(), 0);
    await page.getByRole('button', { name: /^Не придут/ }).click();
    assert.equal(await page.getByTestId('response').filter({ hasText: yesName }).count(), 0);
    await page.getByRole('button', { name: /^Все/ }).click();
    await page.getByLabel('Поиск ответов').fill(String(stamp));
    assert.equal(await page.getByTestId('response').count(), 2);
    await page.getByLabel('Поиск ответов').fill('');
    assert.equal(await page.getByRole('button', { name: /WhatsApp|Копировать/ }).count(), 0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin-responses.png`, fullPage: true });
  });

  await step('Scenario 6: statistics updated (unanswered are not counted as declined)', async () => {
    await page.getByRole('tab', { name: /Статистика/ }).click();
    assert.equal(await statVal('Всего приглашений'), before['Всего приглашений'] + 2);
    assert.equal(await statVal('Ответили'), before['Ответили'] + 2);
    assert.equal(await statVal('Придут (семей)'), before['Придут (семей)'] + 1);
    assert.equal(await statVal('Отказались'), before['Отказались'] + 1);
    assert.equal(await statVal('Людей придёт'), before['Людей придёт'] + 2);
    // only two outcomes exist: no "unanswered" figures anywhere in the statistics UI
    const statsText = await page.locator('main').innerText();
    assert.ok(!/не ответили|нет ответа|без ответа/i.test(statsText), 'no unanswered metrics in statistics');
    // the split is computed between answers only
    const yes = await statVal('Придут (семей)');
    const no = await statVal('Отказались');
    const split = await page.getByTestId('answer-split').innerText();
    const pct = Math.round((yes / (yes + no)) * 100);
    assert.ok(split.includes(`${pct}%`) && split.includes(`${100 - pct}%`), `split ${pct}/${100 - pct}: ${split}`);
    assert.ok(split.includes(`Ответили ${yes + no}`), split);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin-stats.png`, fullPage: true });
  });

  await step('Scenario 7: "Посмотреть" preview does not count as a guest visit', async () => {
    const views = await statVal('Просмотры сайта');
    const pv = await ctx.newPage();
    await pv.goto(created[noName] + '&preview=1&quality=lite');
    await pv.waitForTimeout(1500);
    await pv.close();
    await page.getByRole('button', { name: 'Обновить' }).click();
    await page.waitForTimeout(500);
    assert.equal(await statVal('Просмотры сайта'), views);
  });

  await step('Admin: rename, search and delete only our temporary invitations', async () => {
    await page.getByRole('tab', { name: /Приглашения/ }).click();
    await page.getByLabel('Поиск приглашений').fill(String(stamp));
    assert.equal(await page.getByTestId('invite').count(), 2);
    const card = page.getByTestId('invite').filter({ hasText: noName });
    await card.getByRole('button', { name: 'Изменить' }).click();
    await page.getByLabel('Новое имя').fill(noName + ' 2');
    await page.getByRole('button', { name: 'OK' }).click();
    await page.getByTestId('invite-name').filter({ hasText: noName + ' 2' }).waitFor();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin-invitations.png`, fullPage: true });
    for (const n of [yesName, noName + ' 2']) {
      await page.getByTestId('invite').filter({ hasText: n }).getByRole('button', { name: 'Удалить' }).click();
      await page.getByTestId('invite-name').filter({ hasText: n }).waitFor({ state: 'detached' });
    }
    await page.getByLabel('Поиск приглашений').fill('');
  });

  await step('Admin: CSV export downloads', async () => {
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
