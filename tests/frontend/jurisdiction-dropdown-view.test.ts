import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('React jurisdiction selector consumes the projected graph instead of a global runtime store', () => {
  const dropdown = readFileSync('frontend/apps/ops/src/workspace/graph/ops-graph-panel.tsx', 'utf8');
  const projection = readFileSync('frontend/packages/ui/src/graph/runtime-graph-projection.ts', 'utf8');

  expect(dropdown).toContain('graph.jMachines.map(machine =>');
  expect(dropdown).toContain('openJurisdiction?.(event.currentTarget.value)');
  expect(dropdown).not.toContain('xlnEnvironment');
  expect(dropdown).not.toContain('$xlnEnvironment');
  expect(projection).toContain('jMachines: MergedRuntimeGraphJMachine[]');
});
