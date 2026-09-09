import { expect, type Page } from '@playwright/test';

import {
  RUNTIME_ADAPTER_ACCESS_KEY,
  RUNTIME_ADAPTER_AUTH_KEY,
  RUNTIME_ADAPTER_MODE_KEY,
  RUNTIME_ADAPTER_WS_KEY,
} from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import { REMOTE_RUNTIME_IMPORT_STORAGE_KEY } from '../../../../packages/browser/src/runtime/session/remote-runtime-import';

export const readWalletFixtureChainBalances = async (page: Page) => {
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.get(`http://127.0.0.1:${port}/chain-balances`);
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('WALLET_CHAIN_BALANCES_INVALID');
  const record = result as Record<string, unknown>;
  const amount = (key: string): bigint => {
    const raw = record[key];
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new Error(`WALLET_CHAIN_BALANCE_INVALID:${key}`);
    return BigInt(raw);
  };
  return { reserve: amount('reserve'), collateral: amount('collateral'), chainReserve: amount('chainReserve'), chainCollateral: amount('chainCollateral') };
};

export const readWalletAccountToolState = async (page: Page, entityId: string, accountId: string, tokenId = 1) => {
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  const response = await page.request.get(`http://127.0.0.1:${port}/account-tool-state?entityId=${entityId}&accountId=${accountId}&tokenId=${tokenId}`);
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('ACCOUNT_TOOLS_STATE_INVALID');
  return result as Record<string, unknown>;
};

const walletFixtureUrl = (path: string): string => {
  const port = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092);
  return `http://127.0.0.1:${port}${path}`;
};

export const readStackManagerRpcFixture = async (page: Page) => {
  const response = await page.request.get(walletFixtureUrl('/stack-manager-fixture'));
  expect(response.ok()).toBe(true);
  const value = await response.json() as { rpcUrl?: unknown; chainId?: unknown };
  const rpcUrl = String(value.rpcUrl || '');
  const chainId = Number(value.chainId);
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(rpcUrl) || chainId !== 31_339) {
    throw new Error('STACK_MANAGER_RPC_FIXTURE_INVALID');
  }
  return { rpcUrl, chainId };
};

export const createIsolatedRecoveryTowerFixture = async (page: Page, label: string): Promise<string> => {
  const response = await page.request.get(walletFixtureUrl(
    `/isolated-recovery-tower-fixture?label=${encodeURIComponent(label)}`,
  ));
  expect(response.ok()).toBe(true);
  const value = await response.json() as { towerUrl?: unknown };
  const towerUrl = String(value.towerUrl || '');
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(towerUrl)) {
    throw new Error('WALLET_RECOVERY_TOWER_FIXTURE_INVALID');
  }
  return towerUrl;
};

export const createWalletHubDiscoveryFixture = async (page: Page, slot: string) => {
  const response = await page.request.post(walletFixtureUrl(`/hub-discovery-fixture?slot=${encodeURIComponent(slot)}`));
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('HUB_DISCOVERY_FIXTURE_INFO_INVALID');
  const record = result as Record<string, unknown>;
  const entityId = String(record['entityId'] || '').toLowerCase();
  const name = String(record['name'] || '');
  const height = Number(record['height']);
  if (!/^0x[0-9a-f]{64}$/.test(entityId) || !name || !Number.isSafeInteger(height)) {
    throw new Error('HUB_DISCOVERY_FIXTURE_INFO_INVALID');
  }
  return { entityId, name, height };
};

export const createWalletDisputeFixture = async (page: Page, slot: string) => {
  const response = await page.request.post(walletFixtureUrl(`/dispute-fixture?slot=${encodeURIComponent(slot)}`));
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('DISPUTE_FIXTURE_INFO_INVALID');
  const record = result as Record<string, unknown>;
  const entityId = String(record['entityId'] || '').toLowerCase();
  const name = String(record['name'] || '');
  const height = Number(record['height']);
  if (!/^0x[0-9a-f]{64}$/.test(entityId) || !name || !Number.isSafeInteger(height)) {
    throw new Error('DISPUTE_FIXTURE_INFO_INVALID');
  }
  return { entityId, name, height };
};

export const fundWalletDebtReserve = async (page: Page, entityId: string, amount: bigint) => {
  const response = await page.request.post(
    walletFixtureUrl(`/debt-reserve-fixture?entityId=${encodeURIComponent(entityId)}&amount=${amount}`),
  );
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ reserve: string }>;
};

