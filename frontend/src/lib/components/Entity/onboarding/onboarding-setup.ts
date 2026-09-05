import type { RuntimeInput } from '@xln/core/api/public/runtime-module';
import { writeHubJoinPreference, writeSavedCollateralPolicy, type HubJoinPreference } from '../../../utils/onboarding/onboardingPreferences';
import { writeOnboardingCompleteForEntities } from '../../../utils/onboarding/onboardingState';
import { assertCommittedAutoJoinCount, buildOnboardingProfileRuntimeInput } from './onboarding-runtime-input';
import type { OnboardingTarget } from './onboarding-hub-discovery';

export type OnboardingSetupDraft = Readonly<{
  entityId: string;
  displayName: string;
  softLimitUsd: number;
  hardLimitUsd: number;
  maxFeeUsd: number;
  defaultSoftLimitUsd: number;
  defaultHardLimitUsd: number;
  defaultMaxFeeUsd: number;
  autoJoinHubs: HubJoinPreference;
}>;

export type OnboardingSetupContext = Readonly<{
  readTargets: () => OnboardingTarget[];
  isTargetJurisdictionEnabled: (target: OnboardingTarget) => boolean;
  hasAnyCounterpartyAccount: (entityId: string) => boolean;
  submitRuntimeInput: (input: RuntimeInput) => Promise<unknown>;
  saveRecoveryConfig: () => Promise<void>;
  queueAutoHubJoins: (count: number, targets: OnboardingTarget[]) => Promise<{ joined: number; requiredTargets: number }>;
}>;

export const toUsdInt = (value: number, defaultValue: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(0, Math.floor(parsed));
};

const parseJoinCount = (pref: HubJoinPreference): number =>
  pref === 'manual' ? 0 : Number(pref);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForEnabledOnboardingTargets(context: OnboardingSetupContext): Promise<{
  allTargets: OnboardingTarget[];
  targets: OnboardingTarget[];
}> {
  const deadline = Date.now() + 3_000;
  let allTargets: OnboardingTarget[] = [];
  let targets: OnboardingTarget[] = [];
  while (Date.now() < deadline) {
    allTargets = context.readTargets();
    targets = allTargets.filter(context.isTargetJurisdictionEnabled);
    if (targets.length > 0) return { allTargets, targets };
    await sleep(100);
  }
  return { allTargets, targets };
}

// Keep the retained completion order at one frontend boundary. In particular,
// recovery setup precedes every hub Account open, and completion is written only
// after the established command and join-count checks resolve successfully.
export async function finishOnboardingSetup(draft: OnboardingSetupDraft, context: OnboardingSetupContext) {
  const { entityId, displayName, softLimitUsd, hardLimitUsd, maxFeeUsd,
    defaultSoftLimitUsd, defaultHardLimitUsd, defaultMaxFeeUsd, autoJoinHubs } = draft;
  const cleanDisplayName = displayName.trim();
  let allTargets = context.readTargets();
  let targets = allTargets.filter(context.isTargetJurisdictionEnabled);
  if (targets.length === 0) {
    ({ allTargets, targets } = await waitForEnabledOnboardingTargets(context));
  }
  if (targets.length === 0) {
    throw new Error('Select at least one jurisdiction to register automatically');
  }

  const policyData = writeSavedCollateralPolicy({
    mode: 'autopilot',
    softLimitUsd: toUsdInt(softLimitUsd, defaultSoftLimitUsd),
    hardLimitUsd: toUsdInt(hardLimitUsd, defaultHardLimitUsd),
    maxFeeUsd: toUsdInt(maxFeeUsd, defaultMaxFeeUsd),
  });
  const savedJoinPreference = writeHubJoinPreference(autoJoinHubs);

  await context.submitRuntimeInput(buildOnboardingProfileRuntimeInput({
    targets,
    displayName: cleanDisplayName,
  }));

  // Recovery must be committed before opening hub accounts. Account opens create
  // usable bilateral state; with a configured tower, the runtime backup barrier
  // must already be installed before those committed frames can leave the device.
  await context.saveRecoveryConfig();

  const autoJoinCount = parseJoinCount(savedJoinPreference);
  const autoJoinTargets = autoJoinCount > 0
    ? targets.filter((target) => !context.hasAnyCounterpartyAccount(target.entityId))
    : targets;
  const autoJoinResult = await context.queueAutoHubJoins(autoJoinCount, autoJoinTargets);
  const autoJoinedCount = autoJoinResult.joined;
  assertCommittedAutoJoinCount({
    requestedPerTarget: autoJoinCount,
    targetCount: autoJoinResult.requiredTargets,
    committedCount: autoJoinedCount,
  });

  const completedEntityIds = allTargets.map((target) => target.entityId);
  writeOnboardingCompleteForEntities(completedEntityIds.length > 0 ? completedEntityIds : [entityId], true);
  localStorage.setItem('xln-display-name', cleanDisplayName);

  return {
    displayName: cleanDisplayName,
    softLimitUsd: policyData.softLimitUsd,
    hardLimitUsd: policyData.hardLimitUsd,
    maxFeeUsd: policyData.maxFeeUsd,
    autoJoinHubs: savedJoinPreference,
    autoJoinedCount,
  };
}
