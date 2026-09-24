import { readStoreValue } from '../../packages/runtime-client/src/observable-store';
import { errorLog } from '../../packages/browser/src/logging/error-log-store';
import { hasPasswordVault } from '../../packages/browser/src/vault/passwordVault';
import {
  deleteVaultDeviceKey,
  protectVaultSecrets,
  sameVaultProtectionLease,
  unprotectVaultSecrets,
  type ProtectedVaultSecrets,
  type VaultUnlockDurationMs,
} from '../../packages/browser/src/vault/vault-protection';
import { isVaultAuthorityLeaseExpired } from '../../packages/browser/src/vault/vault-authority-lease';
import { lockRuntimeCommandJournal } from '../../packages/browser/src/commands/runtime-command-journal-keyring';
import { findRuntimeByIdCaseInsensitive } from './vault-helpers';
import {
  deriveAddress,
  installVaultRuntimeCommandJournalKeys,
  normalizeRuntimeId,
  type Runtime,
} from './recovery/vault-recovery';
import { persistVaultStateOrThrow, runtimesState } from './vault-metadata-store';

export const DEFAULT_VAULT_UNLOCK_DURATION_MS: VaultUnlockDurationMs = 600_000;

export type VaultRuntimeLock = (
  runtimeId: string,
  expectedProtection?: ProtectedVaultSecrets,
) => Promise<void>;

const vaultLockTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const clearVaultLockTimer = (runtimeId: string): void => {
  const timer = vaultLockTimers.get(runtimeId);
  if (timer) clearTimeout(timer);
  vaultLockTimers.delete(runtimeId);
};

export const scheduleVaultLock = (runtime: Runtime, lockRuntime: VaultRuntimeLock): void => {
  const runtimeId = normalizeRuntimeId(runtime.id);
  if (!runtimeId) return;
  clearVaultLockTimer(runtimeId);
  const expectedProtection = runtime.protectedSecrets;
  const unlockUntil = expectedProtection?.unlockUntil;
  if (unlockUntil === null || unlockUntil === undefined) return;
  const delay = Math.max(0, unlockUntil - Date.now());
  vaultLockTimers.set(
    runtimeId,
    setTimeout(() => {
      vaultLockTimers.delete(runtimeId);
      void lockRuntime(runtimeId, expectedProtection).catch(error => {
        errorLog.log('Timed wallet lock failed', 'Runtime Security', { runtimeId, error });
      });
    }, delay),
  );
};

export const assertRuntimeAuthorityLease = (runtime: Runtime, lockRuntime: VaultRuntimeLock): void => {
  if (!runtime.seed) throw new Error(`RUNTIME_LOCKED:${runtime.id}`);
  if (!isVaultAuthorityLeaseExpired(runtime.protectedSecrets?.unlockUntil)) return;
  const expectedProtection = runtime.protectedSecrets;
  lockRuntimeCommandJournal(runtime.id);
  void lockRuntime(runtime.id, expectedProtection).catch(error => {
    errorLog.log('Expired wallet lock failed', 'Runtime Security', { runtimeId: runtime.id, error });
  });
  throw new Error(`VAULT_UNLOCK_EXPIRED:${runtime.id}`);
};

export const protectRuntimeForDevice = async (
  runtime: Runtime,
  durationMs: VaultUnlockDurationMs,
  persist: () => void,
  lockRuntime: VaultRuntimeLock,
): Promise<void> => {
  if (!runtime.seed) throw new Error(`RUNTIME_LOCKED:${runtime.id}`);
  const previousProtection = runtime.protectedSecrets;
  const nextProtection = await protectVaultSecrets(
    runtime.id,
    {
      seed: runtime.seed,
      ...(runtime.mnemonic12 ? { mnemonic12: runtime.mnemonic12 } : {}),
    },
    durationMs,
  );
  runtime.protectedSecrets = nextProtection;
  delete runtime.devicePassphrase;
  try {
    persist();
  } catch (error) {
    if (previousProtection) runtime.protectedSecrets = previousProtection;
    else delete runtime.protectedSecrets;
    await deleteVaultDeviceKey(runtime.id, nextProtection);
    throw error;
  }
  if (previousProtection && !sameVaultProtectionLease(previousProtection, nextProtection)) {
    try {
      await deleteVaultDeviceKey(runtime.id, previousProtection);
    } catch (error) {
      errorLog.log('Previous wallet key cleanup failed', 'Runtime Security', { runtimeId: runtime.id, error });
    }
  }
  if (hasPasswordVault(runtime.id)) await deleteVaultDeviceKey(runtime.id, nextProtection);
  scheduleVaultLock(runtime, lockRuntime);
};

