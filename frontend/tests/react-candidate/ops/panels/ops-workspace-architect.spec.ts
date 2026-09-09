import { openWorkspaceStorageOrigin } from '../../browser-evidence';
import { expect, test, type WebSocket } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import { createIsolatedRecoveryTowerFixture, installImportedRuntime, readStackManagerRpcFixture, readWalletRuntimeFixture } from '../../wallet/fixtures/wallet-runtime-test-helpers';
import { installOpsOwnerMetadata } from '../owner/ops-owner-test-helpers';

test('Architect records into shared playback and returns to the unchanged connected Wallet', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await openWorkspaceStorageOrigin(page);
  await installImportedRuntime(page, fixture);
  const sockets: WebSocket[] = [];
  page.on('websocket', socket => { if (socket.url() === fixture.wsUrl) sockets.push(socket); });
  await page.goto('/__app/ops/entity-workspace');
  await page.getByRole('button', { name: 'Open Wallet panel', exact: true }).click();
  const wallet = page.getByTestId('ops-wallet-panel');
  await wallet.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  const assets = wallet.getByRole('table', { name: 'Committed asset positions' });
  await expect(assets).toContainText('USDC');
  const before = await assets.innerText();
  await page.getByRole('button', { name: 'Open Architect panel', exact: true }).click();
  const architect = page.getByTestId('workspace-architect');
  await expect(architect.getByLabel('Architect scenario').locator('option')).toHaveCount(8);
  await architect.getByLabel('Architect scenario').selectOption('ahb');
  await architect.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(architect.getByText('ahb: 126 recorded network steps', { exact: true })).toBeVisible({ timeout: 90_000 });
  const timeline = page.getByTestId('workspace-network-timeline');
  await expect(timeline.locator('output')).toContainText('1/126');
  await expect(wallet).toHaveCount(0);
  await expect(architect.getByLabel('AHB scenario source')).toHaveValue(/async function ahb/);
  await screenshotEvidence(page, testInfo, 'ops-architect-recorded');
  await timeline.getByLabel('Network frame', { exact: true }).press('End');
  await architect.getByText('Selected frame', { exact: true }).click();
  await expect(architect.locator('pre')).toContainText('"height": 126');
  await architect.getByRole('button', { name: 'Solvency', exact: true }).click();
  await expect(architect.getByTestId('solvency-panel')).toContainText('recorded h126');
  await expect(architect.getByTestId('solvency-asset').first()).toBeVisible();
  await screenshotEvidence(page, testInfo, 'ops-architect-solvency');
  await page.getByRole('button', { name: 'Open Gossip panel', exact: true }).click();
  await expect(page.getByTestId('runtime-gossip-panel')).toContainText('4 profiles');
  await page.getByRole('button', { name: 'Open Architect panel', exact: true }).click();
  await expect(architect.getByTestId('solvency-panel')).toBeVisible();
  await architect.getByRole('button', { name: 'Scenarios', exact: true }).click();
  await architect.getByRole('button', { name: 'Live Runtime', exact: true }).click();
  await page.getByRole('button', { name: 'Open Wallet panel', exact: true }).click();
  await expect(wallet).toHaveAttribute('data-runtime-id', fixture.runtimeId);
  await wallet.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await expect.poll(() => assets.innerText()).toBe(before);
  expect(sockets).toHaveLength(1);
  expect(sockets[0]?.isClosed()).toBe(false);
  await page.getByRole('button', { name: 'Open Architect panel', exact: true }).click();
  await architect.getByLabel('Architect scenario').selectOption('rapid-fire');
  await architect.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(architect.getByText(/^rapid-fire: \d+ recorded network steps$/)).toBeVisible({ timeout: 90_000 });
  await expect(architect.getByRole('button', { name: 'Run scenario', exact: true })).toBeDisabled();
  await expect(architect.getByRole('status').filter({ hasText: 'Switch to Live Runtime' })).toBeVisible();
  await timeline.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(timeline.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.locator('.dv-default-tab').filter({ hasText: /^Architect$/ }).locator('.dv-default-tab-action').click();
  await expect(architect).toHaveCount(0);
  await expect(timeline.locator('output')).toHaveText('Live');
  const disposed = await page.evaluate(async () => {
    const moduleUrl = '/__app/ops/src/workspace/session/ops-workspace-playback.ts';
    const module = await import(moduleUrl);
    return { machine: module.workspaceNetwork.get().machine, playing: module.workspacePlayback.get().playing };
  });
  expect(disposed).toEqual({ machine: null, playing: false });
  await page.getByRole('button', { name: 'Open Architect panel', exact: true }).click();
  await architect.getByLabel('Architect scenario').selectOption('settle');
  await architect.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(architect.getByText(/^settle: \d+ recorded network steps$/)).toBeVisible({ timeout: 90_000 });
  await architect.getByRole('button', { name: 'Reset isolated demo', exact: true }).click();
  await expect(architect.getByText('Isolated demo reset. The connected Runtime was not changed.', { exact: true })).toBeVisible();
  await expect(timeline.locator('output')).toHaveText('Live');
  await page.getByRole('button', { name: 'Open Wallet panel', exact: true }).click();
  await expect(wallet).toHaveAttribute('data-runtime-id', fixture.runtimeId);
  expect(sockets[0]?.isClosed()).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('xln-workspace-layout'))).toBeNull();
  await screenshotEvidence(page, testInfo, 'ops-architect-restored-wallet');
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});

