import type { WalletOnboardingRequest, WalletOnboardingResult } from '../../../packages/browser/src/wallet-onboarding';

export const loadWalletOnboarding = () => import('../../../bridges/wallet-canonical-onboarding');

export const finishWalletOnboarding = async (
  request: WalletOnboardingRequest,
  signal: AbortSignal,
): Promise<WalletOnboardingResult> => {
  const canonical = await loadWalletOnboarding();
  return canonical.finishCanonicalWalletOnboarding(request, signal);
};
