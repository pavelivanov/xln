import type { HubJoinPreference, SavedCollateralPolicy } from '../../../src/lib/utils/onboarding/onboardingPreferences';
import type { OnboardingSetupDraft } from '../../../src/lib/components/Entity/onboarding/onboarding-setup';
import type { WalletRecoveryServicesMutation } from './wallet-recovery-services';

export type WalletOnboardingJurisdiction = Readonly<{
  key: string;
  name: string;
  entityId: string;
  signerId: string;
}>;

export type WalletOnboardingReadyView = Readonly<{
  state: 'ready';
  runtimeId: string;
  entityId: string;
  displayName: string;
  activeJurisdictionName: string;
  policy: SavedCollateralPolicy;
  autoJoinHubs: HubJoinPreference;
  jurisdictions: readonly WalletOnboardingJurisdiction[];
  writable: boolean;
  blockedReason: string;
}>;

export type WalletOnboardingView = WalletOnboardingReadyView | Readonly<{
  state: 'waiting';
  reason: string;
}> | Readonly<{
  state: 'complete';
  runtimeId: string;
}>;

export type WalletOnboardingRequest = Readonly<{
  runtimeId: string;
  draft: OnboardingSetupDraft;
  termsAccepted: boolean;
  selectedJurisdictions: Readonly<Record<string, boolean>>;
  recovery: WalletRecoveryServicesMutation;
}>;

export type WalletOnboardingResult = Readonly<{
  displayName: string;
  autoJoinedCount: number;
}>;
