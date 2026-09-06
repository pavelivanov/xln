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
