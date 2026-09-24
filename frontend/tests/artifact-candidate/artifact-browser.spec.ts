import { runWalletRecoveryServicesFlow } from '../react-candidate/wallet/fixtures/wallet-recovery-services-flow';
import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from '../react-candidate/browser-evidence';
import {
  installImportedRuntime,
  readWalletRuntimeFixture,
} from '../react-candidate/wallet/fixtures/wallet-runtime-test-helpers';

const identity = async (page: Page) => {
  const response = await page.request.get('/__xln-artifact/identity');
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ releaseId: string; files: number; sourceSha: string }>;
};

const selectSameOriginRuntime = async (page: Page) => {
  const fixture = await readWalletRuntimeFixture(page);
  await page.goto('/testnet');
  const wsUrl = new URL('/rpc', page.url()).href.replace('http:', 'ws:');
  const imported = { ...fixture, wsUrl };
  await installImportedRuntime(page, imported);
  return imported;
};

test(
  'built routes, lazy assets, worker URLs and shared-origin storage retain exact release identity',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    const before = await identity(page);
    const errors = observeBrowserErrors(page);
    const requested = new Set<string>();
    page.on('request', request => requested.add(new URL(request.url()).pathname));
    const fixture = await selectSameOriginRuntime(page);
    for (const route of [
      '/',
      '/docs?doc=readme',
      '/app#settings/stack-manager',
      `/address/${fixture.entityId}`,
      '/embed',
    ]) {
      const response = await page.goto(route);
      expect(response?.headers()['x-xln-deployment-release']).toBe(before.releaseId);
      if (route.startsWith('/docs')) await expect(page.getByTestId('docs-article')).toBeVisible();
      else if (route.startsWith('/app')) await expect(page.getByTestId('workspace-stack-manager')).toBeVisible();
      else if (route === '/embed') await expect(page.getByTestId('ops-workspace')).toBeVisible();
      else await expect(page.locator('#root')).not.toBeEmpty();
      expect(await page.evaluate(() => localStorage.getItem('xln-runtime-adapter-ws'))).toBe(fixture.wsUrl);
    }
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/address/${fixture.entityId}$`));
    await page.goForward();
    await expect(page.getByTestId('ops-workspace')).toBeVisible();
    for (const surface of ['site', 'docs', 'wallet', 'ops']) {
      expect([...requested].some(path => path.startsWith(`/assets/${surface}/`) && path.endsWith('.js'))).toBe(true);
    }
    expect(
      [...requested].filter(path => path.includes('/src/') || path.includes('/@vite/') || path.endsWith('.tsx')),
    ).toEqual([]);
    const manifestResponse = await page.request.get('/release-manifest.json');
    const manifest = (await manifestResponse.json()) as {
      releaseId: string;
      files: Array<{ path: string; sha256: string }>;
    };
    expect(manifest.releaseId).toBe(before.releaseId);
    for (const path of [
      'runtime.js',
      'account-worker.js',
      'brainvault-worker.js',
      'push-wake-sw.js',
      'site.webmanifest',
      'install.sh',
      'docs-catalog/readme.md',
    ]) {
      const expected = manifest.files.find(file => file.path === path);
      expect(expected, `manifest owns ${path}`).toBeDefined();
      const response = await page.request.get(`/${path}`);
      expect(response.ok()).toBe(true);
      expect(response.headers()['x-xln-deployment-release']).toBe(before.releaseId);
      expect(
        createHash('sha256')
          .update(await response.body())
          .digest('hex'),
      ).toBe(expected?.sha256);
      if (path.endsWith('.js')) expect(response.headers()['content-type']).toBe('text/javascript; charset=utf-8');
    }
    for (const path of ['/unknown', '/assets/wallet/unknown.js', '/__app/ops/src/main.tsx']) {
      expect((await page.request.get(path)).status()).toBe(404);
    }
    expect((await page.request.get('/admin', { maxRedirects: 0 })).headers()['location']).toBe('/health');
    expect((await page.request.get('/radapter', { maxRedirects: 0 })).headers()['location']).toBe('/app');
    expect((await page.request.get('/radapter?token=forbidden')).status()).toBe(400);
    await page.goto('/app#settings/stack-manager');
    await expect(page.getByTestId('stack-manager-phase')).toBeVisible();
    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toContain(
      "script-src 'self'",
    );
    const api = await page.request.get('/api/tokens');
    expect(api.ok()).toBe(true);
    expect((await api.json()).tokens.length).toBeGreaterThan(0);
    await screenshotEvidence(page, testInfo, 'artifact-shared-runtime');
    expect(await identity(page)).toEqual(before);
    expectNoBrowserErrors(errors);
  },
);

test(
  'built Wallet cancels and commits an exact Ownership release through same-origin Runtime WebSocket',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    const before = await identity(page);
    const errors = observeBrowserErrors(page);
    const fixture = await selectSameOriginRuntime(page);
    const sockets: string[] = [];
    page.on('websocket', socket => sockets.push(socket.url()));
    const fixtureOrigin = `http://127.0.0.1:${process.env['XLN_REACT_WALLET_FIXTURE_PORT']}`;
    const response = await page.request.post(
      `${fixtureOrigin}/ownership-release-fixture?slot=${testInfo.project.name}`,
    );
    expect(response.ok()).toBe(true);
    const company = (await response.json()) as { entityId: string };
    const readAction = async () => {
      const state = await page.request.get(`${fixtureOrigin}/ownership-action-state?entityId=${company.entityId}`);
      expect(state.ok()).toBe(true);
      return state.json();
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
    expect(await readAction()).toEqual({ confirmedNonce: '0', pendingKind: null });
    await shares.getByTestId('ownership-release-shares').click();
    await shares.getByTestId('ownership-release-submit').click();
    await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('100000000000');
    await expect(shares.getByTestId('ownership-dividend-reserve')).toHaveText('100000000000');
    await expect(shares.getByTestId('ownership-confirmed-nonce')).toHaveText('Confirmed action nonce 1');
    expect(await readAction()).toEqual({ confirmedNonce: '1', pendingKind: null });
    expect(sockets).toContain(fixture.wsUrl);
    await screenshotEvidence(page, testInfo, 'artifact-ownership-committed');
    await expectPageContained(page);
    expect(await identity(page)).toEqual(before);
    expectNoBrowserErrors(errors);
  },
);

