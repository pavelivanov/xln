import type { RuntimeInput, RuntimeReplica } from '@xln/core/api/public/runtime-module';
import { getOpenAccountRebalancePolicyData } from '../../../utils/onboarding/onboardingPreferences';
import { requireSignerIdForEntity } from '../../../utils/identity/entityReplica';
import {
  buildHubOpenAccountRuntimeInput, ensureHubOpenAccountProfileReady,
  hubDiscoveryJurisdictionKey, normalizeHubEntityId, type HubDiscoveryProjection,
} from './hub-discovery-profile';

export type HubDiscoveryCommandContext = Readonly<{
  entityId: string;
  env: RuntimeReplica | null;
  projection: HubDiscoveryProjection;
  canOpenAccounts: boolean;
  permissionError: string;
}>;

export type HubDiscoveryCommandDependencies = Readonly<{
  readContext: () => HubDiscoveryCommandContext | Promise<HubDiscoveryCommandContext>;
  readTokenDecimals: () => number;
  submitRuntimeInput: (input: RuntimeInput) => Promise<unknown> | unknown;
}>;

const requireHub = (context: HubDiscoveryCommandContext, hubId: string) => {
  const hub = context.projection.localHubs.find(candidate => normalizeHubEntityId(candidate.entityId) === hubId);
  if (!hub || hub.metadata.isHub !== true) throw new Error(`ACCOUNT_DISPUTE_PARTY_ROLE_UNAVAILABLE:${context.entityId}:${hubId}`);
  if (!context.canOpenAccounts) throw new Error(context.permissionError || 'Open Account is not available');
  const jurisdiction = context.projection.entityJurisdictionKey;
  if (!jurisdiction) throw new Error('Entity jurisdiction is still loading');
  if (hubDiscoveryJurisdictionKey(hub.metadata.jurisdiction) !== jurisdiction) throw new Error('Hub belongs to a different or unknown jurisdiction');
  return hub;
};

const signerFor = (context: HubDiscoveryCommandContext): string => {
  const signerId = context.projection.sourceSignerId || (context.env ? requireSignerIdForEntity(context.env, context.entityId, 'hub-connect') : '');
  if (!signerId) throw new Error('No signer available for hub account setup');
  return signerId;
};

// Retained HubDiscoveryPanel command sequence. Re-read after profile discovery:
// a removed Hub card or changed Runtime/Entity must not sign the old role clocks.
export const connectDiscoveredHub = async (selectedHubId: string, deps: HubDiscoveryCommandDependencies): Promise<void> => {
  const initial = await deps.readContext();
  if (!initial.entityId) throw new Error('Select an entity to discover counterparties');
  const hubId = normalizeHubEntityId(selectedHubId);
  const hub = requireHub(initial, hubId);
  const initialSigner = signerFor(initial);
  const connection = initial.projection.connectionByHubId.get(hubId);
  if (connection?.isConnected || connection?.isOpening) return;
  await ensureHubOpenAccountProfileReady({ env: initial.env, sourceEntityId: initial.entityId, hub, timeoutMs: 5_000 });
  const current = await deps.readContext();
  if (current.projection.discoveryKey !== initial.projection.discoveryKey || signerFor(current) !== initialSigner) throw new Error('HUB_DISCOVERY_CONTEXT_CHANGED');
  const currentHub = requireHub(current, hubId);
  const currentConnection = current.projection.connectionByHubId.get(hubId);
  if (currentConnection?.isConnected || currentConnection?.isOpening) return;
  const sourceEntityId = normalizeHubEntityId(current.entityId);
  const sourceIsHub = current.projection.committedRoles.get(sourceEntityId);
  if (typeof sourceIsHub !== 'boolean') throw new Error(`ACCOUNT_DISPUTE_PARTY_ROLE_UNAVAILABLE:${sourceEntityId}:${hubId}`);
  const decimals = deps.readTokenDecimals();
  await deps.submitRuntimeInput(buildHubOpenAccountRuntimeInput({
    sourceEntityId, signerId: initialSigner, hubEntityId: currentHub.entityId,
    sourceRoleEvidence: { entityId: sourceEntityId, isHub: sourceIsHub, source: 'committed-profile' },
    hubRoleEvidence: { entityId: hubId, isHub: true, source: currentHub.roleSource },
    committedRoles: current.projection.committedRoles,
    creditAmount: 10_000n * 10n ** BigInt(decimals), tokenId: 1,
    rebalancePolicy: getOpenAccountRebalancePolicyData(decimals),
  }));
};
