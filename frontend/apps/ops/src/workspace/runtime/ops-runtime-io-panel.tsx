import { useState } from 'react';
import { RUNTIME_IO_ALL_CATEGORIES, RUNTIME_IO_ALL_LEVELS, RUNTIME_IO_DEFAULT_CATEGORIES, RUNTIME_IO_DEFAULT_LEVELS, filterRuntimeIoLogs, formatBigInt, mapToArray, runtimeIoLevelColors, sumRuntimeIoCollateral, sumRuntimeIoReserves, type LogCategory, type LogLevel } from '../../../../../packages/runtime-client/src/runtime/runtime-io-panel-view';
import { useWorkspaceEnvironment } from '../session/use-workspace-environment';

const toggle = <T,>(set: ReadonlySet<T>, value: T): Set<T> => new Set(set.has(value) ? [...set].filter(entry => entry !== value) : [...set, value]);
export function OpsRuntimeIoPanel() {
  const context = useWorkspaceEnvironment();
  const frame = context.frame;
  const [levels, setLevels] = useState<Set<LogLevel>>(RUNTIME_IO_DEFAULT_LEVELS);
  const [categories, setCategories] = useState<Set<LogCategory>>(RUNTIME_IO_DEFAULT_CATEGORIES);
  const [search, setSearch] = useState('');
  const logs = frame && 'logs' in frame ? frame.logs ?? [] : [];
  const filtered = filterRuntimeIoLogs(logs, levels, categories, search);
  return <section className="ops-evidence-panel" data-testid="workspace-runtime-io">
    <header><h2>Runtime State</h2>{frame ? <span>Frame {frame.state.height} · {frame.state.eReplicas.size} E-replicas · {frame.state.jReplicas.size} J-machines</span> : null}</header>
    {context.error || context.restriction ? <p role={context.error ? 'alert' : 'status'}>{context.error || context.restriction}</p> : frame ? <>
      <h3>R → E → A event stack</h3>
      {logs.length ? logs.map((log, index) => <details className="ops-io-detail" key={log.id} open={index < 10}><summary style={{ color: runtimeIoLevelColors[log.level] }}>#{log.id} · {log.category} · {log.message}</summary><p>{log.level}{log.data ? ' · Structured data present; use the typed activity projection for details.' : ''}</p></details>) : <p>No events in this frame.</p>}
      <dl className="ops-audit-metrics"><div><dt>Reserves (raw)</dt><dd>{sumRuntimeIoReserves(frame).toString()}</dd></div><div><dt>Collateral (raw)</dt><dd>{sumRuntimeIoCollateral(frame).toString()}</dd></div></dl>
      <h3>J-Machines ({frame.state.jReplicas.size})</h3>
      {[...frame.state.jReplicas.values()].map(machine => <details className="ops-io-detail" key={machine.name}><summary>{machine.name} · block {String(machine.blockNumber)}</summary><dl><dt>Chain ID</dt><dd>{machine.chainId}</dd><dt>State root</dt><dd><code>{machine.stateRoot}</code></dd></dl></details>)}
      <details open className="ops-io-detail"><summary>Frame Logs ({logs.length}) · {filtered.length} shown</summary><div className="ops-panel-controls">{RUNTIME_IO_ALL_LEVELS.map(level => <button aria-pressed={levels.has(level)} key={level} onClick={() => setLevels(current => toggle(current, level))} type="button">{level}</button>)}{RUNTIME_IO_ALL_CATEGORIES.map(category => <button aria-pressed={categories.has(category)} key={category} onClick={() => setCategories(current => toggle(current, category))} type="button">{category}</button>)}<input type="search" aria-label="Search Runtime logs" value={search} onChange={event => setSearch(event.currentTarget.value)} /></div><div className="ops-console-logs">{filtered.length ? filtered.map(log => <pre key={log.id} style={{ color: runtimeIoLevelColors[log.level] }}>[{log.level}] {log.category} · {log.message}{log.entityId ? ` · ${log.entityId}` : ''}</pre>) : <p>{logs.length ? 'No logs match filters.' : 'No logs in this frame.'}</p>}</div></details>
      <h3>E-Replicas ({frame.state.eReplicas.size})</h3>
      {[...frame.state.eReplicas].map(([id, replica]) => <details className="ops-io-detail" key={id}><summary>{replica.state.profile?.name || replica.entityId} · h{replica.state.height} · {replica.state.accounts.size} accounts</summary><dl><dt>Entity ID</dt><dd><code>{replica.entityId}</code></dd><dt>Signer</dt><dd><code>{replica.signerId}</code></dd><dt>J-Block</dt><dd>{replica.state.lastFinalizedJHeight}</dd></dl><h4>Reserves</h4>{mapToArray(replica.state.reserves).map(([token, amount]) => <p key={token}>Token {token}: <code>{formatBigInt(amount)}</code></p>)}<h4>Accounts (Bilateral)</h4>{mapToArray(replica.state.accounts).map(([peer, account]) => <p key={peer}><code>{peer}</code> · {account.state.deltas.size} deltas</p>)}<p>Mempool: {replica.mempool.length} txs</p></details>)}
    </> : null}
  </section>;
}