test(
  'built workspace records exact graph history and restores the connected Runtime',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    const before = await identity(page);
    const errors = observeBrowserErrors(page);
    const fixture = await selectSameOriginRuntime(page);
    await page.goto('/embed');
    const menu = page.getByRole('combobox', { name: 'Open workspace panel', exact: true });
    await menu.selectOption('wallet-main');
    const wallet = page.getByTestId('ops-wallet-panel');
    await expect(wallet).toHaveAttribute('data-runtime-id', fixture.runtimeId);
    await menu.selectOption('architect');
    const architect = page.getByTestId('workspace-architect');
    await architect.getByLabel('Architect scenario').selectOption('ahb');
    await architect.getByRole('button', { name: 'Run scenario', exact: true }).click();
    // The full browser scenario remains bounded by this test and the outer process budget.
    await expect(architect.getByText('ahb: 126 recorded network steps', { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await menu.selectOption('graph3d');
    const graph = page.getByTestId('workspace-graph');
    const timeline = page.getByTestId('workspace-network-timeline');
    await expect(timeline.locator('output')).toContainText('1/126');
    await timeline.getByLabel('Network frame', { exact: true }).press('End');
    await expect(timeline.locator('output')).toContainText('126/126');
    await expect(graph).toHaveAttribute('data-selected-step-index', '125');
    await expect(graph).toHaveAttribute('data-node-count', '4');
    await screenshotEvidence(page, testInfo, 'artifact-recorded-graph');
    await menu.selectOption('architect');
    await architect.getByRole('button', { name: 'Solvency', exact: true }).click();
    await expect(architect.getByTestId('solvency-panel')).toContainText('Historical h126');
    await expect(architect.getByTestId('solvency-asset').first()).toContainText('9,950,000,000,000');
    await screenshotEvidence(page, testInfo, 'artifact-recorded-solvency');
    await architect.getByRole('button', { name: 'Scenarios', exact: true }).click();
    await architect.getByRole('button', { name: 'Live Runtime', exact: true }).click();
    await expect(timeline.locator('output')).toHaveText('Live');
    await menu.selectOption('wallet-main');
    await expect(page.getByTestId('ops-wallet-panel')).toHaveAttribute('data-runtime-id', fixture.runtimeId);
    await expectPageContained(page);
    expect(await identity(page)).toEqual(before);
    expectNoBrowserErrors(errors);
  },
);

test(
  'built Wallet restores recovery coverage and enrolls services from immutable assets',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    const before = await identity(page);
    const requested = new Set<string>();
    page.on('request', request => requested.add(new URL(request.url()).pathname));
    await runWalletRecoveryServicesFlow(page, testInfo);
    expect(
      [...requested].filter(path => path.includes('/src/') || path.includes('/@vite/') || path.endsWith('.tsx')),
    ).toEqual([]);
    expect(await identity(page)).toEqual(before);
  },
);
