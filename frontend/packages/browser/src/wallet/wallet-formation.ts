import type { FormationDraft, FormationResult } from '../../../../bridges/wallet/formation-commands';
import type { FormationRuntimeProjection } from '../../../../bridges/wallet/formation-runtime-projection';

export type WalletFormationView =
  | Readonly<{ state: 'unavailable'; message: string }>
  | Readonly<{ state: 'ready'; runtimeId: string; signerId: string; projection: FormationRuntimeProjection; blockedReason: string }>;
export type WalletFormationRequest = Readonly<{ runtimeId: string; signerId: string; draft: FormationDraft }>;
export type WalletFormationResult = FormationResult;
