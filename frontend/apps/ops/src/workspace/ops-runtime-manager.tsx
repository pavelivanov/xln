import { useState, useSyncExternalStore } from 'react';
import { describeRemoteRuntimeImportError, normalizeRemoteRuntimeWsUrl, parseRemoteRuntimeImportText, readStoredRemoteRuntimeImports, type RemoteRuntimeImportEntry } from '../../../../src/lib/utils/onboarding/remoteRuntimeImport';
import { importRemoteRuntimeEntries } from '../../../../src/lib/utils/onboarding/remoteRuntimeImportFlow';
import { opsEntityWorkspaceSource } from '../ops-entity-workspace-runtime';
import { selectWorkspaceRuntime } from './ops-runtime-selection';

type Row = { label: string; status: string; detail: string };

export function OpsRuntimeManager() {
  const adapter = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getAdapter);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [label, setLabel] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [token, setToken] = useState('');
  const [bulk, setBulk] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [failed, setFailed] = useState<RemoteRuntimeImportEntry[]>([]);
  const [imports, setImports] = useState(() => readStoredRemoteRuntimeImports());
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const select = async (entry: Parameters<typeof selectWorkspaceRuntime>[0]): Promise<void> => {
    setWorking(true); setError('');
    try { await selectWorkspaceRuntime(entry); setStatus('Runtime selected'); }
    catch (cause) { setError(describeRemoteRuntimeImportError(cause)); }
    finally { setWorking(false); }
  };
  const attach = async (entries: RemoteRuntimeImportEntry[]): Promise<void> => {
    if (working) return;
    setWorking(true); setError(''); setFailed([]);
    setRows(entries.map(entry => ({ label: entry.label, status: 'pending', detail: 'waiting' })));
    setStatus(`Validating ${entries.length} runtime${entries.length === 1 ? '' : 's'}…`);
    try {
      const result = await importRemoteRuntimeEntries(entries, { activateFirst: false, onProgress: progress => {
        setRows(current => current.map((row, index) => index === progress.index ? { ...row, status: progress.status, detail: progress.detail } : row));
      } });
      setFailed(result.failed.map(item => item.entry));
      setError(result.failed.map(item => item.reason).join('\n'));
      setImports(result.persisted);
      const first = result.validated[0];
      if (!first) throw new Error('REMOTE_RUNTIME_IMPORT_EMPTY');
      await selectWorkspaceRuntime(first);
      setToken(''); setBulk('');
      setStatus(`Attached ${result.validated.length}/${entries.length}`);
    } catch (cause) {
      setFailed(entries); setError(describeRemoteRuntimeImportError(cause, entries[0])); setStatus('Attach failed');
    } finally { setWorking(false); }
  };
  const submit = (): void => {
    try {
      if (mode === 'bulk') { void attach(parseRemoteRuntimeImportText(bulk)); return; }
      const url = normalizeRemoteRuntimeWsUrl(wsUrl);
      if (!token.trim().startsWith('xlnra1.')) throw new Error('REMOTE_RUNTIME_IMPORT_TOKEN_INVALID:1');
      void attach([{ label: label.trim() || new URL(url).host, access: 'admin', wsUrl: url, token: token.trim() }]);
    } catch (cause) { setError(describeRemoteRuntimeImportError(cause)); }
  };
  return <section className="ops-evidence-panel ops-runtime-manager" data-testid="remote-runtime-manager">
    <header><h2>Runtime Manager</h2><div><button aria-pressed={mode === 'single'} disabled={working} onClick={() => setMode('single')} type="button">Attach</button><button aria-pressed={mode === 'bulk'} disabled={working} onClick={() => setMode('bulk')} type="button">Bulk</button></div></header>
    <p className="ops-selected-runtime">Selected: {adapter ? `${adapter.mode} · ${adapter.runtimeId}` : 'none'}</p>
    <button disabled={working} onClick={() => { void select('embedded'); }} type="button">Use browser Runtime</button>
    <form aria-label="Attach remote Runtime" onSubmit={event => { event.preventDefault(); submit(); }}>
      {mode === 'single' ? <><label>Label<input disabled={working} value={label} onChange={event => setLabel(event.currentTarget.value)} /></label>
        <label>WebSocket endpoint<input disabled={working} type="url" placeholder="ws://localhost:8080/rpc" value={wsUrl} onChange={event => setWsUrl(event.currentTarget.value)} required /></label>
        <label>Admin capability token<input autoComplete="off" disabled={working} type="password" value={token} onChange={event => setToken(event.currentTarget.value)} required /></label></>
        : <label>Runtime import list<textarea disabled={working} spellCheck={false} placeholder="Label | admin | ws://localhost:8080/rpc | xlnra1.…" value={bulk} onChange={event => setBulk(event.currentTarget.value)} required /></label>}
      <button disabled={working} type="submit">{working ? 'Validating…' : 'Validate & attach'}</button>
    </form>
    {failed.length > 0 ? <button disabled={working} onClick={() => { void attach(failed); }} type="button">Retry failed ({failed.length})</button> : null}
    {status ? <p role="status">{status}</p> : null}{error ? <pre role="alert">{error}</pre> : null}
    <div className="ops-runtime-import-rows">{rows.map((row, index) => <article key={index} data-status={row.status}><strong>{row.label}</strong><span>{row.status}</span><small>{row.detail}</small></article>)}</div>
    <h3>Attached Runtimes</h3>
    {imports.length === 0 ? <p>No remote Runtimes attached.</p> : imports.map(entry => <article className="ops-runtime-saved" key={entry.runtimeId}>
      <strong>{entry.label}</strong><code>{entry.runtimeId}</code><span>{entry.entityCount} entities · h{entry.height}</span>
      <button disabled={working} onClick={() => { void select(entry); }} type="button">Select {entry.label}</button>
    </article>)}
  </section>;
}
