import { beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { RuntimeAdapterViewFrame } from '../../../../core/api/runtime-adapter/resolve';
import { finishOnboardingSetup } from '../../../../frontend/packages/browser/src/onboarding/onboarding-setup';
import {
  clearWalletLocalLauncherOnboarding,
  getWalletLocalLauncherOnboarding,
  readWalletLocalLauncherRequest,
  setWalletLocalLauncherOnboarding,
  stripWalletLocalLauncherHash,
} from '../../../../frontend/packages/browser/src/runtime/wallet-local-launcher';
import { buildOnboardingRuntimeViewProjection } from '../../../../frontend/bridges/wallet/onboarding/onboarding-runtime-view-projection';
import { activateCanonicalWalletPairedRuntime } from '../../../../frontend/bridges/wallet/onboarding/wallet-canonical-runtime-bootstrap';

const ENTITY = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const SIGNER = `0x${'33'.repeat(20)}`;
const RUNTIME = `0x${'44'.repeat(20)}`;

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
};

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: createMemoryStorage(),
  });
  clearWalletLocalLauncherOnboarding();
});

test('local launcher validates exact create and formation projections', () => {
  expect(readWalletLocalLauncherRequest('#xlnPair=once&xlnOnboarding=create')).toEqual({
    pairingToken: 'once', stage: 'create', entityId: '',
  });
  expect(readWalletLocalLauncherRequest(`#xlnPair=once&xlnOnboarding=formation&xlnEntity=${ENTITY.toUpperCase()}`)).toEqual({
    pairingToken: 'once', stage: 'formation', entityId: ENTITY,
  });
  expect(() => readWalletLocalLauncherRequest('#xlnPair=once&xlnOnboarding=formation'))
    .toThrow('LOCAL_LAUNCHER_ENTITY_ID_MISSING');
  expect(() => readWalletLocalLauncherRequest(`#xlnPair=once&xlnEntity=${ENTITY}`))
    .toThrow('LOCAL_LAUNCHER_ENTITY_WITHOUT_FORMATION');
  expect(stripWalletLocalLauncherHash('#xlnPair=secret&xlnOnboarding=create&retained=1'))
    .toBe('#retained=1');
});

test('local launcher custody projection is in-memory and explicit', () => {
  setWalletLocalLauncherOnboarding({ stage: 'formation', entityId: ENTITY, runtimeId: RUNTIME });
  expect(getWalletLocalLauncherOnboarding()).toEqual({
    stage: 'formation', entityId: ENTITY, runtimeId: RUNTIME,
  });
  clearWalletLocalLauncherOnboarding();
  expect(getWalletLocalLauncherOnboarding()).toEqual({ stage: null, entityId: '', runtimeId: '' });
});

test('daemon owner commits formation before the fallible projection refresh', () => {
  const owner = readFileSync(
    'frontend/bridges/wallet/onboarding/wallet-canonical-daemon-owner.ts',
    'utf8',
  );
  const onboarding = readFileSync(
    'frontend/bridges/wallet/onboarding/wallet-canonical-onboarding.ts',
    'utf8',
  );
  const formationCommit = owner.indexOf('setWalletLocalLauncherOnboarding({');
  const projectionRefresh = owner.indexOf('await refreshCurrentRuntimeProjection();');
  expect(formationCommit).toBeGreaterThan(0);
  expect(projectionRefresh).toBeGreaterThan(formationCommit);
  expect(onboarding).toContain("launch.stage === 'formation'");
  expect(onboarding).toContain('const daemon = readDaemonProjection(runtimeId);');
});

test('paired formation remains published when its projection refresh fails', async () => {
  const calls: string[] = [];
  const activation = activateCanonicalWalletPairedRuntime({
    pairingToken: 'consumed', stage: 'formation', entityId: ENTITY,
  }, {
    label: 'Local node', access: 'admin', wsUrl: 'ws://127.0.0.1:8080/ws', token: 'xlnra1.test',
    runtimeId: RUNTIME, authLevel: 'admin', height: 0, entityCount: 1, importedAt: 1,
  }, {
    persistActiveRemoteRuntimeImport: () => { calls.push('persist'); },
    switchAppRuntimeAdapter: async () => { calls.push('switch'); return null; },
    setRuntimeViewActiveEntityId: () => { calls.push('select'); },
    setWalletLocalLauncherOnboarding: next => {
      calls.push('publish');
      setWalletLocalLauncherOnboarding(next);
    },
    refreshCurrentRuntimeProjection: async () => {
      calls.push('refresh');
      throw new Error('projection unavailable');
    },
  });

  await expect(activation).rejects.toThrow('projection unavailable');
  expect(calls).toEqual(['persist', 'switch', 'select', 'publish', 'refresh']);
  expect(getWalletLocalLauncherOnboarding()).toEqual({
    stage: 'formation', entityId: ENTITY, runtimeId: RUNTIME,
  });
});

test('remote Runtime view projects only the selected daemon-owned target', () => {
  const frame = {
    height: 7,
    entities: [
      { entityId: ENTITY, signerId: SIGNER, label: 'Owner', height: 7, isHub: false,
        jurisdiction: { name: 'Testnet', address: '0x1' } },
      { entityId: HUB, signerId: `0x${'55'.repeat(20)}`, label: 'Hub', height: 7, isHub: true,
        jurisdiction: { name: 'Testnet', address: '0x1' } },
    ],
    activeEntityId: ENTITY,
    activeEntity: {
      core: { signerId: SIGNER, profile: { name: 'Owner', isHub: false }, config: { jurisdiction: { name: 'Testnet', address: '0x1' } } },
      accounts: { items: [{ state: { leftEntity: ENTITY, rightEntity: HUB } }] },
    },
  } as unknown as RuntimeAdapterViewFrame;
  const projection = buildOnboardingRuntimeViewProjection(frame, ENTITY);
  expect(projection.targets).toEqual([expect.objectContaining({
    entityId: ENTITY, signerId: SIGNER, isHub: false, jurisdiction: 'Testnet',
  })]);
  expect(projection.hubCandidates).toEqual([expect.objectContaining({ entityId: HUB, isHub: true })]);
  expect(projection.accountCounterpartiesByEntityId[ENTITY]).toEqual([HUB]);
  expect(projection.committedRolesByEntityId).toEqual({ [ENTITY]: false, [HUB]: true });
});

test.each(['browser', 'daemon'] as const)('%s custody controls browser recovery writes', async custodyOwner => {
  let recoveryWrites = 0;
  let submissions = 0;
  const result = await finishOnboardingSetup({
    entityId: ENTITY, displayName: 'Paired owner', autoJoinHubs: 'manual',
    softLimitUsd: 500, hardLimitUsd: 10_000, maxFeeUsd: 15,
    defaultSoftLimitUsd: 500, defaultHardLimitUsd: 10_000, defaultMaxFeeUsd: 15,
  }, {
    custodyOwner,
    readTargets: () => [{ entityId: ENTITY, signerId: SIGNER, isHub: false, roleSource: 'committed-profile', jurisdiction: 'Testnet' }],
    isTargetJurisdictionEnabled: () => true,
    hasAnyCounterpartyAccount: () => false,
    submitRuntimeInput: async () => { submissions += 1; },
    saveRecoveryConfig: async () => { recoveryWrites += 1; },
    queueAutoHubJoins: async () => ({ joined: 0, requiredTargets: 0 }),
  });
  expect(result.displayName).toBe('Paired owner');
  expect(submissions).toBe(1);
  expect(recoveryWrites).toBe(custodyOwner === 'browser' ? 1 : 0);
});
