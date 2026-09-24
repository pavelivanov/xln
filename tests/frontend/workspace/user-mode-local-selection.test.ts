import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolveActiveLocalReplica } from '../../../frontend/packages/runtime-client/src/runtime/local-runtime-selection';

type Replica = { entityId: string; signerId: string };

describe('local runtime Entity selection', () => {
  test('waits for exact vault Entity + signer metadata instead of using Map order', () => {
    const wrong = { entityId: '0xentity-b', signerId: '0xsigner-b' };
    const expected = { entityId: '0xentity-a', signerId: '0xsigner-a' };
    const replicas = new Map<string, Replica>([
      [`${wrong.entityId}:${wrong.signerId}`, wrong],
      [`${expected.entityId}:${expected.signerId}`, expected],
    ]);

    expect(resolveActiveLocalReplica(replicas, null)).toBeNull();
    expect(resolveActiveLocalReplica(replicas, { address: expected.signerId })).toBeNull();
    expect(resolveActiveLocalReplica(replicas, {
      entityId: expected.entityId.toUpperCase(),
      address: expected.signerId.toUpperCase(),
    })).toBe(expected);
  });

  test('React Wallet binds the projected Entity explicitly and has no first-replica inference', () => {
    const source = readFileSync('frontend/apps/wallet/src/portfolio/wallet-portfolio-source.ts', 'utf8');
    const selection = readFileSync('frontend/apps/wallet/src/runtime/wallet-workspace-selection.ts', 'utf8');

    expect(source).toContain('this.selectedEntityId = this.selection.bindRuntime(this.adapter.runtimeId)');
    expect(source).toContain('this.selection.selectEntity(this.requireAdapter().runtimeId, normalized)');
    expect(source).toContain('requireWalletWorkspaceEntity(decodeWalletPortfolioProjection');
    expect(selection).toContain('if (runtimeId !== this.snapshot.runtimeId) this.publish(emptySelection(runtimeId));');
    expect(selection).toContain('const normalized = normalizeEntityIdForRuntimeView(entityId);');
    expect(`${source}\n${selection}`).not.toContain('firstReplicaInFrame');
  });
});
