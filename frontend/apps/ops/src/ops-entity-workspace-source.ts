import type {
  RuntimeAdapterActivityPage,
  RuntimeAdapter,
  RuntimeAdapterHistoryFrameBatch,
  RuntimeAdapterReadQuery,
  RuntimeAdapterViewFrame,
} from '@xln/core/api/public/runtime-module';
import type { RuntimeAdapterStorageSnapshot } from '../../../packages/browser/src/runtime-adapter-session';
import {
  emptyOpsEntityWorkspaceProjection,
  projectOpsEntityWorkspaceActivityPage,
  projectOpsEntityWorkspaceFrame,
  projectOpsEntityWorkspaceObserverSnapshot,
  type OpsEntityWorkspaceProjection,
  type OpsEntityWorkspaceSourceSnapshot,
} from './ops-entity-workspace-projection';
import { RuntimeQueryClient } from '../../../packages/runtime-client/src/runtime-query-client';
import type { RuntimeQueryResultSchema } from '../../../packages/runtime-client/src/runtime-query-client';
import { RuntimeQueryObserver } from '../../../packages/runtime-client/src/runtime-query-observer';
import {
  buildEntityWorkspaceActivityQuery,
  type EntityWorkspaceActivityFilterType,
  type EntityWorkspaceActivityKind,
} from '../../../packages/runtime-client/src/entity-workspace-activity';
import { createEntityWorkspaceLiveState } from '../../../packages/runtime-client/src/entity-workspace-time-machine';
import { OpsEntityWorkspaceActivityController } from './ops-entity-workspace-activity-controller';
import { OpsEntityWorkspaceHistoryController } from './ops-entity-workspace-history-controller';

type RuntimeReadSession = Readonly<{
  adapter: RuntimeAdapter;
  release: () => void;
}>;

export type OpsEntityWorkspaceSourceDependencies = Readonly<{
  openSession: (config: RuntimeAdapterStorageSnapshot) => Promise<RuntimeReadSession>;
}>;

type RemoteSessionConfig = Readonly<{
  wsUrl: string;
  authKey: string;
}>;

type OpsRuntimeQueryResults = RuntimeQueryResultSchema & Readonly<{
  activity: RuntimeAdapterActivityPage;
  historyFrameBatch: RuntimeAdapterHistoryFrameBatch;
  viewFrame: RuntimeAdapterViewFrame;
}>;

type OpsRuntimeQueryClient = RuntimeQueryClient<RuntimeAdapterReadQuery, OpsRuntimeQueryResults>;

const readEntityWorkspaceProjection = async (
  client: OpsRuntimeQueryClient,
  runtimeId: string,
  frame: RuntimeAdapterViewFrame,
  activityBeforeHeight?: number,
  activityKind: EntityWorkspaceActivityKind = 'all',
  activityTypes: readonly EntityWorkspaceActivityFilterType[] = [],
  activitySearch: string = '',
): Promise<OpsEntityWorkspaceProjection> => {
  const projection = projectOpsEntityWorkspaceFrame(runtimeId, frame);
  if (projection.context.status === 'empty') return projection;
  const activityQuery = buildEntityWorkspaceActivityQuery(
    projection.context,
    activityBeforeHeight,
    activityKind,
    activityTypes,
    activitySearch,
  );
  const activity = await client.readActivity(activityQuery);
  return projectOpsEntityWorkspaceActivityPage(
    projection,
    activity,
    activityQuery.beforeHeight,
    activityQuery.kind,
    activityTypes,
    activitySearch,
  );
};

export const requireOpsEntityRemoteSession = (
  snapshot: RuntimeAdapterStorageSnapshot,
): RemoteSessionConfig => {
  if (snapshot.mode !== 'remote') throw new Error('OPS_ENTITY_REMOTE_SESSION_REQUIRED');
  if (snapshot.access !== 'admin') throw new Error('OPS_ENTITY_REMOTE_ADMIN_ACCESS_REQUIRED');
  const wsUrl = String(snapshot.wsUrl || '').trim();
  if (!wsUrl) throw new Error('OPS_ENTITY_REMOTE_ENDPOINT_REQUIRED');
  const authKey = String(snapshot.sessionKey || '').trim();
  if (!authKey) throw new Error('OPS_ENTITY_REMOTE_AUTH_REQUIRED');
  return { wsUrl, authKey };
};