export const seedWalletDebtPayment = async (page: Page, entityId: string, counterpartyId: string, amount: bigint) => {
  const response = await page.request.post(
    walletFixtureUrl(
      `/debt-payment-fixture?entityId=${encodeURIComponent(entityId)}&counterpartyId=${encodeURIComponent(counterpartyId)}&amount=${amount}`,
    ),
  );
  expect(response.ok()).toBe(true);
};

export const readWalletDebtLedgerState = async (page: Page, entityId: string) => {
  const response = await page.request.get(
    walletFixtureUrl(`/debt-ledger-state?entityId=${encodeURIComponent(entityId)}`),
  );
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{
    reserve: string;
    debts: Array<{ creditor: string; remainingAmount: string; status: string }>;
  }>;
};

export const createWalletCrossJFixture = async (page: Page) => {
  const response = await page.request.post(walletFixtureUrl('/cross-j-fixture'));
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{
    sourceHubEntityId: string;
    targetEntityId: string;
    targetHubEntityId: string;
    targetJurisdiction: string;
    height: number;
  }>;
};

export const readWalletCrossJState = async (page: Page, orderId: string) => {
  const response = await page.request.get(walletFixtureUrl(`/cross-j-state?orderId=${encodeURIComponent(orderId)}`));
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{
    rows: Array<{ entityId: string; status: string; orderId: string }>;
    height: number;
  }>;
};

export const readWalletHubDiscoveryAccountState = async (page: Page, entityId: string) => {
  const response = await page.request.get(walletFixtureUrl(`/hub-discovery-account-state?entityId=${encodeURIComponent(entityId)}`));
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('HUB_DISCOVERY_ACCOUNT_STATE_INVALID');
  const record = result as Record<string, unknown>;
  return {
    height: Number(record['height']),
    sourceHasAccount: record['sourceHasAccount'] === true,
    hubHasAccount: record['hubHasAccount'] === true,
  };
};

export type WalletRuntimeFixtureInfo = Readonly<{
  runtimeId: string;
  entityId: string;
  counterpartySignerId: string;
  counterpartyEntityId: string;
  height: number;
  walletSeed: string;
  wsUrl: string;
  token: string;
  recovery: Readonly<{
    backupFileContents: string;
    hubDiscovery: Readonly<{ backupFileContents: string; hubEntityId: string; towerUrl: string }>;
    settlement: Readonly<{ backupFileContents: string; counterpartyEntityId: string; workspaceHash: string }>;
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
  const counterpartySignerId = String(info['counterpartySignerId'] || '').trim().toLowerCase();
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
  const settlement = recoveryInfo['settlement'];
  if (!settlement || typeof settlement !== 'object' || Array.isArray(settlement)) {
    throw new Error('WALLET_SETTLEMENT_FIXTURE_INFO_INVALID');
  }
  const settlementInfo = settlement as Record<string, unknown>;
  const settlementBackup = String(settlementInfo['backupFileContents'] || '');
  const settlementCounterpartyEntityId = String(settlementInfo['counterpartyEntityId'] || '').toLowerCase();
  const settlementWorkspaceHash = String(settlementInfo['workspaceHash'] || '').toLowerCase();
  if (!settlementBackup.startsWith('{')
    || !/^0x[0-9a-f]{64}$/.test(settlementCounterpartyEntityId)
    || !/^0x[0-9a-f]{64}$/.test(settlementWorkspaceHash)) {
    throw new Error('WALLET_SETTLEMENT_FIXTURE_INFO_INVALID');
  }
  if (!brainVault || typeof brainVault !== 'object' || Array.isArray(brainVault)) {
    throw new Error('WALLET_RECOVERY_FIXTURE_INFO_INVALID');
  }
  const brainVaultInfo = brainVault as Record<string, unknown>;
  const brainVaultRuntimeId = String(brainVaultInfo['runtimeId'] || '').trim().toLowerCase();
  const brainVaultRuntimeHeight = Number(brainVaultInfo['runtimeHeight']);
  const brainVaultBackupFileContents = String(brainVaultInfo['backupFileContents'] || '');
  if (!/^0x[0-9a-f]{40}$/.test(runtimeId)
    || !/^0x[0-9a-f]{40}$/.test(counterpartySignerId)
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
    counterpartySignerId,
    counterpartyEntityId,
    height,
    walletSeed,
    wsUrl,
    token,
    recovery: {
      backupFileContents: recoveryBackupFileContents,
      hubDiscovery: { hubEntityId, backupFileContents: hubBackup, towerUrl: hubTowerUrl },
      settlement: {
        backupFileContents: settlementBackup,
        counterpartyEntityId: settlementCounterpartyEntityId,
        workspaceHash: settlementWorkspaceHash,
      },
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
