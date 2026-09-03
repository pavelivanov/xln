import {
  executeWalletRuntimeOpening,
  type WalletRuntimeOpeningExecution,
  type WalletRuntimeOpeningExecutionInput,
} from '../../../../packages/browser/src/wallet-runtime-opening';
import type { VaultUnlockDurationMs } from '../../security/vaultProtection';
import { vaultOperations } from './vaultStore';
import type { Runtime, RuntimeRecoveryCandidate } from './vault-recovery';

export type CanonicalWalletRuntimeOpeningInput = WalletRuntimeOpeningExecutionInput<
  RuntimeRecoveryCandidate,
  VaultUnlockDurationMs
>;

export type CanonicalWalletRuntimeOpeningExecution = WalletRuntimeOpeningExecution<Runtime>;

export const executeCanonicalWalletRuntimeOpening = (
  input: CanonicalWalletRuntimeOpeningInput,
): Promise<CanonicalWalletRuntimeOpeningExecution> => executeWalletRuntimeOpening(input, {
  runtimeExists: runtimeId => vaultOperations.runtimeExists(runtimeId),
  unlockRuntime: (runtimeId, seed, unlockDurationMs) =>
    vaultOperations.unlockRuntime(runtimeId, seed, unlockDurationMs),
  createRuntime: (label, seed, options) =>
    vaultOperations.createRuntime(label, seed, options),
});
