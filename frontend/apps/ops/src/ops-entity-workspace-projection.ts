import type { RuntimeQuerySnapshot } from '../../../packages/runtime-client/src/runtime-query-observer';
import {
  emptyEntityWorkspaceAccounts,
  projectEntityWorkspaceAccounts,
  type EntityWorkspaceAccounts,
} from '../../../packages/runtime-client/src/entity-workspace-accounts';
import {
  emptyEntityWorkspaceContext,
  projectEntityWorkspaceContext,
  type EntityWorkspaceContext,
  type EntityWorkspaceReadState,
} from '../../../packages/runtime-client/src/entity-workspace-context';
import {
  emptyEntityWorkspaceConsensusEvidence,
  projectEntityWorkspaceConsensusEvidence,
  type EntityWorkspaceConsensusEvidence,
} from '../../../packages/runtime-client/src/entity-workspace-consensus-evidence';
import {
  emptyEntityWorkspaceOwnership,
  projectEntityWorkspaceOwnership,
  type EntityWorkspaceOwnership,
} from '../../../packages/runtime-client/src/entity-workspace-ownership';
import {
  emptyEntityWorkspaceProfile,
  projectEntityWorkspaceProfile,
  type EntityWorkspaceProfile,
} from '../../../packages/runtime-client/src/entity-workspace-profile';
import {
  emptyEntityWorkspaceReserves,
  projectEntityWorkspaceReserves,
  type EntityWorkspaceReserves,
} from '../../../packages/runtime-client/src/entity-workspace-reserves';

export type OpsEntityWorkspaceProjection = Readonly<{
  accounts: EntityWorkspaceAccounts;
  consensus: EntityWorkspaceConsensusEvidence;
  context: EntityWorkspaceContext;
  ownership: EntityWorkspaceOwnership;
  profile: EntityWorkspaceProfile;
  reserves: EntityWorkspaceReserves;
}>;

export type OpsEntityWorkspaceSourceSnapshot = OpsEntityWorkspaceProjection & Readonly<{
  readState: EntityWorkspaceReadState;
}>;

export const emptyOpsEntityWorkspaceProjection = (
  runtimeId: unknown = null,
): OpsEntityWorkspaceProjection => ({
  accounts: emptyEntityWorkspaceAccounts(),
  consensus: emptyEntityWorkspaceConsensusEvidence(),
  context: emptyEntityWorkspaceContext(runtimeId),
  ownership: emptyEntityWorkspaceOwnership(),
  profile: emptyEntityWorkspaceProfile(),
  reserves: emptyEntityWorkspaceReserves(),
});

export const projectOpsEntityWorkspaceFrame = (
  runtimeId: string,
  frame: unknown,
): OpsEntityWorkspaceProjection => {
  const context = projectEntityWorkspaceContext({ runtimeId, frame });
  const accounts = projectEntityWorkspaceAccounts({ context, frame });
  const ownership = projectEntityWorkspaceOwnership({ context, frame });
  return {
    accounts,
    consensus: projectEntityWorkspaceConsensusEvidence({ accounts, context, ownership }),
    context,
    ownership,
    profile: projectEntityWorkspaceProfile({ context, frame }),
    reserves: projectEntityWorkspaceReserves({ context, frame }),
  };
};

export const projectOpsEntityWorkspaceObserverSnapshot = (
  runtimeId: string,
  currentProjection: OpsEntityWorkspaceProjection,
  snapshot: RuntimeQuerySnapshot<OpsEntityWorkspaceProjection>,
): OpsEntityWorkspaceSourceSnapshot => {
  if (snapshot.loading) {
    return {
      ...(snapshot.data ?? currentProjection),
      readState: { status: 'loading', message: 'Reading the committed Entity context…' },
    };
  }
  if (snapshot.error) {
    return {
      ...emptyOpsEntityWorkspaceProjection(runtimeId),
      readState: { status: 'error', message: snapshot.error },
    };
  }
  if (!snapshot.data) {
    return {
      ...emptyOpsEntityWorkspaceProjection(runtimeId),
      readState: { status: 'error', message: 'Runtime returned no Entity workspace context.' },
    };
  }
  return { ...snapshot.data, readState: { status: 'ready', message: '' } };
};
