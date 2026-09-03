import { describe, expect, test } from 'bun:test';

import { OpsEntityWorkspaceActivityController } from '../../../frontend/apps/ops/src/ops-entity-workspace-activity-controller';
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
    expect(buildEntityWorkspaceActivityQuery(context, 13)).toEqual({
      beforeHeight: 13, entityId: '0xaaaa', kind: 'all', limit: 8, scanLimit: 160,
    });
    expect(buildEntityWorkspaceActivityQuery(context, 13, 'offchain')).toEqual({
      beforeHeight: 13, entityId: '0xaaaa', kind: 'offchain', limit: 8, scanLimit: 160,
    });
    expect(() => buildEntityWorkspaceActivityQuery(context, 0))
      .toThrow('ENTITY_WORKSPACE_ACTIVITY_BEFORE_HEIGHT_INVALID');
    expect(() => buildEntityWorkspaceActivityQuery(context, 45))
      .toThrow('ENTITY_WORKSPACE_ACTIVITY_BEFORE_HEIGHT_INVALID');
    expect(() => buildEntityWorkspaceActivityQuery(context, 13, 'system' as never))
      .toThrow('ENTITY_WORKSPACE_ACTIVITY_KIND_INVALID');
  });

  test('preserves adapter event order and exact persisted evidence', () => {
    expect(projectEntityWorkspaceActivity({ context, page: page() })).toEqual({
      status: 'selected', entityId: '0xaaaa', requestedBeforeHeight: 44,
      isLatestPage: true, kind: 'all', latestHeight: 50,
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

  test('projects an earlier bounded page without changing adapter order', () => {
    const earlier = page({
      fromHeight: 10, toHeight: 13, scannedFrames: 4, nextBeforeHeight: 9,
      filters: { entityId: '0xaaaa', kind: 'all', beforeHeight: 13, limit: 8, scanLimit: 160 },
      events: [event({ id: 'runtime-a:13:1', height: 13 }), event({ id: 'runtime-a:12:0', height: 12 })],
    });
    expect(projectEntityWorkspaceActivity({ beforeHeight: 13, context, page: earlier })).toMatchObject({
      status: 'selected', requestedBeforeHeight: 13, isLatestPage: false,
      fromHeight: 10, toHeight: 13, nextBeforeHeight: 9,
      events: [{ id: 'runtime-a:13:1' }, { id: 'runtime-a:12:0' }],
    });
  });

  test('projects only the exact requested adapter kind', () => {
    const offchain = page({
      filters: { entityId: '0xaaaa', kind: 'offchain', beforeHeight: 44, limit: 8, scanLimit: 160 },
    });
    expect(projectEntityWorkspaceActivity({ context, kind: 'offchain', page: offchain }))
      .toMatchObject({ kind: 'offchain', events: [{ kind: 'offchain' }, { kind: 'offchain' }] });
    expect(() => projectEntityWorkspaceActivity({ context, kind: 'onchain', page: offchain }))
      .toThrow('ENTITY_WORKSPACE_ACTIVITY_FILTER_KIND_MISMATCH');
    expect(() => projectEntityWorkspaceActivity({ context, kind: 'onchain', page: page({
      filters: { entityId: '0xaaaa', kind: 'onchain', beforeHeight: 44, limit: 8, scanLimit: 160 },
    }) })).toThrow('ENTITY_WORKSPACE_ACTIVITY_EVENT_KIND_MISMATCH');
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

  test('owns Latest/Earlier cursor state and refreshes the active transport only', () => {
    let historyActive = false;
    let historyRefreshes = 0;
    let liveRefreshes = 0;
    const controller = new OpsEntityWorkspaceActivityController({
      isHistoryActive: () => historyActive,
      refreshHistory: () => { historyRefreshes += 1; },
      refreshLive: () => { liveRefreshes += 1; },
    });
    const latest = projectEntityWorkspaceActivity({ context, page: page() });
    expect(() => controller.select(latest, 40)).toThrow('OPS_ENTITY_ACTIVITY_PAGE_INVALID:40');
    controller.select(latest, 41);
    expect(controller.readBeforeHeight()).toBe(41);
    expect({ historyRefreshes, liveRefreshes }).toEqual({ historyRefreshes: 0, liveRefreshes: 1 });
    controller.selectKind(latest, 'offchain');
    expect({ beforeHeight: controller.readBeforeHeight(), kind: controller.readKind() })
      .toEqual({ beforeHeight: null, kind: 'offchain' });
    expect({ historyRefreshes, liveRefreshes }).toEqual({ historyRefreshes: 0, liveRefreshes: 2 });
    controller.selectKind(latest, 'offchain');
    expect({ historyRefreshes, liveRefreshes }).toEqual({ historyRefreshes: 0, liveRefreshes: 2 });

    const earlier = projectEntityWorkspaceActivity({
      beforeHeight: 13,
      context,
      kind: 'offchain',
      page: page({
        fromHeight: 10, toHeight: 13, scannedFrames: 4, nextBeforeHeight: 9,
        filters: { entityId: '0xaaaa', kind: 'offchain', beforeHeight: 13, limit: 8, scanLimit: 160 },
        events: [event({ id: 'runtime-a:13:1', height: 13 }), event({ id: 'runtime-a:12:0', height: 12 })],
      }),
    });
    historyActive = true;
    controller.select(earlier, null);
    expect(controller.readBeforeHeight()).toBeNull();
    expect({ historyRefreshes, liveRefreshes }).toEqual({ historyRefreshes: 1, liveRefreshes: 2 });
    controller.selectKind(earlier, 'onchain');
    expect(controller.readKind()).toBe('onchain');
    expect({ historyRefreshes, liveRefreshes }).toEqual({ historyRefreshes: 2, liveRefreshes: 2 });
    controller.resetPage();
    expect(controller.readKind()).toBe('onchain');
    controller.reset();
    expect(controller.readBeforeHeight()).toBeNull();
    expect(controller.readKind()).toBe('all');
  });

  test('keeps the visible ledger read-only and attached to live plus historical reads', async () => {
    const [panel, source, history] = await Promise.all([
      Bun.file('frontend/packages/ui/src/entity-workspace-activity-panel.tsx').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace-source.ts').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace-history.ts').text(),
    ]);
    expect(panel).toContain('Adapter order is preserved');
    expect(panel).toContain('data-testid="entity-activity-ledger"');
    expect(panel).toContain('data-testid="entity-activity-earlier"');
    expect(panel).toContain('data-testid="entity-activity-latest"');
    expect(panel).toContain('data-testid={`entity-activity-kind-${kind}`}');
    expect(source).toContain('client.readActivity(activityQuery)');
    expect(source).toContain('readonly selectActivityPage');
    expect(source).toContain('readonly selectActivityKind');
    expect(history).toContain('input.client.readActivity(activityQuery)');
    expect([panel, source, history].join('\n')).not.toContain('.send(');
  });
});
