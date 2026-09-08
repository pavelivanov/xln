import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../browser-evidence';
import { readWalletAccountToolState, readWalletFixtureChainBalances as balances, selectWalletFixtureRuntime } from './fixtures/wallet-runtime-test-helpers';
import { finishOpenedWalletSetup, restoreLocalWallet } from './onboarding/wallet-onboarding-test-helpers';

test('wallet funds collateral through reviewed batch broadcast and real chain finality', { tag: '@functional' }, async ({ page }, testInfo) => {
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
  await page.getByRole('button', { name: 'Review settlement' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'WALLET_OPERATION_COLLATERAL_EXCEEDED' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('10');
  await page.getByRole('button', { name: 'Review settlement' }).click();
  const review = page.getByRole('region', { name: 'Collateral → Reserve' });
  await expect(review).toContainText(fixture.entityId);
  await expect(review).toContainText(fixture.counterpartyEntityId);
  await expect(review).toContainText('10.0 USDC');
  await expect(review).toContainText('10000000 raw');
  await expect(review).toContainText('c2r');
  await expect(review).toContainText('settle-c2r');
  const settlementBeforeCancel = (await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId))['settlement'];
  await review.getByRole('button', { name: 'Cancel review' }).click();
  await expect(review).not.toBeVisible();
  expect((await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId))['settlement']).toEqual(settlementBeforeCancel);

  await page.getByRole('button', { name: 'Review settlement' }).click();
  await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('12');
  await expect(review).not.toBeVisible();
  await page.getByRole('button', { name: 'Review settlement' }).click();
  await expect(review).toContainText('12.0 USDC');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-settlement-proposal-review');
  await review.getByRole('button', { name: 'Submit settlement proposal' }).click();
  await expect.poll(async () => String((await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId))['settlement'] || ''), { timeout: 30_000 })
    .toContain('settle-c2r');
  const settlement = String((await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId))['settlement']);
  expect(settlement).toContain('12000000');
  expect(settlement).toContain('c2r');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-collateral-boundary');
  expectNoBrowserErrors(errors);
});

test('wallet clears only after confirmation and leaves chain balances unchanged', { tag: '@functional' }, async ({ page }, testInfo) => {
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
  await batch.getByRole('button', { name: 'Review clear' }).click();
  const clearReview = batch.getByRole('region', { name: 'Confirm clear batch' });
  await expect(clearReview).toContainText('This removes every operation currently shown in the draft.');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-batch-clear-review');
  await clearReview.getByRole('button', { name: 'Keep batch' }).click();
  await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible();
  await batch.getByRole('button', { name: 'Review clear' }).click();
  await clearReview.getByRole('button', { name: 'Clear exact batch' }).click();
  await expect(batch.getByText('No queued operations.')).toBeVisible({ timeout: 30_000 });
  expect(await balances(page)).toEqual(before);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-batch-cleared');
  expectNoBrowserErrors(errors);
});

