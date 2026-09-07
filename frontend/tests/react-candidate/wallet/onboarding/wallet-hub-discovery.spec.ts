import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import { finishOpenedWalletSetup, restoreLocalWallet } from './wallet-onboarding-test-helpers';
import {
  createWalletHubDiscoveryFixture,
  installImportedRuntime,
  readWalletHubDiscoveryAccountState,
  selectWalletFixtureRuntime,
} from '../fixtures/wallet-runtime-test-helpers';

const fixturePort = () => Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);

const openRemoteOwnerHubPanel = async (page: Page, testInfo: TestInfo, purpose: 'open' | 'switch') => {
  const fixture = await restoreLocalWallet(page);
  await finishOpenedWalletSetup(page);
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  const hub = await createWalletHubDiscoveryFixture(page, `${testInfo.project.name}-${purpose}`);
  await installImportedRuntime(page, fixture);
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage')));
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Remote Runtime');
  await expect(page.getByLabel('Entity', { exact: true }).locator(`option[value="${fixture.entityId}"]`)).toHaveCount(1);
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.getByRole('button', { name: 'Open Account', exact: true }).click();
  const panel = page.getByTestId('hub-discovery-panel');
  const card = panel.locator(`[data-hub-entity-id="${hub.entityId}"]`);
  await expect(card).toHaveAttribute('data-connection-state', 'closed');
  return { fixture, hub, panel, card };
};

const readSecondaryRuntime = async (page: Page) => {
  const response = await page.request.post(`http://127.0.0.1:${fixturePort()}/account-dropdown-fixture`);
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('SECONDARY_RUNTIME_FIXTURE_INVALID');
  const record = result as Record<string, unknown>;
  const runtimeId = String(record['runtimeId'] || '');
  const entityId = String(record['entityId'] || '');
  const wsUrl = String(record['wsUrl'] || '');
  const token = String(record['token'] || '');
  const height = Number(record['height']);
  if (!runtimeId || !entityId || !wsUrl || !token || !Number.isSafeInteger(height)) throw new Error('SECONDARY_RUNTIME_FIXTURE_INVALID');
  return { runtimeId, entityId, wsUrl, token, height };
};

test('Hub Discovery opens a real local Account and retains its committed connection state', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const fixture = await restoreLocalWallet(page, 'hub-discovery');
  await finishOpenedWalletSetup(page);
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await expect(page.getByLabel('Entity', { exact: true }).locator(`option[value="${fixture.recovery.hubDiscovery.hubEntityId}"]`)).toHaveCount(1);
  const hubName = await page.getByLabel('Entity', { exact: true }).locator(`option[value="${fixture.recovery.hubDiscovery.hubEntityId}"]`).innerText();
  await page.getByRole('button', { name: 'Open Account', exact: true }).click();
  const panel = page.getByTestId('hub-discovery-panel');
  const hub = panel.locator(`[data-hub-entity-id="${fixture.recovery.hubDiscovery.hubEntityId}"]`);
  await expect(hub).toHaveAttribute('data-connection-state', 'closed');
  await hub.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(hub.getByText('Entity ID', { exact: true })).toBeVisible();
  await hub.locator('summary').filter({ hasText: 'Raw Profile' }).click();
  await expect(hub.locator('pre')).toContainText(hubName);
  await expect(hub.locator('pre')).toContainText('"isHub": true');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-hub-discovery-details');
  await hub.getByRole('button', { name: '+ Connect', exact: true }).click();
  await expect(hub).toHaveAttribute('data-connection-state', 'open', { timeout: 30_000 });
  await expect(hub.getByTestId('hub-connect-button')).toHaveCount(0);
  await hub.getByRole('button', { name: 'Hide', exact: true }).click();
  await screenshotEvidence(page, testInfo, 'wallet-hub-discovery-open');
  await panel.getByRole('button', { name: 'Refresh hubs', exact: true }).click();
  await expect(hub).toHaveAttribute('data-connection-state', 'open');
  await panel.getByRole('button', { name: '← Back to assets' }).click();
  await expect(page.getByLabel('Accounts', { exact: true }).getByText(hubName, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Account', exact: true }).click();
  await expect(hub).toHaveAttribute('data-connection-state', 'open');
  expectNoBrowserErrors(errors);
});

test('Hub Discovery reads the selected remote Runtime and its already open Account', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app?portfolio=1', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.getByRole('button', { name: 'Open Account', exact: true }).click();
  const panel = page.getByTestId('hub-discovery-panel');
  const hub = panel.locator(`[data-hub-entity-id="${fixture.counterpartyEntityId}"]`);
  await expect(hub).toHaveAttribute('data-connection-state', 'open');
  await hub.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(hub.getByText(fixture.runtimeId, { exact: true })).toBeVisible();
  await expect(hub.locator('dl > div').filter({ has: page.getByText('Fee', { exact: true }) }).locator('dd')).toHaveText('0.01 bps');
  await expect(hub.locator('dl > div').filter({ has: page.getByText('Peers', { exact: true }) }).locator('dd')).toHaveText('1');
  await expect(hub.locator('dl > div').filter({ has: page.getByText('Last updated', { exact: true }) }).locator('dd')).not.toContainText('1970');
  await expect(hub.getByText('Counterparty committed by the isolated candidate Runtime.', { exact: true })).toBeVisible();
  await expect(hub.getByTestId('hub-connect-button')).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-hub-discovery-remote');
  if (testInfo.project.name === 'mobile-390x844') {
    const runtimeId = hub.getByText(fixture.runtimeId, { exact: true });
    await runtimeId.evaluate(element => element.scrollIntoView({ block: 'center' }));
    const bounds = await runtimeId.boundingBox();
    const navigation = await page.getByRole('navigation', { name: 'Wallet navigation' }).boundingBox();
    if (!bounds || !navigation) throw new Error('HUB_DETAILS_VIEWPORT_BOUNDS_UNAVAILABLE');
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThan(navigation.y);
    const path = testInfo.outputPath('wallet-hub-discovery-remote-viewport.png');
    await page.screenshot({ animations: 'disabled', path });
    await testInfo.attach('hub-discovery-remote-viewport', { contentType: 'image/png', path });
  }
  await panel.getByRole('button', { name: '← Back to assets' }).click();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  expectNoBrowserErrors(errors);
});

