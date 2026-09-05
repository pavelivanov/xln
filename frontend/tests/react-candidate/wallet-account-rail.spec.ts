import { expect, test, type Page } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';
import { selectWalletFixtureRuntime } from './wallet-runtime-test-helpers';

const selectRail = async (page: Page, id: string): Promise<void> => {
  const toggle = page.getByTestId('account-workspace-mobile-toggle');
  if (await toggle.isVisible()) await toggle.click();
  const link = page.getByRole('navigation', { name: 'Account workspace', exact: true }).getByTestId(`account-workspace-tab-${id}`).filter({ visible: true });
  await link.focus();
  await link.press('Enter');
};

test('Account rail keeps the nondefault Entity across wallet consumers and browser history', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app?portfolio=1', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('link', { name: 'Health', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Financial health', exact: true })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'account-rail-health-context');
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('link', { name: 'Assets', exact: true }).click();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  const toggle = page.getByTestId('account-workspace-mobile-toggle');
  if (await toggle.isVisible()) {
    await toggle.focus();
    await toggle.press('Enter');
    await screenshotEvidence(page, testInfo, 'account-rail-mobile-menu');
    await toggle.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(page.locator('.account-rail-mobile')).not.toHaveAttribute('open', '');
  }
  await selectRail(page, 'send');
  await expect(page).toHaveURL(/#accounts\/send$/);
  await expect(page.getByRole('heading', { name: 'Send a payment' })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await expect(page.getByRole('combobox', { name: 'Recipient', exact: true })).toHaveValue(fixture.entityId);
  if (await toggle.isVisible()) {
    await expect(toggle).toBeFocused();
    await expect(page.locator('.account-rail-mobile')).not.toHaveAttribute('open', '');
  }
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'account-rail-pay-context');

  await selectRail(page, 'receive');
  await expect(page.getByRole('heading', { name: 'Receive', exact: true })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await selectRail(page, 'swap');
  await expect(page.getByRole('heading', { name: 'Open an active Account with a committed hub.' })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Receive', exact: true })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Open an active Account with a committed hub.' })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);

  await selectRail(page, 'activity');
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'account-rail-activity-context');
  await selectRail(page, 'appearance');
  await expect(page.getByRole('heading', { name: 'Account appearance' })).toBeVisible();
  await selectRail(page, 'open');
  await expect(page.getByRole('form', { name: 'Open Account by ID' })).toBeVisible();
  await page.getByRole('button', { name: '← Back to assets' }).click();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await page.locator('.wallet-portfolio-account').first().getByRole('button', { name: 'View Account' }).click();
  await expect(page.getByTestId('account-panel')).toHaveAttribute('data-counterparty-id', fixture.entityId);
  await expect(page.getByRole('navigation', { name: 'Account workspace', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: '← Back to accounts' }).click();
  await expect(page.getByTestId('account-panel')).toHaveAttribute('data-counterparty-id', fixture.entityId);
  await page.getByTestId('account-panel-back').click();
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.counterpartyEntityId);
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await selectRail(page, 'receive');
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  await selectRail(page, 'swap');
  await expect(page.getByRole('heading', { name: 'Place or cross' })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.entityId);
  expectNoBrowserErrors(errors);
});
