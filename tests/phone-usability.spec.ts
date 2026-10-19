import { test, expect } from '@playwright/test';

test('phone home exposes quick entry, large text and a compact calendar without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Основная навигация' });
  await expect(nav.getByRole('button')).toHaveCount(5);
  await expect(page.locator('.phone-week .phone-day')).toHaveCount(7);
  const facts = page.locator('.home-quick-actions').getByRole('button', { name: 'Добавить факт', exact: true });
  expect(await facts.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThan(650);
  expect(await nav.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844);
  expect(await page.locator('.phone-event .event-title').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await page.getByRole('button', { name: 'Месяц', exact: true }).click();
  expect(await page.locator('.phone-week .phone-day').count()).toBeGreaterThan(27);
  await page.getByRole('button', { name: 'Неделя', exact: true }).click();
  await expect(page.locator('.phone-week .phone-day')).toHaveCount(7);
  await facts.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Название', { exact: true })).toHaveCount(0);
  await page.getByLabel('Тип секса', { exact: true }).selectOption('oral');
  const submit = page.getByRole('button', { name: 'Добавить факт секса', exact: true });
  expect(await submit.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'test-results/phone-quick-entry.png' });
  await submit.click();
  await expect(page.locator('.phone-event', { hasText: 'Оральный секс' })).toBeVisible();
  await page.screenshot({ path: 'test-results/phone-home.png' });
});

test('global add works from history and the selected mood action stays on screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Наша история', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить запись', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Что добавим?');
  await page.getByRole('button', { name: /Запланировать секс Дата и тип/ }).click();
  await expect(page.getByLabel('Тип секса', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: '18+', exact: true }).click();
  await page.getByLabel('Поиск настроений и вариантов').fill('Свечи');
  await page.getByRole('button', { name: 'Свечи', exact: true }).click();
  const plan = page.getByRole('button', { name: 'Запланировать с этим набором', exact: true });
  const bounds = await plan.boundingBox();
  expect(bounds).not.toBeNull(); expect(bounds!.y + bounds!.height).toBeLessThan(766);
  await plan.click();
  await page.locator('.sex-extras > summary').click();
  await expect(page.locator('[aria-label="Выбранные варианты"]')).toContainText('Свечи');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('date search and horizontal page steps avoid scrolling past the editor menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Идеи для свиданий', exact: true }).click();
  await page.getByLabel('Найти атмосферу свидания').fill('Город не спит');
  await expect(page.locator('.atmosphere-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Настроить свидание', exact: true }).click();
  await expect(page.getByLabel('Название свидания', { exact: true })).toBeInViewport();
  expect(await page.locator('.scenario-page-list').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Отправить приглашение', exact: true })).toBeInViewport();
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeHidden();
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.start-page').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'К атмосферам', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/phone-editor.png' });
  await page.getByRole('button', { name: 'К атмосферам', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
});
