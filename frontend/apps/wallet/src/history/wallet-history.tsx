import { useEffect, useState } from 'react';
import type { WalletAccountContext } from '../../../../bridges/wallet/wallet-canonical-account-context';
import { buildActivityHistoryReadQuery, isTransientActivityReadError, type ActivityHistoryQueryInput } from '../../../../src/lib/components/Entity/account/activity/activity-history-query';
import { appendHistoryEvents, decodeWalletHistory, HISTORY_TYPES, historyTimeRange } from './wallet-history-model';
import type { WalletPaymentSource } from '../payments/wallet-payment-source';

const initialFilters = { kind: 'all', pageSize: 80, selectedTypes: [], search: '', mode: 'paged', beforeHeight: null } satisfies Omit<ActivityHistoryQueryInput, 'entityId'>;
type HistoryPage = ReturnType<typeof decodeWalletHistory>;

export function WalletHistory({ context, source }: Readonly<{ context: WalletAccountContext; source: WalletPaymentSource }>) {
  const [filters, setFilters] = useState<Omit<ActivityHistoryQueryInput, 'entityId'>>(initialFilters);
  const [cursors, setCursors] = useState<Array<number | null>>([null]);
  const [index, setIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { adapter, math } = source.workspaceRuntime();
  useEffect(() => adapter.onChange(() => { setCursors([null]); setIndex(0); setPage(null); setRevision(value => value + 1); }), [adapter]);
  useEffect(() => {
    const lifetime = new AbortController();
    setLoading(true); setError('');
    const read = async () => {
      const query = buildActivityHistoryReadQuery({ ...filters, entityId: context.entityId, beforeHeight: cursors[index] ?? null });
      const delays = [100, 250, 500];
      for (let attempt = 0; ; attempt += 1) {
        lifetime.signal.throwIfAborted();
        try { return decodeWalletHistory(await adapter.read('activity', query), math); }
        catch (cause) {
          const delay = delays[attempt];
          if (delay === undefined || !isTransientActivityReadError(cause)) throw cause;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };
    void read().then(next => {
      if (lifetime.signal.aborted) return;
      setPage(previous => filters.mode !== 'paged' && index > 0 && previous
        ? { ...next, events: appendHistoryEvents(previous.events, next.events) } : next);
    }, cause => { if (!lifetime.signal.aborted) { setPage(null); setError(String(cause)); } })
      .finally(() => { if (!lifetime.signal.aborted) setLoading(false); });
    return () => lifetime.abort();
  }, [adapter, math, context.entityId, filters, cursors, index, revision]);
  const update = (patch: Partial<typeof filters>) => { setFilters(current => ({ ...current, ...patch })); setCursors([null]); setIndex(0); setPage(null); };
  const older = () => {
    if (!page || page.nextBeforeHeight === null) return;
    setCursors(current => [...current.slice(0, index + 1), page.nextBeforeHeight]); setIndex(index + 1);
  };
  return <section data-testid="entity-history-panel" aria-label="Entity history">
    <div className="wallet-tool-heading"><h2>Entity activity</h2><button data-testid="history-refresh" disabled={loading} onClick={() => setRevision(revision + 1)}>Refresh history</button></div>
    <p>{page ? `Runtime height ${page.latestHeight} · ${page.events.length} loaded · ${page.scannedFrames} frames scanned` : 'Reading persisted history'}</p>
    <nav aria-label="History type" className="wallet-tool-tabs">{(['all', 'offchain', 'onchain'] as const).map(kind => <button key={kind} aria-pressed={filters.kind === kind} data-testid={`history-kind-${kind}`} onClick={() => update({ kind })}>{kind === 'all' ? 'All' : kind === 'offchain' ? 'Off-chain' : 'On-chain'}</button>)}</nav>
    <div className="wallet-tool-fields"><label>Search history<input type="search" value={filters.search} data-testid="history-search" placeholder="Title, order, counterparty" onChange={event => update({ search: event.target.value })} /></label>
      <label>Page size<select value={filters.pageSize} data-testid="history-page-size" onChange={event => update({ pageSize: Number(event.target.value) })}>{[40, 80, 160].map(size => <option key={size}>{size}</option>)}</select></label></div>
    <nav aria-label="History mode" className="wallet-tool-tabs">{(['paged', 'infinite', 'timeframe'] as const).map(mode => <button key={mode} data-testid={`history-mode-${mode}`} aria-pressed={filters.mode === mode} onClick={() => update({ mode })}>{mode === 'paged' ? 'Pagination' : mode === 'infinite' ? 'Infinite' : 'Timeframe'}</button>)}</nav>
    {filters.mode === 'timeframe' ? <form className="wallet-tool-fields" onSubmit={event => { event.preventDefault(); try { update(historyTimeRange(from, to)); } catch (cause) { setError(String(cause)); } }}>
      <label>From<input type="datetime-local" value={from} data-testid="history-from" onChange={event => setFrom(event.target.value)} /></label>
      <label>To<input type="datetime-local" value={to} data-testid="history-to" onChange={event => setTo(event.target.value)} /></label><button data-testid="history-apply-timeframe">Apply</button></form> : null}
    <nav aria-label="Activity filters" className="wallet-tool-tabs">{HISTORY_TYPES.map(([id, label]) => <button key={id} data-testid={`history-type-${id}`} aria-pressed={filters.selectedTypes.includes(id)} onClick={() => update({ selectedTypes: filters.selectedTypes.includes(id) ? filters.selectedTypes.filter(type => type !== id) : [...filters.selectedTypes, id] })}>{label}</button>)}
      <button data-testid="history-clear-filters" onClick={() => { setFrom(''); setTo(''); update({ search: '', selectedTypes: [], fromTimestamp: undefined, toTimestamp: undefined }); }}>Clear filters</button></nav>
    {error ? <p role="alert">{error}</p> : null}{page && page.failures.length ? <p role="alert">Partial history: {page.failures.join('; ')}</p> : null}
    {loading ? <p role="status">Loading history…</p> : null}
    {page && !page.events.length ? <p>No history in this window. Try fewer filters or an older frame window.</p> : null}
    <ol className="wallet-history-list">{page?.events.map(event => <li key={event.id} data-testid="entity-history-event">
      <div><strong>{event.title}</strong><p>{event.subtitle}</p><small>{event.direction} · {event.kind} · {event.type} · R#{event.height}</small>
        {event.counterpartyId ? <small title={event.counterpartyId}>{context.names.get(event.counterpartyId) || event.counterpartyId}</small> : null}{event.orderId ? <small>Order {event.orderId}</small> : null}</div>
      <div><strong data-testid="history-event-amount">{event.amountLabel ?? event.status}</strong><time>{event.timestamp < 946684800000 ? `Runtime t+${event.timestamp}ms` : new Date(event.timestamp).toLocaleString()}</time></div>
    </li>)}</ol>
    <footer className="wallet-tool-heading">{filters.mode === 'paged' ? <><button disabled={loading || index === 0} data-testid="history-newer-page" onClick={() => setIndex(index - 1)}>Newer</button><span>Page {index + 1}</span><button disabled={loading || !page || page.nextBeforeHeight === null} data-testid="history-older-page" onClick={older}>Older</button></>
      : <><button disabled={loading || !page || page.nextBeforeHeight === null} data-testid="history-load-older" onClick={older}>Load older</button><span>{page?.nextBeforeHeight === null ? 'End of retained history' : `${page?.events.length ?? 0} loaded`}</span></>}</footer>
  </section>;
}
