import type { RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';

import {
  projectEntityWorkspaceContext,
  type EntityWorkspaceContext,
} from '../../../../packages/runtime-client/src/entity/entity-workspace-context';
import {
  projectEntityWorkspaceHubPolicy,
  type EntityWorkspaceHubPolicy,
} from '../../../../packages/runtime-client/src/entity/profile/entity-workspace-hub-policy';
import {
  projectEntityWorkspaceProfile,
  type EntityWorkspaceProfile,
} from '../../../../packages/runtime-client/src/entity/profile/entity-workspace-profile';
import {
  projectEntityWorkspaceReserves,
  type EntityWorkspaceReserves,
} from '../../../../packages/runtime-client/src/entity/entity-workspace-reserves';
import {
  normalizeRequiredRuntimeEntityId,
  requireRuntimeRecord,
  requireRuntimeString,
} from '../runtime/wallet-runtime-decode';

export type WalletProfileEntity = Readonly<{ entityId: string; label: string }>;
export type WalletProfileProjection = Readonly<{
  context: EntityWorkspaceContext;
  entities: readonly WalletProfileEntity[];
  hubPolicy: EntityWorkspaceHubPolicy;
  profile: EntityWorkspaceProfile;
  reserves: EntityWorkspaceReserves;
}>;

const projectEntity = (value: unknown): WalletProfileEntity => {
  const entity = requireRuntimeRecord(value, 'WALLET_PROFILE_ENTITY');
  return {
    entityId: normalizeRequiredRuntimeEntityId(entity['entityId'], 'WALLET_PROFILE_ENTITY_ID'),
    label: requireRuntimeString(entity['label'], 'WALLET_PROFILE_ENTITY_LABEL'),
  };
};

export const projectWalletProfileFrame = (
  runtimeId: string,
  frame: RuntimeAdapterViewFrame,
): WalletProfileProjection => {
  const root = requireRuntimeRecord(frame, 'WALLET_PROFILE_FRAME');
  const entities = root['entities'];
  if (!Array.isArray(entities)) throw new Error('WALLET_PROFILE_ENTITIES_INVALID');
  const context = projectEntityWorkspaceContext({ runtimeId, frame });
  return {
    context,
    entities: entities.map(projectEntity),
    hubPolicy: projectEntityWorkspaceHubPolicy({ context, frame }),
    profile: projectEntityWorkspaceProfile({ context, frame }),
    reserves: projectEntityWorkspaceReserves({ context, frame }),
  };
};
