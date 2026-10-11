import { test, expect } from '@playwright/test';

test('mobile catalog plans custom positions for both partners and installs a real service worker', async ({ browser }) => {
  const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await first.newPage(); const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const created = await first.request.post('/api/pairs', { data: { name: 'А', relationshipMode: 'couple' } });
    await second.request.post('/api/join', { data: { name: 'Б', invite: (await created.json()).invite } });
    await page.goto('/');
    const manifestResponse = await page.request.get('/manifest.webmanifest');
    expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
    const manifest = await manifestResponse.json(); expect(manifest.display).toBe('standalone'); expect(manifest.icons).toHaveLength(2);
    for (const icon of manifest.icons) expect((await page.request.get(icon.src)).headers()['content-type']).toBe('image/png');
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active);
    await page.getByRole('button', { name: 'Секс', exact: true }).click();
    await expect(page.locator('.catalog-category')).toHaveCount(8); await expect(page.locator('.sex-preset')).toHaveCount(8);
    await page.getByLabel('Поиск настроений и вариантов').fill('свет');
    await page.getByRole('button', { name: 'Приглушённый свет', exact: true }).click();
    await page.getByLabel('Поиск настроений и вариантов').fill('массаж');
    await page.getByRole('button', { name: 'Нежность и массаж', exact: true }).click();
    await expect(page.locator('.catalog-selection')).toContainText('2/24');
    await page.getByRole('button', { name: 'Запланировать с этим набором' }).click();
    await page.getByLabel('Название', { exact: true }).fill('Наш новый план');
    await page.getByLabel('Свой вариант', { exact: true }).fill('Наша традиция'); await page.getByRole('button', { name: 'Добавить свой вариант', exact: true }).click();
    await page.locator('.positions-options summary').click();
    await page.getByLabel('Название позы').fill('Условное название A'); await page.getByRole('button', { name: 'Добавить позу', exact: true }).click();
    await page.getByLabel('Название позы').fill('Условное название B');
    await page.screenshot({ path: 'test-results/sex-plan-mobile.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Добавить план секса', exact: true }).click();
    const shared = await (await second.request.get('/api/session')).json();
    const event = shared.events.find((item: { title: string }) => item.title === 'Наш новый план');
    expect(event.positions).toEqual(['Условное название A', 'Условное название B']);
    expect(event.tags).toEqual(['Приглушённый свет', 'Нежность и массаж', 'Наша традиция']);
    await page.locator('.calendar-event', { hasText: 'Наш новый план' }).click();
    await expect(page.locator('.detail-positions')).toContainText('Условное название B');
    await page.getByRole('button', { name: 'Изменить', exact: true }).click();
    await page.locator('.positions-options summary').click();
    await expect(page.getByRole('group', { name: 'Тип встречи' }).getByRole('button', { name: 'Секс' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[aria-label="Выбранные позы"]')).toContainText('Условное название A');
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.getByRole('button', { name: 'Секс', exact: true }).click();
    await page.getByRole('button', { name: 'Собрать случайное настроение' }).click();
    await expect(page.locator('.catalog-selection')).toContainText('3/24');
    await page.getByRole('button', { name: 'Запланировать с этим набором' }).click();
    await page.locator('.positions-options summary').click();
    await expect(page.getByRole('button', { name: 'Условное название A', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.screenshot({ path: 'test-results/sex-catalog-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 320, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Приложение и уведомления', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('после публикации серверной версии по HTTPS');
    expect(errors).toEqual([]);
  } finally { await first.close(); await second.close(); }
});

test('push permission is requested only on click; device can subscribe, test and unsubscribe', async ({ page }) => {
  await page.request.post('/api/pairs', { data: { name: 'Подключение пушей' } });
  await page.addInitScript(() => {
    const calls: string[] = []; (window as any).__pushCalls = calls;
    let subscription: any = null;
    const worker = { pushManager: {
      async getSubscription() { return subscription; },
      async subscribe() {
        calls.push('subscribe');
        subscription = { endpoint: 'https://web.push.apple.com/browser-test', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'test-key', auth: 'test-auth' } }; }, async unsubscribe() { calls.push('unsubscribe'); subscription = null; return true; } };
        return subscription;
      },
    } };
    Object.defineProperty(navigator.serviceWorker, 'register', { value: async () => worker });
    Object.defineProperty(navigator.serviceWorker, 'ready', { value: Promise.resolve(worker) });
    Object.defineProperty(window, 'Notification', { value: { async requestPermission() { calls.push('permission'); return 'granted'; } } });
  });
  await page.route('**/api/push/config', route => route.fulfill({ json: { enabled: true, publicKey: 'AQID' } }));
  const methods: string[] = [];
  await page.route('**/api/push/subscriptions', route => { methods.push(route.request().method()); return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/push/test', route => route.fulfill({ json: { sent: 1, failed: 0 } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Приложение и уведомления', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Включить уведомления', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__pushCalls)).toEqual([]);
  await page.getByRole('button', { name: 'Включить уведомления', exact: true }).click();
  await expect(page.getByText('Подключены на этом устройстве', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__pushCalls)).toEqual(['permission', 'subscribe']);
  await page.getByRole('button', { name: 'Отправить тест', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Тест отправлен');
  await page.getByRole('button', { name: 'Отключить на этом устройстве', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Включить уведомления', exact: true })).toBeVisible();
  expect(methods).toEqual(['POST', 'DELETE']);
  expect(await page.evaluate(() => (window as any).__pushCalls)).toEqual(['permission', 'subscribe', 'unsubscribe']);
});

test('iPhone Safari explains Home Screen installation before offering push permission', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' });
  try {
    await context.request.post('/api/pairs', { data: { name: 'Safari' } }); const page = await context.newPage();
    await page.route('**/api/push/config', route => route.fulfill({ json: { enabled: true, publicKey: 'AQID' } }));
    await page.goto('/'); await page.getByRole('button', { name: 'Приложение и уведомления', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('iOS 16.4');
    await expect(page.getByRole('dialog')).toContainText('На экран Домой');
    await expect(page.getByRole('button', { name: 'Включить уведомления', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
