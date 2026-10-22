import { test, expect } from '@playwright/test';

test('Cloudflare serves mobile app and partners synchronize through polling', async ({ browser, baseURL }) => {
  const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const alice = await first.newPage(), mark = await second.newPage();
  const errors: string[] = [];
  alice.on('pageerror', error => errors.push(error.message)); mark.on('pageerror', error => errors.push(error.message));
  try {
    await alice.goto(baseURL!);
    await alice.getByRole('button', { name: 'Создать пару', exact: true }).click();
    await alice.getByLabel('Как вас зовут?').fill('Алиса');
    await alice.getByRole('button', { name: 'Создать общий календарь', exact: true }).click();
    const invite = await alice.getByRole('textbox', { name: 'Ссылка-приглашение' }).inputValue();
    await alice.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await mark.goto(invite);
    await mark.getByLabel('Как вас зовут?').fill('Марк');
    await mark.getByRole('button', { name: 'Присоединиться', exact: true }).click();
    await expect(mark.getByRole('dialog')).not.toBeVisible();
    await expect(alice.getByRole('button', { name: 'Наша пара', exact: true })).toBeVisible({ timeout: 20000 });
    await alice.getByRole('button', { name: 'Запланировать свидание', exact: true }).click();
    await alice.getByLabel('Название', { exact: true }).fill('Работающий общий календарь');
    await alice.getByRole('button', { name: 'Добавить свидание', exact: true }).click();
    await expect(mark.locator('.calendar-event', { hasText: 'Работающий общий календарь' })).toBeVisible({ timeout: 20000 });
    await mark.reload();
    await expect(mark.locator('.calendar-event', { hasText: 'Работающий общий календарь' })).toBeVisible();
    expect(await mark.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await first.close(); await second.close(); }
});
