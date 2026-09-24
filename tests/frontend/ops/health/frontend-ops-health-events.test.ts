import { expect, test } from 'bun:test';
import {
  emptyRuntimeEventFilters,
  filterRuntimeProjectionEvents,
  isCriticalEvent,
  projectionEventFromActivity,
  type RuntimeProjectionEvent,
} from '../../../../frontend/packages/ui/src/health/runtime-events';

const events: RuntimeProjectionEvent[] = [
  {
    id: 'a',
    ts: 1,
    event: 'input',
    runtimeId: 'runtime-a',
    from: 'Alice',
    to: 'Bob',
    msgType: 'account',
    status: 'delivered',
  },
  {
    id: 'b',
    ts: 2,
    event: 'error',
    runtimeId: 'runtime-b',
    from: 'Bob',
    to: 'Alice',
    msgType: 'runtime',
    status: 'rejected',
    reason: 'FRAME_CONSENSUS_FAILED',
  },
  {
    id: 'c',
    ts: 3,
    event: 'output',
    runtimeId: 'runtime-a',
    from: 'Alice',
    to: 'Carol',
    msgType: 'account',
    status: 'queued',
  },
];

test('health event filtering preserves newest-first order without mutating Runtime evidence', () => {
  const filters = emptyRuntimeEventFilters();
  expect(filterRuntimeProjectionEvents(events, filters).map(event => event.id)).toEqual(['c', 'b', 'a']);
  expect(events.map(event => event.id)).toEqual(['a', 'b', 'c']);
  expect(
    filterRuntimeProjectionEvents(events, {
      ...filters,
      filterRuntime: 'RUNTIME-A',
      filterFrom: ' ALICE ',
      filterTo: 'BOB',
      filterEvent: 'input',
      filterMsgType: 'account',
      filterStatus: 'delivered',
    }).map(event => event.id),
  ).toEqual(['a']);
  expect(filterRuntimeProjectionEvents(events, { ...filters, filterRuntime: 'Carol' }).map(event => event.id)).toEqual([
    'c',
  ]);
  expect(
    filterRuntimeProjectionEvents(events, { ...filters, onlyCritical: true, search: 'consensus' }).map(
      event => event.id,
    ),
  ).toEqual(['b']);
  expect(filterRuntimeProjectionEvents(events, { ...filters, search: 'no-match' })).toEqual([]);
});

test('critical feed preserves fatal delivery, error events and established pattern matching', () => {
  expect(isCriticalEvent({ id: 'fatal', ts: 1, event: 'input', delivery: { fatal: true } })).toBe(true);
  expect(isCriticalEvent({ id: 'error', ts: 1, event: 'error' })).toBe(true);
  expect(isCriticalEvent({ id: 'deferred', ts: 1, event: 'input', reason: 'ROUTE-DEFER' })).toBe(true);
  expect(isCriticalEvent({ id: 'neutral', ts: 1, event: 'input', status: 'delivered' })).toBe(false);
});

test('health projection retains exact Runtime and financial event evidence without recomputing it', () => {
  expect(
    projectionEventFromActivity({
      id: 'operation-1',
      runtimeId: 'runtime-a',
      height: 42,
      timestamp: 1000,
      kind: 'offchain',
      type: 'account',
      source: 'runtime_input',
      direction: 'out',
      title: 'Account opened',
      subtitle: 'Exact peer',
      status: 'delivered',
      entityId: 'alice',
      counterpartyId: 'bob',
      tokenId: 1,
      amount: '9007199254740993',
      hash: 'hash-1',
      rawType: 'openAccount',
    }),
  ).toEqual({
    id: 'operation-1',
    ts: 1000,
    event: 'openAccount',
    runtimeId: 'runtime-a',
    from: 'alice',
    to: 'bob',
    msgType: 'account',
    status: 'delivered',
    reason: 'Exact peer',
    encrypted: false,
    details: {
      height: 42,
      kind: 'offchain',
      source: 'runtime_input',
      direction: 'out',
      title: 'Account opened',
      amount: '9007199254740993',
      tokenId: 1,
      hash: 'hash-1',
    },
  });
});
