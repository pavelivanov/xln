import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getRuntimeControllerConfig, runtimeControllerConfig } from '../../../../src/lib/stores/runtimeControllerStore';
import { runtimeHttpOriginFromWsUrl } from '../../../../packages/runtime-client/src/ws-url';
import { fetchStackManagerStatus, requireStackManagerProbe, type StackManagerStatusResponse } from '../../../../src/lib/components/Settings/stack-manager-client';
import { workspaceNetwork } from './ops-workspace-playback';

type Inspection = Readonly<{ response: StackManagerStatusResponse | null; issue: string; busy: boolean }>;
const empty: Inspection = { response: null, issue: '', busy: false };

function StackManagerInspection({ origin, capability }: Readonly<{ origin: string; capability: string }>) {
  const [rpc, setRpc] = useState('');
  const [signer, setSigner] = useState('');
  const [inspection, setInspection] = useState<Inspection>(empty);
  const request = useRef<AbortController | null>(null);
  const load = async (rpcUrl: string, signerId: string): Promise<void> => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setInspection({ response: null, issue: '', busy: true });
    try {
      const response = await fetchStackManagerStatus(origin, rpcUrl, signerId, capability,
        (input, init) => fetch(input, { ...init, signal: controller.signal }));
      if (controller.signal.aborted) return;
      if (rpcUrl) requireStackManagerProbe(response, rpcUrl, signerId);
      setSigner(current => response.signerIds.includes(current) ? current : response.signerIds[0] ?? '');
      setInspection({ response, issue: response.signerIds.length ? '' : 'STACK_MANAGER_RUNTIME_SIGNER_REQUIRED', busy: false });
    } catch (cause) {
      if (!controller.signal.aborted) setInspection({ response: null, issue: cause instanceof Error ? cause.message : String(cause), busy: false });
    }
  };
  useEffect(() => {
    setRpc(''); setSigner('');
    void load('', '');
    return () => { request.current?.abort(); };
  }, [origin, capability]);
  const invalidateProbe = (): void => {
    request.current?.abort();
    setInspection(current => ({ ...current, busy: false, response: current.response ? {
      ok: true, status: current.response.status, signerIds: current.response.signerIds,
    } : null }));
  };
  const response = inspection.response;
  return <div className="ops-runtime-policy" data-testid="stack-manager-inspection">
    <p>Inspect the selected daemon's deployment status and probe an exact RPC with one of its Runtime signers.</p>
    <button type="button" disabled={inspection.busy} onClick={() => void load('', '')}>Refresh Runtime signers</button>
    {inspection.busy ? <p role="status">Loading Stack Manager…</p> : null}
    {inspection.issue ? <p role="alert">{inspection.issue}</p> : null}
    {response ? <p data-testid="stack-manager-phase">Deployment phase: {response.status.phase}{response.status.active ? ' · active' : ''}</p> : null}
    {response?.status.error ? <p role="alert">{response.status.error}</p> : null}
    <label className="ops-settings-input">RPC URL<input data-testid="stack-manager-rpc" autoComplete="url" placeholder="https://your-chain.example/rpc" value={rpc} onChange={event => { invalidateProbe(); setRpc(event.currentTarget.value); }} /></label>
    <label className="ops-settings-input">Runtime signer<select data-testid="stack-manager-signer" value={signer} disabled={inspection.busy || !response?.signerIds.length} onChange={event => { invalidateProbe(); setSigner(event.currentTarget.value); }}>
      {!response?.signerIds.length ? <option value="">No Runtime signers loaded</option> : response.signerIds.map(id => <option key={id} value={id}>{id}</option>)}
    </select></label>
    <button type="button" disabled={inspection.busy || !rpc.trim() || !signer || !response} onClick={() => void load(rpc.trim(), signer)}>Probe RPC</button>
    {response?.probe ? <dl className="ops-audit-metrics" data-testid="stack-manager-probe">
      <div><dt>RPC URL</dt><dd>{response.probe.rpcUrl}</dd></div><div><dt>Chain ID</dt><dd>{response.probe.chainId}</dd></div>
      <div><dt>Runtime signer</dt><dd><code>{response.probe.signerId}</code></dd></div>
      <div><dt>Native balance (wei)</dt><dd>{response.probe.nativeBalanceWei}</dd></div>
    </dl> : null}
  </div>;
}

export function OpsStackManager() {
  const config = useSyncExternalStore(runtimeControllerConfig.subscribe, getRuntimeControllerConfig);
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  const origin = config?.mode === 'remote' && config.wsUrl ? runtimeHttpOriginFromWsUrl(config.wsUrl) : '';
  const capability = config?.mode === 'remote' ? config.authKey ?? '' : '';
  const restriction = network.selectedStep ? 'Stack Manager inspection requires a live daemon Runtime. Recorded scenarios do not query live deployment state.'
    : !origin ? 'Stack Manager requires a daemon Runtime. In-browser Runtimes cannot inspect daemon deployment state.'
    : !capability ? 'STACK_MANAGER_ADMIN_CAPABILITY_REQUIRED' : '';
  return <section className="ops-stack-manager" data-testid="workspace-stack-manager"><h3>Stack Manager V1</h3>
    {restriction ? <p role="status">{restriction}</p> : <StackManagerInspection key={origin} origin={origin} capability={capability} />}
  </section>;
}
