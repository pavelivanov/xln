import type { RuntimeQuerySnapshot } from '../../../packages/runtime-client/src/runtime-query-observer';
import {
  emptyEntityWorkspaceActivity,
  projectEntityWorkspaceActivity,
  type EntityWorkspaceActivity,
  type EntityWorkspaceActivityFilterType,
  type EntityWorkspaceActivityKind,
} from '../../../packages/runtime-client/src/entity-workspace-activity';
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
  emptyEntityWorkspaceHubPolicy,
  projectEntityWorkspaceHubPolicy,
  type EntityWorkspaceHubPolicy,
} from '../../../packages/runtime-client/src/entity-workspace-hub-policy';
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
import {
  createEntityWorkspaceLiveState,
  type EntityWorkspaceTimeMachineState,
} from '../../../packages/runtime-client/src/entity-workspace-time-machine';

export type OpsEntityWorkspaceProjection = Readonly<{
  activity: EntityWorkspaceActivity;
  accounts: EntityWorkspaceAccounts;
  consensus: EntityWorkspaceConsensusEvidence;
  context: EntityWorkspaceContext;
  hubPolicy: EntityWorkspaceHubPolicy;
  ownership: EntityWorkspaceOwnership;
  profile: EntityWorkspaceProfile;
  reserves: EntityWorkspaceReserves;
}>;

export type OpsEntityWorkspaceSourceSnapshot = OpsEntityWorkspaceProjection & Readonly<{
  readState: EntityWorkspaceReadState;
  timeMachine: EntityWorkspaceTimeMachineState;
}>;

export const emptyOpsEntityWorkspaceProjection = (
  runtimeId: unknown = null,
): OpsEntityWorkspaceProjection => ({
  activity: emptyEntityWorkspaceActivity(),
  accounts: emptyEntityWorkspaceAccounts(),
  consensus: emptyEntityWorkspaceConsensusEvidence(),
  context: emptyEntityWorkspaceContext(runtimeId),
  hubPolicy: emptyEntityWorkspaceHubPolicy(),
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
    activity: emptyEntityWorkspaceActivity(),
    accounts,
    consensus: projectEntityWorkspaceConsensusEvidence({ accounts, context, ownership }),
    context,
    hubPolicy: projectEntityWorkspaceHubPolicy({ context, frame }),
    ownership,
    profile: projectEntityWorkspaceProfile({ context, frame }),
    reserves: projectEntityWorkspaceReserves({ context, frame }),
  };
};

export const projectOpsEntityWorkspaceActivityPage = (
  projection: OpsEntityWorkspaceProjection,
  page: unknown,
  beforeHeight?: number,
  kind?: EntityWorkspaceActivityKind,
  types?: readonly EntityWorkspaceActivityFilterType[],
): OpsEntityWorkspaceProjection => ({
  ...projection,
  activity: projectEntityWorkspaceActivity({
    context: projection.context,
    page,
    ...(beforeHeight === undefined ? {} : { beforeHeight }),
    ...(kind === undefined ? {} : { kind }),
    ...(types === undefined ? {} : { types }),
  }),
});

export const projectOpsEntityWorkspaceObserverSnapshot = (
  runtimeId: string,
  currentProjection: OpsEntityWorkspaceProjection,
  snapshot: RuntimeQuerySnapshot<OpsEntityWorkspaceProjection>,
  timeMachine: EntityWorkspaceTimeMachineState = createEntityWorkspaceLiveState(snapshot.height),
): OpsEntityWorkspaceSourceSnapshot => {
  if (snapshot.loading) {
    return {
      ...(snapshot.data ?? currentProjection),
      readState: { status: 'loading', message: 'Reading the committed Entity context…' },
      timeMachine,
    };
  }
  if (snapshot.error) {
    return {
      ...emptyOpsEntityWorkspaceProjection(runtimeId),
      readState: { status: 'error', message: snapshot.error },
      timeMachine,
    };
  }
  if (!snapshot.data) {
    return {
      ...emptyOpsEntityWorkspaceProjection(runtimeId),
      readState: { status: 'error', message: 'Runtime returned no Entity workspace context.' },
      timeMachine,
    };
  }
  return { ...snapshot.data, readState: { status: 'ready', message: '' }, timeMachine };
};
