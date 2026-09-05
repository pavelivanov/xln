import type { AccountTokenDetailRow } from '../../../src/lib/components/Entity/shared/account-token-details';
import { buildTokenVisualScale } from '../../../src/lib/components/Entity/shared/delta-visual';
import { DeltaCapacityBar } from '../../../packages/ui/src/rcpan/delta-capacity-bar';
import { DeltaApple } from '../../../packages/ui/src/rcpan/delta-apple';
import { useDeltaBarAnimation } from '../../../packages/ui/src/rcpan/delta-bar-animation';
import { formatHoldHint, formatUsdHint, iconForSymbol } from '../../../packages/ui/src/rcpan/delta-token-format';
import type { useAccountAppearance } from './wallet-account-appearance-source';

export function WalletAccountSummary({ detail, format, appearance, expanded, controls, onToggle, commandsReady, busy, funding, onFaucet }: Readonly<{
  detail: AccountTokenDetailRow; format: (id: number, value: bigint) => string; appearance: ReturnType<typeof useAccountAppearance>;
  expanded: boolean; controls: string; onToggle: () => void; commandsReady: boolean; busy: boolean; funding: boolean; onFaucet: () => void;
}>) {
  const { tokenId, tokenInfo, derived } = detail;
  const { symbol, decimals } = tokenInfo;
  const visualScale = buildTokenVisualScale(symbol, decimals, derived);
  const animation = useDeltaBarAnimation(derived, appearance);
  const usdHint = formatUsdHint(visualScale?.outCapacityUsd ?? 0);
  const outHold = formatHoldHint(derived.outTotalHold ?? 0n, decimals);
  const inHold = formatHoldHint(derived.inTotalHold ?? 0n, decimals);
  const icon = iconForSymbol(symbol);
  const faucet = <button type="button" disabled={!commandsReady || busy} title={commandsReady ? 'Request faucet funds' : 'Runtime is not ready for financial actions'} onClick={onFaucet}>{funding ? 'Funding…' : 'Faucet'}</button>;
  if (appearance.accountSkin === 'apple') return <>
    <DeltaApple derived={derived} decimals={decimals} symbol={symbol} name={tokenInfo.name || symbol} outAmount={format(tokenId, derived.outCapacity)} inAmount={format(tokenId, derived.inCapacity)}
      barStyle={appearance.accountBarStyle} expanded={expanded} controls={controls} onToggle={onToggle} />
    <div className="wallet-account-apple-actions">{faucet}</div>
  </>;
  const flashText = animation.flash === null ? '' : `${animation.flash > 0n ? '+' : ''}${(Number(animation.flash) / (10 ** decimals)).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return <>
    <header className="wallet-account-summary-head"><div className="wallet-account-token-name"><span className={`wallet-account-token-icon ${icon.cls}`}>{icon.text}</span><div><strong>{symbol}</strong><small>{tokenInfo.name}</small></div></div>{faucet}</header>
    <dl className="wallet-account-capacities"><div><dt>Out capacity</dt><dd>{format(tokenId, derived.outCapacity)}
      {usdHint ? <small>{usdHint}</small> : null}{outHold ? <small className="wallet-account-hold">{outHold}</small> : null}
      {flashText ? <span className={`wallet-account-delta-flash ${animation.flash !== null && animation.flash > 0n ? 'positive' : 'negative'}`}>{flashText}</span> : null}
    </dd></div><div><dt>In capacity</dt><dd>{format(tokenId, derived.inCapacity)}{inHold ? <small className="wallet-account-hold">{inHold}</small> : null}</dd></div></dl>
    <DeltaCapacityBar derived={derived} visualScale={visualScale} settings={appearance} layout={appearance.barLayout} expanded={expanded} controls={controls} label={`${symbol} capacity bar`} onToggle={onToggle} animation={animation} />
    <button className="wallet-account-expand" type="button" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}>{expanded ? 'Hide' : 'Show'} {symbol} details <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
  </>;
}
