import { describe, expect, test } from 'bun:test';
import type {
  RuntimeAdapterHistoryFrameBatch,
  RuntimeAdapterViewFrame,
} from '../../../core/api/runtime-adapter/resolve';

import { readOpsEntityWorkspaceHistory } from '../../../frontend/apps/ops/src/ops-entity-workspace-history';
import {
  buildEntityWorkspaceTimeMachineHash,
  createEntityWorkspaceHistoryState,
  createEntityWorkspaceLiveState,
  readEntityWorkspaceTimeMachineLink,
  requireEntityWorkspaceHistoryHeight,
  updateEntityWorkspaceLatestHeight,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-time-machine';

const historyFrame = (height: number, accountsPage = 0): RuntimeAdapterViewFrame => ({
  activeEntity: {
    accounts: {
      hasMore: false, items: [], limit: 8, nextCursor: null, pageCount: 0,
      pageIndex: accountsPage, prevCursor: null, summary: null, totalItems: 0,
    },
    books: {
      hasMore: false, items: [], limit: 8, nextCursor: null, pageCount: 1,
      pageIndex: 0, prevCursor: null, totalItems: 0,
    },
    core: {
      config: { mode: 'proposer-based', threshold: 1n, validators: ['0xbbbb'], shares: { '0xbbbb': 1n } },
      entityId: '0xaaaa', height,
      profile: {
        avatar: '', bio: '', entityKind: 'company', isHub: false,
        name: 'Treasury', sectors: [], website: '',
      },
      reserves: new Map(), timestamp: height,
    },
    summary: {
      accountCount: 0, entityId: '0xaaaa', entityStateRoot: '0x01', height,
      isHub: false, jurisdiction: null, label: 'Treasury', reserveCount: 0,
    },
  },
  activeEntityId: '0xaaaa',
  entities: [],
  head: {
    canonicalStateHash: '0x01', entityCount: 1, frameHash: '0x02', latestHeight: height,
    materializedState: true, postStateHash: '0x03', runtimeId: 'runtime-a', stateHash: '0x04',
  },
  height,
});

const historyBatch = (frame: RuntimeAdapterViewFrame): RuntimeAdapterHistoryFrameBatch => ({
  frames: [frame],
  requestedHeights: [frame.height],
  unavailable: [],
});

const activityPage = (
  height: number,
  kind: 'all' | 'onchain' | 'offchain' = 'all',
  types: string[] = [],
  query = '',
) => ({
  ok: true as const,
  runtimeId: 'runtime-a',
  latestHeight: 18,
  fromHeight: 1,
  toHeight: height,
  scannedFrames: height,
  returned: 0,
  limit: 8,
  scanLimit: 160,
  nextBeforeHeight: null,
  filters: { entityId: '0xaaaa', kind, query, types, beforeHeight: height, limit: 8, scanLimit: 160 },
  events: [],
});

describe('React Entity workspace Time Machine', () => {
  test('keeps live and historical height state exact', () => {
    expect(createEntityWorkspaceLiveState(18)).toEqual({
      error: null, latestHeight: 18, loading: false, mode: 'live', selectedHeight: 18,
    });
    const history = createEntityWorkspaceHistoryState({ latestHeight: 18, selectedHeight: 7 });
    expect(updateEntityWorkspaceLatestHeight(history, 20)).toEqual({ ...history, latestHeight: 20 });
    expect(requireEntityWorkspaceHistoryHeight(1, 18)).toBe(1);
    expect(() => requireEntityWorkspaceHistoryHeight(0, 18)).toThrow('ENTITY_WORKSPACE_HISTORY_HEIGHT_INVALID');
    expect(() => requireEntityWorkspaceHistoryHeight(19, 18)).toThrow('ENTITY_WORKSPACE_HISTORY_HEIGHT_INVALID');
  });

  test('round-trips canonical Time Machine hash parameters without losing route state', () => {
    const hash = buildEntityWorkspaceTimeMachineHash(
      { hash: '#settings/display?jurisdiction=arrakis', search: '' },
      { entityId: '0xaaaa', height: 7, runtimeId: 'runtime-a' },
    );
    expect(hash).toBe('#settings/display?jurisdiction=arrakis&tmHeight=7&tmEntity=0xaaaa&tmRuntime=runtime-a');
    expect(readEntityWorkspaceTimeMachineLink({ hash, search: '' })).toEqual({
      entityId: '0xaaaa', height: 7, runtimeId: 'runtime-a',
    });
    expect(buildEntityWorkspaceTimeMachineHash({ hash, search: '' }, null))
      .toBe('#settings/display?jurisdiction=arrakis');
  });

  test('reads and projects one exact bounded historical frame', async () => {
    const queries: unknown[] = [];
    const projection = await readOpsEntityWorkspaceHistory({
      accountsPage: 0,
      client: {
        readActivity: async (query) => {
          queries.push(query);
          return activityPage(7, 'offchain', ['j_event'], 'Reserve');
        },
        readHistoryFrameBatch: async (query) => {
          queries.push(query);
          return historyBatch(historyFrame(7));
        },
      },
      activityKind: 'offchain',
      activitySearch: 'Reserve',
      activityTypes: ['j_event'],
      entityId: '0xaaaa', latestHeight: 18, requestedHeight: 7, runtimeId: 'runtime-a',
    });
    expect(queries).toEqual([
      {
        accountsLimit: 8, accountsPage: 0, booksLimit: 8, booksPage: 0,
        entityId: '0xaaaa', heights: [7],
      },
      {
        beforeHeight: 7, entityId: '0xaaaa', kind: 'offchain', limit: 8,
        q: 'Reserve', scanLimit: 160, types: ['j_event'],
      },
    ]);
    expect(projection.context).toMatchObject({ entityId: '0xaaaa', height: 7, status: 'selected' });
    expect(projection.activity).toMatchObject({
      kind: 'offchain', query: 'Reserve', status: 'selected', types: ['j_event'],
    });
    expect(projection.consensus).toMatchObject({ entityId: '0xaaaa', runtimeHeight: 7, status: 'selected' });
  });

  test('rejects page and entity drift before publishing historical state', async () => {
    await expect(readOpsEntityWorkspaceHistory({
      accountsPage: 1,
      client: {
        readActivity: async () => activityPage(7),
        readHistoryFrameBatch: async () => historyBatch(historyFrame(7)),
      },
      entityId: '0xaaaa', latestHeight: 18, requestedHeight: 7, runtimeId: 'runtime-a',
    })).rejects.toThrow('Remote Time Machine page mismatch');
    await expect(readOpsEntityWorkspaceHistory({
      accountsPage: 0,
      client: {
        readActivity: async () => activityPage(7),
        readHistoryFrameBatch: async () => historyBatch(historyFrame(7)),
      },
      entityId: '0xcccc', latestHeight: 18, requestedHeight: 7, runtimeId: 'runtime-a',
    })).rejects.toThrow('Remote Time Machine entity mismatch');
  });
});
