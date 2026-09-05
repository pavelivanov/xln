import type { JurisdictionConfig } from '@xln/core/api/public/runtime-module';
import { frameReplicas, replicaProjectionEntityId, type OnboardingProjectionContext } from './onboarding-runtime-projection';

export type FormationJurisdiction = JurisdictionConfig & {
  chainId?: number;
};

export type FormationRuntimeProjection = {
  jurisdictions: FormationJurisdiction[];
  existingEntityIds: string[];
};

export const emptyFormationRuntimeProjection = (): FormationRuntimeProjection => ({
  jurisdictions: [],
  existingEntityIds: [],
});

export const buildFormationRuntimeProjection = (currentFrame: OnboardingProjectionContext['currentFrame']): FormationRuntimeProjection => {
  const jurisdictions = Array.from(currentFrame?.state.jReplicas?.values?.() || []).map(replica => ({
    name: String(replica?.name || ''),
    address: String(replica?.contracts?.depository || ''),
    entityProviderAddress: String(replica?.contracts?.entityProvider || ''),
    depositoryAddress: String(replica?.contracts?.depository || ''),
    ...(typeof replica?.chainId === 'number' ? { chainId: replica.chainId } : {}),
  }));
  const existingEntityIds = new Set<string>();
  for (const [key, replica] of frameReplicas(currentFrame).entries()) {
    const entityId = replicaProjectionEntityId(key, replica);
    if (entityId) existingEntityIds.add(entityId);
  }
  return { jurisdictions, existingEntityIds: Array.from(existingEntityIds) };
};

export const hasProjectedEntityId = (
  projection: FormationRuntimeProjection,
  entityId: string,
): boolean => {
  const normalized = String(entityId || '').trim().toLowerCase();
  return Boolean(normalized && projection.existingEntityIds.some((candidate) =>
    String(candidate || '').trim().toLowerCase() === normalized
  ));
};
