import type { WalletBatchProjection } from '../../commands/wallet-batch-model';

export type WalletBatchNotice = Readonly<{
  kind: 'pending' | 'retryable' | 'terminal' | 'confirmed';
  title: string;
  detail: string;
  batchHash: string;
}>;

export const buildWalletBatchNotice = (
  batch: WalletBatchProjection,
  confirmedHash = '',
): WalletBatchNotice | null => {
  if (!batch.submission) return confirmedHash ? {
    kind: 'confirmed', title: 'Batch confirmed',
    detail: 'Chain finality removed the batch from the pending queue.', batchHash: confirmedHash,
  } : null;
  const attempt = Math.max(1, batch.submission.submitAttempts);
  if (batch.failureKind === 'terminal') return {
    kind: 'terminal', title: 'Submission quarantined',
    detail: `Attempt ${attempt} stopped. Clear this exact batch before rebuilding.`,
    batchHash: batch.submission.batchHash,
  };
  if (batch.failureKind === 'retryable') return {
    kind: 'retryable', title: 'Submission needs retry',
    detail: `Attempt ${attempt} failed. The exact signed batch is preserved for rebroadcast.`,
    batchHash: batch.submission.batchHash,
  };
  return {
    kind: 'pending', title: 'Awaiting chain finality',
    detail: `Nonce ${batch.submission.entityNonce} · attempt ${attempt}.`,
    batchHash: batch.submission.batchHash,
  };
};
