import { walletDraftPayment, type WalletPayDraft, type WalletPaymentPrefill } from '../commands/wallet-command-draft';
import { useWalletRuntimeLoader } from "../runtime/wallet-runtime-scope";
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { readRuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import { WalletPaymentOperations } from './wallet-payment-operations';
import { WalletPaymentReceive } from './wallet-payment-receive';
import { WalletPaymentSend } from './wallet-payment-send';
import { WalletPaymentSource } from './wallet-payment-source';
import type { WalletPaymentTab } from '../navigation/wallet-navigation-model';
import type { WalletWorkspaceSelection } from '../runtime/wallet-workspace-selection';
import '../styles/financial/wallet-payments.css';
import '../styles/financial/wallet-payments-responsive.css';

const WalletPaymentExternal = lazy(async () => {
  const module = await import('./wallet-payment-external');
  return { default: module.WalletPaymentExternal };
});

const shortCommandId = (value: string): string => value ? `…${value}` : '';

function PaymentsUnavailable({
  error,
  message,
  retry,
}: Readonly<{ error: boolean; message: string; retry: () => void }>) {
  return (
    <section className="wallet-payments-unavailable" role={error ? 'alert' : 'status'}>
      <p className="wallet-shell-eyebrow">Command surface unavailable</p>
      <h2>No payment command can be prepared.</h2>
      <p>{message}</p>
      <div>
        {error ? <button onClick={retry} type="button">Retry Runtime connection</button> : null}
        <a href="/app?diagnostics=1">Review diagnostics</a>
      </div>
    </section>
  );
}

export function WalletPayments({ tab, invoice, onTabChange, workspaceSelection, draft }: Readonly<{
  workspaceSelection: WalletWorkspaceSelection;
  tab: WalletPaymentTab;
  invoice: string;
  draft?: WalletPayDraft | undefined;
  onTabChange: (tab: WalletPaymentTab) => void;
}>) {
  const { entityId } = useSyncExternalStore(workspaceSelection.subscribe, workspaceSelection.getSnapshot, workspaceSelection.getSnapshot);
  const loadRuntime = useWalletRuntimeLoader();
  const [source] = useState(() => new WalletPaymentSource(
    readRuntimeAdapterStorageSnapshot({ durable: localStorage, session: sessionStorage }),
    workspaceSelection,
    loadRuntime,
  ));
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const [retryError, setRetryError] = useState('');
  const draftFailure = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    void source.start();
    return source.stop;
  }, [source]);

  const retryCommand = async (): Promise<void> => {
    setRetryError('');
    try {
      await source.retryPendingCommand();
    } catch (error: unknown) {
      setRetryError(error instanceof Error ? error.message : String(error));
    }
  };

  const projection = snapshot.projection;
  let prefill: WalletPaymentPrefill | undefined;
  let draftError = '';
  if (draft && projection) {
    try { prefill = walletDraftPayment(draft, projection.tokens); }
    catch (cause) { draftError = cause instanceof Error ? cause.message : String(cause); }
  }
  const commandVisible = snapshot.command.status !== 'idle';
  useEffect(() => {
    if (!draftError || !draftFailure.current) return;
    draftFailure.current.focus({ preventScroll: true }); draftFailure.current.scrollIntoView({ block: 'center' });
  }, [draftError]);
  return (
    <section className="wallet-payments" aria-labelledby="wallet-payments-title">
      <header className="wallet-payments-heading">
        <p className="wallet-shell-eyebrow">Runtime-authorized value movement</p>
        <h1 id="wallet-payments-title">Payments</h1>
        <p>Quote committed capacity, submit one idempotent command, or create a recipient-owned invoice.</p>
      </header>

      {projection ? (
        <>
          <div className="wallet-payments-context">
            <label htmlFor="wallet-payments-entity">Entity</label>
            <select
              disabled={snapshot.command.status === 'pending' || snapshot.command.status === 'submitting'}
              id="wallet-payments-entity"
              onChange={(event) => source.selectEntity(event.target.value)}
              value={entityId || projection.activeEntityId}
            >
              {projection.entities.map((entity) => <option key={entity.entityId} value={entity.entityId}>{entity.label}</option>)}
            </select>
            <span>Committed height {projection.height}</span>
            <button disabled={snapshot.status === 'loading'} onClick={() => void source.refresh()} type="button">
              {snapshot.status === 'loading' ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {commandVisible ? (
            <section className={`wallet-payment-command is-${snapshot.command.status}`} role={snapshot.command.status === 'error' ? 'alert' : 'status'}>
              <div>
                <span>Runtime command {shortCommandId(snapshot.command.commandId)}</span>
                <strong>{snapshot.command.status}</strong>
              </div>
              <p>{snapshot.command.message}</p>
              <footer>
                <span>{snapshot.command.durable ? 'Encrypted durable replay identity' : 'Memory-only command identity'}</span>
                {snapshot.command.retryable ? <button onClick={() => void retryCommand()} type="button">Retry same command</button> : null}
              </footer>
              {retryError ? <p className="wallet-payment-error">{retryError}</p> : null}
            </section>
          ) : null}

          <nav className="wallet-payment-tabs" aria-label="Payment tools">
            {(['send', 'receive', 'operations', 'external'] as const).map((option) => (
              <button aria-current={tab === option ? 'page' : undefined} className={tab === option ? 'is-current' : ''} key={option} onClick={() => onTabChange(option)} type="button">
                {option[0]?.toUpperCase() + option.slice(1)}
              </button>
            ))}
          </nav>
          {entityId && entityId !== projection.activeEntityId ? <p role="status">Loading selected Entity…</p> : tab === 'external' ? (
            <Suspense fallback={<p className="wallet-payments-empty" role="status">Loading the local authority bridge…</p>}>
              <WalletPaymentExternal
                key={`${projection.activeEntityId}:${projection.signerId}`}
                paymentSnapshot={snapshot}
                paymentSource={source}
                projection={projection}
              />
            </Suspense>
          ) : projection.recipients.length > 0 && projection.tokens.length > 0 ? (
            <>
              {tab === 'send' ? draftError ? <p ref={draftFailure} tabIndex={-1} role="alert">{draftError}</p> : <WalletPaymentSend key={`${projection.activeEntityId}:${invoice}:${draft?.id ?? ''}`} invoiceLink={invoice} prefill={prefill} projection={projection} snapshot={snapshot} source={source} /> : null}
              {tab === 'receive' ? <WalletPaymentReceive projection={projection} source={source} /> : null}
              {tab === 'operations' ? <WalletPaymentOperations projection={projection} snapshot={snapshot} source={source} /> : null}
            </>
          ) : (
            <p className="wallet-payments-empty">This Entity needs a committed asset and another Runtime Entity before payment tools can open.</p>
          )}
        </>
      ) : (
        <PaymentsUnavailable error={snapshot.status === 'error'} message={snapshot.message} retry={() => void source.refresh()} />
      )}

      <p className="wallet-payments-boundary">
        Route quotes come from the selected Runtime. External writes use the active local vault and its committed Entity jurisdiction; React never receives signer key material.
      </p>
    </section>
  );
}
