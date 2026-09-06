import { expect, type Page } from '@playwright/test';
import type { WalletRuntimeFixtureInfo } from '../../wallet/fixtures/wallet-runtime-test-helpers';

// Provision only public metadata for the real fixture owner. The tested UI
// must derive/protect the supplied matching seed itself; no keys are installed.
export const installOpsOwnerMetadata = async (page: Page, fixture: WalletRuntimeFixtureInfo): Promise<void> => {
  await page.evaluate(({ runtimeId, entityId }) => {
    localStorage.setItem('xln-vaults', JSON.stringify({ activeRuntimeId: runtimeId, runtimes: {
      [runtimeId]: { id: runtimeId, label: 'Browser owner', signers: [{ index: 0, address: runtimeId, name: 'Owner', entityId }], activeSignerIndex: 0, createdAt: 1, loginType: 'manual' },
    } }));
  }, { runtimeId: fixture.runtimeId, entityId: fixture.entityId });
};

export const unlockOpsOwnerVisibly = async (page: Page, seed: string): Promise<void> => {
  await page.getByRole('button', { name: 'Owner locked', exact: true }).click();
  const form = page.getByRole('form', { name: 'Unlock Runtime owner' });
  await form.getByLabel('Owner wallet seed phrase').fill(seed);
  await form.getByRole('button', { name: 'Unlock owner', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Owner unlocked', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Owner unlocked', exact: true }).click();
};
