import { useEffect, useState } from 'react';
import { themeDark, type AddPanelOptions, type DockviewApi } from 'dockview';

import { WorkspaceDock } from '../../../../packages/ui/src/workspace-dock';
import { OpsEntityWorkspaceView } from '../ops-entity-workspace';
import { OpsShell } from '../ops-shell';
import { OpsGossipPanel } from './ops-gossip-panel';
import { OpsSolvencyPanel } from './ops-solvency-panel';
import { OpsRuntimeDiagnosticsPanel } from './ops-runtime-diagnostics-panel';
import './ops-workspace.css';

function EntityPanel() {
  return <div className="workspace-entity-pane"><OpsEntityWorkspaceView /></div>;
}

const components = {
  'entity-panel': EntityPanel,
  gossip: OpsGossipPanel,
  solvency: OpsSolvencyPanel,
  'runtime-diagnostics': OpsRuntimeDiagnosticsPanel,
};

const panels = [
  { id: 'entity-workspace', component: 'entity-panel', title: 'Entity' },
  { id: 'gossip', component: 'gossip', title: 'Gossip' },
  { id: 'solvency', component: 'solvency', title: 'Solvency' },
  { id: 'runtime-diagnostics', component: 'runtime-diagnostics', title: 'Runtime Diagnostics' },
] as const;

const initialPanels: readonly AddPanelOptions[] = panels.map((panel, index) => ({
  ...panel,
  ...(index > 0 ? { position: { direction: 'within', referencePanel: 'entity-workspace' }, inactive: true } : {}),
}));

const openPanel = (api: DockviewApi, id: string): void => {
  const existing = api.getPanel(id);
  if (existing) { existing.api.setActive(); return; }
  const definition = panels.find(panel => panel.id === id);
  if (!definition) throw new Error(`OPS_WORKSPACE_PANEL_UNKNOWN:${id}`);
  const activePanel = api.activePanel;
  api.addPanel({
    ...definition,
    ...(activePanel ? { position: { direction: 'within', referencePanel: activePanel.id } } : {}),
  });
};

export function OpsWorkspacePage() {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const [issue, setIssue] = useState('');
  useEffect(() => {
    if (!api) return;
    const focusEntity = (): void => openPanel(api, 'entity-workspace');
    window.addEventListener('hashchange', focusEntity);
    return () => window.removeEventListener('hashchange', focusEntity);
  }, [api]);
  return (
    <OpsShell activePath="/embed">
      <section className="ops-workspace" data-testid="ops-workspace">
        <header className="ops-workspace-toolbar">
          <strong>Workspace</strong>
          <nav aria-label="Workspace panels">
            {panels.map(panel => (
              <button aria-label={`Open ${panel.title} panel`} disabled={api === null} key={panel.id} onClick={() => { if (api) openPanel(api, panel.id); }} type="button">{panel.title}</button>
            ))}
          </nav>
        </header>
        {issue ? <p className="workspace-read-state is-error" role="alert">{issue}</p> : null}
        <div className="ops-workspace-dock" data-testid="ops-workspace-dock">
          <WorkspaceDock
            components={components}
            onDiagnostic={diagnostic => setIssue(diagnostic.cause instanceof Error ? diagnostic.cause.message : String(diagnostic.cause))}
            onReady={event => setApi(event.api)}
            panels={initialPanels}
            // The complete canonical registry owns its persisted layout. This
            // in-progress internal host must not overwrite it with a partial registry.
            storage={null}
            theme={themeDark}
          />
        </div>
      </section>
    </OpsShell>
  );
}
