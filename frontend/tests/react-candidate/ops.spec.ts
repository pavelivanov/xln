import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectOnlyProxyFailures,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

test('ops candidate renders without browser errors', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/embed', { waitUntil: 'networkidle' });
  expect(response?.ok(), 'document response for /embed').toBe(true);
  await expect(page.getByRole('heading', { name: 'Ops, independently built.' })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops');
  expectNoBrowserErrors(errors);
});

const unavailableOpsRoutes = [
  { id: 'ops-health', pathname: '/health', heading: 'System health', failure: 'OPS_HEALTH_HTTP_502' },
  { id: 'ops-qa', pathname: '/qa', heading: 'Test Cockpit', failure: 'OPS_QA_HTTP_502' },
  { id: 'ops-hlt', pathname: '/qa/hlt', heading: 'HLT', failure: 'DEVELOPMENT_GATEWAY_PROXY_FAILED' },
] as const;

for (const route of unavailableOpsRoutes) {
  test(`${route.pathname} exposes its unavailable upstream without browser errors`, async ({ page }, testInfo) => {
    const errors = observeBrowserErrors(page);
    const response = await page.goto(route.pathname, { waitUntil: 'networkidle' });
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('heading', { exact: true, name: route.heading })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(route.failure);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, route.id);
    expectOnlyProxyFailures(errors);
  });
}

test('ops HLT lazy chunk is browser-safe', async ({ page }) => {
  const errors = observeBrowserErrors(page);
  await page.goto('/embed', { waitUntil: 'networkidle' });
  const exportType = await page.evaluate(async (moduleUrl) => {
    const module = await import(moduleUrl);
    return typeof module.OpsHltPage;
  }, '/__app/ops/src/ops-hlt.tsx');
  expect(exportType).toBe('function');
  expectNoBrowserErrors(errors);
});

test('quorum evidence supports filtering and selection without browser errors', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/qa/quorum', { waitUntil: 'networkidle' });
  expect(response?.ok()).toBe(true);
  await expect(page.getByTestId('quorum-dashboard')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Who actually finds the bottleneck?' })).toBeVisible();
  await expect(page.getByLabel('Quorum summary')).toContainText('46');
  await page.getByLabel('Work').selectOption('performance');
  await expect(page.getByLabel('Quorum summary')).toContainText('5');
  await page.getByLabel('Work').selectOption('all');
  await page.locator('.ops-quorum-leader-row').filter({ hasText: 'Claude Fable 5' }).click();
  await expect(page.getByTestId('quorum-selected-interaction')).toContainText('895');
  await expect(page.getByTestId('quorum-selected-interaction')).toContainText('60-second live H1 CPU profile');
  await expectPageContained(page);
  await page.evaluate(() => window.scrollTo({ left: 0, top: 0 }));
  await screenshotEvidence(page, testInfo, 'ops-quorum');
  expectNoBrowserErrors(errors);
});

test('entity workspace tabs follow canonical hash routes', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await page.goto('/__app/ops/entity-workspace#settings/network', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('entity-workspace-shell')).toHaveAttribute('data-active-tab', 'settings');
  await expect(page.getByTestId('entity-workspace-tab-settings')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('entity-workspace-stage').getByRole('heading')).toHaveText('Settings');
  await page.getByTestId('entity-workspace-tab-accounts').click();
  await expect(page).toHaveURL(/\/__app\/ops\/entity-workspace#accounts$/);
  await expect(page.getByTestId('entity-workspace-shell')).toHaveAttribute('data-active-tab', 'accounts');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-entity-workspace-accounts');
  expectNoBrowserErrors(errors);
});

test('ai console reports the unavailable local AI service without browser errors', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/ai', { waitUntil: 'networkidle' });
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'AI Console' })).toBeVisible();
  await expect(page.getByTestId('ai-messages')).toBeVisible();
  await expect(page.getByTestId('ai-service-error')).toContainText(/(AI_HTTP_|Failed to fetch)/);
  // Playwright Chromium provides a fake microphone, so the canonical
  // auto-started Web Speech session is live; only the AI service is absent.
  await expect(page.getByTestId('ai-voice-status')).toHaveText('Listening...');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-ai-service-unavailable');
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors.length).toBeGreaterThan(0);
  for (const error of errors.consoleErrors) expect(error).toContain('ERR_CONNECTION_REFUSED');
});

test('runs reports an unavailable QA upstream without swallowing the failure', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/runs', { waitUntil: 'networkidle' });
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Runs Ledger' })).toBeVisible();
  await expect(page.getByTestId('runs-error')).toContainText('OPS_RUNS_HTTP_502');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-runs-upstream-unavailable');
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([
    expect.stringContaining('Failed to load resource: the server responded with a status of 502'),
  ]);
});

test('scenarios execute within the isolated ops surface', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  const rpcRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/rpc') rpcRequests.push(request.method()); });
  const response = await page.goto('/scenarios?scenario=hub-collapse', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  const player = page.getByTestId('scenario-player');
  await expect(player).toHaveAttribute('data-state', 'ready', { timeout: 90_000 });
  await expect(player).toHaveAttribute('data-scenario-id', 'hub-collapse');
  await expect(page.getByTestId('scenario-status')).toHaveText(/Hub collapse: [1-9]\d* frames/);
  const frameRange = page.getByTestId('scenario-frame-range');
  const finalFrame = Number(await frameRange.getAttribute('max'));
  expect(finalFrame).toBeGreaterThan(0);
  await frameRange.fill(String(finalFrame));
  await expect(frameRange).toHaveValue(String(finalFrame));
  await expect(page.getByTestId('scenario-node').first()).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-scenarios-isolated');
  expect(rpcRequests).toEqual([]);
  expectNoBrowserErrors(errors);
});
