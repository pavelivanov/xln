import type { RuntimeInput } from '@xln/core/api/public/runtime-module';
import type { AccountRoleEvidence } from '@xln/core/account/config/dispute-config';
import { readJsonUnknown } from '../../../utils/boundary';
import { normalizeEntityId } from '../../../utils/identity/entityReplica';
import { getOpenAccountRebalancePolicyData } from '../../../utils/onboarding/onboardingPreferences';
import { hubDiscoveryJurisdictionKey } from './hub-discovery-profile';
import { buildOnboardingHubOpenRuntimeInput, selectAdvertisedAutoJoinCandidates, type OnboardingHubCandidate, type OnboardingRuntimeProjection } from './onboarding-runtime-input';
import { authenticatedHubEvidence, decodePublicHubResponse, emptyHubDiscovery, getProjectedHubDiscovery, hasProjectedCounterpartyAccount, targetJurisdictionMatches, type HubDiscovery, type OnboardingTarget } from './onboarding-hub-discovery';

export type OnboardingHubJoinContext = Readonly<{
  readProjection: () => OnboardingRuntimeProjection;
  readTokenDecimals: () => number;
  resolveApiBase: (origin: string) => string;
  submitRuntimeInput: (input: RuntimeInput) => Promise<unknown>;
}>;

