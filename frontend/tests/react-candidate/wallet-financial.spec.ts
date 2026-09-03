import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';
import { installImportedRuntime, readWalletRuntimeFixture } from './wallet-runtime-test-helpers';

const selectFixtureRuntime = async (page: Parameters<typeof readWalletRuntimeFixture>[0]) => {
  const fixture = await readWalletRuntimeFixture(page);
  await page.goto('/testnet', { waitUntil: 'domcontentloaded' });
  await installImportedRuntime(page, fixture);
  return fixture;
};

test('wallet portfolio renders a real committed bilateral Account', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectFixtureRuntime(page);
  const response = await page.goto('/app?portfolio=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for populated portfolio').toBe(true);

  await expect(page.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible({ timeout: 90_000 });
  const entity = page.getByLabel('Entity');
  await entity.selectOption(fixture.entityId);
  await expect(entity).toHaveValue(fixture.entityId);
  await expect(page.getByRole('table', { name: 'Committed asset positions' })).toBeVisible();
  await expect(page.getByLabel('Accounts', { exact: true }).getByText('Browser Hub')).toBeVisible();
  await expect(page.getByText('USDC').first()).toBeVisible();
  await expect(page.getByText('1 shown · 1 total')).toBeVisible();
  await expect(page.getByText('Peer granted us').first()).toBeVisible();
  await expect(page.getByText('We granted peer').first()).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-portfolio-populated');
  expectNoBrowserErrors(errors);
});

test('wallet financial health renders committed Account and activity evidence', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectFixtureRuntime(page);
  const response = await page.goto('/app?health=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for populated financial health').toBe(true);

  await expect(page.getByRole('heading', { name: 'Financial health' })).toBeVisible({ timeout: 90_000 });
  const entity = page.getByLabel('Entity');
  await entity.selectOption(fixture.entityId);
  await expect(entity).toHaveValue(fixture.entityId);
  await expect(page.getByRole('heading', { name: 'Open debt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Runtime solvency' })).toBeVisible();
  await expect(page.getByText('2 Entities · 2 Account views')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dispute lifecycle' })).toBeVisible();
  await expect(page.getByText('1 Accounts · page 1')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Committed history' })).toBeVisible();
  await expect(page.getByText('Account opened')).toBeVisible();
  await expect(page.getByText('extendCredit').first()).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-financial-health-populated');
  expectNoBrowserErrors(errors);
});
