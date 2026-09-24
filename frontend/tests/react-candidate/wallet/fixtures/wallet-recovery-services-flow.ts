import { expect, type Page, type TestInfo } from '@playwright/test';
import { WALLET_VAULT_STORAGE_KEY } from '../../../../packages/browser/src/wallet/wallet-vault-storage';
import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from '../../browser-evidence';
import {
  createIsolatedRecoveryTowerFixture,
  readWalletRuntimeFixture,
} from './wallet-runtime-test-helpers';
import { WALLET_RECOVERY_FIXTURE_MNEMONIC } from './wallet-fixture-identities';
import { finishOpenedWalletSetup } from '../onboarding/wallet-onboarding-test-helpers';

export async function runWalletRecoveryServicesFlow(page: Page, testInfo: TestInfo): Promise<void> {
  testInfo.setTimeout(180_000);
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  const towerUrl = await createIsolatedRecoveryTowerFixture(page, 'wallet-recovery-services');
  await page.addInitScript(
    ({ rpcUrl, towerUrl }: { rpcUrl: string; towerUrl: string }) => {
      localStorage.setItem('xln-watchtower-urls', JSON.stringify([towerUrl]));
      const target = window as typeof window & {
        __XLN_PUSH_WAKE_RPC_URLS__?: Record<string, string>;
        __XLN_WATCHTOWERS__?: string[];
        xlnDesktop?: {
          platform: 'desktop';
          getPushWakeToken: () => Promise<{ value: string; platform: 'desktop' }>;
        };
      };
      target.__XLN_WATCHTOWERS__ = [towerUrl];
      target.__XLN_PUSH_WAKE_RPC_URLS__ = { default: rpcUrl };
      target.xlnDesktop = {
        platform: 'desktop',
        getPushWakeToken: async () => ({
          value: 'react-wallet-device-wake-integration-token',
          platform: 'desktop',
        }),
      };
    },
    { rpcUrl: fixture.recovery.rpcUrl, towerUrl },
  );
  const response = await page.goto('/app?setup=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for canonical recovery').toBe(true);
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Local Runtime', {
    timeout: 90_000,
  });

  await page.getByRole('tab', { name: /Mnemonic/ }).click();
  const seedInput = page.getByRole('textbox', { name: /^Seed phrase/ });
  await seedInput.fill(WALLET_RECOVERY_FIXTURE_MNEMONIC);
  await page.getByRole('button', { name: 'Review identity inputs' }).click();
  await page.getByRole('button', { name: 'Verify recovery' }).click();
  const recoveryInput = page.getByRole('textbox', { name: /^Seed phrase/ });
  await recoveryInput.fill(WALLET_RECOVERY_FIXTURE_MNEMONIC);
  await page.getByRole('button', { name: 'Verify recovered wallet' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import runtime backup' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'mnemonic-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(fixture.recovery.backupFileContents),
  });

  await expect(page.getByRole('heading', { name: 'Choose a backup' })).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByText('Fresh creation is blocked. Restore one of the encrypted backups found for this wallet.'),
  ).toBeVisible();
  const fileCandidate = page.getByRole('radio', { name: /mnemonic-backup\.json/ });
  await expect(fileCandidate).toHaveAttribute('aria-checked', 'true');
  await expect(fileCandidate).toContainText(`H${fixture.recovery.runtimeHeight}`);
  const towerCandidate = page.getByRole('radio', {
    name: new RegExp(towerUrl.replaceAll('.', '\\.')),
  });
  await towerCandidate.click();
  await expect(towerCandidate).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('1 tower and 0 saved peers checked.')).toBeVisible();
  await expectPageContained(page);
  await page.evaluate(() => window.scrollBy(0, 320));
  await screenshotEvidence(page, testInfo, 'wallet-canonical-recovery-choice');

  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    }),
  );
  expect(storage).not.toContain(WALLET_RECOVERY_FIXTURE_MNEMONIC);
  await page.getByRole('button', { name: 'Restore selected backup' }).click();
  await expect(page.getByRole('heading', { name: 'Wallet opened' })).toBeVisible({ timeout: 90_000 });
  await finishOpenedWalletSetup(page);
  await expect(page.getByText(`Active Runtime ${fixture.recovery.runtimeId}.`, { exact: false })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-canonical-recovery-opened');

  await expect(page.getByRole('heading', { name: 'Recovery services' })).toBeVisible();
  await expect(page.getByTestId('recovery-coverage-local_state')).toContainText('Available');
  await expect(page.getByTestId('recovery-coverage-grid').locator('dt')).toHaveText([
    'Local state',
    'Tower backup',
    'Last resort',
    'Peer refresh',
  ]);
  await expect(page.getByRole('list', { name: 'Recovery service status' })).toContainText(towerUrl);
  await expect(page.getByRole('heading', { name: 'Device wake' })).toBeVisible();
  await expect(page.getByText(fixture.recovery.entityId.slice(0, 10), { exact: false })).toBeVisible();
  const officialTower = page.getByText('Official xln tower').locator('..');
  await expect(officialTower).toContainText(towerUrl);
  await page.getByRole('button', { name: 'Register this device' }).click();
  await expect(page.getByText('Registered with 1/1 recovery services.')).toBeVisible();
  await expect(page.getByText('Registered', { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const health = await page.request.get(`${towerUrl}/api/tower/healthz`);
      const payload = (await health.json()) as { pushWake?: { stats?: { registrationCount?: number } } };
      return payload.pushWake?.stats?.registrationCount ?? 0;
    })
    .toBe(1);
  const wakeStorage = await page.evaluate(() => localStorage.getItem('xln-push-wake-registrations-v1'));
  expect(wakeStorage).toContain('"platform":"desktop"');
  expect(wakeStorage).not.toContain('react-wallet-device-wake-integration-token');
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-device-wake-registered');
  await page.getByRole('button', { name: 'Disable device wake' }).click();
  await expect(page.getByText('Device wake disabled at 1/1 recovery services.')).toBeVisible();
  await expect
    .poll(async () => {
      const health = await page.request.get(`${towerUrl}/api/tower/healthz`);
      const payload = (await health.json()) as { pushWake?: { stats?: { registrationCount?: number } } };
      return payload.pushWake?.stats?.registrationCount ?? 0;
    })
    .toBe(0);
  await page.getByRole('radio', { name: /Backup only/ }).click();
  await expect(page.getByRole('radio', { name: /Backup only/ })).toHaveAttribute('aria-checked', 'true');

  const serviceUrl = page.getByLabel('Service URL');
  await serviceUrl.fill('ftp://invalid.example.com');
  await page.getByRole('button', { name: 'Add service' }).click();
  await expect(page.getByRole('alert')).toHaveText('Service URL must start with http:// or https://');
  const manualUrl = `${towerUrl}/manual`;
  await serviceUrl.fill(`${manualUrl}/`);
  await page.getByLabel('Manual recovery service role').selectOption('delayed_last_resort');
  await page.getByRole('button', { name: 'Add service' }).click();
  const manualService = page.getByText('Manual service', { exact: true }).locator('..');
  await expect(manualService).toContainText(manualUrl);
  await expect(page.getByLabel(`Role for ${manualUrl}`)).toHaveValue('delayed_last_resort');
  await page.getByRole('button', { name: 'Save recovery services' }).click();
  await expect(page.getByText('Recovery services saved to the active Runtime.')).toBeVisible();
  const persistedRecovery = await page.evaluate(
    storageKey => localStorage.getItem(storageKey),
    WALLET_VAULT_STORAGE_KEY,
  );
  expect(persistedRecovery).toContain(manualUrl);
  expect(persistedRecovery).toContain('blind_backup');
  expect(persistedRecovery).toContain('delayed_last_resort');
  await expect(page.getByRole('list', { name: 'Recovery service status' })).toContainText(manualUrl);
  await expect(page.getByTestId('recovery-coverage-last_resort')).toContainText('Configured');
  expect(
    await page
      .getByTestId('recovery-coverage-grid')
      .locator('dd')
      .evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth + 1)),
  ).toBe(true);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-recovery-services-saved');
  const unsavedUrl = `${towerUrl}/unsaved`;
  await serviceUrl.fill(unsavedUrl);
  await page.getByLabel('Manual recovery service role').selectOption('blind_backup');
  await page.getByRole('button', { name: 'Add service' }).click();
  const serviceStatus = page.getByRole('list', { name: 'Recovery service status' });
  const officialStatus = serviceStatus
    .locator('li')
    .filter({ has: page.getByText(towerUrl, { exact: true }) });
  await expect(officialStatus).toHaveAttribute('data-status', 'receipt', { timeout: 15_000 });
  await expect(officialStatus).toContainText('Receipt observed');
  await expect(page.getByLabel(`Role for ${unsavedUrl}`)).toHaveValue('blind_backup');
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), WALLET_VAULT_STORAGE_KEY)).not.toContain(
    unsavedUrl,
  );
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-recovery-live-receipt-preserves-draft');
  expectNoBrowserErrors(errors);
}
