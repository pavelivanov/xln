import { expect, test } from 'bun:test';
import {
  buildFlowEdges,
  endpointLabel,
  projectionEntityFromSummary,
} from '../../../../frontend/packages/ui/src/health/runtime-projections';
import type { RuntimeAdapterEntitySummary } from '@xln/core/api/public/runtime-module';

// Projection inputs contain canonical facts only; this view never resolves a
// different Runtime or derives Entity balances from the event window.
test('Health projects Entity identity and connection metadata from the selected Runtime', () => {
  const summary: RuntimeAdapterEntitySummary = {
    entityId: '0xABC',
    label: 'Alice',
    isHub: true,
    height: 9,
    jurisdiction: { name: 'Testnet' },
  };
  expect(
    projectionEntityFromSummary(summary, {
      id: 'runtime-a',
      status: 'connected',
      height: 10,
      mode: 'remote',
      authLevel: 'admin',
    }),
  ).toEqual({
    entityId: '0xabc',
    runtimeId: 'runtime-a',
    name: 'Alice',
    isHub: true,
    online: true,
    lastUpdated: 9,
    capabilities: ['hub', 'routing'],
    metadata: { height: 9, jurisdiction: { name: 'Testnet' }, runtimeMode: 'remote', authLevel: 'admin' },
  });
  expect(
    projectionEntityFromSummary(
      { ...summary, isHub: false, height: 0 },
      { id: 'runtime-b', status: 'disconnected', height: 12, mode: 'embedded', authLevel: null },
    ),
  ).toMatchObject({ runtimeId: 'runtime-b', online: false, lastUpdated: 12, capabilities: ['entity'] });
});

test('Health flow totals preserve route counts, critical counts and most recent evidence', () => {
  const input = [
    { id: 'a', ts: 1, event: 'input', from: 'Alice', to: 'Bob' },
    { id: 'b', ts: 5, event: 'error', from: 'Alice', to: 'Bob' },
    { id: 'c', ts: 3, event: 'input', from: 'Carol', to: 'Bob' },
    { id: 'd', ts: 4, event: 'input', from: 'Dan', to: 'Bob' },
  ];
  expect(buildFlowEdges(input)).toEqual([
    { key: 'Alice->Bob', from: 'Alice', to: 'Bob', count: 2, critical: 1, lastTs: 5 },
    { key: 'Dan->Bob', from: 'Dan', to: 'Bob', count: 1, critical: 0, lastTs: 4 },
    { key: 'Carol->Bob', from: 'Carol', to: 'Bob', count: 1, critical: 0, lastTs: 3 },
  ]);
  expect(input.map(event => event.id)).toEqual(['a', 'b', 'c', 'd']);
  expect(
    buildFlowEdges([{ id: 'system', ts: 2, event: 'input', runtimeId: 'runtime-a', msgType: 'system' }])[0]?.key,
  ).toBe('runtime-a->system');
  expect(buildFlowEdges([])).toEqual([]);
  expect(endpointLabel('12345678901234567890')).toBe('12345678...7890');
});
