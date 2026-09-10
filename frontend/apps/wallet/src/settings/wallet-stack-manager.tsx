import { useEffect, useState, useSyncExternalStore } from 'react';

import { readRuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import { runtimeHttpOriginFromWsUrl } from '../../../../packages/runtime-client/src/runtime/ws-url';
import { StackManager } from '../../../../packages/ui/src/stack-manager/stack-manager';
import { navigateWallet } from '../navigation/wallet-navigation';
import type { WalletWorkspaceSelection } from '../runtime/wallet-workspace-selection';
import { WalletProfileSource } from './wallet-profile-source';
import './wallet-stack-manager.css';

const readSession = () => readRuntimeAdapterStorageSnapshot({ durable: localStorage, session: sessionStorage });

export function WalletStackManager({
  entityId,
  selection,
}: Readonly<{
  entityId: string;
  selection: WalletWorkspaceSelection;
}>) {
  const [config] = useState(readSession);
  const origin = config.mode === 'remote' && config.wsUrl ? runtimeHttpOriginFromWsUrl(config.wsUrl) : '';
  const capability = config.mode === 'remote' && config.access === 'admin' ? (config.sessionKey ?? '') : '';
  const unavailable = !origin
    ? 'Stack Manager requires a daemon Runtime. In-browser Runtimes cannot inspect daemon deployment state.'
    : !capability
      ? 'STACK_MANAGER_ADMIN_CAPABILITY_REQUIRED'
      : '';
  const [source] = useState(() => new WalletProfileSource(config, selection, entityId));
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  useEffect(() => {
    if (!unavailable) void source.start();
    return source.stop;
  }, [source, unavailable]);
  useEffect(() => {
    if (entityId && snapshot.status === 'ready' && snapshot.projection?.context.entityId !== entityId) {
      source.selectEntity(entityId);
    }
  }, [entityId, snapshot.status, snapshot.projection?.context.entityId, source]);
  if (unavailable)
    return (
      <div className="wallet-stack-manager">
        <StackManager origin={origin} capability={capability} restriction={unavailable} isCurrent={() => false} />
      </div>
    );
  const projection = snapshot.projection;
  if (!projection || projection.context.status !== 'selected') {
    return <p role={snapshot.status === 'error' ? 'alert' : 'status'}>{snapshot.message}</p>;
  }
  const context = projection.context;
  const restriction = entityId && entityId !== context.entityId ? 'Loading the selected identity…' : '';
  const isCurrent = (): boolean => {
    const current = source.getSnapshot();
    const active = current.projection?.context;
    const session = readSession();
    const selected = selection.getSnapshot();
    return (
      current.status !== 'error' &&
      active?.status === 'selected' &&
      active.runtimeId === context.runtimeId &&
      active.entityId === context.entityId &&
      selected.runtimeId === context.runtimeId &&
      selected.entityId === context.entityId &&
      session.mode === config.mode &&
      session.wsUrl === config.wsUrl &&
      session.access === config.access &&
      session.sessionKey === config.sessionKey
    );
  };
  return (
    <div
      className="wallet-stack-manager"
      data-testid="wallet-stack-manager"
      data-runtime-id={context.runtimeId}
      data-entity-id={context.entityId}
    >
      <label>
        Selected identity
        <select
          aria-label="Selected identity"
          value={context.entityId}
          onChange={event => {
            const nextEntityId = event.currentTarget.value;
            source.selectEntity(nextEntityId);
            navigateWallet(`/app#settings/stack-manager?entity=${encodeURIComponent(nextEntityId)}`);
          }}
        >
          {projection.entities.map(entity => (
            <option key={entity.entityId} value={entity.entityId}>
              {entity.label}
            </option>
          ))}
        </select>
      </label>
      <StackManager
        origin={origin}
        capability={capability}
        restriction={restriction}
        isCurrent={isCurrent}
        contextKey={`${context.runtimeId}:${context.entityId}`}
      />
    </div>
  );
}