test('Hub Discovery opens a new Account through the selected remote owner Runtime', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const { fixture, hub, panel, card } = await openRemoteOwnerHubPanel(page, testInfo, 'open');
  await expect(card.getByRole('button', { name: '+ Connect', exact: true })).toBeEnabled();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-hub-discovery-remote-owner-review');
  await card.getByRole('button', { name: '+ Connect', exact: true }).click();
  await expect(card).toHaveAttribute('data-connection-state', 'open', { timeout: 30_000 });
  await expect.poll(async () => readWalletHubDiscoveryAccountState(page, hub.entityId), { timeout: 30_000 }).toMatchObject({
    sourceHasAccount: true,
    hubHasAccount: true,
  });
  await panel.getByRole('button', { name: 'Refresh hubs', exact: true }).click();
  await expect(card).toHaveAttribute('data-connection-state', 'open');
  await panel.getByRole('button', { name: '← Back to assets' }).click();
  await expect(page.getByLabel('Accounts', { exact: true }).getByText(hub.name, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-hub-discovery-remote-owner-open');
  expectNoBrowserErrors(errors);
});

test('Hub Discovery removes the previous Account controls when the selected Runtime switches', { tag: '@resilience' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const { fixture, hub, card } = await openRemoteOwnerHubPanel(page, testInfo, 'switch');
  const secondary = await readSecondaryRuntime(page);
  await expect.poll(async () => readWalletHubDiscoveryAccountState(page, hub.entityId)).toMatchObject({
    sourceHasAccount: false,
    hubHasAccount: false,
  });
  await installImportedRuntime(page, { ...fixture, ...secondary });
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage')));
  await expect(page.getByTestId('hub-discovery-panel').getByText('No counterparties found', { exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-hub-discovery-runtime-switched');
  await page.getByTestId('hub-discovery-panel').getByRole('button', { name: '← Back to assets' }).click();
  await expect(page.getByLabel('Entity', { exact: true }).locator('option:checked')).toHaveText('Dropdown owner');
  await expect.poll(async () => readWalletHubDiscoveryAccountState(page, hub.entityId)).toMatchObject({
    sourceHasAccount: false,
    hubHasAccount: false,
  });
  expectNoBrowserErrors(errors);
});
