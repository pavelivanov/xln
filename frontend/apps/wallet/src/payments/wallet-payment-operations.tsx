import { useEffect, useState } from 'react';

import type { WalletPaymentProjection } from './wallet-payment-model';
import type {
  WalletLendingTerm,
  WalletOperationKind,
  WalletSettlementReview,
} from './commands/wallet-payment-operations-model';
import type { WalletPaymentSource, WalletPaymentSourceSnapshot } from './wallet-payment-source';
import { WalletPaymentBatch } from './commands/wallet-payment-batch';
import { WalletSettlementApprovals } from './wallet-settlement-approvals';
import { createWalletLendingIntentId } from '../manage/wallet-lending-model';

const operationCopy: Record<WalletOperationKind, Readonly<{
  label: string;
  detail: string;
  action: string;
}>> = {
  r2r: { label: 'Reserve transfer', detail: 'Queue a reserve-to-reserve J-batch operation.', action: 'Queue reserve transfer' },
  r2c: { label: 'Fund collateral', detail: 'Queue reserve into one existing bilateral Account.', action: 'Queue collateral funding' },
  c2r: { label: 'Withdraw collateral', detail: 'Propose a bilateral collateral-to-reserve settlement.', action: 'Propose settlement' },
  lend: { label: 'Lend to hub', detail: 'Publish a lending offer against an existing Hub Account.', action: 'Submit lending offer' },
  borrow: { label: 'Borrow from hub', detail: 'Submit a bounded borrow request to an existing Hub Account.', action: 'Submit borrow request' },
};

const lendingTerms: ReadonlyArray<Readonly<{ id: WalletLendingTerm; label: string }>> = [
  { id: '1h', label: '1 hour' },
  { id: '1d', label: '1 day' },
  { id: '1m', label: '1 month' },
];

