import { useState } from 'react';
import type { HealthDetail, HealthRow, HealthTopology } from './health-topology-model';
import './ops-health-topology.css';

function Details({ items }: Readonly<{ items: readonly HealthDetail[] }>) {
  return (
    <dl className="ops-health-detail-list">
      {items.map(item => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            <pre>{item.value}</pre>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EvidenceRow({ row }: Readonly<{ row: HealthRow }>) {
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setError('');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <article className="ops-health-topology-row" data-state={row.state}>
      <header>
        <strong>{row.label}</strong>
        <span>{row.state}</span>
      </header>
      {row.entityId ? (
        <div className="ops-health-topology-identity">
          <code>{row.entityId}</code>
          <button type="button" onClick={() => void copy(row.entityId!)}>
            {copied === row.entityId ? 'Copied' : 'Copy Entity ID'}
          </button>
          <a
            href={`/address/${encodeURIComponent(row.entityId)}${row.runtimeId ? `?runtimeId=${encodeURIComponent(row.runtimeId)}` : ''}`}
          >
            View Entity
          </a>
        </div>
      ) : null}
      {row.runtimeId ? (
        <div className="ops-health-topology-identity">
          <code>{row.runtimeId}</code>
          <button type="button" onClick={() => void copy(row.runtimeId!)}>
            {copied === row.runtimeId ? 'Copied' : 'Copy Runtime ID'}
          </button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {row.details.length ? (
        <details>
          <summary>Evidence</summary>
          <Details items={row.details} />
        </details>
      ) : (
        <p>No detail reported.</p>
      )}
    </article>
  );
}

export function OpsHealthTopology({ topology }: Readonly<{ topology: HealthTopology }>) {
  return (
    <div className="ops-health-topology" data-testid="health-topology">
      <nav aria-label="Health tools">
        <a href="/qa">Open QA cockpit</a>
        <a href="/qa/hlt">HLT dashboard</a>
        <a href="/qa">UX gallery</a>
        <a href="/embed">Runtime connections and workspace</a>
      </nav>
      <section className="ops-panel" aria-label="Bootstrap live status">
        <h2>Bootstrap live status</h2>
        <p>Readiness reported by the health endpoint. Expand evidence for timings, targets and failures.</p>
        <div className="ops-health-gates">
          {topology.gates.map(row => (
            <EvidenceRow row={row} key={row.key} />
          ))}
        </div>
      </section>
      <section className="ops-panel" aria-label="Bootstrap timeline" data-testid="bootstrap-timeline">
        <h2>Bootstrap timeline</h2>
        {topology.timelineDetails.length ? <Details items={topology.timelineDetails} /> : null}
        {topology.timeline === null ? (
          <p>Bootstrap timeline not reported by this endpoint.</p>
        ) : topology.timeline.length ? (
          <div className="ops-health-gates">
            {topology.timeline.map(row => (
              <EvidenceRow key={row.key} row={row} />
            ))}
          </div>
        ) : (
          <p>No bootstrap stages reported.</p>
        )}
      </section>
      {topology.sections.map(section => (
        <section className="ops-panel" aria-label={section.label} key={section.label}>
          <h2>{section.label}</h2>
          {section.rows === null ? (
            <p>Details not reported by this endpoint. Public health responses may redact them.</p>
          ) : section.rows.length ? (
            <div className="ops-health-gates">
              {section.rows.map(row => (
                <EvidenceRow key={row.key} row={row} />
              ))}
            </div>
          ) : (
            <p>No entries reported.</p>
          )}
        </section>
      ))}
    </div>
  );
}
