import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from '../browser-evidence';
import {
  createWalletCrossJFixture,
  readWalletCrossJState, selectWalletFixtureRuntime } from './fixtures/wallet-runtime-test-helpers';

test('wallet payments quote committed capacity and build recipient-owned tools', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  const response = await page.goto('/app?payments=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for populated payments').toBe(true);

  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible({ timeout: 90_000 });
  const entity = page.getByLabel('Entity');
  await entity.selectOption(fixture.entityId);
  await expect(entity).toHaveValue(fixture.entityId);
  await expect(page.getByLabel('Recipient').locator('option:checked')).toHaveText('Browser Hub');
  await expect(page.getByLabel('Asset').first().locator('option:checked')).toContainText('USDC');
  await page.getByLabel('Recipient amount').fill('1');
  const directMode = page.getByRole('radio', { name: /Direct/ });
  await page.locator('.wallet-payment-modes label').filter({ hasText: 'Direct' }).click();
  await expect(directMode).toBeChecked();
  await page.getByRole('button', { name: 'Find route' }).click();
  await expect(page.getByText('Cheapest eligible route')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('1 hops')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit quoted payment' })).toBeEnabled();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-payment-direct-quote');

  await page.getByRole('button', { name: 'Receive' }).click();
  await expect(page.getByRole('heading', { name: 'Receive' })).toBeVisible();
  await page.getByLabel('Requested amount · optional').fill('12.5');
  await page.getByLabel('Description · optional').fill('Browser invoice');
  await expect(page.getByAltText('xln payment invoice QR')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.wallet-receive-preview code')).toContainText(
    `${fixture.entityId}?token=1&amount=12.5&desc=Browser+invoice`,
  );
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-payment-receive');

  await page.getByRole('button', { name: 'Operations' }).click();
  await expect(page.getByRole('heading', { name: 'Account operations' })).toBeVisible();
  await page.getByRole('radio', { name: /Lend to hub/ }).click();
  await expect(page.getByLabel('Hub Account').locator('option:checked')).toHaveText('Browser Hub');
  await expect(page.getByRole('button', { name: 'External', exact: true })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-payment-operations');
  expectNoBrowserErrors(errors);
});

