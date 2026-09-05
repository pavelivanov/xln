import { normalizeEntityIdForRuntimeView } from '../../../packages/runtime-client/src/runtime-view-model';

export type WalletWorkspaceSelectionSnapshot = Readonly<{
  runtimeId: string;
  entityId: string;
  workspaceAccountId: string;
  focusedAccountId: string | null;
  hasAccounts: boolean;
}>;

const emptySelection = (runtimeId = ''): WalletWorkspaceSelectionSnapshot => ({
  runtimeId, entityId: '', workspaceAccountId: '', focusedAccountId: null, hasAccounts: false,
});

export const requireWalletWorkspaceEntity = <T extends { activeEntityId: string }>(
  projection: T,
  requestedEntityId: string,
): T => {
  if (requestedEntityId && projection.activeEntityId !== requestedEntityId) {
    throw new Error(`WALLET_WORKSPACE_ENTITY_MISMATCH:${requestedEntityId}:${projection.activeEntityId}`);
  }
  return projection;
};

// One instance belongs to one mounted wallet shell. It carries UI selection
// through route changes; it never persists state or owns a Runtime connection.
export class WalletWorkspaceSelection {
  private snapshot = emptySelection();
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = (): WalletWorkspaceSelectionSnapshot => this.snapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly bindRuntime = (runtimeId: string): string => {
    if (!runtimeId) throw new Error('WALLET_WORKSPACE_RUNTIME_REQUIRED');
    if (runtimeId !== this.snapshot.runtimeId) this.publish(emptySelection(runtimeId));
    return this.snapshot.entityId;
  };

  readonly selectEntity = (runtimeId: string, entityId: string): void => {
    this.requireRuntime(runtimeId);
    const normalized = normalizeEntityIdForRuntimeView(entityId);
    if (normalized === this.snapshot.entityId) return;
    this.publish({ ...emptySelection(runtimeId), entityId: normalized });
  };

  readonly observeEntity = (runtimeId: string, entityId: string, hasAccounts: boolean): void => {
    this.selectEntity(runtimeId, entityId);
    if (hasAccounts !== this.snapshot.hasAccounts) this.publish({ ...this.snapshot, hasAccounts });
  };

  readonly selectAccount = (runtimeId: string, entityId: string, accountId: string): void => {
    this.requireRuntime(runtimeId);
    if (!entityId || entityId !== this.snapshot.entityId) throw new Error('WALLET_WORKSPACE_ACCOUNT_ENTITY_MISMATCH');
    const normalized = normalizeEntityIdForRuntimeView(accountId);
    if (normalized !== this.snapshot.workspaceAccountId) this.publish({ ...this.snapshot, workspaceAccountId: normalized });
  };

  readonly focusAccount = (runtimeId: string, entityId: string, accountId: string): void => {
    this.selectAccount(runtimeId, entityId, accountId);
    this.publish({ ...this.snapshot, focusedAccountId: this.snapshot.workspaceAccountId || null });
  };

  readonly closeAccount = (): void => {
    if (this.snapshot.focusedAccountId) this.publish({ ...this.snapshot, focusedAccountId: null });
  };

  private requireRuntime(runtimeId: string): void {
    if (!runtimeId || runtimeId !== this.snapshot.runtimeId) throw new Error('WALLET_WORKSPACE_RUNTIME_MISMATCH');
  }

  private publish(snapshot: WalletWorkspaceSelectionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
