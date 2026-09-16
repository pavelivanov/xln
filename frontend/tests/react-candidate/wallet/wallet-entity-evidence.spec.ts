import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../browser-evidence';
import { selectWalletFixtureRuntime } from './fixtures/wallet-runtime-test-helpers';

test(
  'Wallet Stack Manager keeps explicit Entity selection and invalidates cancelled or changed reviews',
  { tag: '@resilience' },
  async ({ page }, testInfo) => {
    const { readStackManagerRpcFixture } = await import('./fixtures/wallet-runtime-test-helpers');
    const errors = observeBrowserErrors(page);
    const fixture = await selectWalletFixtureRuntime(page);
    const deploymentRpc = await readStackManagerRpcFixture(page);
    const submissions: string[] = [];
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/control/stack-manager/deploy')
        submissions.push(request.url());
    });
    await page.goto(`/app#settings?entity=${fixture.entityId}`);
    await expect(page.getByLabel('Selected identity')).toHaveValue(fixture.entityId);
    await page.getByRole('link', { name: 'Stack Manager', exact: true }).click();
    const wallet = page.getByTestId('wallet-stack-manager');
    const stack = page.getByTestId('workspace-stack-manager');
    await expect(wallet).toHaveAttribute('data-entity-id', fixture.entityId);
    await expect(wallet).toHaveAttribute('data-runtime-id', fixture.runtimeId);
    await stack.getByTestId('stack-manager-rpc').fill(deploymentRpc.rpcUrl);
    await stack.getByRole('button', { name: 'Probe RPC', exact: true }).click();
    await expect(stack.getByTestId('stack-manager-probe')).toContainText(deploymentRpc.rpcUrl);
    await stack.getByTestId('stack-manager-name').fill('Cancelled Wallet deployment');
    await stack.getByTestId('stack-manager-stablecoin').selectOption('test');
    await stack.getByTestId('stack-manager-confirm').check();
    await expect(stack.getByTestId('stack-manager-deploy')).toBeEnabled();
    await stack.getByTestId('stack-manager-confirm').uncheck();
    await expect(stack.getByTestId('stack-manager-deploy')).toBeDisabled();
    expect(submissions).toEqual([]);
    await screenshotEvidence(page, testInfo, 'wallet-stack-manager-cancelled');
    await page.getByLabel('Selected identity').selectOption(fixture.counterpartyEntityId);
    await expect(wallet).toHaveAttribute('data-entity-id', fixture.counterpartyEntityId);
    await expect(stack.getByTestId('stack-manager-probe')).toHaveCount(0);
    await expect(stack.getByTestId('stack-manager-confirm')).not.toBeChecked();
    await expect(page).toHaveURL(new RegExp(`#settings/stack-manager\\?entity=${fixture.counterpartyEntityId}$`));
    await page.reload();
    await expect(page.getByLabel('Selected identity')).toHaveValue(fixture.counterpartyEntityId);
    await expect(stack.getByTestId('stack-manager-phase')).toBeVisible();
    await expect(stack.getByTestId('stack-manager-rpc')).toHaveValue('');
    expect(submissions).toEqual([]);
    await screenshotEvidence(page, testInfo, 'wallet-stack-manager-reopened');
    await page.evaluate(() => sessionStorage.removeItem('xln-runtime-adapter-key'));
    await page.reload();
    await expect(stack.getByRole('status')).toHaveText('STACK_MANAGER_ADMIN_CAPABILITY_REQUIRED');
    await expect(stack.getByTestId('stack-manager-deployment')).toHaveCount(0);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-stack-manager-revoked');
    expectNoBrowserErrors(errors);
  },
);

