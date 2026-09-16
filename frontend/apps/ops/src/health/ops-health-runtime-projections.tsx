import { useMemo, useState } from 'react';
import { generateEntityAvatar } from '@xln/core/presentation/identity-display';
import { DISPLAY } from '@xln/core/config/qa';
import { buildFlowEdges, type ProjectionEntity } from '../../../../packages/ui/src/health/runtime-projections';
import type { OpsHealthEvents } from './ops-health-events-source';

function HealthEntity({ entity }: Readonly<{ entity: ProjectionEntity }>) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const copy = async () => {
    setError('');
    try {
      await navigator.clipboard.writeText(entity.entityId);
      setCopied(true);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <article className="ops-health-entity" data-testid="health-runtime-entity" data-entity-id={entity.entityId}>
      <img src={generateEntityAvatar(entity.entityId)} alt="" width={32} height={32} />
      <div>
        <strong>{entity.name}</strong>
        <code>{entity.entityId}</code>
        <span>
          {entity.online ? 'online' : 'offline'}
          {entity.isHub ? ' · hub' : ''}
        </span>
        <div className="ops-health-entity-actions">
          <button type="button" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy Entity ID'}
          </button>
          <a
            href={`/address/${encodeURIComponent(entity.entityId)}?runtimeId=${encodeURIComponent(entity.runtimeId || '')}`}
          >
            View Entity
          </a>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </article>
  );
}

export function OpsHealthRuntimeProjections({ data }: Readonly<{ data: OpsHealthEvents }>) {
  const edges = useMemo(() => buildFlowEdges(data.events).slice(0, DISPLAY.HEALTH_FLOW_EDGE_LIMIT), [data.events]);
  return (
    <>
      <section
        className="ops-health-projection-entities"
        aria-label="Runtime projection Entities"
        data-testid="health-runtime-entities"
      >
        <h3>Runtime projection Entities · {data.entities.length}</h3>
        <p>Up to 1,000 Entity summaries from this selected Runtime.</p>
        <div>
          {data.entities.length ? (
            data.entities.map(entity => <HealthEntity entity={entity} key={entity.entityId} />)
          ) : (
            <p>No registered Entities found.</p>
          )}
        </div>
      </section>
      <section className="ops-health-flow" aria-label="Event flow" data-testid="health-event-flow">
        <h3>Event flow · {edges.length} routes</h3>
        <p>Top routes in the latest Runtime activity window.</p>
        <div>
          {edges.length ? (
            edges.map(edge => (
              <article key={edge.key} data-testid="health-flow-edge" data-critical={edge.critical > 0}>
                <span>{edge.from}</span>
                <span aria-hidden="true">→</span>
                <span>{edge.to}</span>
                <strong>{edge.count} events</strong>
                {edge.critical > 0 ? <small>{edge.critical} critical</small> : null}
              </article>
            ))
          ) : (
            <p>No Runtime activity routes in this window.</p>
          )}
        </div>
      </section>
    </>
  );
}
