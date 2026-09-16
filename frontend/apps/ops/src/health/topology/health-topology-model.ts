import { isUnknownRecord } from '../../../../../packages/runtime-client/src/boundary';
import { safeStringify } from '../../../../../../core/protocol/serialization';

export type HealthState = 'ready' | 'blocked' | 'active' | 'pending' | 'disabled' | 'unknown';
export type HealthDetail = Readonly<{ label: string; value: string }>;
export type HealthRow = Readonly<{
  key: string;
  label: string;
  state: HealthState;
  details: readonly HealthDetail[];
  entityId: string | null;
  runtimeId: string | null;
}>;
export type HealthSection = Readonly<{ label: string; rows: readonly HealthRow[] | null }>;
export type HealthTopology = Readonly<{
  gates: readonly HealthRow[];
  timeline: readonly HealthRow[] | null;
  timelineDetails: readonly HealthDetail[];
  sections: readonly HealthSection[];
}>;

type RecordValue = Record<string, unknown>;
const record = (value: unknown, key: string): RecordValue | null => {
  if (value === undefined || value === null) return null;
  if (!isUnknownRecord(value)) throw new Error(`OPS_HEALTH_FIELD_INVALID:${key}`);
  return value;
};
const string = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const state = (value: unknown): HealthState => {
  if (value === true || value === 'done' || value === 'healthy' || value === 'ready') return 'ready';
  if (value === false || value === 'blocked' || value === 'down' || value === 'degraded') return 'blocked';
  if (value === 'active' || value === 'pending' || value === 'disabled') return value;
  return 'unknown';
};
const details = (row: RecordValue): readonly HealthDetail[] =>
  Object.entries(row).map(([label, value]) => ({
    label: label.replace(/([a-z])([A-Z])/gu, '$1 $2'),
    value:
      value === null || value === undefined
        ? 'unreported'
        : typeof value === 'object'
          ? safeStringify(value, 2)
          : String(value),
  }));
const row = (value: unknown, index: number, label: string): HealthRow => {
  const item = record(value, label);
  if (!item) throw new Error(`OPS_HEALTH_ROW_INVALID:${label}:${index}`);
  return {
    key: `${label}:${index}`,
    label:
      string(item['label']) ??
      string(item['name']) ??
      string(item['pairId']) ??
      string(item['sourceJurisdiction']) ??
      string(item['role']) ??
      `${label} ${index + 1}`,
    state: state(
      item['status'] ?? item['online'] ?? item['depthReady'] ?? item['targetMet'] ?? item['ready'] ?? item['ok'],
    ),
    details: details(item),
    entityId: string(item['entityId']) ?? string(item['hubEntityId']),
    runtimeId: string(item['runtimeId']),
  };
};
const rows = (value: unknown, label: string): readonly HealthRow[] | null => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new Error(`OPS_HEALTH_ROWS_INVALID:${label}`);
  return value.map((value, index) => row(value, index, label));
};
const gate = (label: string, value: unknown, evidence: RecordValue | null): HealthRow => ({
  key: label,
  label,
  state: state(value),
  details: evidence ? details(evidence) : [],
  entityId: null,
  runtimeId: null,
});
const optionalGate = (value: RecordValue | null): unknown =>
  value?.['enabled'] === false || value?.['applicable'] === false ? 'disabled' : value?.['ok'];

export const decodeHealthTopology = (payload: RecordValue): HealthTopology => {
  const system = record(payload['system'], 'system');
  const boot = record(payload['boot'], 'boot');
  const reset = record(payload['reset'], 'reset');
  const mesh = record(payload['hubMesh'], 'hubMesh');
  const relay = record(payload['relay'], 'relay');
  const custody = record(payload['custody'], 'custody');
  const reserves = record(payload['bootstrapReserves'], 'bootstrapReserves');
  const mm = record(payload['marketMaker'], 'marketMaker');
  const cross = record(mm?.['cross'], 'marketMaker.cross');
  const storage = record(payload['storage'], 'storage');
  const disk = record(payload['disk'], 'disk');
  const process = record(payload['process'], 'process');
  const timeline = record(payload['bootstrapTimeline'], 'bootstrapTimeline');
  return {
    gates: [
      gate(
        'Reset barrier',
        reset?.['inProgress'] === true
          ? 'active'
          : reset?.['lastError'] || reset?.['hasError'] === true
            ? false
            : reset?.['inProgress'] === false
              ? true
              : undefined,
        reset,
      ),
      gate('Runtime', system?.['runtime'], boot),
      gate('P2P', system?.['p2p'], null),
      gate('Direct mesh', optionalGate(mesh), mesh),
      gate('Relay sockets', system?.['relay'], relay),
      gate('Custody', optionalGate(custody), custody),
      gate(
        'Bootstrap reserves',
        reserves?.['applicable'] === false
          ? 'disabled'
          : reserves?.['ok'] === false || reserves?.['targetMet'] === false
            ? false
            : reserves?.['ok'] === true && reserves?.['targetMet'] === true
              ? true
              : undefined,
        reserves,
      ),
      gate('MM same-chain books', optionalGate(mm), mm),
      gate('MM cross routes', mm?.['enabled'] === false ? 'disabled' : optionalGate(cross), cross),
      gate('Terminal ready', payload['systemOk'], {
        degraded: payload['degraded'] ?? [],
        phase: mm?.['startupPhase'] ?? boot?.['phase'] ?? null,
      }),
      gate('Storage', storage?.['ok'] ?? disk?.['ok'], disk),
    ],
    timeline: rows(timeline?.['stages'], 'Bootstrap stage'),
    timelineDetails: timeline
      ? details(Object.fromEntries(Object.entries(timeline).filter(([key]) => key !== 'stages')))
      : [],
    sections: [
      { label: 'Hub Sockets', rows: rows(payload['hubs'], 'Hub') },
      { label: 'Active Relay Clients', rows: rows(relay?.['clientsDetailed'], 'Relay client') },
      { label: 'Process lanes', rows: rows(process?.['children'], 'Process') },
      { label: 'MM hub books', rows: rows(mm?.['hubs'], 'Market-maker Hub') },
      { label: 'MM cross routes', rows: rows(cross?.['routes'], 'Cross route') },
      { label: 'Reserve coverage', rows: rows(reserves?.['entities'], 'Reserve Entity') },
    ],
  };
};
