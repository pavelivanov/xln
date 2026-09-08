import { openWorkspaceStorageOrigin } from '../../browser-evidence';
import { expect, test, type Locator, type WebSocket } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import {
  createWalletCrossJFixture, installImportedRuntime,
  readWalletAccountToolState,
  readWalletCrossJState,
  readWalletFixtureChainBalances, readWalletRuntimeFixture } from '../../wallet/fixtures/wallet-runtime-test-helpers';

const openTool = async (wallet: Locator, id: string): Promise<void> => {
  const mobile = wallet.getByTestId('account-workspace-mobile-toggle');
  if (await mobile.isVisible()) await mobile.click();
  await wallet.getByTestId(`account-workspace-tab-${id}`).filter({ visible: true }).click();
};

test('docked Wallet borrows one Runtime across Account, payment and market navigation', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await openWorkspaceStorageOrigin(page);
  await installImportedRuntime(page, fixture);
  const sockets: WebSocket[] = [];
  page.on('websocket', socket => { if (socket.url() === fixture.wsUrl) sockets.push(socket); });
  await page.goto('/__app/ops/entity-workspace');
  await page.getByRole('button', { name: 'Open Wallet panel' }).click();
  const wallet = page.getByTestId('ops-wallet-panel');
  await expect(wallet).toHaveAttribute('data-runtime-id', fixture.runtimeId);
  await expect(wallet.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible();
  await wallet.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await expect(wallet.getByRole('table', { name: 'Committed asset positions' })).toContainText('USDC');
  await screenshotEvidence(page, testInfo, 'ops-wallet-assets');
  await openTool(wallet, 'send');
  await expect(wallet.getByRole('heading', { name: 'Payments' })).toBeVisible();
  await expect(wallet.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  await wallet.getByLabel('Recipient amount').fill('1');
  await wallet.locator('.wallet-payment-modes label').filter({ hasText: 'Direct' }).click();
  await wallet.getByRole('button', { name: 'Find route' }).click();
  await expect(wallet.getByText('Cheapest eligible route')).toBeVisible();
  await wallet.getByRole('button', { name: 'Submit quoted payment' }).scrollIntoViewIfNeeded();
  await expect(wallet.getByRole('button', { name: 'Submit quoted payment' })).toBeInViewport();
  await expect(page.locator('.dv-tab').filter({ hasText: /^Wallet$/ })).toBeInViewport();
  expect(await wallet.evaluate(element => element.closest('.dv-view')?.scrollTop)).toBe(0);
  await screenshotEvidence(page, testInfo, 'ops-wallet-payment-quote');
  await openTool(wallet, 'swap');
  await expect(wallet.getByRole('heading', { name: 'Markets' })).toBeVisible();
  await expect(wallet.getByRole('region', { name: 'Market selection' })).toContainText('USDC / WETH');
  await screenshotEvidence(page, testInfo, 'ops-wallet-market');
  await wallet.getByRole('navigation', { name: 'Wallet sections' }).getByRole('button', { name: 'Assets', exact: true }).click();
  await wallet.getByRole('button', { name: 'View Account' }).first().click();
  await expect(wallet.getByTestId('account-panel')).toBeVisible();
  await wallet.getByRole('button', { name: 'Manage', exact: true }).click();
  await expect(wallet.getByRole('heading', { name: 'Manage Account' })).toBeVisible();
  await expect(wallet.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-wallet-manage');
  await openTool(wallet, 'move');
  await expect(wallet.getByRole('heading', { name: 'Move', exact: true })).toBeVisible();
  await expect(wallet.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  await screenshotEvidence(page, testInfo, 'ops-wallet-move');
  await expect(page).toHaveURL(/\/__app\/ops\/entity-workspace$/);
  expect(sockets).toHaveLength(1);
  await page.locator('.dv-tab').filter({ hasText: /^Wallet$/ }).locator('.dv-default-tab-action').click();
  await expect(wallet).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Gossip panel' }).click();
  await expect(page.getByTestId('runtime-gossip-panel')).toContainText('Browser Hub');
  expect(sockets[0]?.isClosed()).toBe(false);
  await page.getByRole('button', { name: 'Open Wallet panel' }).click();
  await expect(wallet.getByRole('table', { name: 'Committed asset positions' })).toBeVisible();
  expect(sockets).toHaveLength(1);
  const timeline = page.getByTestId('workspace-network-timeline');
  await timeline.getByRole('button', { name: 'Load timeline' }).click();
  await expect(timeline.getByRole('button', { name: 'Next network frame' })).toBeEnabled();
  await timeline.getByRole('button', { name: 'Next network frame' }).click();
  await expect(timeline.locator('output')).toContainText('/');
  await expect(wallet).toHaveCount(0);
  await timeline.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(wallet.getByRole('table', { name: 'Committed asset positions' })).toBeVisible();
  expect(sockets).toHaveLength(1);
  expectNoBrowserErrors(errors);
});

test('docked Wallet follows the selected scenario without mounting live commands', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  await page.goto('/__app/ops/entity-workspace?scenario=ahb');
  const timeline = page.getByTestId('workspace-network-timeline');
  await expect(timeline.locator('output')).toContainText('1/', { timeout: 90_000 });
  await timeline.getByLabel('Network frame', { exact: true }).focus();
  await timeline.getByLabel('Network frame', { exact: true }).press('End');
  await page.getByRole('button', { name: 'Open Wallet panel' }).click();
  const entity = page.getByTestId('entity-workspace-shell').filter({ visible: true });
  await expect(entity).toHaveAttribute('data-entity-id', /0x[0-9a-f]{64}/);
  await expect(page.getByTestId('ops-wallet-panel')).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'ops-wallet-recorded');
  expectNoBrowserErrors(errors);
});

test(
  'docked shared actions keep exact owner, settlement, and cross-j context',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const errors = observeBrowserErrors(page);
    const fixture = await readWalletRuntimeFixture(page);
    const controlBase = fixture.wsUrl.replace(/^ws:/u, 'http:').replace(/\/rpc$/u, '');
    const companyResponse = await page.request.post(
      `${controlBase}/ownership-release-fixture?slot=${encodeURIComponent(testInfo.project.name)}`,
    );
    const companyBody = await companyResponse.text();
    expect(companyResponse.ok(), companyBody).toBe(true);
    const company = JSON.parse(companyBody) as { entityId: string };
    const crossFixture = await createWalletCrossJFixture(page);

    await openWorkspaceStorageOrigin(page);
    await installImportedRuntime(page, fixture);
    const sockets: WebSocket[] = [];
    page.on('websocket', socket => {
      if (socket.url() === fixture.wsUrl) sockets.push(socket);
    });
    await page.goto('/__app/ops/entity-workspace');
    await page.getByRole('button', { name: 'Open Wallet panel' }).click();
    const wallet = page.getByTestId('ops-wallet-panel');
    await expect(wallet).toHaveAttribute('data-runtime-id', fixture.runtimeId);

    await wallet
      .getByRole('navigation', { name: 'Wallet sections' })
      .getByRole('button', { name: 'Ownership' })
      .click();
    await wallet.getByLabel('Entity', { exact: true }).selectOption(company.entityId);
    const shares = wallet.getByTestId('ownership-shares');
    await shares.getByTestId('ownership-release-shares').click();
    const releaseReview = shares.getByTestId('ownership-release-review');
    await expect(releaseReview).toContainText('100000000000');
    await wallet.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    await expect(releaseReview).toHaveCount(0);
    await wallet.getByLabel('Entity', { exact: true }).selectOption(company.entityId);
    await shares.getByTestId('ownership-release-shares').click();
    await shares.getByTestId('ownership-release-submit').click();
    await expect(shares.getByTestId('ownership-control-reserve')).toHaveText('100000000000', { timeout: 30_000 });

    await wallet.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    await wallet
      .getByRole('navigation', { name: 'Wallet sections' })
      .getByRole('button', { name: 'Assets', exact: true })
      .click();
    await expect(wallet.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible();
    await openTool(wallet, 'send');
    await wallet.getByRole('button', { name: 'Operations' }).click();
    await wallet.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    const beforeFunding = await readWalletFixtureChainBalances(page);
    await wallet.getByRole('radio', { name: /Fund collateral/ }).click();
    await wallet.getByRole('combobox', { name: 'Counterparty Account' }).selectOption(fixture.counterpartyEntityId);
    await wallet.getByRole('textbox', { name: 'Amount', exact: true }).fill('50');
    await wallet.getByRole('button', { name: 'Queue collateral funding' }).click();
    const batch = wallet.getByRole('region', { name: 'Jurisdiction batch' });
    await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible({ timeout: 30_000 });
    await batch.getByRole('button', { name: 'Broadcast draft' }).click();
    await expect
      .poll(async () => readWalletFixtureChainBalances(page), { timeout: 45_000 })
      .toEqual({
        reserve: beforeFunding.reserve - 50_000_000n,
        collateral: beforeFunding.collateral + 50_000_000n,
        chainReserve: beforeFunding.chainReserve - 50_000_000n,
        chainCollateral: beforeFunding.chainCollateral + 50_000_000n,
      });
    await wallet.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(batch.getByText('No queued operations.')).toBeVisible({ timeout: 30_000 });
    await wallet.getByRole('radio', { name: /Withdraw collateral/ }).click();
    await wallet.getByRole('combobox', { name: 'Counterparty Account' }).selectOption(fixture.counterpartyEntityId);
    await wallet.getByRole('textbox', { name: 'Amount', exact: true }).fill('2');
    await wallet.getByRole('button', { name: 'Review settlement' }).click();
    const settlementReview = wallet.getByRole('region', { name: 'Collateral → Reserve' });
    await expect(settlementReview).toContainText(fixture.entityId);
    await expect(settlementReview).toContainText(fixture.counterpartyEntityId);
    await settlementReview.getByRole('button', { name: 'Submit settlement proposal' }).click();
    await expect
      .poll(
        async () =>
          String(
            (await readWalletAccountToolState(page, fixture.entityId, fixture.counterpartyEntityId))['settlement'] ||
              '',
          ),
        { timeout: 30_000 },
      )
      .toContain('settle-c2r');
    await expect(wallet.locator('.wallet-payment-command')).toContainText('observed', { timeout: 30_000 });
    await wallet.getByRole('radio', { name: /Reserve transfer/ }).click();
    await wallet.getByRole('combobox', { name: 'Recipient', exact: true }).selectOption(fixture.counterpartyEntityId);
    await wallet.getByRole('textbox', { name: 'Amount', exact: true }).fill('1');
    await wallet.getByRole('button', { name: 'Queue reserve transfer' }).click();
    await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible({ timeout: 30_000 });
    await expect(batch.locator('summary')).toContainText('1.0 USDC');
    await openTool(wallet, 'swap');
    await openTool(wallet, 'send');
    await wallet.getByRole('button', { name: 'Operations' }).click();
    await expect(wallet.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
    await expect(batch.locator('summary')).toContainText('1.0 USDC');
    await batch.getByRole('button', { name: 'Review clear' }).click();
    await batch
      .getByRole('region', { name: 'Confirm clear batch' })
      .getByRole('button', { name: 'Clear exact batch' })
      .click();
    await expect(batch.getByText('No queued operations.')).toBeVisible({ timeout: 30_000 });

    await openTool(wallet, 'swap');
    await wallet.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    const marketSelection = wallet.getByRole('region', { name: 'Market selection' });
    await marketSelection.getByRole('combobox').nth(0).selectOption(crossFixture.sourceHubEntityId);
    const ticket = wallet.getByRole('region', { name: 'Cross-jurisdiction order' });
    await expect(ticket.getByLabel('Target route').locator('option:checked')).toContainText(
      crossFixture.targetJurisdiction,
    );
    await ticket.getByLabel('Cross-j source asset').selectOption('1');
    await ticket.getByLabel('Cross-j target asset').selectOption('2');
    const crossAmount =
      testInfo.project.name === 'mobile-390x844' ? 1 : testInfo.project.name === 'laptop-1366x900' ? 2 : 3;
    const crossTargetAmount = ['0.0004', '0.0008', '0.0012'][crossAmount - 1]!;
    await ticket.getByLabel('Cross-j source amount').fill(String(crossAmount));
    await ticket.getByLabel('Cross-j target amount').fill(crossTargetAmount);
    await ticket.getByRole('button', { name: 'Review cross-j route' }).click();
    let crossReview = ticket.getByRole('article', { name: 'Cross-jurisdiction quote review' });
    const staleOrderId = await crossReview.getAttribute('data-order-id');
    await wallet.getByLabel('Entity', { exact: true }).selectOption(company.entityId);
    await expect(crossReview).toHaveCount(0);
    await wallet.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    await marketSelection.getByRole('combobox').nth(0).selectOption(crossFixture.sourceHubEntityId);
    await ticket.getByLabel('Cross-j source asset').selectOption('1');
    await ticket.getByLabel('Cross-j target asset').selectOption('2');
    await ticket.getByLabel('Cross-j source amount').fill(String(crossAmount));
    await ticket.getByLabel('Cross-j target amount').fill(crossTargetAmount);
    await ticket.getByRole('button', { name: 'Review cross-j route' }).click();
    crossReview = ticket.getByRole('article', { name: 'Cross-jurisdiction quote review' });
    await expect(crossReview).toHaveAttribute('data-order-id', staleOrderId!);
    await crossReview.getByRole('button', { name: 'Submit cross-j order' }).click();
    await expect
      .poll(
        async () => {
          const state = await readWalletCrossJState(page, staleOrderId!);
          return state.rows.find(({ entityId }) => entityId === fixture.entityId)?.status ?? '';
        },
        { timeout: 60_000 },
      )
      .toBe('resting');
    await expect(wallet.locator(`.wallet-cross-routes article[data-order-id="${staleOrderId}"]`)).toHaveAttribute(
      'data-route-status',
      'resting',
      { timeout: 30_000 },
    );
    expect(sockets).toHaveLength(1);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'ops-wallet-shared-actions');
    expectNoBrowserErrors(errors);
  },
);
