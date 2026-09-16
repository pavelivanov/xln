import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { calculateSolvency } from '../../core/api/public/public-utilities';
import { buildSolvencyProjection } from '../../frontend/packages/runtime-client/src/panels/solvency-panel-view';

test('solvency projection counts committed reserves and collateral once and excludes pending frames', () => {
  const left = `0x${'11'.repeat(32)}`;
  const right = `0x${'22'.repeat(32)}`;
  const depository = `0x${'33'.repeat(20)}`;
  const config = {
    mode: 'proposer-based', threshold: 1n, validators: ['signer'], shares: { signer: 1n },
    jurisdiction: {
      address: depository, name: 'Testnet', chainId: 31337,
      entityProviderAddress: `0x${'44'.repeat(20)}`, depositoryAddress: depository,
    },
  } as const;
  const frame = {
    state: { eReplicas: new Map([
      ['left:signer', {
        state: {
          entityId: left,
          height: 1,
          config,
          reserves: new Map([[1, 150n]]),
          accounts: new Map([[right, {
            state: {
              deltas: new Map([[1, { collateral: 100n }]]),
            },
            pendingFrame: {
              deltas: [{ tokenId: 1, collateral: 50n }],
            },
          }]]),
        },
      }],
      ['right:signer', {
        state: {
          entityId: right,
          height: 1,
          config,
          reserves: new Map(),
          accounts: new Map([[left, {
            state: {
              deltas: new Map([[1, { collateral: 100n }]]),
            },
            pendingFrame: {
              deltas: [{ tokenId: 1, collateral: 50n }],
            },
          }]]),
        },
      }],
    ]) },
  };

  expect(buildSolvencyProjection(calculateSolvency(frame))).toEqual({
    assets: [
      {
        stackId: `31337:${depository}`,
        chainId: 31337,
        depositoryAddress: depository,
        tokenId: 1,
        reserves: 150n,
        confirmedCollateral: 100n,
        internalValue: 250n,
        expectedInternalValue: null,
        delta: null,
        isValid: null,
      },
    ],
    isValid: null,
  });
});

test('solvency projection fails loud on malformed amounts', () => {
  const frame = {
    state: { eReplicas: new Map([
      ['entity:signer', {
        state: {
          entityId: `0x${'11'.repeat(32)}`,
          height: 1,
          config: {
            mode: 'proposer-based', threshold: 1n, validators: ['signer'], shares: { signer: 1n },
            jurisdiction: {
              address: `0x${'33'.repeat(20)}`, name: 'Testnet', chainId: 31337,
              entityProviderAddress: `0x${'44'.repeat(20)}`, depositoryAddress: `0x${'33'.repeat(20)}`,
            },
          },
          reserves: new Map([[1, 'not-a-number']]),
          accounts: new Map(),
        },
      }],
    ]) },
  };

  expect(() => buildSolvencyProjection(calculateSolvency(frame))).toThrow('bigint-compatible amount');
});

test('React Solvency reads the selected live or recorded source and preserves error and ownership boundaries', () => {
  const panel = readFileSync('frontend/apps/ops/src/workspace/panels/ops-solvency-panel.tsx', 'utf8');
  const sharedView = readFileSync('frontend/packages/runtime-client/src/panels/solvency-panel-view.ts', 'utf8');
  const queries = readFileSync('frontend/apps/ops/src/workspace/session/ops-workspace-query.ts', 'utf8');
  const subscription = readFileSync('frontend/apps/ops/src/workspace/session/use-workspace-query.ts', 'utf8');
  const selected = readFileSync('frontend/bridges/runtime/network-machine-runtime-store.ts', 'utf8');
  const sources = readFileSync('frontend/packages/ui/src/graph/network-timeline-source.ts', 'utf8');
  const panels = readFileSync('frontend/apps/ops/src/workspace/session/ops-workspace-panels.ts', 'utf8');
  const architect = readFileSync('frontend/apps/ops/src/workspace/panels/ops-architect-panel.tsx', 'utf8');

  expect(panel).toContain('useWorkspaceQuery(readOpsSolvency)');
  expect(queries).toContain('client.readSolvencySummary()');
  expect(panel).toContain('networkMachineRuntimeOperations.readSelectedSolvency()');
  expect(selected).toContain('requireSource(step.activeRuntimeId)');
  expect(selected).toContain('source.readSolvency(step.event.height)');
  expect(sources).toContain("adapter.read<RuntimeAdapterSolvencySummary>('solvency-summary', { atHeight: height })");
  expect(sources).toContain('projectSolvency(snapshotAt(height))');
  expect(panel).toContain('recorded?.step === step ? recorded : null');
  expect(panel).toContain('return () => { current = false; }');
  expect(subscription).toContain('query?.client === client && query?.reader === reader');
  expect(subscription).toContain('return observer.destroy');
  expect(panel).toContain('error={step ? selected?.error ?? null : snapshot.error}');
  expect(panel).toContain('getSolvencyStatusView(data === null ? null : data.isValid)');
  expect(sharedView).toContain('ASSET CONSERVATION OK');
  expect(panel).not.toContain('SYSTEM SOLVENT');
  expect(panel).not.toContain("calculateSolvency");
  expect(panel).not.toContain('xlnEnvironment');
  expect(panel).not.toContain('Date.now');
  expect(panel).not.toContain('return `$${');
  expect(panels).toContain('solvency: OpsSolvencyPanel');
  expect(panels).toContain("id: 'solvency', component: 'solvency'");
  expect(architect).toContain('<OpsSolvencyPanel />');
});
