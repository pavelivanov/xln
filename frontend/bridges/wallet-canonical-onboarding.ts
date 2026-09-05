import { get } from 'svelte/store';
import type { RuntimeInput } from '@xln/core/api/public/runtime-module';
import type { WalletOnboardingRequest, WalletOnboardingResult, WalletOnboardingView } from '../packages/browser/src/wallet-onboarding';
import { activeRuntime, vaultOperations } from '../src/lib/stores/vault/vaultStore';
import { resolveConfiguredApiBase, submitRuntimeInput, xlnEnvironment, xlnFunctions } from '../src/lib/stores/xlnStore';
import { resolveActiveLocalReplica } from '../src/lib/view/local-runtime-selection';
import { buildOnboardingRuntimeProjection } from '../src/lib/components/Entity/onboarding/onboarding-runtime-projection';
import { createOnboardingHubJoinCommands } from '../src/lib/components/Entity/onboarding/onboarding-hub-join';
import { finishOnboardingSetup } from '../src/lib/components/Entity/onboarding/onboarding-setup';
import { hasAnyOnboardingCounterpartyAccount, resolveOnboardingTargets } from '../src/lib/components/Entity/onboarding/onboarding-targets';
import { readAnyOnboardingComplete, writeOnboardingCompleteForEntities } from '../src/lib/utils/onboarding/onboardingState';
import { readHubJoinPreference, readSavedCollateralPolicy } from '../src/lib/utils/onboarding/onboardingPreferences';
import { saveCanonicalWalletRecoveryServices } from './wallet-canonical-recovery-services';

const normalizeId = (value: string): string => value.trim().toLowerCase();

const readBoundRuntime = (runtimeId: string) => {
  const runtime = get(activeRuntime);
  if (!runtime || normalizeId(runtime.id) !== normalizeId(runtimeId)) {
    throw new Error('ONBOARDING_RUNTIME_CHANGED: Open setup for the active wallet.');
  }
  return runtime;
};

const readBoundProjection = (runtimeId: string) => {
  const runtime = readBoundRuntime(runtimeId);
  const frame = get(xlnEnvironment);
  if (!frame || normalizeId(String(frame.runtimeId || '')) !== normalizeId(runtime.id)) {
    return null;
  }
  const signer = runtime.signers[runtime.activeSignerIndex] || runtime.signers[0];
  const replica = resolveActiveLocalReplica(frame.state.eReplicas, signer);
  const jurisdiction = String(replica?.state.config.jurisdiction?.name || replica?.position?.jurisdiction || '').trim();
  return {
    runtime,
    entityId: String(replica?.entityId || signer?.entityId || '').toLowerCase(),
    projection: buildOnboardingRuntimeProjection({
      currentFrame: frame,
      selectedEntityId: replica?.entityId || signer?.entityId || null,
      selectedSignerId: replica?.signerId || signer?.address || null,
      selectedReplica: replica,
      selectedReplicaJurisdiction: jurisdiction,
      activeJurisdictionName: 'activeJurisdiction' in frame && typeof frame.activeJurisdiction === 'string' ? frame.activeJurisdiction : null,
      runtimeSigners: runtime.signers,
    }),
  };
};

export const readCanonicalWalletOnboarding = (runtimeId: string): WalletOnboardingView => {
  const selected = readBoundRuntime(runtimeId);
  if (selected.requiresOnboarding === false || readAnyOnboardingComplete(selected.signers.map(signer => String(signer.entityId || '')))) {
    return { state: 'complete', runtimeId: selected.id };
  }
  const current = readBoundProjection(runtimeId);
  if (!current) return { state: 'waiting', reason: 'Waiting for this wallet’s committed Runtime.' };
  const { runtime, projection, entityId } = current;
  const jurisdictions = runtime.signers.map((signer, index) => {
    const name = String(signer.jurisdiction || (index === 0 ? 'Primary' : `Jurisdiction ${index + 1}`)).trim();
    return { key: name.toLowerCase() || `jurisdiction-${index}`, name,
      entityId: String(signer.entityId || '').trim(), signerId: String(signer.address || '').trim().toLowerCase() };
  }).filter(option => option.entityId && option.signerId);
  let blockedReason = '';
  try { vaultOperations.assertRuntimeAuthority(runtime.id); }
  catch (error: unknown) { blockedReason = error instanceof Error ? error.message : String(error); }
  return {
    state: 'ready', runtimeId: runtime.id, entityId,
    displayName: String(projection.suggestedDisplayName || runtime.label || localStorage.getItem('xln-display-name') || '').trim().slice(0, 32),
    activeJurisdictionName: projection.activeJurisdictionName || '',
    policy: readSavedCollateralPolicy(),
    autoJoinHubs: localStorage.getItem('xln-hub-join-preference') !== null ? readHubJoinPreference() : '1',
    jurisdictions, writable: blockedReason === '', blockedReason,
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
    }
    catch (error: unknown) { completeRuntimeId = ''; onError(error); }
  };
  const releases = [activeRuntime.subscribe(publish), xlnEnvironment.subscribe(publish)];
  return () => releases.forEach(release => release());
};

export const finishCanonicalWalletOnboarding = async (
  request: WalletOnboardingRequest,
  signal: AbortSignal,
): Promise<WalletOnboardingResult> => {
  const requireCurrent = () => {
    signal.throwIfAborted();
    const current = readBoundProjection(request.runtimeId);
    if (!current) throw new Error('ONBOARDING_RUNTIME_NOT_READY');
    vaultOperations.assertRuntimeAuthority(current.runtime.id);
    return current;
  };
  const current = requireCurrent();
  if (normalizeId(request.recovery.runtimeId) !== normalizeId(current.runtime.id)) throw new Error('ONBOARDING_RECOVERY_RUNTIME_MISMATCH');
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
    readTokenDecimals: () => get(xlnFunctions).getTokenInfo(1).decimals,
    resolveApiBase: resolveConfiguredApiBase,
    submitRuntimeInput: submit,
  });
  return finishOnboardingSetup(draft, {
    readTargets: () => { const bound = requireCurrent(); return resolveOnboardingTargets(bound.projection, bound.runtime.signers); },
    isTargetJurisdictionEnabled: target => request.selectedJurisdictions[target.jurisdiction.trim().toLowerCase()] !== false,
    hasAnyCounterpartyAccount: id => hasAnyOnboardingCounterpartyAccount(requireCurrent().projection, id),
    submitRuntimeInput: submit,
    saveRecoveryConfig: async () => { requireCurrent(); await saveCanonicalWalletRecoveryServices(request.recovery); requireCurrent(); },
    queueAutoHubJoins: async (count, targets) => {
      requireCurrent();
      const result = await joins.queueAutoHubJoins(count, targets);
      requireCurrent();
      return result;
    },
  });
};

// Match the retained runtime-level completion rule for already configured
// sibling lanes. This writes only existing browser onboarding preferences.
export const synchronizeCanonicalWalletOnboardingCompletion = (runtimeId: string): void => {
  const runtime = readBoundRuntime(runtimeId);
  const entityIds = runtime.signers.map(signer => String(signer.entityId || ''));
  if (readAnyOnboardingComplete(entityIds)) writeOnboardingCompleteForEntities(entityIds, true);
};
