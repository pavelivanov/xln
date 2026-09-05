import { get } from 'svelte/store';
import type { RuntimeAdapter, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { getXLN, xlnEnvironment, p2pState, resolveConfiguredApiBase } from '../src/lib/stores/xlnStore';
import { runtimes } from '../src/lib/stores/runtimeStore';
import { buildEntityPanelView, findReplicaForEntityTab, isSameJurisdictionEntityInReplicas } from '../src/lib/components/Entity/core/entity-panel-model';
import { buildOpenAccountEntityOptions } from '../src/lib/components/Entity/workspace/entity-panel-options';
import { unwrapLiveRuntimeEnv } from '../src/lib/utils/runtime/liveRuntimeEnv';
import { buildHubDiscoveryProjection, buildHubDiscoveryRemoteHubsFromRuntimes, getHubOpenAccountPermissionError } from '../src/lib/components/Entity/onboarding/hub-discovery-profile';
import type { WalletAccountOpenRead } from '../apps/wallet/src/wallet-account-open-model';
import type { WalletAccountView } from '../apps/wallet/src/wallet-account-view-model';
import { buildAccountTokenDetails } from '../src/lib/components/Entity/shared/account-token-details';
import { buildAccountActivityRows } from '../src/lib/components/Entity/account/account-focused-view';
import { buildDisputedAccountViews } from '../src/lib/components/Entity/account/account-dispute-view';
import { buildAccountDropdownItems } from '../src/lib/components/Entity/account/account-dropdown-model';

export const readCanonicalAccountDropdown = async (adapter: RuntimeAdapter, entityId: string, frame: RuntimeAdapterViewFrame) => {
  const view = await readCanonicalAccountView(adapter, entityId, '', frame);
  const xln = await getXLN();
  return buildAccountDropdownItems(view.replica.state.accounts, view.entityNames, id => xln.generateEntityAvatar(id));
};

export const readCanonicalAccountView = async (adapter: RuntimeAdapter, entityId: string, counterpartyId: string, frame: RuntimeAdapterViewFrame): Promise<WalletAccountView> => {
  const xln = await getXLN();
  const local = get(xlnEnvironment);
  const bound = adapter.mode === 'embedded' && local?.runtimeId?.toLowerCase() === adapter.runtimeId.toLowerCase() ? local : null;
  if (adapter.mode === 'embedded' && !bound) throw new Error('ACCOUNT_VIEW_LOCAL_RUNTIME_CHANGED');
  const panel = buildEntityPanelView(bound, entityId, '', '', bound ? undefined : frame);
  if (!panel.replica) throw new Error('ACCOUNT_VIEW_ENTITY_UNAVAILABLE');
  const account = [...panel.replica.state.accounts].find(([id]) => id.toLowerCase() === counterpartyId.toLowerCase())?.[1] ?? null;
  if (counterpartyId && !account) throw new Error('ACCOUNT_VIEW_ACCOUNT_UNAVAILABLE');
  const transport = get(p2pState);
  return {
    account, replica: panel.replica, entityId, counterpartyId,
    counterpartyName: panel.entityNames.get(counterpartyId.toLowerCase()) || counterpartyId,
    entityNames: panel.entityNames,
    tokens: account ? buildAccountTokenDetails(account.state, entityId, xln) : [],
    activity: account ? buildAccountActivityRows(account, entityId) : [],
    disputed: buildDisputedAccountViews(panel.replica.state.accounts),
    presentation: { entityNames: panel.entityNames, htlcNotes: panel.replica.htlcNotes, activeXlnFunctions: xln },
    formatTokenAmount: xln.formatTokenAmount, apiBase: resolveConfiguredApiBase(window.location.origin),
    // The retained faucet reads its Runtime id from the live action env.
    // Remote UserModePanel supplies no live env; preserve that guard instead
    // of adding a new remote faucet authority path during the UI port.
    faucetRuntimeId: bound?.runtimeId || '',
    commandsReady: adapter.commandReady,
    sameJurisdiction: isSameJurisdictionEntityInReplicas(panel.replicas, panel.replica, entityId, entityId, counterpartyId),
    relayStatus: transport.connected ? 'connected' : transport.reconnect ? 'reconnecting' : 'disconnected',
  };
};

export const subscribeCanonicalAccountView = (listener: () => void): (() => void) => {
  const releases = [p2pState.subscribe(listener)];
  return () => { for (const release of releases) release(); };
};

export const readCanonicalHubDiscovery = async (adapter: RuntimeAdapter, entityId: string, frame: RuntimeAdapterViewFrame, targetId = '', targetFrame?: RuntimeAdapterViewFrame): Promise<WalletAccountOpenRead> => {
  const xln = await getXLN();
  const localFrame = get(xlnEnvironment);
  const bound = adapter.mode === 'embedded' && localFrame?.runtimeId?.toLowerCase() === adapter.runtimeId.toLowerCase() ? localFrame : null;
  if (adapter.mode === 'embedded' && !bound) throw new Error('HUB_DISCOVERY_LOCAL_RUNTIME_CHANGED');
  const panel = buildEntityPanelView(bound, entityId, '', '', bound ? undefined : frame);
  const replicas = panel.replicas ? new Map(panel.replicas) : null;
  if (!bound && replicas && targetFrame) {
    const targetPanel = buildEntityPanelView(null, targetId, '', '', targetFrame);
    for (const [key, replica] of targetPanel.replicas || []) replicas.set(key, replica);
  }
  const runtimeByEntity = new Map(frame.entities.map(summary => [summary.entityId.toLowerCase(), summary.runtimeId || adapter.runtimeId]));
  const profiles = bound ? panel.profiles : panel.profiles.map(profile => ({
    ...profile, runtimeId: runtimeByEntity.get(profile.entityId.toLowerCase()) || adapter.runtimeId,
  }));
  const permissionError = getHubOpenAccountPermissionError({ adapterMode: adapter.mode, authLevel: adapter.authLevel });
  const env = bound ? unwrapLiveRuntimeEnv(bound) ?? bound : null;
  const canOpenAccounts = adapter.commandReady && permissionError === null;
  const accountIds = [...(panel.replica?.state?.accounts.keys() || [])];
  const projection = buildHubDiscoveryProjection({
    runtimeId: adapter.runtimeId, entityId, replicas, profiles,
    remoteHubs: buildHubDiscoveryRemoteHubsFromRuntimes(get(runtimes).values()),
    formatRawProfile: profile => xln.safeStringify(profile, 2), avatarForEntity: xln.generateEntityAvatar,
  });
  return {
    entityId, env, canOpenAccounts, projection, disputed: buildDisputedAccountViews(panel.replica?.state.accounts),
    permissionError: permissionError || adapter.commandReadyReason || '',
    entities: buildOpenAccountEntityOptions({ replica: panel.replica, tabEntityId: entityId, accountIds, activeReplicas: replicas, profiles }),
    profiles: profiles.map(profile => ({ entityId: profile.entityId, name: profile.name })),
    direct: {
      runtimeId: adapter.runtimeId, entityId, signerId: projection.sourceSignerId, env, canOpenAccounts,
      permissionError: permissionError || adapter.commandReadyReason || '', activeIsLive: true,
      sameJurisdiction: isSameJurisdictionEntityInReplicas(replicas, panel.replica, entityId, entityId, targetId),
      hasAccount: accountIds.some(id => id.toLowerCase() === targetId),
      sourceIsHub: panel.replica?.state?.profile?.isHub,
      targetIsHub: findReplicaForEntityTab(replicas, targetId, '')?.state?.profile?.isHub,
    },
  };
};
