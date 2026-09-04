import {
  requireEntityWorkspaceActivityKind,
  requireEntityWorkspaceActivityMode,
  requireEntityWorkspaceActivityPageSize,
  requireEntityWorkspaceActivityFilterType,
  requireEntityWorkspaceActivitySearch,
  requireEntityWorkspaceActivityTimeframe,
  type EntityWorkspaceActivity,
  type EntityWorkspaceActivityFilterType,
  type EntityWorkspaceActivityKind,
  type EntityWorkspaceActivityMode,
  type EntityWorkspaceActivityPageSize,
  type EntityWorkspaceActivityQueryOptions,
} from '../../../packages/runtime-client/src/entity-workspace-activity';

type ActivityControllerDependencies = Readonly<{
  isHistoryActive(): boolean;
  refreshHistory(): void;
  refreshLive(): void;
}>;

export class OpsEntityWorkspaceActivityController {
  private beforeHeight: number | null = null;
  private cursorIndex = 0;
  private cursorStack: readonly (number | null)[] = [null];
  private fromTimestamp: number | null = null;
  private kind: EntityWorkspaceActivityKind = 'all';
  private mode: EntityWorkspaceActivityMode = 'paged';
  private pageSize: EntityWorkspaceActivityPageSize = 8;
  private search = '';
  private toTimestamp: number | null = null;
  private types: readonly EntityWorkspaceActivityFilterType[] = [];

  constructor(private readonly dependencies: ActivityControllerDependencies) {}

  readonly readBeforeHeight = (): number | null => this.beforeHeight;
  readonly readFromTimestamp = (): number | null => this.fromTimestamp;
  readonly readKind = (): EntityWorkspaceActivityKind => this.kind;
  readonly readMode = (): EntityWorkspaceActivityMode => this.mode;
  readonly readPageSize = (): EntityWorkspaceActivityPageSize => this.pageSize;
  readonly readSearch = (): string => this.search;
  readonly readToTimestamp = (): number | null => this.toTimestamp;
  readonly readTypes = (): readonly EntityWorkspaceActivityFilterType[] => this.types;

  readonly readQueryOptions = (): EntityWorkspaceActivityQueryOptions => ({
    ...(this.beforeHeight === null ? {} : { beforeHeight: this.beforeHeight }),
    fromTimestamp: this.fromTimestamp,
    kind: this.kind,
    mode: this.mode,
    pageSize: this.pageSize,
    search: this.search,
    toTimestamp: this.toTimestamp,
    types: this.types,
  });

  private readonly resetCursor = (): void => {
    this.beforeHeight = null;
    this.cursorIndex = 0;
    this.cursorStack = [null];
  };

  private readonly refresh = (): void => {
    if (this.dependencies.isHistoryActive()) this.dependencies.refreshHistory();
    else this.dependencies.refreshLive();
  };

