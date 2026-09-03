import { expect, test } from '@playwright/test';

import {
  RUNTIME_ADAPTER_ACCESS_KEY,
  RUNTIME_ADAPTER_AUTH_KEY,
  RUNTIME_ADAPTER_MODE_KEY,
  RUNTIME_ADAPTER_WS_KEY,
} from '../../packages/browser/src/runtime-adapter-session';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';
import { installImportedRuntime, readWalletRuntimeFixture } from './wallet-runtime-test-helpers';

const FIRST_MNEMONIC = 'test test test test test test test test test test test junk';
const SECOND_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const INVALID_MNEMONIC = 'test test test test test test test test test test test test';
const BRAINVAULT_MNEMONIC = 'milk click novel require across cousin good chair street mouse crash movie same daughter air quote total pride crop mention focus sick slice hole';

const expectOnlyUnavailableFixtureRelayErrors = (
  errors: ReturnType<typeof observeBrowserErrors>,
  relayUrl: string,
): void => {
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors.length).toBeGreaterThan(0);
  for (const error of errors.consoleErrors) {
    const unavailableRelayError = error.includes(relayUrl) && (
      error.includes('Unexpected response code: 502')
      || error.includes('WS_UNEXPECTED_ERROR')
      || error.includes('WS_UNEXPECTED_CLOSE')
      || error.includes('WS_RELAY_FATAL')
    );
    expect(unavailableRelayError, `unexpected browser error: ${error}`).toBe(true);
  }
};


test('wallet candidate renders without browser errors', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/testnet', { waitUntil: 'networkidle' });
  expect(response?.ok(), 'document response for /testnet').toBe(true);
  await expect(page.getByRole('heading', { name: 'xln Testnet' })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet');
  expectNoBrowserErrors(errors);
});

test('wallet app renders within the isolated wallet surface', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/app', { waitUntil: 'networkidle' });
  expect(response?.ok(), 'document response for /app').toBe(true);
  await expect(page.getByRole('heading', { name: 'Wallet overview' })).toBeVisible();
  await expect(page.getByLabel('Current Runtime status')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-app');
  expectNoBrowserErrors(errors);
});

