import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runtimeProjectionMatchesRuntime } from '../../../frontend/packages/runtime-client/src/runtime/projection/runtime-projection-identity';

test('runtime projection cannot cross a runtime switch boundary', () => {
  expect(runtimeProjectionMatchesRuntime('runtime-a', 'runtime-a')).toBe(true);
  expect(runtimeProjectionMatchesRuntime('RUNTIME-A', 'runtime-a')).toBe(true);
  expect(runtimeProjectionMatchesRuntime('runtime-a', 'runtime-b')).toBe(false);
  expect(runtimeProjectionMatchesRuntime('', 'runtime-a')).toBe(false);
  expect(runtimeProjectionMatchesRuntime('runtime-a', '')).toBe(false);
});

test('React Entity workspace consumes bounded projections instead of traversing replicas inline', () => {
  const source = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace-source.ts', 'utf8');
  const view = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace.tsx', 'utf8');

  expect(source).toContain('client.readViewFrame({');
  expect(source).toContain('accountsLimit: 8');
  expect(source).toContain('projectOpsEntityWorkspaceFrame(runtimeId, frame)');
  expect(source).toContain('new RuntimeQueryObserver(');
  expect(view).toContain('<EntityWorkspaceShell');
  expect(source).not.toContain('state.eReplicas');
  expect(source).not.toContain('function findEntityReplica');
});

test('Entity workspace has no separate audit, ops, or liquidity lenses in app flow', () => {
  const shell = readFileSync('frontend/packages/ui/src/entity/entity-workspace-shell.tsx', 'utf8');
  const model = readFileSync('frontend/packages/runtime-client/src/runtime/projection/runtime-projection-identity.ts', 'utf8');

  for (const lens of ["'audit'", "'ops'", "'liquidity'"]) {
    expect(model).not.toContain(lens);
    expect(shell).not.toContain(lens);
  }
  expect(shell).toContain('ENTITY_WORKSPACE_SECTIONS.map');
  expect(shell).not.toContain('data-lens');
});

test('Entity settings are projection and authenticated-command surfaces', () => {
  const shell = readFileSync('frontend/packages/ui/src/entity/entity-workspace-shell.tsx', 'utf8');
  const command = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace-profile-command.ts', 'utf8');

  expect(shell).toContain('<EntityWorkspaceSettingsStage');
  expect(shell).toContain('<EntityWorkspaceConsensusPanel');
  expect(shell).toContain('<EntityWorkspaceDisplayPanel');
  expect(shell).toContain('<EntityWorkspaceProfilePanel');
  expect(command).toContain('buildEntityWorkspaceProfileUpdateInput');
  expect(command).toContain('await adapter.ensureOwnerCommandLane()');
  expect(command).toContain("adapter.commandLaneKind !== 'owner'");
  expect(command).not.toContain('eReplicas');
  expect(command).not.toContain('jReplicas');
});

test('Entity panel routing is owned by the React workspace sections', () => {
  const source = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace.tsx', 'utf8');
  const shell = readFileSync('frontend/packages/ui/src/entity/entity-workspace-shell.tsx', 'utf8');

  expect(source).toContain("const activeTab = route.activeTab ?? 'assets';");
  expect(source).toContain("const settingsSubview = route.settingsSubview ?? 'wallet';");
  expect(shell).toContain('data-active-tab={activeTab}');
  expect(shell).toContain('href={`#${section.id}`}');
  expect(source).not.toContain('workspaceLens');
});

test('Entity workspace Runtime identity helper stays projection-only', () => {
  const source = readFileSync('frontend/packages/runtime-client/src/runtime/projection/runtime-projection-identity.ts', 'utf8');
  expect(source).toContain('runtimeProjectionMatchesRuntime');
  expect(source).not.toContain('RuntimeAdapterViewFrame');
  expect(source).not.toContain('RuntimeReplica, EnvSnapshot');
  expect(source).not.toContain('eReplicas');
  expect(source).not.toContain('jReplicas');
});

test('React Entity workspace is the single Ops Entity shell', () => {
  const view = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace.tsx', 'utf8');
  const panel = readFileSync('frontend/apps/ops/src/workspace/entity/ops-entity-panel.tsx', 'utf8');
  const panels = readFileSync('frontend/apps/ops/src/workspace/session/ops-workspace-panels.ts', 'utf8');

  expect(view).toContain('<EntityWorkspaceShell');
  expect(panel).toContain('<OpsEntityWorkspaceView');
  expect(panels).toContain("'entity-panel': OpsEntityPanel");
  expect(panels).toContain("{ id: 'entity-workspace', component: 'entity-panel'");
});

test('remote Entity workspace mounts from RuntimeAdapter projections without RuntimeReplica inference', () => {
  const source = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace-source.ts', 'utf8');
  const session = readFileSync('frontend/apps/ops/src/workspace/session/ops-workspace-session.ts', 'utf8');

  expect(source).toContain("if (snapshot.mode !== 'remote') throw new Error('OPS_ENTITY_REMOTE_SESSION_REQUIRED')");
  expect(source).toContain('openCanonicalOpsRemoteSession');
  expect(source).toContain('createOpsWorkspaceQueryClient(adapter)');
  expect(source).toContain('client.readViewFrame({');
  expect(session).toContain('for (const source of this.sources) source.configure(config);');
  expect(session).toContain('await Promise.all([...this.sources].map(source => source.start()))');
  expect(source).not.toContain('activeEnv');
  expect(source).not.toContain('RuntimeReplica');
});

test('recorded projection context stays separate from the live adapter command context', () => {
  const runtime = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace-runtime.ts', 'utf8');
  const source = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace-source.ts', 'utf8');
  const command = readFileSync('frontend/apps/ops/src/entity-workspace/ops-entity-workspace-profile-command.ts', 'utf8');

  expect(runtime).toContain('opsWorkspaceSession.setRecording(selected ? {');
  expect(runtime).toContain('snapshot: networkMachineRuntimeOperations.readSelectedSnapshot()');
  expect(source).toContain('private recording: OpsWorkspaceRecording | null = null;');
  expect(source).toContain("if (this.recording && this.recording.kind !== 'adapter')");
  expect(command).toContain("if (this.dependencies.isHistoryActive()) throw new Error('OPS_ENTITY_PROFILE_LIVE_MODE_REQUIRED')");
});

test('remote projection Entity workspace keeps accounts, reserves, and settings visible', () => {
  const shell = readFileSync('frontend/packages/ui/src/entity/entity-workspace-shell.tsx', 'utf8');

  expect(shell).toContain('<EntityWorkspaceReservesPanel reserves={reserves} />');
  expect(shell).toContain('<EntityWorkspaceAccountsPanel accounts={accounts}');
  expect(shell).toContain('<EntityWorkspaceSettingsStage settingsSubview={settingsSubview}>');
  expect(shell).toContain("readState.status === 'ready' && context.status === 'selected'");
  expect(shell).not.toContain('RuntimeReplica');
  expect(shell).not.toContain('EnvSnapshot');
});
