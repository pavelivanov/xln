import { useEffect, useState, useSyncExternalStore } from 'react';
import type { WalletAccountContext } from '../../../../bridges/wallet/wallet-canonical-account-context';
import { buildWalletLoanRepayment, createWalletLendingIntentId, decodeWalletLending, type WalletLendingState, type WalletLendingLoan } from './wallet-lending-model';
import type { WalletPaymentSource } from '../payments/wallet-payment-source';
import type { WalletWorkspaceSelection } from '../runtime/wallet-workspace-selection';
import { buildLendingTokenOptions } from '../../../../src/lib/components/Entity/payments/lending-token-options';

export function WalletLending({ context, source, selection }: Readonly<{ context: WalletAccountContext; source: WalletPaymentSource; selection: WalletWorkspaceSelection }>) {
  const accounts = [...context.replica.state.accounts.keys()];
  const selected = useSyncExternalStore(selection.subscribe, selection.getAccountTools, selection.getAccountTools).lending;
  const chosenHub = selected.hub;
  const setHub = (hub: string) => selection.selectAccountTool(context.runtimeId, context.entityId, 'lending', { ...selected, hub });
  const hub = accounts.includes(chosenHub) ? chosenHub : accounts[0] || '';
  const account = context.replica.state.accounts.get(hub);
  const tokens = buildLendingTokenOptions(account ? account.state.deltas.keys() : [], id => context.xln.getTokenInfo(id).symbol).map(token => token.id);
  const chosenToken = selected.tokenId;
  const setToken = (tokenId: number) => selection.selectAccountTool(context.runtimeId, context.entityId, 'lending', { ...selected, tokenId });
  const tokenId = tokens.includes(chosenToken) ? chosenToken : tokens[0] || 1;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<WalletLendingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const activeState = state && state.hubEntityId === hub && state.tokenId === tokenId && state.userEntityId === context.entityId ? state : null;
  const command = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot).command;
  const busy = submitting || command.status === 'submitting' || command.status === 'pending';
  const format = (amount: bigint) => context.xln.formatTokenAmount(tokenId, amount);
  useEffect(() => {
    const controller = new AbortController();
    setState(null); setError('');
    if (!hub) return () => controller.abort();
    setLoading(true);
    const base = source.workspaceApiBase(context.apiBase);
    const url = new URL('/api/lending/state', base);
    url.searchParams.set('hubEntityId', hub); url.searchParams.set('userEntityId', context.entityId); url.searchParams.set('tokenId', String(tokenId));
    void fetch(url, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const raw: unknown = await response.json();
      if (!response.ok) throw new Error(`Lending state failed (${response.status})`);
      const data = decodeWalletLending(raw, hub, tokenId, context.entityId);
      if (!controller.signal.aborted) setState(data);
    }).catch(cause => { if (!controller.signal.aborted) setError(String(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [hub, tokenId, context.entityId, context.replica.state.height, context.apiBase, source, revision, command.status]);
  const repay = async (loan: WalletLendingLoan) => {
    setSubmitting(true); setError(''); setNotice('');
    try { await source.submitAccountTxs(context.entityId, [buildWalletLoanRepayment(loan, context.entityId, hub)]); setNotice('Repayment submitted.'); setRevision(value => value + 1); }
    catch (cause) { setError(String(cause)); } finally { setSubmitting(false); }
  };
  return <section data-testid="wallet-lending">
    <div className="wallet-tool-fields"><label>Hub Account<select aria-label="Hub Account" value={hub} disabled={busy} onChange={event => { setHub(event.target.value); setNotice(''); }}>{accounts.map(id => <option key={id} value={id}>{context.names.get(id) || id}</option>)}</select></label>
      <label>Asset<select aria-label="Asset" value={tokenId} disabled={busy} onChange={event => { setToken(Number(event.target.value)); setNotice(''); }}>{tokens.map(id => <option key={id} value={id}>{context.xln.getTokenInfo(id).symbol}</option>)}</select></label>
      <button disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh lending</button></div>
    {!context.commandsReady ? <p role="status">{context.commandReason || 'Lending requires a live authorized Runtime.'}</p> : null}
    {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    {loading ? <p role="status">Reading lending state…</p> : null}
    {activeState ? <p>Available {format(activeState.available)} · Borrowed {format(activeState.borrowed)}</p> : null}
    {hub && tokens.length ? <div className="wallet-lending-forms">{(['lend', 'borrow'] as const).map(kind => <LendingForm key={`${hub}:${tokenId}:${kind}`} kind={kind} context={context} source={source} hub={hub} tokenId={tokenId} disabled={busy || !context.commandsReady} />)}</div> : <p>Open an Account with a supported asset to use Lending.</p>}
    <h2>Pool positions</h2>{activeState && !activeState.pools.length ? <p>No pool positions for this selection.</p> : null}
    <ul className="wallet-tool-list">{activeState?.pools.map(pool => <li key={pool.positionId}><strong>{context.names.get(pool.lenderEntityId) || pool.lenderEntityId}</strong><span>{pool.status} · {pool.termId} · {(pool.interestBps / 100).toFixed(2)}%</span><span>{format(pool.available)} available · {format(pool.borrowed)} borrowed</span><small>{pool.positionId}</small></li>)}</ul>
    <h2>Loans</h2>{activeState && !activeState.loans.length ? <p>No loans for this selection.</p> : null}
    <ul className="wallet-tool-list">{activeState?.loans.map(loan => <li key={loan.loanId} data-testid="lending-loan-row"><strong>{loan.loanId}</strong><span>{loan.status} · {format(loan.principal)} principal · {format(loan.repayment)} repayment · {format(loan.repaid)} repaid</span><span>{(loan.interestBps / 100).toFixed(2)}% · {loan.termId} · Due {new Date(loan.dueAt).toLocaleString()}</span>
      {loan.status === 'active' && loan.borrowerEntityId === context.entityId ? <button disabled={busy || !context.commandsReady} onClick={() => void repay(loan)}>Repay remaining {format(loan.repayment - loan.repaid)}</button> : null}</li>)}</ul>
  </section>;
}

function LendingForm({ kind, context, source, hub, tokenId, disabled }: Readonly<{
  kind: 'lend' | 'borrow'; context: WalletAccountContext; source: WalletPaymentSource; hub: string; tokenId: number; disabled: boolean;
}>) {
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState<'1h' | '1d' | '1m'>('1d');
  const [rate, setRate] = useState(kind === 'lend' ? 100 : 250);
  const [error, setError] = useState('');
  const label = kind === 'lend' ? 'Lend' : 'Borrow';
  return <form aria-label={label} onSubmit={event => { event.preventDefault(); setError('');
    void (async () => {
      const value = context.xln.parseTokenAmount(tokenId, amount);
      if (value <= 0n) throw new Error('Amount must be greater than zero.');
      if (!Number.isSafeInteger(rate) || rate < 0 || rate > 10000) throw new Error('Interest must be 0–10000 basis points.');
      const intentId = createWalletLendingIntentId(kind);
      await source.submitAccountTxs(context.entityId, [kind === 'lend'
        ? { type: 'lendingOffer', data: { positionId: intentId, hubEntityId: hub, tokenId, amount: value, termId: term, interestBps: rate } }
        : { type: 'lendingBorrow', data: { requestId: intentId, hubEntityId: hub, tokenId, amount: value, termId: term, maxInterestBps: rate } }]); setAmount('');
    })().catch(cause => setError(String(cause)));
  }}><h2>{label}</h2><fieldset disabled={disabled}>
    <label>{label} amount<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
    <label>{label} term<select value={term} onChange={event => { const value = event.target.value; if (value === '1h' || value === '1d' || value === '1m') setTerm(value); }}>{[['1h', '1 hour'], ['1d', '1 day'], ['1m', '1 month']].map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>
    <label>{kind === 'lend' ? 'Interest' : 'Maximum interest'} (bps)<input type="number" min="0" max="10000" step="1" value={rate} onChange={event => setRate(Number(event.target.value))} /></label>
    <button>{label}</button></fieldset>{error ? <p role="alert">{error}</p> : null}</form>;
}