  readonly reload = (activity: EntityWorkspaceActivity): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_REFRESH_CONTEXT_REQUIRED');
    }
    this.refresh();
  };

  readonly reset = (): void => {
    this.resetCursor();
    this.fromTimestamp = null;
    this.kind = 'all';
    this.mode = 'paged';
    this.pageSize = 8;
    this.search = '';
    this.toTimestamp = null;
    this.types = [];
  };

  readonly resetPage = (): void => {
    this.resetCursor();
  };

  readonly select = (
    activity: EntityWorkspaceActivity,
    beforeHeight: number | null,
  ): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_PAGE_CONTEXT_REQUIRED');
    }
    if (beforeHeight !== null && beforeHeight !== activity.nextBeforeHeight) {
      throw new Error(`OPS_ENTITY_ACTIVITY_PAGE_INVALID:${String(beforeHeight)}`);
    }
    if (beforeHeight === null && activity.isLatestPage) return;
    if (beforeHeight === null) {
      this.resetCursor();
      this.refresh();
      return;
    }
    if (beforeHeight === this.beforeHeight) return;
    const nextIndex = this.cursorIndex + 1;
    if (this.cursorStack[nextIndex] !== beforeHeight) {
      this.cursorStack = [...this.cursorStack.slice(0, nextIndex), beforeHeight];
    }
    this.cursorIndex = nextIndex;
    this.beforeHeight = beforeHeight;
    this.refresh();
  };

  readonly selectNewer = (activity: EntityWorkspaceActivity): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_PAGE_CONTEXT_REQUIRED');
    }
    if (this.cursorIndex === 0) return;
    this.cursorIndex -= 1;
    this.beforeHeight = this.cursorStack[this.cursorIndex] ?? null;
    this.refresh();
  };

  readonly selectKind = (
    activity: EntityWorkspaceActivity,
    kind: EntityWorkspaceActivityKind,
  ): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_KIND_CONTEXT_REQUIRED');
    }
    const requestedKind = requireEntityWorkspaceActivityKind(kind);
    if (requestedKind === this.kind) return;
    this.kind = requestedKind;
    this.resetCursor();
    this.refresh();
  };

  readonly selectMode = (
    activity: EntityWorkspaceActivity,
    mode: EntityWorkspaceActivityMode,
  ): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_MODE_CONTEXT_REQUIRED');
    }
    const requestedMode = requireEntityWorkspaceActivityMode(mode);
    if (requestedMode === this.mode) return;
    this.mode = requestedMode;
    this.fromTimestamp = null;
    this.toTimestamp = null;
    this.resetCursor();
    this.refresh();
  };

  readonly applyTimeframe = (
    activity: EntityWorkspaceActivity,
    fromTimestamp: number | null,
    toTimestamp: number | null,
  ): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_TIMEFRAME_CONTEXT_REQUIRED');
    }
    if (this.mode !== 'timeframe') throw new Error('OPS_ENTITY_ACTIVITY_TIMEFRAME_MODE_REQUIRED');
    const timeframe = requireEntityWorkspaceActivityTimeframe({
      fromTimestamp, mode: this.mode, toTimestamp,
    });
    if (timeframe.fromTimestamp === this.fromTimestamp && timeframe.toTimestamp === this.toTimestamp) return;
    this.fromTimestamp = timeframe.fromTimestamp;
    this.toTimestamp = timeframe.toTimestamp;
    this.resetCursor();
    this.refresh();
  };

  readonly selectPageSize = (
    activity: EntityWorkspaceActivity,
    pageSize: EntityWorkspaceActivityPageSize,
  ): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_PAGE_SIZE_CONTEXT_REQUIRED');
    }
    const requestedPageSize = requireEntityWorkspaceActivityPageSize(pageSize);
    if (requestedPageSize === this.pageSize) return;
    this.pageSize = requestedPageSize;
    this.resetCursor();
    this.refresh();
  };

  readonly toggleType = (
    activity: EntityWorkspaceActivity,
    type: EntityWorkspaceActivityFilterType,
  ): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_TYPE_CONTEXT_REQUIRED');
    }
    const requestedType = requireEntityWorkspaceActivityFilterType(type);
    this.types = this.types.includes(requestedType)
      ? this.types.filter((candidate) => candidate !== requestedType)
      : [...this.types, requestedType];
    this.resetCursor();
    this.refresh();
  };

  readonly selectSearch = (activity: EntityWorkspaceActivity, search: string): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_SEARCH_CONTEXT_REQUIRED');
    }
    const requestedSearch = requireEntityWorkspaceActivitySearch(search);
    if (requestedSearch === this.search) return;
    this.search = requestedSearch;
    this.resetCursor();
    this.refresh();
  };

  readonly clearFilters = (activity: EntityWorkspaceActivity): void => {
    if (activity.status !== 'selected') {
      throw new Error('OPS_ENTITY_ACTIVITY_FILTER_CONTEXT_REQUIRED');
    }
    if (this.search.length === 0 && this.types.length === 0
      && this.fromTimestamp === null && this.toTimestamp === null && this.beforeHeight === null) return;
    this.fromTimestamp = null;
    this.search = '';
    this.toTimestamp = null;
    this.types = [];
    this.resetCursor();
    this.refresh();
  };
}
