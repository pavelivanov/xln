import { get } from 'svelte/store';
import { getAddress, getBytes, isAddress, Wallet, ZeroAddress } from 'ethers';

import type { JAdapter, RuntimeReplica } from '@xln/core/api/public/runtime-module';
import type {
  WalletExternalApprovalRequest,
  WalletExternalOperation,
  WalletExternalProviderBinding,
  WalletExternalProviderReadyView,
  WalletExternalProviderView,
  WalletExternalToken,
  WalletExternalTransferRequest,
} from '../packages/browser/src/wallet-external-provider';
import { walletExternalBindingMatches } from '../packages/browser/src/wallet-external-provider';
import {
  requestExternalWalletSnapshot,
} from '../src/lib/components/Entity/external-wallet-reader';
import { getXLN } from '../src/lib/stores/bootstrap/xlnRuntimeLoader';
import {
  runtimesState,
  vaultOperations,
  type Runtime,
  type Signer,
} from '../src/lib/stores/vault/vaultStore';
import { runtimes as runtimeRegistry } from '../src/lib/stores/runtimeStore';
import { unwrapLiveRuntimeEnv } from '../src/lib/utils/runtime/liveRuntimeEnv';
import { resolveExternalWalletAuthorityPlatform } from '../src/lib/native/external-wallet-authority';

type AuthorityContext = Readonly<{
  runtime: Runtime;
  signer: Signer;
  env: RuntimeReplica;
  adapter: JAdapter;
  binding: WalletExternalProviderBinding;
}>;

const ENTITY_PATTERN = /^0x[0-9a-f]{64}$/;
const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();

const activeRuntime = (): Runtime | null => {
  const state = get(runtimesState);
  const activeId = normalize(state.activeRuntimeId);
  return Object.values(state.runtimes).find((runtime) => normalize(runtime.id) === activeId) ?? null;
};

const activeSigner = (runtime: Runtime): Signer | null => (
  runtime.signers[runtime.activeSignerIndex] ?? null
);

const liveRuntimeEnv = (runtime: Runtime): RuntimeReplica | null => {
  const runtimeId = normalize(runtime.id);
  const entry = get(runtimeRegistry).get(runtimeId);
  if (!entry || entry.type !== 'local' || !entry.env) return null;
  const env = (unwrapLiveRuntimeEnv(entry.env) ?? entry.env) as RuntimeReplica;
  const envRuntimeId = normalize(env.runtimeId);
  if (envRuntimeId !== runtimeId) {
    throw new Error(`EXTERNAL_WALLET_RUNTIME_ENV_MISMATCH:${runtimeId}:${envRuntimeId}`);
  }
  return env;
};

const entityJurisdiction = (env: RuntimeReplica, entityId: string, signerId: string): string => {
  let fallback = '';
  for (const replica of env.state.eReplicas.values()) {
    if (normalize(replica.entityId) !== entityId) continue;
    const name = normalize(replica.state.config.jurisdiction?.name);
    if (normalize(replica.signerId) === signerId && name) return name;
    if (!fallback && name) fallback = name;
  }
  if (!fallback) throw new Error(`EXTERNAL_WALLET_JURISDICTION_MISSING:${entityId}`);
  return fallback;
};

const buildBinding = (
  runtime: Runtime,
  signer: Signer,
  env: RuntimeReplica,
  adapter: JAdapter,
): WalletExternalProviderBinding => {
  const entityId = normalize(signer.entityId);
  const signerId = normalize(signer.address);
  const owner = getAddress(signer.address).toLowerCase();
  const depository = getAddress(adapter.addresses.depository).toLowerCase();
  if (!ENTITY_PATTERN.test(entityId)) throw new Error('EXTERNAL_WALLET_ACTIVE_ENTITY_INVALID');
  if (!Number.isSafeInteger(adapter.chainId) || adapter.chainId <= 0) {
    throw new Error('EXTERNAL_WALLET_CHAIN_ID_INVALID');
  }
  return {
    runtimeId: normalize(runtime.id),
    entityId,
    signerId,
    owner,
    jurisdiction: entityJurisdiction(env, entityId, signerId),
    adapterMode: adapter.mode,
    chainId: adapter.chainId,
    depository,
    platform: resolveExternalWalletAuthorityPlatform(),
  };
};

