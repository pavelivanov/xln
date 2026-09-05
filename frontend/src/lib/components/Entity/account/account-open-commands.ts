import type { RuntimeInput, RuntimeReplica } from '@xln/core/api/public/runtime-module';
import { getOpenAccountRebalancePolicyData } from '../../../utils/onboarding/onboardingPreferences';
import { prewarmCounterpartyProfiles } from '../../../utils/runtime/p2pPrefetch';
import { isFullEntityId } from '../workspace/entity-panel-options';
import { buildDirectOpenAccountRuntimeInput } from '../onboarding/hub-discovery-profile';

export type DirectAccountOpenContext = Readonly<{
  runtimeId: string;
  entityId: string;
  signerId: string;
  env: RuntimeReplica | null;
  canOpenAccounts: boolean;
  permissionError: string;
  activeIsLive: boolean;
  sameJurisdiction: boolean;
  hasAccount: boolean;
  sourceIsHub: boolean | undefined;
  targetIsHub: boolean | undefined;
}>;

export type DirectAccountOpenDependencies = Readonly<{
  readContext: (targetEntityId: string) => DirectAccountOpenContext | Promise<DirectAccountOpenContext>;
  readTokenDecimals: () => number;
  submitRuntimeInput: (input: RuntimeInput) => Promise<unknown> | unknown;
}>;

function validateContext(context: DirectAccountOpenContext, target: string): void {
  if (!context.canOpenAccounts) throw new Error(context.permissionError || 'Open account requires admin runtime access');
  if (!context.entityId) throw new Error('Active entity missing for open-account');
  if (!context.signerId) throw new Error('Active signer missing for open-account');
  if (!isFullEntityId(target)) throw new Error('Full entity ID required (0x + 64 hex chars)');
  if (target === context.entityId.toLowerCase()) throw new Error('Cannot open account with yourself');
  if (!context.sameJurisdiction) throw new Error('Accounts can only be opened inside the same jurisdiction');
}

// Retained EntityPanelTabs sequence. A discovery label cannot supply either
// party's signed dispute clock. Both roles must come from committed profiles.
export async function openAccountById(targetEntityId: string, dependencies: DirectAccountOpenDependencies): Promise<'submitted' | 'already-open'> {
  const target = targetEntityId.trim().toLowerCase();
  const initial = await dependencies.readContext(target);
  validateContext(initial, target);
  if (initial.hasAccount) return 'already-open';
  if (!initial.activeIsLive) throw new Error('Open account requires LIVE mode');
  const rebalancePolicy = getOpenAccountRebalancePolicyData(dependencies.readTokenDecimals());
  if (initial.env) await prewarmCounterpartyProfiles(initial.env, [target]);
  const current = await dependencies.readContext(target);
  if (current.runtimeId !== initial.runtimeId || current.entityId !== initial.entityId || current.signerId !== initial.signerId) {
    throw new Error('OPEN_ACCOUNT_CONTEXT_CHANGED');
  }
  validateContext(current, target);
  if (current.hasAccount) return 'already-open';
  if (!current.activeIsLive) throw new Error('Open account requires LIVE mode');
  const { entityId, signerId, sourceIsHub, targetIsHub } = current;
  if (typeof sourceIsHub !== 'boolean' || typeof targetIsHub !== 'boolean') {
    throw new Error(`ACCOUNT_DISPUTE_PARTY_ROLE_UNAVAILABLE:${entityId}:${target}`);
  }
  await dependencies.submitRuntimeInput(buildDirectOpenAccountRuntimeInput({
    sourceEntityId: entityId, signerId, targetEntityId: target,
    sourceRoleEvidence: { entityId, isHub: sourceIsHub, source: 'committed-profile' },
    targetRoleEvidence: { entityId: target, isHub: targetIsHub, source: 'committed-profile' },
    committedRoles: new Map([[entityId.toLowerCase(), sourceIsHub], [target, targetIsHub]]),
    rebalancePolicy,
  }));
  return 'submitted';
}
