import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  readRuntimeAdapterStorageSnapshot,
  writeRemoteRuntimeAdapterSession,
} from '../../../packages/browser/src/runtime-adapter-session';
import { readStoredRemoteRuntimeImports } from '../../../packages/browser/src/remote-runtime-import';
import {
  filterWalletAddressDirectory,
  type WalletAddressDetail,
  type WalletAddressEntity,
} from './wallet-address-model';
import {
  WalletAddressSource,
  type WalletAddressDetailProjection,
  type WalletAddressRequest,
} from './wallet-address-source';
import { resolveWalletAddressRuntimeAffinity } from './wallet-address-runtime-affinity';
import type { WalletHistoryEvent } from './wallet-financial-health-model';
import './styles/wallet-address.css';

const shortId = (value: string): string =>
  value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;

const runtimeRequest = (runtimeId: string): string =>
  runtimeId ? `?runtimeId=${encodeURIComponent(runtimeId)}` : '';

function Identity({ entity, size = 'small' }: Readonly<{
  entity: WalletAddressEntity;
  size?: 'small' | 'large';
}>) {
  const label = entity.name || entity.entityId;
  return (
    <div className={`wallet-address-identity is-${size}`}>
      <span aria-hidden="true">{label.slice(0, 2).toUpperCase()}</span>
      <div>
        <strong>{label}</strong>
        <code className="address" title={entity.entityId}>{shortId(entity.entityId)}</code>
      </div>
    </div>
  );
}

function Status({ source, error }: Readonly<{ source: WalletAddressSource; error: string }>) {
  return (
    <section className="wallet-address-state" role={error ? 'alert' : 'status'}>
      <p>{error ? 'Runtime projection unavailable' : 'Runtime projection'}</p>
      <h1>{error ? 'No address data is being shown.' : 'Connecting to your Runtime…'}</h1>
      <span>{error || 'The directory opens after the selected Runtime is ready.'}</span>
      {error ? (
        <div>
          <button onClick={() => void source.refresh()} type="button">Retry Runtime read</button>
          <a href="/address">Directory</a>
          <a href="/app">Wallet</a>
        </div>
      ) : null}
    </section>
  );
}

function AddressRow({ entity }: Readonly<{ entity: WalletAddressEntity }>) {
  return (
    <a
      className="wallet-address-row row"
      href={`/address/${encodeURIComponent(entity.entityId)}${runtimeRequest(entity.runtimeId)}`}
    >
      <Identity entity={entity} />
      <div className="wallet-address-tags">
        <span className={entity.online ? 'is-online' : 'is-offline'}>{entity.online ? 'online' : 'offline'}</span>
        {entity.isHub ? <span className="is-hub">hub</span> : null}
        {entity.jurisdictionName ? <span>{entity.jurisdictionName}</span> : null}
        <span>h{entity.lastUpdated}</span>
      </div>
    </a>
  );
}

function Directory({ source }: Readonly<{ source: WalletAddressSource }>) {
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const [search, setSearch] = useState('');
  const projection = snapshot.projection?.kind === 'directory' ? snapshot.projection : null;
  const visible = filterWalletAddressDirectory(projection?.entities ?? [], search);
  if (!projection) return <Status source={source} error={snapshot.status === 'error' ? snapshot.message : ''} />;
  return (
    <main className="wallet-address-page" data-testid="wallet-address-directory">
      <header className="wallet-address-header">
        <div><p>Selected Runtime · H{projection.height}</p><h1>Address directory</h1><span>Registered gossip profiles. Hubs first, then users.</span></div>
        <nav aria-label="Address directory actions">
          <a href="/app">Wallet</a>
          <button disabled={snapshot.status === 'loading'} onClick={() => void source.refresh()} type="button">
            {snapshot.status === 'loading' ? 'Refreshing…' : 'Refresh'}
          </button>
        </nav>
      </header>
      <section className="wallet-address-search">
        <label htmlFor="wallet-address-search">Find an Entity</label>
        <input
          id="wallet-address-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, entity, runtime, capability"
          type="search"
          value={search}
        />
        <span>{visible.length} of {projection.entities.length} profiles</span>
      </section>
      <section className="wallet-address-list" aria-label="Runtime address directory">
        {visible.length ? visible.map((entity) => <AddressRow entity={entity} key={entity.entityId} />) : (
          <p className="wallet-address-empty">{projection.entities.length ? 'No profiles match this search.' : 'No profiles found.'}</p>
        )}
      </section>
    </main>
  );
}

const fact = (label: string, value: string | number) => (
  <div><dt>{label}</dt><dd>{value === '' ? 'Not published' : value}</dd></div>
);

function Overview({ entity }: Readonly<{ entity: WalletAddressDetail }>) {
  return (
    <section className="wallet-address-overview" data-testid="wallet-address-overview">
      <div><p>Profile</p><h2>Public Runtime metadata</h2><span>Committed Entity facts from the selected Runtime projection.</span></div>
      <dl>
        {fact('Bio', entity.profile.bio)}
        {fact('Website', entity.profile.website)}
        {fact('Jurisdiction', entity.jurisdiction.name)}
        {fact('Chain', entity.jurisdiction.chainId)}
        {fact('Accounts', `${entity.accounts.shown} shown · ${entity.accounts.total} total`)}
        {fact('Books', `${entity.books.shown} shown · ${entity.books.total} total`)}
        {fact('Depository', entity.jurisdiction.depositoryAddress)}
        {fact('Entity provider', entity.jurisdiction.entityProviderAddress)}
      </dl>
    </section>
  );
}