test('Architect creates an exact BrowserVM stack, 3x3 topology, reserves, and R2R without replacing the local Runtime', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(180_000);
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  const deploymentRpc = await readStackManagerRpcFixture(page);
  const towerUrl = await createIsolatedRecoveryTowerFixture(page, `architect-${testInfo.project.name}`);
  const importedStackResponse = await page.request.post(
    `${new URL(fixture.wsUrl.replace('ws:', 'http:')).origin}/api/control/stack-manager/deploy`,
    {
      headers: { authorization: `Bearer ${fixture.token}` },
      data: {
        name: `Architect import source ${testInfo.project.name}`,
        key: `architect-import-${testInfo.project.name}`,
        rpcUrl: deploymentRpc.rpcUrl,
        expectedChainId: deploymentRpc.chainId,
        blockTimeMs: 1_000,
        currency: 'ETH',
        explorer: '',
        signerId: fixture.runtimeId,
        foundationRecipient: fixture.runtimeId,
        stablecoin: { kind: 'test' },
        publication: 'local',
        confirmations: 1,
      },
    },
  );
  expect(importedStackResponse.ok()).toBe(true);
  const importedStack = await importedStackResponse.json() as {
    ok: true;
    result: {
      manifest: {
        chainId: number;
        entityProviderDeploymentBlock: number;
        contracts: Record<'depository' | 'entityProvider' | 'account' | 'deltaTransformer', string>;
      };
    };
  };
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
  const runtimeId = await page.getByTestId('ops-owner-unlock').getAttribute('data-runtime-id');
  await page.getByRole('button', { name: 'Open Architect panel', exact: true }).click();
  const architect = page.getByTestId('workspace-architect');
  const name = `Architect ${testInfo.project.name}`;
  await architect.getByLabel('Jurisdiction name', { exact: true }).fill(name);
  await architect.getByLabel('Jurisdiction chain ID', { exact: true }).fill('31338');
  await architect.getByRole('button', { name: 'Create jurisdiction', exact: true }).click();
  await expect(architect.getByText(new RegExp(`${name} committed on chain 31338`))).toBeVisible({ timeout: 60_000 });
  await expect(architect.getByLabel('Architect selected stack', { exact: true })).toHaveValue(name);
  await architect.getByRole('button', { name: 'Create 3×3 hub', exact: true }).click();
  await expect(architect.getByText('Created 9 demo Entities.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(architect).toContainText('9 Entities in the selected stack');
  await architect.getByRole('button', { name: 'Create 3×3 hub', exact: true }).click();
  await expect(architect.getByRole('alert')).toHaveText('ARCHITECT_DEMO_ALREADY_EXISTS');
  await architect.getByRole('button', { name: 'Fund all reserves', exact: true }).click();
  await expect(architect.getByText('Observed 9 reserves at or above 1000000 raw units.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await architect.getByRole('button', { name: 'Send R2R transfer', exact: true }).click();
  await expect(architect.getByText(/^R2R committed at Runtime h\d+\.$/)).toBeVisible({ timeout: 30_000 });
  await screenshotEvidence(page, testInfo, 'ops-architect-live-economy');
  await page.getByRole('button', { name: 'Open Jurisdiction panel', exact: true }).click();
  const jurisdiction = page.getByTestId('workspace-jurisdiction');
  await expect(jurisdiction.getByLabel('Jurisdiction', { exact: true })).toHaveValue(name);
  await expect(jurisdiction.getByLabel('Jurisdiction token', { exact: true })).toHaveValue('1');
  await expect(jurisdiction.getByLabel('Jurisdiction token', { exact: true })).toContainText('USDC · #1');
  await expect(jurisdiction.getByRole('table', { name: 'Fresh external balances' }).locator('tbody tr')).toHaveCount(9);
  await expect(jurisdiction.getByRole('table', { name: 'Fresh external balances' }).locator('tbody tr').first()).toContainText('0');
  await page.getByRole('button', { name: 'Open J-Machine Inspector panel', exact: true }).click();
  const inspector = page.getByTestId('jmachine-storage-inspector');
  const sourceStack = await inspector.getByLabel('Inspect J-Machine', { exact: true }).locator('option').evaluateAll(
    (options, created) => options.map(option => (option as HTMLOptionElement).value).find(value => value !== created) || '',
    name,
  );
  expect(sourceStack).not.toBe('');
  await inspector.getByLabel('Inspect J-Machine', { exact: true }).selectOption(sourceStack);
  await inspector.getByText('Raw J-Machine state', { exact: true }).click();
  const source = JSON.parse(await inspector.locator('pre').innerText()) as {
    chainId: number;
    rpcs: string[];
    entityProviderDeploymentBlock: number;
    contracts: Record<'depository' | 'entityProvider' | 'account' | 'deltaTransformer', string>;
  };
  expect(new URL(source.rpcs[0]!).origin).toBe(new URL(fixture.recovery.rpcUrl).origin);
  expect(source.entityProviderDeploymentBlock).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Open Architect panel', exact: true }).click();
  const rpcName = `Architect RPC ${testInfo.project.name}`;
  const rpcManifest = importedStack.result.manifest;
  await architect.getByLabel('Jurisdiction import mode', { exact: true }).selectOption('rpc');
  await architect.getByLabel('Jurisdiction name', { exact: true }).fill(rpcName);
  await architect.getByLabel('Jurisdiction chain ID', { exact: true }).fill(String(rpcManifest.chainId));
  await architect.getByLabel('Jurisdiction RPC URL', { exact: true }).fill(deploymentRpc.rpcUrl);
  await architect.getByLabel('EntityProvider deployment block', { exact: true }).fill(String(rpcManifest.entityProviderDeploymentBlock));
  for (const field of ['depository', 'entityProvider', 'account', 'deltaTransformer'] as const) {
    await architect.getByLabel(`Jurisdiction ${field}`, { exact: true }).fill(rpcManifest.contracts[field]);
  }
  await architect.getByRole('button', { name: 'Create jurisdiction', exact: true }).click();
  await expect(architect.getByText(new RegExp(`${rpcName} committed on chain ${rpcManifest.chainId}`))).toBeVisible({ timeout: 60_000 });
  await expect(architect.getByLabel('Architect selected stack', { exact: true })).toHaveValue(rpcName);
  await expect(architect.getByRole('button', { name: 'Reset isolated demo', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Open Settings panel', exact: true }).click();
  const settings = page.getByTestId('workspace-settings');
  await settings.getByRole('button', { name: 'Stack Manager', exact: true }).click();
  const configuredStack = settings.getByLabel('Configured jurisdiction stack', { exact: true });
  await expect(configuredStack.locator('option').filter({ hasText: name })).toHaveCount(1);
  await expect(configuredStack.locator('option').filter({ hasText: rpcName })).toHaveCount(1);
  await configuredStack.selectOption(name);
  await expect(settings.getByTestId('configured-stack-inspection')).toContainText('BrowserVM');
  await expect(settings.getByTestId('configured-stack-inspection')).toContainText('31338');
  await configuredStack.selectOption(rpcName);
  await expect(settings.getByTestId('configured-stack-inspection')).toContainText(deploymentRpc.rpcUrl);
  await expect(settings.getByTestId('configured-stack-inspection')).toContainText(String(rpcManifest.entityProviderDeploymentBlock));
  expect(await page.getByTestId('ops-owner-unlock').getAttribute('data-runtime-id')).toBe(runtimeId);
  await expectPageContained(page);
  expectNoBrowserErrors(errors);
});
