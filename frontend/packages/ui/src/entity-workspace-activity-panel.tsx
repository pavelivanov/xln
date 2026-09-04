import { useEffect, useState } from 'react';

import type {
  EntityWorkspaceActivity,
  EntityWorkspaceActivityFilterType,
  EntityWorkspaceActivityKind,
  EntityWorkspaceActivityMode,
  EntityWorkspaceActivityPageSize,
} from '../../runtime-client/src/entity-workspace-activity';
import {
  ENTITY_WORKSPACE_ACTIVITY_PAGE_SIZES,
  requireEntityWorkspaceActivityPageSize,
} from '../../runtime-client/src/entity-workspace-activity';
import {
  formatAddress,
  formatEntityWorkspaceLocalDateTime,
  formatEntityWorkspaceTimestamp,
  parseEntityWorkspaceLocalDateTime,
} from './entity-workspace-display';
import './entity-workspace-activity-panel.css';

type EntityWorkspaceActivityPanelProps = Readonly<{
  activity: EntityWorkspaceActivity;
  onApplyTimeframe: (fromTimestamp: number | null, toTimestamp: number | null) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onSelectBeforeHeight: (beforeHeight: number | null) => void;
  onSelectKind: (kind: EntityWorkspaceActivityKind) => void;
  onSelectMode: (mode: EntityWorkspaceActivityMode) => void;
  onSelectNewerPage: () => void;
  onSelectPageSize: (pageSize: EntityWorkspaceActivityPageSize) => void;
  onSelectSearch: (search: string) => void;
  onToggleType: (type: EntityWorkspaceActivityFilterType) => void;
}>;

const ACTIVITY_KIND_OPTIONS = [
  { kind: 'all', label: 'All' },
  { kind: 'offchain', label: 'Off-chain' },
  { kind: 'onchain', label: 'On-chain' },
] as const satisfies ReadonlyArray<Readonly<{
  kind: EntityWorkspaceActivityKind;
  label: string;
}>>;

const ACTIVITY_TYPE_OPTIONS = [
  { type: 'payment', label: 'Payments' },
  { type: 'swap', label: 'Swaps' },
  { type: 'cross_swap', label: 'Cross-j' },
  { type: 'htlc', label: 'HTLC' },
  { type: 'settlement', label: 'Settlement' },
  { type: 'account', label: 'Accounts' },
  { type: 'j_event', label: 'J-events' },
  { type: 'j_batch', label: 'Batches' },
  { type: 'error', label: 'Errors' },
] as const satisfies ReadonlyArray<Readonly<{
  type: EntityWorkspaceActivityFilterType;
  label: string;
}>>;

const directionLabel = (direction: 'in' | 'out' | 'neutral'): string =>
  direction === 'in' ? 'Inbound' : direction === 'out' ? 'Outbound' : 'Observed';

function ActivityTimestamp({ timestamp }: Readonly<{ timestamp: number }>) {
  const formatted = formatEntityWorkspaceTimestamp(timestamp);
  return (
    <time
      data-testid="entity-activity-timestamp"
      dateTime={formatted.dateTime}
      title={`Runtime timestamp ${timestamp}`}
    >{formatted.label}</time>
  );
}

