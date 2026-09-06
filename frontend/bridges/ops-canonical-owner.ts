import type { RuntimeAdapter, RuntimeAdapterConfig } from '../../core/api/public/runtime-module';
import { disconnectRuntimeAdapter, getRuntimeControllerAdapter } from '../src/lib/stores/runtimeControllerStore';
import { resumeRemoteRuntimeCommandIntents, switchAppRuntimeAdapter } from '../src/lib/stores/xlnStore';
import { runtimesState, unlockVaultRuntimeSecrets, vaultOperations, vaultStorageLoaded } from '../src/lib/stores/vault/vaultStore';
import { readStoreValue } from '../src/lib/utils/observableStore';
import type { VaultUnlockDurationMs } from '../src/lib/security/vaultProtection';
import { isVaultAuthorityLeaseExpired } from '../src/lib/security/vault-authority-lease';
import { isRuntimeCommandJournalUnlocked } from '../packages/browser/src/runtime-command-journal-keyring';
import { browserRuntimeSession, installPagehideFence, setPageUnloadFence } from './browser-runtime-session';
import { readRuntimeAdapterStorageSnapshot } from '../packages/browser/src/runtime-adapter-session';

const requireSelected = (runtimeId: string): RuntimeAdapter => {
  const adapter = getRuntimeControllerAdapter();
  if (!adapter || adapter.runtimeId.toLowerCase() !== runtimeId.toLowerCase()) {
    throw new Error('OPS_OWNER_RUNTIME_CHANGED');
  }
  return adapter;
};

export const openCanonicalOpsRemoteSession = async (config: RuntimeAdapterConfig) => {
  await switchAppRuntimeAdapter(config);
  const adapter = getRuntimeControllerAdapter();
  if (!adapter || adapter.mode !== 'remote') throw new Error('OPS_REMOTE_ADAPTER_MISSING');
  return { adapter, release: () => { if (getRuntimeControllerAdapter() === adapter) disconnectRuntimeAdapter(); } };
};

export const unlockCanonicalOpsOwner = async (runtimeId: string, seed: string, durationMs: VaultUnlockDurationMs): Promise<void> => {
  const adapter = requireSelected(runtimeId);
  if (adapter.mode !== 'remote') throw new Error('OPS_REMOTE_OWNER_REQUIRED');
  // Metadata loading does not initialize the vault's local Runtime pipelines.
  if (!readStoreValue(vaultStorageLoaded)) vaultOperations.loadFromStorage();
  await unlockVaultRuntimeSecrets(runtimeId, seed, durationMs);
  if (requireSelected(runtimeId) !== adapter) throw new Error('OPS_OWNER_RUNTIME_CHANGED');
  await resumeRemoteRuntimeCommandIntents(runtimeId);
};

export const lockCanonicalOpsOwner = async (runtimeId: string): Promise<void> => {
  requireSelected(runtimeId);
  await vaultOperations.lockRuntime(runtimeId);
};

export const readCanonicalOpsOwnerVaults = () => {
  const state = readStoreValue(runtimesState);
  return { activeRuntimeId: state.activeRuntimeId,
    runtimes: Object.values(state.runtimes).map(runtime => ({ id: runtime.id, label: runtime.label })) };
};

export const loadCanonicalOpsOwnerMetadata = (): void => {
  if (!readStoreValue(vaultStorageLoaded)) vaultOperations.loadFromStorage();
};

const assertLocalSelection = (): void => {
  if (readRuntimeAdapterStorageSnapshot({ durable: localStorage, session: sessionStorage }).mode !== 'embedded') throw new Error('OPS_OWNER_RUNTIME_CHANGED');
};

export const lockCanonicalOpsLocalOwner = async (runtimeId: string): Promise<void> => {
  assertLocalSelection();
  // Key revocation must remain available if restoring the durable Runtime
  // failed after the seed was unlocked and no adapter could be installed.
  const failures: unknown[] = [];
  const ownsSession = browserRuntimeSession.getSnapshot().runtimeId === runtimeId;
  try { await vaultOperations.lockRuntime(runtimeId); } catch (cause) { failures.push(cause); }
  if (ownsSession) {
    try { await browserRuntimeSession.stop(); } catch (cause) { failures.push(cause); }
  }
  if (failures.length) throw new AggregateError(failures, 'OPS_LOCAL_OWNER_LOCK_FAILED');
};

export const unlockCanonicalOpsLocalOwner = async (runtimeId: string, seed: string, durationMs: VaultUnlockDurationMs): Promise<void> => {
  assertLocalSelection();
  if (browserRuntimeSession.getSnapshot().status === 'booting') throw new Error('EMBEDDED_RUNTIME_TRANSITION_IN_FLIGHT');
  // This is an explicit owner action. Tear down the prior resource before the
  // canonical vault resumes its Runtime; stopping it afterwards would suspend
  // the newly unlocked Runtime through the shared vault lifecycle.
  await browserRuntimeSession.stop();
  assertLocalSelection();
  installPagehideFence();
  await browserRuntimeSession.start(async () => {
    const { unlockCanonicalWalletRuntime } = await import('./wallet-canonical-vault-runtime');
    assertLocalSelection();
    const resource = await unlockCanonicalWalletRuntime(runtimeId, seed, durationMs, setPageUnloadFence);
    try { assertLocalSelection(); return resource; }
    catch (cause) { await resource.stop(); throw cause; }
  });
};

export const assertCanonicalOpsOwner = (runtimeId: string): void => {
  requireSelected(runtimeId);
  vaultOperations.assertRuntimeAuthority(runtimeId);
};

export const subscribeCanonicalOpsOwner = (listener: () => void): (() => void) => runtimesState.subscribe(listener);

export const readCanonicalOpsOwnerUnlocked = (runtimeId: string): boolean => {
  const runtime = readStoreValue(runtimesState).runtimes[runtimeId.toLowerCase()];
  return Boolean(runtime && runtime.seed && !isVaultAuthorityLeaseExpired(runtime.protectedSecrets?.unlockUntil)
    && isRuntimeCommandJournalUnlocked(runtimeId));
};