test(
  'Wallet Stack Manager deploys and reopens the canonical configured stack through its selected daemon',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    testInfo.setTimeout(180_000);
    const { readStackManagerRpcFixture } = await import('./fixtures/wallet-runtime-test-helpers');
    const errors = observeBrowserErrors(page);
    const fixture = await selectWalletFixtureRuntime(page);
    const deploymentRpc = await readStackManagerRpcFixture(page);
    const name = `Wallet deployed ${testInfo.project.name}`;
    await page.goto(`/app#settings/stack-manager?entity=${fixture.entityId}`);
    const stack = page.getByTestId('workspace-stack-manager');
    await expect(stack.getByTestId('stack-manager-phase')).toBeVisible();
    await stack.getByTestId('stack-manager-rpc').fill(deploymentRpc.rpcUrl);
    await stack.getByRole('button', { name: 'Probe RPC', exact: true }).click();
    await expect(stack.getByTestId('stack-manager-probe')).toContainText(deploymentRpc.rpcUrl);
    await stack.getByTestId('stack-manager-name').fill(name);
    await stack.getByTestId('stack-manager-stablecoin').selectOption('test');
    await stack.getByTestId('stack-manager-confirmations').fill('1');
    await stack.getByTestId('stack-manager-confirm').check();
    await stack.getByTestId('stack-manager-deploy').click();
    await expect(stack.getByTestId('stack-manager-result')).toContainText(`${name} deployed and registered`, {
      timeout: 150_000,
    });
    await expect(stack.getByLabel('Configured jurisdiction stack', { exact: true })).toHaveValue(name);
    await expect(stack.getByTestId('configured-stack-inspection')).toContainText(deploymentRpc.rpcUrl);
    await screenshotEvidence(page, testInfo, 'wallet-stack-manager-deployed');
    expectNoBrowserErrors(errors);
    await stack.getByTestId('stack-manager-confirm').check();
    await stack.getByTestId('stack-manager-deploy').click();
    await expect(stack.getByRole('alert')).toHaveText('STACK_MANAGER_DEPLOY_HTTP_400');
    await page.reload();
    await expect(stack.getByLabel('Configured jurisdiction stack', { exact: true })).toHaveValue(name);
    await expect(stack.getByTestId('configured-stack-inspection')).toContainText(deploymentRpc.rpcUrl);
    await expect(stack.getByTestId('stack-manager-probe')).toHaveCount(0);
    await screenshotEvidence(page, testInfo, 'wallet-stack-manager-configured');
    await expectPageContained(page);
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([
      'Failed to load resource: the server responded with a status of 400 (Bad Request)',
    ]);
  },
);

