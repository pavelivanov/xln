import type {
  EntityWorkspaceActivity,
  EntityWorkspaceActivityKind,
} from '../../runtime-client/src/entity-workspace-activity';
import { formatAddress } from './entity-workspace-display';
import './entity-workspace-activity-panel.css';

type EntityWorkspaceActivityPanelProps = Readonly<{
  activity: EntityWorkspaceActivity;
  onSelectBeforeHeight: (beforeHeight: number | null) => void;
  onSelectKind: (kind: EntityWorkspaceActivityKind) => void;
}>;

const ACTIVITY_KIND_OPTIONS = [
  { kind: 'all', label: 'All' },
  { kind: 'offchain', label: 'Off-chain' },
  { kind: 'onchain', label: 'On-chain' },
] as const satisfies ReadonlyArray<Readonly<{
  kind: EntityWorkspaceActivityKind;
  label: string;
}>>;

const directionLabel = (direction: 'in' | 'out' | 'neutral'): string =>
  direction === 'in' ? 'Inbound' : direction === 'out' ? 'Outbound' : 'Observed';

export function EntityWorkspaceActivityPanel({ activity, onSelectBeforeHeight, onSelectKind }: EntityWorkspaceActivityPanelProps) {
  if (activity.status !== 'selected') return null;
  return (
    <section className="entity-workspace-activity-panel" data-testid="entity-activity-ledger">
      <header>
        <div>
          <span>Bilateral state / persisted evidence</span>
          <h2>Activity ledger</h2>
        </div>
        <dl>
          <div><dt>Through</dt><dd data-testid="entity-activity-through-height">h{activity.toHeight}</dd></div>
          <div><dt>Scanned</dt><dd>{activity.scannedFrames}</dd></div>
          <div><dt>Events</dt><dd data-testid="entity-activity-event-count">{activity.events.length}</dd></div>
        </dl>
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
      {activity.events.length === 0
        ? <div className="entity-workspace-activity-empty">No persisted activity in frames {activity.fromHeight}–{activity.toHeight}.</div>
        : <ol>
            {activity.events.map((event, index) => (
              <li data-direction={event.direction} data-kind={event.kind} key={event.id}>
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
                  <code>h{event.height} / t{event.timestamp}</code>
                  <em>{event.kind} · {event.type} · {event.status}</em>
                </div>
              </li>
            ))}
          </ol>}
      <footer>
        <button
          data-testid="entity-activity-latest"
          disabled={activity.isLatestPage}
          onClick={() => onSelectBeforeHeight(null)}
          type="button"
        >Latest</button>
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
