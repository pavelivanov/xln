import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AccountReplica, RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import { buildAccountDisputeView } from '../../../src/lib/components/Entity/account/account-focused-view';
import { WalletAccountViewSource } from './wallet-account-view-source';
import type { WalletAccountView } from './wallet-account-view-model';
import { WalletAccountToken } from './wallet-account-token';
import { useAccountAppearance } from './wallet-account-appearance-source';
import { navigateWallet } from './wallet-navigation';
import { WalletAccountActivity } from './wallet-account-activity';
import './styles/wallet-account-view.css';

function AccountDispute({ account, view, onWorkspace }: Readonly<{ account: AccountReplica; view: WalletAccountView; onWorkspace: () => void }>) {
  const [now, setNow] = useState(Date.now);
  const dispute = buildAccountDisputeView(account, view.replica, view.counterpartyId, now);
  const needsClock = dispute.hasObservedDisputeDeadline || dispute.pendingSecretAckInfo !== null;
  useEffect(() => {
    if (!needsClock) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [needsClock]);
  const ack = dispute.pendingSecretAckInfo;
  return <section className="wallet-account-dispute"><h2>Dispute</h2>
    {ack ? <p>Awaiting secret ACK: {ack.secondsLeft}s before auto-dispute start ({ack.count} route{ack.count === 1 ? '' : 's'}).</p> : null}
    {dispute.activeDispute ? <p>{dispute.hasObservedDisputeDeadline
      ? `Dispute active: ${dispute.disputeSecondsLeft}s left (until ${new Date(dispute.disputeTimeoutSeconds * 1000).toLocaleString()}).`
      : 'Dispute queued: awaiting on-chain inclusion and authoritative deadline.'}</p>
      : account.status === 'dispute_preparing' ? <p>Dispute prepared. Normal account traffic is frozen while evidence and orderbook cleanup settle.</p>
      : account.status === 'disputed' ? <p>Dispute queued. Open the batch panel and broadcast the pending dispute batch.</p>
      : <p>No active dispute.</p>}
    {account.status === 'disputed' ? <button type="button" data-testid="account-panel-open-accounts-workspace" onClick={onWorkspace}>Open Accounts Workspace</button> : null}
  </section>;
}

export function WalletFocusedAccount({ adapter, entityId, counterpartyId, onBack, onWorkspace }: Readonly<{
  adapter: RuntimeAdapter; entityId: string; counterpartyId: string; onBack: () => void; onWorkspace: () => void;
}>) {
  const appearance = useAccountAppearance();
  const [source] = useState(() => new WalletAccountViewSource(adapter, entityId, counterpartyId));
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  useEffect(() => { source.start(); return source.stop; }, [source]);
  const view = snapshot.data;
  const account = view?.account;
  const committed = account ? Number(account.currentFrame?.height ?? account.currentHeight ?? 0) > 0 : false;
  return <section className="wallet-account-view" data-testid="account-panel" data-counterparty-id={counterpartyId}>
    <div className="wallet-account-view-actions"><button type="button" data-testid="account-panel-back" onClick={onBack}>← Back to Entity</button>
      <button type="button" onClick={() => navigateWallet('/app#accounts/appearance')}>Appearance</button></div>
    <header className="wallet-account-heading"><p>Account</p><h1>{view?.counterpartyName || counterpartyId}</h1><code>{counterpartyId}</code>
      {view ? <span className="wallet-account-relay" data-status={view.relayStatus}>Relay {view.relayStatus}</span> : null}</header>
    {snapshot.error ? <div role="alert"><p>{snapshot.error}</p><button type="button" onClick={() => void source.refresh()}>Retry Account read</button></div> : null}
    {!view && snapshot.loading ? <p role="status">Reading Account…</p> : null}
    {snapshot.commandError ? <p className="wallet-account-error" role="alert">{snapshot.commandError}</p> : null}
    {snapshot.notice ? <p role="status">{snapshot.notice}</p> : null}
    {view && account ? <>
      {committed && view.tokens.length ? view.tokens.map(detail => <WalletAccountToken key={detail.tokenId} detail={detail} format={view.formatTokenAmount} appearance={appearance}
        commandsReady={view.commandsReady} busy={snapshot.fundingTokenId !== null} funding={snapshot.fundingTokenId === detail.tokenId} onFaucet={() => void source.faucet(detail.tokenId)} />)
        : <p>{committed ? 'No active token deltas in this account.' : 'Account is opening. Deltas will appear after first committed frame.'}</p>}
      <AccountDispute account={account} view={view} onWorkspace={onWorkspace} />
      <WalletAccountActivity view={view} />
    </> : null}
  </section>;
}
