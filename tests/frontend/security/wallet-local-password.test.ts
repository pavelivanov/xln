import { describe, expect, test } from 'bun:test';

import {
  createWalletLocalPasswordOperations,
  projectWalletLocalPasswordEntries,
  projectWalletLocalPasswordGate,
  type WalletLocalPasswordRuntime,
} from '../../../frontend/bridges/wallet/canonical/wallet-canonical-local-password';

const runtimeId = `0x${'12'.repeat(20)}`;
const runtime = (
  unlockUntil: number | null = 10_000,
  id = runtimeId,
  label = 'Local wallet',
  createdAt = 1,
): WalletLocalPasswordRuntime => ({
  id,
  label,
  createdAt,
  seed: '',
  protectedSecrets: {
    version: 1,
    keyId: 'device-key',
    iv: 'iv',
    ciphertext: 'ciphertext',
    unlockUntil,
  },
});

describe('React wallet local-password boundary', () => {
  test('projects secret-free saved wallet entries newest-first with per-wallet gate states', () => {
    const olderRuntimeId = `0x${'34'.repeat(20)}`;
    const runtimes = {
      [olderRuntimeId]: runtime(999, olderRuntimeId, 'Older wallet', 100),
      [runtimeId]: runtime(10_000, runtimeId, '', 200),
    };
    const base = {
      mode: 'embedded' as const,
      now: 1_000,
      activeRuntimeId: olderRuntimeId,
      runtimes,
      session: { status: 'idle' as const, runtimeId: '' },
    };

    const entries = projectWalletLocalPasswordEntries({
      ...base,
      hasPasswordVault: candidateRuntimeId => candidateRuntimeId === runtimeId,
    });
    expect(entries).toEqual([
      { runtimeId, label: 'Wallet', state: 'locked-password' },
      { runtimeId: olderRuntimeId, label: 'Older wallet', state: 'recovery-required' },
    ]);
    expect(JSON.stringify(entries)).not.toContain('seed');
    expect(JSON.stringify(entries)).not.toContain('protectedSecrets');
    expect(JSON.stringify(entries)).not.toContain('ciphertext');

    expect(
      projectWalletLocalPasswordEntries({
        ...base,
        hasPasswordVault: () => false,
      }),
    ).toEqual([
      { runtimeId, label: 'Wallet', state: 'new-password' },
      { runtimeId: olderRuntimeId, label: 'Older wallet', state: 'recovery-required' },
    ]);
  });

  test('projects no local entries for empty and remote vaults', () => {
    const base = {
      now: 1_000,
      activeRuntimeId: null,
      runtimes: {},
      hasPasswordVault: () => false,
      session: { status: 'idle' as const, runtimeId: '' },
    };
    expect(projectWalletLocalPasswordEntries({ ...base, mode: 'embedded' })).toEqual([]);
    expect(projectWalletLocalPasswordEntries({
      ...base,
      mode: 'remote',
      activeRuntimeId: runtimeId,
      runtimes: { [runtimeId]: runtime() },
    })).toEqual([]);
  });

  test('projects active and non-active wallets without changing persisted selection', () => {
    const otherRuntimeId = `0x${'56'.repeat(20)}`;
    const input = {
      mode: 'embedded' as const,
      now: 1_000,
      activeRuntimeId: runtimeId,
      runtimes: {
        [runtimeId]: runtime(10_000, runtimeId, 'Active wallet', 100),
        [otherRuntimeId]: runtime(10_000, otherRuntimeId, 'Other wallet', 200),
      },
      hasPasswordVault: () => true,
      session: { status: 'idle' as const, runtimeId: '' },
    };
    expect(projectWalletLocalPasswordEntries(input)).toEqual([
      { runtimeId: otherRuntimeId, label: 'Other wallet', state: 'locked-password' },
      { runtimeId, label: 'Active wallet', state: 'locked-password' },
    ]);
    expect(input.activeRuntimeId).toBe(runtimeId);
  });

  test('projects enrollment, locked, recovery, and unlocked local states', () => {
    const base = {
      mode: 'embedded' as const,
      now: 1_000,
      activeRuntimeId: runtimeId,
      runtimes: { [runtimeId]: runtime() },
      session: { status: 'idle' as const, runtimeId: '' },
    };

    expect(projectWalletLocalPasswordGate({ ...base, hasPasswordVault: false })?.state).toBe('new-password');
    expect(projectWalletLocalPasswordGate({ ...base, hasPasswordVault: true })?.state).toBe('locked-password');
    expect(
      projectWalletLocalPasswordGate({
        ...base,
        runtimes: { [runtimeId]: runtime(999) },
        hasPasswordVault: false,
      })?.state,
    ).toBe('recovery-required');
    expect(
      projectWalletLocalPasswordGate({
        ...base,
        session: { status: 'ready', runtimeId },
        hasPasswordVault: true,
      })?.state,
    ).toBe('unlocked');
    expect(
      projectWalletLocalPasswordGate({
        ...base,
        session: { status: 'ready', runtimeId },
        hasPasswordVault: false,
      })?.state,
    ).toBe('new-password');
  });

  test('excludes remote runtimes and browsers without a saved local Runtime', () => {
    expect(
      projectWalletLocalPasswordGate({
        mode: 'remote',
        now: 1_000,
        activeRuntimeId: runtimeId,
        runtimes: { [runtimeId]: runtime() },
        hasPasswordVault: true,
        session: { status: 'idle', runtimeId: '' },
      }),
    ).toBeNull();
    expect(
      projectWalletLocalPasswordGate({
        mode: 'embedded',
        now: 1_000,
        activeRuntimeId: null,
        runtimes: {},
        hasPasswordVault: false,
        session: { status: 'idle', runtimeId: '' },
      }),
    ).toBeNull();
  });

  test('enrolls before deleting the current device-restorable protection lease', async () => {
    const events: string[] = [];
    const operations = createWalletLocalPasswordOperations({
      restoreRuntimeForEnrollment: async id => {
        events.push(`restore:${id}`);
        return { ...runtime(), seed: 'seed words' };
      },
      savePasswordVault: async (_id, seed, password) => {
        events.push(`save:${seed}:${password}`);
      },
      deleteVaultDeviceKey: async () => {
        events.push('delete-device-key');
      },
      unlockPasswordVault: async () => 'seed words',
      unlockRuntime: async (id, seed) => {
        events.push(`unlock:${id}:${seed}`);
      },
      lockRuntime: async () => {},
      stopRuntimeSession: async () => {},
    });

    await operations.enrollSaved(runtimeId, 'local password');
    expect(events).toEqual([
      `restore:${runtimeId}`,
      'save:seed words:local password',
      'delete-device-key',
      `unlock:${runtimeId}:seed words`,
    ]);
  });

  test('keeps the active wallet unchanged until non-active enrollment succeeds', async () => {
    const activeId = runtimeId;
    const selectedId = `0x${'78'.repeat(20)}`;
    let persistedActiveId = activeId;
    const operations = createWalletLocalPasswordOperations({
      restoreRuntimeForEnrollment: async id => {
        expect(id).toBe(selectedId);
        expect(persistedActiveId).toBe(activeId);
        return { ...runtime(10_000, selectedId, 'Other wallet'), seed: 'other seed words' };
      },
      savePasswordVault: async id => {
        expect(id).toBe(selectedId);
        expect(persistedActiveId).toBe(activeId);
      },
      deleteVaultDeviceKey: async id => {
        expect(id).toBe(selectedId);
        expect(persistedActiveId).toBe(activeId);
      },
      unlockPasswordVault: async () => '',
      unlockRuntime: async id => {
        expect(id).toBe(selectedId);
        expect(persistedActiveId).toBe(activeId);
        persistedActiveId = id;
      },
      lockRuntime: async () => {},
      stopRuntimeSession: async () => {},
    });

    await operations.enrollSaved(selectedId, 'other password');
    expect(persistedActiveId).toBe(selectedId);
  });

  test('fresh enrollment uses submit-boundary material without restoring a Runtime', async () => {
    const events: string[] = [];
    const operations = createWalletLocalPasswordOperations({
      restoreRuntimeForEnrollment: async () => {
        events.push('restore');
        return null;
      },
      savePasswordVault: async (_id, seed, password) => {
        events.push(`save:${seed}:${password}`);
      },
      deleteVaultDeviceKey: async () => {
        events.push('delete-device-key');
      },
      unlockPasswordVault: async () => 'seed words',
      unlockRuntime: async () => {},
      lockRuntime: async () => {},
      stopRuntimeSession: async () => {},
    });

    await operations.enrollFresh(runtimeId, 'fresh seed', 'fresh password');
    expect(events).toEqual(['save:fresh seed:fresh password']);
  });

  test('decrypts before invoking the canonical Runtime unlock path', async () => {
    const events: string[] = [];
    const operations = createWalletLocalPasswordOperations({
      restoreRuntimeForEnrollment: async () => runtime(),
      savePasswordVault: async () => {},
      deleteVaultDeviceKey: async () => {},
      unlockPasswordVault: async (_id, password) => {
        events.push(`decrypt:${password}`);
        if (password === 'wrong') throw new Error('Incorrect password or damaged wallet.');
        return 'unlocked seed';
      },
      unlockRuntime: async (_id, seed) => {
        events.push(`unlock:${seed}`);
      },
      lockRuntime: async () => {},
      stopRuntimeSession: async () => {},
    });

    await expect(operations.unlock(runtimeId, 'wrong')).rejects.toThrow('Incorrect password');
    expect(events).toEqual(['decrypt:wrong']);
    await operations.unlock(runtimeId, 'right');
    expect(events).toEqual(['decrypt:wrong', 'decrypt:right', 'unlock:unlocked seed']);
  });

  test('locks through the vault owner and always clears the browser Runtime session', async () => {
    const events: string[] = [];
    const operations = createWalletLocalPasswordOperations({
      restoreRuntimeForEnrollment: async () => runtime(),
      savePasswordVault: async () => {},
      deleteVaultDeviceKey: async () => {},
      unlockPasswordVault: async () => 'seed',
      unlockRuntime: async () => {},
      lockRuntime: async () => {
        events.push('vault-lock');
      },
      stopRuntimeSession: async () => {
        events.push('session-stop');
      },
    });

    await operations.lock(runtimeId);
    expect(events).toEqual(['vault-lock', 'session-stop']);
  });

  test('lock failure is explicit after the browser session is cleared', async () => {
    const events: string[] = [];
    const operations = createWalletLocalPasswordOperations({
      restoreRuntimeForEnrollment: async () => runtime(),
      savePasswordVault: async () => {},
      deleteVaultDeviceKey: async () => {},
      unlockPasswordVault: async () => 'seed',
      unlockRuntime: async () => {},
      lockRuntime: async () => {
        events.push('vault-lock');
        throw new Error('LOCK_FAILED');
      },
      stopRuntimeSession: async () => {
        events.push('session-stop');
      },
    });

    await expect(operations.lock(runtimeId)).rejects.toThrow('LOCK_FAILED');
    expect(events).toEqual(['vault-lock', 'session-stop']);
  });
});
