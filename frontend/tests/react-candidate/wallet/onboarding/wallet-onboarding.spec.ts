import { expect, test } from '@playwright/test';
import { WALLET_VAULT_STORAGE_KEY } from '../../../../packages/browser/src/wallet/wallet-vault-storage';
import { expectNoBrowserErrors, expectPageContained, observeBrowserErrors, screenshotEvidence } from '../../browser-evidence';
import { readWalletRuntimeFixture } from '../fixtures/wallet-runtime-test-helpers';
import { finishOpenedWalletSetup, restoreLocalWallet, unlockLocalPassword } from './wallet-onboarding-test-helpers';
import {
  BRAINVAULT_NODE_OWNER_NAME,
  BRAINVAULT_NODE_OWNER_PASSPHRASE,
} from '../../ops/panels/brainvault/brainvault-node-owner-fixture';

const readPersistedRuntimeIds = (page: import('@playwright/test').Page): Promise<string[]> =>
  page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('xln-vaults') || '{}') as {
      runtimes?: Record<string, unknown>;
    };
    return Object.keys(stored.runtimes || {}).sort();
  });

test('paired daemon owner creation cancels cleanly and retries through formation', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(180_000);
  const errors = observeBrowserErrors(page);
  await readWalletRuntimeFixture(page);
  await page.goto('/app#xlnPair=react-wallet-create-pairing-token&xlnOnboarding=create');
  await expect(page).not.toHaveURL(/xlnPair|xlnOnboarding|xlnEntity/);
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Remote Runtime', { timeout: 90_000 });
  await page.getByLabel(/^Vault name/).fill(BRAINVAULT_NODE_OWNER_NAME);
  const passphrase = page.getByLabel(/^Secret passphrase/);
  await passphrase.fill(BRAINVAULT_NODE_OWNER_PASSPHRASE);
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Create owner on local node', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deriving Brain Vault' })).toBeVisible();
  await expect(page.getByText('Its mnemonic and signer never enter this browser.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel derivation', exact: true }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Create the node owner' })).toBeVisible({ timeout: 30_000 });
  await expect(passphrase).toHaveValue('');

  await passphrase.fill(BRAINVAULT_NODE_OWNER_PASSPHRASE);
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Create owner on local node', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configure account' })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('daemon-custody-notice')).toContainText('Recovery is managed by this local node.');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-onboarding-daemon-create-retry');
  expectNoBrowserErrors(errors);
});

test('paired daemon formation keeps recovery and signer custody on the local node', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await page.goto(`/app#xlnPair=react-wallet-pairing-token&xlnOnboarding=formation&xlnEntity=${fixture.entityId}`);
  await expect(page).not.toHaveURL(/xlnPair|xlnOnboarding|xlnEntity/);
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Remote Runtime', { timeout: 90_000 });
  const form = page.getByRole('form', { name: 'Configure account' });
  await expect(form).toBeVisible();
  await page.getByLabel('Display name', { exact: true }).fill(`Daemon ${testInfo.project.name}`.slice(0, 32));
  await form.locator('.wallet-onboarding-advanced > summary').click();
  await page.getByLabel('Initial hub join').selectOption('manual');
  await expect(page.getByTestId('daemon-custody-notice')).toContainText('Recovery is managed by this local node.');
  await expect(page.getByTestId('daemon-custody-notice')).toContainText('mnemonic and signer never enter the browser');
  await expect(form.getByRole('heading', { name: 'Recovery services' })).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-onboarding-daemon-custody');
  await form.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText(/Account configured for Daemon .* Joined 0 hub accounts\./)).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem('xln-vaults'))).toBeNull();
  expect(await page.evaluate(entityId => localStorage.getItem(`xln-onboarding-complete:${entityId}`), fixture.entityId)).toBe('true');
  await expect(page.getByRole('heading', { name: 'Recovery services' })).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-onboarding-daemon-complete');
  expectNoBrowserErrors(errors);
});

