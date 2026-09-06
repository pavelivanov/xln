import type { EnvSnapshot, RuntimeAdapterActivityPage, RuntimeAdapterReadQuery } from '@xln/core/api/public/runtime-module';
import { projectEntityReplicaCoreView } from '@xln/core/storage/read/projections';
import { buildRuntimeActivityEvents, dedupeRuntimeActivityEvents } from '@xln/core/api/public/activity-history';
import { buildEntityWorkspaceActivityQuery, type EntityWorkspaceActivityQueryOptions } from '../../../../../packages/runtime-client/src/entity/entity-workspace-activity';
import { projectOpsEntityWorkspaceActivityPage, projectOpsEntityWorkspaceFrame, type OpsEntityWorkspaceProjection } from '../../entity-workspace/ops-entity-workspace-projection';

export type OpsWorkspaceRecording = Readonly<{
  kind: 'adapter' | 'scenario' | 'trail';
  runtimeId: string;
  height: number;
  snapshot: EnvSnapshot | null;
  history: readonly EnvSnapshot[];
  selectHeight: (height: number) => Promise<boolean>;
  returnLive: () => void;
}>;

const pageOf = <T>(items: readonly T[], pageIndex: number, limit: number) => ({
  items: items.slice(pageIndex * limit, (pageIndex + 1) * limit),
  totalItems: items.length, limit, pageIndex, pageCount: Math.ceil(items.length / limit),
});

export const readRecordedEntityAudit = (recording: OpsWorkspaceRecording, entityId: string) => {
  const replica = recording.snapshot ? [...recording.snapshot.state.eReplicas.values()].find(entry => entry.entityId === entityId) : null;
  if (!replica) return null;
  return {
    entityHeight: replica.state.height,
    accounts: { visible: Math.min(16, replica.state.accounts.size), total: replica.state.accounts.size },
    books: { visible: Math.min(16, replica.state.orderbookExt?.books.size ?? 0), total: replica.state.orderbookExt?.books.size ?? 0 },
    activity: readRecordedActivityPage(recording, { entityId, limit: 20, scanLimit: 240, beforeHeight: recording.height }),
  };
};

export const projectRecordedEntityFrame = (snapshot: EnvSnapshot, entityId: string | undefined, accountsPage: number) => {
  const replicas = [...snapshot.state.eReplicas.values()];
  const replica = entityId ? replicas.find(entry => entry.entityId.toLowerCase() === entityId.toLowerCase()) : replicas[0];
  if (!replica) return { height: snapshot.state.height, activeEntityId: null, activeEntity: null };
  const state = replica.state;
  const accounts = [...state.accounts].sort(([a], [b]) => a.localeCompare(b)).map(([, account]) => ({
    state: { leftEntity: account.state.leftEntity, rightEntity: account.state.rightEntity, domain: account.state.domain,
      jNonce: account.state.jNonce, lastFinalizedJHeight: account.state.lastFinalizedJHeight, disputeConfig: account.state.disputeConfig },
    currentFrame: { ...account.currentFrame, accountTxs: account.currentFrame.accountTxs.slice(-20) },
  }));
  return {
    height: snapshot.state.height, activeEntityId: replica.entityId,
    activeEntity: { summary: { entityId: replica.entityId, label: state.profile.name },
      core: projectEntityReplicaCoreView(state, replica), accounts: pageOf(accounts, accountsPage, 8) },
  };
};

export const readRecordedActivityPage = (recording: OpsWorkspaceRecording, query: RuntimeAdapterReadQuery): RuntimeAdapterActivityPage => {
  const limit = query.limit ?? 8;
  const scanLimit = query.scanLimit ?? 160;
  const filters = { ...query, types: typeof query.types === 'string' ? query.types.split(',') : query.types, query: query.q };
  const byHeight = new Map(recording.history.map(frame => [frame.state.height, frame]));
  const start = Math.min(recording.height, query.beforeHeight ?? recording.height);
  let height = start;
  let scannedFrames = 0;
  let events: ReturnType<typeof buildRuntimeActivityEvents> = [];
  // Same frame-based pagination and activity projection as persisted Runtime
  // history. This is a disposable recording view, never a second history store.
  for (; height >= 1 && scannedFrames < scanLimit && events.length < limit; height -= 1) {
    const frame = byHeight.get(height);
    scannedFrames += 1;
    if (frame) events = dedupeRuntimeActivityEvents([...events, ...buildRuntimeActivityEvents({ height,
      timestamp: frame.state.timestamp, runtimeInput: frame.runtimeInput }, filters)]);
  }
  const returned = events.slice(0, limit).map(event => ({ ...event, runtimeId: recording.runtimeId, id: `${recording.runtimeId}:${event.id}` }));
  return { ok: true, runtimeId: recording.runtimeId, latestHeight: recording.height, fromHeight: Math.max(1, height + 1),
    toHeight: start, scannedFrames, returned: returned.length, limit, scanLimit, nextBeforeHeight: height >= 1 ? height : null, filters, events: returned };
};

export const projectRecordedEntity = (recording: OpsWorkspaceRecording, entityId: string | undefined, accountsPage: number,
  options: EntityWorkspaceActivityQueryOptions, previous: OpsEntityWorkspaceProjection, append: boolean): OpsEntityWorkspaceProjection => {
  if (!recording.snapshot) throw new Error('This portable trail contains graph and activity projections, without a full Entity snapshot.');
  const projection = projectOpsEntityWorkspaceFrame(recording.runtimeId, projectRecordedEntityFrame(recording.snapshot, entityId, accountsPage));
  if (projection.context.status === 'empty') return projection;
  const query = buildEntityWorkspaceActivityQuery(projection.context, options);
  return projectOpsEntityWorkspaceActivityPage(projection, readRecordedActivityPage(recording, query), options, previous.activity, append);
};
