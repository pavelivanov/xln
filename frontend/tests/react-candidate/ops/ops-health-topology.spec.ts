import { expect, test } from '@playwright/test';
import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  openWorkspaceStorageOrigin,
  screenshotEvidence,
} from '../browser-evidence';
import { installImportedRuntime, readWalletRuntimeFixture } from '../wallet/fixtures/wallet-runtime-test-helpers';

test(
  'Health displays real Orchestrator bootstrap and relay evidence',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    const fixture = await readWalletRuntimeFixture(page);
    await openWorkspaceStorageOrigin(page);
    await installImportedRuntime(page, fixture);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
    expect((await page.request.post(`http://127.0.0.1:${port}/health-fixture/start`)).ok()).toBe(true);
    await expect.poll(async () => (await page.request.get('/api/health')).status(), { timeout: 15_000 }).toBe(200);
    const response = await page.request.get('/api/health');
    expect(response.ok()).toBe(true);
    await testInfo.attach('orchestrator-health', { body: await response.body(), contentType: 'application/json' });
    const errors = observeBrowserErrors(page);
    await page.goto('/health');
    await expect(page.getByTestId('health-topology')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Hub Sockets', exact: true })).toContainText('H1');
    await expect(page.getByRole('region', { name: 'Bootstrap live status', exact: true })).toContainText(
      'Reset barrier',
    );
    await expect(page.getByRole('region', { name: 'Bootstrap timeline', exact: true })).toBeVisible();
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
    expectNoBrowserErrors(errors);
    expect((await page.request.post(`http://127.0.0.1:${port}/health-fixture/stop`)).ok()).toBe(true);
    await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
    await expect(
      page.getByText('Latest refresh failed; showing the last verified snapshot', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('health-topology')).toBeVisible();
    await screenshotEvidence(page, testInfo, 'health-stale');
    expect(errors.pageErrors).toEqual([]);
    for (const error of errors.consoleErrors) expect(error).toContain('status of 404');
  },
);

test.afterEach(async ({ request }) => {
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  expect((await request.post(`http://127.0.0.1:${port}/health-fixture/stop`)).ok()).toBe(true);
});
