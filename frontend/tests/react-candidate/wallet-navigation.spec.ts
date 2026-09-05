import { expect, test } from '@playwright/test';

import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';
import { selectWalletFixtureRuntime } from './wallet-runtime-test-helpers';

test('wallet canonical links select subviews and retain Entity through hash and history navigation', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app?portfolio=1#accounts/receive', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Receive', exact: true })).toBeVisible({ timeout: 90_000 });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page).toHaveURL(/#accounts\/send$/);
  await expect(page.getByRole('heading', { name: 'Send a payment' })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Receive', exact: true })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Send a payment' })).toBeVisible();
  await page.evaluate(() => { window.location.hash = 'accounts/receive'; });
  await expect(page.getByRole('heading', { name: 'Receive', exact: true })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-canonical-receive');

  await page.goto('/app#accounts/activity', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.getByRole('button', { name: 'Market', exact: true }).click();
  await expect(page).toHaveURL(/#accounts\/swap$/);
  await expect(page.getByRole('heading', { name: 'Place or cross' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);

  await page.goto('/app#settings/recovery', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Recovery services' })).toBeVisible();
  await expect(page.getByText('Recovery services are configured by the owning local Runtime.')).toBeVisible();
  await expect(page.getByLabel('BrainVault worker cap')).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-canonical-recovery');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(page).toHaveURL(/#settings\/display$/);
  await expect(page.getByLabel('BrainVault worker cap')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Recovery services' })).toBeVisible();
  expectNoBrowserErrors(errors);
});

test('wallet invoice links prefill the current form and reject malformed replacement links', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app#accounts/send', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Send a payment' })).toBeVisible({ timeout: 90_000 });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  const invoice = `${fixture.counterpartyEntityId}?token=1&amount=12.5&desc=Lunch&u=table-3`;
  await page.evaluate((payload) => { window.location.hash = `pay/${encodeURIComponent(payload)}`; }, invoice);
  await expect(page.getByRole('combobox', { name: 'Recipient', exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await expect(page.getByLabel('Recipient amount')).toHaveValue('12.5');
  await expect(page.getByLabel('Recipient amount')).toBeDisabled();
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Lunch | uid:table-3');
  await expect(page.getByLabel('Description', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Find route' })).toBeEnabled();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-canonical-invoice');

  await page.evaluate((target) => { window.location.hash = `pay/${encodeURIComponent(`${target}?token=1&amount=3&desc=Dinner`)}`; }, fixture.counterpartyEntityId);
  await expect(page.getByLabel('Recipient amount')).toHaveValue('3');
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Dinner');
  await expect(page.getByRole('button', { name: 'Submit quoted payment' })).toBeDisabled();
  await page.evaluate(() => { window.location.hash = 'pay/%E0%A4%A'; });
  await expect(page.getByRole('alert')).toHaveText('Wallet link contains an invalid payment payload');
  await expect(page.getByRole('button', { name: 'Find route' })).toBeDisabled();
  await page.getByRole('button', { name: 'Discard invoice' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Recipient amount')).toBeEnabled();
  expectNoBrowserErrors(errors);
});

test('wallet submits only the refreshed payment quote and observes committed activity', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app#accounts/send', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Send a payment' })).toBeVisible({ timeout: 90_000 });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await expect(page.getByRole('combobox', { name: 'Recipient', exact: true })).toHaveValue(fixture.counterpartyEntityId);
  const assetOption = page.getByRole('combobox', { name: 'Asset', exact: true }).locator('option:checked');
  const spendableBefore = await assetOption.textContent();
  await page.getByLabel('Recipient amount').fill('1');
  await page.locator('.wallet-payment-modes label').filter({ hasText: 'Direct' }).click();
  await page.getByRole('button', { name: 'Find route' }).click();
  await expect(page.getByRole('button', { name: 'Submit quoted payment' })).toBeEnabled({ timeout: 30_000 });
  await page.getByLabel('Recipient amount').fill('2');
  await expect(page.getByRole('button', { name: 'Submit quoted payment' })).toBeDisabled();
  await expect(page.getByText('Cheapest eligible route')).toHaveCount(0);
  await page.getByLabel('Description', { exact: true }).fill(`React payment ${testInfo.project.name}`);
  await page.getByRole('button', { name: 'Find route' }).click();
  await expect(page.locator('.wallet-payment-route')).toContainText('2000000 base units');
  await page.getByRole('button', { name: 'Submit quoted payment' }).click();
  await expect(page.locator('.wallet-payment-command')).toContainText('Committed at Runtime height', { timeout: 30_000 });
  await expect(assetOption).not.toHaveText(spendableBefore ?? '');
  await expect(page.getByRole('button', { name: 'Submit quoted payment' })).toBeDisabled();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-payment-committed');

  await page.evaluate(() => { window.location.hash = 'accounts/activity'; });
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  const payment = page.locator('.wallet-market-activity li').filter({ hasText: 'Payment sent' }).first();
  await expect(payment).toContainText('2000000 token 1');
  await expect(payment).toContainText('2.0 USDC');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-payment-persisted-activity');
  expectNoBrowserErrors(errors);
});
