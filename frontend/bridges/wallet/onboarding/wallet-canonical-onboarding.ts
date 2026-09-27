import { readStoreValue } from '../../../packages/runtime-client/src/observable-store';
import type { RuntimeInput } from '@xln/core/api/public/runtime-module';
import type {
  WalletCustodyOwner,
  WalletOnboardingRequest,
  WalletOnboardingResult,
  WalletOnboardingView,
} from '../../../packages/browser/src/wallet/wallet-onboarding';
import {
  clearWalletLocalLauncherOnboarding,
  getWalletLocalLauncherOnboarding,
  subscribeWalletLocalLauncherOnboarding,
} from '../../../packages/browser/src/runtime/wallet-local-launcher';
import { vaultOperations } from '../../vault/vault-store';
import { activeRuntime } from '../../vault/vault-metadata-store';
import { resolveConfiguredApiBase, submitRuntimeInput, xlnEnvironment, xlnFunctions } from '../../runtime/xln-store';
import { getRuntimeControllerAdapter, runtimeControllerHandle } from '../../runtime/runtime-controller-store';
import { runtimeView } from '../../runtime/runtime-view-store';
import { resolveActiveLocalReplica } from '../../../packages/runtime-client/src/runtime/local-runtime-selection';
import { buildOnboardingRuntimeProjection } from '../onboarding/onboarding-runtime-projection';
import { buildOnboardingRuntimeViewProjection } from '../onboarding/onboarding-runtime-view-projection';
import { createOnboardingHubJoinCommands } from '../onboarding/onboarding-hub-join';
import { finishOnboardingSetup } from '../../../packages/browser/src/onboarding/onboarding-setup';
import { hasAnyOnboardingCounterpartyAccount, resolveOnboardingTargets } from '../onboarding/onboarding-targets';
import {
  readAnyOnboardingComplete,
  subscribeOnboardingCompletion,
  writeOnboardingCompleteForEntities,
} from '../../../packages/browser/src/onboarding/onboarding-state';
import { readHubJoinPreference, readSavedCollateralPolicy } from '../../../packages/browser/src/onboarding/onboarding-preferences';
import { saveCanonicalWalletRecoveryServices } from '../canonical/wallet-canonical-recovery-services';

const normalizeId = (value: string): string => value.trim().toLowerCase();

const readBoundRuntime = (runtimeId: string) => {
  const runtime = readStoreValue(activeRuntime);
  if (!runtime || normalizeId(runtime.id) !== normalizeId(runtimeId)) {
    throw new Error('ONBOARDING_RUNTIME_CHANGED: Open setup for the active wallet.');
  }
  return runtime;
};

const assertDaemonAuthority = (runtimeId: string): void => {
  const adapter = getRuntimeControllerAdapter();
  const handle = readStoreValue(runtimeControllerHandle);
  if (!adapter || adapter.mode !== 'remote' || handle.mode !== 'remote'
    || normalizeId(adapter.runtimeId) !== normalizeId(runtimeId)) {
    throw new Error('ONBOARDING_DAEMON_RUNTIME_CHANGED');
  }
  if (adapter.status !== 'connected' || adapter.authLevel !== 'admin') {
    throw new Error('ONBOARDING_DAEMON_ADMIN_REQUIRED');
  }
  if (!adapter.commandReady) {
    throw new Error(adapter.commandReadyReason || 'ONBOARDING_DAEMON_COMMAND_NOT_READY');
  }
};

const readLocalProjection = (runtimeId: string) => {
  const runtime = readBoundRuntime(runtimeId);
  const frame = readStoreValue(xlnEnvironment);
  if (!frame || normalizeId(String(frame.runtimeId || '')) !== normalizeId(runtime.id)) return null;
  const signer = runtime.signers[runtime.activeSignerIndex] || runtime.signers[0];
  const replica = resolveActiveLocalReplica(frame.state.eReplicas, signer);
  const jurisdiction = String(replica?.state.config.jurisdiction?.name || replica?.position?.jurisdiction || '').trim();
  return {
    custodyOwner: 'browser' as const,
    runtimeId: runtime.id,
    entityId: String(replica?.entityId || signer?.entityId || '').toLowerCase(),
    label: runtime.label,
    requiresOnboarding: runtime.requiresOnboarding,
    signers: runtime.signers,
    projection: buildOnboardingRuntimeProjection({
      currentFrame: frame,
      selectedEntityId: replica?.entityId || signer?.entityId || null,
      selectedSignerId: replica?.signerId || signer?.address || null,
      selectedReplica: replica,
      selectedReplicaJurisdiction: jurisdiction,
      activeJurisdictionName: 'activeJurisdiction' in frame && typeof frame.activeJurisdiction === 'string' ? frame.activeJurisdiction : null,
      runtimeSigners: runtime.signers,
    }),
    assertAuthority: () => vaultOperations.assertRuntimeAuthority(runtime.id),
  };
};

