import { expect, test, type Page } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import { readWalletAccountToolState as toolState, selectWalletFixtureRuntime } from '../fixtures/wallet-runtime-test-helpers';
import { finishOpenedWalletSetup, restoreLocalWallet } from '../onboarding/wallet-onboarding-test-helpers';

test.use({ actionTimeout: 20000 });

const openTool = async (page: Page, id: string) => {
  const toggle = page.getByTestId('account-workspace-mobile-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('navigation', { name: 'Account workspace', exact: true }).getByTestId(`account-workspace-tab-${id}`).filter({ visible: true }).click();
};

test('Manage preserves focused Account and token context and commits credit and token commands', { tag: '@functional' }, async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const errors = observeBrowserErrors(page), fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app?portfolio=1');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.locator('.wallet-portfolio-account').first().getByRole('button', { name: 'View Account' }).click();
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manage Account' })).toBeVisible();
  await expect(page.getByLabel('Account', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  const before = await toolState(page, fixture.entityId, fixture.counterpartyEntityId);
  const credit = BigInt(String(before['peerCreditLimit'])) + 1000000n;
  await page.getByLabel('Credit amount', { exact: true }).fill(String(credit / 1000000n));
  await page.getByRole('button', { name: 'Extend Credit', exact: true }).last().click();
  await expect.poll(async () => (await toolState(page, fixture.entityId, fixture.counterpartyEntityId))['peerCreditLimit']).toBe(String(credit));
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'manage-credit-committed');
  await page.getByTestId('configure-tab-request-credit').click();
  await page.getByLabel('Credit amount', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Request Credit', exact: true }).last().click();
  await expect(page.getByText('Requested credit is already available.')).toBeVisible();
  await screenshotEvidence(page, testInfo, 'manage-credit-request-result');
  await page.getByTestId('configure-tab-token').click();
  await page.getByLabel('Asset', { exact: true }).selectOption('3');
  await page.getByTestId('configure-token-add').click();
  await expect.poll(async () => (await toolState(page, fixture.entityId, fixture.counterpartyEntityId))['tokenIds']).toContain(3);
  await openTool(page, 'move');
  await expect(page.getByTestId('move-workspace-accounts')).toBeVisible();
  await openTool(page, 'configure');
  await expect(page.getByLabel('Asset', { exact: true })).toHaveValue('3');
  await page.getByTestId('configure-tab-collateral').click();
  await page.getByLabel('Asset', { exact: true }).selectOption('1');
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'manage-collateral-policy');
  await page.getByTestId('configure-tab-load-testing').click();
  await expect(page.getByTestId('load-test-start')).toBeDisabled();
  await screenshotEvidence(page, testInfo, 'manage-load-testing-remote-boundary');
  await page.getByTestId('configure-tab-dispute').click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByTestId('configure-dispute-prepare').click();
  expect((await toolState(page, fixture.entityId, fixture.counterpartyEntityId))['status']).toBe('active');
  await screenshotEvidence(page, testInfo, 'manage-dispute-cancelled');
  expectNoBrowserErrors(errors);
});

test('Lending renders real API state and preserves its own selection across Account tools', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page), fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app#accounts/lending');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await expect(page.getByLabel('Hub Account', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await page.getByLabel('Asset', { exact: true }).selectOption('2');
  await expect(page.getByTestId('wallet-lending').getByText('Available', { exact: false })).toBeVisible();
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'lending-state-and-forms');
  await openTool(page, 'configure'); await openTool(page, 'lending');
  await expect(page.getByLabel('Asset', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('Hub Account', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  expectNoBrowserErrors(errors);
});

test('Account tools discard stale Entity reads during rapid selection reversal', { tag: '@resilience' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page), fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app#accounts/configure');
  for (const tab of ['configure', 'move', 'lending', 'history']) {
    if (tab !== 'configure') await openTool(page, tab);
    const entity = page.getByLabel('Entity', { exact: true });
    await expect(entity).toBeEnabled();
    await entity.selectOption(fixture.entityId);
    await entity.evaluate((element, ids) => {
      if (!(element instanceof HTMLSelectElement)) throw new Error('ENTITY_SELECT_REQUIRED');
      for (const id of ids) { element.value = id; element.dispatchEvent(new Event('change', { bubbles: true })); }
    }, [fixture.counterpartyEntityId, fixture.entityId]);
    await expect(entity).toHaveValue(fixture.entityId);
    await expect(page.getByText('Loading selected Entity…')).toHaveCount(0);
    await expect(page.getByText('Reading Account context…')).toHaveCount(0);
    if (tab === 'configure') await expect(page.getByLabel('Account', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
    if (tab === 'lending') await expect(page.getByLabel('Hub Account', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'account-tools-entity-reversal');
  expectNoBrowserErrors(errors);
});

test('Move uses the recovered external signer for transfer, allowance and a real deposit draft', { tag: '@functional' }, async ({ page }, testInfo) => {
  test.setTimeout(150000);
  const errors = observeBrowserErrors(page), fixture = await restoreLocalWallet(page);
  await finishOpenedWalletSetup(page);
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await page.getByRole('link', { name: 'Payments', exact: true }).click();
  await page.evaluate(() => { window.location.hash = 'accounts/move'; });
  await page.getByTestId('move-source-external').click(); await page.getByTestId('move-target-external').click();
  await page.getByLabel('Asset', { exact: true }).selectOption('1');
  await expect(page.getByTestId('move-available')).not.toHaveText('Available 0 USDC');
  const before = await page.getByTestId('move-available').textContent();
  await page.getByLabel('Recipient EOA').fill(fixture.recovery.external.recipient);
  await page.getByLabel('Amount', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Send Direct', exact: true }).click();
  await expect(page.getByText('Transfer confirmed.', { exact: false })).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('move-available')).not.toHaveText(before || '');
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'move-external-transfer-confirmed');
  await page.getByTestId('move-target-reserve').click();
  await page.getByLabel('Amount', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Allow amount', exact: true }).click();
  await expect(page.getByText('Approval confirmed.', { exact: false })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Add to Batch', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Jurisdiction batch' })).toContainText('Draft · 1 operations');
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'move-external-deposit-draft');
  expectNoBrowserErrors(errors);
});

test('Manage runs and stops the retained local load controls and prepares a real dispute', { tag: '@functional' }, async ({ page }, testInfo) => {
  test.setTimeout(150000);
  const errors = observeBrowserErrors(page), fixture = await restoreLocalWallet(page, 'hub-discovery');
  await finishOpenedWalletSetup(page);
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await page.getByRole('button', { name: 'Open Account', exact: true }).click();
  const hub = page.locator(`[data-hub-entity-id="${fixture.recovery.hubDiscovery.hubEntityId}"]`);
  await hub.getByTestId('hub-connect-button').click();
  await expect(hub).toHaveAttribute('data-connection-state', 'open', { timeout: 30000 });
  await page.getByRole('button', { name: '← Back to assets' }).click();
  await page.locator('.wallet-portfolio-account').getByRole('button', { name: 'View Account' }).click();
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByTestId('configure-tab-load-testing').click();
  await page.getByTestId('load-test-start').click();
  await expect(page.getByTestId('account-load-testing-panel')).toContainText('1 attempted', { timeout: 10000 });
  await page.getByTestId('load-test-stop').click();
  await expect(page.getByTestId('load-test-start')).toBeVisible();
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'manage-local-load-stopped');
  await page.getByTestId('configure-tab-dispute').click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('configure-dispute-prepare').click();
  const batch = page.getByRole('region', { name: 'Jurisdiction batch' });
  await expect(batch.getByText('Start dispute', { exact: false })).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('configure-dispute-finalize')).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByTestId('configure-dispute-finalize').click();
  await expect(batch.getByText('Draft · 1 operations')).toBeVisible();
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'manage-dispute-start-draft-finalize-cancelled');
  expectNoBrowserErrors(errors);
});

