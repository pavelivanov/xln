import { safeStringify } from '../../../../../core/protocol/serialization';
import type { JBatch } from '../../../../../core/jurisdiction/machine/batch';
import type { RuntimePaymentEntityTx } from '../../../../packages/runtime-client/src/payments/payment-command-types';
import { requireRuntimeBigInt, requireRuntimeEnum, requireRuntimeInteger, requireRuntimeRecord, requireRuntimeString } from '../runtime/wallet-runtime-decode';

const operationNames = {
  reserveToReserve: 'Reserve transfer', reserveToCollateral: 'Fund collateral',
  collateralToReserve: 'Withdraw collateral',
  settlements: 'Bilateral settlement', disputeStarts: 'Start dispute',
  counterDisputes: 'Counter dispute', disputeFinalizations: 'Finalize dispute',
  externalTokenToReserve: 'External deposit', reserveToExternalToken: 'External withdrawal',
  revealSecrets: 'Secret publication', hashLadderRegistrations: 'Hash ladder publication',
} satisfies Record<keyof JBatch, string>;

export type WalletBatchOperation = Readonly<{ label: string; summary: string; details: string }>;
type BatchMath = Readonly<{ formatTokenAmount: (tokenId: number, amount: bigint) => string }>;
export type WalletBatchSubmission = Readonly<{
  batchHash: string;
  txHash: string;
  entityNonce: number;
  submitAttempts: number;
  firstSubmittedAt: number;
  lastSubmittedAt: number;
}>;
export type WalletBatchRuntimeSubmission = Readonly<{
  batchHash: string;
  entityNonce: number;
  submitAttempts: number;
  lastSubmittedAt: number;
  txHash: string;
  failure: string;
  failureKind: 'none' | 'retryable' | 'terminal';
  failureAt: number | null;
}>;
export type WalletBatchProjection = Readonly<{
  draft: readonly WalletBatchOperation[];
  sent: readonly WalletBatchOperation[];
  sentHash: string;
  submission: WalletBatchSubmission | null;
  status: 'empty' | 'accumulating' | 'sent' | 'failed';
  failure: string;
  failureKind: 'none' | 'retryable' | 'terminal';
  failureAt: number | null;
  reviewKey: string;
}>;
export type WalletBatchAction = 'broadcast' | 'rebroadcast' | 'clear';

const operationSummary = (key: string, op: Record<string, unknown>, math: BatchMath): string => {
  if (key === 'reserveToCollateral') {
    if (!Array.isArray(op['pairs'])) throw new Error('WALLET_BATCH_COLLATERAL_PAIRS_INVALID');
    const tokenId = requireRuntimeInteger(op['tokenId'], 'WALLET_BATCH_TOKEN', 1);
    return op['pairs'].map((value: unknown) => {
      const pair = requireRuntimeRecord(value, 'WALLET_BATCH_COLLATERAL_PAIR');
      return math.formatTokenAmount(tokenId, requireRuntimeBigInt(pair['amount'], 'WALLET_BATCH_AMOUNT'));
    }).join(' + ');
  }
  if (op['tokenId'] !== undefined && op['amount'] !== undefined) {
    return math.formatTokenAmount(requireRuntimeInteger(op['tokenId'], 'WALLET_BATCH_TOKEN', 1),
      requireRuntimeBigInt(op['amount'], 'WALLET_BATCH_AMOUNT'));
  }
  return '';
};

const decodeOperations = (value: unknown, math: BatchMath): readonly WalletBatchOperation[] => {
  const batch = requireRuntimeRecord(value, 'WALLET_BATCH');
  return Object.entries(operationNames).flatMap(([key, label]) => {
    const operations = batch[key];
    if (!Array.isArray(operations)) throw new Error(`WALLET_BATCH_OPERATIONS_INVALID:${key}`);
    return operations.map((value: unknown) => {
      const op = requireRuntimeRecord(value, 'WALLET_BATCH_OPERATION');
      return { label, summary: operationSummary(key, op, math), details: safeStringify(op, 2) };
    });
  });
};

