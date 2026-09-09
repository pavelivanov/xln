import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { getRuntimeControllerConfig, runtimeControllerConfig } from '../../../../../src/lib/stores/runtimeControllerStore';
import { deriveJMachineCreatedAt, jmachineOperations, jmachineState, type JMachineConfig } from '../../../../../src/lib/stores/network/jmachineStore';
import { runtimeHttpOriginFromWsUrl } from '../../../../../packages/runtime-client/src/runtime/ws-url';
import {
  defaultStackStablecoinKind,
  deployStack,
  fetchStackManagerStatus,
  requireStackManagerProbe,
  type StackManagerDeployResult,
  type StackManagerProbe,
  type StackManagerStatusResponse,
  type StackPublicationRequest,
  type StackStablecoinKind,
} from '../../../../../src/lib/components/Settings/stack-manager-client';
import { workspaceNetwork } from '../session/ops-workspace-playback';

type Inspection = Readonly<{ response: StackManagerStatusResponse | null; issue: string; busy: boolean }>;
const empty: Inspection = { response: null, issue: '', busy: false };
const errorMessage = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);
const normalizedKey = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const persistedDeployment = (result: StackManagerDeployResult, rpcUrl: string, blockTimeMs: number, ticker: string): JMachineConfig => {
  const manifest = result.manifest;
  const seed = { name: result.localJurisdiction.name, mode: 'rpc' as const, chainId: manifest.chainId, ticker, rpcs: [rpcUrl], blockTimeMs };
  return {
    ...seed,
    entityProviderDeploymentBlock: manifest.entityProviderDeploymentBlock,
    contracts: {
      account: manifest.contracts.account, depository: manifest.contracts.depository,
      entityProvider: manifest.contracts.entityProvider, deltaTransformer: manifest.contracts.deltaTransformer,
    },
    createdAt: deriveJMachineCreatedAt(seed),
  };
};

function ConfiguredStacks() {
  const state = useSyncExternalStore(jmachineState.subscribe, jmachineState.get);
  const selected = state.configs.find(config => config.name === state.activeJMachine) ?? null;
  return <section className="ops-runtime-policy" data-testid="configured-stack-selection">
    <h4>Configured stacks</h4>
    <label className="ops-settings-input">Shared stack selection<select aria-label="Configured jurisdiction stack" value={selected?.name ?? ''} disabled={!state.configs.length} onChange={event => jmachineOperations.setActive(event.currentTarget.value)}>
      {!state.configs.length ? <option value="">No configured stacks</option> : state.configs.map(config => <option key={config.name}>{config.name}</option>)}
    </select></label>
    {selected ? <dl className="ops-audit-metrics" data-testid="configured-stack-inspection"><div><dt>Mode</dt><dd>{selected.mode}</dd></div><div><dt>Chain ID</dt><dd>{selected.chainId}</dd></div><div><dt>RPC</dt><dd>{selected.rpcs[0] ?? 'BrowserVM'}</dd></div><div><dt>EntityProvider block</dt><dd>{selected.entityProviderDeploymentBlock ?? 'Local deployment'}</dd></div></dl> : <p>No stack configuration has been registered in this browser.</p>}
  </section>;
}