test('wallet app rehearses mnemonic recovery without creating or persisting a wallet', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/app?setup=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for identity rehearsal').toBe(true);
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Local Runtime', {
    timeout: 90_000,
  });

  await page.getByRole('tab', { name: /Mnemonic/ }).click();
  const seedInput = page.getByRole('textbox', { name: /^Seed phrase/ });
  await seedInput.fill(INVALID_MNEMONIC);
  await page.getByRole('button', { name: 'Review identity inputs' }).click();
  await expect(page.getByText('Seed phrase checksum or words are invalid.')).toBeVisible();

  await seedInput.fill(FIRST_MNEMONIC);
  await page.getByRole('button', { name: 'Review identity inputs' }).click();
  await expect(page.getByRole('heading', { name: 'Review recovery requirements' })).toBeVisible();
  await expect(page.getByText('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toBeVisible();
  await expect(page.getByText('No wallet has been created and no secret has left this form.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit inputs' })).toBeInViewport();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-identity-mnemonic-review');

  await page.getByRole('button', { name: 'Verify recovery' }).click();
  await expect(page.getByRole('heading', { name: 'Re-enter your seed' })).toBeVisible();
  const recoveryInput = page.getByRole('textbox', { name: /^Seed phrase/ });
  await expect(recoveryInput).toHaveValue('');
  await recoveryInput.fill(SECOND_MNEMONIC);
  await page.getByRole('button', { name: 'Verify recovered wallet' }).click();
  await expect(page.getByText('Recovery rehearsal did not reproduce the same wallet. Check every input and try again.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Re-enter your seed' })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-identity-recovery-mismatch');

  await recoveryInput.fill(FIRST_MNEMONIC);
  await page.getByRole('button', { name: 'Verify recovered wallet' }).click();
  await expect(page.getByRole('heading', { name: 'The same wallet returned' })).toBeVisible();
  await expect(page.getByText('Both seed entries were cleared.')).toBeVisible();
  await expect(page.getByText('The verified phrase remains only in this tab until you open the wallet or reset.')).toBeVisible();
  const browserStorage = await page.evaluate(() => JSON.stringify({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  expect(browserStorage).not.toContain(FIRST_MNEMONIC);
  expect(browserStorage).not.toContain(SECOND_MNEMONIC);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-identity-recovery-verified');
  expectNoBrowserErrors(errors);
});

test('wallet derives and opens a canonical Brain Vault outside React state', async ({ page }, testInfo) => {
  testInfo.setTimeout(180_000);
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  expect(fixture.recovery.brainVault.runtimeId).toBe('0x93bab14ed871462d414a7c0357bf1a76de741397');
  await page.addInitScript((towerUrl: string) => {
    localStorage.setItem('xln-watchtower-urls', JSON.stringify([towerUrl]));
    (window as typeof window & { __XLN_WATCHTOWERS__?: string[] }).__XLN_WATCHTOWERS__ = [towerUrl];
  }, fixture.recovery.towerUrl);
  const response = await page.goto('/app?setup=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for canonical Brain Vault').toBe(true);
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Local Runtime', {
    timeout: 90_000,
  });

  await page.getByRole('textbox', { name: /Vault name/ }).fill('alice');
  await page.getByLabel(/Secret passphrase/).fill('secret123456');
  await page.locator('.identity-factor-row').getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Review identity inputs' }).click();
  await expect(page.getByRole('heading', { name: 'Review recovery requirements' })).toBeVisible();
  await page.getByRole('button', { name: 'Derive Brain Vault' }).click();

  await expect(page.getByRole('heading', { name: /Deriving Brain Vault|Checking encrypted backups/ })).toBeVisible();
  await screenshotEvidence(page, testInfo, 'wallet-brainvault-deriving');
  await expect(page.getByRole('heading', { name: 'Choose a backup' })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText('0x93bab14ed871462d414a7c0357bf1a76de741397')).toBeVisible();
  await expect(page.getByText('Derived wallet material remains outside React state.')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Latest backup/ }))
    .toContainText(`H${fixture.recovery.brainVault.runtimeHeight}`);
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-brainvault-ready');

  const storage = await page.evaluate(() => JSON.stringify({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  expect(storage).not.toContain('secret123456');
  expect(storage).not.toContain(BRAINVAULT_MNEMONIC);
  await page.getByRole('button', { name: 'Restore selected backup' }).click();
  await expect(page.getByRole('heading', { name: 'Wallet opened' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Active Runtime 0x93bab14ed871462d414a7c0357bf1a76de741397.', { exact: false })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-brainvault-opened');
  expectOnlyUnavailableFixtureRelayErrors(errors, `ws://localhost:${new URL(page.url()).port}/relay`);
});

test('wallet restores the selected canonical watchtower backup', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await page.addInitScript((towerUrl: string) => {
    localStorage.setItem('xln-watchtower-urls', JSON.stringify([towerUrl]));
    (window as typeof window & { __XLN_WATCHTOWERS__?: string[] }).__XLN_WATCHTOWERS__ = [towerUrl];
  }, fixture.recovery.towerUrl);
  const response = await page.goto('/app?setup=1', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for canonical recovery').toBe(true);
  await expect(page.locator('.wallet-shell-runtime-state')).toHaveText('Local Runtime', {
    timeout: 90_000,
  });

  await page.getByRole('tab', { name: /Mnemonic/ }).click();
  const seedInput = page.getByRole('textbox', { name: /^Seed phrase/ });
  await seedInput.fill(FIRST_MNEMONIC);
  await page.getByRole('button', { name: 'Review identity inputs' }).click();
  await page.getByRole('button', { name: 'Verify recovery' }).click();
  const recoveryInput = page.getByRole('textbox', { name: /^Seed phrase/ });
  await recoveryInput.fill(FIRST_MNEMONIC);
  await page.getByRole('button', { name: 'Verify recovered wallet' }).click();
  await page.getByRole('button', { name: 'Check recovery and open wallet' }).click();

  await expect(page.getByRole('heading', { name: 'Choose a backup' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Fresh creation is blocked. Restore one of the encrypted backups found for this wallet.')).toBeVisible();
  const candidate = page.getByRole('radio', { name: /Latest backup/ });
  await expect(candidate).toHaveAttribute('aria-checked', 'true');
  await expect(candidate).toContainText(`H${fixture.recovery.runtimeHeight}`);
  await expect(candidate).toContainText(fixture.recovery.towerUrl);
  await expect(page.getByText('1 tower and 0 saved peers checked.')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-canonical-recovery-choice');

  const storage = await page.evaluate(() => JSON.stringify({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  expect(storage).not.toContain(FIRST_MNEMONIC);
  await page.getByRole('button', { name: 'Restore selected backup' }).click();
  await expect(page.getByRole('heading', { name: 'Wallet opened' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(`Active Runtime ${fixture.recovery.runtimeId}.`, { exact: false })).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-canonical-recovery-opened');
  expectOnlyUnavailableFixtureRelayErrors(
    errors,
    `ws://localhost:${new URL(page.url()).port}/relay`,
  );
});

test('address directory reads the isolated wallet Runtime', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const response = await page.goto('/address', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for /address').toBe(true);
  const directory = page.getByTestId('wallet-address-directory');
  await expect(directory).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Address directory' })).toBeVisible();
  await expect(page.getByText(/profiles$/)).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-address-directory');
  expectNoBrowserErrors(errors);
});

test('address detail surfaces a missing valid Entity without browser errors', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const missingEntityId = `0x${'f'.repeat(64)}`;
  const response = await page.goto(`/address/${missingEntityId}`, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'document response for /address/:entityId').toBe(true);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Entity not found in runtime projection.', { timeout: 90_000 });
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-address-not-found');
  expectNoBrowserErrors(errors);
});

test('address route selects an imported Runtime and renders committed directory, detail, and history', async ({ page }, testInfo) => {
  const errors = observeBrowserErrors(page);
  const fixture = await readWalletRuntimeFixture(page);
  await page.goto('/testnet', { waitUntil: 'domcontentloaded' });
  await installImportedRuntime(page, fixture);

  const directoryResponse = await page.goto('/address', { waitUntil: 'domcontentloaded' });
  expect(directoryResponse?.ok(), 'document response for populated /address').toBe(true);
  const row = page.getByRole('link', { name: /Browser Alice/ });
  await expect(row).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('2 of 2 profiles')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-address-directory-populated');

  await page.evaluate((keys) => {
    localStorage.setItem(keys.mode, 'embedded');
    localStorage.removeItem(keys.ws);
    localStorage.removeItem(keys.access);
    sessionStorage.removeItem(keys.auth);
  }, {
    mode: RUNTIME_ADAPTER_MODE_KEY,
    ws: RUNTIME_ADAPTER_WS_KEY,
    access: RUNTIME_ADAPTER_ACCESS_KEY,
    auth: RUNTIME_ADAPTER_AUTH_KEY,
  });

  const detailResponse = await page.goto(
    `/address/${fixture.entityId}?runtimeId=${encodeURIComponent(fixture.runtimeId)}`,
    { waitUntil: 'domcontentloaded' },
  );
  expect(detailResponse?.ok(), 'document response for imported Runtime detail').toBe(true);
  await expect(page.getByRole('heading', { name: 'Public Entity record' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Browser Alice')).toBeVisible();
  await expect(page.getByText('profile-update')).toBeVisible();
  await expect(page.getByText('Committed history')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-address-history-populated');

  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByText('Committed by the isolated candidate Runtime.')).toBeVisible();
  await expect(page.getByText('https://xln.finance')).toBeVisible();
  await expectPageContained(page);
  await screenshotEvidence(page, testInfo, 'wallet-address-detail-populated');

  const selected = await page.evaluate((keys) => ({
    mode: localStorage.getItem(keys.mode),
    wsUrl: localStorage.getItem(keys.ws),
    access: localStorage.getItem(keys.access),
    hasSessionToken: Boolean(sessionStorage.getItem(keys.auth)),
  }), {
    mode: RUNTIME_ADAPTER_MODE_KEY,
    ws: RUNTIME_ADAPTER_WS_KEY,
    access: RUNTIME_ADAPTER_ACCESS_KEY,
    auth: RUNTIME_ADAPTER_AUTH_KEY,
  });
  expect(selected).toEqual({
    mode: 'remote',
    wsUrl: fixture.wsUrl,
    access: 'admin',
    hasSessionToken: true,
  });
  expectNoBrowserErrors(errors);
});
