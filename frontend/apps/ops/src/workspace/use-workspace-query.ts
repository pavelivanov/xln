import { useEffect, useState, useSyncExternalStore } from 'react';

import type { RuntimeQuerySnapshot } from '../../../../packages/runtime-client/src/runtime-query-observer';
import { opsEntityWorkspaceSource } from '../ops-entity-workspace-runtime';
import type { OpsWorkspaceQueryClient, OpsWorkspaceReader } from './ops-workspace-query';

type PanelQuery<T> = Readonly<{
  getSnapshot: () => RuntimeQuerySnapshot<T>;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
  destroy: () => void;
}>;

const emptySnapshot = { data: null, error: null, loading: true, height: 0 } as const;
const readEmpty = () => emptySnapshot;
const subscribeEmpty = () => () => {};

export function useWorkspaceQuery<T>(reader: OpsWorkspaceReader<T>) {
  const client = useSyncExternalStore(
    opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getPanelClient, () => null,
  );
  const connection = useSyncExternalStore(
    opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getSnapshot,
    opsEntityWorkspaceSource.getSnapshot,
  );
  const [query, setQuery] = useState<Readonly<{
    client: OpsWorkspaceQueryClient;
    observer: PanelQuery<T>;
  }> | null>(null);

  useEffect(() => {
    if (!client) { setQuery(null); return; }
    const observer = opsEntityWorkspaceSource.observePanelQuery(reader);
    setQuery({ client, observer });
    return observer.destroy;
  }, [client, reader]);

  // A replaced or disconnected Runtime never renders the old panel's data,
  // including the render before the new subscription effect has run.
  const observer = query?.client === client ? query?.observer : null;
  const snapshot = useSyncExternalStore(
    observer?.subscribe ?? subscribeEmpty,
    observer?.getSnapshot ?? readEmpty,
    readEmpty,
  );
  return { snapshot, connection: connection.readState, connected: client !== null, client, refresh: observer?.refresh };
}
