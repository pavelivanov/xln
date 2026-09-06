import type { RuntimeAdapterConfig } from '@xln/core/api/public/runtime-module';

import {
  isRuntimeCommandJournalUnlocked,
  signRuntimeAdapterOwnerBinding,
} from '../../../packages/browser/src/runtime-command-journal-keyring';

export const signOpsEntityWorkspaceOwnerBinding: NonNullable<RuntimeAdapterConfig['ownerBindingSigner']> = (
  { runtimeId, challenge, capability },
) => isRuntimeCommandJournalUnlocked(runtimeId)
  ? signRuntimeAdapterOwnerBinding(runtimeId, challenge, capability)
  : null;
