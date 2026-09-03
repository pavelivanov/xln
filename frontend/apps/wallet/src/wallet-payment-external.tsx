import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  encodeWalletExternalRecipient,
  formatWalletExternalAmount,
  normalizeWalletExternalAddress,
  parseWalletExternalAmount,
  type WalletExternalToken,
} from '../../../packages/browser/src/wallet-external-provider';
import type { WalletPaymentProjection } from './wallet-payment-model';
import { WalletExternalProviderUnavailable } from './wallet-payment-external-state';
import type { WalletPaymentSource, WalletPaymentSourceSnapshot } from './wallet-payment-source';
import { WalletExternalProviderSource } from './wallet-external-provider-source';
import './styles/wallet-external-provider.css';
type ExternalMode = 'direct' | 'deposit' | 'withdraw';
type ExternalAsset = Readonly<{
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  balance: bigint;
  token: WalletExternalToken | null;
}>;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

const shortAddress = (value: string): string => (
  value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
);

const modeCopy: Record<ExternalMode, Readonly<{ label: string; detail: string }>> = {
  direct: { label: 'Wallet transfer', detail: 'Sign one native or ERC20 transfer.' },
  deposit: { label: 'Deposit to reserve', detail: 'Approve, then queue an Entity batch item.' },
  withdraw: { label: 'Withdraw reserve', detail: 'Queue withdrawal and broadcast the J-batch.' },
};