test('Ownership and Consensus deep links follow the selected real Entity', { tag: '@functional' }, async ({ page }, testInfo) => {
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

  await page.goto(`/app#settings?entity=${fixture.entityId}`);
  await expect(page.getByLabel('Selected identity')).toHaveValue(fixture.entityId);
  await page.getByRole('link', { name: 'Consensus', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#settings/consensus\\?entity=${fixture.entityId}$`));
  const consensus = page.getByTestId('wallet-entity-consensus');
  await expect(consensus).toHaveAttribute('data-entity-id', fixture.entityId);
  await expect(consensus.getByTestId('consensus-threshold')).toHaveText('1 / 1');
  await expect(consensus.getByTestId('consensus-account-heads')).toContainText('A');
  await expect(consensus).toContainText('This view shows committed state. In-flight proposals, votes and locks are not included.');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await expect(consensus).toHaveAttribute('data-entity-id', fixture.counterpartyEntityId);
  await expect(page).toHaveURL(new RegExp(`#settings/consensus\\?entity=${fixture.counterpartyEntityId}$`));
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-consensus-selected-entity');
  await page.reload();
  await expect(consensus).toHaveAttribute('data-entity-id', fixture.counterpartyEntityId);
  expectNoBrowserErrors(errors);
});

test('Ownership reads real released shares, refreshes and discards a delayed read across Entity reversal', { tag: '@resilience' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.post(`http://127.0.0.1:${port}/ownership-fixture`);
  expect(response.ok()).toBe(true);
  const company: unknown = await response.json();
  if (!company || typeof company !== 'object' || !('entityId' in company) || typeof company.entityId !== 'string') throw new Error('OWNERSHIP_FIXTURE_INVALID');
  await page.goto('/app#ownership');
  const entity = page.getByLabel('Entity', { exact: true });
  await expect(entity.locator(`option[value="${company.entityId}"]`)).toHaveCount(1);
  await entity.selectOption(company.entityId);
  const shares = page.getByTestId('ownership-shares');
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('80');
  await expect(shares.getByTestId('ownership-dividend-reserve')).toHaveText('40');
  await shares.getByRole('button', { name: 'Refresh shares' }).click();
  await expect(shares).toHaveAttribute('aria-busy', 'false');
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('80');

  let releaseRead: (() => void) | undefined;
  const delayed = new Promise<void>(resolve => { releaseRead = resolve; });
  let readStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { readStarted = resolve; });
  await page.route('**/api/tokens', async route => {
    readStarted?.();
    await delayed;
    await route.continue();
  }, { times: 1 });
  await shares.getByRole('button', { name: 'Refresh shares' }).click();
  await started;
  await entity.selectOption(fixture.entityId);
  await expect(shares).toHaveAttribute('data-entity-id', fixture.entityId);
  await expect(shares).toContainText('Share issuance requires a numbered on-chain Entity ID.');
  const lateResponse = page.waitForResponse(response => response.url().endsWith('/api/tokens'));
  releaseRead?.();
  await lateResponse;
  await expect(shares).toHaveAttribute('data-entity-id', fixture.entityId);
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveCount(0);
  await entity.selectOption(company.entityId);
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('80');
  await expect(shares).toHaveAttribute('data-entity-id', company.entityId);
  await expect(shares.getByTestId('ownership-dividend-reserve')).toHaveText('40');
  await expectPageContained(page);
  await page.reload();
  await expect(shares).toHaveAttribute('data-entity-id', company.entityId);
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('80');
  await expect(entity).toHaveValue(company.entityId);
    await expect(page).toHaveURL(new RegExp(`#ownership\\?entity=${company.entityId}$`));
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('80');
  await expect(shares.getByTestId('ownership-dividend-reserve')).toHaveText('40');
  await expect(shares.getByTestId('ownership-confirmed-nonce')).toHaveText('Confirmed action nonce 1');
  await expect(shares.getByTestId('ownership-release-status')).toHaveText('No pending share release.');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await screenshotEvidence(page, testInfo, 'wallet-ownership-shares-refreshed');
  expectNoBrowserErrors(errors);
});


test('Ownership exposes the exact confirmed release nonce from the real Runtime', { tag: '@functional' }, async ({ page }) => {
  await selectWalletFixtureRuntime(page);
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.post(`http://127.0.0.1:${port}/ownership-fixture`);
  expect(response.ok()).toBe(true);
  const company: unknown = await response.json();
  if (!company || typeof company !== 'object' || !('entityId' in company) || typeof company.entityId !== 'string') throw new Error('OWNERSHIP_FIXTURE_INVALID');
  await page.goto('/app#ownership');
  await page.getByLabel('Entity', { exact: true }).selectOption(company.entityId);
  await expect(page.getByTestId('ownership-control-reserve')).toHaveText('80');
  await expect(page.getByTestId('ownership-confirmed-nonce')).toHaveText('Confirmed action nonce 1');
});

test('Ownership review cancellation is inert and submit commits the canonical share release', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await selectWalletFixtureRuntime(page);
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.post(`http://127.0.0.1:${port}/ownership-release-fixture?slot=${encodeURIComponent(testInfo.project.name)}`);
  expect(response.ok()).toBe(true);
  const company: unknown = await response.json();
  if (!company || typeof company !== 'object' || !('entityId' in company) || typeof company.entityId !== 'string') throw new Error('OWNERSHIP_RELEASE_FIXTURE_INVALID');
  const readAction = async () => {
    const state = await page.request.get(`http://127.0.0.1:${port}/ownership-action-state?entityId=${company.entityId}`);
    expect(state.ok()).toBe(true);
    return state.json() as Promise<{ confirmedNonce: string; pendingKind: string | null }>;
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
  await expect(review).toHaveCount(0);
  expect(await readAction()).toEqual({ confirmedNonce: '0', pendingKind: null });

  await shares.getByTestId('ownership-release-shares').click();
  await shares.getByTestId('ownership-release-submit').click();
  await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('100000000000', { timeout: 30_000 });
  await expect(shares.getByTestId('ownership-dividend-reserve')).toHaveText('100000000000');
  await expect(shares.getByTestId('ownership-confirmed-nonce')).toHaveText('Confirmed action nonce 1');
  expect(await readAction()).toEqual({ confirmedNonce: '1', pendingKind: null });
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-ownership-release-committed');
  expectNoBrowserErrors(errors);
});

test('Ownership selects an eligible CONTROL target and observes the committed board proposal', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  await selectWalletFixtureRuntime(page);
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.post(`http://127.0.0.1:${port}/ownership-governance-fixture?slot=${encodeURIComponent(testInfo.project.name)}`);
  expect(response.ok()).toBe(true);
  const fixture = await response.json() as { shareholderEntityId: string; targetEntityId: string; targetName: string; expectedBoardHash: string };
  const readBoard = async () => {
    const board = await page.request.get(`http://127.0.0.1:${port}/ownership-board-state?entityId=${fixture.targetEntityId}`);
    expect(board.ok()).toBe(true);
    return board.json() as Promise<{ currentBoardHash: string; proposedBoardHash: string; actionNonce: string }>;
  };
  await page.goto('/app#ownership');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.shareholderEntityId);
  const governance = page.getByTestId('ownership-control-takeover');
  const target = governance.getByTestId('ownership-takeover-target');
  await expect(target.locator(`option[value="${fixture.targetEntityId}"]`)).toHaveText(fixture.targetName);
  await target.selectOption(fixture.targetEntityId);
  await expect(governance.getByTestId('ownership-takeover-status')).toContainText('No pending board proposal');
  await governance.getByTestId('ownership-takeover-propose').click();
  const review = governance.getByTestId('ownership-takeover-review');
  await expect(review).toContainText(fixture.targetName);
  await expect(review).toContainText(fixture.expectedBoardHash);
  await expect(review).toContainText('Action nonce');
  await review.getByRole('button', { name: 'Cancel' }).click();
  expect((await readBoard()).actionNonce).toBe('0');

  await governance.getByTestId('ownership-takeover-propose').click();
  await governance.getByTestId('ownership-takeover-submit').click();
  await expect(governance.getByTestId('ownership-proposed-board')).toHaveText(fixture.expectedBoardHash, { timeout: 30_000 });
  await expect(page.locator('.wallet-account-command')).toContainText('Committed at Runtime height');
  await expect(page.getByRole('alert')).toHaveCount(0);
  const committed = await readBoard();
  expect(committed.proposedBoardHash).toBe(fixture.expectedBoardHash);
  expect(committed.actionNonce).toBe('1');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-ownership-control-proposed');
  expectNoBrowserErrors(errors);
});

