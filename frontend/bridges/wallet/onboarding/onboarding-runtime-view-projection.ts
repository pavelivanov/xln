import type { RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import type {
  OnboardingHubCandidate,
  OnboardingRuntimeProjection,
  OnboardingRuntimeTarget,
} from '../../../packages/ui/src/onboarding/onboarding-runtime-input';
import { hubDiscoveryJurisdictionKey } from '../../../packages/ui/src/onboarding/hub-discovery-profile';

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();

const counterpartyId = (
  ownerEntityId: string,
  account: Readonly<{ state: Readonly<{ leftEntity?: unknown; rightEntity?: unknown }> }>,
): string => {
  const owner = normalize(ownerEntityId);
  const left = normalize(account.state.leftEntity);
  const right = normalize(account.state.rightEntity);
  if (left === owner) return right;
  if (right === owner) return left;
  return '';
};

export const buildOnboardingRuntimeViewProjection = (
  frame: RuntimeAdapterViewFrame,
  selectedEntityId: string,
): OnboardingRuntimeProjection => {
  const selectedId = normalize(selectedEntityId);
  const active = frame.activeEntityId === selectedId ? frame.activeEntity : null;
  const selected = frame.entities.find(entity => normalize(entity.entityId) === selectedId);
  const signerId = normalize(active?.core.signerId || selected?.signerId);
  const jurisdiction = active?.core.config.jurisdiction ?? selected?.jurisdiction;
  const jurisdictionName = String(jurisdiction?.name || '').trim();
  const jurisdictionKey = hubDiscoveryJurisdictionKey(jurisdiction);
  const role = active?.core.profile.isHub ?? selected?.isHub;
  const targets: OnboardingRuntimeTarget[] = selectedId && signerId && typeof role === 'boolean'
    ? [{
        entityId: selectedId,
        signerId,
        isHub: role,
        roleSource: 'committed-profile',
        ...(jurisdictionName ? { jurisdiction: jurisdictionName } : {}),
        ...(jurisdictionKey ? { jurisdictionKey } : {}),
      }]
    : [];
  const committedRolesByEntityId = Object.fromEntries(frame.entities.flatMap(entity => (
    typeof entity.isHub === 'boolean' ? [[normalize(entity.entityId), entity.isHub]] : []
  )));
  if (selectedId && typeof role === 'boolean') committedRolesByEntityId[selectedId] = role;
  const hubCandidates: OnboardingHubCandidate[] = frame.entities.flatMap(entity => {
    if (entity.isHub !== true) return [];
    const name = String(entity.jurisdiction?.name || '').trim();
    const key = hubDiscoveryJurisdictionKey(entity.jurisdiction);
    return [{
      entityId: normalize(entity.entityId),
      isHub: true,
      roleSource: 'committed-profile' as const,
      runtimeId: String(entity.runtimeId || ''),
      ...(name ? { jurisdiction: name } : {}),
      ...(key ? { jurisdictionKey: key } : {}),
    }];
  });
  const counterparties = active?.accounts.items
    .map(account => counterpartyId(selectedId, account))
    .filter(Boolean) ?? [];
  return {
    targets,
    suggestedDisplayName: String(active?.core.profile.name || selected?.label || ''),
    activeJurisdictionName: jurisdictionName,
    hubCandidates,
    accountCounterpartiesByEntityId: selectedId ? { [selectedId]: counterparties } : {},
    committedRolesByEntityId,
  };
};
