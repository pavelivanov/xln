import type { AccountReplica, AccountTx } from '@xln/core/api/public/runtime-module';
import type { EntityReplica, EntityState } from '$lib/types/ui';
import { isAccountLeftPerspective } from '../shared/account-token-details';

export type AccountActivityRow = {
    id: string;
    kind: 'pending' | 'mempool' | 'confirmed';
    frameLabel: string;
    timestamp: number;
    statusLabel: string;
    byLeft?: boolean;
    txs: AccountTx[];
  };
type ActivityRow = AccountActivityRow;

export function buildAccountActivityRows(account: AccountReplica, entityId: string): AccountActivityRow[] {
  const iAmLeft = isAccountLeftPerspective(entityId, account.state);
    const rows: ActivityRow[] = [];
    if (account.pendingFrame) {
      const pendingByLeft = iAmLeft;
      const pendingIsYou = true;
      rows.push({
        id: `pending-${account.pendingFrame.height}`,
        kind: 'pending',
        frameLabel: `Draft A#${account.pendingFrame.height}`,
        timestamp: Number(account.pendingFrame.timestamp || 0),
        statusLabel: pendingIsYou !== undefined
          ? (pendingIsYou ? `You (${iAmLeft ? 'L' : 'R'})` : `Counterparty (${iAmLeft ? 'R' : 'L'})`)
          : 'Draft',
        ...(pendingByLeft !== undefined ? { byLeft: pendingByLeft } : {}),
        txs: Array.isArray(account.pendingFrame.accountTxs) ? account.pendingFrame.accountTxs : [],
      });
    }
    if (Array.isArray(account.mempool) && account.mempool.length > 0) {
      rows.push({
        id: `mempool-${account.currentHeight}`,
        kind: 'mempool',
        frameLabel: 'Queued Broadcast',
        timestamp: Number(account.currentFrame?.timestamp || 0),
        statusLabel: `${account.mempool.length} queued`,
        txs: account.mempool,
      });
    }
    const frameHistory = (account as { frameHistory?: typeof account.currentFrame[] }).frameHistory;
    const historicalFrames = Array.isArray(frameHistory) ? frameHistory.slice(-12).reverse() : [];
    for (const frame of historicalFrames) {
      rows.push({
        id: `confirmed-${frame.height}`,
        kind: 'confirmed',
        frameLabel: `A#${frame.height}`,
        timestamp: Number(frame.timestamp || 0),
        statusLabel: 'Confirmed',
        txs: Array.isArray(frame.accountTxs) ? frame.accountTxs : [],
      });
    }
    return rows;

}

export function buildAccountDisputeDeadline(
  activeDispute: Pick<NonNullable<AccountReplica['activeDispute']>, 'disputeTimeout' | 'observedOnChain'> | null,
  nowMs: number,
) {
  // Contract deadlines are absolute unix seconds. J height is observation
  // metadata and must never enter deadline arithmetic.
  const disputeTimeoutSeconds = Number(activeDispute?.disputeTimeout ?? 0);
  const hasObservedDisputeDeadline = activeDispute?.observedOnChain === true && disputeTimeoutSeconds > 0;
  const disputeSecondsLeft = hasObservedDisputeDeadline
    ? Math.max(0, Math.ceil((disputeTimeoutSeconds * 1000 - nowMs) / 1000))
    : 0;
  return { disputeTimeoutSeconds, hasObservedDisputeDeadline, disputeSecondsLeft };
}

export function buildAccountDisputeView(account: AccountReplica, replica: EntityReplica | null, counterpartyId: string, nowMs: number) {
  const activeDispute = account.activeDispute ?? null;
  const deadlineView = buildAccountDisputeDeadline(activeDispute, nowMs);
  const pendingSecretAckInfo = buildPendingSecretAckInfo(replica?.state.paybook, counterpartyId, nowMs);

  return { activeDispute, ...deadlineView, pendingSecretAckInfo };
}

export function buildPendingSecretAckInfo(paybook: EntityState['paybook'] | undefined, counterpartyId: string, nowMs: number) {
  if (!paybook) return null;
  const counterpartyNorm = counterpartyId.toLowerCase();
  let count = 0;
  let deadline = Number.POSITIVE_INFINITY;
  for (const payment of paybook.entries.values()) {
    if (!payment.secretAckPending || payment.inboundEntity?.toLowerCase() !== counterpartyNorm) continue;
    const paymentDeadline = payment.secretAckDeadlineAt;
    if (paymentDeadline === undefined || !Number.isFinite(paymentDeadline) || paymentDeadline <= 0) continue;
    count += 1;
    deadline = Math.min(deadline, paymentDeadline);
  }
  return count === 0 ? null : { count, secondsLeft: Math.max(0, Math.ceil((deadline - nowMs) / 1000)) };
}
