import {
  mergeWalletRecoveryServicesObservation,
  type WalletRecoveryServicesReadyView,
} from '../../../frontend/packages/browser/src/recovery/wallet-recovery-services';
import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';

import {
  buildRecoveryTowerStatuses,
  buildRuntimeRecoveryCoverage,
  formatRecoveryBytes,
} from '../../../frontend/bridges/wallet/recovery-coverage';
import {
  clearRuntimeRecoveryDiscoveryStatus,
  formatRuntimeRecoveryDiscoveryFailure,
  readRuntimeRecoveryDiscoveryStatus,
  subscribeRuntimeRecoveryDiscoveryStatus,
  writeRuntimeRecoveryDiscoveryStatus,
} from '../../../frontend/packages/browser/src/recovery/recovery-discovery-status';
import type { Runtime } from '../../../frontend/bridges/vault/vault-store';

const runtimeFixture = (recovery: Runtime['recovery'] = {}): Runtime => ({
  id: '0x1111111111111111111111111111111111111111',
  label: 'Test runtime',
  seed: 'test test test test test test test test test test test junk',
  signers: [],
  activeSignerIndex: 0,
  recovery,
  createdAt: 1,
});

const byId = (items: ReturnType<typeof buildRuntimeRecoveryCoverage>) =>
  Object.fromEntries(items.map((item) => [item.id, item]));

const installMemoryLocalStorage = (): void => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() {
        return values.size;
      },
    } as Storage,
  });
};

test('runtime recovery coverage shows local state and missing remote coverage honestly', () => {
  const coverage = byId(buildRuntimeRecoveryCoverage({
    runtime: runtimeFixture(),
    runtimeHeight: 12,
  }));

  expect(coverage.local_state).toMatchObject({
    status: 'ready',
    statusLabel: 'Available',
    detail: 'Browser runtime at h12',
  });
  expect(coverage.tower_backup).toMatchObject({
    status: 'missing',
    statusLabel: 'Off',
  });
  expect(coverage.last_resort).toMatchObject({
    status: 'missing',
    statusLabel: 'Off',
  });
  expect(coverage.peer_refresh).toMatchObject({
    status: 'missing',
    statusLabel: 'Not available',
  });
});

test('runtime recovery coverage reports saved remote runtime peer refresh sources', () => {
  const configured = byId(buildRuntimeRecoveryCoverage({
    runtime: runtimeFixture(),
    peerSourceCount: 2,
  }));

  expect(configured.peer_refresh).toMatchObject({
    status: 'configured',
    statusLabel: 'Configured',
    detail: '2 saved remote runtimes available for restore checks',
  });

  const observed = byId(buildRuntimeRecoveryCoverage({
    runtime: runtimeFixture(),
    peerSourceCount: 2,
    discovery: {
      checkedPeers: 2,
      peerBackupCount: 1,
    },
  }));

  expect(observed.peer_refresh).toMatchObject({
    status: 'ready',
    statusLabel: 'Backup observed',
    detail: '1 peer backup from 2 remote runtimes',
  });
});

