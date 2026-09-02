import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

test('wallet candidate renders without browser errors', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/testnet', { waitUntil: 'networkidle' });
  expect(response?.ok(), 'document response for /testnet').toBe(true);
  await expect(page.getByRole('heading', { name: 'xln Testnet' })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet');
  expectNoBrowserErrors(errors);
});

test('wallet app renders within the isolated wallet surface', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/app', { waitUntil: 'networkidle' });
  expect(response?.ok(), 'document response for /app').toBe(true);
  await expect(page.getByRole('heading', { name: 'Wallet overview' })).toBeVisible();
  await expect(page.getByLabel('Current Runtime status')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-app');
  expectNoBrowserErrors(errors);
});
