import { useWalletRuntimeLoader } from "../runtime/wallet-runtime-scope";
import { useEffect, useState, useSyncExternalStore } from 'react';

import { readRuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import { WalletFinancialHealthSource } from './wallet-financial-health-source';
import type { WalletDebtGroup } from './wallet-financial-health-model';
import type { WalletWorkspaceSelection } from '../runtime/wallet-workspace-selection';
import {
  WalletDebtSection,
  WalletDisputesSection,
  WalletHistorySection,
  WalletSolvencySection,
} from './wallet-financial-health-sections';
import '../styles/financial/wallet-financial-health.css';
import '../styles/financial/wallet-financial-health-states.css';
import '../styles/financial/wallet-financial-health-responsive.css';

function HealthUnavailable({
  error,
  message,
  retry,
}: Readonly<{ error: boolean; message: string; retry: () => void }>) {
  return (
    <section className="wallet-health-unavailable" role={error ? 'alert' : 'status'}>
      <p className="wallet-shell-eyebrow">Committed health unavailable</p>
      <h2>No financial-health data is being shown.</h2>
      <p>{message}</p>
      <div>
        {error ? <button onClick={retry} type="button">Retry Runtime read</button> : null}
        <a href="/app?diagnostics=1">Review diagnostics</a>
      </div>
    </section>
  );
}

export function WalletFinancialHealth({ workspaceSelection }: Readonly<{ workspaceSelection: WalletWorkspaceSelection }>) {
  const { entityId } = useSyncExternalStore(workspaceSelection.subscribe, workspaceSelection.getSnapshot, workspaceSelection.getSnapshot);
  const loadRuntime = useWalletRuntimeLoader();
  const [source] = useState(() => new WalletFinancialHealthSource(
    readRuntimeAdapterStorageSnapshot({ durable: localStorage, session: sessionStorage }),
    workspaceSelection,
    loadRuntime,
  ));
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);

  useEffect(() => {
    void source.start();
    return source.stop;
  }, [source]);

  const projection = snapshot.projection;
  const command = source.getCommandSnapshot();
  const enforceDebt = (group: WalletDebtGroup): void => {
    const confirmed = window.confirm(
      `Enforce ${group.payableLabel} of ${group.outstandingLabel} ${group.symbol} debt for the selected Entity?`,
    );
    if (confirmed) void source.enforceDebt(group);
  };
  return (
    <section className="wallet-health" aria-labelledby="wallet-health-title">
      <header className="wallet-health-heading">
        <p className="wallet-shell-eyebrow">Committed financial evidence</p>
        <h1 id="wallet-health-title">Financial health</h1>
        <p>Debt, conservation evidence, Account dispute gates, and persisted Runtime activity.</p>
      </header>
      {projection ? (
        <>
          <div className="wallet-health-context">
            <label htmlFor="wallet-health-entity">Entity</label>
            <select id="wallet-health-entity" onChange={(event) => source.selectEntity(event.target.value)} value={entityId || projection.activeEntityId}>
              {projection.entities.map((entity) => <option key={entity.entityId} value={entity.entityId}>{entity.label}</option>)}
            </select>
            <span>Committed height {projection.height}</span>
            <button disabled={snapshot.status === 'loading'} onClick={() => void source.refresh()} type="button">
              {snapshot.status === 'loading' ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {entityId && entityId !== projection.activeEntityId ? <p role="status">Loading selected Entity…</p> : <>
          <WalletDebtSection
                activeEntityId={projection.activeEntityId}
                busy={command.status === 'submitting'}
                enforce={enforceDebt} groups={projection.debtGroups} />
          {command.status !== 'idle' ? (<p
                  className={`wallet-health-command is-${command.status}`}
                  role={command.status === 'error' ? 'alert' : 'status'}
                >
                  {command.message}
                </p>
              ) : null}
              <WalletSolvencySection projection={projection} />
          <WalletDisputesSection busy={snapshot.status === 'loading'} projection={projection} selectPage={source.selectAccountsPage} />
          <WalletHistorySection busy={snapshot.status === 'loading'} projection={projection} newer={source.selectNewerHistory} older={source.selectOlderHistory} />
          </>}
        </>
      ) : <HealthUnavailable error={snapshot.status === 'error'} message={snapshot.message} retry={() => void source.refresh()} />}
      <p className="wallet-health-boundary">
        This surface reads committed projections. Unchecked solvency is never presented as balanced; the only write is
        an explicit, reviewed FIFO debt-enforcement Runtime command.
      </p>
    </section>
  );
}
