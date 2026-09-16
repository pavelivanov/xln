import { useMemo, useState } from 'react';
import { safeStringify } from '@xln/core/protocol/serialization';
import {
  emptyRuntimeEventFilters,
  filterRuntimeProjectionEvents,
  isCriticalEvent,
  type RuntimeEventFilters,
  type RuntimeProjectionEvent,
} from '../../../../packages/ui/src/health/runtime-events';
import { relayTimelineTone } from '../../../../packages/ui/src/health/relay-event-severity';
import type { useOpsHealthEvents } from './use-ops-health-events';
import '../styles/ops-health-events.css';
import { OpsHealthRuntimeProjections } from './ops-health-runtime-projections';

function RuntimeEvent({ event }: Readonly<{ event: RuntimeProjectionEvent }>) {
  return (
    <article
      className="ops-runtime-event"
      data-tone={relayTimelineTone(event)}
      data-testid="health-runtime-event"
      data-event-id={event.id}
    >
      <header>
        <time dateTime={new Date(event.ts).toISOString()}>{new Date(event.ts).toLocaleString()}</time>
        <strong>{event.event}</strong>
        <span>{event.status}</span>
      </header>
      <p>
        <span>from: {event.from || '—'}</span>
        <span>to: {event.to || '—'}</span>
        <span>Runtime: {event.runtimeId || '—'}</span>
      </p>
      <details>
        <summary>{event.reason || event.msgType || 'Event details'}</summary>
        <pre>{safeStringify(event, 2)}</pre>
      </details>
    </article>
  );
}

export function OpsHealthEventsPanel({ snapshot, refresh }: ReturnType<typeof useOpsHealthEvents>) {
  const [filters, setFilters] = useState(emptyRuntimeEventFilters);
  const data = snapshot.data;
  const events = data?.events;
  const filtered = useMemo(() => filterRuntimeProjectionEvents(events ?? [], filters), [events, filters]);
  const critical = useMemo(() => (events ?? []).filter(isCriticalEvent).slice(-30).reverse(), [events]);
  const update = <Key extends keyof RuntimeEventFilters>(key: Key, value: RuntimeEventFilters[Key]) =>
    setFilters(current => ({ ...current, [key]: value }));
  const selects = [
    { key: 'filterEvent', field: 'event', label: 'Event' },
    { key: 'filterMsgType', field: 'msgType', label: 'Message type' },
    { key: 'filterStatus', field: 'status', label: 'Event status' },
  ] as const;
  return (
    <section className="ops-health-events ops-panel" aria-label="Runtime events" data-testid="health-runtime-events">
      <header>
        <h2>Latest Runtime events</h2>
        <button type="button" disabled={snapshot.loading} onClick={() => void refresh()}>
          Refresh events
        </button>
      </header>
      {snapshot.error ? <p role="alert">Runtime event evidence unavailable: {snapshot.error}</p> : null}
      {snapshot.loading ? <p role="status">Reading Runtime events…</p> : null}
      {data ? (
        <>
          <p className="ops-events-context">
            <span>
              Runtime <code>{data.runtimeId}</code>
            </span>
            <span>
              {data.activity.scannedFrames} frames scanned · {events?.length} events · {filtered.length} shown
            </span>
          </p>
          <p className="ops-events-window">
            Latest bounded window: up to 1,000 events from 1,000 frames. This is not a complete history. Scanned heights{' '}
            {data.activity.fromHeight}–{data.activity.toHeight}.
          </p>
          <OpsHealthRuntimeProjections data={data} />
          <div className="ops-event-filters">
            <label>
              Search events
              <input value={filters.search} onChange={event => update('search', event.currentTarget.value)} />
            </label>
            {selects.map(({ key, field, label }) => (
              <label key={key}>
                {label}
                <select
                  aria-label={label}
                  value={filters[key]}
                  onChange={event => update(key, event.currentTarget.value)}
                >
                  <option value="">All</option>
                  {[
                    ...new Set(
                      (events ?? []).map(event => event[field]).filter((value): value is string => Boolean(value)),
                    ),
                  ]
                    .sort()
                    .map(value => (
                      <option key={value}>{value}</option>
                    ))}
                </select>
              </label>
            ))}
            {(
              [
                { key: 'filterRuntime', label: 'Runtime or Entity' },
                { key: 'filterFrom', label: 'From Entity' },
                { key: 'filterTo', label: 'To Entity' },
              ] as const
            ).map(({ key, label }) => (
              <label key={key}>
                {label}
                <input value={filters[key]} onChange={event => update(key, event.currentTarget.value)} />
              </label>
            ))}
            <label className="ops-critical-filter">
              <input
                type="checkbox"
                checked={filters.onlyCritical}
                onChange={event => update('onlyCritical', event.currentTarget.checked)}
              />
              Critical only
            </label>
            <button type="button" onClick={() => setFilters(emptyRuntimeEventFilters())}>
              Clear event filters
            </button>
          </div>
          <div className="ops-event-feed" data-testid="health-filtered-events">
            {filtered.length ? (
              filtered.map(event => <RuntimeEvent key={event.id} event={event} />)
            ) : (
              <p>No events match filters.</p>
            )}
          </div>
          <section aria-label="Critical event feed">
            <h3>Critical event feed · {critical.length}</h3>
            {critical.length ? (
              critical.map(event => <RuntimeEvent key={event.id} event={event} />)
            ) : (
              <p>No critical signals in the latest window.</p>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
