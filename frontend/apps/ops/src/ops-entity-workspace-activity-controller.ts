import type { EntityWorkspaceActivity } from '../../../packages/runtime-client/src/entity-workspace-activity';

type ActivityControllerDependencies = Readonly<{
  isHistoryActive(): boolean;
  refreshHistory(): void;
  refreshLive(): void;
}>;

export class OpsEntityWorkspaceActivityController {
  private beforeHeight: number | null = null;

  constructor(private readonly dependencies: ActivityControllerDependencies) {}

  readonly readBeforeHeight = (): number | null => this.beforeHeight;

  readonly reset = (): void => {
    this.beforeHeight = null;
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
    this.beforeHeight = beforeHeight;
    if (this.dependencies.isHistoryActive()) this.dependencies.refreshHistory();
    else this.dependencies.refreshLive();
  };
}
