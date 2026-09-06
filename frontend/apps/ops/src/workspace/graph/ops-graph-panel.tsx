import { useWorkspaceTranslation } from '../../../../../bridges/workspace-localization-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getXLN } from '../../../../../src/lib/stores/bootstrap/xlnRuntimeLoader';
import { mergeRuntimeGraphProjections, projectRuntimeGraphFrame, projectRuntimeEnv } from '../../../../../src/lib/network3d/runtimeGraphProjection';
import { GRAPH3D_CANONICITY_OPTIONS } from '../../../../../packages/runtime-client/src/graph/graph3d-viewport-view';
import type { OpsWorkspaceQueryClient } from '../session/ops-workspace-query';
import { useWorkspaceQuery } from '../session/use-workspace-query';
import { createOpsGraphScene, type OpsGraphSelection } from './ops-graph-scene';
import { workspaceNetwork } from '../session/ops-workspace-playback';
import { useOpenWorkspaceEntity, useOpenWorkspaceJurisdiction } from '../session/ops-workspace-navigation';
import { opsGraphBirdSettings, opsGraphViewSettings, updateOpsGraphBirdSettings, updateOpsGraphViewSettings } from './ops-graph-preferences';
import { runtimeGraphCanonicity, runtimeGraphControlOperations } from '../../../../../src/lib/stores/network/runtimeGraphControlStore';
import { networkMachineRuntimeOperations } from '../../../../../src/lib/stores/network/networkMachineRuntimeStore';
import { materializeRuntimeGraphReplicas } from '../../../../../src/lib/network3d/runtimeGraphRender';
import { collectGraphTokenIds } from '../../../../../src/lib/view/panels/graph3d/graph3d-actions';
import { opsEntityWorkspaceSource } from '../../entity-workspace/ops-entity-workspace-runtime';
import { useWorkspaceEnvironment } from '../session/use-workspace-environment';

