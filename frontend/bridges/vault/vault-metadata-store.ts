import {
  createDerivedStore,
  createObservableStore,
  readStoreValue,
} from '../../packages/runtime-client/src/observable-store';
import { errorLog } from '../../packages/browser/src/logging/error-log-store';
import { WALLET_VAULT_STORAGE_KEY } from '../../packages/browser/src/wallet/wallet-vault-storage';
import { parseJsonUnknown } from '../../packages/runtime-client/src/boundary';
import type { ProtectedVaultSecrets } from '../../packages/browser/src/vault/vault-protection';
import { decodePersistedVaultState } from './vault-persistence-decoder';
import { serializeVaultState, type RuntimesState } from './vault-recovery';

export const emptyVaultState: RuntimesState = {
  runtimes: {},
  activeRuntimeId: null,
};

export const runtimesState = createObservableStore<RuntimesState>(emptyVaultState);

export const vaultStorageLoaded = createObservableStore(false);

export const activeRuntime = createDerivedStore(runtimesState, state => {
  if (!state.activeRuntimeId) return null;
  return state.runtimes[state.activeRuntimeId] || null;
});

export const activeSigner = createDerivedStore(activeRuntime, runtime => {
  if (!runtime) return null;
  return runtime.signers[runtime.activeSignerIndex] || null;
});

export const allRuntimes = createDerivedStore(runtimesState, state =>
  Object.values(state.runtimes).sort((left, right) => right.createdAt - left.createdAt),
);

export const persistVaultStateOrThrow = (): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WALLET_VAULT_STORAGE_KEY, serializeVaultState(readStoreValue(runtimesState)));
};

export const persistRuntimeMetadataSnapshot = (): void => {
  try {
    persistVaultStateOrThrow();
  } catch (error) {
    errorLog.log('Runtime metadata snapshot persistence failed', 'Runtime Recovery', error);
  }
};

export const readPersistedVaultProtection = (runtimeId: string): ProtectedVaultSecrets | undefined => {
  if (typeof localStorage === 'undefined') return undefined;
  const serialized = localStorage.getItem(WALLET_VAULT_STORAGE_KEY);
  if (!serialized) return undefined;
  const state = decodePersistedVaultState(parseJsonUnknown(serialized, 'VAULT_STORAGE_JSON_INVALID'));
  return state.runtimes[runtimeId]?.protectedSecrets;
};

export const loadVaultStateFromStorage = (): void => {
  if (typeof localStorage === 'undefined') return;
  const saved = localStorage.getItem(WALLET_VAULT_STORAGE_KEY);
  if (saved) {
    runtimesState.set(decodePersistedVaultState(parseJsonUnknown(saved, 'VAULT_STORAGE_JSON_INVALID')));
  }
  vaultStorageLoaded.set(true);
};

export const clearVaultState = (): void => {
  runtimesState.set(emptyVaultState);
  vaultStorageLoaded.set(true);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(WALLET_VAULT_STORAGE_KEY);
  }
};
