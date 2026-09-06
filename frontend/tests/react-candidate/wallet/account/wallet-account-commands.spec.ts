import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import { readWalletAccountToolState, readWalletFixtureChainBalances, selectWalletFixtureRuntime } from '../fixtures/wallet-runtime-test-helpers';

test('Move broadcasts its reviewed collateral draft and observes exact Runtime and chain balances', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const errors = observeBrowserErrors(page), fixture = await selectWalletFixtureRuntime(page);
  const before = await readWalletFixtureChainBalances(page);
  await page.goto('/app#accounts/move');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.getByTestId('move-source-reserve').click();
  await page.getByTestId('move-target-account').click();
  await page.getByLabel('Asset', { exact: true }).selectOption('1');
  await page.getByLabel('Amount', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Add to Batch', exact: true }).click();
  const batch = page.getByRole('region', { name: 'Jurisdiction batch' });
  await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible();
  await batch.locator('summary').filter({ hasText: 'Fund collateral' }).click();
  await expect(batch.locator('pre')).toContainText('10000000');
  await expect(batch.locator('pre')).toContainText(fixture.counterpartyEntityId);
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'move-collateral-broadcast-review');
  await batch.getByRole('button', { name: 'Broadcast draft' }).click();
  await expect.poll(() => readWalletFixtureChainBalances(page), { timeout: 45000 }).toEqual({
    reserve: before.reserve - 10000000n, collateral: before.collateral + 10000000n,
    chainReserve: before.chainReserve - 10000000n, chainCollateral: before.chainCollateral + 10000000n,
  });
  await expect(batch.getByText('No queued operations.')).toBeVisible();
  await expect(batch.getByRole('button', { name: 'Broadcast draft' })).toBeDisabled();
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'move-collateral-chain-finality');
  expectNoBrowserErrors(errors);
});

test('Manage commits the exact collateral request and prepaid peer fee on both Account sides', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const errors = observeBrowserErrors(page), fixture = await selectWalletFixtureRuntime(page);
  // Distinct default assets keep requests independent when all viewports share
  // the isolated Runtime. Every request must be new, never a pending retry.
  const tokenId = testInfo.project.name === 'mobile-390x844' ? 2 : testInfo.project.name === 'wide-1920x1080' ? 3 : 1;
  await page.goto('/app#accounts/configure');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await page.getByLabel('Account', { exact: true }).selectOption(fixture.entityId);
  await page.getByLabel('Asset', { exact: true }).selectOption(String(tokenId));
  await page.getByLabel('Credit amount', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Extend Credit', exact: true }).last().click();
  await expect(page.getByLabel('Entity', { exact: true })).toBeEnabled();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.getByLabel('Account', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await page.getByTestId('configure-tab-collateral').click();
  await page.getByLabel('Asset', { exact: true }).selectOption(String(tokenId));
  const before = await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId, tokenId);
  expect(before['collateralRequest']).toBeNull();
  const decimals = before['tokenDecimals'];
  if (typeof decimals !== 'number' || !Number.isSafeInteger(decimals)) throw new Error('Expected token decimals');
  const raw = before['peerFeePolicy'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected committed peer fee policy');
  const policy = raw as Record<string, unknown>;
  const gross = 10n * 10n ** BigInt(decimals);
  const fee = BigInt(String(policy['baseFee'])) + BigInt(String(policy['gasFee'])) + gross * BigInt(String(policy['liquidityFeeBps'])) / 10000n;
  expect(fee).toBeGreaterThan(0n); expect(fee).toBeLessThan(gross);
  await page.getByLabel('Collateral amount', { exact: true }).fill('10');
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'manage-collateral-request-review');
  await page.getByRole('button', { name: 'Request Collateral', exact: true }).last().click();
  const expected = { amount: String(gross - fee), feePaid: String(fee), feeTokenId: tokenId, policyVersion: policy['policyVersion'] };
  for (const [owner, peer] of [[fixture.entityId, fixture.counterpartyEntityId], [fixture.counterpartyEntityId, fixture.entityId]]) {
    if (!owner || !peer) throw new Error('Account participant missing');
    await expect.poll(async () => (await readWalletAccountToolState(page, owner, peer, tokenId))['collateralRequest'], { timeout: 20000 }).toEqual(expected);
  }
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'manage-collateral-request-committed');
  expectNoBrowserErrors(errors);
});
