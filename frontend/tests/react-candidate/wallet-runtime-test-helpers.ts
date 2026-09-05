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
  walletSeed: string;
  wsUrl: string;
  token: string;
  recovery: Readonly<{
    backupFileContents: string;
    hubDiscovery: Readonly<{ backupFileContents: string; hubEntityId: string; towerUrl: string }>;
    entityId: string;
    runtimeId: string;
    runtimeHeight: number;
    towerUrl: string;
    rpcUrl: string;
    external: Readonly<{
      recipient: string;
      tokenAddress: string;
      tokenSymbol: 'USDC';
      initialBalance: string;
    }>;
    brainVault: Readonly<{
      backupFileContents: string;
      runtimeId: string;
      runtimeHeight: number;
    }>;
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
  const walletSeed = String(info['walletSeed'] || '').trim();
  const wsUrl = String(info['wsUrl'] || '').trim();
  const token = String(info['token'] || '').trim();
  const recovery = info['recovery'];
  if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) {
    throw new Error('WALLET_RECOVERY_FIXTURE_INFO_INVALID');
  }
  const recoveryInfo = recovery as Record<string, unknown>;
  const recoveryRuntimeId = String(recoveryInfo['runtimeId'] || '').trim().toLowerCase();
  const recoveryEntityId = String(recoveryInfo['entityId'] || '').trim().toLowerCase();
  const recoveryRuntimeHeight = Number(recoveryInfo['runtimeHeight']);
  const recoveryBackupFileContents = String(recoveryInfo['backupFileContents'] || '');
  const towerUrl = String(recoveryInfo['towerUrl'] || '').trim();
  const rpcUrl = String(recoveryInfo['rpcUrl'] || '').trim();
  const external = recoveryInfo['external'];
  if (!external || typeof external !== 'object' || Array.isArray(external)) {
    throw new Error('WALLET_RECOVERY_FIXTURE_INFO_INVALID');
  }
  const externalInfo = external as Record<string, unknown>;
  const externalRecipient = String(externalInfo['recipient'] || '').trim().toLowerCase();
  const externalTokenAddress = String(externalInfo['tokenAddress'] || '').trim().toLowerCase();
  const externalTokenSymbol = String(externalInfo['tokenSymbol'] || '').trim();
  const externalInitialBalance = String(externalInfo['initialBalance'] || '').trim();
  const brainVault = recoveryInfo['brainVault'];
  const hubDiscovery = recoveryInfo['hubDiscovery'];
  if (!hubDiscovery || typeof hubDiscovery !== 'object' || Array.isArray(hubDiscovery)) throw new Error('HUB_DISCOVERY_FIXTURE_INFO_REQUIRED');
  const hubDiscoveryInfo = hubDiscovery as Record<string, unknown>;
  const hubEntityId = String(hubDiscoveryInfo['hubEntityId'] || '');
  const hubBackup = String(hubDiscoveryInfo['backupFileContents'] || '');
  const hubTowerUrl = String(hubDiscoveryInfo['towerUrl'] || '');
  if (!/^0x[0-9a-f]{64}$/.test(hubEntityId) || !hubBackup.startsWith('{') || !/^http:\/\/127\.0\.0\.1:\d+$/.test(hubTowerUrl)) throw new Error('HUB_DISCOVERY_FIXTURE_INFO_INVALID');
  if (!brainVault || typeof brainVault !== 'object' || Array.isArray(brainVault)) {
    throw new Error('WALLET_RECOVERY_FIXTURE_INFO_INVALID');
  }
  const brainVaultInfo = brainVault as Record<string, unknown>;
  const brainVaultRuntimeId = String(brainVaultInfo['runtimeId'] || '').trim().toLowerCase();
  const brainVaultRuntimeHeight = Number(brainVaultInfo['runtimeHeight']);
  const brainVaultBackupFileContents = String(brainVaultInfo['backupFileContents'] || '');
  if (!/^0x[0-9a-f]{40}$/.test(runtimeId)
    || !/^0x[0-9a-f]{64}$/.test(entityId)
    || !/^0x[0-9a-f]{64}$/.test(counterpartyEntityId)) {
    throw new Error('WALLET_RUNTIME_FIXTURE_ID_INVALID');
  }
  if (!Number.isSafeInteger(height) || height < 1) throw new Error('WALLET_RUNTIME_FIXTURE_HEIGHT_INVALID');
  if (walletSeed.split(/\s+/u).length !== 12
    || !wsUrl.startsWith('ws://127.0.0.1:')
    || !token.startsWith('xlnra1.')) {
    throw new Error('WALLET_RUNTIME_FIXTURE_AUTH_INVALID');
  }
  if (!/^0x[0-9a-f]{40}$/.test(recoveryRuntimeId)
    || !/^0x[0-9a-f]{64}$/.test(recoveryEntityId)
    || !Number.isSafeInteger(recoveryRuntimeHeight)
    || recoveryRuntimeHeight < 0
    || !recoveryBackupFileContents.startsWith('{')
    || !/^0x[0-9a-f]{40}$/.test(brainVaultRuntimeId)
    || !Number.isSafeInteger(brainVaultRuntimeHeight)
    || brainVaultRuntimeHeight < 0
    || !brainVaultBackupFileContents.startsWith('{')
    || !towerUrl.startsWith('http://127.0.0.1:')
    || !/^0x[0-9a-f]{40}$/.test(externalRecipient)
    || !/^0x[0-9a-f]{40}$/.test(externalTokenAddress)
    || externalTokenSymbol !== 'USDC'
    || !/^\d+$/.test(externalInitialBalance)) {
    throw new Error('WALLET_RECOVERY_FIXTURE_INFO_INVALID');
  }
  if (!rpcUrl.startsWith('http://127.0.0.1:')) {
    throw new Error('WALLET_RECOVERY_FIXTURE_INFO_INVALID');
  }
  return {
    runtimeId,
    entityId,
    counterpartyEntityId,
    height,
    walletSeed,
    wsUrl,
    token,
    recovery: {
      backupFileContents: recoveryBackupFileContents,
      hubDiscovery: { hubEntityId, backupFileContents: hubBackup, towerUrl: hubTowerUrl },
      entityId: recoveryEntityId,
      runtimeId: recoveryRuntimeId,
      runtimeHeight: recoveryRuntimeHeight,
      towerUrl,
      rpcUrl,
      external: {
        recipient: externalRecipient,
        tokenAddress: externalTokenAddress,
        tokenSymbol: 'USDC',
        initialBalance: externalInitialBalance,
      },
      brainVault: {
        backupFileContents: brainVaultBackupFileContents,
        runtimeId: brainVaultRuntimeId,
        runtimeHeight: brainVaultRuntimeHeight,
      },
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
