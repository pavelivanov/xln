import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';

test('workspace locale updates controls, retained and new panels, and survives reload without internal layout writes', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await page.goto('/embed');
  await expect(page.locator('.dv-tab')).toHaveCount(14);
  const language = page.locator('.ops-locale-selector select');
  await language.selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('.ops-pinned-tab')).toHaveText('📌 Основной кошелёк');
  await expect(page.getByRole('button', { name: 'Скопировать ссылку на запись', exact: true })).toBeVisible();
  await expect(page.getByLabel('Скорость воспроизведения')).toHaveValue('1');
  await page.getByRole('button', { name: 'Открыть палитру команд', exact: true }).click();
  const palette = page.getByRole('dialog', { name: 'Команды рабочей области' });
  await expect(palette.getByRole('option').first()).toContainText('Оплатить');
  await screenshotEvidence(page, testInfo, 'ops-locale-russian-palette');
  await palette.getByRole('combobox').press('Escape');
  await page.getByLabel('Открыть панель рабочей области', { exact: true }).selectOption('entity-workspace');
  await expect(page.locator('.dv-active-group .dv-tab.dv-active-tab')).toContainText('Сущность');
  await page.getByRole('button', { name: 'Сбросить расположение', exact: true }).click();
  await expect(page.locator('.ops-pinned-tab')).toHaveText('📌 Основной кошелёк');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('xln-locale'))).toBe('ru');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('.ops-pinned-tab')).toHaveText('📌 Основной кошелёк');
  if (testInfo.project.name.startsWith('mobile')) {
    await page.getByRole('button', { name: 'Все панели', exact: true }).click();
    await expect.poll(() => page.locator('.dv-groupview').first().evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(400);
  }
  await screenshotEvidence(page, testInfo, 'ops-locale-russian-restored');
  const saved = await page.evaluate(() => localStorage.getItem('xln-workspace-layout'));
  await page.goto('/__app/ops/entity-workspace');
  await expect(page.getByRole('button', { name: 'Открыть панель «Настройки»', exact: true })).toBeEnabled();
  await language.selectOption('de');
  await page.getByRole('button', { name: 'Panel Einstellungen öffnen', exact: true }).click();
  await expect(page.locator('.dv-active-group .dv-tab.dv-active-tab')).toContainText('Einstellungen');
  expect(await page.evaluate(() => localStorage.getItem('xln-workspace-layout'))).toBe(saved);
  await screenshotEvidence(page, testInfo, 'ops-locale-german-internal');
  await page.goto('/embed');
  await expect(page.locator('.ops-pinned-tab')).toHaveText('📌 Hauptwallet');
  await expect(page.locator('.dv-tab')).toHaveCount(14);
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});
