import type { RuntimeAdapterActivityPage } from '@xln/core/api/public/runtime-module';
import type { RuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import { createObservableStore } from '../../../../packages/runtime-client/src/observable-store';
import {
  RuntimeQueryObserver,
  type RuntimeQuerySnapshot,
} from '../../../../packages/runtime-client/src/runtime/query/runtime-query-observer';
import {
  projectionEventFromActivity,
  type RuntimeProjectionEvent,
} from '../../../../packages/ui/src/health/runtime-events';
import {
  openOpsEntityRuntimeReadSession,
  type RuntimeReadSession,
} from '../entity-workspace/ops-entity-workspace-source';
import {
  projectionEntityFromSummary,
  type ProjectionEntity,
} from '../../../../packages/ui/src/health/runtime-projections';
import { createOpsWorkspaceQueryClient } from '../workspace/session/ops-workspace-query';

export type OpsHealthEvents = Readonly<{
  runtimeId: string;
  activity: RuntimeAdapterActivityPage;
  events: readonly RuntimeProjectionEvent[];
  entities: readonly ProjectionEntity[];
}>;

const emptySnapshot = (): RuntimeQuerySnapshot<OpsHealthEvents> => ({
  loading: false,
  data: null,
  error: null,
  height: 0,
});

export class OpsHealthEventsSource {
  private readonly store = createObservableStore(emptySnapshot());
  private observer: RuntimeQueryObserver<OpsHealthEvents> | null = null;
  private session: RuntimeReadSession | null = null;
  private unsubscribe: (() => void) | null = null;
  private generation = 0;
  private config: RuntimeAdapterStorageSnapshot | null = null;
  private autoRefresh = true;
  private pendingStart: Promise<void> = Promise.resolve();

  readonly getSnapshot = this.store.get;
  readonly subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener);

  readonly start = async (config: RuntimeAdapterStorageSnapshot): Promise<void> => {
    this.stop();
    this.config = config;
    const generation = this.generation;
    if (config.mode !== 'embedded' && config.mode !== 'remote') {
      this.store.set({ ...emptySnapshot(), error: 'Select a Runtime in Wallet before reading its events.' });
      return;
    }
    this.store.set({ ...emptySnapshot(), loading: true });
    // Strict Mode setup/cleanup and selection changes may overlap a pending
    // canonical open. Serialize that effect and reject stale intent before it
    // can replace or disconnect the connection belonging to the next start.
    const opening = this.pendingStart.then(async () => {
      if (generation !== this.generation) return;
      try {
        const session = await openOpsEntityRuntimeReadSession(config);
        if (generation !== this.generation) {
          session.release();
          return;
        }
        this.session = session;
        const adapter = session.adapter;
        const client = createOpsWorkspaceQueryClient(adapter);
        const observer = new RuntimeQueryObserver(
          async () => {
            const runtimeId = adapter.runtimeId;
            const [activity, entities] = await Promise.all([
              client.readActivity({ limit: 1000, scanLimit: 1000 }),
              client.readEntities({ limit: 1000 }),
            ]);
            if (activity.runtimeId && activity.runtimeId !== runtimeId)
              throw new Error('OPS_HEALTH_ACTIVITY_RUNTIME_MISMATCH');
            return {
              runtimeId,
              activity,
              events: activity.events.map(projectionEventFromActivity),
              entities: entities.map(summary =>
                projectionEntityFromSummary(summary, {
                  id: runtimeId,
                  height: adapter.currentHeight,
                  status: adapter.status,
                  mode: adapter.mode,
                  authLevel: adapter.authLevel,
                }),
              ),
            };
          },
          {
            readHeight: () => adapter.currentHeight,
            subscribeHeight: listener =>
              adapter.onChange(() => {
                if (this.autoRefresh) listener();
              }),
            subscribeAdapter: listener => adapter.onStatus(() => listener()),
          },
        );
        this.observer = observer;
        this.unsubscribe = observer.subscribe(() => this.store.set(observer.getSnapshot()));
        this.store.set(observer.getSnapshot());
      } catch (error: unknown) {
        if (generation !== this.generation) return;
        this.store.set({ ...emptySnapshot(), error: error instanceof Error ? error.message : String(error) });
      }
    });
    this.pendingStart = opening;
    await opening;
  };

  readonly refresh = async (config: RuntimeAdapterStorageSnapshot): Promise<void> => {
    const selected = this.config;
    const sameSelection =
      selected &&
      selected.mode === config.mode &&
      selected.wsUrl === config.wsUrl &&
      selected.access === config.access &&
      selected.sessionKey === config.sessionKey;
    if (this.observer && sameSelection) await this.observer.refresh();
    else await this.start(config);
  };

  readonly setAutoRefresh = (enabled: boolean): void => {
    const changed = this.autoRefresh !== enabled;
    this.autoRefresh = enabled;
    if (changed && enabled) void this.observer?.refresh();
  };

  readonly stop = (): void => {
    this.generation += 1;
    this.config = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.observer?.destroy();
    this.observer = null;
    this.session?.release();
    this.session = null;
    this.store.set(emptySnapshot());
  };
}
