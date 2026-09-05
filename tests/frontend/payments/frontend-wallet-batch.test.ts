import { describe, expect, test } from 'bun:test';
import { formatTokenAmount } from '../../../core/account/financial-utils';
import { initJBatch } from '../../../core/jurisdiction/machine/batch';
import { buildWalletBatchTx, decodeWalletBatch } from '../../../frontend/apps/wallet/src/wallet-batch-model';

describe('wallet jurisdiction batch controls', () => {
  test('reviews all returned operations and refuses a changed draft', () => {
    const state = initJBatch();
    state.batch.reserveToReserve.push({ toEntity: `0x${'22'.repeat(32)}`, tokenId: 1, amount: 25_000_000n });
    state.status = 'accumulating';
    const reviewed = decodeWalletBatch(state, { formatTokenAmount });
    expect(reviewed.draft).toHaveLength(1);
    expect(reviewed.draft[0]?.details).toContain('25000000');
    expect(buildWalletBatchTx('broadcast', reviewed, reviewed)).toEqual({ type: 'j_broadcast', data: {} });
    state.batch.reserveToReserve[0]!.amount += 1n;
    expect(() => buildWalletBatchTx('broadcast', decodeWalletBatch(state, { formatTokenAmount }), reviewed)).toThrow('Batch changed');
  });

  test('keeps draft broadcast and in-flight rebroadcast mutually exclusive', () => {
    const state = initJBatch();
    const empty = decodeWalletBatch(state, { formatTokenAmount });
    expect(() => buildWalletBatchTx('broadcast', empty, empty)).toThrow('nonempty draft');
    expect(() => buildWalletBatchTx('rebroadcast', empty, empty)).toThrow('No in-flight batch');
    state.batch.reserveToReserve.push({ toEntity: `0x${'22'.repeat(32)}`, tokenId: 1, amount: 1n });
    const sent = decodeWalletBatch({ ...state, status: 'sent', sentBatch: {
      batch: state.batch, batchHash: `0x${'ab'.repeat(32)}`,
      lastFailure: { message: 'RPC unavailable' },
    } }, { formatTokenAmount });
    expect(sent.failure).toBe('RPC unavailable');
    expect(() => buildWalletBatchTx('broadcast', sent, sent)).toThrow('no in-flight batch');
    expect(buildWalletBatchTx('rebroadcast', sent, sent)).toEqual({ type: 'j_rebroadcast', data: { gasBumpBps: 1_000 } });
    expect(buildWalletBatchTx('clear', sent, sent)).toMatchObject({ type: 'j_clear_batch' });
  });

  test('fails visibly when an operation collection is malformed', () => {
    const state = initJBatch();
    expect(() => decodeWalletBatch({ ...state, batch: { ...state.batch, settlements: null } }, { formatTokenAmount }))
      .toThrow('WALLET_BATCH_OPERATIONS_INVALID:settlements');
  });
});