test('Move selects routes with pointer and keyboard, queues a real draft and cancels batch clearing', { tag: '@functional' }, async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const errors = observeBrowserErrors(page), fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app#accounts/move');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  const from = page.getByTestId('move-source-reserve'), to = page.getByTestId('move-target-account');
  const start = await from.boundingBox(), end = await to.boundingBox();
  if (!start || !end) throw new Error('MOVE_NODE_GEOMETRY_MISSING');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 }); await page.mouse.up();
  await expect(from).toHaveAttribute('aria-pressed', 'true'); await expect(to).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Amount', { exact: true }).fill('1');
  await expect(page.getByRole('button', { name: 'Add to Batch', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Add to Batch', exact: true }).click();
  const batch = page.getByRole('region', { name: 'Jurisdiction batch' });
  await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible();
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'move-reserve-account-draft');
  page.once('dialog', dialog => dialog.dismiss()); await batch.getByRole('button', { name: 'Clear batch' }).click();
  await expect(batch.getByRole('heading', { name: 'Draft · 1 operations' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await batch.getByRole('button', { name: 'Clear batch' }).click();
  await expect(batch.getByText('No queued operations.')).toBeVisible();
  const manual = `0x${'77'.repeat(32)}`, counterparty = page.getByLabel('To Account', { exact: true });
  page.once('dialog', dialog => dialog.dismiss()); await counterparty.fill(manual);
  await expect(counterparty).toHaveValue(fixture.counterpartyEntityId);
  page.once('dialog', dialog => dialog.accept()); await counterparty.fill(manual);
  await expect(counterparty).toHaveValue(manual);
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'move-manual-counterparty-confirmed');
  await counterparty.fill(fixture.counterpartyEntityId); await counterparty.press('Escape');
  await page.getByTestId('move-target-reserve').focus(); await page.keyboard.press('Enter');
  await page.getByLabel('To reserve Entity').fill(fixture.counterpartyEntityId);
  await page.getByLabel('Amount', { exact: true }).fill('9999999');
  await expect(page.getByRole('button', { name: 'Add to Batch', exact: true })).toBeDisabled();
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'move-balance-boundary');
  expectNoBrowserErrors(errors);
});

test('History reads real events through filters and modes with Entity context', { tag: '@functional' }, async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const errors = observeBrowserErrors(page), fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app#accounts/history');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await expect(page.getByTestId('entity-history-event').first()).toBeVisible();
  await page.getByTestId('history-type-account').click();
  await expect(page.getByTestId('entity-history-event').first()).toBeVisible();
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'history-account-filter');
  await page.getByTestId('history-search').fill('no-such-event-111');
  await expect(page.getByText('No history in this window.', { exact: false })).toBeVisible();
  await page.getByTestId('history-clear-filters').click();
  await page.getByTestId('history-mode-infinite').click();
  await expect(page.getByTestId('history-load-older')).toBeVisible();
  await page.getByTestId('history-mode-timeframe').click();
  await page.getByTestId('history-from').fill('2026-09-05T12:00'); await page.getByTestId('history-to').fill('2026-09-04T12:00');
  await page.getByTestId('history-apply-timeframe').click();
  await expect(page.getByRole('alert')).toContainText('start must precede end');
  await screenshotEvidence(page, testInfo, 'history-timeframe-validation');
  await page.getByTestId('history-page-size').selectOption('160');
  await page.getByTestId('history-kind-offchain').click();
  await page.getByTestId('history-search').fill('no-such-event-222');
  await expect(page.getByText('No history in this window.', { exact: false })).toBeVisible();
  await page.getByTestId('history-clear-filters').click();
  await expect(page.getByTestId('history-mode-timeframe')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('history-kind-offchain')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('history-page-size')).toHaveValue('160');
  await expect(page.getByTestId('history-search')).toHaveValue('');
  await expect(page.getByTestId('history-from')).toHaveValue('');
  await expect(page.getByTestId('history-to')).toHaveValue('');
  await expect(page.getByTestId('history-type-account')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('entity-history-event').first()).toBeVisible();
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'history-clear-preserves-view');
  await openTool(page, 'configure');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await openTool(page, 'history');
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await expect(page.getByTestId('entity-history-event').first()).toBeVisible();
  expectNoBrowserErrors(errors);
});

