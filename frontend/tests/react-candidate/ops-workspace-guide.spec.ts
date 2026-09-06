import { openWorkspaceStorageOrigin } from './browser-evidence';
import { expect, test } from '@playwright/test';
import { readWalletRuntimeFixture } from './wallet-runtime-test-helpers';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';

test('workspace language and guide retain preferences, keyboard placement and focus', { tag: '@functional' }, async ({ page }, testInfo) => {
  await readWalletRuntimeFixture(page);
  const errors = observeBrowserErrors(page);
  await openWorkspaceStorageOrigin(page);
  await page.evaluate(() => localStorage.setItem('xln-settings', JSON.stringify({ showXlnMascot: true, unrelatedPreference: 'preserve-me' })));
  await page.goto('/__app/ops/entity-workspace');
  const locale = page.locator('.ops-locale-selector select');
  await expect(locale.locator('option')).toHaveCount(10);
  await locale.selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(locale.locator('..')).toContainText('Язык');
  await page.reload();
  await expect(locale).toHaveValue('ru');
  const guide = page.getByTestId('xln-mascot-toggle');
  await guide.focus();
  await guide.press('Shift+ArrowLeft');
  await expect.poll(() => guide.evaluate(element => Math.round(element.getBoundingClientRect().left))).toBe(12);
  await guide.press('ArrowUp');
  // StrictMode cancels its first catalog subscription; inspect a completed request.
  const catalogRequest = page.waitForEvent('requestfinished', { predicate: request => new URL(request.url()).pathname === '/api/assistant/models' });
  await guide.press('Enter');
  const catalog = await (await catalogRequest).response();
  if (!catalog) throw new Error('ASSISTANT_CATALOG_RESPONSE_MISSING');
  expect(catalog.status()).toBe(200);
  expect(catalog.headers()['content-type']).toContain('application/json');
  expect((await catalog.json()).provider).toBe('local');
  const chat = page.getByTestId('xln-mascot-chat');
  await expect(chat).toBeVisible();
  await expect(chat.getByLabel('Ask xln', { exact: true })).toBeFocused();
  await expect(chat.getByRole('button', { name: 'Retry local AI' })).toBeEnabled();
  // Exercise the actual assistant proxy. Offline responses stay visible and do
  // not get replaced with a fabricated catalog or assistant response.
  const offline = await chat.getByText('Local AI offline', { exact: true }).count();
  if (offline) {
    await expect(chat.getByRole('alert')).toBeVisible();
    await expect(chat.getByRole('button', { name: 'Send question' })).toBeDisabled();
    await expect(chat.getByRole('link', { name: 'Open local AI' })).toHaveAttribute('href', '/ai');
  } else await expect(chat.getByText('Local AI · public docs', { exact: true })).toBeVisible();
  await screenshotEvidence(page, testInfo, 'ops-guide-open');
  await chat.getByLabel('Ask xln', { exact: true }).press('Escape');
  await expect(chat).toHaveCount(0);
  await expect(guide).toBeFocused();
  await page.reload();
  await expect.poll(() => guide.evaluate(element => Math.round(element.getBoundingClientRect().left))).toBe(12);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('xln-settings') || '{}').unrelatedPreference)).toBe('preserve-me');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-guide-docked');
  expectNoBrowserErrors(errors);
});
