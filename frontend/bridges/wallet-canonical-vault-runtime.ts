import { get } from 'svelte/store';

import type { RuntimeAdapter } from '../../core/api/public/runtime-module';
import { summarizeWalletRecoveryCandidates } from '../packages/browser/src/wallet-recovery-choice';
import type { WalletEmbeddedRuntimeResource } from '../packages/browser/src/wallet-embedded-runtime-session';
import type { WalletCanonicalRuntimeOpeningRequest } from '../packages/browser/src/wallet-runtime-opening';
import {
  discoverCanonicalWalletRuntimeRecovery,
  executeCanonicalWalletRuntimeOpening,
} from '../src/lib/stores/vault/walletRuntimeOpeningAdapter';
import {
  disconnectRuntimeAdapter,
  getRuntimeControllerAdapter,
} from '../src/lib/stores/runtimeControllerStore';
import { runtimesState, vaultOperations } from '../src/lib/stores/vault/vaultStore';
import { writeRuntimeRecoveryDiscoveryStatus } from '../src/lib/utils/recovery/recoveryDiscoveryStatus';

type PageUnloadFenceSetter = (fence: () => void) => void;

const requireCanonicalAdapter = (expectedRuntimeId: string): RuntimeAdapter => {
  const adapter = getRuntimeControllerAdapter();
  if (!adapter || adapter.mode !== 'embedded') {
    throw new Error(`CANONICAL_VAULT_ADAPTER_UNAVAILABLE:${expectedRuntimeId}`);
  }
  const actualRuntimeId = String(adapter.runtimeId || '').trim().toLowerCase();
  if (actualRuntimeId !== expectedRuntimeId) {
    throw new Error(`CANONICAL_VAULT_ADAPTER_MISMATCH:${expectedRuntimeId}:${actualRuntimeId}`);
  }
  return adapter;
};

const createCanonicalResource = (
  runtimeId: string,
  adapter: RuntimeAdapter,
  setPageUnloadFence: PageUnloadFenceSetter,
): WalletEmbeddedRuntimeResource<RuntimeAdapter> => {
  setPageUnloadFence(() => vaultOperations.beginRuntimePageUnload());
  return {
    adapter,
    runtimeId,
    readHeight: () => adapter.currentHeight,
    subscribeHeight: listener => adapter.onChange(listener),
    subscribeStatus: listener => adapter.onStatus(listener),
    stop: async () => {
      const failures: unknown[] = [];
      try {
        await vaultOperations.suspendAllRuntimeActivity();
      } catch (error: unknown) {
        failures.push(error);
      }
      try {
        disconnectRuntimeAdapter();
      } catch (error: unknown) {
        failures.push(error);
      }
      setPageUnloadFence(() => {});
      if (failures.length > 0) {
        throw new AggregateError(failures, `CANONICAL_VAULT_RUNTIME_STOP_FAILED:${runtimeId}`);
      }
    },
  };
};

export const restoreCanonicalWalletRuntime = async (
  setPageUnloadFence: PageUnloadFenceSetter,
): Promise<WalletEmbeddedRuntimeResource<RuntimeAdapter> | null> => {
  await vaultOperations.initialize();
  const state = get(runtimesState);
  const runtimeId = String(state.activeRuntimeId || '').trim().toLowerCase();
  if (!runtimeId) {
    if (Object.keys(state.runtimes).length > 0) {
      throw new Error('CANONICAL_VAULT_ACTIVE_RUNTIME_MISSING');
    }
    return null;
  }
  return createCanonicalResource(runtimeId, requireCanonicalAdapter(runtimeId), setPageUnloadFence);
};

export const openCanonicalWalletRuntime = async (
  request: WalletCanonicalRuntimeOpeningRequest,
  setPageUnloadFence: PageUnloadFenceSetter,
): Promise<WalletEmbeddedRuntimeResource<RuntimeAdapter>> => {
  const discovery = await discoverCanonicalWalletRuntimeRecovery(request.seed, request.runtimeId);
  const summary = summarizeWalletRecoveryCandidates(discovery.candidates, '');
  writeRuntimeRecoveryDiscoveryStatus({
    runtimeId: discovery.runtimeId,
    checkedTowers: discovery.checkedTowers,
    checkedPeers: discovery.checkedPeers,
    peerBackupCount: summary.peerBackupCount,
    backupCount: discovery.candidates.length,
    errors: discovery.errors,
    failures: discovery.failures,
    checkedAt: Date.now(),
  });
  if (discovery.candidates.length > 0) {
    throw new Error(`WALLET_RECOVERY_SELECTION_REQUIRED:${discovery.candidates.length}`);
  }
  await executeCanonicalWalletRuntimeOpening({
    ...request,
    recoveryCandidate: undefined,
    forceFresh: false,
    openLocal: false,
  });
  const runtimeId = discovery.runtimeId;
  return createCanonicalResource(runtimeId, requireCanonicalAdapter(runtimeId), setPageUnloadFence);
};
