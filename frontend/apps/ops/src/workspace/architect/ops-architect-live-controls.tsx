import { useEffect, useState, useSyncExternalStore } from 'react';

import { getXLN } from '../../../../../src/lib/stores/bootstrap/xlnRuntimeLoader';
import { jmachineState } from '../../../../../src/lib/stores/network/jmachineStore';
import type { JMachineCreateDetail } from '../../../../../src/lib/components/Jurisdiction/import-jmachine-runtime';
import { useWorkspaceEnvironment } from '../session/use-workspace-environment';
import {
  createArchitectDemoGrid,
  createArchitectJurisdiction,
  fundArchitectEntities,
  selectArchitectJurisdiction,
  sendArchitectR2R,
} from './ops-architect-actions';
import { requireArchitectAmount } from './ops-architect-model';
import { useWorkspaceTranslation } from '../../../../../bridges/workspace-localization-react';

const addressFields = ['depository', 'entityProvider', 'account', 'deltaTransformer'] as const;

export function OpsArchitectLiveControls() {
  const { t } = useWorkspaceTranslation();
  const context = useWorkspaceEnvironment();
  const configured = useSyncExternalStore(jmachineState.subscribe, jmachineState.get);
  const machines = context.frame ? [...context.frame.state.jReplicas.values()] : [];
  const [machineName, setMachineName] = useState('');
  const [mode, setMode] = useState<'browservm' | 'rpc'>('browservm');
  const [name, setName] = useState('Ops Testnet');
  const [rpcUrl, setRpcUrl] = useState('http://127.0.0.1:8545');
  const [chainId, setChainId] = useState('31337');
  const [deploymentBlock, setDeploymentBlock] = useState('');
  const [contracts, setContracts] = useState<Record<typeof addressFields[number], string>>({ depository: '', entityProvider: '', account: '', deltaTransformer: '' });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('500000');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [issue, setIssue] = useState('');
  const selectedName = machines.some(machine => machine.name === machineName) ? machineName
    : machines.find(machine => machine.name === configured.activeJMachine)?.name ?? machines[0]?.name ?? '';
  const actionContext = {
    adapter: context.adapter, historical: context.historical,
    ...(context.refreshLocal ? { refresh: context.refreshLocal } : {}),
  };
  const selectedMachine = machines.find(machine => machine.name === selectedName);
  const entityIds = !context.historical && selectedMachine && context.frame
    ? [...context.frame.state.eReplicas.values()].filter(replica =>
      replica.state.config.jurisdiction?.chainId === selectedMachine.chainId
      && replica.state.config.jurisdiction?.entityProviderAddress.toLowerCase() === selectedMachine.contracts?.entityProvider?.toLowerCase())
      .map(replica => replica.entityId.toLowerCase()).filter((id, index, values) => values.indexOf(id) === index).sort()
    : [];
  useEffect(() => {
    setFrom(current => entityIds.includes(current) ? current : entityIds[0] ?? '');
    setTo(current => entityIds.includes(current) && current !== entityIds[0] ? current : entityIds[1] ?? '');
  }, [entityIds.join('|')]);
  const run = async (label: string, action: () => Promise<string>): Promise<void> => {
    if (busy) return;
    setBusy(label); setIssue(''); setStatus('');
    try { setStatus(await action()); }
    catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(''); }
  };
  const create = async (): Promise<string> => {
    const detail: JMachineCreateDetail = {
      name, mode, chainId: Number(chainId), ticker: mode === 'browservm' ? 'USDC' : 'ETH',
      rpcs: mode === 'rpc' ? [rpcUrl] : [], blockTimeMs: 1_000,
      ...(mode === 'rpc' ? {
        entityProviderDeploymentBlock: Number(deploymentBlock),
        contracts: Object.fromEntries(addressFields.flatMap(key => contracts[key] ? [[key, contracts[key]]] : [])),
      } : {}),
    };
    const machine = await createArchitectJurisdiction(actionContext, detail);
    setMachineName(machine.name);
    return `${machine.name} committed on chain ${machine.chainId} with deployment block ${machine.entityProviderDeploymentBlock ?? 'local BrowserVM'}.`;
  };
  return <section className="ops-architect-controls" aria-label="Live economy controls">
    <header><h3>Live economy controls</h3><span>{context.historical ? 'Recorded · read only' : 'Current Runtime'}</span></header>
    {context.historical ? <p role="status">Switch to Live Runtime before creating, funding, or transferring.</p> : null}
    {issue ? <p role="alert">{issue}</p> : null}{status ? <p role="status">{status}</p> : null}
    <fieldset disabled={context.historical || Boolean(busy) || context.adapter?.mode !== 'embedded'}>
      <legend>{t('workspace.jurisdiction')} stack</legend>
      <label>Selected stack<select aria-label="Architect selected stack" value={selectedName} onChange={event => { const next = event.currentTarget.value; setMachineName(next); try { selectArchitectJurisdiction(actionContext, next); setIssue(''); } catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); } }}>{machines.map(machine => <option key={machine.name}>{machine.name}</option>)}</select></label>
      <label>Import mode<select aria-label="Jurisdiction import mode" value={mode} onChange={event => setMode(event.currentTarget.value as 'browservm' | 'rpc')}><option value="browservm">BrowserVM</option><option value="rpc">Existing RPC</option></select></label>
      <label>Name<input aria-label="Jurisdiction name" value={name} onChange={event => setName(event.currentTarget.value)} /></label>
      <label>Chain ID<input aria-label="Jurisdiction chain ID" inputMode="numeric" value={chainId} onChange={event => setChainId(event.currentTarget.value)} /></label>
      {mode === 'rpc' ? <><label>RPC URL<input aria-label="Jurisdiction RPC URL" value={rpcUrl} onChange={event => setRpcUrl(event.currentTarget.value)} /></label><label>EntityProvider deployment block<input aria-label="EntityProvider deployment block" inputMode="numeric" value={deploymentBlock} onChange={event => setDeploymentBlock(event.currentTarget.value)} /></label>{addressFields.map(key => <label key={key}>{key}<input aria-label={`Jurisdiction ${key}`} value={contracts[key]} onChange={event => { const value = event.currentTarget.value; setContracts(current => ({ ...current, [key]: value })); }} /></label>)}</> : null}
      <button type="button" onClick={() => { void run('create', create); }}>{busy === 'create' ? 'Creating…' : 'Create jurisdiction'}</button>
    </fieldset>
    <fieldset disabled={context.historical || Boolean(busy) || !selectedName || context.adapter?.mode !== 'embedded'}>
      <legend>3×3 demo topology</legend><p>{entityIds.length} {t('network.entities')} in the selected stack. Setup never clears the existing Runtime.</p>
      <button type="button" onClick={() => { void run('grid', async () => { const xln = await getXLN(); const ids = await createArchitectDemoGrid(actionContext, xln, selectedName); return `Created ${ids.length} demo Entities.`; }); }}>{busy === 'grid' ? 'Creating…' : 'Create 3×3 hub'}</button>
      <button disabled={!entityIds.length} type="button" onClick={() => { void run('fund', async () => { const balances = await fundArchitectEntities(actionContext, selectedName, entityIds, 1, 1_000_000n); return `Observed ${balances.length} reserves at or above 1000000 raw units.`; }); }}>{busy === 'fund' ? 'Funding…' : 'Fund all reserves'}</button>
    </fieldset>
    <fieldset disabled={context.historical || Boolean(busy) || context.adapter?.mode !== 'embedded'}>
      <legend>Reserve-to-reserve transfer</legend>
      <label>From<select aria-label="R2R from Entity" value={from} onChange={event => setFrom(event.currentTarget.value)}>{entityIds.map(id => <option key={id}>{id}</option>)}</select></label>
      <label>To<select aria-label="R2R to Entity" value={to} onChange={event => setTo(event.currentTarget.value)}>{entityIds.map(id => <option key={id}>{id}</option>)}</select></label>
      <label>Raw amount<input aria-label="R2R raw amount" value={amount} onChange={event => setAmount(event.currentTarget.value)} /></label>
      <button disabled={!from || !to || from === to} type="button" onClick={() => { void run('r2r', async () => `R2R committed at Runtime h${await sendArchitectR2R(actionContext, selectedName, from, to, 1, requireArchitectAmount(amount))}.`); }}>{busy === 'r2r' ? 'Sending…' : 'Send R2R transfer'}</button>
    </fieldset>
  </section>;
}
