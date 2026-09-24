import {
  executeWalletRuntimeOpening,
  type WalletRuntimeOpeningExecution,
  type WalletRuntimeOpeningExecutionInput,
} from '../../packages/browser/src/runtime/wallet-runtime-opening';
import type { VaultUnlockDurationMs } from '../../packages/browser/src/vault/vault-protection';
import { buildRemoteRuntimeRecoveryPeerSources } from '../runtime/remote/remote-runtime-validation';
import { vaultOperations } from './vault-store';
import {
  discoverRuntimeRecoveryCandidates,
  normalizeRuntimeId,
  type Runtime,
  type RuntimeRecoveryCandidate,
  type RuntimeRecoveryDiscoveryResult,
} from './recovery/vault-recovery';

export type CanonicalWalletRuntimeOpeningInput = WalletRuntimeOpeningExecutionInput<
  RuntimeRecoveryCandidate,
  VaultUnlockDurationMs
>;

export type CanonicalWalletRuntimeOpeningExecution = WalletRuntimeOpeningExecution<Runtime>;

export const discoverCanonicalWalletRuntimeRecovery = async (
  seed: string,
  runtimeId: string,
): Promise<RuntimeRecoveryDiscoveryResult> => {
  const expectedRuntimeId = normalizeRuntimeId(runtimeId);
  if (!expectedRuntimeId) throw new Error('RECOVERY_RUNTIME_ID_INVALID');
  await vaultOperations.initialize();
  const discovery = await discoverRuntimeRecoveryCandidates(seed, {
    peers: buildRemoteRuntimeRecoveryPeerSources({ runtimeId: expectedRuntimeId }),
  });
  if (discovery.runtimeId !== expectedRuntimeId) {
    throw new Error(`RECOVERY_RUNTIME_ID_MISMATCH:${expectedRuntimeId}:${discovery.runtimeId}`);
  }
  return discovery;
};

export const executeCanonicalWalletRuntimeOpening = (
  input: CanonicalWalletRuntimeOpeningInput,
): Promise<CanonicalWalletRuntimeOpeningExecution> => executeWalletRuntimeOpening(input, {
  runtimeExists: runtimeId => vaultOperations.runtimeExists(runtimeId),
  unlockRuntime: (runtimeId, seed, unlockDurationMs) =>
    vaultOperations.unlockRuntime(runtimeId, seed, unlockDurationMs),
  createRuntime: (label, seed, options) =>
    vaultOperations.createRuntime(label, seed, options),
});
