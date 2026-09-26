import type { WalletEmbeddedRuntimeSessionSnapshot } from '../../../packages/browser/src/runtime/wallet-embedded-runtime-session';
import {
  hasPasswordVault,
  savePasswordVault,
  unlockPasswordVault,
} from '../../../packages/browser/src/vault/passwordVault';
import { deleteVaultDeviceKey, type ProtectedVaultSecrets } from '../../../packages/browser/src/vault/vault-protection';
import { WALLET_VAULT_STORAGE_KEY } from '../../../packages/browser/src/wallet/wallet-vault-storage';
import { parseJsonUnknown } from '../../../packages/runtime-client/src/boundary';
import { readStoreValue } from '../../../packages/runtime-client/src/observable-store';
import {
  browserRuntimeSession,
  installPagehideFence,
  setPageUnloadFence,
} from '../../runtime/browser/browser-runtime-session';
import { vaultOperations } from '../../vault/vault-store';
import { runtimesState } from '../../vault/vault-metadata-store';
import { decodePersistedVaultState } from '../../vault/recovery/vault-persistence-decoder';

export type WalletLocalPasswordRuntime = Readonly<{
  id: string;
  label: string;
  seed: string;
  protectedSecrets?: ProtectedVaultSecrets;
}>;

export type WalletLocalPasswordGateState = 'new-password' | 'locked-password' | 'recovery-required' | 'unlocked';

export type WalletLocalPasswordGateView = Readonly<{
  state: WalletLocalPasswordGateState;
  runtimeId: string;
  label: string;
}>;

type WalletLocalPasswordProjection = Readonly<{
  mode: 'embedded' | 'remote' | null;
  now: number;
  activeRuntimeId: string | null;
  runtimes: Readonly<Record<string, WalletLocalPasswordRuntime>>;
  hasPasswordVault: boolean;
  session: Pick<WalletEmbeddedRuntimeSessionSnapshot, 'status' | 'runtimeId'>;
}>;

export const projectWalletLocalPasswordGate = (
  input: WalletLocalPasswordProjection,
): WalletLocalPasswordGateView | null => {
  if (input.mode === 'remote' || !input.activeRuntimeId) return null;
  const runtime = input.runtimes[input.activeRuntimeId];
  if (!runtime) throw new Error(`WALLET_LOCAL_PASSWORD_RUNTIME_MISSING:${input.activeRuntimeId}`);
  const base = { runtimeId: runtime.id, label: runtime.label || 'Wallet' };
  if (input.hasPasswordVault && input.session.status === 'ready' && input.session.runtimeId === runtime.id) {
    return { ...base, state: 'unlocked' };
  }
  if (input.hasPasswordVault) return { ...base, state: 'locked-password' };
  const unlockUntil = runtime.protectedSecrets?.unlockUntil;
  const deviceLeaseUsable = Boolean(
    runtime.protectedSecrets && (unlockUntil === null || unlockUntil === undefined || unlockUntil > input.now),
  );
  return { ...base, state: deviceLeaseUsable ? 'new-password' : 'recovery-required' };
};

type WalletLocalPasswordDependencies = Readonly<{
  restoreRuntimeForEnrollment: () => Promise<void>;
  readRuntime: (runtimeId: string) => WalletLocalPasswordRuntime | null;
  savePasswordVault: (runtimeId: string, seed: string, password: string) => Promise<void>;
  deleteVaultDeviceKey: (runtimeId: string, protection: ProtectedVaultSecrets) => Promise<unknown>;
  unlockPasswordVault: (runtimeId: string, password: string) => Promise<string>;
  unlockRuntime: (runtimeId: string, seed: string) => Promise<void>;
  lockRuntime: (runtimeId: string) => Promise<void>;
  stopRuntimeSession: () => Promise<void>;
}>;

export const createWalletLocalPasswordOperations = (dependencies: WalletLocalPasswordDependencies) => ({
  enrollFresh: async (runtimeId: string, seed: string, password: string): Promise<void> => {
    await dependencies.savePasswordVault(runtimeId, seed, password);
  },
  enrollSaved: async (runtimeId: string, password: string): Promise<void> => {
    await dependencies.restoreRuntimeForEnrollment();
    const runtime = dependencies.readRuntime(runtimeId);
    if (!runtime?.seed) throw new Error(`WALLET_LOCAL_PASSWORD_RECOVERY_REQUIRED:${runtimeId}`);
    await dependencies.savePasswordVault(runtimeId, runtime.seed, password);
    if (runtime.protectedSecrets) {
      await dependencies.deleteVaultDeviceKey(runtimeId, runtime.protectedSecrets);
    }
  },
  unlock: async (runtimeId: string, password: string): Promise<void> => {
    const seed = await dependencies.unlockPasswordVault(runtimeId, password);
    await dependencies.unlockRuntime(runtimeId, seed);
  },
  lock: async (runtimeId: string): Promise<void> => {
    let lockFailure: unknown;
    try {
      await dependencies.lockRuntime(runtimeId);
    } catch (error: unknown) {
      lockFailure = error;
    }
    try {
      await dependencies.stopRuntimeSession();
    } catch (stopFailure: unknown) {
      if (lockFailure) {
        throw new AggregateError([lockFailure, stopFailure], `WALLET_LOCAL_PASSWORD_LOCK_FAILED:${runtimeId}`);
      }
      throw stopFailure;
    }
    if (lockFailure) throw lockFailure;
  },
});

const normalizeRuntimeId = (value: string): string => value.trim().toLowerCase();

const productionOperations = createWalletLocalPasswordOperations({
  restoreRuntimeForEnrollment: async () => {
    await browserRuntimeSession.start();
  },
  readRuntime: runtimeId => {
    const runtime = readStoreValue(runtimesState).runtimes[normalizeRuntimeId(runtimeId)];
    return runtime ?? null;
  },
  savePasswordVault,
  deleteVaultDeviceKey,
  unlockPasswordVault,
  unlockRuntime: async (runtimeId, seed) => {
    installPagehideFence();
    const canonical = await import('./wallet-canonical-vault-runtime');
    await browserRuntimeSession.start(() =>
      canonical.unlockCanonicalWalletRuntime(runtimeId, seed, 600_000, setPageUnloadFence),
    );
  },
  lockRuntime: runtimeId => vaultOperations.lockRuntime(runtimeId),
  stopRuntimeSession: () => browserRuntimeSession.stop(),
});

export const readCanonicalWalletLocalPasswordGate = (
  mode: 'embedded' | 'remote' | null,
  session: WalletEmbeddedRuntimeSessionSnapshot,
  now = Date.now(),
): WalletLocalPasswordGateView | null => {
  const raw = localStorage.getItem(WALLET_VAULT_STORAGE_KEY);
  if (!raw) return null;
  const persisted = decodePersistedVaultState(parseJsonUnknown(raw, 'VAULT_STORAGE_JSON_INVALID'));
  const runtimeId = persisted.activeRuntimeId;
  return projectWalletLocalPasswordGate({
    mode,
    now,
    activeRuntimeId: runtimeId,
    runtimes: persisted.runtimes,
    hasPasswordVault: runtimeId ? hasPasswordVault(runtimeId) : false,
    session,
  });
};

export const enrollFreshCanonicalWalletLocalPassword = productionOperations.enrollFresh;
export const enrollSavedCanonicalWalletLocalPassword = productionOperations.enrollSaved;
export const unlockCanonicalWalletLocalPassword = productionOperations.unlock;
export const lockCanonicalWalletLocalPassword = productionOperations.lock;
export const hasCanonicalWalletLocalPassword = hasPasswordVault;
