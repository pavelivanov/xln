import { useEffect, useState, useSyncExternalStore } from 'react';
import type { WalletAccountContext } from '../../../../bridges/wallet/wallet-canonical-account-context';
import { buildAddTokenToAccountTx, buildDisputeFinalizeTx, buildPrepareDisputeTx } from '../../../../src/lib/components/Entity/account/entity-action-txs';
import { buildCollateralRequest, collateralRequestFee, collateralRentEstimate, resolveCollateralFeePolicy } from '../../../../src/lib/components/Entity/account/collateral-request';
import type { WalletPaymentSource } from '../payments/wallet-payment-source';
import type { WalletWorkspaceSelection } from '../runtime/wallet-workspace-selection';
import { WalletLoadTesting } from './wallet-load-testing';
import { requestWalletCredit } from './wallet-manage-credit';
import { buildConfigureTokenOptions } from '../../../../src/lib/components/Entity/workspace/entity-panel-options';
import { compareStableText } from '../../../../src/lib/utils/stableSort';
import { formatWalletExternalAmount } from '../../../../packages/browser/src/wallet/wallet-external-provider';

const tabs = [['extend-credit', 'Extend Credit'], ['request-credit', 'Request Credit'], ['collateral', 'Request Collateral'], ['token', 'Add Token'], ['load-testing', 'Load Testing'], ['dispute', 'Dispute']] as const;
type ManageTab = typeof tabs[number][0];

