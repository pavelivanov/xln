import type { AccountRoleEvidence, AccountRoleEvidenceSource } from '@xln/core/account/config/dispute-config';
import { rejectExtraKeys, requireFiniteNumber, requireString, requireUnknownRecord } from '../../../utils/boundary';
import { normalizeEntityId } from '../../../utils/identity/entityReplica';
import { hubDiscoveryJurisdictionKey } from './hub-discovery-profile';
import type { OnboardingHubCandidate, OnboardingRuntimeProjection, OnboardingRuntimeTarget } from './onboarding-runtime-input';

export type OnboardingTarget = OnboardingRuntimeTarget & { jurisdiction: string };

export type PublicHubResponse = {
  ok: true;
  count: number;
  serverTime: number;
  hubs: Array<{
    entityId: string;
    roleSource: AccountRoleEvidenceSource;
    metadata: {
      isHub: true;
      jurisdiction?: { name: string; chainId?: number; depositoryAddress?: string; entityProviderAddress?: string };
    };
  }>;
};

export const decodePublicHubResponse = (value: unknown): PublicHubResponse => {
  const record = requireUnknownRecord(value, 'PUBLIC_HUB_RESPONSE_INVALID');
  rejectExtraKeys(record, ['ok', 'count', 'serverTime', 'hubs'], 'PUBLIC_HUB_RESPONSE_EXTRA_FIELD');
  if (record['ok'] !== true || !Array.isArray(record['hubs'])) throw new Error('PUBLIC_HUB_RESPONSE_SHAPE_INVALID');
  const hubs = record['hubs'].map((value) => {
    const hub = requireUnknownRecord(value, 'PUBLIC_HUB_INVALID');
    rejectExtraKeys(hub, ['entityId', 'runtimeId', 'name', 'bio', 'website', 'wsUrl', 'publicAccounts', 'metadata', 'lastUpdated', 'online', 'roleSource'], 'PUBLIC_HUB_EXTRA_FIELD');
    const metadata = requireUnknownRecord(hub['metadata'], 'PUBLIC_HUB_METADATA_INVALID');
    rejectExtraKeys(metadata, ['isHub', 'jurisdiction'], 'PUBLIC_HUB_METADATA_EXTRA_FIELD');
    if (metadata['isHub'] !== true || (hub['roleSource'] !== 'operator-config' && hub['roleSource'] !== 'verified-gossip-profile')) throw new Error('PUBLIC_HUB_AUTHORITY_INVALID');
    const rawJurisdiction = metadata['jurisdiction'];
    let jurisdiction: PublicHubResponse['hubs'][number]['metadata']['jurisdiction'];
    if (rawJurisdiction !== undefined) {
      const item = requireUnknownRecord(rawJurisdiction, 'PUBLIC_HUB_JURISDICTION_INVALID');
      rejectExtraKeys(item, ['name', 'chainId', 'depositoryAddress', 'entityProviderAddress'], 'PUBLIC_HUB_JURISDICTION_EXTRA_FIELD');
      jurisdiction = {
        name: requireString(item['name'], 'PUBLIC_HUB_JURISDICTION_NAME_INVALID'),
        ...(item['chainId'] === undefined ? {} : { chainId: requireFiniteNumber(item['chainId'], 'PUBLIC_HUB_JURISDICTION_CHAIN_ID_INVALID') }),
        ...(item['depositoryAddress'] === undefined ? {} : { depositoryAddress: requireString(item['depositoryAddress'], 'PUBLIC_HUB_JURISDICTION_DEPOSITORY_INVALID') }),
        ...(item['entityProviderAddress'] === undefined ? {} : { entityProviderAddress: requireString(item['entityProviderAddress'], 'PUBLIC_HUB_JURISDICTION_PROVIDER_INVALID') }),
      };
    }
    const decoded: PublicHubResponse['hubs'][number] = {
      entityId: requireString(hub['entityId'], 'PUBLIC_HUB_ENTITY_ID_INVALID'),
      roleSource: hub['roleSource'] === 'operator-config' ? 'operator-config' : 'verified-gossip-profile',
      metadata: { isHub: true, ...(jurisdiction === undefined ? {} : { jurisdiction }) },
    };
    return decoded;
  });
  return { ok: true, count: requireFiniteNumber(record['count'], 'PUBLIC_HUB_COUNT_INVALID'), serverTime: requireFiniteNumber(record['serverTime'], 'PUBLIC_HUB_SERVER_TIME_INVALID'), hubs };
};

