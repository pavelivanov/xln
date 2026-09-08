import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import { readWalletAccountToolState, readWalletFixtureChainBalances, selectWalletFixtureRuntime } from '../fixtures/wallet-runtime-test-helpers';

test('Move broadcasts its reviewed collateral draft and observes exact Runtime and chain balances', { tag: '@functional' }, async ({ page }, testInfo) => {
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

test('Manage commits the exact collateral request and prepaid peer fee on both Account sides', { tag: '@functional' }, async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const errors = observeBrowserErrors(page), fixture = await selectWalletFixtureRuntime(page);
    // Each request is driven to chain finality, so all viewports can prove the
    // canonical funded USDC path without leaving a pending request behind.
    const tokenId = 1;
  await page.goto('/app#accounts/configure');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.getByLabel('Account', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await page.getByLabel('Asset', { exact: true }).selectOption(String(tokenId));
  await page.getByLabel('Credit amount', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Extend Credit', exact: true }).last().click();
  await expect(page.getByLabel('Entity', { exact: true })).toBeEnabled();
  await page.goto('/app?payments=1');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible({ timeout: 90_000 });
    await page.getByLabel('Entity', { exact: true }).selectOption(fixture.counterpartyEntityId);
    const recipient = page.getByLabel('Recipient', { exact: true });
    await expect(recipient.locator('option')).toContainText('Browser Alice');
    await recipient.selectOption({ label: 'Browser Alice' });
    await expect(recipient.locator('option:checked')).toHaveText('Browser Alice');
    await page.getByLabel('Asset').first().selectOption(String(tokenId));
    await page.getByLabel('Recipient amount').fill('25');
    await page.locator('.wallet-payment-modes label').filter({ hasText: 'Direct' }).click();
    await page.getByRole('button', { name: 'Find route' }).click();
    await expect(page.getByRole('button', { name: 'Submit quoted payment' })).toBeEnabled();
    await page.getByRole('button', { name: 'Submit quoted payment' }).click();
    await expect
      .poll(async () =>
        BigInt(
          String(
            (await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId, tokenId))[
              'outPeerCredit'
            ],
          ),
        ),
      )
      .toBeGreaterThan(10_000_000n);
  await page.goto('/app#accounts/configure');
    await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    await page.getByLabel('Account', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await page.getByTestId('configure-tab-collateral').click();
  await page.getByLabel('Asset', { exact: true }).selectOption(String(tokenId));
  const before = await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId, tokenId);
    const hubBefore = await readWalletAccountToolState(page, fixture.counterpartyEntityId, fixture.entityId, tokenId);
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
    const expectedCollateral = BigInt(String(before['collateral'])) + BigInt(expected.amount);
    const expectedHubReserve = BigInt(String(hubBefore['reserve'])) - BigInt(expected.amount);
    await expect
      .poll(
        async () => {
          const user = await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId, tokenId);
          const hub = await readWalletAccountToolState(page, fixture.counterpartyEntityId, fixture.entityId, tokenId);
          if (user['collateralRequest'] === null && hub['collateralRequest'] === null) return 'complete';
          return JSON.stringify({ user, hub });
        },
        { timeout: 15000 },
      )
      .toBe('complete');
    const completed = await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId, tokenId);
    const hubCompleted = await readWalletAccountToolState(
      page,
      fixture.counterpartyEntityId,
      fixture.entityId,
      tokenId,
    );
    expect(completed).toMatchObject({
      collateral: expectedCollateral.toString(),
      chainCollateral: expectedCollateral.toString(),
    });
    expect(hubCompleted).toMatchObject({
      reserve: expectedHubReserve.toString(),
      chainReserve: expectedHubReserve.toString(),
    });
    expect(Number(completed['lastFinalizedJHeight'])).toBeGreaterThan(Number(before['lastFinalizedJHeight']));
    expect(Number(hubCompleted['lastFinalizedJHeight'])).toBe(Number(completed['lastFinalizedJHeight']));
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'manage-collateral-finalized');
  expectNoBrowserErrors(errors);
});
