import type { EntityReplica } from '@xln/core/api/public/runtime-module';
import { useOpenWorkspaceEntity } from '../session/ops-workspace-navigation';

export function OpsJurisdictionBalances({ replica, tokenId }: { replica: EntityReplica; tokenId: number | null }) {
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
    <p>Entity-finalized observations · J block {state.lastFinalizedJHeight}. Amounts are exact raw token units.</p>
    <h3>Reserves</h3>
    <div className="ops-panel-table"><table aria-label="Jurisdiction reserves"><thead><tr><th>Token</th><th>Amount</th></tr></thead><tbody>{reserves.map(([id, amount]) => <tr key={id}><td data-label="Token">#{id}</td><td data-label="Amount">{amount.toString()}</td></tr>)}</tbody></table></div>
    {!reserves.length ? <p>No reserve observations for this selection.</p> : null}
    <h3>Account collateral</h3>
    <div className="ops-panel-table"><table aria-label="Jurisdiction collateral"><thead><tr><th>Peer</th><th>Token</th><th>Collateral</th><th>On-chain delta</th><th>J block</th></tr></thead><tbody>{collateral.map(row => <tr key={`${row.peer}:${row.id}`}><td data-label="Peer">{peerLink(row.peer)}</td><td data-label="Token">#{row.id}</td><td data-label="Collateral">{row.delta.collateral.toString()}</td><td data-label="On-chain delta">{row.delta.ondelta.toString()}</td><td data-label="J block">{row.height}</td></tr>)}</tbody></table></div>
    {!collateral.length ? <p>No collateral observations for this selection.</p> : null}
    <h3>Outgoing debts</h3>
    <div className="ops-panel-table"><table aria-label="Jurisdiction debts"><thead><tr><th>Creditor</th><th>Token</th><th>Remaining</th><th>J block</th></tr></thead><tbody>{debts.map(debt => <tr key={debt.debtId}><td data-label="Creditor">{peerLink(debt.creditor)}</td><td data-label="Token">#{debt.tokenId}</td><td data-label="Remaining">{debt.remainingAmount.toString()}</td><td data-label="J block">{debt.lastUpdatedBlock}</td></tr>)}</tbody></table></div>
    {!debts.length ? <p>No outgoing debt observations for this selection.</p> : null}
    <h3>External wallet observations</h3>
    <div className="ops-panel-table"><table aria-label="Jurisdiction external balances"><thead><tr><th>Owner</th><th>Token</th><th>Balance</th><th>J block</th></tr></thead><tbody>{balances.map(balance => <tr key={`${balance.owner}:${balance.tokenAddress}`}><td data-label="Owner"><code>{balance.owner}</code></td><td data-label="Token"><code>{balance.tokenId === undefined ? balance.tokenAddress : `#${balance.tokenId}`}</code></td><td data-label="Balance">{balance.balance.toString()}</td><td data-label="J block">{balance.jHeight}</td></tr>)}</tbody></table></div>
    {!balances.length ? <p>No finalized external wallet observations for this selection.</p> : null}
    <h3>Active disputes</h3>
    {disputes.length ? disputes.map(([peer, account]) => {
      const dispute = account.activeDispute;
      if (!dispute) throw new Error('JURISDICTION_DISPUTE_MISSING');
      return <article className="ops-io-detail" key={peer}>{peerLink(peer)}<p>Starter: {dispute.startedByLeft ? account.state.leftEntity : account.state.rightEntity}</p><p>Nonce {dispute.initialNonce} · deadline {dispute.disputeTimeout} (Unix seconds) · {dispute.observedOnChain === true ? 'Observed on chain' : 'Local pending observation'}</p></article>;
    }) : <p>No active disputes observed by this Entity.</p>}
  </>;
}
