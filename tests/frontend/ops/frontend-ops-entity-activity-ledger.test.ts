import { describe, expect, test } from 'bun:test';

import {
  buildEntityWorkspaceActivityQuery,
  projectEntityWorkspaceActivity,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-activity';
import { projectEntityWorkspaceContext } from '../../../frontend/packages/runtime-client/src/entity-workspace-context';

const context = projectEntityWorkspaceContext({
  runtimeId: 'runtime-a',
  frame: {
    height: 44,
    activeEntityId: '0xaaaa',
    activeEntity: {
      summary: { entityId: '0xaaaa', label: 'Treasury' },
      core: { entityId: '0xaaaa' },
      accounts: { items: [], totalItems: 0 },
    },
  },
});

const event = (overrides: Record<string, unknown> = {}) => ({
  id: 'runtime-a:44:0', runtimeId: 'runtime-a', height: 44, timestamp: 1_700_000_044,
  kind: 'offchain', type: 'payment', source: 'runtime_input', direction: 'out',
  title: 'Payment started', subtitle: 'Account 0xbbbb', status: 'started',
  entityId: '0xaaaa', counterpartyId: '0xbbbb', rawType: 'directPayment',
  ...overrides,
});

const page = (overrides: Record<string, unknown> = {}) => ({
  ok: true, runtimeId: 'runtime-a', latestHeight: 50, fromHeight: 42, toHeight: 44,
  scannedFrames: 3, returned: 2, limit: 8, scanLimit: 160, nextBeforeHeight: 41,
  filters: { entityId: '0xaaaa', kind: 'all', beforeHeight: 44, limit: 8, scanLimit: 160 },
  events: [
    event({ id: 'runtime-a:44:1' }),
    event({ id: 'runtime-a:43:0', height: 43, timestamp: 1_700_000_043, direction: 'in' }),
  ],
  ...overrides,
});

describe('React Entity persisted activity ledger', () => {
  test('pins one bounded read to the exact displayed committed frame', () => {
    expect(buildEntityWorkspaceActivityQuery(context)).toEqual({
      beforeHeight: 44, entityId: '0xaaaa', kind: 'all', limit: 8, scanLimit: 160,
    });
  });

  test('preserves adapter event order and exact persisted evidence', () => {
    expect(projectEntityWorkspaceActivity({ context, page: page() })).toEqual({
      status: 'selected', entityId: '0xaaaa', latestHeight: 50,
      fromHeight: 42, toHeight: 44, scannedFrames: 3, nextBeforeHeight: 41,
      events: [
        {
          id: 'runtime-a:44:1', height: 44, timestamp: 1_700_000_044,
          kind: 'offchain', type: 'payment', source: 'runtime_input', direction: 'out',
          title: 'Payment started', subtitle: 'Account 0xbbbb', status: 'started',
          counterpartyId: '0xbbbb', rawType: 'directPayment',
        },
        {
          id: 'runtime-a:43:0', height: 43, timestamp: 1_700_000_043,
          kind: 'offchain', type: 'payment', source: 'runtime_input', direction: 'in',
          title: 'Payment started', subtitle: 'Account 0xbbbb', status: 'started',
          counterpartyId: '0xbbbb', rawType: 'directPayment',
        },
      ],
    });
  });

  test('rejects drift, malformed event facts, duplicates, and incoherent metadata', () => {
    expect(() => projectEntityWorkspaceActivity({ context, page: page({
      filters: { entityId: '0xcccc', kind: 'all', beforeHeight: 44, limit: 8, scanLimit: 160 },
    }) })).toThrow('ENTITY_WORKSPACE_ACTIVITY_FILTER_ENTITY_MISMATCH');
    expect(() => projectEntityWorkspaceActivity({ context, page: page({
      events: [event({ height: 45 }), event({ id: 'runtime-a:43:0', height: 43 })],
    }) })).toThrow('ENTITY_WORKSPACE_ACTIVITY_EVENT_HEIGHT_MISMATCH');
    expect(() => projectEntityWorkspaceActivity({ context, page: page({
      events: [event({ source: 'transport' }), event({ id: 'runtime-a:43:0', height: 43 })],
    }) })).toThrow('ENTITY_WORKSPACE_ACTIVITY_EVENT_SOURCE_INVALID');
    expect(() => projectEntityWorkspaceActivity({ context, page: page({
      events: [event(), event()],
    }) })).toThrow('ENTITY_WORKSPACE_ACTIVITY_EVENT_ID_DUPLICATE');
    expect(() => projectEntityWorkspaceActivity({ context, page: page({ returned: 1 }) }))
      .toThrow('ENTITY_WORKSPACE_ACTIVITY_RETURNED_MISMATCH');
  });

  test('keeps the visible ledger read-only and attached to live plus historical reads', async () => {
    const [panel, source, history] = await Promise.all([
      Bun.file('frontend/packages/ui/src/entity-workspace-activity-panel.tsx').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace-source.ts').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace-history.ts').text(),
    ]);
    expect(panel).toContain('Adapter order is preserved');
    expect(panel).toContain('data-testid="entity-activity-ledger"');
    expect(source).toContain('client.readActivity(buildEntityWorkspaceActivityQuery(projection.context))');
    expect(history).toContain('input.client.readActivity(buildEntityWorkspaceActivityQuery(projection.context))');
    expect([panel, source, history].join('\n')).not.toContain('.send(');
  });
});