// UI/client effects shared by both renderers. Getters read the current committed
// projection during discovery; neither renderer owns a second hub-join policy.
export function createOnboardingHubJoinCommands(context: OnboardingHubJoinContext) {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function fetchPublicHubDiscovery(target: OnboardingTarget): Promise<HubDiscovery> {
    if (typeof window === 'undefined') {
      return emptyHubDiscovery();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    try {
      const apiBase = context.resolveApiBase(window.location.origin);
      const url = new URL('/api/hubs', apiBase);
      url.searchParams.set('ts', String(Date.now()));
      const response = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const payload = decodePublicHubResponse(await readJsonUnknown(response));
      const advertisedHubEntityIds: string[] = [];
      const eligibleHubEntityIds: string[] = [];
      const roleEvidenceByEntityId: Record<string, AccountRoleEvidence> = {};
      for (const hub of payload.hubs) {
        const normalized = normalizeEntityId(hub.entityId);
        if (!normalized || normalized === normalizeEntityId(target.entityId)) continue;
        const jurisdiction = hub.metadata.jurisdiction?.name ?? '';
        const jurisdictionKey = hubDiscoveryJurisdictionKey(hub.metadata.jurisdiction);
        const evidence = authenticatedHubEvidence(context.readProjection(), normalized, hub.roleSource);
        const candidate: OnboardingHubCandidate = {
          entityId: hub.entityId,
          isHub: true,
          roleSource: evidence.source,
          ...(jurisdiction ? { jurisdiction } : {}),
          ...(jurisdictionKey ? { jurisdictionKey } : {}),
        };
        if (!targetJurisdictionMatches(target, candidate)) continue;
        roleEvidenceByEntityId[normalized] = evidence;
        if (!advertisedHubEntityIds.some(existing => normalizeEntityId(existing) === normalized)) {
          advertisedHubEntityIds.push(hub.entityId);
        }
        if (
          !hasProjectedCounterpartyAccount(context.readProjection(), target.entityId, hub.entityId)
          && !eligibleHubEntityIds.some(existing => normalizeEntityId(existing) === normalized)
        ) {
          eligibleHubEntityIds.push(hub.entityId);
        }
      }
      return { advertisedHubEntityIds, eligibleHubEntityIds, roleEvidenceByEntityId };
    } finally {
      clearTimeout(timer);
    }
  }

  async function queueAutoHubJoinsForTarget(
    joinCount: number,
    target: OnboardingTarget,
  ): Promise<{ joined: number; required: boolean }> {
    if (joinCount <= 0 || !target.entityId || !target.signerId) {
      return { joined: 0, required: false };
    }

    const waitForCandidates = async (): Promise<{
      required: boolean;
      hubEntityIds: string[];
      roleEvidenceByEntityId: Record<string, AccountRoleEvidence>;
    }> => {
      const timeoutMs = 3_000;
      const pollMs = 100;
      const startedAt = Date.now();
      let best: HubDiscovery = emptyHubDiscovery();
      let discoveryFailure = '';

      while (Date.now() - startedAt < timeoutMs) {
        const projected = getProjectedHubDiscovery(context.readProjection(), target);
        let publicDiscovery: HubDiscovery | null = null;
        try {
          publicDiscovery = await fetchPublicHubDiscovery(target);
          discoveryFailure = '';
        } catch (discoveryError) {
          discoveryFailure = discoveryError instanceof Error
            ? discoveryError.message
            : String(discoveryError);
        }

        const mergeIds = (...groups: string[][]): string[] =>
          Array.from(new Map(groups.flat().map(id => [normalizeEntityId(id), id])).values());
        const current: HubDiscovery = {
          advertisedHubEntityIds: mergeIds(
            projected.advertisedHubEntityIds,
            publicDiscovery?.advertisedHubEntityIds || [],
          ),
          eligibleHubEntityIds: mergeIds(
            projected.eligibleHubEntityIds,
            publicDiscovery?.eligibleHubEntityIds || [],
          ).filter((hubId) => !hasProjectedCounterpartyAccount(context.readProjection(), target.entityId, hubId)),
          roleEvidenceByEntityId: {
            ...publicDiscovery?.roleEvidenceByEntityId,
            ...projected.roleEvidenceByEntityId,
          },
        };
        best = {
          advertisedHubEntityIds: mergeIds(
            best.advertisedHubEntityIds,
            current.advertisedHubEntityIds,
          ),
          eligibleHubEntityIds: current.eligibleHubEntityIds.length > best.eligibleHubEntityIds.length
            ? current.eligibleHubEntityIds
            : best.eligibleHubEntityIds,
          roleEvidenceByEntityId: {
            ...best.roleEvidenceByEntityId,
            ...current.roleEvidenceByEntityId,
          },
        };

        // A successful public discovery with no hub for this jurisdiction is
        // authoritative availability, not an onboarding failure. The sibling
        // Entity was already created and profiled above; there is simply no
        // bilateral hub account to open yet.
        if (publicDiscovery && current.advertisedHubEntityIds.length === 0) {
          return { required: false, hubEntityIds: [], roleEvidenceByEntityId: {} };
        }
        if (current.eligibleHubEntityIds.length >= joinCount) {
          return {
            ...selectAdvertisedAutoJoinCandidates({
            requested: joinCount,
            advertisedHubEntityIds: current.advertisedHubEntityIds,
            eligibleHubEntityIds: current.eligibleHubEntityIds,
            }),
            roleEvidenceByEntityId: current.roleEvidenceByEntityId,
          };
        }
        await sleep(pollMs);
      }

      if (best.eligibleHubEntityIds.length < joinCount) {
        if (discoveryFailure) {
          throw new Error(
            `ONBOARDING_HUB_DISCOVERY_FAILED:requested=${joinCount}:found=${best.eligibleHubEntityIds.length}:cause=${discoveryFailure}`,
          );
        }
      }
      return {
        ...selectAdvertisedAutoJoinCandidates({
          requested: joinCount,
          advertisedHubEntityIds: best.advertisedHubEntityIds,
          eligibleHubEntityIds: best.eligibleHubEntityIds,
        }),
        roleEvidenceByEntityId: best.roleEvidenceByEntityId,
      };
    };

    const tokenDecimals = context.readTokenDecimals();
    const rebalancePolicy = getOpenAccountRebalancePolicyData(tokenDecimals);
    if (!rebalancePolicy) return { joined: 0, required: false };

    const selection = await waitForCandidates();
    if (!selection.required) return { joined: 0, required: false };
    const readyCandidates = selection.hubEntityIds
      .filter((hubId) => !hasProjectedCounterpartyAccount(context.readProjection(), target.entityId, hubId));

    const creditAmount = 10_000n * 10n ** BigInt(tokenDecimals);
    await context.submitRuntimeInput(buildOnboardingHubOpenRuntimeInput({
      target,
      hubEntityIds: readyCandidates,
      hubRoleEvidenceByEntityId: Object.fromEntries(readyCandidates.map((hubEntityId) => {
        const evidence = selection.roleEvidenceByEntityId[normalizeEntityId(hubEntityId)];
        if (!evidence) throw new Error(`ONBOARDING_HUB_ROLE_MISSING:${hubEntityId}`);
        return [hubEntityId, evidence];
      })),
      committedRolesByEntityId: context.readProjection().committedRolesByEntityId,
      creditAmount,
      tokenId: 1,
      rebalancePolicy,
    }));

    return { joined: readyCandidates.length, required: true };
  }

  async function queueAutoHubJoins(
    joinCount: number,
    targets: OnboardingTarget[],
  ): Promise<{ joined: number; requiredTargets: number }> {
    // Each lane owns an independent bilateral account set. Primary and cross-j
    // sibling entities must both open committed hub accounts during onboarding;
    // otherwise the UI can select a sibling that exists but cannot route.
    let joined = 0;
    let requiredTargets = 0;
    for (const target of targets) {
      const result = await queueAutoHubJoinsForTarget(joinCount, target);
      joined += result.joined;
      if (result.required) requiredTargets += 1;
    }
    return { joined, requiredTargets };
  }

  return { queueAutoHubJoins };
}
