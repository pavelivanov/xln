import * as runtime from '../../../../../core/runtime';
import type { ConsensusConfig, RuntimeReplica } from '../../../../../core/api/public/runtime-module';
import {
  deriveSignerAddressSync,
  deriveSignerKeySync,
  registerSignerKey,
} from '../../../../../core/account/crypto';
import { defaultAccountDisputeConfigForParties } from '../../../../../core/account/config/dispute-config';

import { buildWalletFixtureHubTxs } from './wallet-runtime-fixture-topology';
import { waitForWalletFixtureState } from './wallet-recovery-fixture';

type Commit = (input: Parameters<typeof runtime.enqueueRuntimeInput>[1]) => Promise<void>;

const fixtureSignerIndex = (slot: string): string => {
  const slots = [
    'mobile-390x844-open', 'mobile-390x844-switch',
    'laptop-1366x900-open', 'laptop-1366x900-switch',
    'wide-1920x1080-open', 'wide-1920x1080-switch',
    'mobile-390x844-dispute',
    'laptop-1366x900-dispute',
    'wide-1920x1080-dispute',
    'mobile-390x844-debt',
    'laptop-1366x900-debt',
    'wide-1920x1080-debt',
  ];
  const index = slots.indexOf(slot);
  if (index < 0) throw new Error(`HUB_DISCOVERY_FIXTURE_SLOT_INVALID:${slot}`);
  return String(300 + index);
};

export async function createWalletHubDiscoveryFixture(
  env: RuntimeReplica,
  config: ConsensusConfig,
  commit: Commit,
  seed: string,
  slot: string,
) {
  const signerIndex = fixtureSignerIndex(slot);
  const signerId = deriveSignerAddressSync(seed, signerIndex).toLowerCase();
  registerSignerKey(env, signerId, deriveSignerKeySync(seed, signerIndex));
  const hubConfig: ConsensusConfig = {
    ...structuredClone(config),
    threshold: 1n,
    validators: [signerId],
    shares: { [signerId]: 1n },
  };
  const entityId = runtime.generateLazyEntityId([signerId], 1n);
  const name = `Browser Connect Hub ${slot}`;
  await commit({
    runtimeTxs: [runtime.importEntity({
      entityId,
      signerId,
      entitySeed: `${seed}:hub-discovery:${slot}`,
      data: { config: hubConfig, isProposer: true, profileName: name },
    })],
    entityInputs: [],
  });
  await commit({
    runtimeTxs: [],
    entityInputs: [{ entityId, signerId, entityTxs: buildWalletFixtureHubTxs(entityId, name) }],
  });
  await waitForWalletFixtureState(`Hub discovery profile ${slot}`, () => {
    const replica = [...env.state.eReplicas.values()].find(candidate => candidate.state.entityId === entityId);
    return replica?.state.profile?.isHub === true;
  });
  return { entityId, name, signerId, height: env.state.height };
}

export async function createWalletDisputeFixture(
  env: RuntimeReplica,
  config: ConsensusConfig,
  commit: Commit,
  seed: string,
  slot: string,
  sourceEntityId: string,
  sourceSignerId: string,
) {
  const hub = await createWalletHubDiscoveryFixture(env, config, commit, seed, slot);
  await commit({
    runtimeTxs: [],
    entityInputs: [
      {
        entityId: sourceEntityId,
        signerId: sourceSignerId,
        entityTxs: [
          {
            type: 'openAccount',
            data: {
              targetEntityId: hub.entityId,
              tokenId: 1,
              creditAmount: 0n,
              disputeConfig: defaultAccountDisputeConfigForParties(sourceEntityId, false, hub.entityId, true),
            },
          },
        ],
      },
    ],
  });
  await waitForWalletFixtureState(`Dispute account ${slot}`, () => {
    const source = [...env.state.eReplicas.values()].find(candidate => candidate.state.entityId === sourceEntityId);
    const target = [...env.state.eReplicas.values()].find(candidate => candidate.state.entityId === hub.entityId);
    return Boolean(source?.state.accounts.get(hub.entityId)) && Boolean(target?.state.accounts.get(sourceEntityId));
  });
  return { ...hub, height: env.state.height };
}
