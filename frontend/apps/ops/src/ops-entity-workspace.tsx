import { useSyncExternalStore } from 'react';

import { resolveEntityPanelDeepLinkFromLocation } from '../../../packages/runtime-client/src/entity-workspace-navigation';
import { EntityWorkspaceShell } from '../../../packages/ui/src/entity-workspace-shell';
import { opsDisplayPreferencesSource } from './ops-display-preferences';
import { opsEntityWorkspaceSource } from './ops-entity-workspace-runtime';
import { OpsShell } from './ops-shell';

const subscribeToHash = (onStoreChange: () => void): (() => void) => {
  window.addEventListener('hashchange', onStoreChange);
  return () => window.removeEventListener('hashchange', onStoreChange);
};

const readHash = (): string => window.location.hash;

export function OpsEntityWorkspacePage() {
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => '');
  const runtimeSnapshot = useSyncExternalStore(
    opsEntityWorkspaceSource.subscribe,
    opsEntityWorkspaceSource.getSnapshot,
    opsEntityWorkspaceSource.getSnapshot,
  );
  const displaySnapshot = useSyncExternalStore(
    opsDisplayPreferencesSource.subscribe,
    opsDisplayPreferencesSource.getSnapshot,
    opsDisplayPreferencesSource.getSnapshot,
  );
  const route = resolveEntityPanelDeepLinkFromLocation({ hash, search: '' });
  const activeTab = route.activeTab ?? 'assets';
  const settingsSubview = route.settingsSubview ?? 'wallet';
  return (
    <OpsShell activePath="/embed">
      <EntityWorkspaceShell
        accounts={runtimeSnapshot.accounts}
        activeTab={activeTab}
        consensus={runtimeSnapshot.consensus}
        context={runtimeSnapshot.context}
        displayIssue={displaySnapshot.issue}
        displayPreferences={displaySnapshot.preferences}
        onRefresh={() => { void opsEntityWorkspaceSource.refresh(); }}
        onSelectAccountsPage={opsEntityWorkspaceSource.selectAccountsPage}
        onSelectTheme={opsDisplayPreferencesSource.setTheme}
        ownership={runtimeSnapshot.ownership}
        profile={runtimeSnapshot.profile}
        readState={runtimeSnapshot.readState}
        reserves={runtimeSnapshot.reserves}
        settingsSubview={settingsSubview}
      />
    </OpsShell>
  );
}
