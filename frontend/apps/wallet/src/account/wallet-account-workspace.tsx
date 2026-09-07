import { useWalletRuntimeLoader } from "../runtime/wallet-runtime-scope";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { readRuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import { WalletPaymentSource } from '../payments/wallet-payment-source';
import type { WalletPaymentProjection } from '../payments/wallet-payment-model';
import type { WalletWorkspaceSelection } from '../runtime/wallet-workspace-selection';
import { useWalletAccountContext } from './wallet-account-context';
import { WalletManage } from '../manage/wallet-manage';
import { WalletMove } from '../move/wallet-move';
import { WalletLending } from '../manage/wallet-lending';
import { WalletHistory } from '../history/wallet-history';
import { WalletPaymentBatch } from '../payments/commands/wallet-payment-batch';
import { WalletEntityEvidence } from '../entity/wallet-entity-evidence';
import { navigateWallet } from '../navigation/wallet-navigation';
import '../styles/account/wallet-account-workspace.css';

export type WalletAccountTool = 'configure' | 'move' | 'lending' | 'history' | 'ownership' | 'consensus';
const titles = { configure: 'Manage Account', move: 'Move', lending: 'Lending', history: 'History', ownership: 'Ownership', consensus: 'Consensus' };

function AccountTool({ tab, source, projection, selection }: Readonly<{
  tab: WalletAccountTool; source: WalletPaymentSource; projection: WalletPaymentProjection; selection: WalletWorkspaceSelection;
}>) {
  const snapshot = useWalletAccountContext(source, projection.activeEntityId);
  const payment = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  if (!snapshot.data) return <p role={snapshot.error ? 'alert' : 'status'}>{snapshot.error || 'Reading Account context…'}</p>;
  const context = { ...snapshot.data, commandsReady: snapshot.data.commandsReady && !snapshot.loading && !snapshot.error,
    commandReason: snapshot.loading ? 'Refreshing Account context…' : snapshot.data.commandReason };
  return <>
    <p className="wallet-account-jurisdiction">Jurisdiction: {context.jurisdiction || 'Unassigned'}</p>
    {snapshot.error ? <p role="alert">{snapshot.error}</p> : null}
    {tab === 'ownership' || tab === 'consensus' ? <WalletEntityEvidence context={context} tab={tab} source={source} /> : null}
    {tab === 'configure' ? <WalletManage context={context} source={source} selection={selection} /> : null}
    {tab === 'move' ? <WalletMove context={context} source={source} projection={projection} selection={selection} /> : null}
    {tab === 'lending' ? <WalletLending context={context} source={source} selection={selection} /> : null}
    {tab === 'history' ? <WalletHistory context={context} source={source} /> : null}
    {tab !== 'move' && tab !== 'ownership' && tab !== 'consensus' && (projection.batch.draft.length > 0 || projection.batch.sentHash) ? <WalletPaymentBatch projection={projection} snapshot={payment} source={source} /> : null}
  </>;
}

export function WalletAccountWorkspace({ entityId, tab, selection }: Readonly<{
  entityId: string; tab: WalletAccountTool; selection: WalletWorkspaceSelection;
}>) {
  const selected = useSyncExternalStore(selection.subscribe, selection.getSnapshot, selection.getSnapshot);
  const loadRuntime = useWalletRuntimeLoader();
  const [source] = useState(() => new WalletPaymentSource(readRuntimeAdapterStorageSnapshot({ durable: localStorage, session: sessionStorage }), selection, loadRuntime));
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const [error, setError] = useState('');
  useEffect(() => { void source.start(); return source.stop; }, [source]);
  const projection = snapshot.projection;
  const busy = snapshot.command.status === 'submitting' || snapshot.command.status === 'pending';
  useEffect(() => {
    if (!entityId || busy || snapshot.status !== 'ready' || projection?.activeEntityId === entityId) return;
    setError('');
    try { source.selectEntity(entityId); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [busy, entityId, projection?.activeEntityId, snapshot.status, source]);
  return <section className="wallet-account-workspace" aria-label={titles[tab]}>
    <header><p>{tab === 'ownership' || tab === 'consensus' ? 'Entity workspace' : 'Account workspace'}</p><h1>{titles[tab]}</h1></header>
    {projection ? <>
      <div className="wallet-account-context">
        <label>Entity<select aria-label="Entity" value={selected.entityId || projection.activeEntityId} disabled={busy} onChange={event => {
          const nextEntityId = event.target.value;
          source.selectEntity(nextEntityId);
          if (tab === 'ownership' || tab === 'consensus') {
            const route = tab === 'ownership' ? 'ownership' : 'settings/consensus';
            navigateWallet(`/app#${route}?entity=${encodeURIComponent(nextEntityId)}`);
          }
        }}>
          {projection.entities.map(entity => <option key={entity.entityId} value={entity.entityId}>{entity.label}</option>)}
        </select></label>
        <span>Committed height {projection.height}</span>
        <button type="button" onClick={() => void source.refresh()}>Refresh</button>
      </div>
      {snapshot.command.status !== 'idle' ? <div role={snapshot.command.status === 'error' ? 'alert' : 'status'} className="wallet-account-command">
        <strong>{snapshot.command.status}</strong><p>{snapshot.command.message}</p>
        {snapshot.command.retryable ? <button type="button" onClick={() => { void source.retryPendingCommand().catch(cause => setError(String(cause))); }}>Retry same command</button> : null}
      </div> : null}
      {error ? <p role="alert">{error}</p> : null}
      {selected.entityId && selected.entityId !== projection.activeEntityId ? <p role="status">Loading selected Entity…</p>
        : <AccountTool key={projection.activeEntityId} tab={tab} source={source} projection={projection} selection={selection} />}
    </> : <p role={snapshot.status === 'error' ? 'alert' : 'status'}>{snapshot.message}</p>}
  </section>;
}
