import { openWorkspaceStorageOrigin } from '../../browser-evidence';
import { expect, test, type WebSocket } from '@playwright/test';

import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import { createIsolatedRecoveryTowerFixture, installImportedRuntime, readWalletRuntimeFixture } from '../../wallet/fixtures/wallet-runtime-test-helpers';
import { installOpsOwnerMetadata } from '../owner/ops-owner-test-helpers';

const securityIncidentFixtureUrl = '/__app/ops/src/testing/ops-runtime-security-incident-fixture.ts';

test('workspace panels preserve unavailable Runtime state without opening a connection', { tag: '@resilience' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await page.goto('/__app/ops/entity-workspace', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open Gossip panel' }).click();
  await expect(page.getByTestId('runtime-gossip-panel')).toContainText('Select a local or remote Runtime');
  await page.getByRole('button', { name: 'Open Solvency panel' }).click();
  await expect(page.getByTestId('solvency-panel')).toContainText('Select a local or remote Runtime');
  await expect(page.getByTestId('solvency-status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Runtime Diagnostics panel' }).click();
  const diagnostics = page.getByTestId('runtime-diagnostics-panel');
  await expect(diagnostics).toContainText('Select a local or remote Runtime');
  await expect(diagnostics.getByRole('button', { name: 'Verify chain' })).toBeDisabled();
  await expect(diagnostics.getByTestId('runtime-diagnostics-persisted')).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-workspace-unavailable');
  expectNoBrowserErrors(errors);
});

test('Runtime Diagnostics refreshes real active/resolved incidents without copying infrastructure into history', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  const towerUrl = await createIsolatedRecoveryTowerFixture(page, `incidents-${testInfo.project.name}`);
  await page.addInitScript(({ towerUrl, apiUrl }: { towerUrl: string; apiUrl: string }) => {
    localStorage.setItem('xln-watchtower-urls', JSON.stringify([towerUrl]));
    (window as typeof window & { __XLN_WATCHTOWERS__?: string[] }).__XLN_WATCHTOWERS__ = [towerUrl];
    (window as typeof window & { __XLN_API_BASE_URL__?: string }).__XLN_API_BASE_URL__ = apiUrl;
  }, { towerUrl, apiUrl: new URL(fixture.wsUrl.replace('ws:', 'http:')).origin });
  await openWorkspaceStorageOrigin(page);
  await installOpsOwnerMetadata(page, { ...fixture, entityId: fixture.recovery.entityId });
  await page.evaluate(() => localStorage.setItem('xln-runtime-adapter-mode', 'embedded'));
  await page.goto('/__app/ops/entity-workspace');
  await page.getByRole('button', { name: 'Owner locked', exact: true }).click();
  const unlock = page.getByRole('form', { name: 'Unlock Runtime owner' });
  await unlock.getByLabel('Owner wallet seed phrase').fill(fixture.walletSeed);
  await unlock.getByRole('button', { name: 'Unlock owner', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Owner unlocked', exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Open Runtime Diagnostics panel', exact: true }).click();
  const diagnostics = page.getByTestId('runtime-diagnostics-panel');
  await expect(diagnostics.getByTestId('runtime-security-summary')).toHaveText('No active security incidents.', { timeout: 45_000 });
  const identity = {
    domain: 'cross-j', code: 'CROSS_J_ACCOUNT_PAIR_STRUCTURAL_MISMATCH', source: 'remote-ingress',
    severity: 'critical', summary: 'Isolated malformed cross-j cohort was rejected',
    entityId: fixture.recovery.entityId,
  } as const;
  await page.evaluate(async ({ moduleUrl, value }) => {
    const fixture = await import(/* @vite-ignore */ moduleUrl);
    fixture.mutateOpsRuntimeSecurityIncidentFixture('record', value);
  }, { moduleUrl: securityIncidentFixtureUrl, value: identity });
  await diagnostics.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(diagnostics.getByTestId('runtime-security-summary')).toHaveText('1 active');
  const incident = diagnostics.getByTestId('runtime-security-incident');
  await expect(incident).toContainText('CROSS_J_ACCOUNT_PAIR_STRUCTURAL_MISMATCH');
  await expect(incident).toContainText('active');
  await expect(incident).toContainText(identity.summary);
  await expect(incident).toContainText('seen 1×');
  await screenshotEvidence(page, testInfo, 'ops-runtime-incident-active');
  await page.evaluate(async ({ moduleUrl, value }) => {
    const fixture = await import(/* @vite-ignore */ moduleUrl);
    fixture.mutateOpsRuntimeSecurityIncidentFixture('resolve', value);
  }, { moduleUrl: securityIncidentFixtureUrl, value: identity });
  await diagnostics.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(diagnostics.getByTestId('runtime-security-summary')).toHaveText('No active security incidents.');
  await expect(incident).toContainText('resolved');
  expect(await page.evaluate(() => {
    const debug = (window as Window & { __xln?: { env?: Record<string, unknown> } }).__xln;
    return Object.hasOwn(debug?.env ?? {}, 'infrastructure');
  })).toBe(false);
  await page.getByRole('button', { name: 'Open Architect panel', exact: true }).click();
  const architect = page.getByTestId('workspace-architect');
  await architect.getByLabel('Architect scenario').selectOption('settle');
  await architect.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(architect.getByText(/^settle: \d+ recorded network steps$/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Open Runtime Diagnostics panel', exact: true }).click();
  await expect(diagnostics.getByTestId('runtime-diagnostics-history')).toBeVisible();
  await expect(diagnostics.getByTestId('runtime-security-incident')).toHaveCount(0);
  await screenshotEvidence(page, testInfo, 'ops-runtime-incident-history-boundary');
  await expectPageContained(page);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toHaveLength(1);
  expect(errors.consoleErrors[0]).toContain('[system] SECURITY_INCIDENT_ACTIVE');
});

test('Runtime Diagnostics verifies real persisted storage and releases its panel state on close', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await openWorkspaceStorageOrigin(page);
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
  await openWorkspaceStorageOrigin(page);
  await expect.poll(async () => {
    const response = await page.request.get(fixture.wsUrl.replace('ws:', 'http:').replace('/rpc', '/connections'));
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('active' in value)) throw new Error('FIXTURE_CONNECTION_COUNT_INVALID');
    return value.active;
  }).toBe(0);
  expectNoBrowserErrors(errors);
});

test('docked directory and solvency read the selected real Runtime and reopen cleanly', { tag: '@functional' }, async ({ page, context }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await openWorkspaceStorageOrigin(page);
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
  await openWorkspaceStorageOrigin(page);
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
