import { expect, test, type Page } from '@playwright/test';

import {
  RUNTIME_ADAPTER_ACCESS_KEY,
  RUNTIME_ADAPTER_AUTH_KEY,
  RUNTIME_ADAPTER_MODE_KEY,
  RUNTIME_ADAPTER_WS_KEY,
} from '../../packages/browser/src/runtime-adapter-session';
import { REMOTE_RUNTIME_IMPORT_STORAGE_KEY } from '../../packages/browser/src/remote-runtime-import';

import {
  expectNoBrowserErrors,
  expectPageContained,
  observeBrowserErrors,
  screenshotEvidence,
} from './browser-evidence';

type WalletRuntimeFixtureInfo = Readonly<{
  runtimeId: string;
  entityId: string;
  wsUrl: string;
  token: string;
}>;

const FIRST_MNEMONIC = 'test test test test test test test test test test test junk';
const SECOND_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const INVALID_MNEMONIC = 'test test test test test test test test test test test test';

const readWalletRuntimeFixture = async (page: Page): Promise<WalletRuntimeFixtureInfo> => {
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  let value: unknown = null;
  await expect.poll(async () => {
    try {
      const response = await page.request.get(`http://127.0.0.1:${port}/info`);
      if (!response.ok()) return false;
      value = await response.json() as unknown;
      return true;
    } catch {
      return false;
    }
  }, { timeout: 90_000, message: 'isolated wallet Runtime fixture readiness' }).toBe(true);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('WALLET_RUNTIME_FIXTURE_INFO_INVALID');
  }
  const info = value as Record<string, unknown>;
  const runtimeId = String(info['runtimeId'] || '').trim().toLowerCase();
  const entityId = String(info['entityId'] || '').trim().toLowerCase();
  const wsUrl = String(info['wsUrl'] || '').trim();
  const token = String(info['token'] || '').trim();
  if (!/^0x[0-9a-f]{40}$/.test(runtimeId) || !/^0x[0-9a-f]{64}$/.test(entityId)) {
    throw new Error('WALLET_RUNTIME_FIXTURE_ID_INVALID');
  }
  if (!wsUrl.startsWith('ws://127.0.0.1:') || !token.startsWith('xlnra1.')) {
    throw new Error('WALLET_RUNTIME_FIXTURE_AUTH_INVALID');
  }
  return { runtimeId, entityId, wsUrl, token };
};

const installImportedRuntime = async (
  page: Page,
  info: WalletRuntimeFixtureInfo,
): Promise<void> => {
  await page.evaluate(({ fixture, keys }) => {
    sessionStorage.setItem(keys.imports, JSON.stringify([{
      label: 'Browser fixture',
      access: 'admin',
      wsUrl: fixture.wsUrl,
      token: fixture.token,
      runtimeId: fixture.runtimeId,
      authLevel: 'admin',
      height: 2,
      entityCount: 1,
      importedAt: 1,
    }]));
    localStorage.setItem(keys.mode, 'remote');
    localStorage.setItem(keys.ws, fixture.wsUrl);
    localStorage.setItem(keys.access, 'admin');
    sessionStorage.setItem(keys.auth, fixture.token);
  }, {
    fixture: info,
    keys: {
      imports: REMOTE_RUNTIME_IMPORT_STORAGE_KEY,
      mode: RUNTIME_ADAPTER_MODE_KEY,
      ws: RUNTIME_ADAPTER_WS_KEY,
      access: RUNTIME_ADAPTER_ACCESS_KEY,
      auth: RUNTIME_ADAPTER_AUTH_KEY,
    },
  });
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
  await expect(page.getByText('No wallet has been created or persisted by this rehearsal.')).toBeVisible();
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
  await expect(page.getByText('1 of 1 profiles')).toBeVisible();
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
