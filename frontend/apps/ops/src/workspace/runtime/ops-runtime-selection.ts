import { readRuntimeAdapterStorageSnapshot, writeEmbeddedRuntimeAdapterSession, writeRemoteRuntimeAdapterSession } from '../../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import type { StoredRemoteRuntimeImportEntry } from '../../../../../packages/browser/src/runtime/session/remote-runtime-import';
import { networkMachineRuntimeOperations } from '../../../../../bridges/runtime/network-machine-runtime-store';
import { opsEntityWorkspaceSource, opsWorkspaceSession } from '../../entity-workspace/ops-entity-workspace-runtime';
import { pauseWorkspacePlayback } from '../session/ops-workspace-playback';

let selecting = false;
export const selectWorkspaceRuntime = async (entry: StoredRemoteRuntimeImportEntry | 'embedded'): Promise<void> => {
  if (selecting) throw new Error('OPS_RUNTIME_SELECTION_IN_PROGRESS');
  selecting = true;
  try {
    pauseWorkspacePlayback();
    networkMachineRuntimeOperations.dispose();
    const stores = { durable: localStorage, session: sessionStorage };
    if (entry === 'embedded') writeEmbeddedRuntimeAdapterSession(stores);
    else writeRemoteRuntimeAdapterSession(stores, { wsUrl: entry.wsUrl, access: entry.access, authKey: entry.token });
    await opsWorkspaceSession.select(readRuntimeAdapterStorageSnapshot(stores));
    const state = opsEntityWorkspaceSource.getSnapshot().readState;
    if (state.status === 'error') throw new Error(state.message);
  } finally { selecting = false; }
};
