import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import { RuntimeQueryObserver, type RuntimeQuerySnapshot } from '../../../packages/runtime-client/src/runtime-query-observer';
import { requestAccountFaucet } from '../../../src/lib/components/Entity/account/account-faucet-command';
import { createWalletRuntimeQueryClient, walletRuntimeReadErrorMessage } from './wallet-runtime-read-boundary';
import type { WalletAccountView } from './wallet-account-view-model';

export type WalletAccountViewSnapshot = RuntimeQuerySnapshot<WalletAccountView> & Readonly<{
  fundingTokenId: number | null; commandError: string; notice: string;
}>;

export class WalletAccountViewSource {
  private readonly listeners = new Set<() => void>();
  private observer: RuntimeQueryObserver<WalletAccountView> | null = null;
  private release = () => {};
  private releasePresentation = () => {};
  private lifetime = new AbortController();
  private readonly runtimeId: string;
  private snapshot: WalletAccountViewSnapshot = { data: null, loading: true, error: null, height: 0, fundingTokenId: null, commandError: '', notice: '' };
  constructor(private readonly adapter: RuntimeAdapter, private readonly entityId: string, private readonly counterpartyId: string) {
    this.runtimeId = adapter.runtimeId;
  }
  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(next: Partial<WalletAccountViewSnapshot>) { this.snapshot = { ...this.snapshot, ...next }; for (const listener of this.listeners) listener(); }
  private requireCurrent() {
    this.lifetime.signal.throwIfAborted();
    if (this.adapter.runtimeId !== this.runtimeId) throw new Error('ACCOUNT_VIEW_RUNTIME_CHANGED');
  }
  private readonly read = async () => {
    this.requireCurrent();
    const [bridge, frame] = await Promise.all([
      import('../../../bridges/wallet-canonical-hub-discovery'),
      createWalletRuntimeQueryClient(this.adapter).readViewFrame({ entityId: this.entityId, booksLimit: 1, accountsLimit: 200,
        ...(this.counterpartyId ? { accountId: this.counterpartyId } : {}) }),
    ]);
    this.requireCurrent();
    const data = await bridge.readCanonicalAccountView(this.adapter, this.entityId, this.counterpartyId, frame);
    this.requireCurrent();
    return data;
  };
  readonly start = () => {
    this.lifetime = new AbortController();
    this.observer = new RuntimeQueryObserver(this.read, {
      readHeight: () => this.adapter.currentHeight,
      subscribeHeight: listener => this.adapter.onChange(listener),
      subscribeAdapter: listener => this.adapter.onStatus(listener),
    });
    this.release = this.observer.subscribe(() => { if (this.observer) this.patch(this.observer.getSnapshot()); });
    const lifetime = this.lifetime;
    void import('../../../bridges/wallet-canonical-hub-discovery').then(bridge => {
      if (!lifetime.signal.aborted) this.releasePresentation = bridge.subscribeCanonicalAccountView(() => { void this.refresh(); });
    }, cause => { if (!lifetime.signal.aborted) this.patch({ loading: false, error: walletRuntimeReadErrorMessage(cause), data: null }); });
  };
  readonly refresh = async () => { await this.observer?.refresh(); };
  readonly stop = () => { this.lifetime.abort(); this.releasePresentation(); this.release(); this.observer?.destroy(); this.observer = null; };
  readonly faucet = async (tokenId: number) => {
    if (this.snapshot.fundingTokenId !== null) return;
    this.patch({ fundingTokenId: tokenId, commandError: '', notice: '' });
    try {
      const current = await this.read();
      const token = current.tokens.find(row => row.tokenId === tokenId);
      if (!token) throw new Error('ACCOUNT_FAUCET_TOKEN_UNAVAILABLE');
      const notice = await requestAccountFaucet({ apiBase: current.apiBase, entityId: this.entityId, runtimeId: current.faucetRuntimeId,
        hubEntityId: this.counterpartyId, tokenId, symbol: token.tokenInfo.symbol, commandsReady: current.commandsReady,
        sameJurisdiction: current.sameJurisdiction, signal: this.lifetime.signal });
      this.requireCurrent();
      this.patch({ notice });
      await this.refresh();
    } catch (cause) {
      if (!this.lifetime.signal.aborted) this.patch({ commandError: walletRuntimeReadErrorMessage(cause) });
    } finally { if (!this.lifetime.signal.aborted) this.patch({ fundingTokenId: null }); }
  };
}