export function targetJurisdictionMatches(target: OnboardingTarget, candidate: OnboardingHubCandidate): boolean {
  const targetKey = String(target.jurisdictionKey || '').trim();
  const candidateKey = String(candidate.jurisdictionKey || hubDiscoveryJurisdictionKey(candidate.jurisdiction)).trim();
  if (targetKey && candidateKey) return targetKey === candidateKey;
  const targetName = String(target.jurisdiction || '').trim().toLowerCase();
  const candidateName = String(candidate.jurisdiction || '').trim().toLowerCase();
  return Boolean(targetName && candidateName && targetName === candidateName);
}

export function hasProjectedCounterpartyAccount(runtimeProjection: OnboardingRuntimeProjection, targetEntityId: string, counterpartyEntityId: string): boolean {
  const normalizedEntityId = normalizeEntityId(targetEntityId);
  const normalizedCounterpartyId = normalizeEntityId(counterpartyEntityId);
  if (!normalizedEntityId || !normalizedCounterpartyId) return false;
  return (runtimeProjection.accountCounterpartiesByEntityId[normalizedEntityId] || [])
    .some((candidate) => normalizeEntityId(candidate) === normalizedCounterpartyId);
}

export type HubDiscovery = {
  advertisedHubEntityIds: string[];
  eligibleHubEntityIds: string[];
  roleEvidenceByEntityId: Record<string, AccountRoleEvidence>;
};

export const emptyHubDiscovery = (): HubDiscovery => ({
  advertisedHubEntityIds: [],
  eligibleHubEntityIds: [],
  roleEvidenceByEntityId: {},
});

export function authenticatedHubEvidence(
  runtimeProjection: OnboardingRuntimeProjection,
  entityId: string,
  source: AccountRoleEvidenceSource | undefined,
): AccountRoleEvidence {
  const normalized = normalizeEntityId(entityId);
  const committed = runtimeProjection.committedRolesByEntityId[normalized];
  if (typeof committed === 'boolean') {
    if (!committed) throw new Error(`ONBOARDING_HUB_COMMITTED_ROLE_CONFLICT:${normalized}`);
    return { entityId: normalized, isHub: true, source: 'committed-profile' };
  }
  if (source !== 'verified-gossip-profile' && source !== 'operator-config') {
    throw new Error(`ONBOARDING_HUB_ROLE_SOURCE_INVALID:${normalized}:${String(source)}`);
  }
  return { entityId: normalized, isHub: true, source };
}

export function getProjectedHubDiscovery(runtimeProjection: OnboardingRuntimeProjection, target: OnboardingTarget): HubDiscovery {
  const advertisedHubEntityIds: string[] = [];
  const eligibleHubEntityIds: string[] = [];
  const roleEvidenceByEntityId: Record<string, AccountRoleEvidence> = {};
  const add = (value: unknown, source: AccountRoleEvidenceSource | undefined) => {
    const id = String(value || '').trim();
    if (!id) return;
    if (normalizeEntityId(id) === normalizeEntityId(target.entityId)) return;
    const normalized = normalizeEntityId(id);
    roleEvidenceByEntityId[normalized] = authenticatedHubEvidence(runtimeProjection, normalized, source);
    if (!advertisedHubEntityIds.some(existing => normalizeEntityId(existing) === normalizeEntityId(id))) {
      advertisedHubEntityIds.push(id);
    }
    if (
      !hasProjectedCounterpartyAccount(runtimeProjection, target.entityId, id)
      && !eligibleHubEntityIds.some(existing => normalizeEntityId(existing) === normalizeEntityId(id))
    ) {
      eligibleHubEntityIds.push(id);
    }
  };

  for (const candidate of runtimeProjection.hubCandidates || []) {
    if (candidate.isHub !== true) continue;
    if (!targetJurisdictionMatches(target, candidate)) continue;
    add(candidate.entityId, candidate.roleSource);
  }

  return { advertisedHubEntityIds, eligibleHubEntityIds, roleEvidenceByEntityId };
}
