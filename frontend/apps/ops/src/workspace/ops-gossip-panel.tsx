import { useEffect, useState } from 'react';
import { generateEntityAvatar } from '@xln/core/presentation/identity-display';

import {
  filterGossipDirectoryProfiles,
  getGossipDirectoryDisplayName,
  type GossipDirectoryProfile,
} from '../../../../packages/runtime-client/src/gossip-panel-view';
import { readOpsGossipDirectory } from './ops-workspace-query';
import { useWorkspaceQuery } from './use-workspace-query';
import { WorkspaceReadBoundary } from './workspace-read-boundary';

function GossipProfile({ profile }: Readonly<{ profile: GossipDirectoryProfile }>) {
  const [copied, setCopied] = useState(false);
  const [issue, setIssue] = useState('');
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = async (): Promise<void> => {
    setIssue('');
    try { await navigator.clipboard.writeText(profile.entityId); setCopied(true); }
    catch (error: unknown) { setIssue(error instanceof Error ? error.message : String(error)); }
  };
  return (
    <article className={`workspace-gossip-profile${profile.isHub ? ' is-hub' : ''}`}>
      <img alt="" height={34} src={generateEntityAvatar(profile.entityId)} width={34} />
      <div className="workspace-gossip-identity">
        <strong>{getGossipDirectoryDisplayName(profile)}</strong>
        <code title={profile.entityId}>{profile.entityId}</code>
        <div className="workspace-gossip-links">
          <button aria-label={`Copy address for ${profile.name || profile.entityId}`} onClick={() => { void copy(); }} type="button">{copied ? 'Copied' : 'Copy'}</button>
          <a href={`/address/${encodeURIComponent(profile.entityId)}`}>Address →</a>
        </div>
        {issue ? <span className="is-error" role="alert">{issue}</span> : null}
      </div>
      <div className="workspace-gossip-meta">
        {profile.isHub ? <span>hub</span> : null}
        {profile.jurisdictionName ? <span>{profile.jurisdictionName}</span> : null}
        {profile.height ? <span>h{profile.height}</span> : null}
        {profile.runtimeId ? <span title={profile.runtimeId}>{profile.runtimeId.slice(0, 18)}</span> : null}
      </div>
    </article>
  );
}

export function OpsGossipPanel() {
  const [search, setSearch] = useState('');
  const { snapshot, connection, connected } = useWorkspaceQuery(readOpsGossipDirectory);
  const data = snapshot.data;
  const profiles = data ? filterGossipDirectoryProfiles(data.directory.profiles, search) : [];
  return (
    <section className="workspace-read-panel" data-testid="runtime-gossip-panel">
      <header>
        <div><h2>Gossip Directory</h2><p>{data ? `${data.directory.profileCount} profiles · ${data.directory.hubCount} ${data.directory.hubCount === 1 ? 'hub' : 'hubs'}` : 'Runtime profiles'}</p></div>
        {data ? <span className="workspace-live-label" title={data.runtimeId}>Live Runtime · h{data.height}</span> : null}
      </header>
      <label className="workspace-search">
        <span>Search gossip directory</span>
        <input aria-label="Search gossip directory" onChange={event => setSearch(event.currentTarget.value)} placeholder="Name, entity, runtime, jurisdiction" type="search" value={search} />
      </label>
      <WorkspaceReadBoundary connected={connected} connection={connection} error={snapshot.error} loading={snapshot.loading && data === null}>
        {profiles.length ? (
          <div className="workspace-gossip-profiles" data-testid="runtime-gossip-profiles">
            {profiles.map(profile => <GossipProfile key={profile.entityId} profile={profile} />)}
          </div>
        ) : <p className="workspace-read-state" data-testid="runtime-gossip-empty">No profiles in this runtime projection.</p>}
      </WorkspaceReadBoundary>
    </section>
  );
}
