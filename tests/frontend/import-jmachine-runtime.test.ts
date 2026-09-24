import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  buildJMachineImportRuntimeInput,
  buildPersistedJMachineConfig,
  normalizeJMachineCreateDetail,
} from '../../frontend/bridges/runtime/remote/import-jmachine-runtime';
import { deriveJMachineCreatedAt, normalizeJMachineConfig } from '../../frontend/packages/browser/src/jurisdiction/jmachine-store';

const draft = {
  name: 'local-sim-visual',
  mode: 'browservm' as const,
  chainId: 31337,
  rpcs: ['https://ignored.example'],
  blockTimeMs: 1_000,
  ticker: 'sim',
};

test('JMachine import builds a RuntimeInput importJ command', () => {
  const input = buildJMachineImportRuntimeInput(draft);

  expect(input.entityInputs).toEqual([]);
  expect(input.runtimeTxs).toEqual([{
    type: 'importJ',
    data: {
      name: 'local-sim-visual',
      chainId: 31337,
      ticker: 'SIM',
      rpcs: [],
      blockTimeMs: 1_000,
    },
  }]);
});

test('JMachine persisted metadata is deterministic and preserves existing createdAt', () => {
  const normalized = normalizeJMachineCreateDetail(draft);
  const first = buildPersistedJMachineConfig(draft);
  const second = buildPersistedJMachineConfig(draft);
  const existing = buildPersistedJMachineConfig(draft, null, { ...first, createdAt: 99 });

  expect(first.createdAt).toBe(deriveJMachineCreatedAt(normalized));
  expect(second.createdAt).toBe(first.createdAt);
  expect(existing.createdAt).toBe(99);
});

test('JMachine config normalization does not depend on a wall-clock substitute', () => {
  const config = normalizeJMachineConfig({
    name: 'remote-hub',
    mode: 'rpc',
    chainId: 84532,
    ticker: 'eth',
    rpcs: ['https://base-sepolia.example'],
    blockTimeMs: 2_000,
  });

  expect(config?.createdAt).toBe(deriveJMachineCreatedAt({
    name: 'remote-hub',
    mode: 'rpc',
    chainId: 84532,
    ticker: 'eth',
    rpcs: ['https://base-sepolia.example'],
    blockTimeMs: 2_000,
  }));
});

test('React Architect JMachine import uses the shared deterministic runtime helpers', () => {
  const actions = readFileSync('frontend/apps/ops/src/workspace/architect/ops-architect-actions.ts', 'utf8');
  const controls = readFileSync('frontend/apps/ops/src/workspace/architect/ops-architect-live-controls.tsx', 'utf8');
  const store = readFileSync('frontend/packages/browser/src/jurisdiction/jmachine-store.ts', 'utf8');
  const helper = readFileSync('frontend/bridges/runtime/remote/import-jmachine-runtime.ts', 'utf8');

  expect(actions).toContain('normalizeJMachineCreateDetail(detail)');
  expect(actions).toContain('buildJMachineImportRuntimeInput(normalized)');
  expect(actions).toContain('buildPersistedJMachineConfig(normalized, next)');
  expect(controls).toContain('{issue ? <p role="alert">{issue}</p>');
  expect(helper).toContain('J_MACHINE_IMPORT_COMMIT_WAIT_MS = 3_000');
  expect(helper).toContain('while (!nextEnv.state.jReplicas?.get?.(normalized.name)');
  expect(helper).toContain('await sleep(J_MACHINE_IMPORT_COMMIT_POLL_MS)');
  expect(actions).not.toContain('Date.now()');
  expect(store).not.toContain('Date.now()');
});
