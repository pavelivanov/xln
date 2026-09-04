import type { EntityWorkspaceActivityEvent } from '../../runtime-client/src/entity-workspace-activity';
import { formatAddress, formatEntityWorkspaceTimestamp } from './entity-workspace-display';

type ActivityAmountEvidence = Readonly<{
  amount: string;
  label: 'Amount' | 'Quote';
  tokenId: number | null;
}>;

const directionLabel = (direction: 'in' | 'out' | 'neutral'): string =>
  direction === 'in' ? 'Inbound' : direction === 'out' ? 'Outbound' : 'Observed';

const activityAmountEvidence = (event: EntityWorkspaceActivityEvent): ActivityAmountEvidence | null =>
  event.amount !== null
    ? { amount: event.amount, label: 'Amount', tokenId: event.tokenId }
    : event.quoteAmount !== null
      ? { amount: event.quoteAmount, label: 'Quote', tokenId: event.quoteTokenId }
      : null;

function ActivityTimestamp({ timestamp }: Readonly<{ timestamp: number }>) {
  const formatted = formatEntityWorkspaceTimestamp(timestamp);
  return (
    <time data-testid="entity-activity-timestamp" dateTime={formatted.dateTime} title={`Runtime timestamp ${timestamp}`}>
      {formatted.label}
    </time>
  );
}

export function EntityWorkspaceActivityRow({ event, index }: Readonly<{
  event: EntityWorkspaceActivityEvent;
  index: number;
}>) {
  const amountEvidence = activityAmountEvidence(event);
  return (
    <li data-direction={event.direction} data-event-id={event.id} data-kind={event.kind} data-type={event.type}>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <div className="entity-workspace-activity-copy">
        <strong>{event.title}</strong>
        <p>{event.subtitle}</p>
        <small>
          {event.counterpartyId ? `Peer ${formatAddress(event.counterpartyId)} · ` : ''}
          {event.source.replace('_', ' ')}
          {event.orderId
            ? <span data-testid="entity-activity-order" title={event.orderId}> · Order {formatAddress(event.orderId)}</span>
            : null}
          {event.hash
            ? <span data-testid="entity-activity-hash" title={event.hash}> · Hash {formatAddress(event.hash)}</span>
            : null}
        </small>
      </div>
      <div className="entity-workspace-activity-facts">
        <b>{directionLabel(event.direction)}</b>
        {amountEvidence
          ? <span className="entity-workspace-activity-amount" data-testid="entity-activity-amount">
              <strong>{amountEvidence.amount}</strong>
              <small>{amountEvidence.label} raw · token #{amountEvidence.tokenId ?? '?'}</small>
            </span>
          : null}
        <span>h{event.height} / <ActivityTimestamp timestamp={event.timestamp} /></span>
        <em>{event.kind} · {event.type} · {event.status}</em>
      </div>
    </li>
  );
}