const historyTime = (event: WalletHistoryEvent): string => event.timestamp > 0
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(event.timestamp)
  : `Height ${event.height}`;

function HistoryEvent({ event }: Readonly<{ event: WalletHistoryEvent }>) {
  return (
    <article className="wallet-address-event">
      <div><span>{event.kind}</span><strong>{event.title}</strong><p>{event.subtitle}</p></div>
      <dl>
        <div><dt>Status</dt><dd>{event.status}</dd></div>
        <div><dt>Direction</dt><dd>{event.direction}</dd></div>
        <div><dt>Amount</dt><dd>{event.amountLabel ?? '—'}</dd></div>
        <div><dt>Committed</dt><dd>{historyTime(event)}</dd></div>
      </dl>
    </article>
  );
}

function History({ projection }: Readonly<{ projection: WalletAddressDetailProjection }>) {
  if (projection.historyRuntimeMismatch) return (
    <section className="wallet-address-notice" data-testid="entity-history-runtime-mismatch" role="status">
      Select Runtime {shortId(projection.historyRuntimeMismatch)} to inspect this Entity history.
    </section>
  );
  if (projection.historyError) return (
    <section className="wallet-address-notice is-error" role="alert">
      Activity history is unavailable: {projection.historyError}
    </section>
  );
  return (
    <section className="wallet-address-history" data-testid="wallet-address-history">
      <header><div><p>Certified activity</p><h2>Committed history</h2></div><span>{projection.history.length} events</span></header>
      {projection.history.length
        ? projection.history.map((event) => <HistoryEvent event={event} key={event.id} />)
        : <p className="wallet-address-empty">No committed activity for this Entity.</p>}
      {projection.historyNextBeforeHeight === null ? null : (
        <a href="/app?health=1">Older activity is available in Financial health →</a>
      )}
    </section>
  );
}

function Detail({ source }: Readonly<{ source: WalletAddressSource }>) {
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const [tab, setTab] = useState<'overview' | 'history'>('history');
  const projection = snapshot.projection?.kind === 'detail' ? snapshot.projection : null;
  if (!projection) return <Status source={source} error={snapshot.status === 'error' ? snapshot.message : ''} />;
  const { entity } = projection;
  return (
    <main className="wallet-address-page" data-testid="wallet-address-detail">
      <header className="wallet-address-header">
        <div><p>Entity explorer · H{entity.lastUpdated}</p><h1>Public Entity record</h1><span>Profile, capability, and certified-history evidence.</span></div>
        <nav aria-label="Entity explorer actions"><a href="/address">Directory</a><a href="/health">Health</a></nav>
      </header>
      <section className="wallet-address-identity-band identity-band">
        <Identity entity={entity} size="large" />
        <div className="wallet-address-tags">
          <span className={entity.online ? 'is-online' : 'is-offline'}>{entity.online ? 'online' : 'offline'}</span>
          {entity.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
          <span>runtime {shortId(entity.runtimeId)}</span>
        </div>
      </section>
      {projection.projectionNotice ? <p className="wallet-address-notice" role="status">Detailed projection unavailable: {projection.projectionNotice}</p> : null}
      <section className="wallet-address-panel">
        <div className="wallet-address-tabs" aria-label="Entity page sections">
          <button aria-pressed={tab === 'overview'} onClick={() => setTab('overview')} type="button">Overview</button>
          <button aria-pressed={tab === 'history'} data-testid="entity-history-tab" onClick={() => setTab('history')} type="button">History</button>
        </div>
        {tab === 'overview' ? <Overview entity={entity} /> : <History projection={projection} />}
      </section>
    </main>
  );
}

export function WalletAddressPage({ request }: Readonly<{ request: WalletAddressRequest }>) {
  const [source] = useState(() => {
    const stores = { durable: localStorage, session: sessionStorage };
    const config = readRuntimeAdapterStorageSnapshot(stores);
    const requestedRuntimeId = request.kind === 'detail' ? request.requestedRuntimeId : '';
    const affinity = resolveWalletAddressRuntimeAffinity(
      config,
      requestedRuntimeId,
      readStoredRemoteRuntimeImports({ dropExpired: true, dropInvalid: true }),
    );
    const selected = affinity.selectedImport;
    const commitRuntimeSelection = selected === null ? null : () => {
      writeRemoteRuntimeAdapterSession(stores, {
        wsUrl: selected.wsUrl,
        access: selected.access,
        authKey: selected.token,
      });
    };
    return new WalletAddressSource(affinity.config, request, commitRuntimeSelection);
  });
  useEffect(() => {
    void source.start();
    return source.stop;
  }, [source]);
  return request.kind === 'directory' ? <Directory source={source} /> : <Detail source={source} />;
}
