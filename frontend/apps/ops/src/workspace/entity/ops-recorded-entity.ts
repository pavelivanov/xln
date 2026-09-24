import type { EnvSnapshot, RuntimeAdapterActivityPage, RuntimeAdapterReadQuery } from '@xln/core/api/public/runtime-module';
import { projectEntityReplicaCoreView } from '@xln/core/storage/read/projections';
import { buildRuntimeActivityEvents, dedupeRuntimeActivityEvents } from '@xln/core/api/public/activity-history';
import {
  decodeRuntimeActivityCursor,
  encodeRuntimeActivityCursor,
  type RuntimeActivityCursorState,
} from '@xln/core/storage/queries/runtime-activity-cursor';
import type { RuntimeActivityFilters } from '@xln/core/storage/views/activity-types';
import { buildEntityWorkspaceActivityQuery, type EntityWorkspaceActivityQueryOptions } from '../../../../../packages/runtime-client/src/entity/workspace/entity-workspace-activity';
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
  const filters: RuntimeActivityFilters = {
    ...(query.entityId ? { entityId: query.entityId } : {}),
    kind: query.kind ?? 'all',
    ...(query.types ? { types: typeof query.types === 'string' ? query.types.split(',') : query.types } : {}),
    ...(query.q ? { query: query.q } : {}),
    ...(query.fromTimestamp === undefined ? {} : { fromTimestamp: query.fromTimestamp }),
    ...(query.toTimestamp === undefined ? {} : { toTimestamp: query.toTimestamp }),
  };
  const decodedCursor = query.cursor
    ? decodeRuntimeActivityCursor(query.cursor, recording.runtimeId, filters)
    : null;
  if (decodedCursor && query.beforeHeight !== undefined) throw new Error('RUNTIME_ACTIVITY_CURSOR_WITH_HEIGHT');
  if (decodedCursor && decodedCursor.latestHeight > recording.height) {
    throw new Error('RUNTIME_ACTIVITY_CURSOR_AHEAD_OF_HISTORY');
  }
  const byHeight = new Map(recording.history.map(frame => [frame.state.height, frame]));
  const start = decodedCursor?.height ?? Math.min(recording.height, query.beforeHeight ?? recording.height);
  const pageLatestHeight = decodedCursor?.latestHeight ?? recording.height;
  let height = start;
  let offset = decodedCursor?.offset ?? 0;
  let scannedFrames = 0;
  let events: ReturnType<typeof buildRuntimeActivityEvents> = [];
  let lastScannedHeight = 0;
  let next: RuntimeActivityCursorState | null = null;
  // Same frame-based pagination and activity projection as persisted Runtime
  // history. This is a disposable recording view, never a second history store.
  for (; height >= 1 && scannedFrames < scanLimit && events.length < limit;) {
    lastScannedHeight = height;
    const frame = byHeight.get(height);
    scannedFrames += 1;
    const frameEvents = frame
      ? dedupeRuntimeActivityEvents(buildRuntimeActivityEvents({ height,
        timestamp: frame.state.timestamp, runtimeInput: frame.runtimeInput }, filters))
      : [];
    if (offset > frameEvents.length) throw new Error('RUNTIME_ACTIVITY_CURSOR_OFFSET_MISMATCH');
    const remaining = frameEvents.slice(offset);
    const take = Math.min(limit - events.length, remaining.length);
    events = [...events, ...remaining.slice(0, take)];
    if (take < remaining.length) {
      next = { latestHeight: pageLatestHeight, height, offset: offset + take };
      break;
    }
    height -= 1;
    offset = 0;
    if (events.length === limit && height >= 1) {
      next = { latestHeight: pageLatestHeight, height, offset: 0 };
    }
  }
  if (!next && height >= 1 && scannedFrames >= scanLimit) {
    next = { latestHeight: pageLatestHeight, height, offset: 0 };
  }
  const returned = events.map(event => ({ ...event, runtimeId: recording.runtimeId, id: `${recording.runtimeId}:${event.id}` }));
  return { ok: true, runtimeId: recording.runtimeId, latestHeight: pageLatestHeight, fromHeight: lastScannedHeight,
    toHeight: start, scannedFrames, returned: returned.length, limit, scanLimit, cursor: query.cursor ?? null,
    nextCursor: next ? encodeRuntimeActivityCursor(next, recording.runtimeId, filters) : null, filters, events: returned };
};

export const projectRecordedEntity = (recording: OpsWorkspaceRecording, entityId: string | undefined, accountsPage: number,
  options: EntityWorkspaceActivityQueryOptions, previous: OpsEntityWorkspaceProjection, append: boolean): OpsEntityWorkspaceProjection => {
  if (!recording.snapshot) throw new Error('This portable trail contains graph and activity projections, without a full Entity snapshot.');
  const projection = projectOpsEntityWorkspaceFrame(recording.runtimeId, projectRecordedEntityFrame(recording.snapshot, entityId, accountsPage));
  if (projection.context.status === 'empty') return projection;
  const query = buildEntityWorkspaceActivityQuery(projection.context, options);
  return projectOpsEntityWorkspaceActivityPage(projection, readRecordedActivityPage(recording, query), options, previous.activity, append);
};