export const openOpsEntityRuntimeReadSession = async (
  snapshot: RuntimeAdapterStorageSnapshot,
): Promise<RuntimeReadSession> => {
  const config = requireOpsEntityRemoteSession(snapshot);
  await import('../../../../core/support/process/runtime-process.ts');
  const { RemoteRuntimeAdapter } = await import('../../../../core/api/runtime-adapter/remote.ts');
  const adapter = new RemoteRuntimeAdapter();
  try {
    await adapter.connect({ mode: 'remote', ...config });
  } catch (error: unknown) {
    adapter.disconnect();
    throw error;
  }
  return { adapter, release: () => adapter.disconnect() };
};

const unavailableSnapshot = (): OpsEntityWorkspaceSourceSnapshot => ({
  ...emptyOpsEntityWorkspaceProjection(),
  readState: {
    status: 'unavailable',
    message: 'Select a remote Runtime in the wallet before opening this candidate workspace.',
  },
  timeMachine: createEntityWorkspaceLiveState(0),
});

export const initialOpsEntityWorkspaceSnapshot = (
  config: RuntimeAdapterStorageSnapshot,
): OpsEntityWorkspaceSourceSnapshot => config.mode === 'remote'
  ? {
      ...emptyOpsEntityWorkspaceProjection(),
      readState: { status: 'connecting', message: 'Connecting to the selected Runtime…' },
      timeMachine: createEntityWorkspaceLiveState(0),
    }
  : unavailableSnapshot();

export class OpsEntityWorkspaceSource {
  private readonly listeners = new Set<() => void>();
  private snapshot: OpsEntityWorkspaceSourceSnapshot;
  private session: RuntimeReadSession | null = null;
  private observer: RuntimeQueryObserver<OpsEntityWorkspaceProjection> | null = null;
  private observerTeardown: (() => void) | null = null;
  private queryClient: OpsRuntimeQueryClient | null = null;
  private readonly historyController: OpsEntityWorkspaceHistoryController;
  private readonly activityController: OpsEntityWorkspaceActivityController;
  private generation = 0;
  private accountsPage = 0;
  private started = false;

  constructor(
    private readonly config: RuntimeAdapterStorageSnapshot,
    private readonly dependencies: OpsEntityWorkspaceSourceDependencies = {
      openSession: openOpsEntityRuntimeReadSession,
    },
  ) {
    this.snapshot = initialOpsEntityWorkspaceSnapshot(config);
    this.historyController = new OpsEntityWorkspaceHistoryController({
      publish: (snapshot) => this.publish(snapshot),
      readActivityBeforeHeight: () => this.activityController.readBeforeHeight(),
      readActivityKind: () => this.activityController.readKind(),
      readActivitySearch: () => this.activityController.readSearch(),
      readActivityTypes: () => this.activityController.readTypes(),
      readAccountsPage: () => this.accountsPage,
      readAdapter: () => this.session?.adapter ?? null,
      readClient: () => this.queryClient,
      readSnapshot: () => this.snapshot,
      refreshLive: () => { void this.observer?.refresh(); },
    });
    this.activityController = new OpsEntityWorkspaceActivityController({
      isHistoryActive: () => this.historyController.isActive(),
      refreshHistory: () => this.historyController.reload(),
      refreshLive: () => { void this.observer?.refresh(); },
    });
  }

  readonly getSnapshot = (): OpsEntityWorkspaceSourceSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly start = async (): Promise<void> => {
    if (this.started || this.config.mode !== 'remote') return;
    this.started = true;
    const generation = ++this.generation;
    this.publish({
      ...emptyOpsEntityWorkspaceProjection(),
      readState: { status: 'connecting', message: 'Connecting to the selected Runtime…' },
      timeMachine: createEntityWorkspaceLiveState(0),
    });
    try {
      const session = await this.dependencies.openSession(this.config);
      if (!this.isCurrent(generation)) {
        session.release();
        return;
      }
      this.session = session;
      this.installObserver(session.adapter);
    } catch (error: unknown) {
      if (!this.isCurrent(generation)) return;
      this.started = false;
      this.releaseRuntimeConnection();
      this.publish({
        ...emptyOpsEntityWorkspaceProjection(),
        readState: {
          status: 'error',
          message: error instanceof Error ? error.message : String(error || 'Runtime connection failed'),
        },
        timeMachine: createEntityWorkspaceLiveState(0),
      });
    }
  };

  readonly refresh = (): Promise<void> => this.observer?.refresh() ?? this.start();