test(
  'Ownership keeps activation gated until the exact successor is ready for review',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    const errors = observeBrowserErrors(page);
    await selectWalletFixtureRuntime(page);
    const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
    const response = await page.request.post(
      `http://127.0.0.1:${port}/ownership-activation-fixture?slot=${encodeURIComponent(testInfo.project.name)}`,
    );
    expect(response.ok()).toBe(true);
    const fixture = (await response.json()) as {
      shareholderEntityId: string;
      targetEntityId: string;
      targetName: string;
      successorSignerId: string;
      expectedBoardHash: string;
    };
    const readBoard = async () => {
      const board = await page.request.get(
        `http://127.0.0.1:${port}/ownership-board-state?entityId=${fixture.targetEntityId}&signerId=${fixture.successorSignerId}`,
      );
      expect(board.ok()).toBe(true);
      return board.json() as Promise<{
        currentBoardHash: string;
        proposedBoardHash: string;
        actionNonce: string;
        boardEpoch: string;
        runtimeBoardHash: string | null;
        runtimeThreshold: string | null;
      }>;
    };
    await page.goto('/app#ownership');
    await page.getByLabel('Entity', { exact: true }).selectOption(fixture.shareholderEntityId);
    const governance = page.getByTestId('ownership-control-takeover');
    await governance.getByTestId('ownership-takeover-target').selectOption(fixture.targetEntityId);
    const activate = governance.getByTestId('ownership-takeover-activate');
    await expect(activate).toBeDisabled();

    await governance.getByTestId('ownership-takeover-propose').click();
    await governance.getByTestId('ownership-takeover-submit').click();
    await expect(governance.getByTestId('ownership-proposed-board')).toHaveText(fixture.expectedBoardHash, {
      timeout: 30_000,
    });
    await expect(activate).toBeDisabled();
    const pending = await readBoard();
    expect(pending.currentBoardHash).not.toBe(fixture.expectedBoardHash);
    expect(pending.proposedBoardHash).toBe(fixture.expectedBoardHash);
    expect(pending.actionNonce).toBe('1');
    expect(pending.boardEpoch).toBe('0');

    const advanced = await page.request.post(
      `http://127.0.0.1:${port}/ownership-activation-ready?slot=${encodeURIComponent(testInfo.project.name)}`,
    );
    expect(advanced.ok()).toBe(true);
    await governance.getByRole('button', { name: 'Refresh status' }).click();
    await expect(activate).toBeEnabled();
    await activate.click();
    const review = governance.getByTestId('ownership-activation-review');
    await expect(review).toContainText(fixture.targetName);
    await expect(review).toContainText(fixture.expectedBoardHash);
    await expect(review).toContainText('Action nonce');
    await review.getByRole('button', { name: 'Cancel' }).click();
    expect((await readBoard()).proposedBoardHash).toBe(fixture.expectedBoardHash);
    await activate.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-ownership-control-activation-ready');
    expectNoBrowserErrors(errors);
  },
);

