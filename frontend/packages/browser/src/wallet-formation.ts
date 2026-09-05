import type { FormationDraft, FormationResult } from '../../../src/lib/components/Entity/onboarding/formation-commands';
import type { FormationRuntimeProjection } from '../../../src/lib/components/Entity/onboarding/formation-runtime-projection';

export type WalletFormationView =
  | Readonly<{ state: 'unavailable'; message: string }>
  | Readonly<{ state: 'ready'; runtimeId: string; signerId: string; projection: FormationRuntimeProjection; blockedReason: string }>;
export type WalletFormationRequest = Readonly<{ runtimeId: string; signerId: string; draft: FormationDraft }>;
export type WalletFormationResult = FormationResult;
