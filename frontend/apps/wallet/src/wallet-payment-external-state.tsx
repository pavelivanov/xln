import type { WalletExternalProviderSnapshot } from './wallet-external-provider-source';

export function WalletExternalProviderUnavailable({
  refresh,
  snapshot,
}: Readonly<{
  refresh: () => void;
  snapshot: WalletExternalProviderSnapshot;
}>) {
  return (
    <section className="wallet-payments-pane wallet-external-provider" aria-labelledby="wallet-external-title">
      <div className="wallet-payments-section-heading">
        <div><p>04</p><h2 id="wallet-external-title">External wallet</h2></div>
        <span>Local authority only</span>
      </div>
      <div className="wallet-external-state" role={snapshot.status === 'error' ? 'alert' : 'status'}>
        <strong>{snapshot.status === 'loading' ? 'Resolving provider' : 'Provider unavailable'}</strong>
        <p>{snapshot.message}</p>
        {snapshot.status !== 'loading' ? (
          <button onClick={refresh} type="button">Retry provider</button>
        ) : null}
      </div>
    </section>
  );
}