export const restoreRuntimeFromDevice = async (
  runtime: Runtime,
  lockRuntime: VaultRuntimeLock,
): Promise<boolean> => {
  if (runtime.seed) return true;
  if (hasPasswordVault(runtime.id) || !runtime.protectedSecrets) return false;
  const secrets = await unprotectVaultSecrets(runtime.id, runtime.protectedSecrets);
  if (!secrets) return false;
  runtime.seed = secrets.seed;
  if (secrets.mnemonic12) runtime.mnemonic12 = secrets.mnemonic12;
  try {
    await installVaultRuntimeCommandJournalKeys(runtime.id, runtime.seed);
  } catch (error) {
    runtime.seed = '';
    delete runtime.mnemonic12;
    throw error;
  }
  scheduleVaultLock(runtime, lockRuntime);
  return true;
};

export const unlockVaultRuntimeSecrets = async (
  runtimeId: string,
  seed: string,
  durationMs: VaultUnlockDurationMs,
  lockRuntime: VaultRuntimeLock,
): Promise<string> => {
  const normalizedRuntimeId = normalizeRuntimeId(runtimeId);
  if (!normalizedRuntimeId) throw new Error('Invalid runtimeId');
  const resolved = findRuntimeByIdCaseInsensitive(readStoreValue(runtimesState).runtimes, normalizedRuntimeId);
  if (!resolved) throw new Error(`Runtime not found: ${normalizedRuntimeId}`);
  if (normalizeRuntimeId(deriveAddress(seed, 0)) !== normalizedRuntimeId) {
    throw new Error('RUNTIME_UNLOCK_SEED_MISMATCH');
  }
  const previousSeed = resolved.runtime.seed;
  resolved.runtime.seed = seed;
  try {
    await installVaultRuntimeCommandJournalKeys(normalizedRuntimeId, seed);
    await protectRuntimeForDevice(
      resolved.runtime,
      durationMs,
      persistVaultStateOrThrow,
      lockRuntime,
    );
  } catch (error) {
    resolved.runtime.seed = previousSeed;
    if (previousSeed) {
      try {
        await installVaultRuntimeCommandJournalKeys(normalizedRuntimeId, previousSeed);
      } catch (restoreError) {
        lockRuntimeCommandJournal(normalizedRuntimeId);
        throw new AggregateError([error, restoreError], 'RUNTIME_COMMAND_JOURNAL_KEY_ROLLBACK_FAILED');
      }
    } else {
      lockRuntimeCommandJournal(normalizedRuntimeId);
    }
    throw error;
  }
  return normalizedRuntimeId;
};

export const lockExpiredRuntimeLeases = async (
  now: number,
  lockRuntime: VaultRuntimeLock,
): Promise<void> => {
  const expired = Object.values(readStoreValue(runtimesState).runtimes)
    .filter(runtime => runtime.seed && isVaultAuthorityLeaseExpired(runtime.protectedSecrets?.unlockUntil, now))
    .map(runtime => ({ runtimeId: runtime.id, protection: runtime.protectedSecrets }));
  for (const entry of expired) {
    lockRuntimeCommandJournal(entry.runtimeId);
    await lockRuntime(entry.runtimeId, entry.protection);
  }
};
