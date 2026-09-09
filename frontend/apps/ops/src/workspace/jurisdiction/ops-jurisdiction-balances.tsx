import type { EntityReplica } from '@xln/core/api/public/runtime-module';
import { useOpenWorkspaceEntity } from '../session/ops-workspace-navigation';
import type { OpsChainDebt, OpsExternalBalance } from './ops-jurisdiction-live';
import { useWorkspaceTranslation } from '../../../../../bridges/workspace-localization-react';

export function OpsJurisdictionBalances({ replica, tokenId, liveBalances, liveDebts, liveIssue, liveLoading, historical, onRefresh }: {
  replica: EntityReplica;
  tokenId: number | null;
  liveBalances: readonly OpsExternalBalance[];
  liveDebts: readonly OpsChainDebt[];
  liveIssue: string;
  liveLoading: boolean;
  historical: boolean;
  onRefresh: () => void;
}) {
  const { t } = useWorkspaceTranslation();
  const openEntity = useOpenWorkspaceEntity();
  const state = replica.state;
  const accepts = (id: number): boolean => tokenId === null || id === tokenId;
  const reserves = [...state.reserves].filter(([id]) => accepts(id));
  const collateral = [...state.accounts].flatMap(([peer, account]) => [...account.state.deltas]
    .filter(([id]) => accepts(id)).map(([id, delta]) => ({ peer, id, delta, height: account.state.lastFinalizedJHeight })));
  const debts = [...(state.outDebtsByToken ?? [])].filter(([id]) => accepts(id)).flatMap(([, entries]) => [...entries.values()]);
  const balances = [...(state.externalWallet?.balances ?? [])].flatMap(([owner, entries]) => [...entries.values()]
    .filter(balance => tokenId === null || balance.tokenId === tokenId).map(balance => ({ owner, ...balance })));
  const disputes = [...state.accounts].filter(([, account]) => account.activeDispute !== undefined);
  const peerLink = (id: string) => <button className="ops-jurisdiction-address" disabled={!openEntity} onClick={() => openEntity?.(id, id)} type="button">{id}</button>;
  return <>
    <p>{t('view.labels.entity')}-finalized observations · J block {state.lastFinalizedJHeight}. Amounts are exact raw token units.</p>
    <h3>{t('network.reserves')}</h3>
    <div className="ops-panel-table"><table aria-label={`${t('workspace.jurisdiction')} ${t('network.reserves')}`}><thead><tr><th>Token</th><th>{t('network.balance')}</th></tr></thead><tbody>{reserves.map(([id, amount]) => <tr key={id}><td data-label="Token">#{id}</td><td data-label={t('network.balance')}>{amount.toString()}</td></tr>)}</tbody></table></div>
    {!reserves.length ? <p>No reserve observations for this selection.</p> : null}
    <h3>{t('view.labels.account')} collateral</h3>
    <div className="ops-panel-table"><table aria-label="Jurisdiction collateral"><thead><tr><th>Peer</th><th>Token</th><th>Collateral</th><th>On-chain delta</th><th>J block</th></tr></thead><tbody>{collateral.map(row => <tr key={`${row.peer}:${row.id}`}><td data-label="Peer">{peerLink(row.peer)}</td><td data-label="Token">#{row.id}</td><td data-label="Collateral">{row.delta.collateral.toString()}</td><td data-label="On-chain delta">{row.delta.ondelta.toString()}</td><td data-label="J block">{row.height}</td></tr>)}</tbody></table></div>
    {!collateral.length ? <p>No collateral observations for this selection.</p> : null}
    <h3>Outgoing debts</h3>
    <div className="ops-panel-table"><table aria-label="Jurisdiction debts"><thead><tr><th>Creditor</th><th>Token</th><th>Remaining</th><th>J block</th></tr></thead><tbody>{debts.map(debt => <tr key={debt.debtId}><td data-label="Creditor">{peerLink(debt.creditor)}</td><td data-label="Token">#{debt.tokenId}</td><td data-label="Remaining">{debt.remainingAmount.toString()}</td><td data-label="J block">{debt.lastUpdatedBlock}</td></tr>)}</tbody></table></div>
    {!debts.length ? <p>No outgoing debt observations for this selection.</p> : null}
    <h3>External {t('workspace.wallet')} observations</h3>
    <div className="ops-panel-table"><table aria-label={`${t('workspace.jurisdiction')} external balances`}><thead><tr><th>Owner</th><th>Token</th><th>{t('network.balance')}</th><th>J block</th></tr></thead><tbody>{balances.map(balance => <tr key={`${balance.owner}:${balance.tokenAddress}`}><td data-label="Owner"><code>{balance.owner}</code></td><td data-label="Token"><code>{balance.tokenId === undefined ? balance.tokenAddress : `#${balance.tokenId}`}</code></td><td data-label={t('network.balance')}>{balance.balance.toString()}</td><td data-label="J block">{balance.jHeight}</td></tr>)}</tbody></table></div>
    {!balances.length ? <p>No finalized external wallet observations for this selection.</p> : null}
    <header><h3>Fresh external chain balances</h3><button disabled={historical || liveLoading} onClick={onRefresh} type="button">{liveLoading ? 'Reading…' : `${t('common.refresh')} chain reads`}</button></header>
    {historical ? <p data-testid="jurisdiction-chain-history">Recorded frames never query or time-travel the live provider.</p> : null}
    {liveIssue ? <p role="alert">{liveIssue}</p> : null}
    {!historical ? <div className="ops-panel-table"><table aria-label="Fresh external balances"><thead><tr><th>{t('view.labels.entity')}</th><th>Signer</th><th>Token</th><th>Native</th></tr></thead><tbody>{liveBalances.map(row => <tr key={row.signerId}><td data-label={t('view.labels.entity')}>{row.label}</td><td data-label="Signer"><code>{row.signerId}</code></td><td data-label="Token">{row.token?.toString() ?? 'Unavailable'}</td><td data-label="Native">{row.native?.toString() ?? 'Unavailable'}</td></tr>)}</tbody></table></div> : null}
    {!historical && !liveLoading && !liveBalances.length ? <p>No signer balances returned by the selected stack.</p> : null}
    <h3>Fresh on-chain debts</h3>
    {!historical && tokenId === null ? <p>Select one token to read its exact on-chain debts.</p> : null}
    {!historical && tokenId !== null ? <div className="ops-panel-table"><table aria-label="Fresh on-chain debts"><thead><tr><th>Debtor</th><th>Creditor</th><th>Amount</th></tr></thead><tbody>{liveDebts.map((debt, index) => <tr key={`${debt.debtor}:${debt.creditor}:${index}`}><td data-label="Debtor">{debt.debtorLabel}</td><td data-label="Creditor">{peerLink(debt.creditor)}</td><td data-label="Amount">{debt.amount.toString()}</td></tr>)}</tbody></table></div> : null}
    {!historical && tokenId !== null && !liveLoading && !liveDebts.length ? <p>No outstanding debts returned by the selected stack.</p> : null}
    <h3>Active disputes</h3>
    {disputes.length ? disputes.map(([peer, account]) => {
      const dispute = account.activeDispute;
      if (!dispute) throw new Error('JURISDICTION_DISPUTE_MISSING');
      return <article className="ops-io-detail" key={peer}>{peerLink(peer)}<p>Starter: {dispute.startedByLeft ? account.state.leftEntity : account.state.rightEntity}</p><p>Nonce {dispute.initialNonce} · deadline {dispute.disputeTimeout} (Unix seconds) · {dispute.observedOnChain === true ? 'Observed on chain' : 'Local pending observation'}</p></article>;
    }) : <p>No active disputes observed by this Entity.</p>}
  </>;
}
