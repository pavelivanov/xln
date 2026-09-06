import type { RuntimeAdapter, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import type { RuntimeAdapterStorageSnapshot } from '../../../packages/browser/src/runtime-adapter-session';
import {
  emptyOpsEntityWorkspaceProjection,
  projectOpsEntityWorkspaceActivityPage,
  projectOpsEntityWorkspaceFrame,
  projectOpsEntityWorkspaceObserverSnapshot,
  type OpsEntityWorkspaceProjection,
  type OpsEntityWorkspaceSourceSnapshot,
} from './ops-entity-workspace-projection';
import { RuntimeQueryObserver } from '../../../packages/runtime-client/src/runtime-query-observer';
import { projectRecordedEntity, type OpsWorkspaceRecording } from './workspace/ops-recorded-entity';
import {
  buildEntityWorkspaceActivityQuery,
  type EntityWorkspaceActivityFilterType,
  type EntityWorkspaceActivity,
  type EntityWorkspaceActivityKind,
  type EntityWorkspaceActivityMode,
  type EntityWorkspaceActivityPageSize,
  type EntityWorkspaceActivityQueryOptions,
} from '../../../packages/runtime-client/src/entity-workspace-activity';
import { createEntityWorkspaceLiveState } from '../../../packages/runtime-client/src/entity-workspace-time-machine';
import type { EntityWorkspaceProfileDraft } from '../../../packages/runtime-client/src/entity-workspace-profile-update';
import { OpsEntityWorkspaceActivityController } from './ops-entity-workspace-activity-controller';
import { OpsEntityWorkspaceHistoryController } from './ops-entity-workspace-history-controller';
import { OpsEntityWorkspaceProfileCommand } from './ops-entity-workspace-profile-command';
import {
  createOpsWorkspaceQueryClient,
  observeOpsWorkspaceQuery,
  type OpsWorkspaceQueryClient,
  type OpsWorkspaceReader,
} from './workspace/ops-workspace-query';

export type RuntimeReadSession = Readonly<{
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

const readEntityWorkspaceProjection = async (
  client: OpsWorkspaceQueryClient,
  runtimeId: string,
  frame: RuntimeAdapterViewFrame,
  activityOptions: EntityWorkspaceActivityQueryOptions = {},
  previousActivity?: EntityWorkspaceActivity,
  appendActivity = false,
): Promise<OpsEntityWorkspaceProjection> => {
  const projection = projectOpsEntityWorkspaceFrame(runtimeId, frame);
  if (projection.context.status === 'empty') return projection;
  const activityQuery = buildEntityWorkspaceActivityQuery(projection.context, activityOptions);
  const activity = await client.readActivity(activityQuery);
  return projectOpsEntityWorkspaceActivityPage(
    projection,
    activity,
    activityOptions,
    previousActivity,
    appendActivity,
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
  if (snapshot.mode === 'embedded') {
    const { startBrowserRuntime } = await import('../../../bridges/browser-runtime-session');
    return { adapter: await startBrowserRuntime(), release: () => {} };
  }
  const config = requireOpsEntityRemoteSession(snapshot);
  await import('../../../../core/support/process/runtime-process.ts');
  const [canonical, owner] = await Promise.all([
    import('../../../bridges/ops-canonical-owner'),
    import('./ops-entity-workspace-owner'),
  ]);
  return canonical.openCanonicalOpsRemoteSession({
    mode: 'remote', ...config, ownerBindingSigner: owner.signOpsEntityWorkspaceOwnerBinding,
  });
};

const unavailableSnapshot = (): OpsEntityWorkspaceSourceSnapshot => ({
  ...emptyOpsEntityWorkspaceProjection(),
  readState: {
    status: 'unavailable',
    message: 'Select a local or remote Runtime to open the workspace.',
  },
  timeMachine: createEntityWorkspaceLiveState(0),
});

export const initialOpsEntityWorkspaceSnapshot = (
  config: RuntimeAdapterStorageSnapshot,
): OpsEntityWorkspaceSourceSnapshot => config.mode === 'remote' || config.mode === 'embedded'
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
  private queryClient: OpsWorkspaceQueryClient | null = null;
  private readonly panelQueries = new Set<Readonly<{ destroy: () => void }>>();
  private readonly historyController: OpsEntityWorkspaceHistoryController;
  private readonly activityController: OpsEntityWorkspaceActivityController;
  private readonly profileCommand: OpsEntityWorkspaceProfileCommand;
  private generation = 0;
  private accountsPage = 0;
  private started = false;
  private recording: OpsWorkspaceRecording | null = null;
  private recordingRequest = 0;

  constructor(
    private config: RuntimeAdapterStorageSnapshot,
    private readonly dependencies: OpsEntityWorkspaceSourceDependencies = {
      openSession: openOpsEntityRuntimeReadSession,
    },
    private readonly entityId?: string,
  ) {
    this.snapshot = initialOpsEntityWorkspaceSnapshot(config);
    this.historyController = new OpsEntityWorkspaceHistoryController({
      cancelActivityAppend: (beforeHeight) => this.activityController.cancelAppend(beforeHeight),
      publish: (snapshot) => this.publish(snapshot),
      completeActivityAppend: (beforeHeight) => this.activityController.completeAppend(beforeHeight),
      readActivityAppendBeforeHeight: () => this.activityController.readAppendBeforeHeight(),
      readActivityOptions: () => this.activityController.readQueryOptions(),
      readAccountsPage: () => this.accountsPage,
      readAdapter: () => this.session?.adapter ?? null,
      readClient: () => this.queryClient,
      readSnapshot: () => this.snapshot,
      refreshLive: () => { void this.observer?.refresh(); },
    });
    this.activityController = new OpsEntityWorkspaceActivityController({
      isHistoryActive: () => this.recording !== null || this.historyController.isActive(),
      refreshHistory: () => { if (this.recording) this.refreshRecorded(); else this.historyController.reload(); },
      refreshLive: () => { void this.observer?.refresh(); },
    });
    this.profileCommand = new OpsEntityWorkspaceProfileCommand({
      isHistoryActive: () => this.recording !== null || this.historyController.isActive(),
      readAdapter: () => this.session?.adapter ?? null,
      readGeneration: () => this.generation,
      readSnapshot: () => this.snapshot,
      refresh: () => { void this.observer?.refresh(); },
      subscribe: this.subscribe,
    });
  }

  readonly getSnapshot = (): OpsEntityWorkspaceSourceSnapshot => this.snapshot;
  readonly getRecording = (): OpsWorkspaceRecording | null => this.recording;

  readonly setRecording = (recording: OpsWorkspaceRecording | null): void => {
    this.recordingRequest += 1;
    this.historyController.reset();
    this.recording = recording;
    this.accountsPage = 0;
    this.activityController.resetPage();
    if (recording) void this.refreshRecorded();
    else { this.publish(initialOpsEntityWorkspaceSnapshot(this.config)); void this.refresh(); }
  };

  private async refreshRecorded(): Promise<void> {
    const recording = this.recording;
    if (!recording) return;
    const request = ++this.recordingRequest;
    const latestHeight = recording.history.reduce((height, frame) => Math.max(height, frame.state.height), Math.max(recording.height, this.session?.adapter.currentHeight ?? 0));
    const timeMachine = { mode: 'history' as const, latestHeight, selectedHeight: recording.height, loading: false, error: null };
    try {
      const append = this.activityController.readAppendBeforeHeight();
      const options = this.activityController.readQueryOptions();
      let projection: OpsEntityWorkspaceProjection;
      if (recording.kind === 'adapter') {
        const client = this.queryClient;
        if (!client || this.session?.adapter.runtimeId !== recording.runtimeId) throw new Error('OPS_RECORDED_RUNTIME_NOT_CONNECTED');
        const selectedId = this.entityId ?? this.snapshot.context.entityId;
        const previousActivity = this.snapshot.activity;
        this.publish({ ...emptyOpsEntityWorkspaceProjection(recording.runtimeId), timeMachine: { ...timeMachine, loading: true }, readState: { status: 'loading', message: 'Reading the selected recorded Entity…' } });
        const frame = await client.readViewFrame({ ...(selectedId ? { entityId: selectedId } : {}), atHeight: recording.height, accountsLimit: 8, accountsPage: this.accountsPage, booksLimit: 1 });
        projection = await readEntityWorkspaceProjection(client, recording.runtimeId, frame, options, previousActivity, append !== null);
      } else projection = projectRecordedEntity(recording, this.entityId, this.accountsPage, options, this.snapshot, append !== null);
      if (request !== this.recordingRequest || recording !== this.recording) return;
      if (append !== null) this.activityController.completeAppend(append);
      this.publish({ ...projection, readState: { status: 'ready', message: '' }, timeMachine });
    } catch (cause) {
      if (request !== this.recordingRequest || recording !== this.recording) return;
      this.publish({ ...emptyOpsEntityWorkspaceProjection(recording.runtimeId), timeMachine,
        readState: { status: recording.kind === 'trail' ? 'unavailable' : 'error', message: cause instanceof Error ? cause.message : String(cause) } });
    }
  }

  readonly configure = (config: RuntimeAdapterStorageSnapshot): void => {
    this.stop();
    this.config = config;
    this.publish(initialOpsEntityWorkspaceSnapshot(config));
  };

  readonly getPanelClient = (): OpsWorkspaceQueryClient | null => this.queryClient;

  readonly getAdapter = (): RuntimeAdapter | null => this.session?.adapter ?? null;

  readonly observePanelQuery = <T>(reader: OpsWorkspaceReader<T>) => {
    if (!this.session || !this.queryClient) throw new Error('OPS_WORKSPACE_SESSION_UNAVAILABLE');
    const observer = observeOpsWorkspaceQuery(this.session.adapter, this.queryClient, reader);
    const destroy = (): void => {
      observer.destroy();
      this.panelQueries.delete(observer);
    };
    this.panelQueries.add(observer);
    return { getSnapshot: observer.getSnapshot, subscribe: observer.subscribe, refresh: observer.refresh, destroy };
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly start = async (): Promise<void> => {
    if (this.recording && this.recording.kind !== 'adapter') { await this.refreshRecorded(); return; }
    if (this.started || (this.config.mode !== 'remote' && this.config.mode !== 'embedded')) return;
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
      if (this.recording) await this.refreshRecorded();
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

  readonly refresh = (): Promise<void> => {
    if (this.recording) return this.refreshRecorded();
    return this.observer?.refresh() ?? this.start();
  };

  readonly verifyChain = async (client: OpsWorkspaceQueryClient, signal: AbortSignal): Promise<unknown> => {
    signal.throwIfAborted();
    const session = this.session;
    if (!session || client !== this.queryClient || session.adapter.status !== 'connected') {
      throw new Error('Runtime adapter is not connected.');
    }
    const result = await session.adapter.control('verify-chain');
    signal.throwIfAborted();
    if (session !== this.session || client !== this.queryClient) {
      throw new Error('OPS_WORKSPACE_RUNTIME_CHANGED');
    }
    return result;
  };

  readonly selectAccountsPage = (page: number): void => {
    const accounts = this.snapshot.accounts;
    if (accounts.status !== 'selected' || !Number.isSafeInteger(page) || page < 0 || page >= accounts.pageCount) {
      throw new Error(`OPS_ENTITY_ACCOUNT_PAGE_INVALID:${String(page)}`);
    }
    if (page === this.accountsPage) return;
    this.accountsPage = page;
    if (this.recording) {
      this.refreshRecorded();
    } else if (this.historyController.isActive()) {
      this.historyController.reload();
    } else {
      void this.observer?.refresh();
    }
  };

  readonly selectActivityPage = (beforeHeight: number | null): void => {
    this.activityController.select(this.snapshot.activity, beforeHeight);
  };

  readonly loadOlderActivity = (): void => {
    this.activityController.loadMore(this.snapshot.activity);
  };

  readonly refreshActivity = (): void => {
    this.activityController.reload(this.snapshot.activity);
  };

  readonly selectNewerActivityPage = (): void => {
    this.activityController.selectNewer(this.snapshot.activity);
  };

  readonly selectActivityKind = (kind: EntityWorkspaceActivityKind): void => {
    this.activityController.selectKind(this.snapshot.activity, kind);
  };

  readonly selectActivityMode = (mode: EntityWorkspaceActivityMode): void => {
    this.activityController.selectMode(this.snapshot.activity, mode);
  };

  readonly applyActivityTimeframe = (
    fromTimestamp: number | null,
    toTimestamp: number | null,
  ): void => {
    this.activityController.applyTimeframe(this.snapshot.activity, fromTimestamp, toTimestamp);
  };

  readonly selectActivityPageSize = (pageSize: EntityWorkspaceActivityPageSize): void => {
    this.activityController.selectPageSize(this.snapshot.activity, pageSize);
  };

  readonly toggleActivityType = (type: EntityWorkspaceActivityFilterType): void => {
    this.activityController.toggleType(this.snapshot.activity, type);
  };

  readonly selectActivitySearch = (search: string): void => {
    this.activityController.selectSearch(this.snapshot.activity, search);
  };

  readonly clearActivityFilters = (): void => {
    this.activityController.clearFilters(this.snapshot.activity);
  };

  readonly saveProfile = (draft: EntityWorkspaceProfileDraft): Promise<void> =>
    this.profileCommand.save(draft);

  readonly selectHistoryHeight = (height: number): Promise<boolean> => {
    this.activityController.resetPage();
    if (this.recording) return this.recording.selectHeight(height);
    return this.historyController.select(height);
  };

  readonly returnLive = (): void => {
    if (this.recording) { this.recording.returnLive(); return; }
    this.activityController.resetPage();
    this.historyController.returnLive();
  };

  readonly stop = (): void => {
    this.recordingRequest += 1;
    this.started = false;
    this.accountsPage = 0;
    this.activityController.reset();
    this.historyController.reset();
    this.generation += 1;
    this.releaseRuntimeConnection();
    this.publish(initialOpsEntityWorkspaceSnapshot(this.config));
  };

  private installObserver(adapter: RuntimeAdapter): void {
    const client = createOpsWorkspaceQueryClient(adapter);
    this.queryClient = client;
    this.publish({
      ...emptyOpsEntityWorkspaceProjection(adapter.runtimeId),
      readState: { status: 'loading', message: 'Reading the committed Entity context…' },
      timeMachine: createEntityWorkspaceLiveState(adapter.currentHeight),
    });
    const observer = new RuntimeQueryObserver(
      async () => {
        const frame = await client.readViewFrame({
          ...(this.entityId ? { entityId: this.entityId } : {}),
          accountsLimit: 8,
          accountsPage: this.accountsPage,
          booksLimit: 1,
        });
        const activityOptions = this.activityController.readQueryOptions();
        const appendBeforeHeight = this.activityController.readAppendBeforeHeight();
        return readEntityWorkspaceProjection(
          client,
          adapter.runtimeId,
          frame,
          activityOptions,
          this.snapshot.activity,
          appendBeforeHeight !== null && activityOptions.beforeHeight === appendBeforeHeight,
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
    if (this.recording) return;
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
    const appendBeforeHeight = this.activityController.readAppendBeforeHeight();
    if (next.readState.status === 'error' && appendBeforeHeight !== null) {
      this.activityController.cancelAppend(appendBeforeHeight);
    } else if (next.readState.status === 'ready' && next.activity.status === 'selected'
      && next.activity.mode === 'infinite' && next.activity.loadedPages > 1
      && next.activity.requestedBeforeHeight === appendBeforeHeight) {
      this.activityController.completeAppend(next.activity.requestedBeforeHeight);
    }
    if (next.readState.status === 'error' && adapter.status === 'error') {
      this.started = false;
      this.generation += 1;
      this.releaseRuntimeConnection();
    }
    this.publish(next);
  };

  private releaseRuntimeConnection(): void {
    for (const query of this.panelQueries) query.destroy();
    this.panelQueries.clear();
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
