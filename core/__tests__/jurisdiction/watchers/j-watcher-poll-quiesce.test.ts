import { describe, expect, test } from 'bun:test';

import { runWatcherPoll } from '../../../jurisdiction/adapter/rpc/watcher/rpc-watcher-poll';
import type {
  RpcWatcherServices,
  RpcWatcherSession,
} from '../../../jurisdiction/adapter/rpc/watcher/rpc-watcher-types';
import { createEmptyEnv } from '../../../runtime';
import type { JReplica } from '../../../types/jurisdiction-runtime';

describe('RPC J-watcher persistence quiesce fence', () => {
  test('rechecks quiesce after an asynchronous canonical audit before Runtime ingress', async () => {
    const env = createEmptyEnv('watcher-post-audit-quiesce');
    const depositoryAddress = `0x${'41'.repeat(20)}`;
    const entityProviderAddress = `0x${'42'.repeat(20)}`;
    env.state.jReplicas.set('post-audit-quiesce', {
      name: 'post-audit-quiesce',
      blockNumber: 0n,
      chainId: 31_337,
      contracts: { depository: depositoryAddress, entityProvider: entityProviderAddress },
      stateRoot: new Uint8Array(32),
      mempool: [],
      blockDelayMs: 0,
      lastBlockTimestamp: 0,
      position: { x: 0, y: 0, z: 0 },
    } as JReplica);
    const session = {
      env,
      generation: 1,
      interval: null,
      manualPolling: true,
      confirmationDepth: 0,
      pollMs: 1,
      lastSyncedBlock: 1,
      scanProgress: { scannedThroughHeight: 0, replicaScannedThrough: {} },
      pendingBlocks: new Map(),
      pendingHistoryRange: null,
      pendingHistoryWaitKey: '',
      pendingRewindReplicaKeys: [],
      lastAuthorityAuditKey: '',
      lastObservedHead: 1,
      lastCanonicalAuditAtMs: 0,
      transientFailures: 0,
      lastTransientLogAtMs: 0,
      txCounter: { value: 0, _seenLogs: { set: new Set(), order: [] } },
      readWatchedErc20Tokens: async () => [],
    } as RpcWatcherSession;
    let rangeIngressAttempted = false;
    const services = {
      chainId: 31_337,
      depositoryAddress,
      entityProviderAddress,
      readCurrentBlockNumber: async () => 2,
      readSafeBlockNumber: async () => 2,
      readBlockHeaders: async (heights: number[]) => {
        env.infrastructure!.persistenceQuiescing = true;
        return heights.map(jHeight => ({
          jHeight,
          jBlockHash: `0x${jHeight.toString(16).padStart(64, '0')}`,
        }));
      },
      getLiveDepositoryAddress: async () => {
        rangeIngressAttempted = true;
        throw new Error('POST_AUDIT_RANGE_INGRESS_MUST_NOT_START');
      },
    } as unknown as RpcWatcherServices;
    const debug: Record<string, unknown>[] = [];

    await runWatcherPoll({
      session,
      services,
      trace: { step: 'start', fromBlock: null, toBlock: null },
      isCancelled: () => false,
      emitDebug: payload => { debug.push(payload); },
    });

    expect(rangeIngressAttempted).toBe(false);
    expect(env.runtimeMempool?.runtimeTxs).toHaveLength(0);
    expect(debug).toContainEqual(expect.objectContaining({
      event: 'j_watch_paused_persistence_quiescing',
      step: 'after-canonical-audit',
    }));
  });
});
