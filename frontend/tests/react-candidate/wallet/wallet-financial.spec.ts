import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from '../browser-evidence';
import { selectWalletFixtureRuntime } from './fixtures/wallet-runtime-test-helpers';
import {
  createWalletDisputeFixture,
  fundWalletDebtReserve,
  readWalletAccountToolState,
  readWalletDebtLedgerState,
  seedWalletDebtPayment,
} from './fixtures/wallet-runtime-test-helpers';
import { expectWalletHistoryEvents } from './fixtures/wallet-history-test-helpers';

test('wallet portfolio renders a real committed bilateral Account', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  const response = await page.goto('/app?portfolio=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for populated portfolio').toBe(true);

  await expect(page.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible({ timeout: 90_000 });
  const entity = page.getByLabel('Entity');
  await entity.selectOption(fixture.entityId);
  await expect(entity).toHaveValue(fixture.entityId);
  await expect(page.getByRole('table', { name: 'Committed asset positions' })).toBeVisible();
  await expect(page.getByLabel('Accounts', { exact: true }).getByText('Browser Hub')).toBeVisible();
  await expect(page.getByText('USDC').first()).toBeVisible();
  await expect(page.getByText('1 shown · 1 total')).toBeVisible();
  await expect(page.getByText('Peer granted us').first()).toBeVisible();
  await expect(page.getByText('We granted peer').first()).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-portfolio-populated');
  expectNoBrowserErrors(errors);
});

test('wallet financial health renders committed Account and activity evidence', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  const response = await page.goto('/app?health=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for populated financial health').toBe(true);

  await expect(page.getByRole('heading', { name: 'Financial health' })).toBeVisible({ timeout: 90_000 });
  const entity = page.getByLabel('Entity');
  await entity.selectOption(fixture.entityId);
  await expect(entity).toHaveValue(fixture.entityId);
  await expect(page.getByRole('heading', { name: 'Open debt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Runtime solvency' })).toBeVisible();
  await expect(page.getByText('2 Entities · 2 Account views')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dispute lifecycle' })).toBeVisible();
  await expect(page.getByText('1 Accounts · page 1')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Committed history' })).toBeVisible();
  await expectWalletHistoryEvents(page, ['Account opened', 'extendCredit']);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-financial-health-populated');
  expectNoBrowserErrors(errors);
});

test(
  'wallet debt and dispute rows deep-link exact context and enforce one retained FIFO debt',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const errors = observeBrowserErrors(page);
    const fixture = await selectWalletFixtureRuntime(page);
    const hub = await createWalletDisputeFixture(page, `${testInfo.project.name}-debt`);

    await page.goto('/app#accounts/configure');
    await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    await page.getByLabel('Account', { exact: true }).selectOption(hub.entityId);
    await page.getByLabel('Credit amount', { exact: true }).fill('100');
    await page.getByRole('button', { name: 'Extend Credit', exact: true }).last().click();
    await expect
      .poll(async () => (await readWalletAccountToolState(page, fixture.entityId, hub.entityId))['peerCreditLimit'], {
        timeout: 30_000,
      })
      .toBe('100000000');

    await seedWalletDebtPayment(page, hub.entityId, fixture.entityId, 25_000_000n);
    await expect
      .poll(
        async () =>
          BigInt(String((await readWalletAccountToolState(page, fixture.entityId, hub.entityId))['outPeerCredit'])),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(10_000_000n);

    await page.goto('/app#accounts/configure');
    await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    await page.getByLabel('Account', { exact: true }).selectOption(hub.entityId);
    await page.getByTestId('configure-tab-dispute').click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByTestId('configure-dispute-prepare').click();
    let batch = page.getByRole('region', { name: 'Jurisdiction batch' });
    await expect(batch.getByText('Start dispute', { exact: false })).toBeVisible({ timeout: 20_000 });
    await batch.getByRole('button', { name: 'Broadcast draft' }).click();
    await expect
      .poll(
        async () => {
          const active = (await readWalletAccountToolState(page, fixture.entityId, hub.entityId))['activeDispute'];
          return Boolean(active && (active as Record<string, unknown>)['observedOnChain']);
        },
        { timeout: 45_000 },
      )
      .toBe(true);

    await page.goto('/app?health=1');
    await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    const disputeLink = page.locator(`[data-testid="wallet-dispute-account-link"][href*="account=${hub.entityId}"]`);
    await expect(disputeLink).toHaveAttribute(
      'href',
      new RegExp(`entity=${fixture.entityId}.*account=${hub.entityId}.*token=1`),
    );
    await disputeLink.click();
    let panel = page.getByTestId('account-panel');
    await expect(panel).toHaveAttribute('data-counterparty-id', hub.entityId);
    await expect(panel).toHaveAttribute('data-focused-token-id', '1');
    await expect(panel.locator('[data-token-id="1"] table')).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    panel = page.getByTestId('account-panel');
    await expect(panel).toHaveAttribute('data-counterparty-id', hub.entityId, { timeout: 90_000 });
    await expect(panel.locator('[data-token-id="1"] table')).toBeVisible();

    await page.goto('/app#accounts/configure');
    await page.getByLabel('Entity', { exact: true }).selectOption(hub.entityId);
    await page.getByLabel('Account', { exact: true }).selectOption(fixture.entityId);
    await page.getByTestId('configure-tab-dispute').click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByTestId('configure-dispute-finalize').click();
    batch = page.getByRole('region', { name: 'Jurisdiction batch' });
    await expect(batch.getByText('Finalize dispute', { exact: false })).toBeVisible({ timeout: 20_000 });
    await batch.getByRole('button', { name: 'Broadcast draft' }).click();
    await expect
      .poll(async () => (await readWalletDebtLedgerState(page, hub.entityId)).debts[0]?.remainingAmount, {
        timeout: 45_000,
      })
      .toBe('25000000');

    await page.goto('/app?health=1');
    await page.getByLabel('Entity', { exact: true }).selectOption(hub.entityId);
    const debtLink = page.getByTestId('wallet-debt-account-link');
    await expect(debtLink).toHaveAttribute(
      'href',
      new RegExp(`entity=${hub.entityId}.*account=${fixture.entityId}.*token=1`),
    );
    const enforce = page.getByRole('button', { name: 'Enforce USDC debt' });
    await expect(enforce).toBeDisabled();
    await fundWalletDebtReserve(page, hub.entityId, 10_000_000n);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(enforce).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByText('10.0 USDC payable from 10.0 USDC reserve', { exact: false })).toBeVisible();
    const beforeCancel = await readWalletDebtLedgerState(page, hub.entityId);
    page.once('dialog', dialog => dialog.dismiss());
    await enforce.click();
    expect(await readWalletDebtLedgerState(page, hub.entityId)).toEqual(beforeCancel);
    page.once('dialog', dialog => dialog.accept());
    await enforce.click();
    await expect
      .poll(
        async () => {
          const state = await readWalletDebtLedgerState(page, hub.entityId);
          return `${state.reserve}:${state.debts[0]?.remainingAmount}`;
        },
        { timeout: 45_000 },
      )
      .toBe('0:15000000');
    await expect(page.getByText(/Debt enforcement (committed|accepted)/)).toBeVisible();
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-debt-enforced');
    expectNoBrowserErrors(errors);
  },
);
