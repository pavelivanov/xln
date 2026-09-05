import type {
  RuntimeAdapter,
  RuntimeAdapterActivityPage,
  RuntimeAdapterHistoryFrameBatch,
  RuntimeAdapterReadQuery,
  RuntimeAdapterSolvencySummary,
  RuntimeAdapterTimelineIndexPage,
  RuntimeAdapterViewFrame,
  StorageHead,
} from '@xln/core/api/public/runtime-module';

import {
  RuntimeQueryClient,
  type RuntimeQueryResultSchema,
} from '../../../../packages/runtime-client/src/runtime-query-client';
import { RuntimeQueryObserver } from '../../../../packages/runtime-client/src/runtime-query-observer';
import { buildGossipDirectoryViewFromRuntimeEntities } from '../../../../packages/runtime-client/src/gossip-panel-view';

type WorkspaceQueryResults = RuntimeQueryResultSchema & Readonly<{
  activity: RuntimeAdapterActivityPage;
  historyFrameBatch: RuntimeAdapterHistoryFrameBatch;
  viewFrame: RuntimeAdapterViewFrame;
  solvencySummary: RuntimeAdapterSolvencySummary;
  head: StorageHead;
  timelineIndex: RuntimeAdapterTimelineIndexPage;
}>;

export type OpsWorkspaceQueryClient = RuntimeQueryClient<RuntimeAdapterReadQuery, WorkspaceQueryResults>;
export type OpsWorkspaceReader<T> = (client: OpsWorkspaceQueryClient, runtimeId: string) => Promise<T>;

export const createOpsWorkspaceQueryClient = (adapter: RuntimeAdapter): OpsWorkspaceQueryClient =>
  new RuntimeQueryClient({
    resolveAdapter: () => adapter,
    readRuntimeId: () => adapter.runtimeId,
    readCurrentHeight: () => adapter.currentHeight,
    createEmptyQuery: () => ({}),
  });

export const observeOpsWorkspaceQuery = <T>(
  adapter: RuntimeAdapter,
  client: OpsWorkspaceQueryClient,
  reader: OpsWorkspaceReader<T>,
): RuntimeQueryObserver<T> => new RuntimeQueryObserver(
  () => reader(client, adapter.runtimeId),
  {
    readHeight: () => adapter.currentHeight,
    subscribeHeight: (listener) => adapter.onChange(() => listener()),
    subscribeAdapter: (listener) => adapter.onStatus(() => listener()),
  },
);

export const readOpsGossipDirectory = async (client: OpsWorkspaceQueryClient, runtimeId: string) => {
  const frame = await client.readViewFrame({ accountsLimit: 1, booksLimit: 1 });
  return {
    runtimeId,
    height: frame.height,
    directory: buildGossipDirectoryViewFromRuntimeEntities({ entities: frame.entities, runtimeId }),
  };
};

export const readOpsSolvency = (client: OpsWorkspaceQueryClient): Promise<RuntimeAdapterSolvencySummary> =>
  client.readSolvencySummary();

export const readOpsRuntimeDiagnostics = async (client: OpsWorkspaceQueryClient, runtimeId: string) => {
  const [head, , timeline] = await Promise.all([
    client.readHead(),
    client.readCheckpoints(),
    client.readTimelineIndex({ limit: 40, scanLimit: 160 }),
  ]);
  return { runtimeId, head, timeline };
};
