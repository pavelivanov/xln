import type { ReactNode } from 'react';

import type { EntityWorkspaceReadState } from '../../../../packages/runtime-client/src/entity-workspace-context';
import { opsEntityWorkspaceSource } from '../ops-entity-workspace-runtime';

export function WorkspaceReadBoundary({ connected, connection, loading, error, children }: Readonly<{
  connected: boolean;
  connection: EntityWorkspaceReadState;
  loading: boolean;
  error: string | null;
  children: ReactNode;
}>) {
  if (!connected) return (
    <div className="workspace-read-state" role={connection.status === 'error' ? 'alert' : 'status'}>
      <p>{connection.message}</p>
      {connection.status === 'error' ? (
        <button onClick={() => { void opsEntityWorkspaceSource.start(); }} type="button">Reconnect</button>
      ) : null}
    </div>
  );
  if (error) return <div className="workspace-read-state is-error" role="alert">{error}</div>;
  if (loading) return <div className="workspace-read-state" role="status">Loading Runtime projection…</div>;
  return children;
}
