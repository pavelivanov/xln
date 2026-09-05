import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';
import { selectWalletFixtureRuntime } from './wallet-runtime-test-helpers';

test('Account appearance persists retained controls and renders every skin on a real Account', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app?portfolio=1', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.locator('.wallet-portfolio-account').getByRole('button', { name: 'View Account' }).click();
  const panel = page.getByTestId('account-panel');
  const token = panel.locator('[data-token-id="1"]');
  await expect(token).toHaveAttribute('data-skin', 'classic');
  const bar = token.getByRole('button', { name: 'USDC capacity bar' });
  await expect(bar).toHaveAttribute('data-layout', 'center');
  await bar.focus();
  await page.keyboard.press('Enter');
  await expect(token.getByRole('table')).toBeVisible();
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(token.getByRole('table')).toHaveCount(0);
  await screenshotEvidence(page, testInfo, 'account-bars-classic-center');

  await panel.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(page).toHaveURL(/#accounts\/appearance$/);
  await expect(page.getByRole('heading', { name: 'Account appearance' })).toBeVisible();
  await page.getByRole('button', { name: 'Sides', exact: true }).click();
  await page.getByRole('slider', { name: /Scale/ }).fill('1000');
  for (const label of ['Sweep', 'Glow', 'Delta Flash', 'Ripple']) await page.getByRole('checkbox', { name: new RegExp(`^${label}`) }).check();
  await page.getByRole('checkbox', { name: /^Credit Gradient/ }).uncheck();
  await page.getByRole('checkbox', { name: /^Smooth Resize/ }).uncheck();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'account-appearance-classic-controls');
  await page.getByRole('button', { name: '← Back to accounts' }).click();
  await expect(panel).toHaveAttribute('data-counterparty-id', fixture.counterpartyEntityId);
  await expect(bar).toHaveAttribute('data-layout', 'sides');
  await expect(bar).toHaveAttribute('data-scale', '10');
  await expect(bar).not.toHaveClass(/anim-transition/);
  await screenshotEvidence(page, testInfo, 'account-bars-classic-sides');

  for (const style of ['hairline', 'pips', 'twin', 'capsule', 'thread']) {
    await panel.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('button', { name: 'Apple', exact: true }).click();
    await page.getByLabel('Bar style', { exact: true }).selectOption(style);
    if (style === 'thread') await screenshotEvidence(page, testInfo, 'account-appearance-apple-controls');
    await page.getByRole('button', { name: '← Back to accounts' }).click();
    await expect(token).toHaveAttribute('data-skin', 'apple');
    await expect(token.locator('.wallet-delta-apple')).toHaveAttribute('data-bar-style', style);
    await token.getByRole('button', { name: 'Show USDC details' }).click();
    await expect(token.getByRole('table')).toBeVisible();
    await expect(token.getByText('credit on receive side')).toBeVisible();
    await expect(token.getByRole('button', { name: 'Faucet', exact: true })).toBeVisible();
    await expectPageContained(page);
    const path = testInfo.outputPath(`account-bars-apple-${style}.png`);
    await token.locator('.wallet-delta-apple').screenshot({ path, animations: 'disabled' });
    await testInfo.attach(`account-bars-apple-${style}`, { path, contentType: 'image/png' });
  }
  await panel.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Apple', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Sides', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Bar style', { exact: true })).toHaveValue('thread');
  await expect(page.getByRole('slider', { name: /Scale/ })).toHaveValue('1000');
  for (const label of ['Sweep', 'Glow', 'Delta Flash', 'Ripple']) await expect(page.getByRole('checkbox', { name: new RegExp(`^${label}`) })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^Credit Gradient/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^Smooth Resize/ })).not.toBeChecked();
  if (testInfo.project.name === 'mobile-390x844') {
    const ripple = page.getByRole('checkbox', { name: /^Ripple/ });
    await ripple.evaluate(element => element.scrollIntoView({ block: 'center' }));
    const bounds = await ripple.boundingBox();
    const navigation = await page.getByRole('navigation', { name: 'Wallet navigation' }).boundingBox();
    if (!bounds || !navigation) throw new Error('ACCOUNT_APPEARANCE_BOUNDS_UNAVAILABLE');
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThan(navigation.y);
    const path = testInfo.outputPath('account-appearance-effects-viewport.png');
    await page.screenshot({ path, animations: 'disabled' });
    await testInfo.attach('account-appearance-effects-viewport', { path, contentType: 'image/png' });
  }
  await page.getByRole('button', { name: 'Classic', exact: true }).click();
  await page.getByRole('button', { name: 'Center', exact: true }).click();
  await page.getByRole('button', { name: '← Back to accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.counterpartyEntityId);
  await page.locator('.wallet-portfolio-account').getByRole('button', { name: 'View Account' }).click();
  await expect(panel).toHaveAttribute('data-counterparty-id', fixture.entityId);
  await expect(token).toHaveAttribute('data-skin', 'classic');
  await expect(bar).toHaveAttribute('data-scale', '10');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'account-bars-classic-peer');
  expectNoBrowserErrors(errors);
});

test('Account bar effects follow a real committed payment and stop after their duration', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  const fixture = await selectWalletFixtureRuntime(page);
  await page.goto('/app#accounts/appearance', { waitUntil: 'domcontentloaded' });
  for (const label of ['Sweep', 'Glow', 'Delta Flash', 'Ripple']) await page.getByRole('checkbox', { name: new RegExp(`^${label}`) }).check();
  await page.getByRole('button', { name: '← Back to accounts' }).click();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
  await page.locator('.wallet-portfolio-account').getByRole('button', { name: 'View Account' }).click();
  const token = page.getByTestId('account-panel').locator('[data-token-id="1"]');
  await expect(token.getByRole('button', { name: 'USDC capacity bar' })).toBeVisible();
  const sender = await page.context().newPage();
  const senderErrors = observeBrowserErrors(sender);
  try {
    await selectWalletFixtureRuntime(sender);
    await sender.goto('/app?payments=1', { waitUntil: 'domcontentloaded' });
    await sender.getByLabel('Entity', { exact: true }).selectOption(fixture.entityId);
    await sender.getByLabel('Recipient amount').fill('1');
    await sender.locator('.wallet-payment-modes label').filter({ hasText: 'Direct' }).click();
    await sender.getByRole('button', { name: 'Find route' }).click();
    const submit = sender.getByRole('button', { name: 'Submit quoted payment' });
    await expect(submit).toBeEnabled();
    await Promise.all([
      expect(token.locator('.wallet-account-delta-flash')).toHaveText('-1', { timeout: 30_000 }),
      expect(token.locator('.sweep-line')).toHaveCount(1, { timeout: 30_000 }),
      expect(token.locator('.ripple-ring')).toHaveCount(1, { timeout: 30_000 }),
      expect(token.locator('.anim-glow')).toHaveCount(1, { timeout: 30_000 }),
      submit.click(),
    ]);
    const path = testInfo.outputPath('account-bars-committed-payment-flash.png');
    await token.screenshot({ path, animations: 'allow' });
    await testInfo.attach('account-bars-committed-payment-flash', { path, contentType: 'image/png' });
    await expect(token.locator('.wallet-account-delta-flash')).toHaveCount(0);
    await expect(token.locator('.sweep-line, .ripple-ring, .anim-glow')).toHaveCount(0);
    await page.getByTestId('account-panel').getByRole('button', { name: 'Appearance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Account appearance' })).toBeVisible();
    expectNoBrowserErrors(senderErrors);
    expectNoBrowserErrors(errors);
  } finally { await sender.close(); }
});
