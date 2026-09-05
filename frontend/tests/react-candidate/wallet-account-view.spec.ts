import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';
import { selectWalletFixtureRuntime } from './wallet-runtime-test-helpers';
import { finishOpenedWalletSetup, restoreLocalWallet } from './wallet-onboarding-test-helpers';

test('focused Account shows the exact remote credit perspective and returns to activity', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app?portfolio=1', { waitUntil: 'domcontentloaded' });
  for (const entityId of [fixture.entityId, fixture.counterpartyEntityId]) {
    await page.getByLabel('Entity', { exact: true }).selectOption(entityId);
    await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(entityId);
    const account = page.locator('.wallet-portfolio-account').first();
    await expect(account).toBeVisible();
    const creditUs = await account.locator('dl > div').filter({ has: page.getByText('Peer granted us', { exact: true }) }).first().locator('dd').innerText();
    const creditPeer = await account.locator('dl > div').filter({ has: page.getByText('We granted peer', { exact: true }) }).first().locator('dd').innerText();
    const outCapacity = await account.locator('dl > div').filter({ has: page.getByText('Spendable', { exact: true }) }).first().locator('dd').innerText();
    const inCapacity = await account.locator('dl > div').filter({ has: page.getByText('Inbound capacity', { exact: true }) }).first().locator('dd').innerText();
    await account.getByRole('button', { name: 'View Account' }).click();
    const panel = page.getByTestId('account-panel');
    await expect(panel.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(panel.getByText('No active dispute.', { exact: true })).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expectPageContained(page);
    if (entityId === fixture.entityId) await screenshotEvidence(page, testInfo, 'wallet-account-focused-summary');
    const token = panel.locator('[data-token-id="1"]');
    await token.getByRole('button', { name: 'Show USDC details' }).click();
    const creditRow = token.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Credit limit', exact: true }) });
    const capacityRow = token.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Capacity', exact: true }) });
    await expect(capacityRow.getByRole('cell').nth(0)).toHaveText(outCapacity.replace(/\s+USDC$/, ''));
    await expect(capacityRow.getByRole('cell').nth(1)).toHaveText(inCapacity.replace(/\s+USDC$/, ''));
    await expect(creditRow.getByRole('cell').nth(0)).toHaveText(creditUs.replace(/\s+USDC$/, ''));
    await expect(creditRow.getByRole('cell').nth(1)).toHaveText(creditPeer.replace(/\s+USDC$/, ''));
    await expect(token.getByRole('heading', { name: 'Canonical state' })).toBeVisible();
    if (entityId === fixture.entityId) {
      await token.getByRole('button', { name: 'Faucet', exact: true }).click();
      await expect(panel.getByRole('alert')).toContainText('missing runtimeId');
    }
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, entityId === fixture.entityId ? 'wallet-account-focused-details' : 'wallet-account-focused-peer-details');
    if (entityId === fixture.entityId && testInfo.project.name === 'mobile-390x844') {
      await token.getByRole('table').evaluate(element => element.scrollIntoView({ block: 'center' }));
      const bounds = await token.getByRole('table').boundingBox();
      const navigation = await page.getByRole('navigation', { name: 'Wallet navigation' }).boundingBox();
      if (!bounds || !navigation) throw new Error('ACCOUNT_DETAILS_BOUNDS_UNAVAILABLE');
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThan(navigation.y);
      const path = testInfo.outputPath('wallet-account-focused-details-viewport.png');
      await page.screenshot({ animations: 'disabled', path });
      await testInfo.attach('account-details-viewport', { contentType: 'image/png', path });
    }
    await token.getByRole('button', { name: 'Hide USDC details' }).click();
    await expect(token.getByRole('table')).toHaveCount(0);
    await panel.getByLabel('Status', { exact: true }).selectOption('confirmed');
    await expect(panel.getByLabel('Status', { exact: true })).toHaveValue('confirmed');
    await panel.getByTestId('account-panel-back').click();
    await expect(page).toHaveURL(/#accounts\/activity$/);
    await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Assets', exact: true }).click();
  }
  expectNoBrowserErrors(errors);
});

test('focused Account reads a real locally opened Account without starting another Runtime', async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const fixture = await restoreLocalWallet(page, 'hub-discovery');
  await finishOpenedWalletSetup(page);
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await page.getByRole('button', { name: 'Open Account', exact: true }).click();
  const hub = page.locator(`[data-hub-entity-id="${fixture.recovery.hubDiscovery.hubEntityId}"]`);
  await hub.getByTestId('hub-connect-button').click();
  await expect(hub).toHaveAttribute('data-connection-state', 'open', { timeout: 30_000 });
  await page.getByRole('button', { name: '← Back to assets' }).click();
  await page.locator('.wallet-portfolio-account').getByRole('button', { name: 'View Account' }).click();
  const panel = page.getByTestId('account-panel');
  await expect(panel).toHaveAttribute('data-counterparty-id', fixture.recovery.hubDiscovery.hubEntityId);
  await expect(panel.getByText('No active dispute.', { exact: true })).toBeVisible();
  await expect(panel.locator('[data-token-id="1"]')).toBeVisible();
  await panel.getByRole('button', { name: 'Show USDC details' }).click();
  await expect(panel.getByRole('table')).toBeVisible();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-account-focused-local');
  expectNoBrowserErrors(errors);
});
