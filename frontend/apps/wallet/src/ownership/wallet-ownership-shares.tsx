import { useEffect, useState } from 'react';
import type { WalletOwnership } from '../../../../bridges/wallet/wallet-canonical-ownership';
import type { RuntimeQuerySnapshot } from '../../../../packages/runtime-client/src/runtime/query/runtime-query-observer';
import type { WalletPaymentSource } from '../payments/wallet-payment-source';
import { createWalletOwnershipSource } from './wallet-ownership-source';
import '../styles/wallet-ownership.css';

export function WalletOwnershipShares({ source, entityId, apiBase }: Readonly<{
  source: WalletPaymentSource; entityId: string; apiBase: string;
}>) {
  const [snapshot, setSnapshot] = useState<RuntimeQuerySnapshot<WalletOwnership>>({ data: null, loading: true, error: null, height: 0 });
  const [reader, setReader] = useState<ReturnType<typeof createWalletOwnershipSource> | null>(null);
  useEffect(() => {
    const next = createWalletOwnershipSource(source.workspaceRuntime().adapter, entityId, source.workspaceApiBase(apiBase));
    const unsubscribe = next.subscribe(() => setSnapshot(next.getSnapshot()));
    setSnapshot(next.getSnapshot());
    setReader(next);
    return () => { unsubscribe(); next.destroy(); };
  }, [source, entityId, apiBase]);
  const view = snapshot.data?.entityId === entityId ? snapshot.data : null;
  return <section className="wallet-ownership-shares" data-testid="ownership-shares" data-entity-id={entityId} aria-busy={snapshot.loading}>
    <header><strong>Entity shares</strong><button type="button" onClick={() => void reader?.refresh()}>Refresh shares</button></header>
    {snapshot.error ? <p role="alert">{snapshot.error}</p> : null}
    {snapshot.loading ? <p role="status">Reading committed shares…</p> : null}
    {view && !snapshot.loading ? <>
      {view.numbered ? <>
        <dl>{view.shares.map(share => <div key={share.shareClass}>
          <dt>{share.shareClass.toUpperCase()} · Entity reserve</dt>
          <dd data-testid={`ownership-${share.shareClass}-reserve`}>{share.reserve.toString()}</dd>
        </div>)}</dl>
        {!view.shares.some(share => share.reserve > 0n) ? <p>No shares in this Entity’s reserve.</p> : <p>To sell shares, move the amount into an Account with the chosen hub, then place a swap offer.</p>}
      </> : <p>Share issuance requires a numbered on-chain Entity ID.</p>}
      {view.confirmedNonce !== null ? <>
      <p data-testid="ownership-release-status">{view.pendingRelease
        ? `Share release pending · action ${view.pendingRelease.hash} · nonce ${view.pendingRelease.nonce}`
        : view.releaseBlocked ? 'Another EntityProvider action is pending.' : 'No pending share release.'}</p>
      <p data-testid="ownership-confirmed-nonce">Confirmed action nonce {view.confirmedNonce.toString()}</p>
      </> : view.numbered ? <p role="status">Share release status is not exposed by this Runtime read.</p> : null}
      <small>Committed height {view.height}</small>
    </> : null}
  </section>;
}
