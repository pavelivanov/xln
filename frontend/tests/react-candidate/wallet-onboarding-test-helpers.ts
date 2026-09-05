import { expect, type Page } from '@playwright/test';
import { readWalletRuntimeFixture } from './wallet-runtime-test-helpers';

export const finishOpenedWalletSetup = async (page: Page): Promise<void> => {
  const form = page.getByRole('form', { name: 'Configure account' });
  await expect(form).toBeVisible();
  await form.locator('.wallet-onboarding-advanced > summary').click();
  await form.getByLabel('Initial hub join').selectOption('manual');
  await form.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Continue to assets' })).toBeVisible({ timeout: 30_000 });
};

const MNEMONIC = 'test test test test test test test test test test test junk';

export async function restoreLocalWallet(page: Page, backup?: 'hub-discovery') {
  const fixture = await readWalletRuntimeFixture(page);
  await page.addInitScript((towerUrl: string) => {
    localStorage.setItem('xln-watchtower-urls', JSON.stringify([towerUrl]));
    (window as typeof window & { __XLN_WATCHTOWERS__?: string[] }).__XLN_WATCHTOWERS__ = [towerUrl];
  }, backup === 'hub-discovery' ? fixture.recovery.hubDiscovery.towerUrl : fixture.recovery.towerUrl);
  await page.goto('/app?setup=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Local Runtime', { timeout: 90_000 });
  await page.getByRole('tab', { name: /Mnemonic/ }).click();
  await page.getByRole('textbox', { name: /^Seed phrase/ }).fill(MNEMONIC);
  await page.getByRole('button', { name: 'Review identity inputs' }).click();
  await page.getByRole('button', { name: 'Verify recovery' }).click();
  await page.getByRole('textbox', { name: /^Seed phrase/ }).fill(MNEMONIC);
  await page.getByRole('button', { name: 'Verify recovered wallet' }).click();
  if (backup === 'hub-discovery') {
    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import runtime backup' }).click();
    await (await choosing).setFiles({ name: 'hub-discovery-backup.json', mimeType: 'application/json', buffer: Buffer.from(fixture.recovery.hubDiscovery.backupFileContents) });
  } else await page.getByRole('button', { name: 'Check recovery and open wallet' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a backup' })).toBeVisible({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Restore selected backup' }).click();
  await expect(page.getByRole('heading', { name: 'Wallet opened' })).toBeVisible({ timeout: 90_000 });
  return fixture;
}
