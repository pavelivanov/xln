import type { RuntimeAdapterEntitySummary } from '@xln/core/api/public/runtime-module';
import { DISPLAY } from '@xln/core/config/qa';
import type { RuntimeHandle } from '../../../runtime-client/src/runtime/runtime-handle';
import { isCriticalEvent, type RuntimeProjectionEvent } from './runtime-events';

export type HealthRuntimeContext = Pick<RuntimeHandle, 'id' | 'status' | 'height' | 'mode' | 'authLevel'>;

export type ProjectionEntity = {
  entityId: string;
  runtimeId?: string;
  name: string;
  isHub: boolean;
  online: boolean;
  lastUpdated: number;
  capabilities: string[];
  metadata: Record<string, unknown>;
};

export type FlowEdge = {
  key: string;
  from: string;
  to: string;
  count: number;
  critical: number;
  lastTs: number;
};

export function endpointLabel(value?: string): string {
  if (!value) return 'local';
  const maxInline = DISPLAY.ENDPOINT_PREFIX_CHARS + DISPLAY.ENDPOINT_SUFFIX_CHARS + 2;
  if (value.length <= maxInline) return value;
  return `${value.slice(0, DISPLAY.ENDPOINT_PREFIX_CHARS)}...${value.slice(-DISPLAY.ENDPOINT_SUFFIX_CHARS)}`;
}

export function buildFlowEdges(input: readonly RuntimeProjectionEvent[]): FlowEdge[] {
  const edges = new Map<string, FlowEdge>();
  for (const event of input) {
    const from = endpointLabel(event.from || event.runtimeId || 'runtime');
    const to = endpointLabel(event.to || event.msgType || event.event || 'sink');
    const key = `${from}->${to}`;
    const existing = edges.get(key) ?? { key, from, to, count: 0, critical: 0, lastTs: 0 };
    existing.count += 1;
    existing.lastTs = Math.max(existing.lastTs, event.ts || 0);
    if (isCriticalEvent(event)) existing.critical += 1;
    edges.set(key, existing);
  }
  return Array.from(edges.values()).sort((a, b) => b.count - a.count || b.lastTs - a.lastTs);
}

export function projectionEntityFromSummary(
  summary: RuntimeAdapterEntitySummary,
  handle: HealthRuntimeContext,
): ProjectionEntity {
  const entityId = String(summary.entityId || '')
    .trim()
    .toLowerCase();
  const name = String(summary.label || entityId || 'Unknown').trim();
  return {
    entityId,
    runtimeId: String(handle.id || '').trim(),
    name,
    isHub: summary.isHub === true,
    online: handle.status === 'connected',
    lastUpdated: Math.max(0, Math.floor(Number(summary.height || handle.height || 0))),
    capabilities: summary.isHub === true ? ['hub', 'routing'] : ['entity'],
    metadata: {
      height: summary.height,
      jurisdiction: summary.jurisdiction ?? null,
      runtimeMode: handle.mode,
      authLevel: handle.authLevel,
    },
  };
}