test('Lending commits a pool, loan and full repayment using the selected Hub and asset', { tag: '@functional' }, async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const errors = observeBrowserErrors(page), fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app#accounts/lending');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await expect(page.getByLabel('Hub Account', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await page.getByLabel('Asset', { exact: true }).selectOption('1');
  const lending = page.getByTestId('wallet-lending');
  await expect(lending.getByText('No pool positions for this selection.')).toBeVisible();
  await page.getByLabel('Lend amount', { exact: true }).fill('10');
  await page.getByRole('form', { name: 'Lend', exact: true }).getByRole('button', { name: 'Lend', exact: true }).click();
  try { await expect(lending.getByText('10.0 USDC available', { exact: false })).toBeVisible({ timeout: 20000 }); }
  catch (cause) {
    const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
    const state = await page.request.get(`http://127.0.0.1:${port}/account-tool-state?dump=1`);
    await testInfo.attach('lending-runtime-state', { contentType: 'application/json', body: await state.body() });
    throw cause;
  }
  await page.getByLabel('Borrow amount', { exact: true }).fill('1');
  await page.getByRole('form', { name: 'Borrow', exact: true }).getByRole('button', { name: 'Borrow', exact: true }).click();
  const loan = page.getByTestId('lending-loan-row').filter({ hasText: 'active' });
  await expect(loan.getByRole('button', { name: 'Repay remaining', exact: false })).toBeVisible({ timeout: 20000 });
  await expectPageContained(page); await screenshotEvidence(page, testInfo, 'lending-active-loan');
  await loan.getByRole('button', { name: 'Repay remaining', exact: false }).click();
  await expect(page.getByTestId('lending-loan-row').filter({ hasText: 'repaid ·' })).toBeVisible({ timeout: 20000 });
  await screenshotEvidence(page, testInfo, 'lending-repaid-loan');
  await openTool(page, 'move'); await openTool(page, 'lending');
  await expect(page.getByLabel('Hub Account', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await expect(page.getByLabel('Asset', { exact: true })).toHaveValue('1');
  expectNoBrowserErrors(errors);
});
