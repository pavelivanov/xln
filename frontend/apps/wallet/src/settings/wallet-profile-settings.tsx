import { useEffect, useState, useSyncExternalStore } from 'react';

import { createEntityWorkspaceLiveState } from '../../../../packages/runtime-client/src/entity/entity-workspace-time-machine';
import { EntityWorkspaceProfilePanel } from '../../../../packages/ui/src/entity/profile/entity-workspace-profile-panel';
import { readRuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import { navigateWallet } from '../navigation/wallet-navigation';
import type { WalletWorkspaceSelection } from '../runtime/wallet-workspace-selection';
import { WalletProfileSource } from './wallet-profile-source';

export function WalletProfileSettings({ entityId, selection }: Readonly<{
  entityId: string;
  selection: WalletWorkspaceSelection;
}>) {
  const [source] = useState(() => new WalletProfileSource(
    readRuntimeAdapterStorageSnapshot({ durable: localStorage, session: sessionStorage }),
    selection,
    entityId,
  ));
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const selected = useSyncExternalStore(selection.subscribe, selection.getSnapshot, selection.getSnapshot);

  useEffect(() => { void source.start(); return source.stop; }, [source]);

  useEffect(() => {
    if (!entityId || snapshot.busy || snapshot.status !== 'ready') return;
    if (snapshot.projection?.context.entityId !== entityId) source.selectEntity(entityId);
  }, [entityId, snapshot.busy, snapshot.projection?.context.entityId, snapshot.status, source]);

  const projection = snapshot.projection;
  if (!projection || projection.context.status !== 'selected' || projection.profile.status !== 'selected') {
    return <p className="wallet-settings-profile-state" role={snapshot.status === 'error' ? 'alert' : 'status'}>{snapshot.message}</p>;
  }
  if (selected.entityId && selected.entityId !== projection.context.entityId) {
    return <p className="wallet-settings-profile-state" role="status">Loading the selected identity…</p>;
  }

  return (
    <div className="wallet-settings-profile" data-testid="wallet-profile-settings">
      <div className="wallet-settings-profile-context">
        <label>
          <span>Selected identity</span>
          <select
            aria-label="Selected identity"
            disabled={snapshot.busy}
            onChange={event => {
              const nextEntityId = event.currentTarget.value;
              source.selectEntity(nextEntityId);
              navigateWallet(`/app#settings?entity=${encodeURIComponent(nextEntityId)}`);
            }}
            value={projection.context.entityId}
          >
            {projection.entities.map(entity => (
              <option key={entity.entityId} value={entity.entityId}>{entity.label}</option>
            ))}
          </select>
        </label>
        <span>Committed height {projection.context.height}</span>
        <button onClick={() => { void source.refresh(); }} type="button">Refresh</button>
      </div>
      <EntityWorkspaceProfilePanel
        context={projection.context}
        hubPolicy={projection.hubPolicy}
        onSaveProfile={source.saveProfile}
        profile={projection.profile}
        reserves={projection.reserves}
        timeMachine={createEntityWorkspaceLiveState(projection.context.height)}
      />
    </div>
  );
}
