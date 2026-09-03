import type { RuntimeAdapter } from '../../../../core/api/runtime-adapter/types';
import type { RuntimeAdapterStorageSnapshot } from '../../../packages/browser/src/runtime-adapter-session';
import {
  RuntimeQueryObserver,
  type RuntimeQuerySnapshot,
} from '../../../packages/runtime-client/src/runtime-query-observer';
import {
  buildWalletAddressSummaryDetail,
  decodeWalletAddressDetail,
  decodeWalletAddressDirectory,
  isWalletAddressEntityId,
  normalizeWalletAddressEntityId,
  type WalletAddressDetail,
  type WalletAddressEntity,
  type WalletAddressRuntimeContext,
} from './wallet-address-model';
import {
  decodeWalletActivityHistory,
  type WalletHistoryEvent,
} from './wallet-financial-health-model';
import {
  createWalletRuntimeQueryClient,
  loadWalletRuntimeReadDependencies,
  walletRuntimeReadErrorMessage,
  type WalletRuntimeReadDependencies,
} from './wallet-runtime-read-boundary';

export type WalletAddressRequest =
  | Readonly<{ kind: 'directory' }>
  | Readonly<{ kind: 'detail'; entityId: string; requestedRuntimeId: string }>;

export type WalletAddressDirectoryProjection = Readonly<{
  kind: 'directory';
  runtimeId: string;
  height: number;
  entities: readonly WalletAddressEntity[];
}>;

export type WalletAddressDetailProjection = Readonly<{
  kind: 'detail';
  runtimeId: string;
  height: number;
  entity: WalletAddressDetail;
  history: readonly WalletHistoryEvent[];
  historyNextBeforeHeight: number | null;
  historyError: string;
  historyRuntimeMismatch: string;
  projectionNotice: string;
}>;

export type WalletAddressProjection = WalletAddressDirectoryProjection | WalletAddressDetailProjection;

export type WalletAddressSourceSnapshot = Readonly<{
  status: 'connecting' | 'loading' | 'ready' | 'error';
  message: string;
  projection: WalletAddressProjection | null;
}>;

const normalizeRuntimeId = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const runtimeContext = (adapter: RuntimeAdapter): WalletAddressRuntimeContext => ({
  runtimeId: normalizeRuntimeId(adapter.runtimeId),
  online: adapter.status === 'connected',
  height: Math.max(0, Math.floor(adapter.currentHeight)),
});

const snapshotFromObserver = (
  snapshot: RuntimeQuerySnapshot<WalletAddressProjection>,
): WalletAddressSourceSnapshot => {
  if (snapshot.loading) return {
    status: 'loading',
    message: 'Reading the selected Runtime directory…',
    projection: snapshot.data,
  };
  if (snapshot.error) return { status: 'error', message: snapshot.error, projection: null };
  if (!snapshot.data) return {
    status: 'error',
    message: 'Runtime returned no address projection.',
    projection: null,
  };
  return { status: 'ready', message: '', projection: snapshot.data };
};

const readHistory = async (
  dependencies: WalletRuntimeReadDependencies,
  entityId: string,
): Promise<Readonly<{
  history: readonly WalletHistoryEvent[];
  historyNextBeforeHeight: number | null;
  historyError: string;
}>> => {
  const client = createWalletRuntimeQueryClient(dependencies.adapter);
  try {
    const activity = await client.readActivity({
      entityId,
      kind: 'all',
      limit: 25,
      scanLimit: 250,
    });
    const history = decodeWalletActivityHistory(activity, dependencies.math);
    return {
      history: history.events,
      historyNextBeforeHeight: history.nextBeforeHeight,
      historyError: '',
    };
  } catch (error: unknown) {
    return {
      history: [],
      historyNextBeforeHeight: null,
      historyError: walletRuntimeReadErrorMessage(error),
    };
  }
};

export class WalletAddressSource {
  private readonly listeners = new Set<() => void>();
  private snapshot: WalletAddressSourceSnapshot;
  private adapter: RuntimeAdapter | null = null;
  private dependencies: WalletRuntimeReadDependencies | null = null;
  private observer: RuntimeQueryObserver<WalletAddressProjection> | null = null;
  private observerTeardown: (() => void) | null = null;
  private generation = 0;
  private started = false;

  constructor(
    private readonly config: RuntimeAdapterStorageSnapshot,
    private readonly request: WalletAddressRequest,
  ) {
    this.snapshot = {
      status: 'connecting',
      message: config.mode === 'remote'
        ? 'Connecting to the selected Runtime…'
        : 'Starting the local Runtime…',
      projection: null,
    };
  }

