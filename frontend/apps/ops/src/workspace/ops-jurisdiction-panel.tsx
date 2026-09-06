import { useState } from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { safeStringify } from '@xln/core/protocol/serialization';
import { formatJurisdictionStateRoot } from '../../../../packages/runtime-client/src/jurisdiction-panel-view';
import { useWorkspaceEnvironment } from './use-workspace-environment';
import { belongsToJurisdiction, jurisdictionTokenIds } from './ops-jurisdiction-view';
import { OpsJurisdictionBalances } from './ops-jurisdiction-balances';

export function OpsJurisdictionPanel({ params }: IDockviewPanelProps<{ jurisdictionName?: string }>) {
  const context = useWorkspaceEnvironment();
  const [machineName, setMachineName] = useState(params.jurisdictionName ?? '');
  const [replicaKey, setReplicaKey] = useState('');
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<'balances' | 'overview'>('balances');
  const machines = context.frame ? [...context.frame.state.jReplicas.values()] : [];
  const selected = machines.find(machine => machine.name === machineName) ?? (params.jurisdictionName ? undefined : machines[0]);
  const replicas = context.frame && selected ? [...context.frame.state.eReplicas].filter(([, replica]) => belongsToJurisdiction(replica, selected)) : [];
  const observer = replicas.find(([key]) => key === replicaKey) ?? replicas[0];
  const tokens = observer ? jurisdictionTokenIds(observer[1]) : [];
  const selectedToken = tokens.some(id => String(id) === token) ? token : '';
  return <section className="ops-evidence-panel ops-jurisdiction-panel" data-testid="workspace-jurisdiction">
    <header><h2>Jurisdiction</h2><select aria-label="Jurisdiction" value={selected?.name ?? ''} onChange={event => { setMachineName(event.currentTarget.value); setReplicaKey(''); setToken(''); }}>{machines.map(machine => <option key={machine.name}>{machine.name}</option>)}</select><span>{context.historical ? 'Recorded' : 'Live'}{context.frame ? ` · Runtime h${context.frame.state.height}` : ''}</span></header>
    {context.error || context.restriction ? <p role={context.error ? 'alert' : 'status'}>{context.error || context.restriction}</p> : !selected ? <p>No Jurisdiction in the selected frame.</p> : <>
      <nav aria-label="Jurisdiction views">{(['balances', 'overview'] as const).map(value => <button aria-pressed={tab === value} key={value} onClick={() => setTab(value)} type="button">{value === 'balances' ? 'Balances' : 'Overview'}</button>)}</nav>
      <dl className="ops-audit-metrics"><div><dt>Chain ID</dt><dd>{selected.chainId ?? 'Unavailable'}</dd></div><div><dt>J block</dt><dd>{selected.blockNumber.toString()}</dd></div><div><dt>Observers</dt><dd>{replicas.length}</dd></div></dl>
      {tab === 'overview' ? <>
        <h3>{selected.name}</h3><dl><dt>State root</dt><dd><code>{formatJurisdictionStateRoot(selected.stateRoot)}</code></dd><dt>Block delay</dt><dd>{selected.blockDelayMs} ms</dd><dt>Last block timestamp</dt><dd>{selected.lastBlockTimestamp}</dd><dt>Position</dt><dd>{selected.position.x}, {selected.position.y}, {selected.position.z}</dd></dl>
        <h3>Contracts</h3>{selected.contracts ? Object.entries(selected.contracts).map(([name, address]) => <p key={name}>{name}: <code>{address}</code></p>) : <p>No contract configuration.</p>}
        <details><summary>Pending J transactions ({selected.mempool.length})</summary><pre className="ops-panel-json">{safeStringify(selected.mempool, 2)}</pre></details>
      </> : <>
        <div className="ops-panel-controls"><label>Observing Entity<select aria-label="Jurisdiction observing Entity" value={observer?.[0] ?? ''} onChange={event => { setReplicaKey(event.currentTarget.value); setToken(''); }}>{replicas.map(([key, replica]) => <option key={key} value={key}>{replica.state.profile.name || replica.entityId} · {replica.signerId} · h{replica.state.height}</option>)}</select></label><label>Token<select aria-label="Jurisdiction token" value={selectedToken} onChange={event => setToken(event.currentTarget.value)}><option value="">All tokens</option>{tokens.map(id => <option value={id} key={id}>Token #{id}</option>)}</select></label></div>
        {observer ? <OpsJurisdictionBalances replica={observer[1]} tokenId={selectedToken === '' ? null : Number(selectedToken)} /> : <p>No Entity observations for this exact jurisdiction stack in the selected frame.</p>}
      </>}
    </>}
  </section>;
}
