import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('standalone preview works without API, assets or hosting', async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && request.url() !== 'http://127.0.0.1:3200/') external.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Время для нас' })).toBeVisible();
  await page.getByRole('button', { name: 'О демо', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('В этой вкладке');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Запланировать свидание', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Проверяем нашу страницу');
  await page.getByRole('button', { name: 'Добавить свидание', exact: true }).click();
  await expect(page.locator('.calendar-event', { hasText: 'Проверяем нашу страницу' })).toBeVisible();
  await page.locator('.calendar-event', { hasText: 'Проверяем нашу страницу' }).click();
  await page.getByRole('textbox', { name: 'Личная заметка', exact: true }).fill('Тестовая заметка в памяти');
  await page.getByRole('button', { name: 'Сохранить личную заметку', exact: true }).click();
  await page.getByRole('button', { name: 'Встреча состоялась', exact: true }).click();
  await page.getByRole('button', { name: 'Наша история', exact: true }).click();
  await expect(page.locator('.history-event', { hasText: 'Проверяем нашу страницу' })).toBeVisible();
  await page.getByRole('button', { name: 'Идеи для свиданий', exact: true }).click();
  await expect(page.locator('.idea-card')).toHaveCount(6);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('preview script survives the GitHub HTML Preview tag rewriting', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const html = readFileSync('docs/index.html', 'utf8');
  const transformed = html.replace(/<script(\s*src=["'][^"']*["'])?(\s*type=["'](text|application)\/javascript["'])?/gi, '<script type="text/htmlpreview"$1');
  await page.route('http://127.0.0.1:3200/renderer', route => route.fulfill({ status: 200, contentType: 'text/html', body: transformed }));
  await page.goto('/renderer');
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('script[type="text/htmlpreview"]')) {
      const script = document.createElement('script');
      script.textContent = element.textContent;
      document.body.appendChild(script);
    }
  });
  await expect(page.getByRole('heading', { name: 'Время для нас' })).toBeVisible();
  await page.getByRole('button', { name: 'Идеи для свиданий', exact: true }).click();
  await expect(page.locator('.idea-card')).toHaveCount(6);
  expect(errors).toEqual([]);
});
