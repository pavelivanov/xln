import { useEffect, useState, useSyncExternalStore } from 'react';
import type { EnvSnapshot, RuntimeAdapter, RuntimeReplica } from '@xln/core/api/public/runtime-module';
import { openBrowserRuntimeView, type BrowserRuntimeViewSnapshot } from '../../../../bridges/browser-runtime-context';
import { networkMachineRuntimeOperations } from '../../../../src/lib/stores/network/networkMachineRuntimeStore';
import { opsEntityWorkspaceSource } from '../ops-entity-workspace-runtime';
import { workspaceNetwork } from './ops-workspace-playback';

const empty: BrowserRuntimeViewSnapshot = { env: null, error: '', securityIncidents: [] };
const readEmpty = () => empty;
const subscribeEmpty = () => () => {};

export function useWorkspaceEnvironment() {
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  const adapter = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getAdapter);
  const [lease, setLease] = useState<{ adapter: RuntimeAdapter; session: ReturnType<typeof openBrowserRuntimeView> } | null>(null);
  useEffect(() => {
    if (!adapter || adapter.mode !== 'embedded') { setLease(null); return; }
    const session = openBrowserRuntimeView(adapter);
    setLease({ adapter, session });
    return session.release;
  }, [adapter]);
  const session = lease?.adapter === adapter ? lease?.session : null;
  const local = useSyncExternalStore(session?.subscribe ?? subscribeEmpty, session?.getSnapshot ?? readEmpty);
  const selected = network.selectedStep;
  const frame: EnvSnapshot | RuntimeReplica | null = selected
    ? networkMachineRuntimeOperations.readSelectedSnapshot()
    : local.env;
  const restriction = selected && networkMachineRuntimeOperations.readSelectedSourceKind() === 'trail' ? 'This portable trail contains graph and activity projections, without a full local Runtime.'
    : !selected && adapter?.mode === 'remote' ? 'This panel requires a local Runtime. It is unavailable for remote connections.'
    : selected && !frame ? 'The selected history frame has no full local Runtime snapshot.'
    : !frame ? 'Select a local Runtime or run a scenario to inspect its state.' : '';
  const securityIncidents = !selected && adapter?.mode === 'embedded' && local.env ? local.securityIncidents : null;
  return { frame, adapter, securityIncidents, refreshLocal: selected ? undefined : session?.refresh, historical: selected !== null, restriction, error: selected ? network.error ?? '' : local.error, network };
}
