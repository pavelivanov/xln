import { useEffect, useState } from 'react';
import type { RuntimePaymentDeliveryMode } from '../../../packages/runtime-client/src/payment-command-types';

import { initialWalletPaymentInvoice, readWalletPaymentInvoice } from './wallet-payment-draft';
import type { WalletPaymentProjection } from './wallet-payment-model';
import type { WalletPaymentSource, WalletPaymentSourceSnapshot } from './wallet-payment-source';

const deliveryModes: ReadonlyArray<Readonly<{
  id: RuntimePaymentDeliveryMode;
  label: string;
  detail: string;
}>> = [
  { id: 'instant', label: 'Instant', detail: 'Conditional route, immediate delivery attempt' },
  { id: 'async', label: 'Async', detail: 'Conditional route, durable eventual delivery' },
  { id: 'direct', label: 'Direct', detail: 'One bilateral Account only' },
  { id: 'trusted', label: 'Trusted', detail: 'One fee-free gateway only' },
];

export function WalletPaymentSend({
  invoiceLink,
  projection,
  snapshot,
  source,
}: Readonly<{
  invoiceLink: string;
  projection: WalletPaymentProjection;
  snapshot: WalletPaymentSourceSnapshot;
  source: WalletPaymentSource;
}>) {
  const [initial] = useState(() => initialWalletPaymentInvoice(invoiceLink, projection));
  const [intent, setIntent] = useState(initial.intent);
  const [recipient, setRecipient] = useState(initial.intent?.targetEntityId ?? '');
  const [tokenId, setTokenId] = useState(initial.intent?.tokenId ?? 0);
  const [amount, setAmount] = useState(initial.intent?.amount ?? '');
  const [description, setDescription] = useState(initial.intent?.description ?? '');
  const [deliveryMode, setDeliveryMode] = useState<RuntimePaymentDeliveryMode>('instant');
  const [invoice, setInvoice] = useState(initial.intent?.canonicalUri ?? invoiceLink);
  const [invoiceError, setInvoiceError] = useState(initial.error);
  const [formError, setFormError] = useState('');
  const selectedRecipient = recipient || projection.recipients[0]?.entityId || '';
  const selectedTokenId = tokenId || projection.tokens[0]?.tokenId || 0;
  const invoiceDirty = Boolean(invoice.trim() && invoice !== intent?.canonicalUri);
  const busy = snapshot.status !== 'ready' || snapshot.quote.status === 'loading'
    || snapshot.command.status === 'submitting'
    || snapshot.command.status === 'pending';

  // A remounted Send form has a new draft; retain command tracking in the parent,
  // but never carry a quote across invoice, Entity, or subview changes.
  useEffect(() => {
    source.clearQuote();
    return source.clearQuote;
  }, [source]);

  const applyInvoice = (): void => {
    source.clearQuote();
    try {
      const parsed = readWalletPaymentInvoice(invoice, projection);
      setIntent(parsed);
      setRecipient(parsed.targetEntityId);
      setTokenId(parsed.tokenId ?? 0);
      setAmount(parsed.amount);
      setDescription(parsed.description);
      setInvoice(parsed.canonicalUri);
      setInvoiceError('');
      setFormError('');
    } catch (error: unknown) {
      setInvoiceError(error instanceof Error ? error.message : String(error));
    }
  };

  const discardInvoice = (): void => {
    source.clearQuote();
    setIntent(null);
    setInvoice('');
    setInvoiceError('');
    setFormError('');
    setRecipient('');
    setTokenId(0);
    setAmount('');
    setDescription('');
  };

  const quote = async (): Promise<void> => {
    setFormError('');
    try {
      await source.quotePayment({
        targetEntityId: selectedRecipient,
        tokenId: selectedTokenId,
        amount,
        deliveryMode,
      });
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  };

  const submit = async (): Promise<void> => {
    setFormError('');
    try {
      await source.submitQuotedPayment({ targetEntityId: selectedRecipient, tokenId: selectedTokenId, amount, deliveryMode }, description);
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  };

  const route = snapshot.quote.routes[0];
  return (
    <section className="wallet-payments-pane" aria-labelledby="wallet-send-title">
      <div className="wallet-payments-section-heading">
        <div><p>01</p><h2 id="wallet-send-title">Send a payment</h2></div>
        <span>Quote first · submit once</span>
      </div>

      <div className="wallet-payment-invoice-row">
        <label htmlFor="wallet-payment-invoice">Recipient or invoice</label>
        <div className={invoice || intent ? 'has-invoice' : undefined}>
          <input
            disabled={busy}
            id="wallet-payment-invoice"
            onChange={(event) => { source.clearQuote(); setInvoice(event.target.value); }}
            placeholder="Entity ID, invoice, wallet link, or xln:// link"
            value={invoice}
          />
          <button disabled={!invoice.trim() || busy} onClick={applyInvoice} type="button">Apply invoice</button>
          {invoice || intent ? <button disabled={busy} onClick={discardInvoice} type="button">Discard invoice</button> : null}
        </div>
        {invoiceDirty && !invoiceError ? <p className="wallet-operation-note" role="status">Apply or discard the invoice before requesting a route.</p> : null}
      </div>

      <div className="wallet-payment-form-grid">
        <label>
          <span>Recipient</span>
          <select disabled={busy || intent !== null} onChange={(event) => { source.clearQuote(); setRecipient(event.target.value); }} value={selectedRecipient}>
            {projection.recipients.map((option) => (
              <option disabled={option.blocked} key={option.entityId} value={option.entityId}>
                {option.label}{option.blocked ? ' · dispute gate' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Asset</span>
          <select disabled={busy || intent?.tokenId != null} onChange={(event) => { source.clearQuote(); setTokenId(Number(event.target.value)); }} value={selectedTokenId}>
            {projection.tokens.map((token) => (
              <option key={token.tokenId} value={token.tokenId}>{token.symbol} · {token.spendableLabel} visible</option>
            ))}
          </select>
        </label>
        <label>
          <span>Recipient amount</span>
          <input disabled={busy || Boolean(intent?.amount)} inputMode="decimal" onChange={(event) => { source.clearQuote(); setAmount(event.target.value); }} placeholder="0.00" value={amount} />
        </label>
        <label>
          <span>Description</span>
          <input disabled={busy || Boolean(intent?.descriptionLocked)} maxLength={200} onChange={(event) => { source.clearQuote(); setDescription(event.target.value); }} placeholder="Optional, committed with the payment" value={description} />
        </label>
      </div>

      <fieldset className="wallet-payment-modes" disabled={busy}>
        <legend>Delivery</legend>
        {deliveryModes.map((mode) => (
          <label className={deliveryMode === mode.id ? 'is-selected' : ''} key={mode.id}>
            <input checked={deliveryMode === mode.id} name="wallet-payment-mode" onChange={() => { source.clearQuote(); setDeliveryMode(mode.id); }} type="radio" />
            <strong>{mode.label}</strong><span>{mode.detail}</span>
          </label>
        ))}
      </fieldset>

      {invoiceError || formError || snapshot.quote.status === 'error' ? (
        <p className="wallet-payment-error" role="alert">{invoiceError || formError || snapshot.quote.message}</p>
      ) : null}

      {route ? (
        <article className="wallet-payment-route">
          <header><span>Cheapest eligible route</span><strong>{route.path.length - 1} hops</strong></header>
          <div className="wallet-payment-route-path">
            {route.path.map((entityId, index) => <code key={entityId}>{index === 0 ? 'You' : index === route.path.length - 1 ? 'Recipient' : `${entityId.slice(0, 8)}…`}</code>)}
          </div>
          <dl>
            <div><dt>Recipient</dt><dd>{route.recipientAmount.toString()} base units</dd></div>
            <div><dt>Fee</dt><dd>{route.totalFee.toString()} base units</dd></div>
            <div><dt>Maximum debit</dt><dd>{route.senderAmount.toString()} base units</dd></div>
            <div><dt>Route confidence</dt><dd>{Math.round(route.probability * 100)}%</dd></div>
          </dl>
        </article>
      ) : null}

      <div className="wallet-payment-actions">
        <button disabled={busy || invoiceDirty || Boolean(invoiceError) || !selectedRecipient || !selectedTokenId || !amount.trim()} onClick={() => void quote()} type="button">
          {snapshot.quote.status === 'loading' ? 'Finding route…' : 'Find route'}
        </button>
        <button className="is-primary" disabled={busy || invoiceDirty || Boolean(invoiceError) || !route} onClick={() => void submit()} type="button">Submit quoted payment</button>
      </div>
    </section>
  );
}