const readGraph = (client: OpsWorkspaceQueryClient) => client.readGraphFrame({ limit: 500, accountsLimit: 500 });
export function OpsGraphPanel() {
  const { t } = useWorkspaceTranslation();
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createOpsGraphScene> | null>(null);
  const [issue, setIssue] = useState('');
  const [selection, setSelection] = useState<OpsGraphSelection | null>(null);
  const [hover, setHover] = useState<OpsGraphSelection | null>(null);
  const canonicity = useSyncExternalStore(runtimeGraphCanonicity.subscribe, runtimeGraphCanonicity.get);
  const bird = useSyncExternalStore(opsGraphBirdSettings.subscribe, opsGraphBirdSettings.get);
  const view = useSyncExternalStore(opsGraphViewSettings.subscribe, opsGraphViewSettings.get);
  const adapter = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getAdapter);
  const { barsMode } = bird;
  const openEntity = useOpenWorkspaceEntity();
  const openJurisdiction = useOpenWorkspaceJurisdiction();
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  const environment = useWorkspaceEnvironment();
  const live = useWorkspaceQuery(readGraph, network.selectedStep === null && adapter?.mode !== 'embedded');
  const graph = useMemo(() => {
    if (!network.selectedStep && environment.frame && adapter) {
      return mergeRuntimeGraphProjections([projectRuntimeEnv(environment.frame, {
        runtimeId: adapter.runtimeId, label: adapter.runtimeId, adapterKind: 'browser',
      })], canonicity);
    }
    const frames = network.selectedStep ? [...network.frames.values()] : live.snapshot.data ? [live.snapshot.data] : [];
    return mergeRuntimeGraphProjections(frames.map(frame => {
      const source = { runtimeId: frame.runtimeId, label: frame.runtimeId, adapterKind: network.selectedStep &&
        networkMachineRuntimeOperations.readSelectedSourceKind() !== 'adapter' ? 'browser' as const
        : adapter?.mode === 'remote' ? 'remote' as const : 'browser' as const };
      return environment.frame && network.selectedStep?.activeRuntimeId === frame.runtimeId
        ? projectRuntimeEnv(environment.frame, source) : projectRuntimeGraphFrame(frame, source);
    }), canonicity);
  }, [network, live.snapshot.data, canonicity, adapter, environment.frame]);
  const tokens = useMemo(() => collectGraphTokenIds(materializeRuntimeGraphReplicas(graph)), [graph]);
  const selectedTokenId = tokens.includes(bird.selectedTokenId) ? bird.selectedTokenId : 1;
  const cue = network.selectedStep?.cues[0] ?? null;
  const options = useMemo(() => ({ barsMode, selectedTokenId, view, cue }), [barsMode, selectedTokenId, view, cue]);
  const latest = useRef({ graph, options, openEntity, openJurisdiction });
  latest.current = { graph, options, openEntity, openJurisdiction };
  useEffect(() => {
    let disposed = false;
    void getXLN().then(runtime => {
      if (disposed || !container.current) return;
      const next = createOpsGraphScene(container.current, runtime, setSelection, setHover, entityId => {
        const node = latest.current.graph.nodes.find(entry => entry.entityId === entityId);
        if (node && latest.current.openEntity) latest.current.openEntity(entityId, node.selected.label);
      }, cause => setIssue(cause instanceof Error ? cause.message : String(cause)), name => latest.current.openJurisdiction?.(name));
      scene.current = next;
      try { next.update(latest.current.graph, latest.current.options); }
      catch (cause) { next.dispose(); scene.current = null; throw cause; }
    }).catch(cause => { if (!disposed) setIssue(cause instanceof Error ? cause.message : String(cause)); });
    return () => { disposed = true; scene.current?.dispose(); scene.current = null; };
  }, []);
  useEffect(() => {
    if (!scene.current) return;
    try { scene.current.update(graph, options); }
    catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
  }, [graph, options]);
  useEffect(() => { scene.current?.select(selection); }, [selection, graph, options]);
  const selectedId = selection?.kind === 'entity' ? selection.id : '';
  const selected = graph.nodes.find(node => node.entityId === selectedId);
  const account = selection?.kind === 'account' ? graph.accounts.find(entry => entry.accountId === selection.id) : null;
  const hoverLabel = hover?.kind === 'entity' ? graph.nodes.find(node => node.entityId === hover.id)?.selected.label : hover?.kind === 'account' ? 'Account · click to inspect' : hover?.kind === 'jurisdiction' ? `${hover.id} · click to inspect` : '';
  return <section className="ops-graph-panel" data-testid="workspace-graph" data-node-count={graph.nodes.length} data-account-count={graph.accounts.length} data-jurisdiction-count={graph.jMachines.length}>
    <header><strong>Graph3D</strong><span>{graph.sources.length} sources · {graph.nodes.length} entities · {graph.accounts.length} accounts · {graph.jMachines.length} jurisdictions</span>
      <button onClick={() => scene.current?.fit()} type="button">{t('workspace.fitNetwork')}</button>
      <button onClick={() => updateOpsGraphBirdSettings({ barsMode: barsMode === 'close' ? 'spread' : 'close' })} type="button">Bars: {barsMode}</button>
      <select aria-label="Graph size token" value={selectedTokenId} onChange={event => {
        const token = Number(event.currentTarget.value);
        if (!tokens.includes(token)) throw new Error('GRAPH_TOKEN_INVALID');
        updateOpsGraphBirdSettings({ selectedTokenId: token });
      }}>{tokens.map(token => <option key={token} value={token}>Size: Token #{token}</option>)}</select>
      <button aria-pressed={view.forceLayoutEnabled} onClick={() => updateOpsGraphViewSettings({ forceLayoutEnabled: !view.forceLayoutEnabled })} type="button">{t('workspace.forceLayout')}</button>
      <button aria-pressed={view.autoRotate} onClick={() => updateOpsGraphViewSettings({ autoRotate: !view.autoRotate })} type="button">{t('workspace.autoRotate')}</button>
      <select aria-label="Graph canonicity" value={canonicity} onChange={event => {
        const option = GRAPH3D_CANONICITY_OPTIONS.find(item => item.value === event.currentTarget.value);
        if (!option) throw new Error('GRAPH_CANONICITY_INVALID');
        runtimeGraphControlOperations.setCanonicity(option.value);
      }}>{GRAPH3D_CANONICITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <select aria-label="Graph Entity" value={selected ? selectedId : ''} onChange={event => setSelection(event.currentTarget.value ? { kind: 'entity', id: event.currentTarget.value } : null)}><option value="">Select Entity</option>{graph.nodes.map(node => <option key={node.entityId} value={node.entityId}>{node.selected.label}</option>)}</select>
      <select aria-label="Graph Account" value={account ? account.accountId : ''} onChange={event => setSelection(event.currentTarget.value ? { kind: 'account', id: event.currentTarget.value } : null)}><option value="">Select Account</option>{graph.accounts.map(entry => <option key={entry.accountId} value={entry.accountId}>{graph.nodes.find(node => node.entityId === entry.selected.leftEntityId)?.selected.label} ↔ {graph.nodes.find(node => node.entityId === entry.selected.rightEntityId)?.selected.label}</option>)}</select>
      <select aria-label="Graph Jurisdiction" value="" disabled={!openJurisdiction} onChange={event => { if (event.currentTarget.value) openJurisdiction?.(event.currentTarget.value); }}><option value="">Open Jurisdiction</option>{graph.jMachines.map(machine => <option key={machine.jMachineId} value={machine.selected.name}>{machine.selected.name}</option>)}</select>
    </header>
    {issue || environment.error || live.snapshot.error ? <p role="alert">{issue || environment.error || live.snapshot.error}</p> : null}
    <div className="ops-graph-stage"><div className="ops-graph-canvas" ref={container} />
      {hoverLabel ? <span className="ops-graph-hover" data-kind={hover?.kind} role="tooltip">{hoverLabel}</span> : null}
    </div>
    {selected ? <aside className="ops-graph-selection"><strong>{selected.selected.label}</strong><code>{selected.entityId}</code><span>h{selected.selected.height}</span>
      {openEntity ? <button onClick={() => openEntity(selected.entityId, selected.selected.label)} type="button">Open Entity</button> : null}
      {network.selectedStep ? <span>Recorded frame</span> : null}
      <button aria-label="Close graph selection" onClick={() => setSelection(null)} type="button">×</button>
    </aside> : null}
    {account ? <aside className="ops-graph-selection" data-testid="graph-account-selection"><header><strong>Account · h{account.selected.height}</strong><button aria-label="Close Account selection" onClick={() => setSelection(null)} type="button">×</button></header><code>{account.selected.leftEntityId}</code><span>↔</span><code>{account.selected.rightEntityId}</code><span>{account.selected.account.state.deltas.size} tokens · {account.provenance.length} Runtime sources</span><span>Rollbacks: {account.selected.account.rollbackCount}</span></aside> : null}
  </section>;
}
