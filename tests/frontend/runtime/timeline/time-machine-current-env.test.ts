import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runtimeControllerHandle } from '../../../../frontend/bridges/runtime/runtime-controller-store';
import { runtimeQueryClient } from '../../../../frontend/bridges/runtime/runtime-query-client';
import {
  assertRuntimeViewIsLive,
  normalizeRuntimeViewAtHeight,
  readRuntimeViewSelection,
  refreshSelectedRuntimeView,
  resetRuntimeView,
  runtimeView,
  runtimeViewAccountsPage,
  runtimeViewFrameMatchesAtHeight,
  runtimeViewPageInfo,
  runtimeViewPublicationMatches,
  runtimeViewQueryAtHeight,
  setRuntimeViewPage,
  setRuntimeViewAtHeight,
} from '../../../../frontend/bridges/runtime/runtime-view-store';

const repoRoot = process.cwd();

const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');
const readStore = <T>(store: { subscribe: (run: (value: T) => void) => () => void }): T => {
  let current!: T;
  const unsubscribe = store.subscribe((value) => { current = value; });
  unsubscribe();
  return current;
};

const originalReadHead = runtimeQueryClient.readHead.bind(runtimeQueryClient);
const originalReadViewFrame = runtimeQueryClient.readViewFrame.bind(runtimeQueryClient);

afterEach(() => {
  runtimeQueryClient.readHead = originalReadHead;
  runtimeQueryClient.readViewFrame = originalReadViewFrame;
  runtimeControllerHandle.set({
    id: 'embedded',
    runtimeId: 'embedded',
    pendingRuntimeId: '',
    mode: 'embedded',
    endpoint: 'embedded',
    permissions: 'write',
    status: 'disconnected',
    height: 0,
    authLevel: null,
  });
  resetRuntimeView();
});

