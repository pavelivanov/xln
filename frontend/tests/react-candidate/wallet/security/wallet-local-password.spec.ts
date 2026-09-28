import { expect, test } from '@playwright/test';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from '../../browser-evidence';
import {
  REACT_WALLET_LOCAL_PASSWORD,
  finishOpenedWalletSetup,
  restoreLocalWallet,
} from '../onboarding/wallet-onboarding-test-helpers';
import { WALLET_RECOVERY_FIXTURE_MNEMONIC } from '../fixtures/wallet-fixture-identities';
import { WALLET_VAULT_STORAGE_KEY } from '../../../../packages/browser/src/wallet/wallet-vault-storage';

test(
  'local password gates reload, unlock, explicit lock, and recovery',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    testInfo.setTimeout(180_000);
    const errors = observeBrowserErrors(page);
    const fixture = await restoreLocalWallet(page);

    const persistedAfterEnrollment = await page.evaluate(() =>
      JSON.stringify({
        local: Object.entries(localStorage),
        session: Object.entries(sessionStorage),
      }),
    );
    expect(persistedAfterEnrollment).not.toContain(WALLET_RECOVERY_FIXTURE_MNEMONIC);
    expect(persistedAfterEnrollment).not.toContain(REACT_WALLET_LOCAL_PASSWORD);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Create a wallet', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore a wallet', exact: true })).toBeVisible();
    const savedWallet = page.getByRole('button', {
      name: `Mnemonic ${fixture.recovery.runtimeId.slice(0, 6)}`,
      exact: false,
    });
    await expect(savedWallet).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('.wallet-shell-runtime-state')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Configure account' })).toHaveCount(0);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-local-password-chooser');

    await page.getByRole('button', { name: 'Create a wallet', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review identity inputs' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Brain Vault/ })).toBeVisible();
    await page.getByRole('button', { name: 'Back to wallets', exact: true }).click();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Restore a wallet', exact: true }).click();
    await expect(page.getByRole('tab', { name: /Mnemonic/ })).toBeVisible();
    await page.getByRole('button', { name: 'Back to wallets', exact: true }).click();
    await expect(savedWallet).toBeVisible();

    const vaultSelectionBefore = await page.evaluate(
      storageKey => localStorage.getItem(storageKey),
      WALLET_VAULT_STORAGE_KEY,
    );
    await savedWallet.click();
    await expect(page.getByRole('heading', { name: 'Unlock wallet', exact: true })).toBeVisible();
    expect(await page.evaluate(
      storageKey => localStorage.getItem(storageKey),
      WALLET_VAULT_STORAGE_KEY,
    )).toBe(vaultSelectionBefore);
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
    await expect(page.locator('.wallet-shell-runtime-state')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Configure account' })).toHaveCount(0);
    await page.getByLabel('Password', { exact: true }).fill('wrong-local-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Incorrect password');
    await page.getByRole('button', { name: 'Back to wallets', exact: true }).click();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await savedWallet.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    await page.getByLabel('Password', { exact: true }).fill(REACT_WALLET_LOCAL_PASSWORD);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Configure account' })).toBeVisible({ timeout: 90_000 });
    await finishOpenedWalletSetup(page);

    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('link', { name: 'Theme', exact: true }).click();
    const lock = page.getByRole('button', { name: 'Lock wallet', exact: true });
    await expect(lock).toBeVisible({ timeout: 30_000 });
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-local-password-unlocked');
    await lock.click();
    await expect(page.getByRole('button', { name: 'Create a wallet', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await savedWallet.click();
    await expect(page.getByRole('heading', { name: 'Unlock wallet', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Payments' })).toHaveCount(0);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-local-password-locked');

    await page.getByRole('button', { name: 'Restore wallet', exact: true }).click();
    await expect(page.getByRole('tab', { name: /Brain Vault/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Mnemonic/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Unlock wallet' })).toHaveCount(0);
    const persistedAfterLock = await page.evaluate(() =>
      JSON.stringify({
        local: Object.entries(localStorage),
        session: Object.entries(sessionStorage),
      }),
    );
    expect(persistedAfterLock).not.toContain(WALLET_RECOVERY_FIXTURE_MNEMONIC);
    expect(persistedAfterLock).not.toContain(REACT_WALLET_LOCAL_PASSWORD);
    await expectPageContained(page);
    await screenshotEvidence(page, testInfo, 'wallet-local-password-recovery');
    expectNoBrowserErrors(errors);
  },
);
