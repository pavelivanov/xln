import { useEffect, useState, useSyncExternalStore } from 'react';
import type { WalletAccountContext } from '../../../bridges/wallet-canonical-account-context';
import { RuntimeQueryObserver, type RuntimeQuerySnapshot } from '../../../packages/runtime-client/src/runtime-query-observer';
import { createWalletRuntimeQueryClient } from './wallet-runtime-read-boundary';
import type { WalletPaymentSource } from './wallet-payment-source';
import { appendAccountDropdownPage } from './wallet-account-dropdown-source';

class AccountContextSource {
  private observer: RuntimeQueryObserver<WalletAccountContext> | null = null;
  private release = () => {};
  private listeners = new Set<() => void>();
  private snapshot: RuntimeQuerySnapshot<WalletAccountContext> = { data: null, loading: true, error: null, height: 0 };
  constructor(private source: WalletPaymentSource, private entityId: string) {}
  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  readonly start = () => {
    const { adapter } = this.source.workspaceRuntime();
    const runtimeId = adapter.runtimeId;
    const read = async () => {
      const client = createWalletRuntimeQueryClient(adapter);
      const query = { entityId: this.entityId, accountsLimit: 200, booksLimit: 1 };
      let frame = await client.readViewFrame(query);
      if (frame.activeEntityId !== this.entityId || !frame.activeEntity) throw new Error('ACCOUNT_CONTEXT_ENTITY_CHANGED');
      const cursors = new Set<string>();
      while (frame.activeEntity && frame.activeEntity.accounts.nextCursor) {
        const cursor = frame.activeEntity.accounts.nextCursor;
        if (cursors.has(cursor)) throw new Error('ACCOUNT_CONTEXT_CURSOR_REPEATED');
        cursors.add(cursor);
        const next = await client.readViewFrame({ ...query, accountsCursor: cursor });
        frame = appendAccountDropdownPage(frame, next);
      }
      const bridge = await import('../../../bridges/wallet-canonical-account-context');
      if (adapter.runtimeId !== runtimeId) throw new Error('ACCOUNT_CONTEXT_RUNTIME_CHANGED');
      return bridge.readCanonicalAccountContext(adapter, this.entityId, frame);
    };
    this.observer = new RuntimeQueryObserver(read, { readHeight: () => adapter.currentHeight,
      subscribeHeight: listener => adapter.onChange(listener), subscribeAdapter: listener => adapter.onStatus(listener) });
    this.release = this.observer.subscribe(() => {
      if (!this.observer) return;
      this.snapshot = this.observer.getSnapshot();
      for (const listener of this.listeners) listener();
    });
  };
  readonly stop = () => { this.release(); this.observer?.destroy(); this.observer = null; };
}

export function useWalletAccountContext(source: WalletPaymentSource, entityId: string) {
  const [reader] = useState(() => new AccountContextSource(source, entityId));
  const snapshot = useSyncExternalStore(reader.subscribe, reader.getSnapshot, reader.getSnapshot);
  useEffect(() => { reader.start(); return reader.stop; }, [reader]);
  return snapshot;
}
