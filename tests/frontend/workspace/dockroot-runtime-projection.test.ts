import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('React Ops resolves Entity panels through bounded Runtime projections', () => {
  const source = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace-source.ts', 'utf8');
  const view = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace.tsx', 'utf8');

  expect(source).toContain('client.readViewFrame({');
  expect(source).toContain('projectOpsEntityWorkspaceFrame(runtimeId, frame)');
  expect(source).toContain('new RuntimeQueryObserver(');
  expect(view).toContain('<EntityWorkspaceShell');
  expect(source).not.toContain('console.warn');
  expect(source).not.toContain('console.error');
  expect(source).not.toContain('env?.state.eReplicas');
  expect(source).not.toContain('jReplicas');
});

test('React Ops workspace includes Architect without a developer-lab gate', () => {
  const source = readFileSync('frontend/apps/ops/src/workspace/session/ops-workspace-panels.ts', 'utf8');

  expect(source).toContain("architect: OpsArchitectPanel");
  expect(source).toContain("{ id: 'architect', component: 'architect', title: 'Architect' }");
  expect(source).toContain("position: { direction: compact ? 'within' : 'below'");
  expect(source).not.toContain('devLabEnabled');
  expect(source).not.toContain('xln-dev-lab');
});

test('React Ops defaults to Graph left plus pinned wallet and tools on the right', () => {
  const source = readFileSync('frontend/apps/ops/src/workspace/session/ops-workspace-panels.ts', 'utf8');
  const workspace = readFileSync('frontend/apps/ops/src/workspace/ops-workspace.tsx', 'utf8');

  expect(source).toContain("{ id: 'graph3d', component: 'graph3d', title: 'Graph3D' }");
  expect(source).toContain("{ id: 'wallet-main', component: 'wallet', title: 'Main Wallet', tabComponent: 'pinned-tab'");
  expect(source).toContain("referencePanel: 'graph3d'");
  expect(source).toContain("referencePanel: compact ? 'graph3d' : 'wallet-main'");
  expect(source).toContain("referencePanel: 'jurisdiction'");
  for (const panelId of [
    'runtime-io', 'settings', 'console', 'gossip', 'solvency', 'entity-audit',
    'jmachine-inspector', 'runtime-manager', 'leveldb-inspector', 'runtime-diagnostics',
  ]) expect(source).toContain(`id: '${panelId}'`);
  expect(workspace).toContain('tabComponents={{ \'pinned-tab\': OpsPinnedTab }}');
  expect(workspace).toContain('<OpsWorkspaceTimeline />');
});

test('React Ops marks RuntimeReplica-only views unavailable on remote or projection-only state', () => {
  const environment = readFileSync('frontend/apps/ops/src/workspace/session/use-workspace-environment.ts', 'utf8');
  const architect = readFileSync('frontend/apps/ops/src/workspace/architect/ops-architect-live-controls.tsx', 'utf8');
  const graph = readFileSync('frontend/apps/ops/src/workspace/graph/ops-graph-panel.tsx', 'utf8');

  expect(environment).toContain("adapter?.mode === 'remote' ? 'This panel requires a local Runtime.");
  expect(environment).toContain("selected && !frame ? 'The selected history frame has no full local Runtime snapshot.'");
  expect(architect).toContain("context.adapter?.mode !== 'embedded'");
  expect(graph).toContain('projectRuntimeGraphFrame(frame, source)');
  expect(graph).toContain('live.snapshot.data');
});

test('React dock opens exact Entity panels and keeps the pinned wallet independently addressable', () => {
  const workspace = readFileSync('frontend/apps/ops/src/workspace/ops-workspace.tsx', 'utf8');
  const settings = readFileSync('frontend/apps/ops/src/workspace/settings/ops-settings-panel.tsx', 'utf8');

  expect(workspace).toContain('const id = `entity-panel:${entityId.toLowerCase()}`;');
  expect(workspace).toContain("api.addPanel({ id, component: 'entity-panel', title, params: { entityId }");
  expect(workspace).toContain("openPanel(api, 'wallet-main')");
  expect(workspace).toContain("const wallet = api.getPanel('wallet-main')");
  expect(settings).toContain("category === 'Presentation'");
  expect(settings).toContain('<OpsSettingsPresentation />');
});
