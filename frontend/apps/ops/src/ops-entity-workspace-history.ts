import type {
  RuntimeAdapterActivityPage,
  RuntimeAdapterHistoryFrameBatch,
  RuntimeAdapterReadQuery,
} from '@xln/core/api/public/runtime-module';
import {
  buildEntityWorkspaceActivityQuery,
  type EntityWorkspaceActivityKind,
} from '../../../packages/runtime-client/src/entity-workspace-activity';
import {
  assertTimeMachineHistorySelection,
  createTimeMachineHistoryBatchQuery,
  requireTimeMachineHistoryFrame,
  runtimeHistoryFrameFromViewFrame,
} from '../../../packages/runtime-client/src/time-machine-transport';
import { requireEntityWorkspaceHistoryHeight } from '../../../packages/runtime-client/src/entity-workspace-time-machine';
import {
  projectOpsEntityWorkspaceActivityPage,
  projectOpsEntityWorkspaceFrame,
  type OpsEntityWorkspaceProjection,
} from './ops-entity-workspace-projection';

export type OpsEntityWorkspaceHistoryReader = Readonly<{
  readActivity(query: RuntimeAdapterReadQuery): Promise<RuntimeAdapterActivityPage>;
  readHistoryFrameBatch(query: RuntimeAdapterReadQuery): Promise<RuntimeAdapterHistoryFrameBatch>;
}>;

export async function readOpsEntityWorkspaceHistory(input: Readonly<{
  activityBeforeHeight?: number;
  activityKind?: EntityWorkspaceActivityKind;
  accountsPage: number;
  client: OpsEntityWorkspaceHistoryReader;
  entityId: string;
  latestHeight: number;
  requestedHeight: number;
  runtimeId: string;
}>): Promise<OpsEntityWorkspaceProjection> {
  const requestedHeight = requireEntityWorkspaceHistoryHeight(
    input.requestedHeight,
    input.latestHeight,
  );
  const selection = {
    accountsPage: input.accountsPage,
    booksPage: 0,
    entityId: input.entityId,
  };
  const batch = await input.client.readHistoryFrameBatch(
    createTimeMachineHistoryBatchQuery(selection, requestedHeight, 8),
  );
  const frame = requireTimeMachineHistoryFrame(batch, requestedHeight);
  assertTimeMachineHistorySelection(runtimeHistoryFrameFromViewFrame({
    frame,
    mode: 'remote',
    runtimeId: input.runtimeId,
  }), selection);
  const projection = projectOpsEntityWorkspaceFrame(input.runtimeId, frame);
  const activityQuery = buildEntityWorkspaceActivityQuery(
    projection.context,
    input.activityBeforeHeight,
    input.activityKind,
  );
  const activity = await input.client.readActivity(activityQuery);
  return projectOpsEntityWorkspaceActivityPage(
    projection,
    activity,
    activityQuery.beforeHeight,
    activityQuery.kind,
  );
}