test('runtime recovery coverage surfaces typed peer refresh failures', () => {
  const empty = byId(buildRuntimeRecoveryCoverage({
    runtime: runtimeFixture(),
    peerSourceCount: 2,
    discovery: {
      checkedPeers: 2,
      peerBackupCount: 0,
      failures: [{
        source: 'peer',
        sourceLabel: 'Peer Empty',
        category: 'ExpectedEmpty',
        code: 'PEER_RECOVERY_BUNDLE_EMPTY',
        message: 'peer did not have a backup bundle',
      }],
    },
  }));

  expect(empty.peer_refresh).toMatchObject({
    status: 'configured',
    statusLabel: 'No backup',
    detail: '2 remote runtimes checked · no peer backup found (PEER_RECOVERY_BUNDLE_EMPTY)',
  });

  const transient = byId(buildRuntimeRecoveryCoverage({
    runtime: runtimeFixture(),
    peerSourceCount: 1,
    discovery: {
      checkedPeers: 1,
      peerBackupCount: 0,
      failures: [{
        source: 'peer',
        sourceLabel: 'Peer Slow',
        category: 'TransientRace',
        code: 'RECOVERY_REQUEST_TIMEOUT',
        message: 'request timeout',
      }],
    },
  }));

  expect(transient.peer_refresh).toMatchObject({
    status: 'configured',
    statusLabel: 'Retry pending',
    detail: '1 remote runtime checked · peer refresh retry pending (RECOVERY_REQUEST_TIMEOUT)',
  });

  const contradiction = byId(buildRuntimeRecoveryCoverage({
    runtime: runtimeFixture(),
    peerSourceCount: 1,
    discovery: {
      checkedPeers: 1,
      peerBackupCount: 0,
      failures: [{
        source: 'peer',
        sourceLabel: 'Peer Wrong',
        category: 'Contradiction',
        code: 'RECOVERY_CANDIDATE_RUNTIME_ID_MISMATCH',
        message: 'candidate runtime id mismatch',
      }],
    },
  }));

  expect(contradiction.peer_refresh).toMatchObject({
    status: 'configured',
    statusLabel: 'Check failed',
    detail: '1 remote runtime checked · peer refresh failed (RECOVERY_CANDIDATE_RUNTIME_ID_MISMATCH)',
  });
});

test('runtime recovery discovery status persists peer refresh counters', () => {
  installMemoryLocalStorage();
  const runtimeId = '0x1111111111111111111111111111111111111111';

  writeRuntimeRecoveryDiscoveryStatus({
    runtimeId,
    checkedTowers: 1,
    checkedPeers: 2,
    peerBackupCount: 1,
    backupCount: 3,
    errors: ['peer-a:timeout'],
    failures: [{
      source: 'peer',
      sourceLabel: 'peer-a',
      category: 'TransientRace',
      code: 'RECOVERY_REQUEST_TIMEOUT',
      message: 'timeout',
    }],
    checkedAt: 123,
  });

  expect(readRuntimeRecoveryDiscoveryStatus(runtimeId)).toEqual({
    runtimeId,
    checkedTowers: 1,
    checkedPeers: 2,
    peerBackupCount: 1,
    backupCount: 3,
    errors: ['peer-a:timeout'],
    failures: [{
      source: 'peer',
      sourceLabel: 'peer-a',
      category: 'TransientRace',
      code: 'RECOVERY_REQUEST_TIMEOUT',
      message: 'timeout',
    }],
    checkedAt: 123,
  });

  clearRuntimeRecoveryDiscoveryStatus(runtimeId);
  expect(readRuntimeRecoveryDiscoveryStatus(runtimeId)).toBeNull();
});

test('runtime recovery discovery labels typed failures for onboarding', () => {
  expect(formatRuntimeRecoveryDiscoveryFailure({
    source: 'peer',
    sourceLabel: 'Remote H1',
    category: 'ExpectedEmpty',
    code: 'PEER_RECOVERY_BUNDLE_EMPTY',
    message: 'empty',
  })).toBe('Remote H1: no backup (PEER_RECOVERY_BUNDLE_EMPTY)');

  expect(formatRuntimeRecoveryDiscoveryFailure({
    source: 'tower',
    sourceLabel: 'Tower',
    category: 'TransientRace',
    code: 'http_503',
    message: 'unavailable',
  })).toBe('Tower: retry pending (HTTP_503)');

  expect(formatRuntimeRecoveryDiscoveryFailure({
    source: 'peer',
    sourceLabel: 'Remote H2',
    category: 'Contradiction',
    code: 'RECOVERY_CANDIDATE_RUNTIME_ID_MISMATCH',
    message: 'wrong runtime',
  })).toBe('Remote H2: check failed (RECOVERY_CANDIDATE_RUNTIME_ID_MISMATCH)');
});

