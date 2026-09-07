import type { RuntimeAdapter } from '../../../../../core/api/runtime-adapter/types';
import type { RuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import type { EntityWorkspaceProfileDraft } from '../../../../packages/runtime-client/src/entity/profile/entity-workspace-profile-update';
import {
  buildEntityWorkspaceProfileUpdateInput,
  normalizeEntityWorkspaceProfileDraft,
} from '../../../../packages/runtime-client/src/entity/profile/entity-workspace-profile-update';
import {
  RuntimeQueryObserver,
  type RuntimeQuerySnapshot,
} from '../../../../packages/runtime-client/src/runtime/query/runtime-query-observer';
import {
  abandonTerminalWalletPaymentCommand,
  executeWalletPaymentCommand,
  prepareWalletPaymentCommand,
  type WalletPreparedCommand,
} from '../payments/commands/wallet-payment-command';
import {
  createWalletRuntimeQueryClient,
  loadWalletRuntimeConnection,
  walletRuntimeReadErrorMessage,
  type WalletRuntimeConnectionLoader,
} from '../runtime/wallet-runtime-read-boundary';
import type { WalletWorkspaceSelection } from '../runtime/wallet-workspace-selection';
import { projectWalletProfileFrame, type WalletProfileProjection } from './wallet-profile-model';

type WalletProfileSourceSnapshot = Readonly<{
  busy: boolean;
  status: 'connecting' | 'loading' | 'ready' | 'error';
  message: string;
  projection: WalletProfileProjection | null;
}>;

type PendingProfileCommand = Readonly<{
  command: WalletPreparedCommand;
  entityId: string;
  expected: EntityWorkspaceProfileDraft;
}>;

const PROFILE_COMMIT_TIMEOUT_MS = 20_000;
const draftsEqual = (
  left: EntityWorkspaceProfileDraft,
  right: EntityWorkspaceProfileDraft,
): boolean => left.name === right.name
  && left.avatar === right.avatar
  && left.bio === right.bio
  && left.website === right.website;
const profileMatches = (
  projection: WalletProfileProjection | null,
  entityId: string,
  expected: EntityWorkspaceProfileDraft,
): boolean => projection?.profile.status === 'selected'
  && projection.context.status === 'selected'
  && projection.context.entityId === entityId
  && projection.profile.name === expected.name
  && projection.profile.avatar === expected.avatar
  && projection.profile.bio === expected.bio
  && projection.profile.website === expected.website;

export class WalletProfileSource {
  private readonly listeners = new Set<() => void>();
  private snapshot: WalletProfileSourceSnapshot = {
    busy: false, status: 'connecting', message: 'Connecting to the selected Runtime…', projection: null,
  };
  private adapter: RuntimeAdapter | null = null;
  private releaseAdapter: (() => void) | null = null;
  private observer: RuntimeQueryObserver<WalletProfileProjection> | null = null;
  private observerTeardown: (() => void) | null = null;
  private generation = 0;
  private started = false;
  private commandBusy = false;
  private pending: PendingProfileCommand | null = null;

  constructor(
    private readonly config: RuntimeAdapterStorageSnapshot,
    private readonly selection: WalletWorkspaceSelection,
    private readonly initialEntityId = '',
    private readonly loadRuntime: WalletRuntimeConnectionLoader = loadWalletRuntimeConnection,
  ) {}

  readonly getSnapshot = (): WalletProfileSourceSnapshot => this.snapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly start = async (): Promise<void> => {
    if (this.started) return;
    this.started = true;
    const generation = ++this.generation;
    try {
      const connection = await this.loadRuntime(this.config);
      if (!this.isCurrent(generation)) { connection.release(); return; }
      this.adapter = connection.adapter;
      this.releaseAdapter = connection.release;
      const selectedEntityId = this.selection.bindRuntime(connection.adapter.runtimeId);
      if (this.initialEntityId && this.initialEntityId !== selectedEntityId) {
        this.selection.selectEntity(connection.adapter.runtimeId, this.initialEntityId);
      }
      this.installObserver(connection.adapter);
    } catch (cause) {
      if (!this.isCurrent(generation)) return;
      this.started = false;
      this.releaseRuntime();
      this.publish({ busy: false, status: 'error', message: walletRuntimeReadErrorMessage(cause), projection: null });
    }
  };

  readonly stop = (): void => {
    this.started = false;
    this.generation += 1;
    this.releaseRuntime();
    this.publish({ busy: false, status: 'error', message: 'WALLET_PROFILE_SESSION_CHANGED', projection: null });
  };

  readonly refresh = (): Promise<void> => this.observer?.refresh() ?? this.start();

  readonly selectEntity = (entityId: string): void => {
    const adapter = this.requireAdapter();
    const projection = this.requireProjection();
    if (!projection.entities.some(entity => entity.entityId === entityId)) {
      throw new Error(`WALLET_PROFILE_ENTITY_UNKNOWN:${entityId}`);
    }
    if (projection.context.entityId === entityId) return;
    if (this.commandBusy || this.pending) throw new Error('WALLET_PROFILE_COMMAND_PENDING');
    this.selection.selectEntity(adapter.runtimeId, entityId);
    this.publish({ ...this.snapshot, busy: false, status: 'loading', message: 'Loading the selected identity…' });
    void this.observer?.refresh();
  };

  readonly saveProfile = async (draft: EntityWorkspaceProfileDraft): Promise<void> => {
    if (this.commandBusy) throw new Error('WALLET_PROFILE_COMMAND_IN_FLIGHT');
    const expected = normalizeEntityWorkspaceProfileDraft(draft);
    const projection = this.requireProjection();
    if (projection.context.status !== 'selected') throw new Error('WALLET_PROFILE_CONTEXT_REQUIRED');
    const entityId = projection.context.entityId;
    this.commandBusy = true;
    this.publish({ ...this.snapshot, busy: true });
    try {
      const pending = this.pending;
      if (pending) {
        if (pending.entityId !== entityId || !draftsEqual(pending.expected, expected)) {
          throw new Error('WALLET_PROFILE_PENDING_COMMAND_CHANGED');
        }
        await this.executePending(pending);
        return;
      }
      const adapter = this.requireAdapter();
      const generation = this.generation;
      const input = buildEntityWorkspaceProfileUpdateInput({
        entityId,
        signerId: projection.context.signerId ?? '',
      }, expected);
      const command = await prepareWalletPaymentCommand(adapter, input);
      if (!this.isCurrent(generation) || adapter !== this.adapter
        || entityId !== this.selection.getSnapshot().entityId) {
        throw new Error('WALLET_PROFILE_SESSION_CHANGED');
      }
      const next = { command, entityId, expected };
      this.pending = next;
      await this.executePending(next);
    } finally {
      this.commandBusy = false;
      this.publish({ ...this.snapshot, busy: false });
    }
  };

  private async executePending(pending: PendingProfileCommand): Promise<void> {
    try {
      const result = await executeWalletPaymentCommand(this.requireAdapter(), pending.command);
      await this.waitForCommit(pending.entityId, pending.expected, result.height + 1);
      if (pending.command.mode === 'remote' && result.status !== 'observed') {
        const observed = await executeWalletPaymentCommand(this.requireAdapter(), pending.command);
        if (observed.status !== 'observed') throw new Error('WALLET_PROFILE_COMMAND_NOT_OBSERVED');
      }
      if (this.pending === pending) this.pending = null;
    } catch (cause) {
      const failure = await abandonTerminalWalletPaymentCommand(pending.command, cause);
      if (failure.terminal && this.pending === pending) this.pending = null;
      throw cause;
    }
  }

  private waitForCommit(
    entityId: string,
    expected: EntityWorkspaceProfileDraft,
    minimumHeight: number,
  ): Promise<void> {
    const generation = this.generation;
    return new Promise((resolve, reject) => {
      let settled = false;
      let unsubscribe = (): void => {};
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribe();
        if (error) reject(error); else resolve();
      };
      const inspect = (): void => {
        if (!this.isCurrent(generation)) { finish(new Error('WALLET_PROFILE_SESSION_CHANGED')); return; }
        if (this.snapshot.status === 'error') {
          finish(new Error(`WALLET_PROFILE_READ_FAILED:${this.snapshot.message}`)); return;
        }
        if ((this.snapshot.projection?.context.height ?? 0) >= minimumHeight
          && profileMatches(this.snapshot.projection, entityId, expected)) finish();
      };
      const timeout = setTimeout(() => finish(new Error(
        `WALLET_PROFILE_COMMIT_TIMEOUT:target=${minimumHeight}:latest=${this.snapshot.projection?.context.height ?? 0}`,
      )), PROFILE_COMMIT_TIMEOUT_MS);
      unsubscribe = this.subscribe(inspect);
      inspect();
      void this.observer?.refresh();
    });
  }

  private installObserver(adapter: RuntimeAdapter): void {
    const client = createWalletRuntimeQueryClient(adapter);
    const observer = new RuntimeQueryObserver(async () => {
      const selected = this.selection.getSnapshot();
      if (selected.runtimeId && selected.runtimeId !== adapter.runtimeId) {
        throw new Error('WALLET_PROFILE_RUNTIME_CHANGED');
      }
      const frame = await client.readViewFrame({
        ...(selected.entityId ? { entityId: selected.entityId } : {}),
        accountsLimit: 1,
        booksLimit: 1,
      });
      const projection = projectWalletProfileFrame(adapter.runtimeId, frame);
      if (selected.entityId && projection.context.entityId !== selected.entityId) {
        throw new Error(`WALLET_WORKSPACE_ENTITY_MISMATCH:${selected.entityId}:${String(projection.context.entityId)}`);
      }
      return projection;
    }, {
      readHeight: () => adapter.currentHeight,
      subscribeHeight: listener => adapter.onChange(() => listener()),
      subscribeAdapter: listener => adapter.onStatus(() => listener()),
    });
    this.observer = observer;
    this.observerTeardown = observer.subscribe(this.syncObserver);
    this.syncObserver();
  }

  private readonly syncObserver = (): void => {
    const observer = this.observer;
    const adapter = this.adapter;
    if (!observer || !adapter) return;
    const observed: RuntimeQuerySnapshot<WalletProfileProjection> = observer.getSnapshot();
    if (observed.loading) {
      this.publish({ busy: this.commandBusy, status: 'loading', message: 'Reading the committed identity…', projection: observed.data });
      return;
    }
    if (observed.error || !observed.data) {
      this.publish({ busy: this.commandBusy, status: 'error', message: observed.error || 'Runtime returned no profile.', projection: null });
      return;
    }
    if (observed.data.context.status === 'selected') {
      this.selection.observeEntity(
        adapter.runtimeId,
        observed.data.context.entityId,
        observed.data.context.accountCount > 0,
      );
    }
    this.publish({ busy: this.commandBusy, status: 'ready', message: '', projection: observed.data });
  };

  private requireAdapter(): RuntimeAdapter {
    if (!this.adapter || this.adapter.status !== 'connected') throw new Error('WALLET_PROFILE_RUNTIME_NOT_CONNECTED');
    return this.adapter;
  }

  private requireProjection(): WalletProfileProjection {
    if (this.snapshot.status !== 'ready' || !this.snapshot.projection) {
      throw new Error('WALLET_PROFILE_VIEW_NOT_READY');
    }
    return this.snapshot.projection;
  }

  private releaseRuntime(): void {
    this.observerTeardown?.();
    this.observerTeardown = null;
    this.observer?.destroy();
    this.observer = null;
    this.releaseAdapter?.();
    this.releaseAdapter = null;
    this.adapter = null;
  }

  private isCurrent(generation: number): boolean {
    return this.started && generation === this.generation;
  }

  private publish(snapshot: WalletProfileSourceSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
