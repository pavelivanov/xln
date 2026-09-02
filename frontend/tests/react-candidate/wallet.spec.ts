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

test('address directory reads the isolated wallet Runtime', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/address', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for /address').toBe(true);
  const directory = page.getByTestId('wallet-address-directory');
  await expect(directory).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Address directory' })).toBeVisible();
  await expect(page.getByText(/profiles$/)).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-address-directory');
  expectNoBrowserErrors(errors);
});

test('address detail surfaces a missing valid Entity without browser errors', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const missingEntityId = `0x${'f'.repeat(64)}`;
  const response = await page.goto(`/address/${missingEntityId}`, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for /address/:entityId').toBe(true);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Entity not found in runtime projection.', { timeout: 90_000 });
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-address-not-found');
  expectNoBrowserErrors(errors);
});
