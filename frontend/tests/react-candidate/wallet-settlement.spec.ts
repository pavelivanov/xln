import { expect, test, type Page } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';
import { selectWalletFixtureRuntime } from './wallet-runtime-test-helpers';

const balances = async (page: Page) => {
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.get(`http://127.0.0.1:${port}/chain-balances`);
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('WALLET_CHAIN_BALANCES_INVALID');
  const record = result as Record<string, unknown>;
  const amount = (key: string): bigint => {
    const raw = record[key];
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new Error(`WALLET_CHAIN_BALANCE_INVALID:${key}`);
    return BigInt(raw);
  };
  return { reserve: amount('reserve'), collateral: amount('collateral'), chainReserve: amount('chainReserve'), chainCollateral: amount('chainCollateral') };
};

test('wallet funds collateral through reviewed batch broadcast and real chain finality', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  const before = await balances(page);
  await page.goto('/app?payments=1&paymentTool=operations');
  await expect(page.getByRole('heading', { name: 'Account operations' })).toBeVisible({ timeout: 90_000 });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.getByRole('radio', { name: /Fund collateral/ }).click();
  await page.getByRole('combobox', { name: 'Counterparty Account' }).selectOption(fixture.counterpartyEntityId);
  await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('50');
  await page.getByRole('button', { name: 'Queue collateral funding' }).click();
  const batch = page.getByRole('region', { name: 'Jurisdiction batch' });
  await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible({ timeout: 30_000 });
  await batch.locator('summary').filter({ hasText: 'Fund collateral' }).click();
  await expect(batch.locator('pre')).toContainText('50000000');
  await expect(batch.getByRole('button', { name: 'Broadcast draft' })).toBeEnabled();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-collateral-draft-review');
  await batch.getByRole('button', { name: 'Broadcast draft' }).click();
  await expect.poll(async () => balances(page), { timeout: 45_000 }).toEqual({
    reserve: before.reserve - 50_000_000n,
    collateral: before.collateral + 50_000_000n,
    chainReserve: before.chainReserve - 50_000_000n,
    chainCollateral: before.chainCollateral + 50_000_000n,
  });
  await expect(batch.getByText('No queued operations.')).toBeVisible({ timeout: 30_000 });
  await expect(batch.getByRole('button', { name: 'Broadcast draft' })).toBeDisabled();
  await page.getByRole('radio', { name: /Withdraw collateral/ }).click();
  await expect(page.getByText(/Available to withdraw:/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('9999');
  await page.getByRole('button', { name: 'Propose settlement' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'WALLET_OPERATION_COLLATERAL_EXCEEDED' })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-collateral-boundary');
  expectNoBrowserErrors(errors);
});

test('wallet clears only after confirmation and leaves chain balances unchanged', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  const before = await balances(page);
  await page.goto('/app?payments=1&paymentTool=operations');
  await expect(page.getByRole('heading', { name: 'Account operations' })).toBeVisible({ timeout: 90_000 });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.getByRole('combobox', { name: 'Recipient', exact: true }).selectOption(fixture.counterpartyEntityId);
  await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('1');
  await page.getByRole('button', { name: 'Queue reserve transfer' }).click();
  const batch = page.getByRole('region', { name: 'Jurisdiction batch' });
  await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible({ timeout: 30_000 });
  await expect(batch.locator('summary')).toContainText('1.0 USDC');
  page.once('dialog', (dialog) => dialog.dismiss());
  await batch.getByRole('button', { name: 'Clear batch' }).click();
  await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await batch.getByRole('button', { name: 'Clear batch' }).click();
  await expect(batch.getByText('No queued operations.')).toBeVisible({ timeout: 30_000 });
  expect(await balances(page)).toEqual(before);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-batch-cleared');
  expectNoBrowserErrors(errors);
});