const captureAuthority = async (): Promise<AuthorityContext> => {
  const runtime = activeRuntime();
  if (!runtime) throw new Error('EXTERNAL_WALLET_ACTIVE_RUNTIME_REQUIRED');
  const signer = activeSigner(runtime);
  if (!signer || !isAddress(signer.address)) throw new Error('EXTERNAL_WALLET_ACTIVE_SIGNER_REQUIRED');
  const env = liveRuntimeEnv(runtime);
  if (!env) throw new Error('EXTERNAL_WALLET_LIVE_LOCAL_RUNTIME_REQUIRED');
  const xln = await getXLN();
  const entityId = normalize(signer.entityId);
  const signerId = normalize(signer.address);
  const adapter = xln.getEntityJAdapter(env, entityId, signerId);
  if (!adapter) throw new Error('EXTERNAL_WALLET_JADAPTER_REQUIRED');
  return { runtime, signer, env, adapter, binding: buildBinding(runtime, signer, env, adapter) };
};

const assertExpectedSelection = (
  binding: WalletExternalProviderBinding,
  expectedEntityId: string,
  expectedSignerId: string,
): void => {
  if (binding.entityId !== normalize(expectedEntityId)) throw new Error('EXTERNAL_WALLET_ENTITY_CHANGED');
  if (binding.signerId !== normalize(expectedSignerId)) throw new Error('EXTERNAL_WALLET_SIGNER_CHANGED');
};

const assertCurrent = async (expected: WalletExternalProviderBinding): Promise<AuthorityContext> => {
  const current = await captureAuthority();
  if (!walletExternalBindingMatches(current.binding, expected)) throw new Error('EXTERNAL_WALLET_AUTHORITY_CHANGED');
  vaultOperations.assertRuntimeAuthority(expected.runtimeId);
  return current;
};

const requirePrivateKey = (context: AuthorityContext): Uint8Array => {
  vaultOperations.assertRuntimeAuthority(context.binding.runtimeId);
  const privateKey = vaultOperations.getSignerPrivateKey(context.runtime.activeSignerIndex);
  if (!privateKey) throw new Error('EXTERNAL_WALLET_SIGNER_KEY_REQUIRED');
  const derived = new Wallet(privateKey).address.toLowerCase();
  if (derived !== context.binding.owner) throw new Error('EXTERNAL_WALLET_SIGNER_KEY_MISMATCH');
  return getBytes(privateKey);
};

const readTokenCatalog = async (adapter: JAdapter): Promise<WalletExternalToken[]> => {
  const registry = await adapter.getTokenRegistry();
  return registry.flatMap((token): WalletExternalToken[] => {
    if (token.tokenType !== 0) return [];
    if (!isAddress(token.address) || token.address === ZeroAddress) {
      throw new Error(`EXTERNAL_WALLET_TOKEN_ADDRESS_INVALID:${token.tokenId}`);
    }
    if (!Number.isSafeInteger(token.decimals) || token.decimals < 0 || token.decimals > 255) {
      throw new Error(`EXTERNAL_WALLET_TOKEN_DECIMALS_INVALID:${token.tokenId}`);
    }
    if (!Number.isSafeInteger(token.tokenId) || token.tokenId < 1) {
      throw new Error(`EXTERNAL_WALLET_TOKEN_ID_INVALID:${token.tokenId}`);
    }
    return [{
      symbol: token.symbol,
      name: token.name,
      address: getAddress(token.address).toLowerCase(),
      decimals: token.decimals,
      tokenId: token.tokenId,
      tokenType: 0,
      externalTokenId: token.externalTokenId.toString(),
      balance: 0n,
      allowance: 0n,
    }];
  });
};

