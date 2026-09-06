import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';

test('wallet navigation consumes the retained workspace locale through navigation and reload', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('xln-locale')) localStorage.setItem('xln-locale', 'ru');
  });
  await page.goto('/app?setup=1');
  const navigation = page.getByRole('navigation', { name: 'Wallet navigation', exact: true });
  await expect(navigation.getByRole('link', { name: 'Идентификация', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(navigation.getByRole('link', { name: 'Активы', exact: true })).toHaveAttribute('href', '/app?portfolio=1');
  await navigation.getByRole('link', { name: 'Обзор', exact: true }).click();
  await expect(navigation.getByRole('link', { name: 'Обзор', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(navigation.getByRole('link', { name: 'Обзор', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await screenshotEvidence(page, testInfo, 'wallet-locale-russian-navigation');
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});
