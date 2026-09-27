import { BRAINVAULT_V1_SPEC_ID } from '../../../../brainvault/src/core/primitives/spec';
import { getShardCount } from '../../../../brainvault/src/core';
import type {
  RuntimeAdapterBrainVaultProgress,
  RuntimeAdapterBrainVaultResult,
} from '../../../../core/api/runtime-adapter/types';
import {
  getWalletLocalLauncherOnboarding,
  setWalletLocalLauncherOnboarding,
} from '../../../packages/browser/src/runtime/wallet-local-launcher';
import {
  assertWalletNodeBrainVaultResult,
  resolveWalletNodeBrainVaultAccess,
  validateWalletNodeBrainVaultProgress,
} from '../../../packages/browser/src/identity/wallet-node-brainvault-validation';
import { getRuntimeControllerAdapter } from '../../runtime/runtime-controller-store';
import { refreshCurrentRuntimeProjection } from '../../runtime/xln-store';
import { setRuntimeViewActiveEntityId } from '../../runtime/runtime-view-store';

export type WalletDaemonOwnerInput = Readonly<{
  name: string;
  passphrase: string;
  factor: number;
  workers: number;
}>;

export const deriveCanonicalWalletDaemonOwner = async (
  input: WalletDaemonOwnerInput,
  signal: AbortSignal,
  onProgress: (progress: RuntimeAdapterBrainVaultProgress) => void,
): Promise<RuntimeAdapterBrainVaultResult> => {
  const launch = getWalletLocalLauncherOnboarding();
  if (launch.stage !== 'create' || !launch.runtimeId) throw new Error('LOCAL_LAUNCHER_CREATE_SESSION_MISSING');
  const access = resolveWalletNodeBrainVaultAccess(getRuntimeControllerAdapter());
  if (access.status === 'blocked') throw new Error(access.message);
  if (access.adapter.runtimeId.toLowerCase() !== launch.runtimeId) throw new Error('LOCAL_LAUNCHER_RUNTIME_CHANGED');
  const shardCount = getShardCount(input.factor);
  const operation = new AbortController();
  const abort = () => operation.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  let progressError = '';
  let result: RuntimeAdapterBrainVaultResult;
  try {
    result = await access.adapter.deriveBrainVault({
      specId: BRAINVAULT_V1_SPEC_ID,
      name: input.name,
      passphrase: input.passphrase,
      shardInput: input.factor,
      workers: input.workers,
    }, {
      signal: operation.signal,
      onProgress: progress => {
        const validation = validateWalletNodeBrainVaultProgress(progress, shardCount);
        if (!validation.valid) {
          progressError = validation.message;
          operation.abort(validation.message);
          return;
        }
        onProgress(progress);
      },
    });
  } catch (error: unknown) {
    if (progressError) throw new Error(progressError);
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
  }
  assertWalletNodeBrainVaultResult(result, BRAINVAULT_V1_SPEC_ID, shardCount);
  setRuntimeViewActiveEntityId(result.entityId);
  // The daemon has already persisted and installed this owner. Publish the
  // authoritative formation state before the fallible projection refresh so a
  // transient disconnect can only leave Formation waiting, never resurrect
  // the obsolete owner-creation screen.
  setWalletLocalLauncherOnboarding({
    stage: 'formation',
    entityId: result.entityId,
    runtimeId: launch.runtimeId,
  });
  await refreshCurrentRuntimeProjection();
  return result;
};
