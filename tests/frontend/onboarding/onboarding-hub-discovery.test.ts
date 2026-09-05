import { expect, test } from 'bun:test';
import {
  authenticatedHubEvidence,
  decodePublicHubResponse,
  getProjectedHubDiscovery,
  targetJurisdictionMatches,
  type OnboardingTarget,
} from '../../../frontend/src/lib/components/Entity/onboarding/onboarding-hub-discovery';
import { emptyOnboardingRuntimeProjection } from '../../../frontend/src/lib/components/Entity/onboarding/onboarding-runtime-input';
import { hasAnyOnboardingCounterpartyAccount, resolveOnboardingTargets } from '../../../frontend/src/lib/components/Entity/onboarding/onboarding-targets';

const entityId = `0x${'11'.repeat(32)}`;
const signerId = `0x${'22'.repeat(20)}`;
const hubId = `0x${'33'.repeat(32)}`;
const target: OnboardingTarget = {
  entityId, signerId, isHub: false, roleSource: 'committed-profile',
  jurisdiction: 'Testnet', jurisdictionKey: 'chain:1:depository:a',
};

test('public discovery requires authenticated hub metadata and rejects unrecognized fields', () => {
  const hub = { entityId: hubId, roleSource: 'operator-config', metadata: {
    isHub: true, jurisdiction: { name: 'Testnet', chainId: 1, depositoryAddress: '0xa' },
  } };
  const response = { ok: true, count: 1, serverTime: 1, hubs: [hub] };
  expect(decodePublicHubResponse(response).hubs).toEqual([hub]);
  expect(() => decodePublicHubResponse({ ...response, hubs: [{ ...hub, roleSource: 'committed-profile' }] }))
    .toThrow('PUBLIC_HUB_AUTHORITY_INVALID');
  expect(() => decodePublicHubResponse({ ...response, hubs: [{ ...hub, metadata: { isHub: false } }] }))
    .toThrow('PUBLIC_HUB_AUTHORITY_INVALID');
  expect(() => decodePublicHubResponse({ ...response, hubs: [{ ...hub, approved: true }] }))
    .toThrow('PUBLIC_HUB_EXTRA_FIELD');
});

test('committed user role overrides stale hub advertisements from either discovery source', () => {
  const projection = { ...emptyOnboardingRuntimeProjection(), committedRolesByEntityId: { [hubId]: false } };
  expect(() => authenticatedHubEvidence(projection, hubId, 'operator-config'))
    .toThrow(`ONBOARDING_HUB_COMMITTED_ROLE_CONFLICT:${hubId}`);
  expect(() => authenticatedHubEvidence(projection, hubId, 'verified-gossip-profile'))
    .toThrow(`ONBOARDING_HUB_COMMITTED_ROLE_CONFLICT:${hubId}`);
  expect(() => authenticatedHubEvidence(emptyOnboardingRuntimeProjection(), hubId, 'committed-profile'))
    .toThrow('ONBOARDING_HUB_ROLE_SOURCE_INVALID');
  expect(authenticatedHubEvidence({ ...projection, committedRolesByEntityId: { [hubId]: true } }, hubId, undefined))
    .toEqual({ entityId: hubId, isHub: true, source: 'committed-profile' });
});

test('matching jurisdiction keys take precedence over names and mismatched keys reject a hub', () => {
  expect(targetJurisdictionMatches(target, { entityId: hubId, jurisdiction: 'Different label', jurisdictionKey: target.jurisdictionKey })).toBe(true);
  expect(targetJurisdictionMatches(target, { entityId: hubId, jurisdiction: 'Testnet', jurisdictionKey: 'chain:1:depository:b' })).toBe(false);
  expect(targetJurisdictionMatches({ ...target, jurisdictionKey: '' }, { entityId: hubId, jurisdiction: ' TESTNET ' })).toBe(true);
});

test('projected discovery excludes self, wrong jurisdiction and existing accounts without losing advertised availability', () => {
  const candidate = { entityId: hubId, isHub: true, roleSource: 'committed-profile' as const, jurisdictionKey: target.jurisdictionKey };
  const projection = {
    ...emptyOnboardingRuntimeProjection(),
    committedRolesByEntityId: { [hubId]: true },
    hubCandidates: [candidate, { ...candidate, entityId: hubId.toUpperCase() },
      { ...candidate, entityId }, { ...candidate, entityId: 'other', jurisdictionKey: 'other' }],
    accountCounterpartiesByEntityId: { [entityId]: [hubId.toUpperCase()] },
  };
  const discovery = getProjectedHubDiscovery(projection, target);
  expect(discovery.advertisedHubEntityIds).toEqual([hubId]);
  expect(discovery.eligibleHubEntityIds).toEqual([]);
  expect(discovery.roleEvidenceByEntityId[hubId]).toEqual({ entityId: hubId, isHub: true, source: 'committed-profile' });
  expect(getProjectedHubDiscovery({ ...projection, accountCounterpartiesByEntityId: {} }, target).eligibleHubEntityIds).toEqual([hubId]);
});

test('target resolution keeps committed role and signer lanes while filling only jurisdiction labels', () => {
  const projection = { ...emptyOnboardingRuntimeProjection(), targets: [
    { ...target, jurisdiction: '', entityId: entityId.toUpperCase() }, target,
    { ...target, signerId: hubId, jurisdiction: 'Tron' },
  ] };
  const resolved = resolveOnboardingTargets(projection, [{ entityId, address: signerId, jurisdiction: 'Testnet' }]);
  expect(resolved).toEqual([target, { ...target, signerId: hubId, jurisdiction: 'Tron' }]);
  expect(hasAnyOnboardingCounterpartyAccount({ ...projection, accountCounterpartiesByEntityId: { [entityId]: [hubId] } }, entityId.toUpperCase())).toBe(true);
});
