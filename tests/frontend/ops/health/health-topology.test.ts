import { expect, test } from 'bun:test';
import { decodeHealthTopology } from '../../../../frontend/apps/ops/src/health/topology/health-topology-model';

test('canonical relay inventory stays truthful when per-client detail is not reported', () => {
  const topology = decodeHealthTopology({
    relay: {
      clientCount: 3,
      managedRuntimeIds: ['runtime-1'],
      externalClientIds: ['runtime-2', 'runtime-3'],
      marketSubscriptions: { total: 2, byIp: { '127.0.0.1': 2 } },
    },
  });
  expect(topology.gates.every(gate => gate.state === 'unknown')).toBe(true);
  expect(topology.timeline).toBeNull();
  expect(topology.sections.find(section => section.label === 'Active Relay Clients')?.rows).toBeNull();
  expect(decodeHealthTopology({ relay: { clientsDetailed: [] } }).sections[1]?.rows).toEqual([]);
});

test('disabled capabilities, failed reserve targets and reset errors have distinct states', () => {
  const topology = decodeHealthTopology({
    reset: { inProgress: false, lastError: 'bootstrap failed' },
    custody: { enabled: false },
    marketMaker: { enabled: false },
    bootstrapReserves: { applicable: true, ok: true, targetMet: false },
  });
  const states = Object.fromEntries(topology.gates.map(gate => [gate.label, gate.state]));
  expect(states).toMatchObject({
    'Reset barrier': 'blocked',
    Custody: 'disabled',
    'MM same-chain books': 'disabled',
    'MM cross routes': 'disabled',
    'Bootstrap reserves': 'blocked',
  });
});

test('bootstrap timeline preserves active stage, failure, durations and budgets', () => {
  const topology = decodeHealthTopology({
    bootstrapTimeline: {
      ready: false,
      totalElapsedMs: 1234,
      stages: [
        { name: 'Hub mesh', status: 'active', elapsedMs: 1234, budgetMs: 2000, lastError: 'waiting for H2' },
        { name: 'Reserve targets', status: 'pending' },
      ],
    },
  });
  expect(topology.timeline?.map(row => [row.label, row.state])).toEqual([
    ['Hub mesh', 'active'],
    ['Reserve targets', 'pending'],
  ]);
  expect(topology.timeline?.[0]?.details).toContainEqual({ label: 'budget Ms', value: '2000' });
  expect(topology.timeline?.[0]?.details).toContainEqual({ label: 'last Error', value: 'waiting for H2' });
  expect(topology.timelineDetails).toContainEqual({ label: 'total Elapsed Ms', value: '1234' });
});

test('Hub and relay evidence retain authority identities and topics without deriving online status', () => {
  const topology = decodeHealthTopology({
    hubs: [{ name: 'H1', online: true, entityId: 'entity-1', runtimeId: 'runtime-1' }],
    relay: { clientsDetailed: [{ runtimeId: 'runtime-2', ageMs: 55, lastSeen: 123, topics: ['payments'] }] },
  });
  expect(topology.sections[0]?.rows?.[0]).toMatchObject({
    label: 'H1',
    state: 'ready',
    entityId: 'entity-1',
    runtimeId: 'runtime-1',
  });
  expect(topology.sections[1]?.rows?.[0]).toMatchObject({ state: 'unknown', runtimeId: 'runtime-2' });
  expect(topology.sections[1]?.rows?.[0]?.details).toContainEqual({ label: 'age Ms', value: '55' });
});

test('malformed evidence is rejected instead of becoming an empty successful panel', () => {
  expect(() => decodeHealthTopology({ bootstrapTimeline: 'ready' })).toThrow(
    'OPS_HEALTH_FIELD_INVALID:bootstrapTimeline',
  );
  expect(() => decodeHealthTopology({ hubs: {} })).toThrow('OPS_HEALTH_ROWS_INVALID:Hub');
  expect(() => decodeHealthTopology({ hubs: [null] })).toThrow('OPS_HEALTH_ROW_INVALID:Hub:0');
});
