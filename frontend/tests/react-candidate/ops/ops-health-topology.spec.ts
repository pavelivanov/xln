import { expect, test } from '@playwright/test';
import {
  expectPageContained,
  observeBrowserErrors,
  openWorkspaceStorageOrigin,
  screenshotEvidence,
} from '../browser-evidence';
import { installImportedRuntime, readWalletRuntimeFixture } from '../wallet/fixtures/wallet-runtime-test-helpers';

test(
  'Health displays enabled services, one real critical signal, recovery, and stale evidence',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = await readWalletRuntimeFixture(page);
    const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
    const dropdownResponse = await page.request.post(
      `http://127.0.0.1:${port}/account-dropdown-fixture`,
    );
    expect(dropdownResponse.ok()).toBe(true);
    const dropdown = await dropdownResponse.json() as {
      runtimeId: string;
      entityId: string;
      height: number;
      wsUrl: string;
      token: string;
    };
    const cleanRuntime = { ...fixture, ...dropdown };
    await openWorkspaceStorageOrigin(page);
    await installImportedRuntime(page, cleanRuntime);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    expect((await page.request.post(`http://127.0.0.1:${port}/health-fixture/start`)).ok()).toBe(true);
    await expect.poll(async () => {
      const response = await page.request.get('/api/health');
      if (!response.ok()) return { status: response.status() };
      const health = await response.json() as Record<string, unknown>;
      const marketMaker = health['marketMaker'] as Record<string, unknown> | undefined;
      const custody = health['custody'] as Record<string, unknown> | undefined;
      return {
        status: response.status(),
        systemOk: health['systemOk'],
        marketMakerEnabled: marketMaker?.['enabled'],
        marketMakerOk: marketMaker?.['ok'],
        custodyEnabled: custody?.['enabled'],
        custodyOk: custody?.['ok'],
      };
    }, { timeout: 90_000 }).toEqual({
      status: 200,
      systemOk: true,
      marketMakerEnabled: true,
      marketMakerOk: true,
      custodyEnabled: true,
      custodyOk: true,
    });
    const response = await page.request.get('/api/health');
    expect(response.ok()).toBe(true);
    const healthPayload = await response.json() as Record<string, unknown>;
    const relayPayload = healthPayload['relay'] as Record<string, unknown>;
    expect(relayPayload['clientsDetailed']).toBeUndefined();
    expect(typeof relayPayload['clientCount']).toBe('number');
    expect(Array.isArray(relayPayload['managedRuntimeIds'])).toBe(true);
    expect(Array.isArray(relayPayload['externalClientIds'])).toBe(true);
    expect(relayPayload['marketSubscriptions']).toEqual(expect.objectContaining({
      total: expect.any(Number),
      byIp: expect.any(Object),
    }));
    await testInfo.attach('orchestrator-health', {
      body: Buffer.from(JSON.stringify(healthPayload)),
      contentType: 'application/json',
    });
    const errors = observeBrowserErrors(page);
    await page.goto('/health');
    await expect(page.getByTestId('health-topology')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Hub Sockets', exact: true })).toContainText('H1');
    await expect(page.getByRole('region', { name: 'Bootstrap live status', exact: true })).toContainText(
      'Reset barrier',
    );
    await expect(page.getByRole('region', { name: 'Bootstrap timeline', exact: true })).toBeVisible();
    const gates = page.getByRole('region', { name: 'Bootstrap live status', exact: true });
    await expect(gates.locator('article').filter({ hasText: 'Custody' }).first()).toHaveAttribute(
      'data-state',
      'ready',
    );
    await expect(gates.locator('article').filter({ hasText: 'MM same-chain books' })).toHaveAttribute(
      'data-state',
      'ready',
    );
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'health-bootstrap-and-relay');
    await expect(page.getByText('READY', { exact: true }).first()).toBeVisible({ timeout: 25_000 });
    await page.getByLabel('Auto · 4s', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Active Relay Clients', exact: true })).toContainText(
      'Details not reported',
    );
    const hubs = page.getByRole('region', { name: 'Hub Sockets', exact: true });
    await hubs.getByRole('button', { name: 'Copy Runtime ID' }).first().click();
    await expect(hubs.getByRole('button', { name: 'Copied' }).first()).toBeVisible();
    await hubs.locator('summary').first().click();
    await expect(hubs.locator('pre').first()).toBeVisible();
    await screenshotEvidence(page, testInfo, 'health-ready');

    expect((await page.request.post(`http://127.0.0.1:${port}/health-fixture/rpc-failure`)).ok()).toBe(true);
    await expect.poll(async () => {
      const failedResponse = await page.request.post('/rpc', {
        data: { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] },
      });
      return failedResponse.status();
    }, { timeout: 10_000 }).toBe(503);
    await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
    await expect(page.getByText('FAIL', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/RPC health check failed/)).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Health metrics', exact: true })
        .locator('article')
        .filter({ hasText: 'RPC' }),
    ).toContainText('down');
    await screenshotEvidence(page, testInfo, 'health-critical-rpc-failure');

    expect((await page.request.post(`http://127.0.0.1:${port}/health-fixture/rpc-recovery`)).ok()).toBe(true);
    await expect.poll(async () => {
      const recoveredResponse = await page.request.post('/rpc', {
        data: { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] },
      });
      if (!recoveredResponse.ok()) return false;
      const recoveredPayload = await recoveredResponse.json() as Record<string, unknown>;
      return typeof recoveredPayload['result'] === 'string';
    }, { timeout: 10_000 }).toBe(true);
    await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
    await expect(page.getByText('READY', { exact: true }).first()).toBeVisible();

    await installImportedRuntime(page, fixture);
    const runtimeEvents = page.getByTestId('health-runtime-events');
    await runtimeEvents.getByRole('button', { name: 'Refresh events' }).click();
    await expect(runtimeEvents).toContainText(fixture.runtimeId);
    await installImportedRuntime(page, cleanRuntime);
    await runtimeEvents.getByRole('button', { name: 'Refresh events' }).click();
    await expect(runtimeEvents).toContainText(dropdown.runtimeId);
    await expect(page.getByText('READY', { exact: true }).first()).toBeVisible();
    await expect(runtimeEvents).not.toContainText(fixture.runtimeId);
    await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
    await expect(page.getByText('READY', { exact: true }).first()).toBeVisible();
    await screenshotEvidence(page, testInfo, 'health-critical-recovered');
    expect(errors.pageErrors).toEqual([]);
    expect((await page.request.post(`http://127.0.0.1:${port}/health-fixture/stop`)).ok()).toBe(true);
    await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
    await expect(
      page.getByText('Latest refresh failed; showing the last verified snapshot', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('health-topology')).toBeVisible();
    await screenshotEvidence(page, testInfo, 'health-stale');
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors.length).toBeGreaterThan(0);
    for (const error of errors.consoleErrors) expect(error).toMatch(/status of (404|503)/);
  },
);

test.afterEach(async ({ request }) => {
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  expect((await request.post(`http://127.0.0.1:${port}/health-fixture/stop`)).ok()).toBe(true);
});