const readDaemonProjection = (runtimeId: string) => {
  const launch = getWalletLocalLauncherOnboarding();
  if (launch.stage !== 'formation' || normalizeId(launch.runtimeId) !== normalizeId(runtimeId)) return null;
  const view = readStoreValue(runtimeView);
  if (!view.frame || normalizeId(view.runtimeId) !== normalizeId(runtimeId)
    || normalizeId(view.frame.activeEntityId || '') !== normalizeId(launch.entityId)) return null;
  const projection = buildOnboardingRuntimeViewProjection(view.frame, launch.entityId);
  return {
    custodyOwner: 'daemon' as const,
    runtimeId: launch.runtimeId,
    entityId: launch.entityId,
    label: 'Local node',
    requiresOnboarding: true,
    signers: projection.targets.map(target => ({
      entityId: target.entityId,
      address: target.signerId,
      ...(target.jurisdiction ? { jurisdiction: target.jurisdiction } : {}),
    })),
    projection,
    assertAuthority: () => assertDaemonAuthority(launch.runtimeId),
  };
};

const readBoundProjection = (runtimeId: string) => {
  const launch = getWalletLocalLauncherOnboarding();
  if (launch.stage === 'formation' && normalizeId(launch.runtimeId) === normalizeId(runtimeId)) {
    return readDaemonProjection(runtimeId);
  }
  const handle = readStoreValue(runtimeControllerHandle);
  if (handle.mode === 'remote' && normalizeId(handle.runtimeId) === normalizeId(runtimeId)) return null;
  return readLocalProjection(runtimeId);
};

export const readCanonicalWalletOnboarding = (runtimeId: string): WalletOnboardingView => {
  const current = readBoundProjection(runtimeId);
  if (!current) return { state: 'waiting', reason: 'Waiting for this wallet’s committed Runtime.' };
  const entityIds = current.signers.map(signer => String(signer.entityId || ''));
  if (current.requiresOnboarding === false || readAnyOnboardingComplete(entityIds)) {
    return { state: 'complete', runtimeId: current.runtimeId };
  }
  const jurisdictions = current.signers.map((signer, index) => {
    const name = String(signer.jurisdiction || (index === 0 ? 'Primary' : `Jurisdiction ${index + 1}`)).trim();
    return { key: name.toLowerCase() || `jurisdiction-${index}`, name,
      entityId: String(signer.entityId || '').trim(), signerId: String(signer.address || '').trim().toLowerCase() };
  }).filter(option => option.entityId && option.signerId);
  let blockedReason = '';
  try { current.assertAuthority(); }
  catch (error: unknown) { blockedReason = error instanceof Error ? error.message : String(error); }
  return {
    state: 'ready', runtimeId: current.runtimeId, entityId: current.entityId,
    displayName: String(current.projection.suggestedDisplayName || current.label || localStorage.getItem('xln-display-name') || '').trim().slice(0, 32),
    activeJurisdictionName: current.projection.activeJurisdictionName || '',
    policy: readSavedCollateralPolicy(),
    autoJoinHubs: localStorage.getItem('xln-hub-join-preference') !== null ? readHubJoinPreference() : '1',
    jurisdictions, custodyOwner: current.custodyOwner,
    writable: blockedReason === '', blockedReason,
  };
};

export const subscribeCanonicalWalletOnboarding = (
  runtimeId: string,
  listener: (view: WalletOnboardingView) => void,
  onError: (error: unknown) => void,
): (() => void) => {
  let completeRuntimeId = '';
  const publish = () => {
    try {
      const view = readCanonicalWalletOnboarding(runtimeId);
      if (view.state === 'complete' && completeRuntimeId === view.runtimeId) return;
      completeRuntimeId = view.state === 'complete' ? view.runtimeId : '';
      listener(view);
    } catch (error: unknown) { completeRuntimeId = ''; onError(error); }
  };
  const releases = [
    activeRuntime.subscribe(publish), xlnEnvironment.subscribe(publish),
    runtimeView.subscribe(publish), subscribeWalletLocalLauncherOnboarding(publish),
    subscribeOnboardingCompletion(publish),
  ];
  return () => releases.forEach(release => release());
};

