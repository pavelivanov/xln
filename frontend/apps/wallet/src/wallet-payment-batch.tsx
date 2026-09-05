import { useState } from 'react';
import type { WalletBatchAction, WalletBatchOperation } from './wallet-batch-model';
import type { WalletPaymentProjection } from './wallet-payment-model';
import type { WalletPaymentSource, WalletPaymentSourceSnapshot } from './wallet-payment-source';
import './styles/wallet-settlement.css';

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
  const batch = projection.batch;
  const busy = snapshot.status !== 'ready' || snapshot.command.status === 'submitting'
    || snapshot.command.status === 'pending' || snapshot.command.retryable;
  const submit = async (action: WalletBatchAction): Promise<void> => {
    if (action === 'clear' && !window.confirm('Clear the current draft and sent batch state? A transaction already sent to the chain may still finalize.')) return;
    setError('');
    try { await source.submitBatch(action, projection.activeEntityId, batch); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : String(failure)); }
  };
  return (
    <section className="wallet-payments-pane wallet-batch" aria-labelledby="wallet-batch-title">
      <div className="wallet-payments-section-heading"><h2 id="wallet-batch-title">Jurisdiction batch</h2><span>{batch.status}</span></div>
      <p>Review queued operations before sending them to the chain. Broadcast commits every operation in the draft.</p>
      <h3>Draft · {batch.draft.length} operations</h3>
      {batch.draft.length > 0 ? <BatchOperations operations={batch.draft} /> : <p>No queued operations.</p>}
      {batch.sentHash ? <>
        <h3>Awaiting chain finality · {batch.sent.length} operations</h3>
        <p className="wallet-settlement-hash">{batch.sentHash}</p>
        <BatchOperations operations={batch.sent} />
        <p>A rebroadcast resends this batch with a 10% gas bump.</p>
      </> : null}
      {batch.failure ? <p role="alert" className="wallet-payment-error">{batch.failure}</p> : null}
      {error ? <p role="alert" className="wallet-payment-error">{error}</p> : null}
      <div className="wallet-payment-actions">
        <button className="is-primary" disabled={busy || batch.draft.length === 0 || Boolean(batch.sentHash)} onClick={() => void submit('broadcast')} type="button">Broadcast draft</button>
        {batch.sentHash ? <button disabled={busy} onClick={() => void submit('rebroadcast')} type="button">Rebroadcast sent batch</button> : null}
        {batch.draft.length > 0 || batch.sentHash ? <button disabled={busy} onClick={() => void submit('clear')} type="button">Clear batch</button> : null}
      </div>
    </section>
  );
}
