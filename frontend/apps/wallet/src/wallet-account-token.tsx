import { useId, useState } from 'react';
import type { AccountTokenDetailRow } from '../../../src/lib/components/Entity/shared/account-token-details';
import { stripTrailingSymbol } from '../../../packages/ui/src/rcpan/delta-token-format';
import type { useAccountAppearance } from './wallet-account-appearance-source';
import { WalletAccountSummary } from './wallet-account-summary';

export function WalletAccountToken({ detail, format, commandsReady, funding, busy, onFaucet, appearance }: Readonly<{
  detail: AccountTokenDetailRow; format: (id: number, value: bigint) => string;
  commandsReady: boolean; funding: boolean; busy: boolean; onFaucet: () => void;
  appearance: ReturnType<typeof useAccountAppearance>;
}>) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const { derived, delta, tokenInfo, tokenId } = detail;
  const amount = (value: bigint) => stripTrailingSymbol(format(tokenId, value), tokenInfo.symbol);
  const rows = [
    ['Capacity', derived.outCapacity, derived.inCapacity],
    ['Credit limit', derived.ownCreditLimit, derived.peerCreditLimit],
    ['Own credit component', derived.outOwnCredit, derived.inOwnCredit],
    ['Peer credit component', derived.outPeerCredit, derived.inPeerCredit],
    ['Collateral component', derived.outCollateral, derived.inCollateral],
    ['Hold deduction', derived.outTotalHold ?? 0n, derived.inTotalHold ?? 0n],
  ] as const;
  return <article className="wallet-account-token" data-token-id={tokenId} data-skin={appearance.accountSkin}>
    <WalletAccountSummary detail={detail} format={format} appearance={appearance} expanded={expanded} controls={id} onToggle={() => setExpanded(value => !value)}
      commandsReady={commandsReady} funding={funding} busy={busy} onFaucet={onFaucet} />
    {expanded ? <div id={id} className="wallet-account-token-details">
      <table><caption>Perspective</caption><thead><tr><th>Parameter</th><th>Out</th><th>In</th></tr></thead>
        <tbody>{rows.map(([label, out, inbound]) => <tr key={label}><th scope="row">{label}</th><td>{amount(out)}</td><td>{amount(inbound)}</td></tr>)}</tbody></table>
      <div><h3>Canonical state</h3><dl>{([['delta', derived.delta], ['offdelta', delta.offdelta], ['ondelta', delta.ondelta]] as const).map(([label, value]) =>
        <div key={label}><dt>{label}</dt><dd>{amount(value)}</dd></div>)}</dl></div>
    </div> : null}
  </article>;
}
