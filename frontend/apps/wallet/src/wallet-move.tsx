import { useEffect, useState, useSyncExternalStore } from 'react';
import { MaxUint256, ZeroAddress } from 'ethers';
import { getDraftBatchReserveDelta } from '@xln/core/jurisdiction/machine/batch';
import type { WalletAccountContext } from '../../../bridges/wallet-canonical-account-context';
import { formatWalletExternalAmount } from '../../../packages/browser/src/wallet-external-provider';
import { getMovePrimaryActionLabel, MOVE_ENDPOINT_LABEL, routeRequiresExplicitExternalAllowance, type MoveEndpoint } from '../../../src/lib/components/Entity/move-routes';
import { getMoveMaxAmountForEndpoint, getPreferredMoveSourceAccountId, sumOpenMoveDebt } from '../../../src/lib/components/Entity/move/move-balance';
import { getMoveValidationErrorForContext } from '../../../src/lib/components/Entity/move/move-validation';
import { buildMoveHubEntityOptions } from '../../../src/lib/components/Entity/workspace/entity-panel-options';
import { parseEntityInput } from '../../../src/lib/components/shared/entity-input-model';
import { WalletEntityInput } from './wallet-entity-input';
import { parsePositiveAssetAmount } from '../../../src/lib/components/Entity/assets/entity-asset-values';
import { WalletExternalProviderSource } from './wallet-external-provider-source';
import { WalletMoveRoute } from './wallet-move-route';
import { buildWalletMoveDraftTxs } from './wallet-move-model';
import { WalletPaymentBatch } from './wallet-payment-batch';
import type { WalletPaymentProjection } from './wallet-payment-model';
import type { WalletPaymentSource } from './wallet-payment-source';
import type { WalletWorkspaceSelection } from './wallet-workspace-selection';

