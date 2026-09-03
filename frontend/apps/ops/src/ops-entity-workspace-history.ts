import type {
  RuntimeAdapterHistoryFrameBatch,
  RuntimeAdapterReadQuery,
} from '@xln/core/api/public/runtime-module';
import {
  assertTimeMachineHistorySelection,
  createTimeMachineHistoryBatchQuery,
  requireTimeMachineHistoryFrame,
  runtimeHistoryFrameFromViewFrame,
} from '../../../packages/runtime-client/src/time-machine-transport';
import { requireEntityWorkspaceHistoryHeight } from '../../../packages/runtime-client/src/entity-workspace-time-machine';
import {
  projectOpsEntityWorkspaceFrame,
  type OpsEntityWorkspaceProjection,
} from './ops-entity-workspace-projection';

export type OpsEntityWorkspaceHistoryReader = Readonly<{
  readHistoryFrameBatch(query: RuntimeAdapterReadQuery): Promise<RuntimeAdapterHistoryFrameBatch>;
}>;

export async function readOpsEntityWorkspaceHistory(input: Readonly<{
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
  return projectOpsEntityWorkspaceFrame(input.runtimeId, frame);
}
