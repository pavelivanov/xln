import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { safeStringify } from '@xln/core/protocol/serialization';
import ahbScenarioCode from '@xln/core/scenarios/consensus/ahb.ts?raw';
import { getXLN } from '../../../../../src/lib/stores/bootstrap/xlnRuntimeLoader';
import { SCENARIO_OPTIONS } from '../../../../../packages/runtime-client/src/scenario/scenario-player-model';
import { getArchitectScenarioScrollTop } from '../../../../../packages/runtime-client/src/panels/architect-panel-view';
import { useWorkspaceEnvironment } from '../session/use-workspace-environment';
import { loadWorkspaceScenario, pauseWorkspacePlayback, returnWorkspaceLive, workspaceNetwork } from '../session/ops-workspace-playback';
import { OpsSolvencyPanel } from './ops-solvency-panel';
import { OpsArchitectLiveControls } from '../architect/ops-architect-live-controls';
import { networkMachineRuntimeOperations } from '../../../../../src/lib/stores/network/networkMachineRuntimeStore';

export function OpsArchitectPanel() {
  const context = useWorkspaceEnvironment();
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  const [keys, setKeys] = useState<readonly string[]>([]);
  const [key, setKey] = useState('ahb');
  const [tab, setTab] = useState<'scenarios' | 'solvency'>('scenarios');
  const [issue, setIssue] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [ownsDemo, setOwnsDemo] = useState(false);
  const alive = useRef(true);
  const ownedDemo = useRef(false);
  const code = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    alive.current = true;
    void getXLN().then(runtime => { if (alive.current) setKeys(runtime.scenarioKeys); })
      .catch(cause => { if (alive.current) setIssue(cause instanceof Error ? cause.message : String(cause)); });
    return () => {
      alive.current = false;
      if (ownedDemo.current) { pauseWorkspacePlayback(); networkMachineRuntimeOperations.dispose(); }
    };
  }, []);
  useEffect(() => {
    if (code.current) code.current.scrollTop = getArchitectScenarioScrollTop(ahbScenarioCode, network.selectedStepIndex);
  }, [network.selectedStepIndex, tab]);
  const run = async (): Promise<void> => {
    if (busy || network.loading) return;
    setBusy(true); setIssue(''); setResult('');
    ownedDemo.current = true; setOwnsDemo(true);
    try {
      if (!keys.includes(key)) throw new Error(`ARCHITECT_SCENARIO_UNKNOWN:${key}`);
      const count = await loadWorkspaceScenario(key);
      if (alive.current) setResult(`${key}: ${count} recorded network steps`);
    } catch (cause) {
      if (!networkMachineRuntimeOperations.readSelectedSnapshot()) { ownedDemo.current = false; setOwnsDemo(false); }
      if (alive.current) setIssue(cause instanceof Error ? cause.message : String(cause));
    }
    finally { if (alive.current) setBusy(false); }
  };
  const resetDemo = (): void => {
    if (!ownedDemo.current) return;
    pauseWorkspacePlayback();
    networkMachineRuntimeOperations.dispose();
    ownedDemo.current = false; setOwnsDemo(false);
    setIssue(''); setResult('Isolated demo reset. The connected Runtime was not changed.');
  };
  const selectedOption = SCENARIO_OPTIONS.find(option => option.runner === key);
  const state = context.frame?.state;
  return <section className="ops-evidence-panel ops-architect-panel" data-testid="workspace-architect">
    <header><h2>Architect</h2><span>{network.selectedStep ? `${network.selectedStep.activeRuntimeId} · h${network.selectedStep.event.height}` : 'Live workspace'}</span></header>
    <nav aria-label="Architect views"><button aria-pressed={tab === 'scenarios'} onClick={() => setTab('scenarios')} type="button">Scenarios</button><button aria-pressed={tab === 'solvency'} onClick={() => setTab('solvency')} type="button">Solvency</button></nav>
    {issue || network.error ? <p role="alert">{issue || network.error}</p> : null}
    {tab === 'solvency' ? <OpsSolvencyPanel /> : <>
      <h3>Deterministic scenario lab</h3><p>Run the canonical browser scenarios in a fresh Runtime. Every retained panel follows the same recorded frame. The connected Runtime stays available through Live.</p>
      <form className="ops-panel-controls" onSubmit={event => { event.preventDefault(); void run(); }}>
        <label>Scenario<select aria-label="Architect scenario" disabled={busy || network.loading || context.historical} value={key} onChange={event => setKey(event.currentTarget.value)}>{keys.map(value => <option key={value} value={value}>{SCENARIO_OPTIONS.find(option => option.runner === value)?.title ?? value}</option>)}</select></label>
        <button disabled={!keys.length || busy || network.loading || context.historical} type="submit">{busy ? 'Running scenario…' : 'Run scenario'}</button>
        <button disabled={!network.selectedStep} onClick={returnWorkspaceLive} type="button">Live Runtime</button>
        <button disabled={!ownsDemo || !network.machine} onClick={resetDemo} type="button">Reset isolated demo</button>
      </form>
      {selectedOption ? <p>{selectedOption.description}</p> : null}
      {result ? <p role="status">{result}</p> : null}
      {state ? <><dl className="ops-audit-metrics"><div><dt>Runtime height</dt><dd>{state.height}</dd></div><div><dt>Entity replicas</dt><dd>{state.eReplicas.size}</dd></div><div><dt>Jurisdictions</dt><dd>{state.jReplicas.size}</dd></div></dl><details><summary>Selected frame</summary><pre className="ops-panel-json">{safeStringify({ height: state.height, entities: [...state.eReplicas].map(([id, replica]) => ({ id, entityId: replica.entityId, height: replica.state.height, accounts: replica.state.accounts.size })), jurisdictions: [...state.jReplicas.values()].map(machine => ({ name: machine.name, blockNumber: machine.blockNumber })) }, 2)}</pre></details></> : <p>{context.error || context.restriction}</p>}
      {network.selectedStep?.activeRuntimeId === 'scenario:ahb' ? <label className="ops-architect-code">AHB scenario source<textarea aria-label="AHB scenario source" readOnly ref={code} spellCheck={false} value={ahbScenarioCode} /></label> : null}
      <OpsArchitectLiveControls />
    </>}
  </section>;
}
