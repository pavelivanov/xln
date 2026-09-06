import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';
import { selectWalletFixtureRuntime } from './wallet-runtime-test-helpers';

test('Ownership and Consensus deep links follow the selected real Entity', async ({ page }, testInfo) => {
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

test('Ownership reads real released shares, refreshes and discards a delayed read across Entity reversal', async ({ page }, testInfo) => {
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
  await expect(shares).toContainText('Share release status is not exposed by this Runtime read.');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await screenshotEvidence(page, testInfo, 'wallet-ownership-shares-refreshed');
  expectNoBrowserErrors(errors);
});


test('Ownership exposes the exact confirmed release nonce from the real Runtime', async ({ page }) => {
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
