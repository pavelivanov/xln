import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  assertExternalSnapshotCount,
  normalizeOptionalTokenId,
  readExternalWalletSnapshotSource,
  requireExternalSnapshotBigInt,
  resolveExternalWalletSnapshotIngress,
  resolveExternalWalletFinalityDepth,
} from '../../../frontend/bridges/wallet/external-wallet-snapshot';

const adapterFixture = (input: { head?: unknown; finalityDepth?: unknown; blockHash?: string | null }) => ({
  getCurrentBlockNumber: input.head === undefined ? undefined : async () => input.head,
  getFinalityDepth: input.finalityDepth === undefined ? undefined : () => input.finalityDepth,
  provider: {
    getBlockNumber: async () => input.head ?? 10,
    getBlock: async (height: number) =>
      input.blockHash === null ? null : { number: height, hash: input.blockHash ?? `0xblock${height}` },
  },
});

describe('external wallet snapshot helpers', () => {
  test('requires bigint snapshot fields and exact array counts', () => {
    expect(requireExternalSnapshotBigInt(7n, 'nativeBalance')).toBe(7n);
    expect(() => requireExternalSnapshotBigInt(null, 'nativeBalance')).toThrow(
      'EXTERNAL_WALLET_SNAPSHOT_FIELD_MISSING:nativeBalance',
    );
    expect(() => assertExternalSnapshotCount([1, 2], 3, 'allowances')).toThrow(
      'EXTERNAL_WALLET_SNAPSHOT_FIELD_COUNT_MISMATCH:allowances:expected=3:actual=2',
    );
  });

  test('normalizes optional token ids conservatively', () => {
    expect(normalizeOptionalTokenId(2)).toBe(2);
    expect(normalizeOptionalTokenId(3n)).toBe(3);
    expect(normalizeOptionalTokenId('4')).toBe(4);
    expect(normalizeOptionalTokenId(-1)).toBeUndefined();
    expect(normalizeOptionalTokenId('not-number')).toBeUndefined();
    expect(normalizeOptionalTokenId(2.5)).toBe(2.5);
  });

  test('resolves finality depth and snapshot source from adapter state', async () => {
    const adapter = adapterFixture({ head: 12, finalityDepth: 2, blockHash: '0xsource' }) as any;

    expect(resolveExternalWalletFinalityDepth(adapter)).toBe(2);
    await expect(readExternalWalletSnapshotSource(adapter)).resolves.toEqual({
      headBlockNumber: 12,
      sourceHeight: 10,
      sourceHash: '0xsource',
      finalityDepth: 2,
    });
  });

  test('fails loud on invalid finality, head, unavailable source, or missing block hash', async () => {
    expect(() => resolveExternalWalletFinalityDepth(adapterFixture({ finalityDepth: -1 }) as any)).toThrow(
      'EXTERNAL_WALLET_SNAPSHOT_FINALITY_INVALID:-1',
    );
    await expect(readExternalWalletSnapshotSource(adapterFixture({ head: -1 }) as any)).rejects.toThrow(
      'EXTERNAL_WALLET_SNAPSHOT_HEAD_INVALID:-1',
    );
    await expect(
      readExternalWalletSnapshotSource(adapterFixture({ head: 1, finalityDepth: 2 }) as any),
    ).rejects.toThrow('EXTERNAL_WALLET_SNAPSHOT_FINALITY_UNAVAILABLE:head=1:depth=2');
    await expect(
      readExternalWalletSnapshotSource(adapterFixture({ head: 3, finalityDepth: 1, blockHash: null }) as any),
    ).rejects.toThrow('EXTERNAL_WALLET_SNAPSHOT_BLOCK_HASH_MISSING:2');
  });

  test('cancels an in-flight local observation after runtime switch or quiesce', () => {
    const running = {
      runtimeId: '0xAbC',
      infrastructure: { lifecyclePhase: 'running', persistenceQuiescing: false },
    } as any;
    const quiescing = {
      runtimeId: '0xabc',
      infrastructure: { lifecyclePhase: 'quiescing', persistenceQuiescing: true },
    } as any;

    expect(resolveExternalWalletSnapshotIngress('0xabc', running)).toBe('apply');
    expect(resolveExternalWalletSnapshotIngress('0xabc', quiescing)).toBe('cancel-runtime-quiescing');
    expect(resolveExternalWalletSnapshotIngress('0xabc', { ...running, runtimeId: '0xdef' })).toBe(
      'cancel-runtime-changed',
    );
    expect(resolveExternalWalletSnapshotIngress('0xabc', null)).toBe('cancel-runtime-changed');
    expect(() => resolveExternalWalletSnapshotIngress('', running)).toThrow(
      'EXTERNAL_WALLET_SNAPSHOT_RUNTIME_ID_MISSING',
    );
  });

  test('remote projection sessions read external wallet snapshots through API without live RuntimeReplica', () => {
    const reader = readFileSync('frontend/bridges/wallet/external-wallet-reader.ts', 'utf8');
    expect(reader).toContain("body: JSON.stringify({ entityId, owner, tokenAddresses, allowances: allowanceReads })");
    expect(reader).toContain('fetch(`${apiBase}/api/external-wallet/snapshot`');
    expect(reader).toContain('signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)');
    expect(reader).not.toContain('RuntimeReplica');
  });

  test('local wallet reads never certify an incomplete jurisdiction block', () => {
    const source = readFileSync('frontend/bridges/wallet/external-wallet-reader.ts', 'utf8');
    const start = source.indexOf('export async function requestExternalWalletSnapshot');
    const end = source.indexOf('function buildExternalWalletStateSyncSignature', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const requestSource = source.slice(start, end);
    expect(requestSource).not.toContain("'ExternalWalletSnapshot'");
    expect(requestSource).not.toContain("'external-wallet-snapshot-ui-local'");
  });

  test('live wallet balances refresh through read-only snapshots without producing consensus input', () => {
    const source = readFileSync('frontend/apps/wallet/src/onboarding/wallet-external-provider-source.ts', 'utf8');
    const view = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-external.tsx', 'utf8');
    const reader = readFileSync('frontend/bridges/wallet/external-wallet-reader.ts', 'utf8');
    expect(reader).toContain('signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)');
    expect(source).toContain('readonly refresh = async (): Promise<void>');
    expect(view).toContain('onClick={() => void source.refresh()}');
    expect(source).toContain('if (outcome.contextCurrent) await this.refresh();');
    expect(source).not.toContain("'external-wallet-snapshot-ui-local'");
  });

  test('external wallet snapshot transport failures are non-fatal persistent diagnostics', () => {
    const source = readFileSync('frontend/apps/wallet/src/onboarding/wallet-external-provider-source.ts', 'utf8');
    const view = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-external-state.tsx', 'utf8');
    const reader = readFileSync('frontend/bridges/wallet/external-wallet-reader.ts', 'utf8');
    expect(reader).toContain('function isExternalWalletSnapshotTransportFailure(message: string): boolean');
    expect(source).toContain("status: 'error'");
    expect(source).toContain('message: error instanceof Error ? error.message : String(error)');
    expect(view).toContain("snapshot.status === 'error' ? 'alert' : 'status'");
    expect(source).not.toContain('console.warn');
    expect(source).not.toContain('console.error');
    expect(source).not.toContain('console.info');
  });
});