test(
  'Ownership shows a committed successor board as active and synchronized',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    const errors = observeBrowserErrors(page);
    await selectWalletFixtureRuntime(page);
    const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
    const response = await page.request.post(
      `http://127.0.0.1:${port}/ownership-activated-fixture?slot=${encodeURIComponent(testInfo.project.name)}`,
    );
    expect(response.ok()).toBe(true);
    const fixture = (await response.json()) as {
      shareholderEntityId: string;
      targetEntityId: string;
      successorSignerId: string;
      expectedBoardHash: string;
    };
    await page.goto('/app#ownership');
    await page.getByLabel('Entity', { exact: true }).selectOption(fixture.shareholderEntityId);
    const governance = page.getByTestId('ownership-control-takeover');
    await governance.getByTestId('ownership-takeover-target').selectOption(fixture.targetEntityId);
    await expect(governance.getByTestId('ownership-current-board')).toHaveText(fixture.expectedBoardHash);
    await expect(governance.getByTestId('ownership-activation-state')).toContainText('active and synchronized');
    await expect(governance.getByTestId('ownership-proposed-board')).toHaveCount(0);
    await expect(governance.getByTestId('ownership-takeover-propose')).toBeDisabled();
    await expect(governance.getByTestId('ownership-takeover-activate')).toBeDisabled();
    const boardResponse = await page.request.get(
      `http://127.0.0.1:${port}/ownership-board-state?entityId=${fixture.targetEntityId}&signerId=${fixture.successorSignerId}`,
    );
    expect(boardResponse.ok()).toBe(true);
    await expect(boardResponse.json()).resolves.toMatchObject({
      currentBoardHash: fixture.expectedBoardHash,
      proposedBoardHash: `0x${'00'.repeat(32)}`,
      runtimeBoardHash: fixture.expectedBoardHash,
      runtimeThreshold: '1',
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-ownership-control-activated');
    expectNoBrowserErrors(errors);
  },
);
