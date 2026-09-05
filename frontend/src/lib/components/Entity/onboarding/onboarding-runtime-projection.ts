import type { RuntimeReplica } from '@xln/core/api/public/runtime-module';
import type { EntityReplica } from '@xln/core/entity/types';
import type { EnvSnapshot } from '@xln/core/runtime/types';
import { hubDiscoveryJurisdictionKey } from './hub-discovery-profile';
import type { OnboardingHubCandidate, OnboardingRuntimeProjection, OnboardingRuntimeTarget } from './onboarding-runtime-input';
import type { OnboardingSigner } from './onboarding-targets';

type RuntimeFrame = RuntimeReplica | EnvSnapshot;
export type OnboardingProjectionContext = Readonly<{
  currentFrame: RuntimeFrame | null | undefined;
  selectedEntityId: string | null;
  selectedSignerId: string | null;
  selectedReplica: EntityReplica | null;
  selectedReplicaJurisdiction: string;
  activeJurisdictionName: string | null;
  runtimeSigners: readonly OnboardingSigner[];
}>;

function normalizeProjectionId(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function replicaProjectionEntityId(key: unknown, replica: EntityReplica | null | undefined): string {
  const [keyEntityId] = String(key || '').split(':');
  return normalizeProjectionId(replica?.entityId || replica?.state?.entityId || keyEntityId);
}

function replicaProjectionSignerId(key: unknown, replica: EntityReplica | null | undefined): string {
  const [, keySignerId] = String(key || '').split(':');
  return normalizeProjectionId(replica?.signerId || keySignerId);
}

function replicaProjectionJurisdictionName(replica: EntityReplica | null | undefined): string {
  return String(
    replica?.state?.config?.jurisdiction?.name
      || replica?.position?.jurisdiction
      || '',
  ).trim();
}

function replicaProjectionJurisdictionKey(replica: EntityReplica | null | undefined): string {
  return hubDiscoveryJurisdictionKey(replica?.state?.config?.jurisdiction)
    || hubDiscoveryJurisdictionKey(replica?.position?.jurisdiction);
}

export function frameReplicas(frame: RuntimeFrame | null | undefined): Map<string, EntityReplica> {
  const replicas = frame?.state.eReplicas;
  return replicas instanceof Map
    ? replicas as Map<string, EntityReplica>
    : new Map<string, EntityReplica>();
}

function accountProjectionCounterpartyId(ownerEntityId: string, key: unknown, account: unknown): string {
  const record = account as { leftEntity?: unknown; rightEntity?: unknown } | null | undefined;
  const owner = normalizeProjectionId(ownerEntityId);
  const left = normalizeProjectionId(record?.leftEntity);
  const right = normalizeProjectionId(record?.rightEntity);
  if (left === owner && right) return right;
  if (right === owner && left) return left;
  return normalizeProjectionId(key);
}

function collectProjectionCounterparties(ownerEntityId: string, replica: EntityReplica | null | undefined): string[] {
  const accounts = replica?.state?.accounts;
  if (!(accounts instanceof Map)) return [];
  const ids = new Set<string>();
  for (const [key, account] of accounts.entries()) {
    const counterpartyId = accountProjectionCounterpartyId(ownerEntityId, key, account);
    if (counterpartyId && counterpartyId !== ownerEntityId) ids.add(counterpartyId);
  }
  return Array.from(ids);
}

function findReplicaByEntityInFrame(frame: RuntimeFrame | null | undefined, entityId: string): EntityReplica | null {
  const normalized = String(entityId || '').trim().toLowerCase();
  const replicas = frame?.state.eReplicas;
  if (!normalized || !replicas) return null;
  for (const replica of replicas.values()) {
    if (String(replica?.entityId || '').trim().toLowerCase() === normalized && replica?.signerId) {
      return replica;
    }
  }
  return null;
}

function getReplicaJurisdiction(replica: EntityReplica | null | undefined): string {
  return String(replica?.state?.config?.jurisdiction?.name || '').trim().toLowerCase();
}

function findReplicaBySigner(
  env: RuntimeFrame | null | undefined,
  signerId: string,
  jurisdictionName?: string | null,
): EntityReplica | null {
  const reps = env?.state.eReplicas;
  if (!reps) return null;
  const replicas = reps instanceof Map ? reps : new Map<string, EntityReplica>(Object.entries(reps || {}) as Array<[string, EntityReplica]>);
  const signerLower = signerId.toLowerCase();
  const jurisdictionLower = String(jurisdictionName || '').trim().toLowerCase();
  for (const [key, replica] of replicas) {
    const [, signerFromKey] = String(key).split(':');
    const replicaSigner = String(replica?.signerId || signerFromKey || '').toLowerCase();
    if (replicaSigner === signerLower && (!jurisdictionLower || getReplicaJurisdiction(replica) === jurisdictionLower)) {
      return replica;
    }
  }
  return null;
}

// This is the retained wallet projection, shared by React and Svelte. Only
// an exact committed profile role makes a target eligible for account setup.
export function buildOnboardingRuntimeProjection(context: OnboardingProjectionContext): OnboardingRuntimeProjection {
  const { currentFrame, selectedEntityId, selectedSignerId, selectedReplica,
    selectedReplicaJurisdiction, activeJurisdictionName, runtimeSigners } = context;
  const replicas = frameReplicas(currentFrame);
  const targets: OnboardingRuntimeTarget[] = [];
  const targetKeys = new Set<string>();
  const accountCounterpartiesByEntityId: Record<string, string[]> = {};
  const committedRolesByEntityId: Record<string, boolean> = {};
  const addTarget = (
    rawEntityId: unknown,
    rawSignerId: unknown,
    isHub: unknown,
    rawJurisdiction: unknown = '',
    rawJurisdictionKey: unknown = '',
  ): void => {
    const entityId = normalizeProjectionId(rawEntityId);
    const signerId = normalizeProjectionId(rawSignerId);
    // Account dispute clocks are signed financial state. An absent profile
    // role is not evidence that the Entity is a user: coercing `undefined`
    // to false would permanently bind the 24h user default while a Hub
    // profile is still in flight. Keep the target unavailable until the
    // committed profile supplies an exact boolean role.
    if (!entityId || !signerId || typeof isHub !== 'boolean') return;
    const key = `${entityId}:${signerId}`;
    if (targetKeys.has(key)) return;
    targetKeys.add(key);
    const jurisdiction = String(rawJurisdiction || '').trim();
    const jurisdictionKey = String(rawJurisdictionKey || '').trim();
    targets.push({
      entityId,
      signerId,
      isHub,
      roleSource: 'committed-profile',
      ...(jurisdiction ? { jurisdiction } : {}),
      ...(jurisdictionKey ? { jurisdictionKey } : {}),
    });
  };

  for (const [key, replica] of replicas.entries()) {
    const entityId = replicaProjectionEntityId(key, replica);
    const signerId = replicaProjectionSignerId(key, replica);
    if (!entityId) continue;
    accountCounterpartiesByEntityId[entityId] = collectProjectionCounterparties(entityId, replica);
    const committedRole = replica?.state?.profile?.isHub;
    if (typeof committedRole === 'boolean') committedRolesByEntityId[entityId] = committedRole;
    addTarget(
      entityId,
      signerId,
      committedRole,
      replicaProjectionJurisdictionName(replica),
      replicaProjectionJurisdictionKey(replica),
    );
  }

  if (selectedReplica) {
    addTarget(
      selectedEntityId,
      selectedSignerId,
      selectedReplica.state.profile?.isHub,
      selectedReplicaJurisdiction,
      replicaProjectionJurisdictionKey(selectedReplica),
    );
  }

  for (const runtimeSigner of runtimeSigners) {
    const signerEntityId = normalizeProjectionId(runtimeSigner.entityId);
    const signerAddress = normalizeProjectionId(runtimeSigner.address);
    const matchingReplica = signerEntityId
      ? findReplicaByEntityInFrame(currentFrame, signerEntityId)
      : signerAddress
        ? findReplicaBySigner(currentFrame, signerAddress, runtimeSigner.jurisdiction)
        : null;
    if (matchingReplica) {
      addTarget(
        signerEntityId || matchingReplica.entityId,
        signerAddress || matchingReplica.signerId,
        matchingReplica.state.profile?.isHub,
        runtimeSigner.jurisdiction || replicaProjectionJurisdictionName(matchingReplica),
        replicaProjectionJurisdictionKey(matchingReplica),
      );
    }
  }

  const hubCandidates: OnboardingHubCandidate[] = [];
  const hubIds = new Set<string>();
  for (const [key, replica] of replicas.entries()) {
    const state = replica?.state;
    if (state?.profile?.isHub !== true) continue;
    const entityId = replicaProjectionEntityId(key, replica);
    if (!entityId || hubIds.has(entityId)) continue;
    hubIds.add(entityId);
    hubCandidates.push({
      entityId,
      isHub: true,
      roleSource: 'committed-profile',
      jurisdiction: replicaProjectionJurisdictionName(replica),
      jurisdictionKey: replicaProjectionJurisdictionKey(replica),
      runtimeId: String(currentFrame?.runtimeId || ''),
    });
  }

  return {
    targets,
    suggestedDisplayName: String(selectedReplica?.state?.profile?.name || ''),
    activeJurisdictionName: activeJurisdictionName || selectedReplicaJurisdiction,
    hubCandidates,
    accountCounterpartiesByEntityId,
    committedRolesByEntityId,
  };
}
