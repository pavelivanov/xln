import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { resolveEntityPanelDeepLinkFromLocation } from '../../../packages/runtime-client/src/entity-workspace-navigation';
import {
  buildEntityWorkspaceTimeMachineHash,
  readEntityWorkspaceTimeMachineLink,
} from '../../../packages/runtime-client/src/entity-workspace-time-machine';
import { EntityWorkspaceShell } from '../../../packages/ui/src/entity-workspace-shell';
import { EntityWorkspaceTimeMachine } from '../../../packages/ui/src/entity-workspace-time-machine';
import { opsDisplayPreferencesSource } from './ops-display-preferences';
import { opsEntityWorkspaceSource } from './ops-entity-workspace-runtime';

const subscribeToHash = (onStoreChange: () => void): (() => void) => {
  window.addEventListener('hashchange', onStoreChange);
  return () => window.removeEventListener('hashchange', onStoreChange);
};

const readHash = (): string => window.location.hash;

const replaceTimeMachineHash = (
  link: Parameters<typeof buildEntityWorkspaceTimeMachineHash>[1],
): void => {
  const nextHash = buildEntityWorkspaceTimeMachineHash(window.location, link);
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}${nextHash}`,
  );
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'History read failed');

export function OpsEntityWorkspaceView() {
  const appliedHistoryLink = useRef('');
  const [historyLinkIssue, setHistoryLinkIssue] = useState('');
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

  useEffect(() => {
    const link = readEntityWorkspaceTimeMachineLink({ hash, search: '' });
    if (!link) {
      appliedHistoryLink.current = '';
      setHistoryLinkIssue('');
      return;
    }
    if (!displaySnapshot.preferences.showTimeMachine) {
      return;
    }
    const context = runtimeSnapshot.context;
    if (runtimeSnapshot.readState.status !== 'ready' || context.status !== 'selected') return;
    const key = `${link.runtimeId}|${link.entityId}|${String(link.height)}`;
    if (appliedHistoryLink.current === key) return;
    if (link.runtimeId && link.runtimeId !== context.runtimeId) {
      setHistoryLinkIssue(`TIME_MACHINE_RUNTIME_MISMATCH:${link.runtimeId}:${String(context.runtimeId)}`);
      return;
    }
    if (link.entityId && link.entityId !== context.entityId) {
      setHistoryLinkIssue(`TIME_MACHINE_ENTITY_MISMATCH:${link.entityId}:${context.entityId}`);
      return;
    }
    appliedHistoryLink.current = key;
    setHistoryLinkIssue('');
    void opsEntityWorkspaceSource.selectHistoryHeight(link.height)
      .then((accepted) => {
        if (accepted && opsEntityWorkspaceSource.getSnapshot().timeMachine.mode === 'live') {
          replaceTimeMachineHash(null);
        }
      })
      .catch((error: unknown) => setHistoryLinkIssue(errorMessage(error)));
  }, [
    displaySnapshot.preferences.showTimeMachine,
    hash,
    runtimeSnapshot.context,
    runtimeSnapshot.readState.status,
  ]);

  const selectHistoryHeight = async (height: number): Promise<boolean> => {
    setHistoryLinkIssue('');
    const accepted = await opsEntityWorkspaceSource.selectHistoryHeight(height);
    const snapshot = opsEntityWorkspaceSource.getSnapshot();
    if (accepted && snapshot.context.status === 'selected') {
      replaceTimeMachineHash(snapshot.timeMachine.mode === 'history' ? {
        entityId: snapshot.context.entityId,
        height: snapshot.timeMachine.selectedHeight,
        runtimeId: snapshot.context.runtimeId ?? '',
      } : null);
    }
    return accepted;
  };

  const returnLive = (): void => {
    setHistoryLinkIssue('');
    opsEntityWorkspaceSource.returnLive();
    replaceTimeMachineHash(null);
  };

  const toggleTimeMachine = (show: boolean): void => {
    opsDisplayPreferencesSource.setTimeMachineVisibility(show);
    if (show) return;
    setHistoryLinkIssue('');
    if (runtimeSnapshot.timeMachine.mode === 'history') {
      opsEntityWorkspaceSource.returnLive();
    }
    replaceTimeMachineHash(null);
  };
  return (
    <>
      <EntityWorkspaceShell
        activity={runtimeSnapshot.activity}
        accounts={runtimeSnapshot.accounts}
        activeTab={activeTab}
        consensus={runtimeSnapshot.consensus}
        context={runtimeSnapshot.context}
        displayIssue={displaySnapshot.issue}
        displayPreferences={displaySnapshot.preferences}
        hubPolicy={runtimeSnapshot.hubPolicy}
        onApplyActivityTimeframe={opsEntityWorkspaceSource.applyActivityTimeframe}
        onClearActivityFilters={opsEntityWorkspaceSource.clearActivityFilters}
        onLoadOlderActivity={opsEntityWorkspaceSource.loadOlderActivity}
        onRefreshActivity={opsEntityWorkspaceSource.refreshActivity}
        onRefresh={() => { void opsEntityWorkspaceSource.refresh(); }}
        onSaveProfile={opsEntityWorkspaceSource.saveProfile}
        onSelectAccountsPage={opsEntityWorkspaceSource.selectAccountsPage}
        onSelectActivityBeforeHeight={opsEntityWorkspaceSource.selectActivityPage}
        onSelectActivityKind={opsEntityWorkspaceSource.selectActivityKind}
        onSelectActivityMode={opsEntityWorkspaceSource.selectActivityMode}
        onSelectActivityPageSize={opsEntityWorkspaceSource.selectActivityPageSize}
        onSelectActivitySearch={opsEntityWorkspaceSource.selectActivitySearch}
        onSelectNewerActivityPage={opsEntityWorkspaceSource.selectNewerActivityPage}
        onSelectTheme={opsDisplayPreferencesSource.setTheme}
        onToggleActivityType={opsEntityWorkspaceSource.toggleActivityType}
        onToggleTimeMachine={toggleTimeMachine}
        onToggleXlnGuide={opsDisplayPreferencesSource.setXlnGuideVisibility}
        ownership={runtimeSnapshot.ownership}
        profile={runtimeSnapshot.profile}
        readState={runtimeSnapshot.readState}
        reserves={runtimeSnapshot.reserves}
        settingsSubview={settingsSubview}
        timeMachine={runtimeSnapshot.timeMachine}
      />
      {displaySnapshot.preferences.showTimeMachine ? (
        <EntityWorkspaceTimeMachine
          issue={historyLinkIssue}
          onReturnLive={returnLive}
          onSelectHeight={selectHistoryHeight}
          state={runtimeSnapshot.timeMachine}
        />
      ) : null}
    </>
  );
}