test('runtime recovery coverage distinguishes configured towers from observed receipts', () => {
  const configured = byId(buildRuntimeRecoveryCoverage({
    runtime: runtimeFixture(),
    towers: [{
      id: 'tower-1',
      url: 'https://tower.example.com/',
      towerMode: 'delayed_last_resort',
      enabled: true,
    }],
  }));

  expect(configured.tower_backup).toMatchObject({
    status: 'configured',
    statusLabel: 'Configured',
  });
  expect(configured.last_resort).toMatchObject({
    status: 'configured',
    statusLabel: 'Configured',
  });

  const observed = byId(buildRuntimeRecoveryCoverage({
    runtime: runtimeFixture({
      lastKnownStoredBytes: 4096,
      lastTowerReceipts: [
        {
          towerUrl: 'https://tower.example.com',
          towerMode: 'blind_backup',
          height: 10,
          bundleHash: `0x${'11'.repeat(32)}`,
          sequence: 1,
          receivedAt: 100,
          storedBytes: 4096,
        },
        {
          towerUrl: 'https://tower.example.com',
          towerMode: 'delayed_last_resort',
          height: 10,
          bundleHash: `0x${'22'.repeat(32)}`,
          sequence: 2,
          receivedAt: 101,
        },
      ],
    }),
    towers: [{
      id: 'tower-1',
      url: 'https://tower.example.com/',
      towerMode: 'delayed_last_resort',
      enabled: true,
    }],
  }));

  expect(observed.tower_backup).toMatchObject({
    status: 'ready',
    statusLabel: 'Receipt observed',
  });
  expect(observed.tower_backup?.detail).toContain('h10');
  expect(observed.tower_backup?.detail).toContain('4.0 KB stored');
  expect(observed.last_resort).toMatchObject({
    status: 'ready',
    statusLabel: 'Receipt observed',
  });
});

test('runtime recovery coverage dedupes disabled and duplicate towers', () => {
  const coverage = byId(buildRuntimeRecoveryCoverage({
    runtime: runtimeFixture({ lastKnownStoredBytes: 1536, lastQuotaWarningAt: 7 }),
    towers: [
      { url: 'https://tower.example.com/', towerMode: 'blind_backup', enabled: true },
      { url: 'https://tower.example.com', towerMode: 'delayed_last_resort', enabled: true },
      { url: 'https://off.example.com', towerMode: 'delayed_last_resort', enabled: false },
    ],
  }));

  expect(coverage.tower_backup?.detail).toContain('1 service');
  expect(coverage.last_resort?.detail).toContain('1 disputer configured');
  expect(coverage.last_resort?.detail).toContain('quota warning');
});

test('recovery tower statuses prefer current failures over stale receipts', () => {
  const statuses = buildRecoveryTowerStatuses(runtimeFixture({
    lastTowerReceipts: [{
      towerUrl: 'https://tower.example.com',
      towerMode: 'blind_backup',
      height: 8,
      bundleHash: `0x${'11'.repeat(32)}`,
      sequence: 1,
      receivedAt: 100,
      storedBytes: 2048,
    }],
    lastTowerFailures: [{
      towerUrl: 'https://tower.example.com',
      towerMode: 'blind_backup',
      checkedAt: 110,
      error: 'HTTP_500',
    }],
  }), [{ url: 'https://tower.example.com/', towerMode: 'delayed_last_resort' }]);

  expect(statuses).toEqual([{
    url: 'https://tower.example.com',
    status: 'failure',
    label: 'Last upload failed',
    detail: 'HTTP_500',
  }]);

  const recovered = buildRecoveryTowerStatuses(runtimeFixture({
    lastTowerReceipts: [{
      towerUrl: 'https://tower.example.com',
      towerMode: 'blind_backup',
      height: 9,
      bundleHash: `0x${'22'.repeat(32)}`,
      sequence: 2,
      receivedAt: 120,
      storedBytes: 2048,
    }],
    lastTowerFailures: [{
      towerUrl: 'https://tower.example.com',
      towerMode: 'blind_backup',
      checkedAt: 110,
      error: 'HTTP_500',
    }],
  }), [{ url: 'https://tower.example.com/', towerMode: 'delayed_last_resort' }]);

  expect(recovered[0]).toMatchObject({
    status: 'receipt',
    label: 'Receipt observed',
    detail: 'h9 · seq 2 · 2.0 KB',
  });
});

