import type { WalletEmbeddedRuntimeSessionSnapshot } from '../../../packages/browser/src/runtime/wallet-embedded-runtime-session';
import {
  hasPasswordVault,
  savePasswordVault,
  unlockPasswordVault,
} from '../../../packages/browser/src/vault/passwordVault';
import {
  deleteVaultDeviceKey,
  unprotectVaultSecrets,
  type ProtectedVaultSecrets,
} from '../../../packages/browser/src/vault/vault-protection';
import { WALLET_VAULT_STORAGE_KEY } from '../../../packages/browser/src/wallet/wallet-vault-storage';
import { parseJsonUnknown } from '../../../packages/runtime-client/src/boundary';
import {
  browserRuntimeSession,
  installPagehideFence,
  setPageUnloadFence,
} from '../../runtime/browser/browser-runtime-session';
import { vaultOperations } from '../../vault/vault-store';
import { decodePersistedVaultState } from '../../vault/recovery/vault-persistence-decoder';

export type WalletLocalPasswordRuntime = Readonly<{
  id: string;
  label: string;
  createdAt: number;
  seed: string;
  protectedSecrets?: ProtectedVaultSecrets;
}>;

export type WalletLocalPasswordGateState = 'new-password' | 'locked-password' | 'recovery-required' | 'unlocked';

export type WalletLocalPasswordGateView = {
  [State in WalletLocalPasswordGateState]: Readonly<{
    state: State;
    runtimeId: string;
    label: string;
  }>;
}[WalletLocalPasswordGateState];

export type WalletLocalPasswordBlockedView = Exclude<WalletLocalPasswordGateView, { state: 'unlocked' }>;

export const isWalletLocalPasswordBlockedView = (
  view: WalletLocalPasswordGateView,
): view is WalletLocalPasswordBlockedView => view.state !== 'unlocked';

type WalletLocalPasswordProjection = Readonly<{
  mode: 'embedded' | 'remote' | null;
  now: number;
  activeRuntimeId: string | null;
  runtimes: Readonly<Record<string, WalletLocalPasswordRuntime>>;
  hasPasswordVault: boolean;
  session: Pick<WalletEmbeddedRuntimeSessionSnapshot, 'status' | 'runtimeId'>;
}>;

type WalletLocalPasswordEntriesProjection = Readonly<
  Omit<WalletLocalPasswordProjection, 'hasPasswordVault'> & {
    hasPasswordVault: (runtimeId: string) => boolean;
  }
>;

const projectWalletLocalPasswordRuntime = (
  runtime: WalletLocalPasswordRuntime,
  input: Pick<WalletLocalPasswordProjection, 'now' | 'session'>,
  passwordVaultExists: boolean,
): WalletLocalPasswordGateView => {
  const base = { runtimeId: runtime.id, label: runtime.label || 'Wallet' };
  if (passwordVaultExists && input.session.status === 'ready' && input.session.runtimeId === runtime.id) {
    return { ...base, state: 'unlocked' };
  }
  if (passwordVaultExists) return { ...base, state: 'locked-password' };
  const unlockUntil = runtime.protectedSecrets?.unlockUntil;
  const deviceLeaseUsable = Boolean(
    runtime.protectedSecrets && (unlockUntil === null || unlockUntil === undefined || unlockUntil > input.now),
  );
  return { ...base, state: deviceLeaseUsable ? 'new-password' : 'recovery-required' };
};

export const projectWalletLocalPasswordGate = (
  input: WalletLocalPasswordProjection,
): WalletLocalPasswordGateView | null => {
  if (input.mode === 'remote' || !input.activeRuntimeId) return null;
  const runtime = input.runtimes[input.activeRuntimeId];
  if (!runtime) throw new Error(`WALLET_LOCAL_PASSWORD_RUNTIME_MISSING:${input.activeRuntimeId}`);
  return projectWalletLocalPasswordRuntime(runtime, input, input.hasPasswordVault);
};

export const projectWalletLocalPasswordEntries = (
  input: WalletLocalPasswordEntriesProjection,
): readonly WalletLocalPasswordGateView[] => {
  if (input.mode === 'remote') return [];
  return Object.values(input.runtimes)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map(runtime => projectWalletLocalPasswordRuntime(runtime, input, input.hasPasswordVault(runtime.id)));
};

type WalletLocalPasswordDependencies = Readonly<{
  restoreRuntimeForEnrollment: (runtimeId: string) => Promise<WalletLocalPasswordRuntime | null>;
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
    // Device recovery may expose only this target's seed; it must not select or
    // start any Runtime. Password persistence retires that bootstrap lease, and
    // canonical unlock is the sole step allowed to move active authority.
    const runtime = await dependencies.restoreRuntimeForEnrollment(runtimeId);
    if (!runtime?.seed) throw new Error(`WALLET_LOCAL_PASSWORD_RECOVERY_REQUIRED:${runtimeId}`);
    await dependencies.savePasswordVault(runtimeId, runtime.seed, password);
    if (runtime.protectedSecrets) {
      await dependencies.deleteVaultDeviceKey(runtimeId, runtime.protectedSecrets);
    }
    await dependencies.unlockRuntime(runtimeId, runtime.seed);
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

const readPersistedRuntime = (runtimeId: string): WalletLocalPasswordRuntime | null => {
  const raw = localStorage.getItem(WALLET_VAULT_STORAGE_KEY);
  if (!raw) return null;
  const persisted = decodePersistedVaultState(parseJsonUnknown(raw, 'VAULT_STORAGE_JSON_INVALID'));
  return persisted.runtimes[normalizeRuntimeId(runtimeId)] ?? null;
};

const productionOperations = createWalletLocalPasswordOperations({
  restoreRuntimeForEnrollment: async runtimeId => {
    const runtime = readPersistedRuntime(runtimeId);
    if (!runtime?.protectedSecrets) return runtime;
    const secrets = await unprotectVaultSecrets(runtime.id, runtime.protectedSecrets);
    return secrets ? { ...runtime, seed: secrets.seed } : runtime;
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

export const readCanonicalWalletLocalPasswordEntries = (
  mode: 'embedded' | 'remote' | null,
  session: WalletEmbeddedRuntimeSessionSnapshot,
  now = Date.now(),
): readonly WalletLocalPasswordGateView[] => {
  const raw = localStorage.getItem(WALLET_VAULT_STORAGE_KEY);
  if (!raw) return [];
  const persisted = decodePersistedVaultState(parseJsonUnknown(raw, 'VAULT_STORAGE_JSON_INVALID'));
  return projectWalletLocalPasswordEntries({
    mode,
    now,
    activeRuntimeId: persisted.activeRuntimeId,
    runtimes: persisted.runtimes,
    hasPasswordVault,
    session,
  });
};

export const enrollFreshCanonicalWalletLocalPassword = productionOperations.enrollFresh;
export const enrollSavedCanonicalWalletLocalPassword = productionOperations.enrollSaved;
export const unlockCanonicalWalletLocalPassword = productionOperations.unlock;
export const lockCanonicalWalletLocalPassword = productionOperations.lock;
export const hasCanonicalWalletLocalPassword = hasPasswordVault;
