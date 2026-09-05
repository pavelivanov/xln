import { expect, test, type WebSocket } from '@playwright/test';

import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';
import { installImportedRuntime, readWalletRuntimeFixture } from './wallet-runtime-test-helpers';

test('workspace panels preserve unavailable Runtime state without opening a connection', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await page.goto('/__app/ops/entity-workspace', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open Gossip panel' }).click();
  await expect(page.getByTestId('runtime-gossip-panel')).toContainText('Select a remote Runtime');
  await page.getByRole('button', { name: 'Open Solvency panel' }).click();
  await expect(page.getByTestId('solvency-panel')).toContainText('Select a remote Runtime');
  await expect(page.getByTestId('solvency-status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Runtime Diagnostics panel' }).click();
  const diagnostics = page.getByTestId('runtime-diagnostics-panel');
  await expect(diagnostics).toContainText('Select a remote Runtime');
  await expect(diagnostics.getByRole('button', { name: 'Verify chain' })).toBeDisabled();
  await expect(diagnostics.getByTestId('runtime-diagnostics-persisted')).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-workspace-unavailable');
  expectNoBrowserErrors(errors);
});

test('Runtime Diagnostics verifies real persisted storage and releases its panel state on close', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await page.goto('/embed', { waitUntil: 'domcontentloaded' });
  await installImportedRuntime(page, fixture);
  const runtimeSockets: WebSocket[] = [];
  page.on('websocket', socket => { if (socket.url() === fixture.wsUrl) runtimeSockets.push(socket); });
  await page.goto('/__app/ops/entity-workspace', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open Runtime Diagnostics panel' }).click();
  const diagnostics = page.getByTestId('runtime-diagnostics-panel');
  await expect(diagnostics.getByTestId('runtime-diagnostics-frame').first()).toBeVisible();
  await expect(diagnostics.getByTestId('runtime-diagnostics-frame').first().locator('code')).toHaveText(fixture.runtimeId);
  await expect.poll(async () => Number(await diagnostics.getByTestId('runtime-diagnostics-persisted').textContent())).toBeGreaterThanOrEqual(fixture.height);
  await expect(diagnostics.getByTestId('runtime-security-status')).toContainText('Incident details are unavailable');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-runtime-diagnostics-timeline');
  await diagnostics.getByRole('button', { name: 'Verify chain' }).click();
  const result = diagnostics.getByTestId('runtime-diagnostics-verification');
  await expect(result).toContainText('"ok": true', { timeout: 30_000 });
  await expect(result).toContainText(fixture.runtimeId);
  const verification = JSON.parse(await result.locator('pre').innerText());
  expect(verification.latestHeight).toBeGreaterThanOrEqual(fixture.height);
  expect(verification.checkedFrames).toBeGreaterThan(0);
  await diagnostics.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(diagnostics.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  await result.scrollIntoViewIfNeeded();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-runtime-diagnostics-verified');
  await page.locator('.dv-default-tab').filter({ hasText: /^Runtime Diagnostics$/ }).locator('.dv-default-tab-action').click();
  await expect(diagnostics).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Runtime Diagnostics panel' }).click();
  await expect(diagnostics.getByTestId('runtime-diagnostics-frame').first()).toBeVisible();
  await expect(result).toHaveCount(0);
  expect(runtimeSockets).toHaveLength(1);
  await page.goto('/embed', { waitUntil: 'networkidle' });
  await expect.poll(async () => {
    const response = await page.request.get(fixture.wsUrl.replace('ws:', 'http:').replace('/rpc', '/connections'));
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('active' in value)) throw new Error('FIXTURE_CONNECTION_COUNT_INVALID');
    return value.active;
  }).toBe(0);
  expectNoBrowserErrors(errors);
});

test('docked directory and solvency read the selected real Runtime and reopen cleanly', async ({ page, context }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await page.goto('/embed', { waitUntil: 'domcontentloaded' });
  await installImportedRuntime(page, fixture);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const runtimeSockets: WebSocket[] = [];
  page.on('websocket', socket => { if (socket.url() === fixture.wsUrl) runtimeSockets.push(socket); });
  await page.goto('/__app/ops/entity-workspace#accounts', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('entity-workspace-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Open Gossip panel' }).click();
  const directory = page.getByTestId('runtime-gossip-panel');
  await expect(directory).toContainText('2 profiles · 1 hub');
  const search = page.getByRole('searchbox', { name: 'Search gossip directory' });
  await search.fill(fixture.counterpartyEntityId);
  await expect(directory.locator('article')).toHaveCount(1);
  await expect(directory.getByRole('link', { name: 'Address →' })).toHaveAttribute('href', `/address/${fixture.counterpartyEntityId}`);
  // The profile-command test can rename this Entity between viewport runs.
  // The exact Entity ID above, not its editable label, selects the copy target.
  const copy = directory.getByRole('button', { name: /^Copy address for / });
  await copy.click();
  await expect(copy).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(fixture.counterpartyEntityId);
  await search.fill('no-such-profile');
  await expect(page.getByTestId('runtime-gossip-empty')).toBeVisible();
  await search.fill('');
  await expect(directory.locator('article')).toHaveCount(2);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-workspace-gossip');

  await page.getByRole('button', { name: 'Open Solvency panel' }).click();
  const solvency = page.getByTestId('solvency-panel');
  const usdc = solvency.getByTestId('solvency-asset').filter({ hasText: 'TOKEN #1' });
  await expect(usdc.getByTestId('solvency-reserves')).toHaveText('1,000,000,000');
  await expect(usdc.getByTestId('solvency-collateral')).toHaveText('0');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-workspace-solvency');

  for (let index = 0; index < 3; index += 1) {
    await page.locator('.dv-default-tab').filter({ hasText: /^Solvency$/ }).locator('.dv-default-tab-action').click();
    await expect(solvency).toHaveCount(0);
    await page.getByRole('button', { name: 'Open Solvency panel' }).click();
    await expect(usdc.getByTestId('solvency-reserves')).toHaveText('1,000,000,000');
  }
  await page.getByRole('button', { name: 'Open Entity panel' }).click();
  await expect(page.getByTestId('entity-workspace-shell')).toHaveAttribute('data-active-tab', 'accounts');
  expect(runtimeSockets).toHaveLength(1);
  await screenshotEvidence(page, testInfo, 'ops-workspace-entity');
  await page.goto('/embed', { waitUntil: 'networkidle' });
  // Observe closure at the server: the page's old CDP WebSocket handle can
  // stop receiving events once its document has been detached by navigation.
  await expect.poll(async () => {
    const response = await page.request.get(fixture.wsUrl.replace('ws:', 'http:').replace('/rpc', '/connections'));
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('active' in value)) throw new Error('FIXTURE_CONNECTION_COUNT_INVALID');
    return value.active;
  }).toBe(0);
  expectNoBrowserErrors(errors);
});
