import { useState } from 'react';
import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import { readBrowserRuntimeEnvironment } from '../../../../bridges/browser-runtime-context';
import {
  buildStoragePolicy, readStoragePolicyFields, buildPerformancePolicy, readPerformancePolicyFields,
  type RuntimeStoragePolicy, type RuntimePerformancePolicy,
} from '../../../../packages/runtime-client/src/operator-policy-settings';
import { assertNetworkMachineIsLive, networkMachineRuntime } from '../../../../src/lib/stores/network/networkMachineRuntimeStore';
import { opsEntityWorkspaceSource } from '../ops-entity-workspace-runtime';
import { useWorkspaceEnvironment } from './use-workspace-environment';

const selectedLocalRuntime = (adapter: RuntimeAdapter) => {
  assertNetworkMachineIsLive(networkMachineRuntime.get());
  if (adapter.mode !== 'embedded' || opsEntityWorkspaceSource.getAdapter() !== adapter) throw new Error('Operator policy requires the selected local Runtime');
  const env = readBrowserRuntimeEnvironment(adapter);
  if (!env) throw new Error('No local Runtime is selected');
  return env;
};

function PolicyFields<T extends Readonly<Record<string, string>>>({ values, fields, onChange }: Readonly<{
  values: T; fields: readonly Readonly<{ key: keyof T; label: string; unit: string; testId: string }>[];
  onChange: (key: keyof T, value: string) => void;
}>) {
  return <div className="ops-policy-fields">{fields.map(field => <label key={String(field.key)}><span>{field.label}</span>
    <input data-testid={field.testId} value={values[field.key]} inputMode="decimal" onChange={event => onChange(field.key, event.currentTarget.value)} />
    <small>{field.unit}</small>
  </label>)}</div>;
}

function StoragePolicy({ adapter, policy }: { adapter: RuntimeAdapter; policy: RuntimeStoragePolicy | undefined }) {
  const [draft, setDraft] = useState(() => readStoragePolicyFields(policy));
  const [issue, setIssue] = useState(''), [status, setStatus] = useState('');
  const save = (): void => {
    try {
      const env = selectedLocalRuntime(adapter);
      const storage = buildStoragePolicy(env.runtimeConfig?.storage, draft);
      env.runtimeConfig = { ...env.runtimeConfig, storage };
      setDraft(readStoragePolicyFields(storage)); setIssue('');
      setStatus('Storage policy saved. It applies from the next Runtime frame.');
    } catch (cause) { setStatus(''); setIssue(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <form data-testid="runtime-storage-limits" className="ops-runtime-policy" onSubmit={event => { event.preventDefault(); save(); }}>
    <h3>Runtime storage policy</h3><p>Blank means unlimited. Limits are local operator policy, never consensus state.</p>
    <PolicyFields values={draft} onChange={(key, value) => setDraft(current => ({ ...current, [key]: value }))} fields={[
      { key: 'commonGiB', label: 'Common limit per archival store', unit: 'GiB · fills both blank limits below', testId: 'storage-common-gib' },
      { key: 'walEpochGiB', label: 'WAL epoch rollover', unit: 'GiB · closes the epoch at a durable checkpoint', testId: 'storage-wal-gib' },
      { key: 'historyViewGiB', label: 'Materialized history view', unit: 'GiB · rebuildable from WAL', testId: 'storage-history-gib' },
      { key: 'historyRetainFrames', label: 'Retained history frames', unit: 'frames', testId: 'storage-history-frames' },
    ]} /><button data-testid="storage-limits-save" type="submit">Save storage policy</button>
    {issue ? <p role="alert">{issue}</p> : status ? <p role="status">{status}</p> : null}
  </form>;
}

function PerformancePolicy({ adapter, policy }: { adapter: RuntimeAdapter; policy: RuntimePerformancePolicy | undefined }) {
  const [draft, setDraft] = useState(() => readPerformancePolicyFields(policy));
  const [issue, setIssue] = useState(''), [status, setStatus] = useState('');
  const save = (): void => {
    try {
      const performance = buildPerformancePolicy(draft);
      const env = selectedLocalRuntime(adapter);
      env.runtimeConfig = { ...env.runtimeConfig, performance };
      setDraft(readPerformancePolicyFields(performance)); setIssue('');
      setStatus('Performance budgets saved. Blank metrics remain observation-only.');
    } catch (cause) { setStatus(''); setIssue(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <form data-testid="runtime-performance-budgets" className="ops-runtime-policy" onSubmit={event => { event.preventDefault(); save(); }}>
    <h3>Runtime frame budgets</h3><p>Local alarms only. A slow frame is still committed according to protocol.</p>
    <PolicyFields values={draft} onChange={(key, value) => setDraft(current => ({ ...current, [key]: value }))} fields={[
      { key: 'cloneMiB', label: 'Clone payload', unit: 'MiB', testId: 'perf-clone-mib' },
      { key: 'cloneMs', label: 'Clone latency', unit: 'ms', testId: 'perf-clone-ms' },
      { key: 'reducerMs', label: 'Reducer latency', unit: 'ms', testId: 'perf-reducer-ms' },
      { key: 'walMs', label: 'Durable WAL write', unit: 'ms', testId: 'perf-wal-ms' },
    ]} /><button data-testid="perf-budgets-save" type="submit">Save frame budgets</button>
    {issue ? <p role="alert">{issue}</p> : status ? <p role="status">{status}</p> : null}
  </form>;
}

export function OpsRuntimePolicies({ kind }: { kind: 'storage' | 'performance' }) {
  const context = useWorkspaceEnvironment();
  if (context.error) return <p role="alert">{context.error}</p>;
  if (!context.adapter || context.adapter.mode !== 'embedded' || !context.frame || context.historical) {
    return <p role="status">Operator policies require a live local Runtime. Recorded scenarios and remote connections are read-only here.</p>;
  }
  // Operator policy is outside committed state. Read the selected live policy
  // when mounting a form; waiting for a frame would reopen a stale draft on an
  // idle Runtime after saving in another Settings category.
  const config = readBrowserRuntimeEnvironment(context.adapter)?.runtimeConfig;
  return kind === 'storage' ? <StoragePolicy key={context.adapter.runtimeId} adapter={context.adapter} policy={config?.storage} />
    : <PerformancePolicy key={context.adapter.runtimeId} adapter={context.adapter} policy={config?.performance} />;
}