describe('frontend time-machine current env contract', () => {
  test('selected historical height is part of the shared RuntimeView query', () => {
    expect(normalizeRuntimeViewAtHeight(null)).toBeNull();
    expect(normalizeRuntimeViewAtHeight(7.9)).toBe(7);
    expect(() => normalizeRuntimeViewAtHeight(0)).toThrow('positive integer');

    expect(runtimeViewQueryAtHeight({ entityId: '0xabc', accountsLimit: 8 }, 7)).toEqual({
      entityId: '0xabc',
      accountsLimit: 8,
      atHeight: 7,
    });
    expect(runtimeViewQueryAtHeight({ entityId: '0xabc', atHeight: 7 }, null)).toEqual({
      entityId: '0xabc',
    });
    expect(runtimeViewFrameMatchesAtHeight({ height: 7 } as never, 7)).toBe(true);
    expect(runtimeViewFrameMatchesAtHeight({ height: 8 } as never, 7)).toBe(false);
    expect(() => assertRuntimeViewIsLive({ atHeight: 7 })).toThrow('RUNTIME_COMMAND_REQUIRES_LIVE_VIEW');
    expect(() => assertRuntimeViewIsLive({ atHeight: null })).not.toThrow();
  });

  test('returning to LIVE reloads the current frame without atHeight', async () => {
    const queries: Array<number | undefined> = [];
    runtimeControllerHandle.set({
      id: 'browser-a',
      runtimeId: 'browser-a',
      pendingRuntimeId: '',
      mode: 'embedded',
      endpoint: 'embedded',
      permissions: 'write',
      status: 'connected',
      height: 12,
      authLevel: 'admin',
    });
    runtimeQueryClient.readHead = async () => ({ latestHeight: 12 }) as never;
    runtimeQueryClient.readViewFrame = async (query = {}) => {
      queries.push(query.atHeight);
      return { height: query.atHeight ?? 12 } as never;
    };
    resetRuntimeView();

    await setRuntimeViewAtHeight(7);
    expect(readStore(runtimeView)).toMatchObject({ atHeight: 7, height: 7, frame: { height: 7 } });

    await setRuntimeViewAtHeight(null);
    expect(readStore(runtimeView)).toMatchObject({ atHeight: null, height: 12, frame: { height: 12 } });
    expect(queries).toEqual([7, undefined]);
  });

  test('a stale historical failure cannot overwrite a newer LIVE selection', async () => {
    let rejectHistorical!: (error: Error) => void;
    runtimeControllerHandle.set({
      id: 'browser-a',
      runtimeId: 'browser-a',
      pendingRuntimeId: '',
      mode: 'embedded',
      endpoint: 'embedded',
      permissions: 'write',
      status: 'connected',
      height: 12,
      authLevel: 'admin',
    });
    runtimeQueryClient.readHead = async () => ({ latestHeight: 12 }) as never;
    runtimeQueryClient.readViewFrame = async (query = {}) => {
      if (query.atHeight === 7) {
        return new Promise((_, reject) => { rejectHistorical = reject; });
      }
      return { height: 12 } as never;
    };
    resetRuntimeView();

    const historical = setRuntimeViewAtHeight(7);
    const live = setRuntimeViewAtHeight(null);
    await live;
    rejectHistorical(new Error('stale historical read failed'));

    await expect(historical).resolves.toMatchObject({
      atHeight: 7,
      error: 'stale historical read failed',
    });
    expect(readStore(runtimeView)).toMatchObject({ atHeight: null, height: 12, frame: { height: 12 }, error: null });
  });

  test('LIVE and historical height changes reject superseded remote publications', async () => {
    runtimeControllerHandle.set({
      id: 'remote-a',
      runtimeId: 'remote-a',
      pendingRuntimeId: '',
      mode: 'remote',
      endpoint: 'ws://remote-a',
      permissions: 'read',
      status: 'connected',
      height: 12,
      authLevel: 'read',
    });
    runtimeQueryClient.readHead = async () => ({ latestHeight: 12 }) as never;
    runtimeQueryClient.readViewFrame = async (query = {}) => ({ height: query.atHeight ?? 12 }) as never;
    resetRuntimeView();

    const published: string[] = [];
    const publishIfCurrent = async (
      selection: ReturnType<typeof readRuntimeViewSelection>,
      result: Promise<string>,
    ): Promise<void> => {
      const resolved = await result;
      if (runtimeViewPublicationMatches(1, 1, selection)) published.push(resolved);
    };

    const liveSelection = readRuntimeViewSelection();
    let resolveLive!: (value: string) => void;
    const staleLive = publishIfCurrent(
      liveSelection,
      new Promise<string>((resolve) => { resolveLive = resolve; }),
    );
    await setRuntimeViewAtHeight(7);
    resolveLive('LIVE');
    await staleLive;

    const heightSevenSelection = readRuntimeViewSelection();
    let resolveHeightSeven!: (value: string) => void;
    const staleHeightSeven = publishIfCurrent(
      heightSevenSelection,
      new Promise<string>((resolve) => { resolveHeightSeven = resolve; }),
    );
    await setRuntimeViewAtHeight(8);
    resolveHeightSeven('h7');
    await staleHeightSeven;

    expect(published).toEqual([]);
    expect(readRuntimeViewSelection().atHeight).toBe(8);
  });

  test('historical frame and pager publish from the same current height read', async () => {
    runtimeControllerHandle.set({
      id: 'remote-a',
      runtimeId: 'remote-a',
      pendingRuntimeId: '',
      mode: 'remote',
      endpoint: 'ws://remote-a',
      permissions: 'read',
      status: 'connected',
      height: 12,
      authLevel: 'read',
    });
    const frameAt = (height: number, accountsPageCount: number) => ({
      height,
      entities: [],
      activeEntityId: '0xentity-a',
      activeEntity: {
        summary: { entityId: '0xentity-a' },
        core: { entityId: '0xentity-a', timestamp: height },
        accounts: {
          items: [],
          totalItems: accountsPageCount,
          pageIndex: 0,
          pageCount: accountsPageCount,
          prevCursor: null,
          nextCursor: accountsPageCount > 1 ? `accounts-${height}` : null,
        },
        books: {
          items: [],
          totalItems: 0,
          pageIndex: 0,
          pageCount: 1,
          prevCursor: null,
          nextCursor: null,
        },
      },
    }) as never;
    runtimeQueryClient.readHead = async () => ({ latestHeight: 12 }) as never;
    runtimeQueryClient.readViewFrame = async () => frameAt(12, 10);
    resetRuntimeView();
    await refreshSelectedRuntimeView();
    expect(readStore(runtimeViewPageInfo)?.accountsPageCount).toBe(10);

    const deferred = new Map<number, (frame: never) => void>();
    runtimeQueryClient.readViewFrame = async (query = {}) => new Promise<never>((resolve) => {
      deferred.set(Number(query.atHeight), resolve);
    });
    const heightSeven = setRuntimeViewAtHeight(7);
    expect(readStore(runtimeViewPageInfo)).toBeNull();
    const heightEight = setRuntimeViewAtHeight(8);

    deferred.get(7)?.(frameAt(7, 7));
    await heightSeven;
    expect(readStore(runtimeViewPageInfo)).toBeNull();

    deferred.get(8)?.(frameAt(8, 2));
    await heightEight;
    expect(readStore(runtimeView)).toMatchObject({ atHeight: 8, frame: { height: 8 } });
    expect(readStore(runtimeViewPageInfo)).toMatchObject({
      entityId: '0xentity-a',
      accountsPageCount: 2,
      accountsNextCursor: 'accounts-8',
    });
  });

  test('changing a wallet page invalidates an in-flight projection before the queued refresh starts', async () => {
    let resolveFrame!: (frame: never) => void;
    runtimeControllerHandle.set({
      id: 'remote-a',
      runtimeId: 'remote-a',
      pendingRuntimeId: '',
      mode: 'remote',
      endpoint: 'ws://remote-a',
      permissions: 'read',
      status: 'connected',
      height: 12,
      authLevel: 'read',
    });
    runtimeQueryClient.readHead = async () => ({ latestHeight: 12 }) as never;
    runtimeQueryClient.readViewFrame = async () => new Promise<never>((resolve) => { resolveFrame = resolve; });
    resetRuntimeView();

    const stalePage = refreshSelectedRuntimeView();
    setRuntimeViewPage('accounts', 1);
    resolveFrame({ height: 12, activeEntityId: '0xentity-a' } as never);
    await stalePage;

    expect(readStore(runtimeViewAccountsPage)).toBe(1);
    expect(readStore(runtimeView).frame).toBeNull();
  });

  test('React workspace publishes one selected network frame to timeline, graph, and panels', () => {
    const timeline = read('frontend/apps/ops/src/workspace/session/ops-workspace-timeline.tsx');
    const environment = read('frontend/apps/ops/src/workspace/session/use-workspace-environment.ts');
    const graph = read('frontend/apps/ops/src/workspace/graph/ops-graph-panel.tsx');

    expect(timeline).toContain('const step = network.selectedStep;');
    expect(timeline).toContain('selectWorkspaceStep(Number(event.currentTarget.value))');
    expect(environment).toContain('const selected = network.selectedStep;');
    expect(environment).toContain('networkMachineRuntimeOperations.readSelectedSnapshot()');
    expect(graph).toContain('network.selectedStep ? [...network.frames.values()]');
    expect(graph).toContain('data-selected-step-index={network.selectedStepIndex}');
  });

  test('React graph and timeline share the same NetworkMachine selection', () => {
    const workspace = read('frontend/apps/ops/src/workspace/ops-workspace.tsx');
    const timeline = read('frontend/apps/ops/src/workspace/session/ops-workspace-timeline.tsx');
    const graph = read('frontend/apps/ops/src/workspace/graph/ops-graph-panel.tsx');

    expect(workspace).toContain('<OpsWorkspaceTimeline />');
    expect(timeline).toContain('workspaceNetwork');
    expect(graph).toContain('workspaceNetwork');
    expect(timeline).toContain('data-testid="workspace-network-timeline"');
    expect(graph).toContain('data-testid="workspace-graph"');
  });

  test('NetworkMachine keeps -1 as the only live cursor sentinel', () => {
    const source = read('frontend/bridges/runtime/network/network-machine-runtime-store.ts');

    expect(source).toContain('selectedStepIndex: -1');
    expect(source).toContain('selectedStep: null');
    expect(source).toContain('selectedStepIndex: safeIndex');
    expect(source).not.toContain('selectedStepIndex: machine.steps.length - 1');
  });

  test('remote timeline loads and trail links use explicit Runtime identity', () => {
    const source = read('frontend/apps/ops/src/workspace/session/ops-workspace-playback.ts');

    expect(source).toContain('adapterNetworkTimelineSource(adapter.runtimeId, adapter)');
    expect(source).toContain('step.event.runtimeId === selected.event.runtimeId');
    expect(source).toContain("const url = new URL('/embed', window.location.origin)");
    expect(source).not.toContain('appRuntimeAdapterMode');
    expect(source).not.toContain('appRuntimeAdapterEndpoint');
  });

  test('live Runtime updates cannot replace an explicit historical selection', () => {
    const source = read('frontend/apps/ops/src/workspace/session/use-workspace-environment.ts');

    expect(source).toContain('const selected = network.selectedStep;');
    expect(source).toContain('selected\n    ? networkMachineRuntimeOperations.readSelectedSnapshot()\n    : local.env');
    expect(source).toContain('historical: selected !== null');
    expect(source).toContain('refreshLocal: selected ? undefined : session?.refresh');
  });

  test('demo actions block historical frames and graph remains projection-only', () => {
    const architect = read('frontend/apps/ops/src/workspace/architect/ops-architect-live-controls.tsx');
    const panel = read('frontend/apps/ops/src/workspace/panels/ops-architect-panel.tsx');
    const graph = read('frontend/apps/ops/src/workspace/graph/ops-graph-panel.tsx');

    expect(architect).toContain('fieldset disabled={context.historical');
    expect(architect).toContain('Switch to Live Runtime before creating, funding, or transferring.');
    expect(panel).toContain('disabled={busy || network.loading || context.historical}');
    expect(graph).not.toContain('async function sendPayment()');
    expect(graph).not.toContain('async function executeScenario()');
    expect(graph).toContain('projectRuntimeGraphFrame');
  });

  test('React Architect resets its isolated demo without mutating the connected Runtime', () => {
    const architect = read('frontend/apps/ops/src/workspace/panels/ops-architect-panel.tsx');

    expect(architect).toContain('const resetDemo = (): void => {');
    expect(architect).toContain('networkMachineRuntimeOperations.dispose();');
    expect(architect).toContain('Isolated demo reset. The connected Runtime was not changed.');
    expect(architect).not.toContain('reload page to reset');
    expect(architect).not.toContain('reload page for now');
  });
});
