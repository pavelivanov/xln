import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../browser-evidence';

test('wallet navigation consumes the retained workspace locale through navigation and reload', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('xln-locale')) localStorage.setItem('xln-locale', 'ru');
  });
  await page.goto('/app?setup=1');
  const navigation = page.getByRole('navigation', { name: 'Wallet navigation', exact: true });
  await expect(navigation.getByRole('link', { name: '\u0418\u0434\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(navigation.getByRole('link', { name: '\u0410\u043a\u0442\u0438\u0432\u044b', exact: true })).toHaveAttribute('href', '/app?portfolio=1');
  await navigation.getByRole('link', { name: '\u041e\u0431\u0437\u043e\u0440', exact: true }).click();
  await expect(navigation.getByRole('link', { name: '\u041e\u0431\u0437\u043e\u0440', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(navigation.getByRole('link', { name: '\u041e\u0431\u0437\u043e\u0440', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.goto('/app#settings/display');
  await expect(page.getByRole('heading', { name: '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438', exact: true })).toBeVisible();
  const theme = page.getByLabel('\u0422\u0435\u043c\u0430', { exact: true });
  await expect(theme.locator('option')).toHaveText(['\u0422\u0451\u043c\u043d\u0430\u044f', 'Editor', '\u0421\u0432\u0435\u0442\u043b\u0430\u044f', 'Merchant', 'Gold Luxe', 'Matrix', 'Arctic']);
  await theme.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.getByLabel('\u0422\u0435\u043c\u0430', { exact: true })).toHaveValue('light');
  await screenshotEvidence(page, testInfo, 'wallet-locale-russian-navigation');
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});