export function WalletPaymentOperations({
  projection,
  snapshot,
  source,
}: Readonly<{
  projection: WalletPaymentProjection;
  snapshot: WalletPaymentSourceSnapshot;
  source: WalletPaymentSource;
}>) {
  const [kind, setKind] = useState<WalletOperationKind>('r2r');
  const [target, setTarget] = useState('');
  const [tokenId, setTokenId] = useState(0);
  const [amount, setAmount] = useState('');
  const [termId, setTermId] = useState<WalletLendingTerm>('1d');
  const [interestBps, setInterestBps] = useState(100);
  const [error, setError] = useState('');
  const [settlementReview, setSettlementReview] = useState<WalletSettlementReview | null>(null);
  const accountOnly = kind !== 'r2r';
  const options = accountOnly
    ? projection.recipients.filter((recipient) => projection.accounts.some((account) => account.counterpartyId === recipient.entityId))
    : projection.recipients;
  const selectedTarget = options.some(({ entityId }) => entityId === target)
    ? target
    : options[0]?.entityId || '';
  const selectedTokenId = tokenId || projection.tokens[0]?.tokenId || 0;
  const busy = snapshot.status !== 'ready' || snapshot.command.status === 'submitting' || snapshot.command.status === 'pending';
  const isLending = kind === 'lend' || kind === 'borrow';
  const selectedPosition = projection.accounts.find((account) => account.counterpartyId === selectedTarget)
    ?.positions.find((position) => position.tokenId === selectedTokenId);

  useEffect(() => setSettlementReview(null), [projection.activeEntityId, projection.signerId]);

  const draft = () => ({
    kind,
    targetEntityId: selectedTarget,
    tokenId: selectedTokenId,
    amount,
    termId,
    interestBps,
    intentId: kind === 'lend' || kind === 'borrow' ? createWalletLendingIntentId(kind) : '',
  });

  const edit = (update: () => void): void => {
    setSettlementReview(null);
    setError('');
    update();
  };

  const submit = async (): Promise<void> => {
    setError('');
    try {
      await source.submitOperation(draft());
      setAmount('');
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const reviewSettlement = (): void => {
    setError('');
    try {
      setSettlementReview(source.reviewSettlement(draft()));
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const submitSettlement = async (): Promise<void> => {
    if (!settlementReview) return;
    setError('');
    try {
      await source.submitReviewedSettlement(settlementReview);
      setSettlementReview(null);
      setAmount('');
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return (
    <><section className="wallet-payments-pane" aria-labelledby="wallet-operations-title">
      <div className="wallet-payments-section-heading">
        <div><p>03</p><h2 id="wallet-operations-title">Account operations</h2></div>
        <span>One explicit Runtime command</span>
      </div>
      <div className="wallet-operation-picker" role="radiogroup" aria-label="Account operation">
        {(Object.keys(operationCopy) as WalletOperationKind[]).map((operation) => (
          <button
            aria-checked={kind === operation}
            className={kind === operation ? 'is-selected' : ''}
            disabled={busy}
            key={operation}
            onClick={() => edit(() => setKind(operation))}
            role="radio"
            type="button"
          >
            <strong>{operationCopy[operation].label}</strong>
            <span>{operationCopy[operation].detail}</span>
          </button>
        ))}
      </div>

      <div className="wallet-payment-form-grid wallet-operation-form">
        <label>
          <span>{isLending ? 'Hub Account' : kind === 'r2r' ? 'Recipient' : 'Counterparty Account'}</span>
          <select disabled={busy} onChange={(event) => edit(() => setTarget(event.target.value))} value={selectedTarget}>
            {options.map((option) => (
              <option disabled={option.blocked} key={option.entityId} value={option.entityId}>{option.label}{option.blocked ? ' · dispute gate' : ''}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Asset</span>
          <select disabled={busy} onChange={(event) => edit(() => setTokenId(Number(event.target.value)))} value={selectedTokenId}>
            {projection.tokens.map((token) => <option key={token.tokenId} value={token.tokenId}>{token.symbol}</option>)}
          </select>
        </label>
        <label>
          <span>Amount</span>
          <input disabled={busy} inputMode="decimal" onChange={(event) => edit(() => setAmount(event.target.value))} placeholder="0.00" value={amount} />
        </label>
        {isLending ? (
          <>
            <label>
              <span>Term</span>
              <select disabled={busy} onChange={(event) => edit(() => setTermId(event.target.value as WalletLendingTerm))} value={termId}>
                {lendingTerms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
              </select>
            </label>
            <label>
              <span>{kind === 'lend' ? 'Interest' : 'Maximum interest'} · basis points</span>
              <input disabled={busy} max="10000" min="0" onChange={(event) => edit(() => setInterestBps(Number(event.target.value)))} type="number" value={interestBps} />
            </label>
          </>
        ) : null}
      </div>

      {kind === 'c2r' ? (
        <p className="wallet-withdrawable">Available to withdraw: {selectedPosition?.withdrawableCollateralLabel ?? '0'}. Pending holds are excluded.</p>
      ) : null}
      {kind === 'c2r' ? (
        <p className="wallet-operation-note">This creates a settlement proposal only. Peer approval, execution, and J-batch broadcast remain separate committed steps.</p>
      ) : null}
      {isLending ? (
        <p className="wallet-operation-note">The Runtime validates Hub policy, matching, capacity, and final terms. This form does not estimate acceptance.</p>
      ) : null}
      {error ? <p className="wallet-payment-error" role="alert">{error}</p> : null}
      {settlementReview ? (
        <section className="wallet-settlement-review" aria-labelledby="wallet-settlement-review-title">
          <header>
            <div><p>Proposal review</p><h3 id="wallet-settlement-review-title">Collateral → Reserve</h3></div>
            <span>Not submitted</span>
          </header>
          <dl>
            <div><dt>Source Entity</dt><dd>{settlementReview.entityLabel}<code>{settlementReview.entityId}</code></dd></div>
            <div><dt>Counterparty</dt><dd>{settlementReview.counterpartyLabel}<code>{settlementReview.counterpartyEntityId}</code></dd></div>
            <div><dt>Asset</dt><dd>{settlementReview.tokenSymbol}<code>token {settlementReview.tokenId}</code></dd></div>
            <div><dt>Amount</dt><dd>{settlementReview.amountLabel}<code>{settlementReview.amount.toString()} raw</code></dd></div>
            <div><dt>Operation</dt><dd>Collateral → Reserve<code>{settlementReview.operation}</code></dd></div>
            <div><dt>Executor</dt><dd>{settlementReview.executorLabel}<code>{settlementReview.executorEntityId} · {settlementReview.executorIsLeft ? 'left' : 'right'}</code></dd></div>
            <div><dt>Signer</dt><dd><code>{settlementReview.signerId}</code></dd></div>
            <div><dt>Memo</dt><dd><code>{settlementReview.memo}</code></dd></div>
          </dl>
          <p>Submitting creates the bilateral proposal. It does not approve or execute settlement.</p>
          <div className="wallet-payment-actions">
            <button disabled={busy} onClick={() => setSettlementReview(null)} type="button">Cancel review</button>
            <button className="is-primary" disabled={busy} onClick={() => void submitSettlement()} type="button">Submit settlement proposal</button>
          </div>
        </section>
      ) : (
        <div className="wallet-payment-actions">
          <button
            className="is-primary"
            disabled={busy || !selectedTarget || !selectedTokenId || !amount.trim()}
            onClick={kind === 'c2r' ? reviewSettlement : () => void submit()}
            type="button"
          >
            {kind === 'c2r' ? 'Review settlement' : operationCopy[kind].action}
          </button>
        </div>
      )}
    </section><WalletSettlementApprovals projection={projection} snapshot={snapshot} source={source} />
      <WalletPaymentBatch projection={projection} snapshot={snapshot} source={source} /></>
  );
}
