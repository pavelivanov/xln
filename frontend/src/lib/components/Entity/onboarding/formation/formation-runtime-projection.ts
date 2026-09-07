import type { JurisdictionConfig, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { frameReplicas, replicaProjectionEntityId, type OnboardingProjectionContext } from '../onboarding-runtime-projection';

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

const projectedJurisdiction = (value: RuntimeAdapterViewFrame['entities'][number]['jurisdiction']): FormationJurisdiction | null => {
  const name = String(value?.name || '').trim();
  const address = String(value?.address || value?.depositoryAddress || '').trim();
  const depositoryAddress = String(value?.depositoryAddress || value?.address || '').trim();
  const entityProviderAddress = String(value?.entityProviderAddress || '').trim();
  if (!name || !address || !depositoryAddress || !entityProviderAddress) return null;
  const chainId = Number(value?.chainId);
  return {
    name, address, depositoryAddress, entityProviderAddress,
    ...(Number.isSafeInteger(chainId) && chainId > 0 ? { chainId } : {}),
  };
};

export const buildFormationRuntimeViewProjection = (frame: RuntimeAdapterViewFrame): FormationRuntimeProjection => {
  const jurisdictions = new Map<string, FormationJurisdiction>();
  for (const summary of frame.entities) {
    const jurisdiction = projectedJurisdiction(summary.jurisdiction);
    if (jurisdiction) jurisdictions.set(jurisdiction.name, jurisdiction);
  }
  const active = frame.activeEntity?.core.config.jurisdiction;
  if (active?.name) jurisdictions.set(active.name, { ...active });
  return {
    jurisdictions: Array.from(jurisdictions.values()),
    existingEntityIds: frame.entities.map(entity => entity.entityId),
  };
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