test('React recovery settings renders coverage and tower status from the canonical projection', () => {
  const panel = readFileSync('frontend/apps/wallet/src/recovery/wallet-recovery-services.tsx', 'utf8');
  const coverage = readFileSync('frontend/apps/wallet/src/recovery/wallet-recovery-coverage.tsx', 'utf8');
  const source = readFileSync('frontend/bridges/wallet/wallet-canonical-recovery-services.ts', 'utf8');expect(panel).toContain('<WalletRecoveryCoverage view={view} />');
  expect(source).toContain('coverage: buildRuntimeRecoveryCoverage({');
  expect(source).toContain('towerStatuses: buildRecoveryTowerStatuses(runtime, runtime.recovery?.towers)');
  expect(source).toContain('readRuntimeRecoveryDiscoveryStatus(runtime.id)');
  expect(source).toContain('buildRemoteRuntimeRecoveryPeerSources({ runtimeId: runtime.id }).length');
  expect(coverage).toContain('view.coverage.map');
  expect(coverage).toContain('view.towerStatuses.map');
  expect(coverage).toContain('data-testid="recovery-coverage-grid"');
  expect(coverage).toContain('data-testid={`recovery-coverage-${item.id}`}');
  expect(coverage).toContain('tower.label');
  expect(coverage).toContain('tower.detail');
});

test('onboarding recovery check renders typed discovery failures', () => {
  const source = readFileSync('frontend/src/lib/components/Entity/onboarding/OnboardingPanel.svelte', 'utf8');
  expect(source).toContain('formatRuntimeRecoveryDiscoveryFailure');
  expect(source).toContain('recoveryDiscoveryFailureLabels');
  expect(source).toContain('data-testid="runtime-recovery-check-failures"');
});

test('formatRecoveryBytes keeps recovery coverage labels compact', () => {
  expect(formatRecoveryBytes(0)).toBe('0 B');
  expect(formatRecoveryBytes(64)).toBe('64 B');
  expect(formatRecoveryBytes(1536)).toBe('1.5 KB');
  expect(formatRecoveryBytes(2 * 1024 * 1024)).toBe('2.0 MB');
});

test('discovery observers follow only their Runtime and stop receiving writes after cleanup', () => {
  installMemoryLocalStorage();
  const id = runtimeFixture().id;
  const observed: Array<number | null> = [];
  const stop = subscribeRuntimeRecoveryDiscoveryStatus(id.toUpperCase(), () => {
    observed.push(readRuntimeRecoveryDiscoveryStatus(id)?.backupCount ?? null);
  });
  const status = { runtimeId: id, checkedTowers: 1, backupCount: 2, errors: [], checkedAt: 1 };
  writeRuntimeRecoveryDiscoveryStatus({ ...status, runtimeId: 'another-runtime' });
  expect(observed).toEqual([]);
  writeRuntimeRecoveryDiscoveryStatus(status);
  clearRuntimeRecoveryDiscoveryStatus(id);
  expect(observed).toEqual([2, null]);
  stop();
  const second = subscribeRuntimeRecoveryDiscoveryStatus(id, () => {
    observed.push(9);
  });
  stop();
  writeRuntimeRecoveryDiscoveryStatus(status);
  expect(observed).toEqual([2, null, 9]);
  second();
  writeRuntimeRecoveryDiscoveryStatus(status);
  expect(observed).toEqual([2, null, 9]);
});