const validateRecoveryOwnership = (
  custodyOwner: WalletCustodyOwner,
  request: WalletOnboardingRequest,
): void => {
  if (custodyOwner === 'daemon') {
    if (request.recovery !== null) throw new Error('ONBOARDING_DAEMON_BROWSER_RECOVERY_FORBIDDEN');
    return;
  }
  if (!request.recovery || normalizeId(request.recovery.runtimeId) !== normalizeId(request.runtimeId)) {
    throw new Error('ONBOARDING_RECOVERY_RUNTIME_MISMATCH');
  }
};

export const finishCanonicalWalletOnboarding = async (
  request: WalletOnboardingRequest,
  signal: AbortSignal,
): Promise<WalletOnboardingResult> => {
  const requireCurrent = () => {
    signal.throwIfAborted();
    const current = readBoundProjection(request.runtimeId);
    if (!current) throw new Error('ONBOARDING_RUNTIME_NOT_READY');
    current.assertAuthority();
    return current;
  };
  const current = requireCurrent();
  validateRecoveryOwnership(current.custodyOwner, request);
  if (normalizeId(request.draft.entityId) !== normalizeId(current.entityId)) throw new Error('ONBOARDING_ENTITY_CHANGED');
  const { draft } = request;
  if (!request.termsAccepted || draft.displayName.trim().length < 2
    || !Number.isFinite(draft.softLimitUsd) || draft.softLimitUsd <= 0
    || !Number.isFinite(draft.hardLimitUsd) || draft.hardLimitUsd < draft.softLimitUsd
    || !Number.isFinite(draft.maxFeeUsd) || draft.maxFeeUsd < 0) throw new Error('Review the profile, limits and terms before finishing setup.');
  const submit = async (input: RuntimeInput) => {
    requireCurrent();
    const result = await submitRuntimeInput(input);
    requireCurrent();
    return result;
  };
  const joins = createOnboardingHubJoinCommands({
    readProjection: () => requireCurrent().projection,
    readTokenDecimals: () => readStoreValue(xlnFunctions).getTokenInfo(1).decimals,
    resolveApiBase: resolveConfiguredApiBase,
    submitRuntimeInput: submit,
  });
  const result = await finishOnboardingSetup(draft, {
    custodyOwner: current.custodyOwner,
    readTargets: () => { const bound = requireCurrent(); return resolveOnboardingTargets(bound.projection, bound.signers); },
    isTargetJurisdictionEnabled: target => request.selectedJurisdictions[target.jurisdiction.trim().toLowerCase()] !== false,
    hasAnyCounterpartyAccount: id => hasAnyOnboardingCounterpartyAccount(requireCurrent().projection, id),
    submitRuntimeInput: submit,
    saveRecoveryConfig: async () => {
      const bound = requireCurrent();
      if (bound.custodyOwner !== 'browser' || !request.recovery) throw new Error('ONBOARDING_BROWSER_RECOVERY_REQUIRED');
      await saveCanonicalWalletRecoveryServices(request.recovery); requireCurrent();
    },
    queueAutoHubJoins: async (count, targets) => {
      requireCurrent(); const queued = await joins.queueAutoHubJoins(count, targets); requireCurrent(); return queued;
    },
  });
  return { ...result, custodyOwner: current.custodyOwner };
};

export const synchronizeCanonicalWalletOnboardingCompletion = (runtimeId: string): void => {
  const launch = getWalletLocalLauncherOnboarding();
  if (launch.stage === 'formation' && normalizeId(launch.runtimeId) === normalizeId(runtimeId)) {
    const daemon = readDaemonProjection(runtimeId);
    if (daemon && readAnyOnboardingComplete([daemon.entityId])) clearWalletLocalLauncherOnboarding();
    return;
  }
  const runtime = readBoundRuntime(runtimeId);
  const entityIds = runtime.signers.map(signer => String(signer.entityId || ''));
  if (readAnyOnboardingComplete(entityIds)) writeOnboardingCompleteForEntities(entityIds, true);
};