const projectReadyView = async (context: AuthorityContext): Promise<WalletExternalProviderReadyView> => {
  const catalog = await readTokenCatalog(context.adapter);
  const allowanceReads = catalog.map(({ address }) => ({
    tokenAddress: address,
    spender: context.binding.depository,
  }));
  const snapshot = await requestExternalWalletSnapshot(
    '',
    context.binding.entityId,
    context.binding.owner,
    catalog,
    allowanceReads,
    context.adapter,
  );
  if (!snapshot || snapshot.sourceHeight === undefined || !snapshot.sourceHash) {
    throw new Error('EXTERNAL_WALLET_FINALIZED_SNAPSHOT_REQUIRED');
  }
  let blockedReason = '';
  try {
    vaultOperations.assertRuntimeAuthority(context.binding.runtimeId);
  } catch (error: unknown) {
    blockedReason = error instanceof Error ? error.message : String(error);
  }
  return {
    state: 'ready',
    ...context.binding,
    sourceHeight: snapshot.sourceHeight,
    sourceHash: snapshot.sourceHash,
    finalityDepth: snapshot.finalityDepth ?? 0,
    headBlockNumber: snapshot.headBlockNumber ?? snapshot.sourceHeight,
    nativeBalance: snapshot.nativeBalance,
    tokens: catalog.map((token, index) => ({
      ...token,
      balance: snapshot.balances[index] ?? 0n,
      allowance: snapshot.allowanceValues[index] ?? 0n,
    })),
    writable: blockedReason === '',
    blockedReason,
  };
};

const bindingStillCurrent = async (expected: WalletExternalProviderBinding): Promise<boolean> => {
  try {
    return walletExternalBindingMatches((await captureAuthority()).binding, expected);
  } catch {
    return false;
  }
};

export const readCanonicalWalletExternalProvider = async (
  expectedEntityId: string,
  expectedSignerId: string,
): Promise<WalletExternalProviderView> => {
  try {
    const context = await captureAuthority();
    assertExpectedSelection(context.binding, expectedEntityId, expectedSignerId);
    return await projectReadyView(context);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    if (reason.includes('_REQUIRED') || reason.includes('_CHANGED')) {
      return { state: 'unavailable', reason };
    }
    throw error;
  }
};

export const transferCanonicalWalletExternalAsset = async (
  request: WalletExternalTransferRequest,
): Promise<WalletExternalOperation> => {
  if (request.amount <= 0n) throw new Error('EXTERNAL_WALLET_AMOUNT_NOT_POSITIVE');
  const tokenAddress = request.tokenAddress === ZeroAddress
    ? ZeroAddress
    : getAddress(request.tokenAddress).toLowerCase();
  const recipient = getAddress(request.recipient).toLowerCase();
  const context = await assertCurrent(request.binding);
  const privateKey = requirePrivateKey(context);
  const available = tokenAddress === ZeroAddress
    ? await context.adapter.provider.getBalance(context.binding.owner)
    : await context.adapter.getErc20Balance(tokenAddress, context.binding.owner);
  if (request.amount > available) throw new Error('EXTERNAL_WALLET_AMOUNT_EXCEEDS_BALANCE');
  await assertCurrent(request.binding);
  const transactionHash = tokenAddress === ZeroAddress
    ? await context.adapter.transferNative(privateKey, recipient, request.amount)
    : await context.adapter.transferErc20(privateKey, tokenAddress, recipient, request.amount);
  const contextCurrent = await bindingStillCurrent(request.binding);
  return {
    kind: 'transfer',
    binding: request.binding,
    tokenAddress,
    amount: request.amount,
    transactionHash,
    contextCurrent,
  };
};

export const approveCanonicalWalletExternalAsset = async (
  request: WalletExternalApprovalRequest,
): Promise<WalletExternalOperation> => {
  if (request.amount <= 0n) throw new Error('EXTERNAL_WALLET_AMOUNT_NOT_POSITIVE');
  const tokenAddress = getAddress(request.tokenAddress).toLowerCase();
  if (tokenAddress === ZeroAddress) throw new Error('EXTERNAL_WALLET_NATIVE_APPROVAL_INVALID');
  const context = await assertCurrent(request.binding);
  const privateKey = requirePrivateKey(context);
  await assertCurrent(request.binding);
  await context.adapter.approveErc20(
    privateKey,
    tokenAddress,
    request.binding.depository,
    request.amount,
    { entityId: request.binding.entityId },
  );
  const allowance = await context.adapter.getErc20Allowance(
    tokenAddress,
    request.binding.owner,
    request.binding.depository,
  );
  if (allowance < request.amount) throw new Error('EXTERNAL_WALLET_APPROVAL_POSTCONDITION_FAILED');
  const contextCurrent = await bindingStillCurrent(request.binding);
  return {
    kind: 'approve',
    binding: request.binding,
    tokenAddress,
    amount: request.amount,
    transactionHash: '',
    contextCurrent,
  };
};
