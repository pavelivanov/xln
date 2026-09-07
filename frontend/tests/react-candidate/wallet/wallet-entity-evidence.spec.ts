import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../browser-evidence';
import { selectWalletFixtureRuntime } from './fixtures/wallet-runtime-test-helpers';

test('Ownership and Consensus deep links follow the selected real Entity', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app#ownership');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  const ownership = page.getByTestId('wallet-entity-ownership');
  await expect(ownership).toHaveAttribute('data-entity-id', fixture.entityId);
  await expect(ownership.getByTestId('ownership-threshold')).toHaveText('1');
  await expect(ownership.getByTestId('ownership-member-count')).toHaveText('1');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-ownership-board');
  await ownership.getByRole('link', { name: 'Consensus', exact: true }).click();
  const consensus = page.getByTestId('wallet-entity-consensus');
  await expect(consensus).toHaveAttribute('data-entity-id', fixture.entityId);
  await expect(consensus.getByTestId('consensus-threshold')).toHaveText('1 / 1');
  await expect(consensus.getByTestId('consensus-account-heads')).toContainText('A');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await expect(consensus).toHaveAttribute('data-entity-id', fixture.counterpartyEntityId);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-consensus-selected-entity');
  await page.reload();
  await expect(consensus).toHaveAttribute('data-entity-id', fixture.counterpartyEntityId);
  expectNoBrowserErrors(errors);
});

test('Ownership reads real released shares, refreshes and discards a delayed read across Entity reversal', { tag: '@resilience' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.post(`http://127.0.0.1:${port}/ownership-fixture`);
  expect(response.ok()).toBe(true);
  const company: unknown = await response.json();
  if (!company || typeof company !== 'object' || !('entityId' in company) || typeof company.entityId !== 'string') throw new Error('OWNERSHIP_FIXTURE_INVALID');
  await page.goto('/app#ownership');
  const entity = page.getByLabel('Entity', { exact: true });
  await expect(entity.locator(`option[value="${company.entityId}"]`)).toHaveCount(1);
  await entity.selectOption(company.entityId);
  const shares = page.getByTestId('ownership-shares');
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('80');
  await expect(shares.getByTestId('ownership-dividend-reserve')).toHaveText('40');
  await shares.getByRole('button', { name: 'Refresh shares' }).click();
  await expect(shares).toHaveAttribute('aria-busy', 'false');
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('80');

  let releaseRead: (() => void) | undefined;
  const delayed = new Promise<void>(resolve => { releaseRead = resolve; });
  let readStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { readStarted = resolve; });
  await page.route('**/api/tokens', async route => {
    readStarted?.();
    await delayed;
    await route.continue();
  }, { times: 1 });
  await shares.getByRole('button', { name: 'Refresh shares' }).click();
  await started;
  await entity.selectOption(fixture.entityId);
  await expect(shares).toHaveAttribute('data-entity-id', fixture.entityId);
  await expect(shares).toContainText('Share issuance requires a numbered on-chain Entity ID.');
  const lateResponse = page.waitForResponse(response => response.url().endsWith('/api/tokens'));
  releaseRead?.();
  await lateResponse;
  await expect(shares).toHaveAttribute('data-entity-id', fixture.entityId);
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveCount(0);
  await entity.selectOption(company.entityId);
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('80');
  await expect(shares).toHaveAttribute('data-entity-id', company.entityId);
  await expect(shares.getByTestId('ownership-dividend-reserve')).toHaveText('40');
  await expectPageContained(page);
  await page.reload();
  await expect(shares).not.toHaveAttribute('data-entity-id', company.entityId);
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveCount(0);
  await expect(shares).toHaveAttribute('data-entity-id', await entity.inputValue());
  await entity.selectOption(company.entityId);
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('80');
  await expect(shares.getByTestId('ownership-dividend-reserve')).toHaveText('40');
  await expect(shares.getByTestId('ownership-confirmed-nonce')).toHaveText('Confirmed action nonce 1');
  await expect(shares.getByTestId('ownership-release-status')).toHaveText('No pending share release.');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await screenshotEvidence(page, testInfo, 'wallet-ownership-shares-refreshed');
  expectNoBrowserErrors(errors);
});


test('Ownership exposes the exact confirmed release nonce from the real Runtime', { tag: '@functional' }, async ({ page }) => {
  await selectWalletFixtureRuntime(page);
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.post(`http://127.0.0.1:${port}/ownership-fixture`);
  expect(response.ok()).toBe(true);
  const company: unknown = await response.json();
  if (!company || typeof company !== 'object' || !('entityId' in company) || typeof company.entityId !== 'string') throw new Error('OWNERSHIP_FIXTURE_INVALID');
  await page.goto('/app#ownership');
  await page.getByLabel('Entity', { exact: true }).selectOption(company.entityId);
  await expect(page.getByTestId('ownership-control-reserve')).toHaveText('80');
  await expect(page.getByTestId('ownership-confirmed-nonce')).toHaveText('Confirmed action nonce 1');
});

