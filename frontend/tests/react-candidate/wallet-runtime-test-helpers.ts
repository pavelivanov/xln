import { expect, type Page } from '@playwright/test';

import {
  RUNTIME_ADAPTER_ACCESS_KEY,
  RUNTIME_ADAPTER_AUTH_KEY,
  RUNTIME_ADAPTER_MODE_KEY,
  RUNTIME_ADAPTER_WS_KEY,
} from '../../packages/browser/src/runtime-adapter-session';
import { REMOTE_RUNTIME_IMPORT_STORAGE_KEY } from '../../packages/browser/src/remote-runtime-import';

export type WalletRuntimeFixtureInfo = Readonly<{
  runtimeId: string;
  entityId: string;
  counterpartyEntityId: string;
  height: number;
  wsUrl: string;
  token: string;
  recovery: Readonly<{
    runtimeId: string;
    runtimeHeight: number;
    towerUrl: string;
  }>;
}>;

export const readWalletRuntimeFixture = async (page: Page): Promise<WalletRuntimeFixtureInfo> => {
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
  const counterpartyEntityId = String(info['counterpartyEntityId'] || '').trim().toLowerCase();
  const height = Number(info['height']);
  const wsUrl = String(info['wsUrl'] || '').trim();
  const token = String(info['token'] || '').trim();
  const recovery = info['recovery'];
  if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) {
    throw new Error('WALLET_RECOVERY_FIXTURE_INFO_INVALID');
  }
  const recoveryInfo = recovery as Record<string, unknown>;
  const recoveryRuntimeId = String(recoveryInfo['runtimeId'] || '').trim().toLowerCase();
  const recoveryRuntimeHeight = Number(recoveryInfo['runtimeHeight']);
  const towerUrl = String(recoveryInfo['towerUrl'] || '').trim();
  if (!/^0x[0-9a-f]{40}$/.test(runtimeId)
    || !/^0x[0-9a-f]{64}$/.test(entityId)
    || !/^0x[0-9a-f]{64}$/.test(counterpartyEntityId)) {
    throw new Error('WALLET_RUNTIME_FIXTURE_ID_INVALID');
  }
  if (!Number.isSafeInteger(height) || height < 1) throw new Error('WALLET_RUNTIME_FIXTURE_HEIGHT_INVALID');
  if (!wsUrl.startsWith('ws://127.0.0.1:') || !token.startsWith('xlnra1.')) {
    throw new Error('WALLET_RUNTIME_FIXTURE_AUTH_INVALID');
  }
  if (!/^0x[0-9a-f]{40}$/.test(recoveryRuntimeId)
    || !Number.isSafeInteger(recoveryRuntimeHeight)
    || recoveryRuntimeHeight < 0
    || !towerUrl.startsWith('http://127.0.0.1:')) {
    throw new Error('WALLET_RECOVERY_FIXTURE_INFO_INVALID');
  }
  return {
    runtimeId,
    entityId,
    counterpartyEntityId,
    height,
    wsUrl,
    token,
    recovery: {
      runtimeId: recoveryRuntimeId,
      runtimeHeight: recoveryRuntimeHeight,
      towerUrl,
    },
  };
};

export const installImportedRuntime = async (
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
      height: fixture.height,
      entityCount: 2,
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

export const selectWalletFixtureRuntime = async (page: Page): Promise<WalletRuntimeFixtureInfo> => {
  const fixture = await readWalletRuntimeFixture(page);
  await page.goto('/testnet', { waitUntil: 'domcontentloaded' });
  await installImportedRuntime(page, fixture);
  return fixture;
};
