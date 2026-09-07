import { useEffect, useState, useSyncExternalStore } from 'react';
import { toEntityId } from '@xln/core/api/public/runtime-module';
import type { WalletOwnership } from '../../../../bridges/wallet/wallet-canonical-ownership';
import type { RuntimeQuerySnapshot } from '../../../../packages/runtime-client/src/runtime/query/runtime-query-observer';
import type { WalletPaymentSource } from '../payments/wallet-payment-source';
import { buildEntityShareReleaseInput, ENTITY_SHARE_SUPPLY } from '../../../../src/lib/components/Entity/ownership/ownership-flow';
import { createWalletOwnershipSource } from './wallet-ownership-source';
import '../styles/wallet-ownership.css';

export function WalletOwnershipShares({ source, entityId, signerId, depositoryAddress, commandsReady, commandReason, apiBase }: Readonly<{
  source: WalletPaymentSource;
  entityId: string;
  signerId: string;
  depositoryAddress: string;
  commandsReady: boolean;
  commandReason: string;
  apiBase: string;
}>) {
  const [snapshot, setSnapshot] = useState<RuntimeQuerySnapshot<WalletOwnership>>({ data: null, loading: true, error: null, height: 0 });
  const [reader, setReader] = useState<ReturnType<typeof createWalletOwnershipSource> | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const payment = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  useEffect(() => {
    const next = createWalletOwnershipSource(source.workspaceRuntime().adapter, entityId, source.workspaceApiBase(apiBase));
    const unsubscribe = next.subscribe(() => setSnapshot(next.getSnapshot()));
    setSnapshot(next.getSnapshot());
    setReader(next);
    return () => { unsubscribe(); next.destroy(); };
  }, [source, entityId, apiBase]);
  const view = snapshot.data?.entityId === entityId ? snapshot.data : null;
  const sharesReleased = view?.shares.some(share => share.reserve > 0n) ?? false;
  const releaseSubmitted = Boolean(view?.pendingRelease) || sharesReleased;
  const busy = payment.command.status === 'submitting' || payment.command.status === 'pending';
  const submitRelease = async () => {
    setError('');
    try {
      await source.submitEntityInput(buildEntityShareReleaseInput({
        entityId: toEntityId(entityId), signerId, depositoryAddress,
      }));
      setReviewing(false);
    } catch (cause: unknown) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Entity share issuance failed');
    }
  };
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
        {!sharesReleased ? <p>No shares in this Entity’s reserve.</p> : <p>To sell shares, move the amount into an Account with the chosen hub, then place a swap offer.</p>}
      </> : <p>Share issuance requires a numbered on-chain Entity ID.</p>}
      {view.confirmedNonce !== null ? <>
      <p data-testid="ownership-release-status">{view.pendingRelease
        ? `Share release pending · action ${view.pendingRelease.hash} · nonce ${view.pendingRelease.nonce}`
        : view.releaseBlocked ? 'Another EntityProvider action is pending.' : 'No pending share release.'}</p>
      <p data-testid="ownership-confirmed-nonce">Confirmed action nonce {view.confirmedNonce.toString()}</p>
      </> : view.numbered ? <p role="status">Share release status is not exposed by this Runtime read.</p> : null}
      <small>Committed height {view.height}</small>
      {view.numbered && !releaseSubmitted ? reviewing ? <div className="wallet-ownership-review" data-testid="ownership-release-review">
        <strong>Review share issuance</strong>
        <p>This submits one board action and releases both share classes into the Entity Depository reserve.</p>
        <dl>
          <div><dt>CONTROL</dt><dd>{ENTITY_SHARE_SUPPLY.toString()}</dd></div>
          <div><dt>DIVIDEND</dt><dd>{ENTITY_SHARE_SUPPLY.toString()}</dd></div>
          <div><dt>Recipient</dt><dd><code>{depositoryAddress}</code></dd></div>
        </dl>
        <div className="wallet-ownership-actions">
          <button type="button" onClick={() => { setReviewing(false); setError(''); }} disabled={busy}>Cancel</button>
          <button type="button" data-testid="ownership-release-submit" onClick={() => void submitRelease()} disabled={!commandsReady || busy}>Issue shares</button>
        </div>
      </div> : <button type="button" data-testid="ownership-release-shares" onClick={() => setReviewing(true)} disabled={!commandsReady || busy || view.releaseBlocked}>Review share issuance</button> : null}
      {!commandsReady && view.numbered && !releaseSubmitted ? <p role="status">{commandReason || 'Runtime commands are unavailable.'}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </> : null}
  </section>;
}
