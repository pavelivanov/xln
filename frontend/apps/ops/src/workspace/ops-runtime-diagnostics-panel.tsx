import { useEffect, useRef, useState } from 'react';
import { safeStringify } from '@xln/core/protocol/serialization';

import {
  formatRuntimeDiagnosticsTimestamp,
  getRuntimeDiagnosticsErrorMessage,
  getRuntimeDiagnosticsFrameLabel,
} from '../../../../packages/runtime-client/src/runtime-diagnostics-panel-view';
import { opsEntityWorkspaceSource } from '../ops-entity-workspace-runtime';
import { readOpsRuntimeDiagnostics } from './ops-workspace-query';
import { useWorkspaceQuery } from './use-workspace-query';
import { WorkspaceReadBoundary } from './workspace-read-boundary';
import './ops-runtime-diagnostics.css';

export function OpsRuntimeDiagnosticsPanel() {
  const { snapshot, connection, connected, client, refresh } = useWorkspaceQuery(readOpsRuntimeDiagnostics);
  const [verification, setVerification] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [issue, setIssue] = useState('');
  const operation = useRef<AbortController | null>(null);
  useEffect(() => {
    setVerification(null); setVerifying(false); setIssue('');
    return () => { operation.current?.abort(); };
  }, [client]);

  const verify = async (): Promise<void> => {
    if (!client || verifying) return;
    const controller = new AbortController();
    operation.current = controller;
    setVerifying(true); setIssue(''); setVerification(null);
    try {
      const result = await opsEntityWorkspaceSource.verifyChain(client, controller.signal);
      setVerification(safeStringify(result, 2));
    } catch (cause) {
      if (!controller.signal.aborted) setIssue(getRuntimeDiagnosticsErrorMessage(cause));
    } finally {
      if (!controller.signal.aborted) setVerifying(false);
    }
  };
  const data = snapshot.data;
  return (
    <section className="workspace-read-panel workspace-diagnostics" data-testid="runtime-diagnostics-panel">
      <header>
        <div><h2>Runtime Diagnostics</h2><p>Storage integrity · live Runtime</p></div>
        <div className="workspace-diagnostics-actions">
          <button disabled={!refresh || snapshot.loading} onClick={() => { void refresh?.(); }} type="button">Refresh</button>
          <button disabled={!connected || verifying} onClick={() => { void verify(); }} type="button">{verifying ? 'Verifying…' : 'Verify chain'}</button>
        </div>
      </header>
      <WorkspaceReadBoundary connected={connected} connection={connection} error={snapshot.error} loading={snapshot.loading && data === null}>
        {issue ? <p className="workspace-read-state is-error" role="alert">{issue}</p> : null}
        {data ? <div className="workspace-diagnostics-content">
          <dl className="workspace-diagnostics-metrics">
            <div><dt>Adapter</dt><dd>remote</dd></div>
            <div><dt>Live height</dt><dd data-testid="runtime-diagnostics-height">{snapshot.height}</dd></div>
            <div><dt>Persisted</dt><dd data-testid="runtime-diagnostics-persisted">{data.head.latestHeight}</dd></div>
          </dl>
          <section aria-label="Security status" data-testid="runtime-security-status">
            <h3>Security status</h3>
            <p>Incident details are unavailable in this remote session.</p>
          </section>
          <section aria-label="Recent timeline index">
            <h3>Recent timeline index</h3>
            <div className="workspace-diagnostics-frames">
              {data.timeline.entries.length === 0 ? <p className="workspace-read-state">No persisted frame index.</p> : data.timeline.entries.map(frame => (
                <article data-testid="runtime-diagnostics-frame" key={`${frame.runtimeId}:${frame.height}`}>
                  <code title={frame.runtimeId}>{frame.runtimeId}</code><strong>h{frame.height}</strong>
                  <time dateTime={formatRuntimeDiagnosticsTimestamp(frame.timestamp)}>{formatRuntimeDiagnosticsTimestamp(frame.timestamp)}</time>
                  <span>{getRuntimeDiagnosticsFrameLabel(frame)}</span>
                </article>
              ))}
            </div>
          </section>
          {verification !== null ? <details open data-testid="runtime-diagnostics-verification"><summary>Verification result</summary><pre>{verification}</pre></details> : null}
        </div> : null}
      </WorkspaceReadBoundary>
    </section>
  );
}
