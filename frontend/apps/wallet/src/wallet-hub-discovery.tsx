import { useEffect, useState, useSyncExternalStore } from 'react';
import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import type { HubDiscoveryHub } from '../../../src/lib/components/Entity/onboarding/hub-discovery-profile';
import { WalletHubDiscoverySource, type WalletHubDetails } from './wallet-hub-discovery-source';
import { WalletDirectAccountOpen } from './wallet-account-open';
import './styles/wallet-hub-discovery.css';

function HubDetails({ hub, source }: Readonly<{ hub: HubDiscoveryHub; source: WalletHubDiscoverySource }>) {
  const [result, setResult] = useState<Readonly<{ loading: boolean; data: WalletHubDetails | null; error: string }>>({ loading: true, data: null, error: '' });
  useEffect(() => {
    let current = true;
    setResult({ loading: true, data: null, error: '' });
    void source.readDetails(hub.entityId).then(data => {
      if (current) setResult({ loading: false, data, error: '' });
    }, cause => {
      if (current) setResult({ loading: false, data: null, error: cause instanceof Error ? cause.message : String(cause) });
    });
    return () => { current = false; };
  }, [hub, source]);
  if (result.loading) return <p role="status">Loading Hub details…</p>;
  if (result.error) return <p role="alert">Hub details could not be read: {result.error}. Refresh hubs to retry.</p>;
  const data = result.data;
  const details = [
    ['Fee', data?.fee === null || !data ? 'Unavailable' : `${(data.fee / 100).toFixed(2)} bps`], ['Peers', data?.peerCount ?? 'Unavailable'],
    ['Entity ID', hub.entityId], ['Runtime ID', hub.runtimeId || '—'],
    ['Description', data?.description || '—'], ['Website', data?.website || '—'],
    ['Direct WS', hub.wsUrl || '—'], ['Last updated', data ? new Date(data.timestamp).toLocaleString() : 'Unavailable'],
  ];
  return <div className="wallet-hub-details"><dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {data ? <details><summary>Raw Profile</summary><pre>{data.raw}</pre></details> : <p>This Runtime advertises the Hub but does not provide its full details.</p>}
  </div>;
}

export function WalletHubDiscovery({ adapter, entityId, onBack, onOpenDisputed }: Readonly<{ adapter: RuntimeAdapter; entityId: string; onBack: () => void; onOpenDisputed: (id: string) => void }>) {
  const [source] = useState(() => new WalletHubDiscoverySource(adapter, entityId));
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const [expanded, setExpanded] = useState('');
  useEffect(() => { source.start(); return source.stop; }, [source]);
  return <section className="wallet-hub-discovery" data-testid="hub-discovery-panel">
    <button type="button" onClick={onBack}>← Back to assets</button>
    <header><p>Counterparties</p><h2>Open Account</h2><p>Discover hubs in the selected Entity’s jurisdiction.</p></header>
    <button type="button" disabled={snapshot.loading} onClick={() => void source.refresh()}>{snapshot.loading ? 'Refreshing…' : 'Refresh hubs'}</button>
    {snapshot.error && (snapshot.messageKind === 'hub' || !snapshot.canOpenAccounts) ? <p className="wallet-hub-error" role="alert">{snapshot.error}</p> : null}
    {snapshot.permissionError ? <p role="status">{snapshot.permissionError}</p> : null}
    {!snapshot.loading && snapshot.hubs.length === 0 ? <p>No counterparties found</p> : null}
    <div className="wallet-hub-list">{snapshot.hubs.map(hub => {
      const opening = hub.isOpening || snapshot.connectingHubId === hub.entityId;
      const retry = snapshot.retryKind === 'hub' && snapshot.retryHubId === hub.entityId;
      return <article key={hub.entityId} data-testid="hub-discovery-card" data-hub-entity-id={hub.entityId} data-connection-state={hub.isConnected ? 'open' : opening ? 'opening' : 'closed'}>
        <div className="wallet-hub-heading">
          <button className="wallet-hub-name" type="button" aria-expanded={expanded === hub.entityId} onClick={() => setExpanded(expanded === hub.entityId ? '' : hub.entityId)}>
            {hub.avatar ? <img src={hub.avatar} alt="" /> : null}<strong>{hub.name}</strong>
          </button>
          <div className="wallet-hub-actions">
            {hub.isConnected && !retry ? <span>✓ Open</span> : opening ? <span role="status">Opening…</span> : snapshot.canOpenAccounts ? <button type="button" className="wallet-hub-connect" data-testid="hub-connect-button"
              disabled={Boolean(snapshot.connectingHubId) || Boolean(snapshot.retryHubId && !retry)} onClick={() => void source.connect(hub.entityId)}>{retry ? 'Retry request' : '+ Connect'}</button> : null}
            <button type="button" aria-expanded={expanded === hub.entityId} onClick={() => setExpanded(expanded === hub.entityId ? '' : hub.entityId)}>{expanded === hub.entityId ? 'Hide' : 'Details'}</button>
          </div>
        </div>
        {expanded === hub.entityId ? <HubDetails hub={hub} source={source} /> : null}
      </article>;
    })}</div>
    <WalletDirectAccountOpen source={source} snapshot={snapshot} />
    {snapshot.disputed.length ? <section className="wallet-disputed-accounts" aria-label="Disputed Accounts">
      <h2>Disputed Accounts</h2><p>Hidden from the main list. Finalized disputes permanently close the account.</p>
      {snapshot.disputed.map(item => <article key={item.counterpartyId}><div><code>{item.counterpartyId}</code>
        <p>{item.status === 'active' ? 'Active dispute in progress' : 'Permanently closed after finalized dispute'}</p></div>
        {item.status === 'active' ? <button type="button" onClick={() => onOpenDisputed(item.counterpartyId)}>Open</button> : null}
      </article>)}
    </section> : null}
  </section>;
}
