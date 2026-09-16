import type { JBatch } from '@xln/core/api/public/runtime-module';
import type { RuntimePaymentEntityTx } from './payment-command-types';

export type PendingBatchMode = 'draft' | 'sent' | null;

export type PendingBatchState = {
  draftCount: number;
  sentCount: number;
  count: number;
  mode: PendingBatchMode;
  hasDraftBatch: boolean;
  hasSentBatch: boolean;
  previewBatch: JBatch | null;
};

export type PendingBatchAction = 'clear' | 'broadcast' | 'rebroadcast';

export function countBatchOps(batch: JBatch | null | undefined): number {
  if (!batch) return 0;
  return (
    (batch.reserveToCollateral?.length || 0) +
    (batch.collateralToReserve?.length || 0) +
    (batch.settlements?.length || 0) +
    (batch.reserveToReserve?.length || 0) +
    (batch.disputeStarts?.length || 0) +
    (batch.counterDisputes?.length || 0) +
    (batch.disputeFinalizations?.length || 0) +
    (batch.externalTokenToReserve?.length || 0) +
    (batch.reserveToExternalToken?.length || 0) +
    (batch.revealSecrets?.length || 0) +
    (batch.hashLadderRegistrations?.length || 0)
  );
}

export function buildPendingBatchState(
  jBatchState:
    | {
        batch?: JBatch | null;
        sentBatch?: { batch?: JBatch | null } | null;
      }
    | null
    | undefined,
): PendingBatchState {
  const draftBatch = jBatchState?.batch || null;
  const sentBatch = jBatchState?.sentBatch?.batch || null;
  const draftCount = countBatchOps(draftBatch);
  const sentCount = countBatchOps(sentBatch);
  const mode: PendingBatchMode = draftCount > 0 ? 'draft' : sentCount > 0 ? 'sent' : null;
  return {
    draftCount,
    sentCount,
    count: draftCount > 0 ? draftCount : sentCount,
    mode,
    hasDraftBatch: draftCount > 0,
    hasSentBatch: sentCount > 0,
    previewBatch: mode === 'draft' ? draftBatch : mode === 'sent' ? sentBatch : null,
  };
}

export function canBroadcastPendingBatch(
  state: Pick<PendingBatchState, 'hasDraftBatch' | 'hasSentBatch'>,
  reserveIssue: unknown,
): boolean {
  return state.hasDraftBatch && !state.hasSentBatch && !reserveIssue;
}

export function buildPendingBatchActionTxs(
  action: PendingBatchAction,
  clearReason = 'global-batch-bar-clear',
): [Extract<RuntimePaymentEntityTx, { type: 'j_clear_batch' | 'j_broadcast' | 'j_rebroadcast' }>] {
  if (action === 'clear') {
    return [
      {
        type: 'j_clear_batch',
        data: { reason: clearReason },
      },
    ];
  }
  if (action === 'broadcast') {
    return [
      {
        type: 'j_broadcast',
        data: {},
      },
    ];
  }
  return [
    {
      type: 'j_rebroadcast',
      data: { gasBumpBps: 1000 },
    },
  ];
}