export function WalletManage({ context, source, selection }: Readonly<{ context: WalletAccountContext; source: WalletPaymentSource; selection: WalletWorkspaceSelection }>) {
  const selected = useSyncExternalStore(selection.subscribe, selection.getSnapshot, selection.getSnapshot);
  const accounts = [...context.replica.state.accounts.keys()];
  const accountId = accounts.includes(selected.workspaceAccountId) ? selected.workspaceAccountId : accounts[0] || '';
  const tool = useSyncExternalStore(selection.subscribe, selection.getAccountTools, selection.getAccountTools).manage;
  const tab = tool.tab;
  const setTab = (tab: ManageTab) => selection.selectAccountTool(context.runtimeId, context.entityId, 'manage', { ...tool, tab });
  useEffect(() => { if (accountId && accountId !== selected.workspaceAccountId) selection.selectAccount(context.runtimeId, context.entityId, accountId); }, [accountId, selected.workspaceAccountId, selection, context.runtimeId, context.entityId]);
  const command = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot).command;
  const busy = command.status === 'submitting' || command.status === 'pending';
  const account = context.replica.state.accounts.get(accountId);
  return <section data-testid="wallet-manage">
    <label>Account<select aria-label="Account" value={accountId} disabled={busy} onChange={event => selection.selectAccount(context.runtimeId, context.entityId, event.target.value)}>{accounts.map(id => <option value={id} key={id}>{context.names.get(id) || id}</option>)}</select></label>
    <nav className="wallet-tool-tabs" aria-label="Account manage workspace">{tabs.map(([id, label]) => <button key={id} data-testid={`configure-tab-${id}`} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {!context.commandsReady ? <p role="status">{context.commandReason || 'Account actions require a live authorized Runtime.'}</p> : null}
    {account ? tab === 'load-testing' ? <WalletLoadTesting key={accountId} context={context} source={source} accountId={accountId} />
      : <ManageForm key={`${accountId}:${tab}`} context={context} source={source} accountId={accountId} tab={tab} disabled={busy || !context.commandsReady} tokenId={tool.tokenId} setToken={tokenId => selection.selectAccountTool(context.runtimeId, context.entityId, 'manage', { ...tool, tokenId })} />
      : <p>Select an Account first.</p>}
  </section>;
}

function ManageForm({ context, source, accountId, tab, disabled, tokenId, setToken }: Readonly<{
  context: WalletAccountContext; source: WalletPaymentSource; accountId: string; tab: Exclude<ManageTab, 'load-testing'>; disabled: boolean; tokenId: number; setToken: (tokenId: number) => void;
}>) {
  const account = context.replica.state.accounts.get(accountId);
  if (!account) throw new Error('MANAGE_ACCOUNT_UNAVAILABLE');
  const delta = account.state.deltas.get(tokenId);
  const derived = delta ? context.xln.deriveDelta(delta, context.xln.isLeftEntity(context.entityId, accountId)) : null;
  const max = derived && derived.outPeerCredit > 0n ? derived.outPeerCredit : 0n;
  const [draft, setDraft] = useState<string | null>(null);
  const amount = draft ?? (tab === 'collateral' ? formatWalletExternalAmount(max, context.xln.getTokenInfo(tokenId).decimals, context.xln.getTokenInfo(tokenId).decimals) : '');
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const token = context.xln.getTokenInfo(tokenId);
  const tokens = buildConfigureTokenOptions({ reserveTokenIds: context.replica.state.reserves.keys(), getTokenInfo: context.xln.getTokenInfo, compareSymbols: compareStableText });
  const policy = resolveCollateralFeePolicy(account, context.entityId, tokenId);
  let parsed = 0n;
  let invalid = '';
  try { if (amount.trim()) parsed = context.xln.parseTokenAmount(tokenId, amount); }
  catch (cause) { invalid = String(cause); }
  const fee = policy ? collateralRequestFee(policy, parsed) : null;
  const run = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (tab === 'request-credit') { setNotice(await requestWalletCredit(source.workspaceApiBase(context.apiBase), context.entityId, accountId, tokenId, parsed)); setDraft(''); return; }
      const tx = tab === 'token' ? buildAddTokenToAccountTx(accountId, tokenId)
        : tab === 'collateral' ? buildCollateralRequest(account, context.entityId, accountId, tokenId, parsed)
        : { type: 'extendCredit', data: { counterpartyEntityId: accountId, tokenId, amount: parsed } } as const;
      await source.submitAccountTxs(context.entityId, [tx]); setDraft('');
    } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  };
  const dispute = async () => {
    const active = Boolean(account.activeDispute);
    const name = context.names.get(accountId) || accountId;
    if (!window.confirm(active ? `Finalize on-chain dispute with ${name}?\n\nThis adds Dispute Finalize to the pending batch. Only do this after the dispute timeout has passed.`
      : `Prepare dispute with ${name}?\n\nThis freezes normal account traffic, removes orderbook exposure, and automatically drafts Dispute Start as soon as evidence is stable.`)) return;
    setBusy(true); setError('');
    try { await source.submitAccountTxs(context.entityId, [active ? buildDisputeFinalizeTx(accountId, 'dispute-finalize-from-configure') : buildPrepareDisputeTx(accountId, 'dispute-prepare-from-configure')]); }
    catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  };
  const label = tabs.find(([id]) => id === tab)?.[1] || '';
  return <section><h2>{tab === 'dispute' ? 'Dispute Account' : label}</h2>
    {tab === 'dispute' ? <>
      <p>One action freezes local Account traffic, removes orderbook exposure, and automatically drafts the on-chain dispute when evidence is stable.</p>
      {account.activeDispute ? <p>Active dispute. Finalize only after the timeout passes on-chain.</p> : account.status === 'dispute_preparing' ? <p>Preparing automatically. Normal Account traffic is frozen; Dispute Start will appear in the batch after orderbook removals are confirmed.</p> : <p>This stops normal Account traffic before committing the on-chain dispute hash.</p>}
      {account.activeDispute || account.status !== 'dispute_preparing' ? <button className="wallet-tool-danger" disabled={disabled || busy} data-testid={account.activeDispute ? 'configure-dispute-finalize' : 'configure-dispute-prepare'} onClick={() => void dispute()}>{account.activeDispute ? 'Add Dispute Finalize To Batch' : 'Prepare & Queue Dispute'}</button> : null}
    </> : <form onSubmit={event => { event.preventDefault(); void run(); }}><fieldset disabled={disabled || busy}>
      <label>Asset<select aria-label="Asset" value={tokenId} onChange={event => { setToken(Number(event.target.value)); setDraft(null); setNotice(''); }}>{tokens.map(({ id, symbol }) => <option value={id} key={id}>{symbol}</option>)}</select></label>
      {tab === 'token' ? <p>Adds a token delta with zero credit. Use Extend Credit to set its limit.</p> : <label>{tab === 'collateral' ? 'Collateral amount' : 'Credit amount'}<input inputMode="decimal" value={amount} onChange={event => setDraft(event.target.value)} required /></label>}
      {derived ? <p data-testid="manage-credit-summary">Peer granted us {context.xln.formatTokenAmount(tokenId, derived.ownCreditLimit)} · We granted peer {context.xln.formatTokenAmount(tokenId, derived.peerCreditLimit)}</p> : null}
      {tab === 'collateral' ? <><p>Uncollateralized {context.xln.formatTokenAmount(tokenId, max)}</p><button type="button" onClick={() => setDraft(formatWalletExternalAmount(max, token.decimals, token.decimals))}>Max needed</button>
        <p>{fee === null ? 'Missing committed counterparty rebalance fee policy.' : `Fee ${context.xln.formatTokenAmount(tokenId, fee)} · Net collateral ${context.xln.formatTokenAmount(tokenId, parsed > fee ? parsed - fee : 0n)}`}</p>
        {parsed > max ? <><p>Overcollateralization {context.xln.formatTokenAmount(tokenId, parsed - max)}. Hub acceptance cap: {context.xln.formatTokenAmount(tokenId, max)}.</p>
          <p>Fee estimate: $1 per $100 per hour (approx.). For {minutes} minutes: {collateralRentEstimate(parsed - max, token.decimals, token.symbol, minutes).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.</p>
          <label>Overcollateralization duration (minutes)<input type="range" min="1" max="100" value={minutes} onChange={event => setMinutes(Number(event.target.value))} /></label></> : null}</> : null}
      {invalid ? <p role="alert">{invalid}</p> : null}
      <button data-testid={tab === 'token' ? 'configure-token-add' : undefined} disabled={Boolean(invalid) || (tab !== 'token' && parsed <= 0n) || (tab === 'collateral' && (fee === null || parsed <= fee))}>{busy ? 'Submitting…' : label}</button>
    </fieldset></form>}
    {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
  </section>;
}
