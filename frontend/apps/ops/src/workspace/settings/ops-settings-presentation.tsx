import { useState, useSyncExternalStore } from 'react';
import { safeStringify } from '@xln/core/protocol/serialization';
import { parseNetworkMachineConfig } from '../../../../../src/lib/network3d/networkMachine';
import { networkMachineConfig, networkMachineOperations } from '../../../../../src/lib/stores/network/networkMachineStore';
import { applyWorkspacePresentation } from '../session/ops-workspace-playback';

export function OpsSettingsPresentation() {
  const config = useSyncExternalStore(networkMachineConfig.subscribe, networkMachineConfig.get);
  const [draft, setDraft] = useState(() => networkMachineOperations.exportJson());
  const [issue, setIssue] = useState(''), [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const apply = async (text: string): Promise<void> => {
    setIssue(''); setStatus(''); setBusy(true);
    try {
      await applyWorkspacePresentation(parseNetworkMachineConfig(text));
      setDraft(networkMachineOperations.exportJson());
      setStatus('Presentation config applied. Runtime history is unchanged.');
    } catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  return <>
    <h3>NetworkMachine presentation</h3><p>Timeline density, subtitles, focus and camera cues share one configuration across the workspace.</p>
    <label className="ops-settings-input">Timeline density<select disabled={busy} aria-label="Timeline density" value={config.timelineMode} onChange={event => {
      const timelineMode = event.currentTarget.value;
      if (timelineMode !== 'all-frames' && timelineMode !== 'graph-changes') throw new Error('NETWORK_MACHINE_TIMELINE_MODE_INVALID');
      void apply(safeStringify({ ...config, timelineMode }));
    }}><option value="all-frames">Every Runtime frame</option><option value="graph-changes">Frames changing the visible graph</option></select></label>
    <form onSubmit={event => { event.preventDefault(); void apply(draft); }}>
      <label className="ops-settings-input">Presentation config<textarea aria-label="Presentation config" spellCheck={false} rows={14} value={draft} onChange={event => setDraft(event.currentTarget.value)} disabled={busy} /></label>
      <button type="submit" disabled={busy}>{busy ? 'Applying…' : 'Import presentation config'}</button>
    </form>
    {issue ? <p role="alert">{issue}</p> : status ? <p role="status">{status}</p> : null}
  </>;
}