test('Ownership review cancellation is inert and submit commits the canonical share release', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await selectWalletFixtureRuntime(page);
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.post(`http://127.0.0.1:${port}/ownership-release-fixture?slot=${encodeURIComponent(testInfo.project.name)}`);
  expect(response.ok()).toBe(true);
  const company: unknown = await response.json();
  if (!company || typeof company !== 'object' || !('entityId' in company) || typeof company.entityId !== 'string') throw new Error('OWNERSHIP_RELEASE_FIXTURE_INVALID');
  const readAction = async () => {
    const state = await page.request.get(`http://127.0.0.1:${port}/ownership-action-state?entityId=${company.entityId}`);
    expect(state.ok()).toBe(true);
    return state.json() as Promise<{ confirmedNonce: string; pendingKind: string | null }>;
  };
  await page.goto('/app#ownership');
  await page.getByLabel('Entity', { exact: true }).selectOption(company.entityId);
  const shares = page.getByTestId('ownership-shares');
  await expect(shares).toContainText('No shares in this Entity’s reserve.');
  await shares.getByTestId('ownership-release-shares').click();
  const review = shares.getByTestId('ownership-release-review');
  await expect(review).toContainText('100000000000');
  await expect(review).toContainText('CONTROL');
  await expect(review).toContainText('DIVIDEND');
  await review.getByRole('button', { name: 'Cancel' }).click();
  await expect(review).toHaveCount(0);
  expect(await readAction()).toEqual({ confirmedNonce: '0', pendingKind: null });

  await shares.getByTestId('ownership-release-shares').click();
  await shares.getByTestId('ownership-release-submit').click();
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('100000000000', { timeout: 30_000 });
  await expect(shares.getByTestId('ownership-dividend-reserve')).toHaveText('100000000000');
  await expect(shares.getByTestId('ownership-confirmed-nonce')).toHaveText('Confirmed action nonce 1');
  expect(await readAction()).toEqual({ confirmedNonce: '1', pendingKind: null });
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-ownership-release-committed');
  expectNoBrowserErrors(errors);
});

test('Ownership selects an eligible CONTROL target and observes the committed board proposal', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await selectWalletFixtureRuntime(page);
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.post(`http://127.0.0.1:${port}/ownership-governance-fixture?slot=${encodeURIComponent(testInfo.project.name)}`);
  expect(response.ok()).toBe(true);
  const fixture = await response.json() as { shareholderEntityId: string; targetEntityId: string; targetName: string; expectedBoardHash: string };
  const readBoard = async () => {
    const board = await page.request.get(`http://127.0.0.1:${port}/ownership-board-state?entityId=${fixture.targetEntityId}`);
    expect(board.ok()).toBe(true);
    return board.json() as Promise<{ currentBoardHash: string; proposedBoardHash: string; actionNonce: string }>;
  };
  await page.goto('/app#ownership');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.shareholderEntityId);
  const governance = page.getByTestId('ownership-control-takeover');
  const target = governance.getByTestId('ownership-takeover-target');
  await expect(target.locator(`option[value="${fixture.targetEntityId}"]`)).toHaveText(fixture.targetName);
  await target.selectOption(fixture.targetEntityId);
  await expect(governance.getByTestId('ownership-takeover-status')).toContainText('No pending board proposal');
  await governance.getByTestId('ownership-takeover-propose').click();
  const review = governance.getByTestId('ownership-takeover-review');
  await expect(review).toContainText(fixture.targetName);
  await expect(review).toContainText(fixture.expectedBoardHash);
  await expect(review).toContainText('Action nonce');
  await review.getByRole('button', { name: 'Cancel' }).click();
  expect((await readBoard()).actionNonce).toBe('0');

  await governance.getByTestId('ownership-takeover-propose').click();
  await governance.getByTestId('ownership-takeover-submit').click();
  await expect(governance.getByTestId('ownership-proposed-board')).toHaveText(fixture.expectedBoardHash, { timeout: 30_000 });
  await expect(page.locator('.wallet-account-command')).toContainText('Committed at Runtime height');
  await expect(page.getByRole('alert')).toHaveCount(0);
  const committed = await readBoard();
  expect(committed.proposedBoardHash).toBe(fixture.expectedBoardHash);
  expect(committed.actionNonce).toBe('1');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-ownership-control-proposed');
  expectNoBrowserErrors(errors);
});
