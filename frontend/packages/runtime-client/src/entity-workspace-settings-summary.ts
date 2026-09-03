import type { EntityWorkspaceContext } from './entity-workspace-context';
import type { EntityWorkspaceProfile } from './entity-workspace-profile';
import type { EntityWorkspaceReserves } from './entity-workspace-reserves';
import type { EntityWorkspaceTimeMachineState } from './entity-workspace-time-machine';

type EmptyEntityWorkspaceSettingsSummary = Readonly<{
  status: 'empty';
}>;

type SelectedEntityWorkspaceSettingsSummary = Readonly<{
  status: 'selected';
  runtimeId: string | null;
  runtimeHeight: number;
  entityId: string;
  signerId: string | null;
  jurisdictionName: string | null;
  mode: 'live' | 'history' | 'reading';
  isHub: boolean;
  accountCount: number;
  visibleReserveCount: number;
}>;

export type EntityWorkspaceSettingsSummary =
  | EmptyEntityWorkspaceSettingsSummary
  | SelectedEntityWorkspaceSettingsSummary;

export type EntityWorkspaceSettingsSummaryInput = Readonly<{
  context: EntityWorkspaceContext;
  profile: EntityWorkspaceProfile;
  reserves: EntityWorkspaceReserves;
  timeMachine: EntityWorkspaceTimeMachineState;
}>;

export const emptyEntityWorkspaceSettingsSummary = (
): EmptyEntityWorkspaceSettingsSummary => ({ status: 'empty' });

const requireSelectedProjections = (
  input: EntityWorkspaceSettingsSummaryInput,
): Readonly<{
  profile: Extract<EntityWorkspaceProfile, Readonly<{ status: 'selected' }>>;
  reserves: Extract<EntityWorkspaceReserves, Readonly<{ status: 'selected' }>>;
}> => {
  if (input.profile.status !== 'selected' || input.reserves.status !== 'selected') {
    throw new Error('ENTITY_WORKSPACE_SETTINGS_SUMMARY_PROJECTION_MISSING');
  }
  return { profile: input.profile, reserves: input.reserves };
};

export function projectEntityWorkspaceSettingsSummary(
  input: EntityWorkspaceSettingsSummaryInput,
): EntityWorkspaceSettingsSummary {
  if (input.context.status === 'empty') {
    if (input.profile.status !== 'empty' || input.reserves.status !== 'empty') {
      throw new Error('ENTITY_WORKSPACE_SETTINGS_SUMMARY_EMPTY_CONTEXT_MISMATCH');
    }
    return emptyEntityWorkspaceSettingsSummary();
  }
  const projections = requireSelectedProjections(input);
  if (
    projections.profile.entityId !== input.context.entityId ||
    projections.reserves.entityId !== input.context.entityId
  ) throw new Error('ENTITY_WORKSPACE_SETTINGS_SUMMARY_ENTITY_ID_MISMATCH');
  return {
    status: 'selected',
    runtimeId: input.context.runtimeId,
    runtimeHeight: input.context.height,
    entityId: input.context.entityId,
    signerId: input.context.signerId,
    jurisdictionName: input.context.jurisdictionName,
    mode: input.timeMachine.loading ? 'reading' : input.timeMachine.mode,
    isHub: projections.profile.isHub,
    accountCount: input.context.accountCount,
    visibleReserveCount: projections.reserves.items.length,
  };
}
