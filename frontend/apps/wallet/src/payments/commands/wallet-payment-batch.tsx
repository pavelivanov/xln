import { useEffect, useRef, useState } from 'react';
import { createPendingBatchActionRunner } from '../../../../../packages/browser/src/payments/pending-batch-actions';
import type { WalletBatchOperation } from '../../commands/wallet-batch-model';
import type { WalletPaymentProjection } from '../wallet-payment-model';
import type { WalletPaymentSource, WalletPaymentSourceSnapshot } from '../wallet-payment-source';
import { buildWalletBatchNotice } from './wallet-batch-notice-model';
import '../../styles/account/wallet-settlement.css';

function BatchOperations({ operations }: Readonly<{ operations: readonly WalletBatchOperation[] }>) {
  return <ol className="wallet-batch-operations">{operations.map((operation, index) => (
    <li key={index}>
      <details><summary>{operation.label}{operation.summary ? ` · ${operation.summary}` : ''}</summary><pre>{operation.details}</pre></details>
    </li>
  ))}</ol>;
}

export function WalletPaymentBatch({ projection, snapshot, source }: Readonly<{
  projection: WalletPaymentProjection;
  snapshot: WalletPaymentSourceSnapshot;
  source: WalletPaymentSource;
}>) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const actionInFlight = useRef(false);
  const [clearReview, setClearReview] = useState<Readonly<{ entityId: string; reviewKey: string }> | null>(null);
  const [confirmed, setConfirmed] = useState<Readonly<{ entityId: string; batchHash: string }> | null>(null);
  const previousSubmission = useRef<Readonly<{ entityId: string; batchHash: string }> | null>(null);
  const clearingSubmission = useRef<Readonly<{ entityId: string; batchHash: string }> | null>(null);
  const batch = projection.batch;
  const busy = submitting ||
    snapshot.status !== 'ready' || snapshot.command.status === 'submitting'
    || snapshot.command.status === 'pending' || snapshot.command.retryable;
  const currentClearReview = clearReview?.entityId === projection.activeEntityId
    && clearReview.reviewKey === batch.reviewKey;
  const confirmedHash = confirmed?.entityId === projection.activeEntityId ? confirmed.batchHash : '';
  const notice = buildWalletBatchNotice(batch, confirmedHash);
  const draftCount = batch.preflight?.draft.counts.total ?? batch.draft.length;
  const sentCount = batch.preflight?.sent?.counts.total ?? batch.sent.length;
  const preflightIssueText = batch.preflightError
    || (batch.preflight?.draft.issue ? source.formatBatchReserveIssue(batch.preflight.draft.issue) : '');
  const preflightReady = Boolean(batch.preflight) && !batch.preflightError;

  useEffect(() => {
    const previous = previousSubmission.current;
    if (batch.sentHash) {
      previousSubmission.current = { entityId: projection.activeEntityId, batchHash: batch.sentHash };
      setConfirmed(null);
      return;
    }
    previousSubmission.current = null;
    if (!previous || previous.entityId !== projection.activeEntityId) {
      setConfirmed(null);
      return;
    }
    if (clearingSubmission.current?.entityId === previous.entityId
      && clearingSubmission.current.batchHash === previous.batchHash) {
      clearingSubmission.current = null;
      setConfirmed(null);
      return;
    }
    setConfirmed(previous);
  }, [batch.sentHash, projection.activeEntityId]);

  const submit = createPendingBatchActionRunner({
    getState: () => ({
      pendingBatchCount: draftCount + sentCount,
      pendingBatchSubmitting: busy || actionInFlight.current,
      pendingBatchReserveIssueText: preflightIssueText || (!preflightReady ? 'Batch preflight is not ready.' : null),
      canBroadcastPendingBatch: preflightReady && !preflightIssueText && draftCount > 0 && !batch.preflight?.sent,
      hasSentBatch: preflightReady && Boolean(batch.preflight?.sent),
    }),
    setSubmitting: value => {
      actionInFlight.current = value;
      setSubmitting(value);
    },
    confirmClear: () => Boolean(currentClearReview),
    enqueueAction: async action => {
      setError('');
      if (action === 'clear') {
        clearingSubmission.current = { entityId: projection.activeEntityId, batchHash: batch.sentHash };
      }
      try {
        await source.submitBatch(action, projection.activeEntityId, batch);
        if (action === 'clear') setClearReview(null);
      } catch (failure: unknown) {
        if (action === 'clear') clearingSubmission.current = null;
        throw failure;
      }
    },
    notifyError: setError,
    formatError: failure => (failure instanceof Error ? failure.message : String(failure)),
  });
  return (
    <section className="wallet-payments-pane wallet-batch" aria-labelledby="wallet-batch-title">
      <div className="wallet-payments-section-heading"><h2 id="wallet-batch-title">Jurisdiction batch</h2><span>{batch.status}</span></div>
      <p>Review queued operations before sending them to the chain. Broadcast commits every operation in the draft.</p>
      <h3>Draft · {draftCount} operations</h3>
      {batch.draft.length > 0 ? <BatchOperations operations={batch.draft} /> : <p>No queued operations.</p>}
      {draftCount > batch.draft.length ? <p>Showing {batch.draft.length} of {draftCount} operations from the compact Runtime view.</p> : null}
      {notice ? <aside className="wallet-batch-status" data-kind={notice.kind} aria-live="polite">
        <span>Chain submission</span><h3>{notice.title}</h3><p>{notice.detail}</p>
        <code>{notice.batchHash}</code>
        {batch.submission?.txHash ? <code>Transaction · {batch.submission.txHash}</code> : null}
        {batch.failure ? <details className="wallet-batch-failure">
          <summary>Failure detail</summary><code>{batch.failure}</code>
        </details> : null}
      </aside> : null}
      {batch.sentHash ? <>
        <h3>Sent · {sentCount} operations</h3>
        <BatchOperations operations={batch.sent} />
        {sentCount > batch.sent.length ? <p>Showing {batch.sent.length} of {sentCount} sent operations from the compact Runtime view.</p> : null}
      </> : null}
      {preflightIssueText ? <p role="alert" className="wallet-payment-error">{preflightIssueText}</p> : null}
      {error ? <p role="alert" className="wallet-payment-error">{error}</p> : null}
      {currentClearReview ? <section className="wallet-batch-clear-review" aria-label="Confirm clear batch">
        <div><strong>Clear this exact batch?</strong>
          <p>{batch.sentHash
            ? 'This removes the local sent-batch record. A transaction already on-chain may still finalize.'
            : 'This removes every operation currently shown in the draft.'}</p></div>
        <div className="wallet-payment-actions">
          <button disabled={busy} onClick={() => setClearReview(null)} type="button">Keep batch</button>
          <button disabled={busy || !preflightReady} onClick={() => void submit('clear')} type="button">Clear exact batch</button>
        </div>
      </section> : null}
      <div className="wallet-payment-actions">
        <button className="is-primary" disabled={busy || !preflightReady || Boolean(preflightIssueText) || draftCount === 0 || Boolean(batch.preflight?.sent)} onClick={() => void submit('broadcast')} type="button">Broadcast draft</button>
        {batch.sentHash && batch.failureKind !== 'terminal' ? <button disabled={busy || !preflightReady} onClick={() => void submit('rebroadcast')} type="button">Rebroadcast sent batch</button> : null}
        {draftCount > 0 || batch.sentHash ? <button disabled={busy || !preflightReady || currentClearReview} onClick={() => setClearReview({ entityId: projection.activeEntityId, reviewKey: batch.reviewKey })} type="button">Review clear</button> : null}
      </div>
    </section>
  );
}
