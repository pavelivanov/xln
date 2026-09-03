import { get } from 'svelte/store';

import type { RuntimeAdapter } from '../../core/api/public/runtime-module';
import {
  mergeWalletRecoveryCandidate,
  summarizeWalletRecoveryCandidates,
} from '../packages/browser/src/wallet-recovery-choice';
import type { WalletEmbeddedRuntimeResource } from '../packages/browser/src/wallet-embedded-runtime-session';
import { WalletRecoverySelectionSession } from '../packages/browser/src/wallet-recovery-selection-session';
import { WalletBrainVaultMaterialSession } from '../packages/browser/src/wallet-brainvault-material-session';
import type {
  WalletBrainVaultDerivationInput,
  WalletBrainVaultDerivationProgress,
  WalletBrainVaultDerivedMaterial,
  WalletBrainVaultPreparedView,
} from '../packages/browser/src/wallet-brainvault-opening';
import type {
  WalletCanonicalRecoveryCandidateView,
  WalletCanonicalRecoveryDiscoveryView,
  WalletCanonicalRecoveryFile,
  WalletCanonicalRuntimeOpeningRequest,
} from '../packages/browser/src/wallet-runtime-opening';
import {
  discoverCanonicalWalletRuntimeRecovery,
  executeCanonicalWalletRuntimeOpening,
} from '../src/lib/stores/vault/walletRuntimeOpeningAdapter';
import { parseRuntimeRecoveryCandidateFile } from '../src/lib/stores/vault/vault-recovery';
import {
  disconnectRuntimeAdapter,
  getRuntimeControllerAdapter,
} from '../src/lib/stores/runtimeControllerStore';
import { runtimesState, vaultOperations } from '../src/lib/stores/vault/vaultStore';
import { writeRuntimeRecoveryDiscoveryStatus } from '../src/lib/utils/recovery/recoveryDiscoveryStatus';
import type { RuntimeRecoveryCandidate } from '../src/lib/stores/vault/vault-recovery';
import { WalletBrainVaultBrowserDerivation } from './wallet-brainvault-browser-derivation';

type PageUnloadFenceSetter = (fence: () => void) => void;

const recoverySelection = new WalletRecoverySelectionSession<RuntimeRecoveryCandidate>();
const brainVaultDerivation = new WalletBrainVaultBrowserDerivation();
const brainVaultMaterials = new WalletBrainVaultMaterialSession<WalletBrainVaultDerivedMaterial>();

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

export const discardCanonicalWalletBrainVault = (token = ''): void => {
  if (!brainVaultMaterials.discard(token)) return;
  brainVaultDerivation.cancel();
  recoverySelection.discard();
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

export const importCanonicalWalletRuntimeRecoveryFile = async (
  request: WalletCanonicalRuntimeOpeningRequest,
  token: string,
  file: WalletCanonicalRecoveryFile,
): Promise<WalletCanonicalRecoveryCandidateView> => {
  const runtimeId = request.runtimeId.trim().toLowerCase();
  recoverySelection.read(token, runtimeId);
  const candidate = await parseRuntimeRecoveryCandidateFile(request.seed, file.contents, {
    sourceLabel: file.sourceLabel || 'Local backup file',
  });
  if (candidate.runtimeId !== runtimeId) {
    throw new Error(`RECOVERY_BACKUP_FILE_RUNTIME_MISMATCH:${runtimeId}:${candidate.runtimeId}`);
  }
  recoverySelection.update(token, runtimeId, candidates => (
    mergeWalletRecoveryCandidate(candidates, candidate)
  ));
  return projectRecoveryCandidate(candidate);
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

const brainVaultOpeningRequest = (
  material: WalletBrainVaultDerivedMaterial,
): WalletCanonicalRuntimeOpeningRequest => ({
  runtimeId: material.runtimeId,
  name: material.name,
  labelOverride: material.name,
  seed: material.mnemonic24,
  mnemonic12: material.mnemonic12,
  devicePassphrase: material.devicePassphrase,
  loginType: 'manual',
  unlockDurationMs: 600_000,
});

export const prepareCanonicalWalletBrainVault = async (
  input: WalletBrainVaultDerivationInput,
  onProgress: (progress: WalletBrainVaultDerivationProgress) => void,
): Promise<WalletBrainVaultPreparedView> => {
  const revision = brainVaultMaterials.begin();
  recoverySelection.discard();
  const material = await brainVaultDerivation.derive(input, onProgress);
  onProgress({
    phase: 'recovery',
    completed: material.shardCount,
    total: material.shardCount,
    workers: 0,
    notice: '',
  });
  const discovery = await discoverCanonicalWalletRuntimeRecoveryView(
    brainVaultOpeningRequest(material),
  );
  try {
    return {
      token: brainVaultMaterials.commit(revision, material),
      runtimeId: material.runtimeId,
      name: material.name,
      factor: material.factor,
      shardCount: material.shardCount,
      discovery,
    };
  } catch (error) {
    recoverySelection.discard(discovery.token);
    throw error;
  }
};

export const openCanonicalWalletBrainVault = async (
  token: string,
  runtimeId: string,
  recoveryToken: string,
  candidateId: string,
  setPageUnloadFence: PageUnloadFenceSetter,
): Promise<WalletEmbeddedRuntimeResource<RuntimeAdapter>> => {
  const material = brainVaultMaterials.consume(token, runtimeId);
  const request = brainVaultOpeningRequest(material);
  return openCanonicalWalletRuntime(request, recoveryToken, candidateId, setPageUnloadFence);
};

export const importCanonicalWalletBrainVaultRecoveryFile = (
  token: string,
  runtimeId: string,
  recoveryToken: string,
  file: WalletCanonicalRecoveryFile,
): Promise<WalletCanonicalRecoveryCandidateView> => {
  const material = brainVaultMaterials.read(token, runtimeId);
  return importCanonicalWalletRuntimeRecoveryFile(
    brainVaultOpeningRequest(material),
    recoveryToken,
    file,
  );
};
