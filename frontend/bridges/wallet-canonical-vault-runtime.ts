import { get } from 'svelte/store';

import type { RuntimeAdapter } from '../../core/api/public/runtime-module';
import { summarizeWalletRecoveryCandidates } from '../packages/browser/src/wallet-recovery-choice';
import type { WalletEmbeddedRuntimeResource } from '../packages/browser/src/wallet-embedded-runtime-session';
import { WalletRecoverySelectionSession } from '../packages/browser/src/wallet-recovery-selection-session';
import type {
  WalletCanonicalRecoveryCandidateView,
  WalletCanonicalRecoveryDiscoveryView,
  WalletCanonicalRuntimeOpeningRequest,
} from '../packages/browser/src/wallet-runtime-opening';
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
import type { RuntimeRecoveryCandidate } from '../src/lib/stores/vault/vault-recovery';

type PageUnloadFenceSetter = (fence: () => void) => void;

const recoverySelection = new WalletRecoverySelectionSession<RuntimeRecoveryCandidate>();

const projectRecoveryCandidate = (
  candidate: RuntimeRecoveryCandidate,
): WalletCanonicalRecoveryCandidateView => ({
  id: candidate.id,
  source: candidate.source,
  sourceLabel: candidate.towerUrl || candidate.sourceLabel,
  runtimeHeight: candidate.runtimeHeight,
  createdAt: candidate.createdAt,
  signerCount: candidate.signerCount,
  bundleCount: candidate.bundleCount,
});

export const discardCanonicalWalletRuntimeRecovery = (token = ''): void => {
  recoverySelection.discard(token);
};

const consumeRecoveryCandidate = (
  request: WalletCanonicalRuntimeOpeningRequest,
  token: string,
  candidateId: string,
): RuntimeRecoveryCandidate | undefined => {
  const runtimeId = request.runtimeId.trim().toLowerCase();
  return recoverySelection.consume(token, runtimeId, candidateId);
};

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

export const discoverCanonicalWalletRuntimeRecoveryView = async (
  request: WalletCanonicalRuntimeOpeningRequest,
): Promise<WalletCanonicalRecoveryDiscoveryView> => {
  const revision = recoverySelection.begin();
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
  const token = recoverySelection.commit(revision, discovery.runtimeId, discovery.candidates);
  return {
    token,
    runtimeId: discovery.runtimeId,
    candidates: discovery.candidates.map(projectRecoveryCandidate),
    errors: discovery.errors,
    checkedTowers: discovery.checkedTowers,
    checkedPeers: discovery.checkedPeers,
    peerBackupCount: summary.peerBackupCount,
  };
};

export const openCanonicalWalletRuntime = async (
  request: WalletCanonicalRuntimeOpeningRequest,
  token: string,
  candidateId: string,
  setPageUnloadFence: PageUnloadFenceSetter,
): Promise<WalletEmbeddedRuntimeResource<RuntimeAdapter>> => {
  const recoveryCandidate = consumeRecoveryCandidate(request, token, candidateId);
  await executeCanonicalWalletRuntimeOpening({
    ...request,
    recoveryCandidate,
    forceFresh: false,
    openLocal: false,
  });
  const runtimeId = request.runtimeId.trim().toLowerCase();
  return createCanonicalResource(runtimeId, requireCanonicalAdapter(runtimeId), setPageUnloadFence);
};