  readonly selectAccountsPage = (page: number): void => {
    const accounts = this.snapshot.accounts;
    if (accounts.status !== 'selected' || !Number.isSafeInteger(page) || page < 0 || page >= accounts.pageCount) {
      throw new Error(`OPS_ENTITY_ACCOUNT_PAGE_INVALID:${String(page)}`);
    }
    if (page === this.accountsPage) return;
    this.accountsPage = page;
    if (this.historyController.isActive()) {
      this.historyController.reload();
    } else {
      void this.observer?.refresh();
    }
  };

  readonly selectActivityPage = (beforeHeight: number | null): void => {
    this.activityController.select(this.snapshot.activity, beforeHeight);
  };

  readonly selectNewerActivityPage = (): void => {
    this.activityController.selectNewer(this.snapshot.activity);
  };

  readonly selectActivityKind = (kind: EntityWorkspaceActivityKind): void => {
    this.activityController.selectKind(this.snapshot.activity, kind);
  };

  readonly toggleActivityType = (type: EntityWorkspaceActivityFilterType): void => {
    this.activityController.toggleType(this.snapshot.activity, type);
  };

  readonly selectActivitySearch = (search: string): void => {
    this.activityController.selectSearch(this.snapshot.activity, search);
  };

  readonly selectHistoryHeight = (height: number): Promise<boolean> => {
    this.activityController.resetPage();
    return this.historyController.select(height);
  };

  readonly returnLive = (): void => {
    this.activityController.resetPage();
    this.historyController.returnLive();
  };

  readonly stop = (): void => {
    this.started = false;
    this.accountsPage = 0;
    this.activityController.reset();
    this.historyController.reset();
    this.generation += 1;
    this.releaseRuntimeConnection();
    this.publish(initialOpsEntityWorkspaceSnapshot(this.config));
  };

  private installObserver(adapter: RuntimeAdapter): void {
    const client = new RuntimeQueryClient<RuntimeAdapterReadQuery, OpsRuntimeQueryResults>({
      resolveAdapter: () => adapter,
      readRuntimeId: () => adapter.runtimeId,
      readCurrentHeight: () => adapter.currentHeight,
      createEmptyQuery: () => ({}),
    });
    this.queryClient = client;
    this.publish({
      ...emptyOpsEntityWorkspaceProjection(adapter.runtimeId),
      readState: { status: 'loading', message: 'Reading the committed Entity context…' },
      timeMachine: createEntityWorkspaceLiveState(adapter.currentHeight),
    });
    const observer = new RuntimeQueryObserver(
      async () => {
        const frame = await client.readViewFrame({
          accountsLimit: 8,
          accountsPage: this.accountsPage,
          booksLimit: 1,
        });
        return readEntityWorkspaceProjection(
          client,
          adapter.runtimeId,
          frame,
          this.activityController.readBeforeHeight() ?? undefined,
          this.activityController.readKind(),
          this.activityController.readTypes(),
          this.activityController.readSearch(),
        );
      },
      {
        readHeight: () => adapter.currentHeight,
        subscribeHeight: (listener) => adapter.onChange(() => listener()),
        subscribeAdapter: (listener) => adapter.onStatus(() => listener()),
      },
    );
    this.observer = observer;
    this.observerTeardown = observer.subscribe(this.syncObserver);
    this.syncObserver();
  }

  private readonly syncObserver = (): void => {
    const observer = this.observer;
    const adapter = this.session?.adapter;
    if (!observer || !adapter) return;
    if (this.historyController.isActive()) {
      this.historyController.syncLatest();
      return;
    }
    const next = projectOpsEntityWorkspaceObserverSnapshot(
      adapter.runtimeId,
      {
        activity: this.snapshot.activity,
        accounts: this.snapshot.accounts,
        consensus: this.snapshot.consensus,
        context: this.snapshot.context,
        hubPolicy: this.snapshot.hubPolicy,
        ownership: this.snapshot.ownership,
        profile: this.snapshot.profile,
        reserves: this.snapshot.reserves,
      },
      observer.getSnapshot(),
      createEntityWorkspaceLiveState(adapter.currentHeight),
    );
    if (next.readState.status === 'error' && adapter.status === 'error') {
      this.started = false;
      this.generation += 1;
      this.releaseRuntimeConnection();
    }
    this.publish(next);
  };

  private releaseRuntimeConnection(): void {
    this.activityController.reset();
    this.observerTeardown?.();
    this.observerTeardown = null;
    this.observer?.destroy();
    this.observer = null;
    this.queryClient = null;
    this.historyController.reset();
    this.session?.release();
    this.session = null;
  }

  private isCurrent(generation: number): boolean {
    return this.started && generation === this.generation;
  }

  private publish(snapshot: OpsEntityWorkspaceSourceSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