test('wallet peer approves, retries, and finalizes the exact local settlement workspace', { tag: '@functional' }, async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const fixture = await restoreLocalWallet(page, 'settlement');
  await finishOpenedWalletSetup(page);
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await page.getByRole('link', { name: 'Payments', exact: true }).click();
  await page.getByRole('button', { name: 'Operations' }).click();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.recovery.entityId);

  const proposals = page.getByRole('region', { name: 'Settlement proposals' });
  const proposal = proposals.locator('.wallet-settlement-proposal').filter({
    hasText: fixture.recovery.settlement.counterpartyEntityId,
  });
  await expect(proposal).toContainText('awaiting counterparty');
  await expect(proposal).toContainText(fixture.recovery.settlement.workspaceHash);
  await expect(proposal).toContainText('Forgive · token 1');
  await proposal.getByRole('button', { name: 'Review peer approval' }).click();

  const review = proposals.getByRole('region', { name: 'Approve revision 1' });
  await expect(review).toContainText(fixture.recovery.entityId);
  await expect(review).toContainText(fixture.recovery.settlement.counterpartyEntityId);
  await expect(review).toContainText(fixture.recovery.settlement.workspaceHash);
  await expect(review).toContainText('manual-peer-review');
  await expect(review).toContainText('Forgive · token 1');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-settlement-peer-approval-review');

  await review.getByRole('button', { name: 'Cancel approval review' }).click();
  await expect(review).not.toBeVisible();
  await expect(proposal).toContainText('awaiting counterparty');
  await proposal.getByRole('button', { name: 'Review peer approval' }).click();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.settlement.counterpartyEntityId);
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.recovery.settlement.counterpartyEntityId);
  await expect(review).not.toBeVisible();
  await expect(proposals.getByRole('button', { name: 'Review peer approval' })).toHaveCount(0);

  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.recovery.entityId);
  await expect(proposal).toBeVisible({ timeout: 30_000 });
  await proposal.getByRole('button', { name: 'Review peer approval' }).click();
  await review.getByRole('button', { name: 'Approve exact proposal' }).click();
  await expect(proposal).toContainText('ready to submit', { timeout: 30_000 });
  await expect(proposal.getByRole('button', { name: 'Awaiting designated executor' })).toBeDisabled();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-settlement-peer-approved');

  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.settlement.counterpartyEntityId);
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.recovery.settlement.counterpartyEntityId);
  const executorProposal = proposals.locator('.wallet-settlement-proposal').filter({ hasText: fixture.recovery.entityId });
  const batch = page.getByRole('region', { name: 'Jurisdiction batch' });
  await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible({ timeout: 30_000 });
  await expect(batch.locator('summary')).toContainText('Bilateral settlement');
  await batch.locator('summary').click();
  await expect(batch.locator('pre')).toContainText(fixture.recovery.entityId);
  await expect(batch.locator('pre')).toContainText(fixture.recovery.settlement.counterpartyEntityId);
  await expect(executorProposal).toContainText('submitted');
  await expect(executorProposal.getByRole('button', { name: 'Submitted to jurisdiction batch' })).toBeDisabled();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-settlement-executor-draft');

  const fixtureControlBase = fixture.wsUrl.replace(/^ws:/u, 'http:').replace(/\/rpc$/u, '');
  const offline = await page.request.post(`${fixtureControlBase}/recovery-rpc-mode?online=0`);
  expect(offline.ok()).toBe(true);
  await batch.getByRole('button', { name: 'Broadcast draft' }).click();
  await expect(batch.getByRole('heading', { name: 'Submission needs retry' })).toBeVisible({ timeout: 30_000 });
  await expect(batch.getByText('The exact signed batch is preserved for rebroadcast.', { exact: false })).toBeVisible();
  await expect(batch.getByText('Failure detail')).toBeVisible();
  await expect(batch.locator('.wallet-batch-failure')).toContainText('503');
  await expect(batch.getByRole('button', { name: 'Rebroadcast sent batch' })).toBeVisible();
  await batch.getByRole('button', { name: 'Review clear' }).click();
  const sentClearReview = batch.getByRole('region', { name: 'Confirm clear batch' });
  await expect(sentClearReview).toContainText('A transaction already on-chain may still finalize.');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await expect(sentClearReview).not.toBeVisible();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.settlement.counterpartyEntityId);
  await expect(batch.getByRole('heading', { name: 'Submission needs retry' })).toBeVisible({ timeout: 30_000 });
  await expect(sentClearReview).not.toBeVisible();
  await batch.getByRole('button', { name: 'Review clear' }).click();
  await sentClearReview.getByRole('button', { name: 'Keep batch' }).click();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-settlement-batch-retry');
  const online = await page.request.post(`${fixtureControlBase}/recovery-rpc-mode?online=1`);
  expect(online.ok()).toBe(true);
  await batch.getByRole('button', { name: 'Rebroadcast sent batch' }).click();
  await expect(batch.getByRole('heading', { name: 'Batch confirmed' })).toBeVisible({ timeout: 45_000 });
  await expect(batch.getByText('Chain finality removed the batch from the pending queue.')).toBeVisible();
  await expect(batch.getByText('No queued operations.')).toBeVisible();
  await expect(proposals).not.toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-settlement-batch-confirmed');

  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.settlement.counterpartyEntityId);
  await expect(batch.getByRole('heading', { name: 'Batch confirmed' })).not.toBeVisible();

  await page.getByRole('link', { name: 'Assets', exact: true }).click();
  await page.getByRole('link', { name: 'Payments', exact: true }).click();
  await page.getByRole('button', { name: 'Operations' }).click();
  await expect(page.getByRole('region', { name: 'Settlement proposals' })).not.toBeVisible();
  await expect(page.getByRole('region', { name: 'Jurisdiction batch' }).getByText('No queued operations.')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-settlement-finality-reopen');
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors.length).toBeGreaterThan(0);
  for (const message of errors.consoleErrors) expect(message).toContain('503');
});