function StackManagerWorkspace({ origin, capability }: Readonly<{ origin: string; capability: string }>) {
  const [rpcUrl, setRpcUrl] = useState('');
  const [signerId, setSignerId] = useState('');
  const [networkName, setNetworkName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [foundation, setFoundation] = useState('');
  const [stablecoinKind, setStablecoinKind] = useState<StackStablecoinKind>('existing');
  const [stablecoinEdited, setStablecoinEdited] = useState(false);
  const [stablecoinAddress, setStablecoinAddress] = useState('');
  const [publication, setPublication] = useState<StackPublicationRequest>('local');
  const [confirmations, setConfirmations] = useState(12);
  const [blockTimeMs, setBlockTimeMs] = useState(12_000);
  const [currency, setCurrency] = useState('ETH');
  const [explorer, setExplorer] = useState('');
  const [description, setDescription] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [inspection, setInspection] = useState<Inspection>(empty);
  const [probe, setProbe] = useState<StackManagerProbe | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<StackManagerDeployResult | null>(null);
  const request = useRef<AbortController | null>(null);
  const alive = useRef(true);

  const load = async (nextRpc: string, nextSigner: string): Promise<void> => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setInspection({ response: null, issue: '', busy: true }); setProbe(null); setResult(null);
    try {
      const response = await fetchStackManagerStatus(origin, nextRpc, nextSigner, capability,
        (input, init) => fetch(input, { ...init, signal: controller.signal }));
      if (controller.signal.aborted || !alive.current) return;
      const exactProbe = nextRpc ? requireStackManagerProbe(response, nextRpc, nextSigner) : null;
      const signer = response.signerIds.includes(signerId) ? signerId : response.signerIds[0] ?? '';
      setSignerId(signer); setFoundation(current => current || signer);
      setInspection({ response, issue: response.signerIds.length ? '' : 'STACK_MANAGER_RUNTIME_SIGNER_REQUIRED', busy: false });
      setProbe(exactProbe);
      if (exactProbe) {
        setConfirmations(exactProbe.chainId === 31_337 || exactProbe.chainId === 1_337 ? 1 : 12);
        if (!stablecoinEdited) setStablecoinKind(defaultStackStablecoinKind(exactProbe.chainId));
      }
    } catch (cause) {
      if (!controller.signal.aborted && alive.current) setInspection({ response: null, issue: errorMessage(cause), busy: false });
    }
  };
  useEffect(() => {
    alive.current = true; void load('', '');
    return () => { alive.current = false; request.current?.abort(); };
  }, [origin, capability]);
  const invalidateProbe = (): void => { request.current?.abort(); setProbe(null); setResult(null); setInspection(current => ({ ...current, busy: false, response: current.response ? { ok: true, status: current.response.status, signerIds: current.response.signerIds } : null })); };
  const deploy = async (): Promise<void> => {
    setDeploying(true); setResult(null); setInspection(current => ({ ...current, issue: '' }));
    try {
      if (!probe || probe.rpcUrl !== rpcUrl.trim() || probe.signerId !== signerId) throw new Error('STACK_MANAGER_FRESH_PROBE_REQUIRED');
      if (!networkName.trim() || !key.trim() || !foundation.trim() || !confirmed) throw new Error('STACK_MANAGER_DEPLOYMENT_FIELDS_REQUIRED');
      const response = await deployStack(origin, {
        name: networkName.trim(), key: key.trim(), rpcUrl: rpcUrl.trim(), expectedChainId: probe.chainId,
        blockTimeMs, currency: currency.trim(), explorer: explorer.trim(), ...(description.trim() ? { description: description.trim() } : {}),
        signerId, foundationRecipient: foundation.trim(),
        stablecoin: stablecoinKind === 'test' ? { kind: 'test' } : { kind: 'existing', address: stablecoinAddress.trim() },
        publication, confirmations,
      }, capability);
      if (!alive.current) return;
      jmachineOperations.upsert(persistedDeployment(response.result, rpcUrl.trim(), blockTimeMs, currency.trim()));
      jmachineOperations.setActive(response.result.localJurisdiction.name);
      setResult(response.result); setConfirmed(false);
    } catch (cause) { if (alive.current) setInspection(current => ({ ...current, issue: errorMessage(cause) })); }
    finally { if (alive.current) setDeploying(false); }
  };
  const response = inspection.response;
  const hasGas = probe !== null && BigInt(probe.nativeBalanceWei) > 0n;
  const canDeploy = !deploying && !inspection.busy && hasGas && confirmed && Boolean(networkName.trim() && key.trim() && foundation.trim() && currency.trim() && (stablecoinKind === 'test' || stablecoinAddress.trim()));
  return <>
    <div className="ops-runtime-policy" data-testid="stack-manager-inspection">
      <p>Inspect the selected daemon's deployment status and probe an exact RPC with one of its Runtime signers.</p>
      <button type="button" disabled={inspection.busy || deploying} onClick={() => void load('', '')}>Refresh Runtime signers</button>
      {inspection.busy ? <p role="status">Loading Stack Manager…</p> : null}{inspection.issue ? <p role="alert">{inspection.issue}</p> : null}
      {response ? <p data-testid="stack-manager-phase">Deployment phase: {response.status.phase}{response.status.active ? ' · active' : ''}</p> : null}
      {response?.status.error ? <p role="alert">{response.status.error}</p> : null}
      <label className="ops-settings-input">RPC URL<input data-testid="stack-manager-rpc" autoComplete="url" placeholder="https://your-chain.example/rpc" value={rpcUrl} onChange={event => { invalidateProbe(); setRpcUrl(event.currentTarget.value); }} /></label>
      <label className="ops-settings-input">Runtime signer<select data-testid="stack-manager-signer" value={signerId} disabled={inspection.busy || !response?.signerIds.length} onChange={event => { invalidateProbe(); const signer = event.currentTarget.value; setSignerId(signer); setFoundation(signer); }}>{!response?.signerIds.length ? <option value="">No Runtime signers loaded</option> : response.signerIds.map(id => <option key={id}>{id}</option>)}</select></label>
      <button type="button" disabled={inspection.busy || !rpcUrl.trim() || !signerId || !response} onClick={() => void load(rpcUrl.trim(), signerId)}>Probe RPC</button>
      {probe ? <dl className="ops-audit-metrics" data-testid="stack-manager-probe"><div><dt>RPC URL</dt><dd>{probe.rpcUrl}</dd></div><div><dt>Chain ID</dt><dd>{probe.chainId}</dd></div><div><dt>Runtime signer</dt><dd><code>{probe.signerId}</code></dd></div><div><dt>Native balance (wei)</dt><dd>{probe.nativeBalanceWei}</dd></div></dl> : null}
    </div>
    <form className="ops-runtime-policy" data-testid="stack-manager-deployment" onSubmit={event => { event.preventDefault(); void deploy(); }}>
      <h4>Deploy and register V1 stack</h4>
      <label className="ops-settings-input">Network name<input data-testid="stack-manager-name" value={networkName} onChange={event => { const value = event.currentTarget.value; setNetworkName(value); if (!keyEdited) setKey(normalizedKey(value)); }} /></label>
      <label className="ops-settings-input">Jurisdiction key<input data-testid="stack-manager-key" value={key} onChange={event => { setKeyEdited(true); setKey(event.currentTarget.value); }} /></label>
      <label className="ops-settings-input">Foundation recipient<input data-testid="stack-manager-foundation" value={foundation} onChange={event => setFoundation(event.currentTarget.value)} /></label>
      <label className="ops-settings-input">Stablecoin<select data-testid="stack-manager-stablecoin" value={stablecoinKind} onChange={event => { setStablecoinEdited(true); setStablecoinKind(event.currentTarget.value as StackStablecoinKind); }}><option value="existing">Existing token</option><option value="test">Deploy test USDT</option></select></label>
      {stablecoinKind === 'existing' ? <label className="ops-settings-input">USDT address<input data-testid="stack-manager-usdt" value={stablecoinAddress} onChange={event => setStablecoinAddress(event.currentTarget.value)} /></label> : null}
      <label className="ops-settings-input">Publication<select data-testid="stack-manager-publication" value={publication} onChange={event => setPublication(event.currentTarget.value as StackPublicationRequest)}><option value="local">Local</option><option value="community">Community</option><option value="official">Official</option></select></label>
      <label className="ops-settings-input">Confirmations<input data-testid="stack-manager-confirmations" min={1} type="number" value={confirmations} onChange={event => setConfirmations(Number(event.currentTarget.value))} /></label>
      <label className="ops-settings-input">Block time (ms)<input min={1} type="number" value={blockTimeMs} onChange={event => setBlockTimeMs(Number(event.currentTarget.value))} /></label>
      <label className="ops-settings-input">Currency<input value={currency} onChange={event => setCurrency(event.currentTarget.value)} /></label>
      <label className="ops-settings-input">Explorer<input value={explorer} onChange={event => setExplorer(event.currentTarget.value)} /></label>
      <label className="ops-settings-input">Description<input value={description} onChange={event => setDescription(event.currentTarget.value)} /></label>
      <label className="ops-settings-toggle"><input data-testid="stack-manager-confirm" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.currentTarget.checked)} /> I verified the RPC, signer, chain, recipient, and publication scope.</label>
      <button data-testid="stack-manager-deploy" disabled={!canDeploy} type="submit">{deploying ? 'Deploying and verifying…' : 'Deploy V1 stack'}</button>
      {result ? <section data-testid="stack-manager-result"><h5>{result.localJurisdiction.name} deployed and registered</h5><p>Chain {result.manifest.chainId} · EntityProvider block {result.manifest.entityProviderDeploymentBlock} · publication {result.publication.scope}/{result.publication.status}</p></section> : null}
    </form>
  </>;
}

export function OpsStackManager() {
  const config = useSyncExternalStore(runtimeControllerConfig.subscribe, getRuntimeControllerConfig);
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  const origin = config?.mode === 'remote' && config.wsUrl ? runtimeHttpOriginFromWsUrl(config.wsUrl) : '';
  const capability = config?.mode === 'remote' ? config.authKey ?? '' : '';
  const restriction = network.selectedStep ? 'Stack Manager requires Live. Recorded scenarios do not query or mutate deployment state.' : !origin ? 'Stack Manager requires a daemon Runtime. In-browser Runtimes cannot inspect daemon deployment state.' : !capability ? 'STACK_MANAGER_ADMIN_CAPABILITY_REQUIRED' : '';
  return <section className="ops-stack-manager" data-testid="workspace-stack-manager"><h3>Stack Manager V1</h3><ConfiguredStacks />{restriction ? <p role="status">{restriction}</p> : <StackManagerWorkspace key={`${origin}:${capability}`} origin={origin} capability={capability} />}</section>;
}
