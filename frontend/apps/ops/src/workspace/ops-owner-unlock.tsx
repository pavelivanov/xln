import { useSyncExternalStore } from 'react';
import { opsEntityWorkspaceSource } from '../ops-entity-workspace-runtime';
import { readRuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime-adapter-session';
import { OpsLocalOwnerUnlock } from './ops-local-owner-unlock';
import { OpsOwnerUnlockForm } from './ops-owner-unlock-form';
import { workspaceBoot } from './ops-workspace-playback';

export function OpsOwnerUnlock() {
  useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getSnapshot);
  const adapter = opsEntityWorkspaceSource.getAdapter();
  const mode = readRuntimeAdapterStorageSnapshot({ durable: localStorage, session: sessionStorage }).mode;
  if (mode === 'embedded' && workspaceBoot.kind === 'plain') return <OpsLocalOwnerUnlock />;
  return adapter?.mode === 'remote' ? <OpsOwnerUnlockForm key={adapter.runtimeId} runtimeId={adapter.runtimeId} local={false} /> : null;
}