export function WalletPaymentExternal({
  projection,
  paymentSnapshot,
  paymentSource,
}: Readonly<{
  projection: WalletPaymentProjection;
  paymentSnapshot: WalletPaymentSourceSnapshot;
  paymentSource: WalletPaymentSource;
}>) {
  const [source] = useState(() => new WalletExternalProviderSource(
    projection.activeEntityId,
    projection.signerId,
  ));
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const [mode, setMode] = useState<ExternalMode>('direct');
  const [assetKey, setAssetKey] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void source.start();
    return source.stop;
  }, [source]);

  const view = snapshot.view;
  if (!view) {
    return (
      <WalletExternalProviderUnavailable
        refresh={() => { void source.refresh(); }}
        snapshot={snapshot}
      />
    );
  }

  const nativeAsset: ExternalAsset = {
    symbol: 'ETH',
    name: 'Native gas asset',
    address: ZERO_ADDRESS,
    decimals: 18,
    balance: view.nativeBalance,
    token: null,
  };
  const erc20Assets: ExternalAsset[] = view.tokens.map((token) => ({
    symbol: token.symbol,
    name: token.name,
    address: token.address,
    decimals: token.decimals,
    balance: token.balance,
    token,
  }));
  const directAssets = [nativeAsset, ...erc20Assets];
  const withdrawalAssets = view.tokens.flatMap((token) => {
    const reserve = projection.tokens.find((candidate) => candidate.tokenId === token.tokenId);
    return reserve ? [{ ...token, reserve: reserve.reserve }] : [];
  });
  const availableKeys = mode === 'direct'
    ? directAssets.map(({ address }) => address)
    : mode === 'deposit'
      ? view.tokens.map(({ address }) => address)
      : withdrawalAssets.map(({ tokenId }) => String(tokenId));
  const selectedKey = availableKeys.includes(assetKey) ? assetKey : availableKeys[0] || '';
  const selectedAsset = directAssets.find(({ address }) => address === selectedKey) ?? null;
  const selectedToken = view.tokens.find(({ address }) => address === selectedKey) ?? null;
  const selectedWithdrawal = withdrawalAssets.find(({ tokenId }) => String(tokenId) === selectedKey) ?? null;
  const runtimeBusy = paymentSnapshot.command.status === 'submitting'
    || paymentSnapshot.command.status === 'pending';
  const busy = runtimeBusy || snapshot.operation.status === 'submitting';
  let parsedDepositAmount = 0n;
  if (mode === 'deposit' && selectedToken && amount.trim()) {
    try {
      parsedDepositAmount = parseWalletExternalAmount(amount, selectedToken.decimals, selectedToken.balance);
    } catch {
      parsedDepositAmount = 0n;
    }
  }
  const needsApproval = Boolean(
    selectedToken && parsedDepositAmount > 0n && selectedToken.allowance < parsedDepositAmount,
  );

  const changeMode = (next: ExternalMode): void => {
    setMode(next);
    setAssetKey('');
    setAmount('');
    setRecipient('');
    setError('');
    source.clearOperation();
  };

  const approve = async (): Promise<void> => {
    setError('');
    try {
      if (!selectedToken) throw new Error('EXTERNAL_WALLET_ERC20_REQUIRED');
      const parsed = parseWalletExternalAmount(amount, selectedToken.decimals, selectedToken.balance);
      await source.approve({ tokenAddress: selectedToken.address, amount: parsed });
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const submit = async (): Promise<void> => {
    setError('');
    try {
      if (mode === 'direct') {
        if (!selectedAsset) throw new Error('EXTERNAL_WALLET_ASSET_REQUIRED');
        const parsed = parseWalletExternalAmount(amount, selectedAsset.decimals, selectedAsset.balance);
        await source.transfer({
          tokenAddress: selectedAsset.address,
          recipient: normalizeWalletExternalAddress(recipient),
          amount: parsed,
        });
      } else if (mode === 'deposit') {
        if (!selectedToken) throw new Error('EXTERNAL_WALLET_ERC20_REQUIRED');
        const parsed = parseWalletExternalAmount(amount, selectedToken.decimals, selectedToken.balance);
        if (selectedToken.allowance < parsed) throw new Error('EXTERNAL_WALLET_APPROVAL_REQUIRED');
        await paymentSource.submitEntityTx({
          type: 'e2r',
          data: {
            contractAddress: selectedToken.address,
            tokenType: selectedToken.tokenType,
            externalTokenId: BigInt(selectedToken.externalTokenId),
            internalTokenId: selectedToken.tokenId,
            amount: parsed,
          },
        });
      } else {
        if (!selectedWithdrawal) throw new Error('EXTERNAL_WALLET_RESERVE_ASSET_REQUIRED');
        const parsed = parseWalletExternalAmount(
          amount,
          selectedWithdrawal.decimals,
          selectedWithdrawal.reserve,
        );
        await paymentSource.submitEntityTxs([
          {
            type: 'r2e',
            data: {
              receivingEntity: encodeWalletExternalRecipient(recipient),
              tokenId: selectedWithdrawal.tokenId,
              amount: parsed,
            },
          },
          { type: 'j_broadcast', data: {} },
        ]);
      }
      setAmount('');
      if (mode !== 'deposit') setRecipient('');
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const actionLabel = mode === 'direct'
    ? 'Sign wallet transfer'
    : mode === 'deposit'
      ? 'Queue reserve deposit'
      : 'Queue and broadcast withdrawal';

  return (
    <section className="wallet-payments-pane wallet-external-provider" aria-labelledby="wallet-external-title" data-testid="wallet-external-provider">
      <div className="wallet-payments-section-heading">
        <div><p>04</p><h2 id="wallet-external-title">External wallet</h2></div>
        <span>{view.platform} · {view.adapterMode}</span>
      </div>

      <div className="wallet-external-authority">
        <div><span>Signer</span><strong title={view.owner}>{shortAddress(view.owner)}</strong></div>
        <div><span>Network</span><strong>{view.jurisdiction} · {view.chainId}</strong></div>
        <div><span>Finalized read</span><strong>block {view.sourceHeight}</strong></div>
        <button disabled={snapshot.status === 'loading' || busy} onClick={() => void source.refresh()} type="button">
          {snapshot.status === 'loading' ? 'Refreshing…' : 'Refresh snapshot'}
        </button>
      </div>

      <div className="wallet-external-balances" aria-label="Finalized external balances">
        <div><span>ETH</span><strong title={formatWalletExternalAmount(view.nativeBalance, 18)}>{formatWalletExternalAmount(view.nativeBalance, 18)}</strong><small>native</small></div>
        {view.tokens.map((token) => (
          <div key={token.address}>
            <span>{token.symbol}</span>
            <strong title={formatWalletExternalAmount(token.balance, token.decimals)}>{formatWalletExternalAmount(token.balance, token.decimals)}</strong>
            <small>allowance {formatWalletExternalAmount(token.allowance, token.decimals)}</small>
          </div>
        ))}
      </div>

      <div className="wallet-external-modes" role="radiogroup" aria-label="External wallet action">
        {(Object.keys(modeCopy) as ExternalMode[]).map((option) => (
          <button
            aria-checked={mode === option}
            className={mode === option ? 'is-selected' : ''}
            disabled={busy}
            key={option}
            onClick={() => changeMode(option)}
            role="radio"
            type="button"
          >
            <strong>{modeCopy[option].label}</strong>
            <span>{modeCopy[option].detail}</span>
          </button>
        ))}
      </div>

      <div className="wallet-payment-form-grid wallet-external-form">
        <label>
          <span>Asset</span>
          <select disabled={busy || availableKeys.length === 0} onChange={(event) => setAssetKey(event.target.value)} value={selectedKey}>
            {mode === 'direct' ? directAssets.map((asset) => (
              <option key={asset.address} value={asset.address}>{asset.symbol} · {formatWalletExternalAmount(asset.balance, asset.decimals)}</option>
            )) : null}
            {mode === 'deposit' ? view.tokens.map((token) => (
              <option key={token.address} value={token.address}>{token.symbol} · wallet {formatWalletExternalAmount(token.balance, token.decimals)}</option>
            )) : null}
            {mode === 'withdraw' ? withdrawalAssets.map((token) => (
              <option key={token.tokenId} value={token.tokenId}>{token.symbol} · reserve {formatWalletExternalAmount(token.reserve, token.decimals)}</option>
            )) : null}
          </select>
        </label>
        <label>
          <span>Amount</span>
          <input disabled={busy} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" value={amount} />
        </label>
        {mode !== 'deposit' ? (
          <label className="wallet-external-recipient">
            <span>Recipient EOA</span>
            <input autoComplete="off" disabled={busy} onChange={(event) => setRecipient(event.target.value)} placeholder="0x…" spellCheck={false} value={recipient} />
          </label>
        ) : null}
      </div>

      {mode === 'deposit' && selectedToken ? (
        <p className={needsApproval ? 'wallet-external-allowance needs-approval' : 'wallet-external-allowance'}>
          Depository allowance: {formatWalletExternalAmount(selectedToken.allowance, selectedToken.decimals)} {selectedToken.symbol}.
          {needsApproval ? ' Approve this exact amount before queuing the deposit.' : ' The entered amount is covered.'}
        </p>
      ) : null}
      {!view.writable ? <p className="wallet-payment-error" role="alert">Authority locked: {view.blockedReason}</p> : null}
      {snapshot.operation.status !== 'idle' ? (
        <div className={`wallet-external-operation is-${snapshot.operation.status}`} role={snapshot.operation.status === 'error' ? 'alert' : 'status'}>
          <strong>{snapshot.operation.status}</strong>
          <span>{snapshot.operation.message}</span>
          {snapshot.operation.transactionHash ? <code>{snapshot.operation.transactionHash}</code> : null}
        </div>
      ) : null}
      {error ? <p className="wallet-payment-error" role="alert">{error}</p> : null}

      <div className="wallet-payment-actions wallet-external-actions">
        {mode === 'deposit' ? (
          <button disabled={busy || !view.writable || !amount.trim() || !needsApproval} onClick={() => void approve()} type="button">
            Approve exact amount
          </button>
        ) : null}
        <button
          className="is-primary"
          disabled={busy || !view.writable || !amount.trim() || (mode !== 'deposit' && !recipient.trim()) || (mode === 'deposit' && needsApproval) || !selectedKey}
          onClick={() => void submit()}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
      <p className="wallet-external-boundary">
        Keys remain inside the unlocked local vault. Reads use one finalized chain block; every write rechecks Runtime, Entity, signer, chain, and Depository before submission.
      </p>
    </section>
  );
}
