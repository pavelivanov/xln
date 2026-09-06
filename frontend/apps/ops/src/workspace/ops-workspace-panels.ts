import type { AddPanelOptions } from 'dockview';
import { OpsEntityPanel } from './ops-entity-panel';
import { OpsGossipPanel } from './ops-gossip-panel';
import { OpsSolvencyPanel } from './ops-solvency-panel';
import { OpsRuntimeDiagnosticsPanel } from './ops-runtime-diagnostics-panel';
import { OpsDatabaseInspector } from './ops-database-inspector';
import { OpsRuntimeManager } from './ops-runtime-manager';
import { OpsConsolePanel } from './ops-console-panel';
import { OpsRuntimeIoPanel } from './ops-runtime-io-panel';
import { OpsJMachineInspector } from './ops-jmachine-inspector';
import { OpsEntityAuditPanel } from './ops-entity-audit-panel';
import { OpsGraphPanel } from './ops-graph-panel';
import { OpsSettingsPanel } from './ops-settings-panel';
import { OpsWalletPanel } from './ops-wallet-panel';
import { OpsJurisdictionPanel } from './ops-jurisdiction-panel';
import { OpsArchitectPanel } from './ops-architect-panel';
import { OpsBrainVaultPanel } from './ops-brainvault-panel';

export const components = {
  'entity-panel': OpsEntityPanel,
  gossip: OpsGossipPanel,
  solvency: OpsSolvencyPanel,
  'runtime-diagnostics': OpsRuntimeDiagnosticsPanel,
  graph3d: OpsGraphPanel,
  'entity-audit': OpsEntityAuditPanel,
  console: OpsConsolePanel,
  'leveldb-inspector': OpsDatabaseInspector,
  'runtime-manager': OpsRuntimeManager,
  'runtime-io': OpsRuntimeIoPanel,
  'jmachine-inspector': OpsJMachineInspector,
  settings: OpsSettingsPanel,
  wallet: OpsWalletPanel,
  jurisdiction: OpsJurisdictionPanel,
  architect: OpsArchitectPanel,
  brainvault: OpsBrainVaultPanel,
};

export const panels = [
  { id: 'entity-workspace', component: 'entity-panel', title: 'Entity' },
  { id: 'gossip', component: 'gossip', title: 'Gossip' },
  { id: 'solvency', component: 'solvency', title: 'Solvency' },
  { id: 'runtime-diagnostics', component: 'runtime-diagnostics', title: 'Runtime Diagnostics' },
  { id: 'graph3d', component: 'graph3d', title: 'Graph3D' },
  { id: 'entity-audit', component: 'entity-audit', title: 'Entity Audit' },
  { id: 'console', component: 'console', title: 'Console' },
  { id: 'leveldb-inspector', component: 'leveldb-inspector', title: 'LevelDB' },
  { id: 'runtime-manager', component: 'runtime-manager', title: 'Runtimes' },
  { id: 'runtime-io', component: 'runtime-io', title: 'Runtime I/O' },
  { id: 'jmachine-inspector', component: 'jmachine-inspector', title: 'J-Machine Inspector' },
  { id: 'settings', component: 'settings', title: 'Settings' },
  { id: 'wallet-main', component: 'wallet', title: 'Wallet' },
  { id: 'jurisdiction', component: 'jurisdiction', title: 'Jurisdiction' },
  { id: 'architect', component: 'architect', title: 'Architect' },
  { id: 'brainvault', component: 'brainvault', title: 'BrainVault' },
] as const;

export const createInternalWorkspacePanels = (plain: boolean): readonly AddPanelOptions[] =>
  (plain ? panels : panels.filter(panel => panel.id === 'graph3d')).map((panel, index) => ({
    ...panel,
    ...(index > 0 ? { position: { direction: 'within', referencePanel: 'entity-workspace' }, inactive: true } : {}),
  }));

export const isCompactWorkspace = (embedMode: boolean, width: number): boolean => !embedMode && width <= 760;

export const createFullWorkspacePanels = (embedMode: boolean, width: number, height: number): readonly AddPanelOptions[] => {
  const compact = isCompactWorkspace(embedMode, width);
  return [
    { id: 'graph3d', component: 'graph3d', title: 'Graph3D' },
    { id: 'wallet-main', component: 'wallet', title: 'Main Wallet', tabComponent: 'pinned-tab',
      position: { direction: compact ? 'within' : 'right', referencePanel: 'graph3d' }, inactive: compact },
    { id: 'architect', component: 'architect', title: 'Architect',
      position: { direction: compact ? 'within' : 'below', referencePanel: compact ? 'graph3d' : 'wallet-main' },
      ...(compact ? { inactive: true } : { initialHeight: Math.max(240, Math.floor(height * .32)) }) },
    { id: 'jurisdiction', component: 'jurisdiction', title: 'J-Machine',
      position: { direction: compact ? 'within' : 'right', referencePanel: compact ? 'graph3d' : 'architect' }, inactive: compact },
    ...(['runtime-io', 'settings', 'console', 'gossip', 'solvency', 'entity-audit', 'jmachine-inspector', 'runtime-manager', 'leveldb-inspector', 'runtime-diagnostics'] as const).map(id => {
      const panel = panels.find(panel => panel.id === id);
      if (!panel) throw new Error(`OPS_WORKSPACE_PANEL_UNKNOWN:${id}`);
      return panel;
    })
      .map(panel => ({ ...panel, position: { direction: 'within' as const, referencePanel: 'jurisdiction' }, inactive: true })),
  ];
};
