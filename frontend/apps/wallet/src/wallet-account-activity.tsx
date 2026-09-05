import { useId, useMemo, useState } from 'react';
import { createAccountActivityPresentation } from '../../../src/lib/components/Entity/account/account-activity-presentation';
import { compareStableText } from '../../../src/lib/utils/stableSort';
import type { WalletAccountView } from './wallet-account-view-model';

export function WalletAccountActivity({ view }: Readonly<{ view: WalletAccountView }>) {
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const id = useId();
  const presentation = useMemo(() => createAccountActivityPresentation(view.presentation), [view.presentation]);
  const types = [...new Set(view.activity.flatMap(row => row.txs.map(tx => tx.type)))].sort((a, b) => compareStableText(presentation.txTypeLabel(a), presentation.txTypeLabel(b)));
  const rows = view.activity.filter(row => status === 'all' || row.kind === status)
    .map(row => ({ ...row, txs: row.txs.filter(tx => type === 'all' || tx.type === type) })).filter(row => row.txs.length > 0);
  return <section className="wallet-account-activity" aria-label="Account activity">
    <h2>Activity</h2><div className="wallet-account-filters">
      <div><label htmlFor={`${id}-status`}>Status</label><select id={`${id}-status`} value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">All</option><option value="pending">Pending</option><option value="mempool">Mempool</option><option value="confirmed">Confirmed</option>
      </select></div>
      <div><label htmlFor={`${id}-action`}>Action</label><select id={`${id}-action`} value={type} onChange={event => setType(event.target.value)}>
        <option value="all">All</option>{types.map(value => <option key={value} value={value}>{presentation.txTypeLabel(value)}</option>)}
      </select></div></div>
    {rows.length === 0 ? <p>No account activity yet.</p> : rows.map(row => <article key={row.id} className="wallet-account-frame" data-kind={row.kind}>
      <header><strong>{row.frameLabel}</strong><span>{row.statusLabel}</span><time>{presentation.formatTimestamp(row.timestamp)}</time></header>
      {row.txs.map((tx, index) => <div key={`${index}:${tx.type}`} className="wallet-account-action">
        <h3 data-tone={presentation.txKindTone(tx.type)}>{presentation.txTypeLabel(tx.type)} <small>#{index + 1}</small></h3>
        <dl>{presentation.buildActionParams(tx).map((param, paramIndex) => <div key={`${paramIndex}:${param.label}`}><dt>{param.label}</dt><dd data-tone={param.tone}>{param.value}</dd></div>)}</dl>
      </div>)}
    </article>)}
  </section>;
}
