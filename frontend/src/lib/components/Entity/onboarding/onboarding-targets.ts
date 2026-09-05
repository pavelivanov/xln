import { normalizeEntityId } from '../../../utils/identity/entityReplica';
import type { OnboardingRuntimeProjection } from './onboarding-runtime-input';
import type { OnboardingTarget } from './onboarding-hub-discovery';

export type OnboardingSigner = Readonly<{ entityId?: string; address: string; jurisdiction?: string }>;

export function resolveOnboardingTargets(runtimeProjection: OnboardingRuntimeProjection, runtimeSigners: readonly OnboardingSigner[]): OnboardingTarget[] {
  const targets: OnboardingTarget[] = [];
  const seen = new Set<string>();
  const add = (
    rawEntityId: unknown,
    rawSignerId: unknown,
    isHub: boolean,
    rawJurisdiction: unknown = '',
    rawJurisdictionKey: unknown = '',
  ) => {
    const nextEntityId = normalizeEntityId(String(rawEntityId || ''));
    const nextSignerId = String(rawSignerId || '').trim().toLowerCase();
    if (!nextEntityId || !nextSignerId) return;
    const key = `${nextEntityId}:${nextSignerId}`;
    if (seen.has(key)) return;
    const runtimeSigner = runtimeSigners.find((signer) =>
      normalizeEntityId(signer.entityId || '') === nextEntityId
      || String(signer.address || '').trim().toLowerCase() === nextSignerId
    );
    const jurisdiction = String(rawJurisdiction || runtimeSigner?.jurisdiction || 'Primary').trim() || 'Primary';
    const jurisdictionKey = String(rawJurisdictionKey || '').trim();
    const target = {
      entityId: nextEntityId,
      signerId: nextSignerId,
      isHub,
      roleSource: 'committed-profile' as const,
      jurisdiction,
      ...(jurisdictionKey ? { jurisdictionKey } : {}),
    };
    seen.add(key);
    targets.push(target);
  };

  for (const target of runtimeProjection.targets || []) {
    add(target.entityId, target.signerId, target.isHub, target.jurisdiction, target.jurisdictionKey);
  }
  return targets;
}

export function hasAnyOnboardingCounterpartyAccount(runtimeProjection: OnboardingRuntimeProjection, targetEntityId: string): boolean {
  const normalizedEntityId = normalizeEntityId(targetEntityId);
  if (!normalizedEntityId) return false;
  return (runtimeProjection.accountCounterpartiesByEntityId[normalizedEntityId] || []).length > 0;
}
