import { expect, test } from '@playwright/test';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from './browser-evidence';
import { restoreLocalWallet } from './wallet-onboarding-test-helpers';

test('post-creation setup validates preferences, exposes discovery failure and commits manual setup', async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const fixture = await restoreLocalWallet(page);
  const form = page.getByRole('form', { name: 'Configure account' });
  await expect(form).toBeVisible();
  await page.getByLabel('Display name', { exact: true }).fill('React Setup');
  await page.getByLabel('Soft limit (USD)', { exact: true }).fill('123');
  await page.getByLabel('Hard limit (USD)', { exact: true }).fill('456');
  await page.getByLabel('Maximum fee (USD)', { exact: true }).fill('7');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-onboarding-profile');
  await page.locator('.wallet-onboarding-advanced > summary').click();
  const jurisdiction = form.getByRole('checkbox', { name: /React Recovery mnemonic/ });
  await jurisdiction.uncheck();
  await expect(form.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();
  await jurisdiction.check();
  const terms = form.getByRole('checkbox', { name: /I understand this is testnet software/ });
  await terms.uncheck();
  await expect(form.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();
  await terms.check();
  await expect(form.getByRole('heading', { name: 'Recovery services' })).toBeVisible();
  await form.getByRole('radio', { name: /^Backup only/ }).click();
  await expect(form.getByRole('radio', { name: /^Backup only/ })).toHaveAttribute('aria-checked', 'true');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-onboarding-advanced');

  // This isolated edge is a real relay, without a public Hub HTTP service.
  // A failed discovery must stay visible and cannot mark setup complete.
  await form.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('ONBOARDING_HUB_DISCOVERY_FAILED', { timeout: 30_000 });
  const completionKey = `xln-onboarding-complete:${fixture.recovery.entityId}`;
  expect(await page.evaluate(key => localStorage.getItem(key), completionKey)).not.toBe('true');
  await expectPageContained(page);
  await form.getByRole('alert').evaluate(element => element.scrollIntoView({ block: 'center' }));
  if (testInfo.project.name === 'mobile-390x844') {
    const errorBounds = await form.getByRole('alert').boundingBox();
    const navigationBounds = await page.getByRole('navigation', { name: 'Wallet navigation' }).boundingBox();
    if (errorBounds === null || navigationBounds === null) throw new Error('ONBOARDING_ERROR_BOUNDS_UNAVAILABLE');
    expect(errorBounds.y).toBeGreaterThanOrEqual(0);
    expect(errorBounds.y + errorBounds.height).toBeLessThan(navigationBounds.y);
    const path = testInfo.outputPath('wallet-onboarding-discovery-error-viewport.png');
    await page.screenshot({ animations: 'disabled', path });
    await testInfo.attach('mobile-discovery-error-viewport', { contentType: 'image/png', path });
  }
  await screenshotEvidence(page, testInfo, 'wallet-onboarding-discovery-error');

  await page.getByRole('link', { name: 'Assets', exact: true }).click();
  await expect(page).toHaveURL(/portfolio=1/);
  await expect(page.getByRole('heading', { name: 'Configure account' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assets & accounts' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Identity', exact: true }).click();
  await expect(form).toBeVisible();
  await form.locator('.wallet-onboarding-advanced > summary').click();

  await page.getByLabel('Initial hub join').selectOption('manual');
  await form.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('Account configured for React Setup. Joined 0 hub accounts.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('radio', { name: /^Backup only/ })).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(key => localStorage.getItem(key), completionKey)).toBe('true');
  const storedPolicy = await page.evaluate(() => JSON.parse(localStorage.getItem('xln-collateral-policy') || '{}'));
  expect(storedPolicy).toMatchObject({ mode: 'autopilot', softLimitUsd: 123, hardLimitUsd: 456, maxFeeUsd: 7 });
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-onboarding-complete');
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await expect(page.getByRole('heading', { name: 'Assets & accounts' })).toBeVisible();
  await expect(page.getByLabel('Entity', { exact: true }).locator('option:checked')).toHaveText('React Setup');
  await page.getByRole('link', { name: 'Identity', exact: true }).click();
  await expect(page.getByRole('tab', { name: /Mnemonic/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Configure account' })).toHaveCount(0);
  expectNoBrowserErrors(errors);
});
