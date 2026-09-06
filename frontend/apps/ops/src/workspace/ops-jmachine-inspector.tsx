import { useEffect, useRef, useState } from 'react';
import { safeStringify } from '@xln/core/protocol/serialization';
import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import { readBrowserRuntimeEnvironment } from '../../../../bridges/browser-runtime-context';
import { useWorkspaceEnvironment } from './use-workspace-environment';

type ContractRow = Readonly<{ name: string; address: string; bytes: number | null; error: string }>;
const byteLength = (code: unknown): number => {
  if (typeof code === 'string' && /^0x([0-9a-f]{2})*$/i.test(code)) return (code.length - 2) / 2;
  if (code instanceof Uint8Array) return code.byteLength;
  throw new Error('Contract provider returned unsupported bytecode');
};
export function OpsJMachineInspector() {
  const context = useWorkspaceEnvironment();
  const machines = context.frame ? [...context.frame.state.jReplicas.values()] : [];
  const [selectedName, setSelectedName] = useState('');
  const selected = machines.find(machine => machine.name === selectedName) ?? machines[0] ?? null;
  const [result, setResult] = useState<{ adapter: RuntimeAdapter; machine: string; rows: ContractRow[] } | null>(null);
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const name = selected ? selected.name : '';
  useEffect(() => { generation.current += 1; setResult(null); setIssue(''); setBusy(false); return () => { generation.current += 1; }; }, [name, context.adapter, context.frame?.state.height, context.network.selectedStep]);
  const inspect = async (): Promise<void> => {
    if (!selected || context.historical || busy) return;
    const request = ++generation.current;
    setBusy(true); setIssue('');
    try {
      const adapter = context.adapter;
      if (!adapter || adapter.mode !== 'embedded') throw new Error('Bytecode inspection requires a local Runtime');
      const env = readBrowserRuntimeEnvironment(adapter);
      const provider = env?.infrastructure?.liveJAdapters?.get(selected.name)?.provider;
      if (!provider || !('getCode' in provider) || typeof provider.getCode !== 'function') throw new Error('Selected J-Machine has no readable contract provider');
      const contracts = selected.contracts;
      if (!contracts) throw new Error('Selected J-Machine has no configured contracts');
      const entries = [['Depository', contracts.depository], ['EntityProvider', contracts.entityProvider], ['Account', contracts.account], ['DeltaTransformer', contracts.deltaTransformer]] as const;
      const rows = await Promise.all(entries.flatMap(([name, address]) => address ? [{ name, address }] : []).map(async entry => {
        try { return { ...entry, bytes: byteLength(await provider.getCode(entry.address)), error: '' }; }
        catch (cause) { return { ...entry, bytes: null, error: cause instanceof Error ? cause.message : String(cause) }; }
      }));
      if (request !== generation.current) return;
      setResult({ adapter, machine: selected.name, rows });
      setIssue(rows.filter(row => row.error).map(row => `${row.name}: ${row.error}`).join('; '));
    } catch (cause) { if (request === generation.current) setIssue(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (request === generation.current) setBusy(false); }
  };
  const rows = result?.adapter === context.adapter && result?.machine === name ? result.rows : [];
  return <section className="ops-evidence-panel ops-jmachine-panel" data-testid="jmachine-storage-inspector">
    <header><h2>J-Machine Inspector</h2><select aria-label="Inspect J-Machine" value={name} onChange={event => setSelectedName(event.currentTarget.value)}>{machines.map(machine => <option key={machine.name}>{machine.name}</option>)}</select></header>
    {context.error || context.restriction ? <p role={context.error ? 'alert' : 'status'}>{context.error || context.restriction}</p> : !selected ? <p>No J-Machine in the selected frame.</p> : <>
      <dl className="ops-audit-metrics"><div><dt>J height</dt><dd>{String(selected.blockNumber)}</dd></div><div><dt>Mempool</dt><dd>{selected.mempool.length}</dd></div><div><dt>Chain ID</dt><dd>{selected.chainId}</dd></div><div><dt>Frame</dt><dd>{context.historical ? 'Recorded' : 'Live'}</dd></div></dl>
      <header><h3>Contract bytecode</h3><button disabled={busy || context.historical} onClick={() => { void inspect(); }} type="button">{busy ? 'Reading…' : 'Read code'}</button></header>
      {context.historical ? <p data-testid="jmachine-bytecode-history">Bytecode reads require Live. Contract code is not included in this recorded frame.</p> : null}
      {issue ? <p role="alert">{issue}</p> : null}
      <div className="ops-panel-table"><table><thead><tr><th>Contract</th><th>Address</th><th>Bytes / EIP-170</th></tr></thead><tbody>{!context.historical && rows.map(row => <tr key={row.name}><td data-label="Contract">{row.name}</td><td data-label="Address"><code>{row.address}</code></td><td data-label="Bytes / EIP-170" className={row.bytes !== null && row.bytes > 24576 ? 'is-error' : ''}>{row.bytes === null ? '—' : `${row.bytes.toLocaleString()} / 24,576`}</td></tr>)}</tbody></table></div>
      <details><summary>Raw J-Machine state</summary><pre className="ops-panel-json">{safeStringify({ name: selected.name, blockNumber: selected.blockNumber, stateRoot: selected.stateRoot, mempool: selected.mempool, blockDelayMs: selected.blockDelayMs, blockTimeMs: selected.blockTimeMs, lastBlockTimestamp: selected.lastBlockTimestamp, chainId: selected.chainId, rpcs: selected.rpcs, position: selected.position, contracts: selected.contracts }, 2)}</pre></details>
    </>}
  </section>;
}
