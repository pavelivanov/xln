import type { RuntimeAdapter, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import type { AccountDropdownItem } from '../../../src/lib/components/Entity/account/account-dropdown-model';
import { RuntimeQueryObserver, type RuntimeQuerySnapshot } from '../../../packages/runtime-client/src/runtime-query-observer';
import { createWalletRuntimeQueryClient } from './wallet-runtime-read-boundary';

export function appendAccountDropdownPage(first: RuntimeAdapterViewFrame, next: RuntimeAdapterViewFrame): RuntimeAdapterViewFrame {
  if (!first.activeEntity || !next.activeEntity || next.activeEntityId !== first.activeEntityId || next.height !== first.height) {
    throw new Error('ACCOUNT_DROPDOWN_PAGE_CONTEXT_CHANGED');
  }
  const items = [...first.activeEntity.accounts.items, ...next.activeEntity.accounts.items];
  const identities = new Set(items.map(account => `${account.state.leftEntity}:${account.state.rightEntity}`));
  if (identities.size !== items.length) throw new Error('ACCOUNT_DROPDOWN_DUPLICATE_ACCOUNT');
  return { ...first, activeEntity: { ...first.activeEntity, accounts: { ...next.activeEntity.accounts, items } } };
}

export class WalletAccountDropdownSource {
  private snapshot: RuntimeQuerySnapshot<readonly AccountDropdownItem[]> = { loading: true, data: null, error: null, height: 0 };
  private readonly listeners = new Set<() => void>();
  private observer: RuntimeQueryObserver<readonly AccountDropdownItem[]> | null = null;
  private release = () => {};
  private lifetime = new AbortController();
  private readonly runtimeId: string;
  constructor(private readonly adapter: RuntimeAdapter, private readonly entityId: string) { this.runtimeId = adapter.runtimeId; }
  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private readonly read = async () => {
    const signal = this.lifetime.signal;
    const requireCurrent = () => {
      signal.throwIfAborted();
      if (this.adapter.runtimeId !== this.runtimeId) throw new Error('ACCOUNT_DROPDOWN_RUNTIME_CHANGED');
    };
    requireCurrent();
    const client = createWalletRuntimeQueryClient(this.adapter);
    const query = { entityId: this.entityId, accountsLimit: 25, booksLimit: 1 };
    let frame = await client.readViewFrame(query);
    requireCurrent();
    if (frame.activeEntityId !== this.entityId || !frame.activeEntity) throw new Error('ACCOUNT_DROPDOWN_ENTITY_MISMATCH');
    const cursors = new Set<string>();
    while (this.adapter.mode === 'remote' && frame.activeEntity?.accounts.nextCursor) {
      const cursor = frame.activeEntity.accounts.nextCursor;
      if (cursors.has(cursor)) throw new Error('ACCOUNT_DROPDOWN_CURSOR_REPEATED');
      cursors.add(cursor);
      const next = await client.readViewFrame({ ...query, accountsCursor: cursor });
      requireCurrent();
      frame = appendAccountDropdownPage(frame, next);
    }
    const bridge = await import('../../../bridges/wallet-canonical-hub-discovery');
    requireCurrent();
    const items = await bridge.readCanonicalAccountDropdown(this.adapter, this.entityId, frame);
    requireCurrent();
    return items;
  };
  readonly start = () => {
    if (this.observer) return;
    this.lifetime = new AbortController();
    const observer = new RuntimeQueryObserver(this.read, {
      readHeight: () => this.adapter.currentHeight,
      subscribeHeight: listener => this.adapter.onChange(listener),
      subscribeAdapter: listener => this.adapter.onStatus(listener),
    });
    this.observer = observer;
    this.release = observer.subscribe(() => {
      this.snapshot = observer.getSnapshot();
      for (const listener of this.listeners) listener();
    });
  };
  readonly refresh = async () => { await this.observer?.refresh(); };
  readonly stop = () => { this.lifetime.abort(); this.release(); this.observer?.destroy(); this.observer = null; };
}
