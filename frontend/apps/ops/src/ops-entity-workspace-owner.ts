import type { RuntimeAdapterConfig } from '@xln/core/api/public/runtime-module';

import {
  installRuntimeCommandJournalKeys,
  isRuntimeCommandJournalUnlocked,
  signRuntimeAdapterOwnerBinding,
} from '../../../packages/browser/src/runtime-command-journal-keyring';

export const signOpsEntityWorkspaceOwnerBinding: NonNullable<RuntimeAdapterConfig['ownerBindingSigner']> = (
  { runtimeId, challenge, capability },
) => isRuntimeCommandJournalUnlocked(runtimeId)
  ? signRuntimeAdapterOwnerBinding(runtimeId, challenge, capability)
  : null;

export const unlockOpsEntityWorkspaceOwner = (
  runtimeId: string,
  walletSeed: string,
): Promise<void> => installRuntimeCommandJournalKeys(runtimeId, walletSeed);
