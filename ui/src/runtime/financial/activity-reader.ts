import type {
  RuntimeAdapter,
  RuntimeAdapterActivityPage,
  RuntimeAdapterReadQuery,
} from '@xln/core/api/runtime-adapter/types';
import { dedupeRuntimeActivityEvents } from '@xln/core/api/public/activity-history';
import {
  decodeRuntimeActivityCursor,
  encodeRuntimeActivityCursor,
} from '@xln/core/storage/queries/runtime-activity-cursor';

const reanchorCursor = (
  cursor: string | null,
  previous: RuntimeAdapterActivityPage,
  page: RuntimeAdapterActivityPage,
): string | null => {
  if (!cursor) return null;
  const state = decodeRuntimeActivityCursor(cursor, previous.runtimeId, previous.filters);
  return encodeRuntimeActivityCursor(
    { ...state, latestHeight: page.latestHeight },
    page.runtimeId,
    page.filters,
  );
};

/** One volatile UI page per query. Committed history stays authoritative in RAdapter. */
export function createActivityPageReader(query: RuntimeAdapterReadQuery = {}) {
  let cached: RuntimeAdapterActivityPage | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  const scanLimit = Math.max(1, Math.min(1000, Math.floor(Number(query.scanLimit ?? 100))));
  const read = async (adapter: Pick<RuntimeAdapter, 'read'>, height: number): Promise<RuntimeAdapterActivityPage> => {
    const previous = cached;
    if (previous && (query.beforeHeight !== undefined || query.cursor !== undefined || height === previous.toHeight)) {
      return previous;
    }
    const delta = previous ? height - previous.toHeight : 0;
    const incremental = previous !== null && delta > 0 && delta < scanLimit;
    const page = await adapter.read<RuntimeAdapterActivityPage>('activity', {
      ...query,
      beforeHeight: query.beforeHeight ?? height,
      scanLimit: incremental ? delta : scanLimit,
    });
    if (!incremental || !previous) return (cached = page);
    let fromHeight = Math.max(previous.fromHeight, page.toHeight - scanLimit + 1);
    const merged = dedupeRuntimeActivityEvents(
      [...page.events, ...previous.events].filter(event => event.height >= fromHeight),
    );
    const events = merged.slice(0, page.limit);
    if (events.length === page.limit) fromHeight = Math.max(fromHeight, events[events.length - 1]!.height);
    const firstExcluded = merged[events.length];
    const retainedWindowIsBounded = fromHeight > 1 && (
      events.length === page.limit || page.toHeight - fromHeight + 1 >= scanLimit
    );
    const nextCursor = firstExcluded
      ? encodeRuntimeActivityCursor(
          {
            latestHeight: page.latestHeight,
            height: firstExcluded.height,
            offset: events.filter(event => event.height === firstExcluded.height).length,
          },
          page.runtimeId,
          page.filters,
        )
      : (fromHeight === previous.fromHeight
          ? reanchorCursor(previous.nextCursor, previous, page)
          : null)
        ?? (retainedWindowIsBounded
          ? encodeRuntimeActivityCursor(
              { latestHeight: page.latestHeight, height: fromHeight - 1, offset: 0 },
              page.runtimeId,
              page.filters,
            )
          : null);
    return (cached = {
      ...page,
      fromHeight,
      scanLimit,
      scannedFrames: page.toHeight - fromHeight + 1,
      nextCursor,
      events,
      returned: events.length,
    });
  };
  return (adapter: Pick<RuntimeAdapter, 'read'>, height: number): Promise<RuntimeAdapterActivityPage> => {
    // A burst of onChange frames queues deltas, never overlapping full history scans.
    const next = tail.then(() => read(adapter, height));
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}
