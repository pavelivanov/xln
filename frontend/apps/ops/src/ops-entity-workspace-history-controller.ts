import type { RuntimeAdapter } from '../../../../core/api/runtime-adapter/types';
import type {
  EntityWorkspaceActivityFilterType,
  EntityWorkspaceActivityKind,
} from '../../../packages/runtime-client/src/entity-workspace-activity';
import {
  createEntityWorkspaceHistoryState,
  createEntityWorkspaceLiveState,
  requireEntityWorkspaceHistoryHeight,
  updateEntityWorkspaceLatestHeight,
} from '../../../packages/runtime-client/src/entity-workspace-time-machine';
import {
  readOpsEntityWorkspaceHistory,
  type OpsEntityWorkspaceHistoryReader,
} from './ops-entity-workspace-history';
import type { OpsEntityWorkspaceSourceSnapshot } from './ops-entity-workspace-projection';

type HistoryControllerDependencies = Readonly<{
  publish(snapshot: OpsEntityWorkspaceSourceSnapshot): void;
  readActivityBeforeHeight(): number | null;
  readActivityKind(): EntityWorkspaceActivityKind;
  readActivitySearch(): string;
  readActivityTypes(): readonly EntityWorkspaceActivityFilterType[];
  readAccountsPage(): number;
  readAdapter(): RuntimeAdapter | null;
  readClient(): OpsEntityWorkspaceHistoryReader | null;
  readSnapshot(): OpsEntityWorkspaceSourceSnapshot;
  refreshLive(): void;
}>;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'History read failed');

export class OpsEntityWorkspaceHistoryController {
  private fallbackSnapshot: OpsEntityWorkspaceSourceSnapshot | null = null;
  private request = 0;
  private selectedHeight: number | null = null;

  constructor(private readonly dependencies: HistoryControllerDependencies) {}

  readonly isActive = (): boolean => this.selectedHeight !== null;

  readonly reload = (): void => {
    if (this.selectedHeight !== null) void this.select(this.selectedHeight);
  };

  readonly reset = (): void => {
    this.fallbackSnapshot = null;
    this.request += 1;
    this.selectedHeight = null;
  };

  readonly returnLive = (): void => {
    const adapter = this.dependencies.readAdapter();
    this.reset();
    this.dependencies.publish({
      ...this.dependencies.readSnapshot(),
      readState: { status: 'loading', message: 'Returning to the live committed frame…' },
      timeMachine: createEntityWorkspaceLiveState(adapter?.currentHeight ?? 0),
    });
    this.dependencies.refreshLive();
  };

  readonly syncLatest = (): void => {
    const adapter = this.dependencies.readAdapter();
    if (!adapter || this.selectedHeight === null) return;
    const snapshot = this.dependencies.readSnapshot();
    this.dependencies.publish({
      ...snapshot,
      timeMachine: updateEntityWorkspaceLatestHeight(snapshot.timeMachine, adapter.currentHeight),
    });
  };

  readonly select = async (height: number): Promise<boolean> => {
    const adapter = this.dependencies.readAdapter();
    const client = this.dependencies.readClient();
    const previous = this.dependencies.readSnapshot();
    const context = previous.context;
    if (!adapter || !client || context.status !== 'selected') {
      throw new Error('OPS_ENTITY_HISTORY_CONTEXT_REQUIRED');
    }
    const latestHeight = Math.max(adapter.currentHeight, previous.timeMachine.latestHeight);
    const requestedHeight = requireEntityWorkspaceHistoryHeight(height, latestHeight);
    if (requestedHeight === latestHeight) {
      this.returnLive();
      return true;
    }
    if (this.selectedHeight === null || !previous.timeMachine.loading) {
      this.fallbackSnapshot = previous;
    }
    const fallback = this.fallbackSnapshot ?? previous;
    const request = ++this.request;
    this.selectedHeight = requestedHeight;
    this.dependencies.publish({
      ...previous,
      timeMachine: createEntityWorkspaceHistoryState({ latestHeight, loading: true, selectedHeight: requestedHeight }),
    });
    try {
      const activityBeforeHeight = this.dependencies.readActivityBeforeHeight();
      const projection = await readOpsEntityWorkspaceHistory({
        accountsPage: this.dependencies.readAccountsPage(), client,
        entityId: context.entityId, latestHeight, requestedHeight, runtimeId: adapter.runtimeId,
        ...(activityBeforeHeight === null ? {} : { activityBeforeHeight }),
        activityKind: this.dependencies.readActivityKind(),
        activitySearch: this.dependencies.readActivitySearch(),
        activityTypes: this.dependencies.readActivityTypes(),
      });
      if (!this.isCurrent(request, requestedHeight, client)) return false;
      const next: OpsEntityWorkspaceSourceSnapshot = {
        ...projection,
        readState: { status: 'ready', message: '' },
        timeMachine: createEntityWorkspaceHistoryState({
          latestHeight: Math.max(latestHeight, adapter.currentHeight),
          selectedHeight: requestedHeight,
        }),
      };
      this.fallbackSnapshot = next;
      this.dependencies.publish(next);
      return true;
    } catch (error: unknown) {
      if (!this.isCurrent(request, requestedHeight, client)) return false;
      this.selectedHeight = fallback.timeMachine.mode === 'history'
        ? fallback.timeMachine.selectedHeight
        : null;
      this.dependencies.publish({
        ...fallback,
        timeMachine: {
          ...updateEntityWorkspaceLatestHeight(fallback.timeMachine, adapter.currentHeight),
          error: errorMessage(error),
          loading: false,
        },
      });
      return false;
    }
  };

  private isCurrent(
    request: number,
    height: number,
    client: OpsEntityWorkspaceHistoryReader,
  ): boolean {
    return request === this.request
      && height === this.selectedHeight
      && client === this.dependencies.readClient();
  }
}
