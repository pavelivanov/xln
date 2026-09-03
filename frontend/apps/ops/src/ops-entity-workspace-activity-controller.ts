import {
  requireEntityWorkspaceActivityKind,
  requireEntityWorkspaceActivityFilterType,
  type EntityWorkspaceActivity,
  type EntityWorkspaceActivityFilterType,
  type EntityWorkspaceActivityKind,
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
  private kind: EntityWorkspaceActivityKind = 'all';
  private types: readonly EntityWorkspaceActivityFilterType[] = [];

  constructor(private readonly dependencies: ActivityControllerDependencies) {}

  readonly readBeforeHeight = (): number | null => this.beforeHeight;
  readonly readKind = (): EntityWorkspaceActivityKind => this.kind;
  readonly readTypes = (): readonly EntityWorkspaceActivityFilterType[] => this.types;

  private readonly resetCursor = (): void => {
    this.beforeHeight = null;
    this.cursorIndex = 0;
    this.cursorStack = [null];
  };

  private readonly refresh = (): void => {
    if (this.dependencies.isHistoryActive()) this.dependencies.refreshHistory();
    else this.dependencies.refreshLive();
  };

  readonly reset = (): void => {
    this.resetCursor();
    this.kind = 'all';
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
}