export const decodeWalletBatch = (value: unknown, math: BatchMath): WalletBatchProjection => {
  if (value === undefined) return {
    draft: [], sent: [], sentHash: '', submission: null, status: 'empty', failure: '',
    failureKind: 'none', failureAt: null, reviewKey: '',
  };
  const state = requireRuntimeRecord(value, 'WALLET_BATCH_STATE');
  const sent = state['sentBatch'] === undefined ? null : requireRuntimeRecord(state['sentBatch'], 'WALLET_SENT_BATCH');
  const terminalFailure = sent?.['terminalFailure'];
  const retryableFailure = sent?.['lastFailure'];
  const failure = terminalFailure ?? retryableFailure;
  const decodedFailure = failure === undefined ? null : requireRuntimeRecord(failure, 'WALLET_BATCH_FAILURE');
  const submission = sent ? {
    batchHash: requireRuntimeString(sent['batchHash'], 'WALLET_SENT_BATCH_HASH'),
    txHash: sent['txHash'] === undefined ? '' : requireRuntimeString(sent['txHash'], 'WALLET_SENT_BATCH_TX_HASH'),
    entityNonce: requireRuntimeInteger(sent['entityNonce'], 'WALLET_SENT_BATCH_NONCE', 1),
    submitAttempts: requireRuntimeInteger(sent['submitAttempts'], 'WALLET_SENT_BATCH_ATTEMPTS'),
    firstSubmittedAt: requireRuntimeInteger(sent['firstSubmittedAt'], 'WALLET_SENT_BATCH_FIRST_SUBMITTED'),
    lastSubmittedAt: requireRuntimeInteger(sent['lastSubmittedAt'], 'WALLET_SENT_BATCH_LAST_SUBMITTED'),
  } : null;
  return {
    draft: decodeOperations(state['batch'], math),
    sent: sent ? decodeOperations(sent['batch'], math) : [],
    sentHash: submission?.batchHash ?? '',
    submission,
    status: requireRuntimeEnum(state['status'], ['empty', 'accumulating', 'sent', 'failed'], 'WALLET_BATCH_STATUS'),
    failure: decodedFailure ? requireRuntimeString(decodedFailure['message'], 'WALLET_BATCH_FAILURE_MESSAGE') : '',
    failureKind: terminalFailure !== undefined ? 'terminal' : retryableFailure !== undefined ? 'retryable' : 'none',
    failureAt: decodedFailure ? requireRuntimeInteger(decodedFailure['failedAt'], 'WALLET_BATCH_FAILURE_AT') : null,
    reviewKey: safeStringify(value),
  };
};

export const mergeWalletBatchRuntimeSubmission = (
  batch: WalletBatchProjection,
  runtime: WalletBatchRuntimeSubmission | null,
): WalletBatchProjection => {
  if (!batch.submission || !runtime) return batch;
  if (runtime.batchHash !== batch.submission.batchHash
    || runtime.entityNonce !== batch.submission.entityNonce) return batch;
  return {
    ...batch,
    submission: {
      ...batch.submission,
      submitAttempts: runtime.submitAttempts,
      lastSubmittedAt: runtime.lastSubmittedAt,
      txHash: runtime.txHash,
    },
    status: runtime.failureKind === 'none' ? batch.status : 'failed',
    failure: runtime.failure,
    failureKind: runtime.failureKind,
    failureAt: runtime.failureAt,
  };
};

export const buildWalletBatchTx = (
  action: WalletBatchAction,
  current: WalletBatchProjection,
  reviewed: WalletBatchProjection,
): RuntimePaymentEntityTx => {
  if (current.reviewKey !== reviewed.reviewKey) throw new Error('Batch changed. Review the current operations before submitting.');
  if (action === 'broadcast') {
    if (current.sentHash || current.draft.length === 0) throw new Error('A nonempty draft and no in-flight batch are required.');
    return { type: 'j_broadcast', data: {} };
  }
  if (action === 'rebroadcast') {
    if (!current.sentHash) throw new Error('No in-flight batch to rebroadcast.');
    if (current.failureKind === 'terminal') throw new Error('A terminally failed batch must be cleared before rebuilding.');
    return { type: 'j_rebroadcast', data: { gasBumpBps: 1_000 } };
  }
  if (!current.sentHash && current.draft.length === 0) throw new Error('No batch to clear.');
  return { type: 'j_clear_batch', data: { reason: 'manual-clear-from-ui' } };
};
