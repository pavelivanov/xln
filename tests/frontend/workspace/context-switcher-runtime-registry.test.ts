import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const manager = () => readFileSync(
  'frontend/apps/ops/src/workspace/runtime/ops-runtime-manager.tsx',
  'utf8',
);
const selection = () => readFileSync(
  'frontend/apps/ops/src/workspace/runtime/ops-runtime-selection.ts',
  'utf8',
);

test('React Ops renders one focused Runtime manager beside the Entity workspace', () => {
  const source = manager();
  const panels = readFileSync('frontend/apps/ops/src/workspace/session/ops-workspace-panels.ts', 'utf8');

  expect(source).toContain('data-testid="remote-runtime-manager"');
  expect(source).toContain('Selected: {adapter ?');
  expect(source).toContain('<h3>Attached Runtimes</h3>');
  expect(panels).toContain("{ id: 'entity-workspace', component: 'entity-panel'");
  expect(panels).toContain("{ id: 'runtime-manager', component: 'runtime-manager'");
});

test('React Ops hydrates the shared remote Runtime registry before showing rows', () => {
  const source = manager();

  expect(source).toContain('useState(() => readStoredRemoteRuntimeImports())');
  expect(source).toContain('imports.map(entry =>');
  expect(source).toContain('<strong>{entry.label}</strong><code>{entry.runtimeId}</code>');
  expect(source).not.toContain('runtime.env');
  expect(source).not.toContain('eReplicas');
});

test('React Ops rejects overlapping Runtime selection before an async switch', () => {
  const source = selection();
  const guard = source.indexOf("if (selecting) throw new Error('OPS_RUNTIME_SELECTION_IN_PROGRESS')");
  const select = source.indexOf('await opsWorkspaceSession.select', guard);

  expect(guard).toBeGreaterThan(0);
  expect(select).toBeGreaterThan(guard);
  expect(source).toContain('finally { selecting = false; }');
});

test('remote rows persist and select the exact validated Runtime entry', () => {
  const source = `${manager()}\n${selection()}`;

  expect(source).toContain('await selectWorkspaceRuntime(entry)');
  expect(source).toContain('writeRemoteRuntimeAdapterSession(stores, { wsUrl: entry.wsUrl, access: entry.access, authKey: entry.token });');
  expect(source).toContain('await opsWorkspaceSession.select(readRuntimeAdapterStorageSnapshot(stores));');
  expect(source).toContain("if (state.status === 'error') throw new Error(state.message)");
});

test('projection-only remote Runtimes retain their explicit registry identity', () => {
  const source = manager();

  expect(source).toContain('key={entry.runtimeId}');
  expect(source).toContain('<strong>{entry.label}</strong><code>{entry.runtimeId}</code>');
  expect(source).not.toContain('entities[0]');
  expect(source).not.toContain('derivedEntities');
});

test('Runtime controls keep embedded selection visible and gate remote attachment by validation', () => {
  const source = manager();

  expect(source).toContain('Use browser Runtime');
  expect(source).toContain("if (!token.trim().startsWith('xlnra1.'))");
  expect(source).toContain('const result = await importRemoteRuntimeEntries(entries, { activateFirst: false');
  expect(source).toContain('if (!first) throw new Error');
});

test('empty Entity state still leaves the Runtime manager accessible', () => {
  const panels = readFileSync('frontend/apps/ops/src/workspace/session/ops-workspace-panels.ts', 'utf8');
  const workspace = readFileSync('frontend/apps/ops/src/workspace/ops-workspace.tsx', 'utf8');

  expect(panels).toContain("'runtime-manager': OpsRuntimeManager");
  expect(panels).toContain("{ id: 'runtime-manager', component: 'runtime-manager'");
  expect(workspace).toContain('panels.map(panel =>');
  expect(workspace).toContain('openPanel(api, panel.id)');
});
