import { useEffect, useState, useSyncExternalStore } from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { safeStringify } from '@xln/core/protocol/serialization';
import { getXLN } from '../../../../../src/lib/stores/bootstrap/xlnRuntimeLoader';
import { jmachineOperations, jmachineState } from '../../../../../src/lib/stores/network/jmachineStore';
import { buildJurisdictionTokenOptions, formatJurisdictionStateRoot, selectJurisdictionTokenIdText } from '../../../../../packages/runtime-client/src/panels/jurisdiction-panel-view';
import { useWorkspaceEnvironment } from '../session/use-workspace-environment';
import { belongsToJurisdiction, jurisdictionTokenIds } from './ops-jurisdiction-view';
import { OpsJurisdictionBalances } from './ops-jurisdiction-balances';
import { useOpsJurisdictionLive } from './ops-jurisdiction-live';
import { useWorkspaceTranslation } from '../../../../../bridges/workspace-localization-react';

export function OpsJurisdictionPanel({ params }: IDockviewPanelProps<{ jurisdictionName?: string }>) {
  const { t } = useWorkspaceTranslation();
  const context = useWorkspaceEnvironment();
  const [machineName, setMachineName] = useState(params.jurisdictionName ?? '');
  const [replicaKey, setReplicaKey] = useState('');
  const [token, setToken] = useState('');
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getXLN>> | null>(null);
  const [tab, setTab] = useState<'balances' | 'overview'>('balances');
  const machines = context.frame ? [...context.frame.state.jReplicas.values()] : [];
  const configured = useSyncExternalStore(jmachineState.subscribe, jmachineState.get);
  const preferredName = machineName || params.jurisdictionName || configured.activeJMachine || '';
  const selected = machines.find(machine => machine.name === preferredName) ?? (params.jurisdictionName ? undefined : machines[0]);
  const replicas = context.frame && selected ? [...context.frame.state.eReplicas].filter(([, replica]) => belongsToJurisdiction(replica, selected)) : [];
  const observer = replicas.find(([key]) => key === replicaKey) ?? replicas[0];
  const committedTokenIds = [...new Set(replicas.flatMap(([, replica]) => jurisdictionTokenIds(replica)))];
  const live = useOpsJurisdictionLive(context.adapter, selected, replicas.map(([, replica]) => replica), token === '' ? null : Number(token), context.historical);
  useEffect(() => { void getXLN().then(setCatalog); }, []);
  const tokenOptions = buildJurisdictionTokenOptions({ browserTokens: live.registry, reserveTokenIds: committedTokenIds, collateralTokenIds: [], getCatalogTokenInfo: id => catalog?.getTokenInfo(id) ?? { symbol: `TOKEN #${id}`, decimals: 0 } });
  const selectedToken = selectJurisdictionTokenIdText(tokenOptions, token);
  useEffect(() => { if (selectedToken !== token) setToken(selectedToken); }, [selectedToken, token]);
  return <section className="ops-evidence-panel ops-jurisdiction-panel" data-testid="workspace-jurisdiction">
    <header><h2>{t('workspace.jurisdiction')}</h2><select aria-label={t('workspace.jurisdiction')} value={selected?.name ?? ''} onChange={event => { const name = event.currentTarget.value; setMachineName(name); setReplicaKey(''); setToken(''); if (!context.historical && configured.configs.some(config => config.name === name)) jmachineOperations.setActive(name); }}>{machines.map(machine => <option key={machine.name}>{machine.name}</option>)}</select><span>{context.historical ? t('time.historical') : t('time.live')}{context.frame ? ` · Runtime h${context.frame.state.height}` : ''}</span></header>
    {context.error || context.restriction ? <p role={context.error ? 'alert' : 'status'}>{context.error || context.restriction}</p> : !selected ? <p>No {t('workspace.jurisdiction')} in the selected frame.</p> : <>
      <nav aria-label="Jurisdiction views">{(['balances', 'overview'] as const).map(value => <button aria-pressed={tab === value} key={value} onClick={() => setTab(value)} type="button">{value === 'balances' ? t('workspace.balances') : t('walletNavigation.Overview')}</button>)}</nav>
      <dl className="ops-audit-metrics"><div><dt>Chain ID</dt><dd>{selected.chainId ?? 'Unavailable'}</dd></div><div><dt>J block</dt><dd>{selected.blockNumber.toString()}</dd></div><div><dt>Observers</dt><dd>{replicas.length}</dd></div></dl>
      {tab === 'overview' ? <>
        <h3>{selected.name}</h3><dl><dt>State root</dt><dd><code>{formatJurisdictionStateRoot(selected.stateRoot)}</code></dd><dt>Block delay</dt><dd>{selected.blockDelayMs} ms</dd><dt>Last block timestamp</dt><dd>{selected.lastBlockTimestamp}</dd><dt>Position</dt><dd>{selected.position.x}, {selected.position.y}, {selected.position.z}</dd></dl>
        <h3>Contracts</h3>{selected.contracts ? Object.entries(selected.contracts).map(([name, address]) => <p key={name}>{name}: <code>{address}</code></p>) : <p>No contract configuration.</p>}
        <details><summary>Pending J transactions ({selected.mempool.length})</summary><pre className="ops-panel-json">{safeStringify(selected.mempool, 2)}</pre></details>
      </> : <>
        <div className="ops-panel-controls"><label>Observing Entity<select aria-label="Jurisdiction observing Entity" value={observer?.[0] ?? ''} onChange={event => { setReplicaKey(event.currentTarget.value); }}>{replicas.map(([key, replica]) => <option key={key} value={key}>{replica.state.profile.name || replica.entityId} · {replica.signerId} · h{replica.state.height}</option>)}</select></label><label>Token<select aria-label="Jurisdiction token" value={selectedToken} onChange={event => setToken(event.currentTarget.value)}>{tokenOptions.length ? tokenOptions.map(option => <option value={option.tokenId} key={option.tokenId}>{option.symbol} · #{option.tokenId}</option>) : <option value="">No tokens</option>}</select></label></div>
        {live.registryIssue ? <p role="alert" data-testid="jurisdiction-token-registry-error">Token registry unavailable: {live.registryIssue}</p> : null}
        {context.historical ? <p>Recorded token labels use committed token IDs; the live registry was not queried.</p> : null}
        {observer ? <OpsJurisdictionBalances replica={observer[1]} tokenId={selectedToken === '' ? null : Number(selectedToken)} liveBalances={live.balances} liveDebts={live.debts} liveIssue={live.readIssue} liveLoading={live.loading} historical={context.historical} onRefresh={live.reload} /> : <p>No Entity observations for this exact jurisdiction stack in the selected frame.</p>}
      </>}
    </>}
  </section>;
}
