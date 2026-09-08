import { describe, expect, test } from 'bun:test';
import { formatTokenAmount } from '../../../core/account/financial-utils';
import { initJBatch } from '../../../core/jurisdiction/machine/batch';
import {
  buildWalletBatchTx,
  decodeWalletBatch,
  mergeWalletBatchRuntimeSubmission,
} from '../../../frontend/apps/wallet/src/commands/wallet-batch-model';
import { buildWalletBatchNotice } from '../../../frontend/apps/wallet/src/payments/commands/wallet-batch-notice-model';

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
      entityNonce: 4, submitAttempts: 2, firstSubmittedAt: 10, lastSubmittedAt: 20,
      lastFailure: { message: 'RPC unavailable', failedAt: 21 },
    } }, { formatTokenAmount });
    expect(sent.failure).toBe('RPC unavailable');
    expect(sent).toMatchObject({ failureKind: 'retryable', failureAt: 21, submission: {
      entityNonce: 4, submitAttempts: 2, txHash: '',
    } });
    expect(buildWalletBatchNotice(sent)).toMatchObject({
      kind: 'retryable', title: 'Submission needs retry', batchHash: `0x${'ab'.repeat(32)}`,
    });
    expect(() => buildWalletBatchTx('broadcast', sent, sent)).toThrow('no in-flight batch');
    expect(buildWalletBatchTx('rebroadcast', sent, sent)).toEqual({ type: 'j_rebroadcast', data: { gasBumpBps: 1_000 } });
    expect(buildWalletBatchTx('clear', sent, sent)).toMatchObject({ type: 'j_clear_batch' });
  });

  test('quarantines terminal failure and reports observed finality', () => {
    const state = initJBatch();
    state.batch.reserveToReserve.push({ toEntity: `0x${'22'.repeat(32)}`, tokenId: 1, amount: 1n });
    const hash = `0x${'cd'.repeat(32)}`;
    const terminal = decodeWalletBatch({ ...state, status: 'failed', sentBatch: {
      batch: state.batch, batchHash: hash, txHash: `0x${'ef'.repeat(32)}`,
      entityNonce: 7, submitAttempts: 1, firstSubmittedAt: 30, lastSubmittedAt: 30,
      lastFailure: { message: 'nonce consumed', failedAt: 31 },
      terminalFailure: { message: 'nonce consumed', failedAt: 31 },
    } }, { formatTokenAmount });
    expect(buildWalletBatchNotice(terminal)).toMatchObject({
      kind: 'terminal', title: 'Submission quarantined', batchHash: hash,
    });
    expect(() => buildWalletBatchTx('rebroadcast', terminal, terminal)).toThrow('terminally failed');
    expect(buildWalletBatchNotice(decodeWalletBatch(undefined, { formatTokenAmount }), hash)).toEqual({
      kind: 'confirmed', title: 'Batch confirmed',
      detail: 'Chain finality removed the batch from the pending queue.', batchHash: hash,
    });
  });

  test('merges only the matching live Runtime submission envelope', () => {
    const state = initJBatch();
    state.batch.reserveToReserve.push({ toEntity: `0x${'22'.repeat(32)}`, tokenId: 1, amount: 1n });
    const hash = `0x${'ab'.repeat(32)}`;
    const sent = decodeWalletBatch({ ...state, status: 'sent', sentBatch: {
      batch: state.batch, batchHash: hash, entityNonce: 4, submitAttempts: 0,
      firstSubmittedAt: 10, lastSubmittedAt: 10,
    } }, { formatTokenAmount });
    expect(buildWalletBatchNotice(sent)).toMatchObject({
      kind: 'pending', title: 'Awaiting chain finality', batchHash: hash,
    });
    const retryable = mergeWalletBatchRuntimeSubmission(sent, {
      batchHash: hash, entityNonce: 4, submitAttempts: 2, lastSubmittedAt: 22,
      txHash: '', failure: 'RPC unavailable', failureKind: 'retryable', failureAt: 23,
    });
    expect(retryable).toMatchObject({ status: 'failed', failure: 'RPC unavailable',
      failureKind: 'retryable', failureAt: 23, submission: { submitAttempts: 2, lastSubmittedAt: 22 } });
    expect(mergeWalletBatchRuntimeSubmission(sent, {
      batchHash: `0x${'cd'.repeat(32)}`, entityNonce: 4, submitAttempts: 9,
      lastSubmittedAt: 99, txHash: '', failure: 'stale', failureKind: 'terminal', failureAt: 100,
    })).toBe(sent);
  });

  test('fails visibly when an operation collection is malformed', () => {
    const state = initJBatch();
    expect(() => decodeWalletBatch({ ...state, batch: { ...state.batch, settlements: null } }, { formatTokenAmount }))
      .toThrow('WALLET_BATCH_OPERATIONS_INVALID:settlements');
  });
});