test('live recovery evidence preserves unsaved service drafts and rejects stale Runtime or draft observers', () => {
  const current: WalletRecoveryServicesReadyView = {
    state: 'ready',
    runtimeId: 'runtime-a',
    mode: 'backup_only',
    officialAvailable: true,
    services: [{ id: 'draft', url: 'https://draft.example.com', role: 'blind_backup', official: false }],
    writable: true,
    blockedReason: '',
    coverage: [],
    towerStatuses: [],
  };
  const mutation = { runtimeId: current.runtimeId, mode: current.mode, services: current.services };
  const coverage = buildRuntimeRecoveryCoverage({ runtime: runtimeFixture(), peerSourceCount: 1 });
  const observed = { ...current, services: [], coverage, writable: false, blockedReason: 'Owner locked' };
  const merged = mergeWalletRecoveryServicesObservation(current, observed, mutation);
  expect(merged).toEqual({ ...current, coverage, writable: false, blockedReason: 'Owner locked' });
  if (merged.state !== 'ready') throw new Error('Expected ready recovery view');
  expect(merged.services).toBe(current.services);
  const newerMode = { ...current, mode: 'local_only' as const };
  expect(mergeWalletRecoveryServicesObservation(newerMode, observed, mutation)).toBe(newerMode);
  const newerDraft = { ...current, services: [...current.services] };
  expect(mergeWalletRecoveryServicesObservation(newerDraft, observed, mutation)).toBe(newerDraft);
  const nextRuntime = { ...current, runtimeId: 'runtime-b', services: [] };
  expect(mergeWalletRecoveryServicesObservation(current, nextRuntime, mutation)).toBe(nextRuntime);
  expect(mergeWalletRecoveryServicesObservation(nextRuntime, observed, mutation)).toBe(nextRuntime);
  expect(
    mergeWalletRecoveryServicesObservation(current, { state: 'unavailable', reason: 'Vault closed' }, mutation),
  ).toEqual({ state: 'unavailable', reason: 'Vault closed' });
});

test('canonical recovery observation follows receipts, discovery and Runtime changes without leaking subscriptions', async () => {
  installMemoryLocalStorage();
  const { runtimesState } = await import('../../../frontend/bridges/vault/vault-metadata-store');
  const { observeCanonicalWalletRecoveryServices } =
    await import('../../../frontend/bridges/wallet/wallet-canonical-recovery-services');
  const previous = runtimesState.get();
  const runtime = runtimeFixture({
    towers: [{ url: 'https://manual.example.com', towerMode: 'blind_backup', enabled: true }],
  });
  const views: Array<
    import('../../../frontend/packages/browser/src/recovery/wallet-recovery-services').WalletRecoveryServicesView
  > = [];
  const errors: unknown[] = [];
  let stop = () => {};
  try {
    runtimesState.set({ runtimes: { [runtime.id]: runtime }, activeRuntimeId: runtime.id });
    stop = observeCanonicalWalletRecoveryServices(
      {
        runtimeId: runtime.id,
        mode: 'local_only',
        services: [{ id: 'manual', url: 'https://manual.example.com', role: 'blind_backup', official: false }],
      },
      view => views.push(view),
      error => errors.push(error),
    );
    const ready = () => {
      const view = views.at(-1);
      if (!view || view.state !== 'ready') throw new Error('Expected ready observed recovery view');
      return view;
    };
    expect(ready().towerStatuses[0]?.label).toBe('Awaiting upload');
    const receipt = {
      towerUrl: 'https://manual.example.com',
      towerMode: 'blind_backup' as const,
      height: 8,
      bundleHash: `0x${'ab'.repeat(32)}`,
      sequence: 1,
      receivedAt: 100,
      storedBytes: 4096,
    };
    runtimesState.set({
      runtimes: { [runtime.id]: { ...runtime, recovery: { ...runtime.recovery, lastTowerReceipts: [receipt] } } },
      activeRuntimeId: runtime.id,
    });
    expect(ready().towerStatuses[0]).toMatchObject({ label: 'Receipt observed', detail: 'h8 · seq 1 · 4.0 KB' });
    writeRuntimeRecoveryDiscoveryStatus({
      runtimeId: runtime.id,
      checkedTowers: 1,
      checkedPeers: 2,
      peerBackupCount: 1,
      backupCount: 1,
      errors: [],
      checkedAt: 100,
    });
    expect(ready().coverage.find(item => item.id === 'peer_refresh')).toMatchObject({ statusLabel: 'Backup observed' });
    const other = { ...runtimeFixture(), id: `0x${'22'.repeat(20)}` };
    runtimesState.set({ runtimes: { [runtime.id]: runtime, [other.id]: other }, activeRuntimeId: other.id });
    expect(ready().runtimeId).toBe(other.id);
    expect(ready().towerStatuses).toEqual([]);
    expect(errors).toEqual([]);
    stop();
    const count = views.length;
    runtimesState.set(previous);
    clearRuntimeRecoveryDiscoveryStatus(runtime.id);
    expect(views).toHaveLength(count);
  } finally {
    stop();
    runtimesState.set(previous);
  }
});