test('wallet markets read the committed hub book and persisted activity', { tag: '@functional' }, async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  const response = await page.goto('/app?markets=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for populated markets').toBe(true);

  await expect(page.getByRole('heading', { name: 'Markets' })).toBeVisible({ timeout: 90_000 });
  const entity = page.getByLabel('Entity');
  await entity.selectOption(fixture.entityId);
  await expect(entity).toHaveValue(fixture.entityId);
  const marketSelection = page.getByRole('region', { name: 'Market selection' });
  await expect(marketSelection.getByRole('combobox').nth(0).locator('option:checked')).toHaveText('Browser Hub');
  await expect(marketSelection.getByRole('combobox').nth(1).locator('option:checked')).toHaveText('USDC / WETH');
  await expect(page.getByText('No resting asks')).toBeVisible();
  await expect(page.getByText('Bid', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Place or cross' })).toBeVisible();
  await expect(page.getByText('1 live')).toBeVisible();
  await expect(page.getByText('No cross-jurisdiction route is committed for this Entity.')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-market-committed-book');

  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  // Real chain transactions add persisted events; initial Account creation may
  // now be on an older page. Exercise pagination rather than assuming page 1.
  const activity = page.getByRole('region', { name: 'Activity', exact: true });
  const remainingEvents = new Set(['Account opened', 'extendCredit']);
  for (let pageIndex = 0; pageIndex < 20; pageIndex += 1) {
    for (const title of remainingEvents) {
      const event = activity.getByText(title, { exact: true }).first();
      if (await event.isVisible()) {
        await expect(event).toBeVisible();
        remainingEvents.delete(title);
      }
    }
    if (remainingEvents.size === 0) break;
    const older = activity.getByRole('button', { name: 'Older', exact: true });
    await expect(older).toBeEnabled();
    const currentPage = await activity.locator('footer span').innerText();
    await older.click();
    await expect(activity.locator('footer span')).not.toHaveText(currentPage);
  }
  expect([...remainingEvents], 'both initial committed events remain accessible through Activity').toEqual([]);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-market-activity');
  expectNoBrowserErrors(errors);
});

test(
  'wallet invalidates one exact cross-jurisdiction quote review when route context changes',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const errors = observeBrowserErrors(page);
    const fixture = await selectWalletFixtureRuntime(page);
    const crossFixture = await createWalletCrossJFixture(page);
    const response = await page.goto('/app?markets=1', { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), 'document response for cross-j quote review').toBe(true);

    await expect(page.getByRole('heading', { name: 'Markets' })).toBeVisible({ timeout: 90_000 });
    const entity = page.getByLabel('Entity');
    await entity.selectOption(fixture.entityId);
    const marketSelection = page.getByRole('region', { name: 'Market selection' });
    await marketSelection.getByRole('combobox').nth(0).selectOption(crossFixture.sourceHubEntityId);
    const ticket = page.getByRole('region', { name: 'Cross-jurisdiction order' });
    await expect(ticket.getByLabel('Target route').locator('option:checked')).toContainText(
      crossFixture.targetJurisdiction,
    );
    await ticket.getByLabel('Cross-j source asset').selectOption('1');
    await ticket.getByLabel('Cross-j target asset').selectOption('2');
    await ticket.getByLabel('Cross-j source amount').fill('1');
    await ticket.getByLabel('Cross-j target amount').fill('0.0004');
    await ticket.getByRole('button', { name: 'Review cross-j route' }).click();

    let review = ticket.getByRole('article', { name: 'Cross-jurisdiction quote review' });
    const orderId = await review.getAttribute('data-order-id');
    expect(orderId).toMatch(/^swap-/);
    await ticket.getByLabel('Cross-j target asset').selectOption('1');
    await expect(review).toHaveCount(0);
    await expect(ticket.getByRole('button', { name: 'Review cross-j route' })).toBeDisabled();
    await entity.selectOption(crossFixture.targetEntityId);
    await expect(entity).toHaveValue(crossFixture.targetEntityId);
    await entity.selectOption(fixture.entityId);
    await marketSelection.getByRole('combobox').nth(0).selectOption(crossFixture.sourceHubEntityId);
    await ticket.getByLabel('Cross-j source asset').selectOption('1');
    await ticket.getByLabel('Cross-j target asset').selectOption('2');
    await ticket.getByLabel('Cross-j source amount').fill('1');
    await ticket.getByLabel('Cross-j target amount').fill('0.0004');
    await ticket.getByRole('button', { name: 'Review cross-j route' }).click();
    review = ticket.getByRole('article', { name: 'Cross-jurisdiction quote review' });
    await expect(review).toHaveAttribute('data-order-id', orderId!);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-market-cross-j-review');
    expectNoBrowserErrors(errors);
  },
);

test(
  'wallet reviews, submits, and cancels one exact cross-jurisdiction order',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const errors = observeBrowserErrors(page);
    const fixture = await selectWalletFixtureRuntime(page);
    const crossFixture = await createWalletCrossJFixture(page);
    const response = await page.goto('/app?markets=1', { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), 'document response for cross-j markets').toBe(true);

    await expect(page.getByRole('heading', { name: 'Markets' })).toBeVisible({ timeout: 90_000 });
    await page.getByLabel('Entity').selectOption(fixture.entityId);
    const marketSelection = page.getByRole('region', { name: 'Market selection' });
    await marketSelection.getByRole('combobox').nth(0).selectOption(crossFixture.sourceHubEntityId);
    await expect(marketSelection.getByRole('combobox').nth(0).locator('option:checked')).toHaveText(
      'Browser Cross Source Hub',
    );
    const ticket = page.getByRole('region', { name: 'Cross-jurisdiction order' });
    await expect(ticket.getByLabel('Target route').locator('option:checked')).toContainText(
      crossFixture.targetJurisdiction,
    );
    await expect(ticket.getByLabel('Target route').locator('option:checked')).toContainText(
      'Browser Target User via Browser Target Hub',
    );
    await ticket.getByLabel('Cross-j source asset').selectOption('1');
    await ticket.getByLabel('Cross-j target asset').selectOption('2');
    await ticket.getByLabel('Cross-j source amount').fill('1');
    await ticket.getByLabel('Cross-j target amount').fill('0.0004');
    await ticket.getByRole('button', { name: 'Review cross-j route' }).click();

    let review = ticket.getByRole('article', { name: 'Cross-jurisdiction quote review' });
    await expect(review).toBeVisible();
    await expect(review).toContainText('1.0 USDC via Browser Cross Source Hub');
    await expect(review).toContainText('0.0004 WETH via Browser Target Hub');
    const orderId = await review.getAttribute('data-order-id');
    expect(orderId).toMatch(/^swap-/);

    await ticket.getByLabel('Cross-j target asset').selectOption('1');
    await expect(review).toHaveCount(0);
    await expect(ticket.getByRole('button', { name: 'Review cross-j route' })).toBeDisabled();
    await ticket.getByLabel('Cross-j target asset').selectOption('2');
    await ticket.getByRole('button', { name: 'Review cross-j route' }).click();
    review = ticket.getByRole('article', { name: 'Cross-jurisdiction quote review' });
    await expect(review).toHaveAttribute('data-order-id', orderId!);
    await review.getByRole('button', { name: 'Submit cross-j order' }).click();

    await expect
      .poll(
        async () => {
          const state = await readWalletCrossJState(page, orderId!);
          return state.rows.find(({ entityId }) => entityId === fixture.entityId)?.status ?? '';
        },
        { timeout: 60_000 },
      )
      .toBe('resting');
    const committed = page.locator(`.wallet-cross-routes article[data-order-id="${orderId}"]`);
    await expect(committed).toHaveAttribute('data-route-status', 'resting', { timeout: 30_000 });
    await screenshotEvidence(page, testInfo, 'wallet-market-cross-j-resting');

    const beforeCancel = await readWalletCrossJState(page, orderId!);
    page.once('dialog', dialog => dialog.dismiss());
    await committed.getByRole('button', { name: 'Cancel cross-j order' }).click();
    expect(await readWalletCrossJState(page, orderId!)).toEqual(beforeCancel);
    page.once('dialog', dialog => dialog.accept());
    await committed.getByRole('button', { name: 'Cancel cross-j order' }).click();
    await expect
      .poll(
        async () => {
          const state = await readWalletCrossJState(page, orderId!);
          return state.rows.find(({ entityId }) => entityId === fixture.entityId)?.status ?? '';
        },
        { timeout: 10_000 },
      )
      .toBe('clear_requested');
    await expect
      .poll(
        async () => {
          const state = await readWalletCrossJState(page, orderId!);
          return state.rows.find(({ entityId }) => entityId === fixture.entityId)?.status ?? '';
        },
        { timeout: 20_000 },
      )
      .toBe('cancelled');
    await expect(committed).toHaveAttribute('data-route-status', 'cancelled', { timeout: 30_000 });
    await expect(committed.getByRole('button', { name: 'Cancel cross-j order' })).toHaveCount(0);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-market-cross-j-cancelled');
    expectNoBrowserErrors(errors);
  },
);