test('post-creation setup validates preferences, exposes discovery failure and commits manual setup', { tag: '@functional' }, async ({ page }, testInfo) => {
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

  // The isolated edge returns explicit invalid discovery evidence in this mode.
  // The failure must stay visible and cannot mark setup complete.
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

test('post-creation setup automatically joins a real Hub and reload keeps one Runtime', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const fixture = await restoreLocalWallet(page, 'hub-discovery');
  const form = page.getByRole('form', { name: 'Configure account' });
  await expect(form).toBeVisible();
  await page.getByLabel('Display name', { exact: true }).fill('React Auto Join');
  await form.locator('.wallet-onboarding-advanced > summary').click();
  await expect(page.getByLabel('Initial hub join')).toHaveValue('1');
  await expect(form.getByRole('checkbox', { name: /React Recovery mnemonic/ })).toHaveCount(1);
  await form.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('Account configured for React Auto Join. Joined 1 hub accounts.')).toBeVisible({
    timeout: 30_000,
  });
  const runtimeIds = await readPersistedRuntimeIds(page);
  expect(runtimeIds).toEqual([fixture.recovery.runtimeId]);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-onboarding-auto-joined');

  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.recovery.entityId);
  await expect(page.getByLabel('Accounts', { exact: true }).getByText('Browser Hub', { exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await unlockLocalPassword(page);
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Local Runtime', { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Configure account' })).toHaveCount(0);
  await page.getByLabel('Entity', { exact: true }).selectOption(fixture.recovery.entityId);
  await expect(page.getByLabel('Entity', { exact: true })).toHaveValue(fixture.recovery.entityId);
  await expect(page.getByLabel('Accounts', { exact: true }).getByText('Browser Hub', { exact: true })).toBeVisible();
  expect(await readPersistedRuntimeIds(page)).toEqual(runtimeIds);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-onboarding-auto-joined-reloaded');
  expectNoBrowserErrors(errors);
});

test('recovery settings validate, save and restore services for the already-open Runtime', { tag: '@functional' }, async ({ page }, testInfo) => {
  testInfo.setTimeout(150_000);
  const errors = observeBrowserErrors(page);
  const fixture = await restoreLocalWallet(page);
  await finishOpenedWalletSetup(page);
  await page.getByRole('link', { name: 'Continue to assets' }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Recovery', exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`#settings/recovery\\?entity=${fixture.recovery.entityId}$`));
  await expect(page.getByRole('heading', { name: 'Recovery services' })).toBeVisible();
  await expect(page.getByText(fixture.recovery.runtimeId, { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Seed phrase/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Review identity inputs' })).toHaveCount(0);
  const officialTower = page.getByText('Official xln tower', { exact: true }).locator('..');
  await expect(officialTower).toContainText(fixture.recovery.towerUrl);

  await page.getByRole('radio', { name: /^Backup only/ }).click();
  await expect(page.getByRole('radio', { name: /^Backup only/ })).toHaveAttribute('aria-checked', 'true');
  const serviceUrl = page.getByLabel('Service URL');
  await serviceUrl.fill('ftp://invalid.example.com');
  await page.getByRole('button', { name: 'Add service' }).click();
  await expect(page.getByRole('alert')).toHaveText('Service URL must start with http:// or https://');

  const manualUrl = `${fixture.recovery.towerUrl}/settings`;
  await serviceUrl.fill(`${manualUrl}/`);
  await page.getByLabel('Manual recovery service role').selectOption('delayed_last_resort');
  await page.getByRole('button', { name: 'Add service' }).click();
  const manualService = page.getByText('Manual service', { exact: true }).locator('..');
  await expect(manualService).toContainText(manualUrl);
  await expect(page.getByLabel(`Role for ${manualUrl}`)).toHaveValue('delayed_last_resort');
  await page.getByRole('button', { name: 'Save recovery services' }).click();
  await expect(page.getByText('Recovery services saved to the active Runtime.')).toBeVisible();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), WALLET_VAULT_STORAGE_KEY))
    .toContain(manualUrl);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await unlockLocalPassword(page);
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Local Runtime', { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Recovery services' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Backup only/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Manual service', { exact: true }).locator('..')).toContainText(manualUrl);
  await expect(page.getByLabel(`Role for ${manualUrl}`)).toHaveValue('delayed_last_resort');
  await expect(page.getByRole('textbox', { name: /^Seed phrase/ })).toHaveCount(0);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-recovery-settings-restored');
  expectNoBrowserErrors(errors);
});