  readonly getSnapshot = (): WalletAddressSourceSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly start = async (): Promise<void> => {
    if (this.started) return;
    if (this.request.kind === 'detail' && !isWalletAddressEntityId(this.request.entityId)) {
      this.publish({
        status: 'error',
        message: 'Invalid entity id format. Expected 0x + 64 hex chars.',
        projection: null,
      });
      return;
    }
    this.started = true;
    const generation = ++this.generation;
    try {
      const dependencies = await loadWalletRuntimeReadDependencies(this.config);
      if (!this.isCurrent(generation)) {
        dependencies.release();
        return;
      }
      this.dependencies = dependencies;
      this.adapter = dependencies.adapter;
      this.installObserver(dependencies);
    } catch (error: unknown) {
      if (!this.isCurrent(generation)) return;
      this.started = false;
      this.releaseRuntimeConnection();
      this.publish({ status: 'error', message: walletRuntimeReadErrorMessage(error), projection: null });
    }
  };

  readonly refresh = (): Promise<void> => this.observer?.refresh() ?? this.start();

  readonly stop = (): void => {
    this.started = false;
    this.generation += 1;
    this.releaseRuntimeConnection();
  };

  private installObserver(dependencies: WalletRuntimeReadDependencies): void {
    const { adapter } = dependencies;
    const observer = new RuntimeQueryObserver(
      () => this.readProjection(dependencies),
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

  private async readProjection(
    dependencies: WalletRuntimeReadDependencies,
  ): Promise<WalletAddressProjection> {
    const { adapter } = dependencies;
    const client = createWalletRuntimeQueryClient(adapter);
    const context = runtimeContext(adapter);
    const entities = decodeWalletAddressDirectory(await client.readEntities({ limit: 5000 }), context);
    if (this.request.kind === 'directory') {
      return { kind: 'directory', runtimeId: context.runtimeId, height: context.height, entities };
    }
    const entityId = normalizeWalletAddressEntityId(this.request.entityId);
    const summary = entities.find((entity) => entity.entityId === entityId) ?? null;
    const requestedRuntimeId = normalizeRuntimeId(this.request.requestedRuntimeId);
    const summaryRuntimeId = normalizeRuntimeId(summary?.runtimeId);
    const mismatch = requestedRuntimeId && requestedRuntimeId !== context.runtimeId
      ? requestedRuntimeId
      : summaryRuntimeId && summaryRuntimeId !== context.runtimeId
        ? summaryRuntimeId
        : '';
    if (mismatch) {
      if (!summary) throw new Error(`WALLET_ADDRESS_RUNTIME_NOT_SELECTED:${mismatch}`);
      return {
        kind: 'detail', runtimeId: context.runtimeId, height: context.height,
        entity: buildWalletAddressSummaryDetail(summary), history: [],
        historyNextBeforeHeight: null, historyError: '', historyRuntimeMismatch: mismatch,
        projectionNotice: '',
      };
    }
    let detail: WalletAddressDetail | null = null;
    let projectionNotice = '';
    try {
      detail = decodeWalletAddressDetail(
        await client.readViewFrame({ entityId, accountsLimit: 8, booksLimit: 8 }),
        entityId,
        summary,
        context,
      );
    } catch (error: unknown) {
      projectionNotice = walletRuntimeReadErrorMessage(error);
      detail = summary ? buildWalletAddressSummaryDetail(summary) : null;
    }
    if (!detail) throw new Error('Entity not found in runtime projection.');
    const history = await readHistory(dependencies, entityId);
    return {
      kind: 'detail', runtimeId: context.runtimeId, height: context.height, entity: detail,
      ...history, historyRuntimeMismatch: '', projectionNotice,
    };
  }

  private readonly syncObserver = (): void => {
    if (!this.observer) return;
    const snapshot = snapshotFromObserver(this.observer.getSnapshot());
    if (snapshot.status === 'error' && this.adapter?.status === 'error') {
      this.started = false;
      this.generation += 1;
      this.releaseRuntimeConnection();
    }
    this.publish(snapshot);
  };

  private releaseRuntimeConnection(): void {
    this.observerTeardown?.();
    this.observerTeardown = null;
    this.observer?.destroy();
    this.observer = null;
    this.dependencies?.release();
    this.dependencies = null;
    this.adapter = null;
  }

  private isCurrent(generation: number): boolean {
    return this.started && generation === this.generation;
  }

  private publish(snapshot: WalletAddressSourceSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