export function EntityWorkspaceActivityPanel({ activity, onApplyTimeframe, onClearFilters, onRefresh, onSelectBeforeHeight, onSelectKind, onSelectMode, onSelectNewerPage, onSelectPageSize, onSelectSearch, onToggleType }: EntityWorkspaceActivityPanelProps) {
  const selectedQuery = activity.status === 'selected' ? activity.query : '';
  const selectedEntityId = activity.status === 'selected' ? activity.entityId : '';
  const [draftQuery, setDraftQuery] = useState(selectedQuery);
  const selectedFrom = activity.status === 'selected'
    ? formatEntityWorkspaceLocalDateTime(activity.fromTimestamp)
    : '';
  const selectedTo = activity.status === 'selected'
    ? formatEntityWorkspaceLocalDateTime(activity.toTimestamp)
    : '';
  const [draftFrom, setDraftFrom] = useState(selectedFrom);
  const [draftTo, setDraftTo] = useState(selectedTo);
  useEffect(() => setDraftQuery(selectedQuery), [selectedEntityId, selectedQuery]);
  useEffect(() => {
    setDraftFrom(selectedFrom);
    setDraftTo(selectedTo);
  }, [selectedEntityId, selectedFrom, selectedTo]);
  useEffect(() => {
    if (activity.status !== 'selected' || draftQuery.trim() === selectedQuery) return undefined;
    const timer = window.setTimeout(() => onSelectSearch(draftQuery), 250);
    return () => window.clearTimeout(timer);
  }, [activity.status, draftQuery, onSelectSearch, selectedQuery]);
  if (activity.status !== 'selected') return null;
  const parsedFrom = parseEntityWorkspaceLocalDateTime(draftFrom);
  const parsedTo = parseEntityWorkspaceLocalDateTime(draftTo);
  const timeframeInvalid = parsedFrom !== null && parsedTo !== null && parsedFrom > parsedTo;
  return (
    <section className="entity-workspace-activity-panel" data-testid="entity-activity-ledger">
      <header>
        <div>
          <span>Bilateral state / persisted evidence</span>
          <h2>Activity ledger</h2>
        </div>
        <div className="entity-workspace-activity-summary">
          <dl>
            <div><dt>Through</dt><dd data-testid="entity-activity-through-height">h{activity.toHeight}</dd></div>
            <div><dt>Scanned</dt><dd>{activity.scannedFrames}</dd></div>
            <div><dt>Events</dt><dd data-testid="entity-activity-event-count">{activity.events.length}</dd></div>
          </dl>
          <button data-testid="entity-activity-refresh" onClick={onRefresh} type="button">Refresh</button>
        </div>
      </header>
      <p>Exact Runtime activity at or before the displayed committed frame. Adapter order is preserved.</p>
      <nav aria-label="Activity kind" className="entity-workspace-activity-kind">
        {ACTIVITY_KIND_OPTIONS.map(({ kind, label }) => (
          <button
            aria-pressed={activity.kind === kind}
            data-testid={`entity-activity-kind-${kind}`}
            key={kind}
            onClick={() => onSelectKind(kind)}
            type="button"
          >{label}</button>
        ))}
      </nav>
      <div className="entity-workspace-activity-controls">
        <label className="entity-workspace-activity-search">
          <span>Search activity</span>
          <input
            data-testid="entity-activity-search"
            onChange={(event) => setDraftQuery(event.currentTarget.value)}
            placeholder="Title, order, or counterparty"
            type="search"
            value={draftQuery}
          />
        </label>
        <label className="entity-workspace-activity-page-size">
          <span>Rows</span>
          <select
            data-testid="entity-activity-page-size"
            onChange={(event) => onSelectPageSize(
              requireEntityWorkspaceActivityPageSize(Number(event.currentTarget.value)),
            )}
            value={activity.pageSize}
          >
            {ENTITY_WORKSPACE_ACTIVITY_PAGE_SIZES.map((pageSize) => (
              <option key={pageSize} value={pageSize}>{pageSize}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="entity-workspace-activity-mode-row">
        <nav aria-label="Activity mode" className="entity-workspace-activity-mode">
          <button
            aria-pressed={activity.mode === 'paged'}
            data-testid="entity-activity-mode-paged"
            onClick={() => onSelectMode('paged')}
            type="button"
          >Pagination</button>
          <button
            aria-pressed={activity.mode === 'timeframe'}
            data-testid="entity-activity-mode-timeframe"
            onClick={() => onSelectMode('timeframe')}
            type="button"
          >Timeframe</button>
        </nav>
        {activity.mode === 'timeframe'
          ? <div className="entity-workspace-activity-timeframe">
              <label>
                <span>From · local time</span>
                <input
                  data-testid="entity-activity-from"
                  onChange={(event) => setDraftFrom(event.currentTarget.value)}
                  step="60"
                  type="datetime-local"
                  value={draftFrom}
                />
              </label>
              <label>
                <span>To · local time</span>
                <input
                  data-testid="entity-activity-to"
                  onChange={(event) => setDraftTo(event.currentTarget.value)}
                  step="60"
                  type="datetime-local"
                  value={draftTo}
                />
              </label>
              <button
                data-testid="entity-activity-apply-timeframe"
                disabled={timeframeInvalid}
                onClick={() => onApplyTimeframe(parsedFrom, parsedTo)}
                type="button"
              >Apply timeframe</button>
              {timeframeInvalid
                ? <small role="alert">From must not be later than To.</small>
                : null}
            </div>
          : null}
      </div>
      <nav aria-label="Activity event types" className="entity-workspace-activity-types">
        {ACTIVITY_TYPE_OPTIONS.map(({ type, label }) => (
          <button
            aria-pressed={activity.types.includes(type)}
            data-testid={`entity-activity-type-${type}`}
            key={type}
            onClick={() => onToggleType(type)}
            type="button"
          >{label}</button>
        ))}
        {activity.query.length > 0 || activity.types.length > 0
          || activity.fromTimestamp !== null || activity.toTimestamp !== null
          ? <button
              className="entity-workspace-activity-clear"
              data-testid="entity-activity-clear-filters"
              onClick={onClearFilters}
              type="button"
            >Clear filters</button>
          : null}
      </nav>
      {activity.events.length === 0
        ? <div className="entity-workspace-activity-empty">No persisted activity in frames {activity.fromHeight}–{activity.toHeight}.</div>
        : <ol>
            {activity.events.map((event, index) => (
              <li data-direction={event.direction} data-kind={event.kind} data-type={event.type} key={event.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div className="entity-workspace-activity-copy">
                  <strong>{event.title}</strong>
                  <p>{event.subtitle}</p>
                  <small>
                    {event.counterpartyId ? `Peer ${formatAddress(event.counterpartyId)} · ` : ''}
                    {event.source.replace('_', ' ')}
                  </small>
                </div>
                <div className="entity-workspace-activity-facts">
                  <b>{directionLabel(event.direction)}</b>
                  <span>h{event.height} / <ActivityTimestamp timestamp={event.timestamp} /></span>
                  <em>{event.kind} · {event.type} · {event.status}</em>
                </div>
              </li>
            ))}
          </ol>}
      <footer>
        <div className="entity-workspace-activity-newer">
          <button
            data-testid="entity-activity-latest"
            disabled={activity.isLatestPage}
            onClick={() => onSelectBeforeHeight(null)}
            type="button"
          >Latest</button>
          <button
            data-testid="entity-activity-newer"
            disabled={activity.isLatestPage}
            onClick={onSelectNewerPage}
            type="button"
          >Newer</button>
        </div>
        <strong>h{activity.fromHeight}–h{activity.toHeight}</strong>
        <button
          data-testid="entity-activity-earlier"
          disabled={activity.nextBeforeHeight === null}
          onClick={() => onSelectBeforeHeight(activity.nextBeforeHeight)}
          type="button"
        >{activity.nextBeforeHeight === null ? 'Origin reached' : `Earlier at h${activity.nextBeforeHeight}`}</button>
      </footer>
    </section>
  );
}
