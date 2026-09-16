import type { RuntimeActivityEvent } from '@xln/core/api/public/runtime-module';
import type { RelayTimelineDelivery } from './relay-event-severity';

export type RuntimeProjectionEvent = {
  id: string;
  ts: number;
  event: string;
  runtimeId?: string;
  from?: string;
  to?: string;
  msgType?: string;
  status?: string;
  reason?: string;
  encrypted?: boolean;
  size?: number;
  queueSize?: number;
  delivery?: RelayTimelineDelivery;
  details?: unknown;
};

const BUG_PATTERNS = [
  'jsonrpcprovider failed to detect network',
  'testnet j-machine not found',
  'server_error',
  'requesturl',
  '/rpc',
  'ws_client_error',
  'envelope_decrypt_fail',
  'frame_consensus_failed',
  'route-defer',
  'deferred',
];

function eventBlob(e: RuntimeProjectionEvent): string {
  return JSON.stringify(e).toLowerCase();
}

export function isCriticalEvent(e: RuntimeProjectionEvent): boolean {
  if (e.delivery?.fatal === true) return true;
  if (e.event === 'error') return true;
  const blob = eventBlob(e);
  return BUG_PATTERNS.some(p => blob.includes(p));
}

export function projectionEventFromActivity(event: RuntimeActivityEvent): RuntimeProjectionEvent {
  return {
    id: String(event.id || `${event.height}:${event.rawType}`),
    ts: Math.max(0, Number(event.timestamp || 0)),
    event: String(event.rawType || event.type || 'runtime_event'),
    ...(event.runtimeId ? { runtimeId: event.runtimeId } : {}),
    ...(event.entityId ? { from: event.entityId } : {}),
    ...(event.counterpartyId ? { to: event.counterpartyId } : {}),
    msgType: event.type,
    status: event.status,
    ...(event.subtitle ? { reason: event.subtitle } : {}),
    encrypted: false,
    details: {
      height: event.height,
      kind: event.kind,
      source: event.source,
      direction: event.direction,
      title: event.title,
      amount: event.amount,
      tokenId: event.tokenId,
      hash: event.hash,
    },
  };
}

export type RuntimeEventFilters = Readonly<{
  search: string;
  filterRuntime: string;
  filterFrom: string;
  filterTo: string;
  filterEvent: string;
  filterMsgType: string;
  filterStatus: string;
  onlyCritical: boolean;
}>;

export const emptyRuntimeEventFilters = (): RuntimeEventFilters => ({
  search: '',
  filterRuntime: '',
  filterFrom: '',
  filterTo: '',
  filterEvent: '',
  filterMsgType: '',
  filterStatus: '',
  onlyCritical: false,
});

export function filterRuntimeProjectionEvents(
  events: readonly RuntimeProjectionEvent[],
  {
    search,
    filterRuntime,
    filterFrom,
    filterTo,
    filterEvent,
    filterMsgType,
    filterStatus,
    onlyCritical,
  }: RuntimeEventFilters,
): RuntimeProjectionEvent[] {
  const q = search.trim().toLowerCase();
  const r = filterRuntime.trim().toLowerCase();
  const f = filterFrom.trim().toLowerCase();
  const t = filterTo.trim().toLowerCase();

  return events
    .filter(e => {
      if (filterEvent && e.event !== filterEvent) return false;
      if (filterMsgType && e.msgType !== filterMsgType) return false;
      if (filterStatus && e.status !== filterStatus) return false;
      if (r) {
        const hit =
          (e.runtimeId || '').toLowerCase().includes(r) ||
          (e.from || '').toLowerCase().includes(r) ||
          (e.to || '').toLowerCase().includes(r);
        if (!hit) return false;
      }
      if (f && !(e.from || '').toLowerCase().includes(f)) return false;
      if (t && !(e.to || '').toLowerCase().includes(t)) return false;
      if (onlyCritical && !isCriticalEvent(e)) return false;
      if (q && !eventBlob(e).includes(q)) return false;
      return true;
    })
    .reverse();
}