export function WalletMove({ context, source, projection, selection }: Readonly<{
  context: WalletAccountContext; source: WalletPaymentSource; projection: WalletPaymentProjection; selection: WalletWorkspaceSelection;
}>) {
  const [external] = useState(() => new WalletExternalProviderSource(context.entityId, projection.signerId));
  const externalSnapshot = useSyncExternalStore(external.subscribe, external.getSnapshot, external.getSnapshot);
  const payment = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  useEffect(() => { void external.start(); return external.stop; }, [external]);
  const accounts = [...context.replica.state.accounts.keys()];
  const stored = useSyncExternalStore(selection.subscribe, selection.getAccountTools, selection.getAccountTools).move;
  const initialAccount = selection.getSnapshot().workspaceAccountId || accounts[0] || "";
  const selected = stored.initialized ? stored : { ...stored, initialized: true, sourceAccount: initialAccount, target: context.entityId,
    hub: initialAccount, recipient: context.entityId, eoa: projection.signerId };
  useEffect(() => { if (!stored.initialized) selection.selectAccountTool(context.runtimeId, context.entityId, 'move', selected); }, [stored.initialized, selected, selection, context.runtimeId, context.entityId]);
  const from = selected.from, to = selected.to, tokenId = selected.tokenId;
  const entityOptions = [...new Set([context.entityId, ...accounts, ...projection.entities.map(entity => entity.entityId), ...context.paymentView.profiles.map(profile => profile.entityId)])];
  const profiles = [...context.names].map(([entityId, name]) => ({ entityId, name }));
  const resolve = (value: string) => { const parsed = parseEntityInput(value, { entities: entityOptions, profiles }); return parsed.resolved ? parsed.entityId : ''; };
  const targetInput = selected.target, recipientInput = selected.recipient;
  const target = resolve(targetInput), recipient = resolve(recipientInput), eoa = selected.eoa;
  const hubs = buildMoveHubEntityOptions({ targetEntityId: target, selfEntityId: context.entityId, workspaceAccountIds: accounts, profiles: context.paymentView.profiles });
  const hubInput = selected.hub;
  const hub = resolve(hubInput);
  const update = (patch: Partial<typeof selected>) => selection.selectAccountTool(context.runtimeId, context.entityId, "move", { ...selected, ...patch });
  const setToken = (tokenId: number) => update({ tokenId });
  const setSourceAccount = (sourceAccount: string) => update({ sourceAccount });
  const setRecipient = (recipient: string) => update({ recipient });
  const setTarget = (target: string) => {
    const options = buildMoveHubEntityOptions({ targetEntityId: resolve(target), selfEntityId: context.entityId, workspaceAccountIds: accounts, profiles: context.paymentView.profiles });
    update({ target, hub: options.includes(initialAccount) ? initialAccount : options[0] || '', manualHub: false });
  };
  const setEoa = (eoa: string) => update({ eoa });
  const setHub = (hub: string) => {
    const resolved = resolve(hub), manualHub = Boolean(resolved && !hubs.includes(resolved));
    if (manualHub && !window.confirm('This counterparty is not listed in the recipient profile. Funds may be lost if they do not support this account. Continue?')) return;
    update({ hub, manualHub });
  };
  const [amount, setAmount] = useState('');
  const [allowanceAmount, setAllowance] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const view = externalSnapshot.view;
  const externalToken = view ? view.tokens.find(token => token.tokenId === tokenId) || null : null;
  const token = tokenId === 0 ? { symbol: 'ETH', decimals: 18 } : from === 'external' && externalToken ? externalToken : context.xln.getTokenInfo(tokenId);
  const tokenOptions = from === 'external' && view ? view.tokens : projection.tokens;
  const accountSpendable = (id: string, tokenId: number) => {
    const account = context.replica.state.accounts.get(id), delta = account ? account.state.deltas.get(tokenId) : null;
    return delta ? context.xln.deriveDelta(delta, context.xln.isLeftEntity(context.entityId, id)).outCapacity : 0n;
  };
  let requestedAmount = 0n, amountError = '';
  try { if (amount.trim()) requestedAmount = parsePositiveAssetAmount(amount, token); } catch (cause) { amountError = String(cause); }
  const sourceAccount = from === 'account' ? getPreferredMoveSourceAccountId({ current: selected.sourceAccount, workspaceAccountIds: accounts,
    tokenId, requestedAmount, accountSpendable }) : selected.sourceAccount;
  useEffect(() => { if (from === 'account' && sourceAccount !== selected.sourceAccount) setSourceAccount(sourceAccount); }, [from, sourceAccount, selected.sourceAccount]);
  const balance = tokenId === 0 ? view ? view.nativeBalance : 0n : externalToken ? externalToken.balance : 0n;
  const busy = submitting || payment.status !== 'ready' || payment.command.status === 'submitting' || payment.command.status === 'pending' || externalSnapshot.operation.status === 'submitting';
  const allowanceRequired = routeRequiresExplicitExternalAllowance(from, to);
  const batch = context.replica.state.jBatchState;
  const available = getMoveMaxAmountForEndpoint({ from, reserveToken: tokenId ? { tokenId } : null, externalToken: { balance }, sourceAccountId: sourceAccount,
    reserveBalance: id => context.replica.state.reserves.get(id) || 0n,
    draftReserveDelta: id => batch ? getDraftBatchReserveDelta(context.entityId, batch.batch, id) : 0n,
    outgoingDebt: id => { const debts = context.replica.state.outDebtsByToken?.get(id); return sumOpenMoveDebt(debts ? debts.values() : []); },
    accountSpendable,
  }) || 0n;
  const validation = amountError || getMoveValidationErrorForContext({ mode: from === 'external' && to === 'external' ? 'broadcast' : 'draft', from, to, amountInput: amount, executing: busy,
    activeIsLive: context.commandsReady, awaitingCounterparty: Boolean(context.replica.state.settlementContinuations?.size), hasSentBatch: Boolean(projection.batch.sentHash), sourceAccountId: sourceAccount,
    targetEntityId: target, targetHubId: hub, selfEntityId: context.entityId, selfExternalAddress: projection.signerId, reserveRecipientEntityId: recipient, externalRecipient: eoa,
    reserveToken: tokenId ? token : null, externalToken: view ? token : null, sourceAvailableBalance: available,
    allowanceRequired, allowanceLoading: externalSnapshot.status === 'loading', allowanceError: from === 'external' && !view ? externalSnapshot.message : null, allowanceRaw: externalToken ? externalToken.allowance : null });
  const route = (from: MoveEndpoint, to: MoveEndpoint) => { update({ from, to, tokenId: tokenId === 0 && (from !== 'external' || to !== 'external') ? 1 : tokenId }); setAmount(''); setError(''); };
  const approve = async (max: boolean) => {
    setError(''); setSubmitting(true);
    try {
      if (!externalToken) throw new Error('Select ERC20 asset first.');
      const value = max ? MaxUint256 : parsePositiveAssetAmount(allowanceAmount || amount, token);
      await external.approve({ tokenAddress: externalToken.address, amount: value });
    } catch (cause) { setError(String(cause)); } finally { setSubmitting(false); }
  };
  const submit = async () => {
    setError('');
    try {
      if (validation) throw new Error(validation);
      setSubmitting(true);
      const value = parsePositiveAssetAmount(amount, token, available);
      if (from === 'external' && to === 'external') await external.transfer({ tokenAddress: externalToken ? externalToken.address : ZeroAddress, amount: value, recipient: eoa });
      else await source.submitAccountTxs(context.entityId, buildWalletMoveDraftTxs({ from, to, entityId: context.entityId, sourceAccountId: sourceAccount, targetEntityId: target,
        targetHubId: hub, reserveRecipient: recipient, externalRecipient: eoa, tokenId, amount: value, tokenAddress: externalToken ? externalToken.address : '' }));
      setAmount('');
    } catch (cause) { setError(String(cause)); } finally { setSubmitting(false); }
  };
  return <section data-testid="move-workspace-accounts">
    <WalletMoveRoute from={from} to={to} disabled={busy} onChange={route} />
    <fieldset disabled={busy} className="wallet-tool-fields">
      {from === 'account' ? <label>From Account<select aria-label="From Account" value={sourceAccount} onChange={event => setSourceAccount(event.target.value)}>{accounts.map(id => <option key={id} value={id}>{context.names.get(id) || id}</option>)}</select></label> : null}
      {from === 'reserve' && to === 'reserve' ? <WalletEntityInput label="To reserve Entity" value={recipientInput} onChange={setRecipient} entities={entityOptions} profiles={profiles} disabled={busy} /> : null}
      {from !== 'reserve' && to === 'reserve' ? <p>Funds enter this Entity’s reserve.</p> : null}
      {to === 'account' ? <><WalletEntityInput value={targetInput} onChange={setTarget} entities={entityOptions} profiles={profiles} disabled={busy} />
        <WalletEntityInput label="To Account" value={hubInput} onChange={setHub} entities={hubs} profiles={profiles} disabled={busy} /></> : null}
      {to === 'external' ? <label>Recipient EOA<input value={eoa} onChange={event => setEoa(event.target.value)} /></label> : null}
    </fieldset>
    <h2>{MOVE_ENDPOINT_LABEL[from]} → {MOVE_ENDPOINT_LABEL[to]}</h2>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}><fieldset disabled={busy} className="wallet-tool-fields">
      <label>Asset<select aria-label="Asset" value={tokenId} onChange={event => { setToken(Number(event.target.value)); setAmount(''); setAllowance(''); }}>{from === 'external' && to === 'external' ? <option value="0">ETH</option> : null}{tokenOptions.map(token => <option key={token.tokenId} value={token.tokenId}>{token.symbol}</option>)}</select></label>
      <label>Amount<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label><button type="button" onClick={() => setAmount(formatWalletExternalAmount(available, token.decimals, token.decimals))}>Max</button>
    </fieldset><p data-testid="move-available">Available {formatWalletExternalAmount(available, token.decimals)} {token.symbol}</p>
      {from === 'external' && !view ? <p role="status">{externalSnapshot.message}</p> : null}
      {allowanceRequired ? <section className="wallet-move-allowance"><h3>ERC20 allowance</h3><p>Current allowance {externalToken ? formatWalletExternalAmount(externalToken.allowance, token.decimals) : '—'} {token.symbol}</p>
        <label>Allowance amount<input inputMode="decimal" disabled={busy} value={allowanceAmount || amount} onChange={event => setAllowance(event.target.value)} /></label>
        <div className="wallet-tool-tabs"><button type="button" disabled={busy || !view || !view.writable} onClick={() => void approve(false)}>Allow amount</button><button type="button" disabled={busy || !view || !view.writable} onClick={() => void approve(true)}>Allow max</button></div></section> : null}
      {validation ? <p role="status">{validation}</p> : null}<button disabled={Boolean(validation)}>{getMovePrimaryActionLabel(from, to)}</button>
    </form>
    {error ? <p role="alert">{error}</p> : null}{externalSnapshot.operation.status !== 'idle' ? <p role={externalSnapshot.operation.status === 'error' ? 'alert' : 'status'}>{externalSnapshot.operation.message} {externalSnapshot.operation.transactionHash}</p> : null}
    <WalletPaymentBatch projection={projection} snapshot={payment} source={source} />
  </section>;
}
