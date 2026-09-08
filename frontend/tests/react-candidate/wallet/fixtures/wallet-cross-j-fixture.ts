import * as runtime from '../../../../../core/runtime';
import type { ConsensusConfig, RuntimeReplica } from '../../../../../core/api/public/runtime-module';
import { deriveSignerAddressSync, deriveSignerKeySync, registerSignerKey } from '../../../../../core/account/crypto';
import { defaultAccountDisputeConfigForParties } from '../../../../../core/account/config/dispute-config';
import { readSwapAccountCapacity } from '../../../../../core/account/swap/swap-inbound-plan';
import * as scenario from '../../../../../core/scenarios/harness/boot';
import { createHubDirectRuntimeRoute } from '../../../../../core/orchestrator/hub/hub-runtime-transport';

import { buildWalletFixtureHubTxs, buildWalletFixtureProfileTx } from './wallet-runtime-fixture-topology';
import { waitForWalletFixtureState } from './wallet-recovery-fixture';

type Commit = (input: Parameters<typeof runtime.enqueueRuntimeInput>[1]) => Promise<void>;
type P2P = NonNullable<ReturnType<typeof runtime.startP2P>>;
type Jurisdiction = NonNullable<ConsensusConfig['jurisdiction']>;

const hubSeed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const waitForProfiles = async (env: RuntimeReplica, entityIds: readonly string[]): Promise<void> => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (entityIds.every(entityId => env.gossip.getProfile(entityId))) return;
    await Bun.sleep(25);
  }
  throw new Error(`WALLET_RUNTIME_FIXTURE_STATE_TIMEOUT:cross-j profiles ${entityIds.join(',')}`);
};

const settledAccount = (env: RuntimeReplica, entityId: string, counterpartyEntityId: string, minimumHeight: number) => {
  const account = [...env.state.eReplicas.values()]
    .find(candidate => candidate.state.entityId === entityId)
    ?.state.accounts.get(counterpartyEntityId);
  return account && !account.pendingFrame && account.currentHeight >= minimumHeight && account.mempool.length === 0
    ? account
    : null;
};

const installJurisdiction = (
  env: RuntimeReplica,
  jurisdiction: Jurisdiction,
  contracts: Readonly<{ account: string; deltaTransformer: string }>,
): void => {
  const replica = scenario.createJReplica(env, jurisdiction.name, jurisdiction.depositoryAddress);
  replica.chainId = Number(jurisdiction.chainId);
  replica.contracts = {
    ...replica.contracts,
    depository: jurisdiction.depositoryAddress,
    entityProvider: jurisdiction.entityProviderAddress,
    account: contracts.account,
    deltaTransformer: contracts.deltaTransformer,
  };
};

export async function createWalletCrossJFixture(
  env: RuntimeReplica,
  sourceConfig: ConsensusConfig,
  commit: Commit,
  seed: string,
  sourceEntityId: string,
  sourceP2P: P2P,
  relayUrl: string,
): Promise<
  Readonly<{
    sourceHubEntityId: string;
    targetEntityId: string;
    targetHubEntityId: string;
    targetJurisdiction: string;
    close: () => Promise<void>;
  }>
> {
  const hubEnv = await runtime.main(hubSeed);
  hubEnv.quietRuntimeLogs = true;
  runtime.startRuntimeLoop(hubEnv);
  const sourceHubSignerId = String(hubEnv.runtimeId || '').toLowerCase();
  const targetHubSignerId = deriveSignerAddressSync(hubSeed, '2').toLowerCase();
  const targetSignerId = deriveSignerAddressSync(seed, '700').toLowerCase();
  registerSignerKey(hubEnv, targetHubSignerId, deriveSignerKeySync(hubSeed, '2'));
  registerSignerKey(env, targetSignerId, deriveSignerKeySync(seed, '700'));

  const targetJurisdiction = 'Wallet Target Fixture';
  const targetJurisdictionConfig = scenario.createJurisdictionConfig(
    targetJurisdiction,
    `0x${'31'.repeat(20)}`,
    `0x${'32'.repeat(20)}`,
    'browservm://target',
    31_338,
  );
  const sourceJurisdiction = sourceConfig.jurisdiction;
  if (!sourceJurisdiction) throw new Error('WALLET_CROSS_SOURCE_JURISDICTION_MISSING');
  const sourceStack = env.state.jReplicas.get(sourceJurisdiction.name)?.contracts;
  const sourceAccountAddress = sourceStack?.account;
  const sourceDeltaTransformerAddress = sourceStack?.deltaTransformer;
  if (!sourceAccountAddress || !sourceDeltaTransformerAddress) {
    throw new Error('WALLET_CROSS_SOURCE_DURABLE_STACK_MISSING');
  }
  const targetStack = {
    account: `0x${'33'.repeat(20)}`,
    deltaTransformer: `0x${'34'.repeat(20)}`,
  };
  installJurisdiction(hubEnv, sourceJurisdiction, {
    account: sourceAccountAddress,
    deltaTransformer: sourceDeltaTransformerAddress,
  });
  installJurisdiction(hubEnv, targetJurisdictionConfig, targetStack);
  installJurisdiction(env, targetJurisdictionConfig, targetStack);
  const sourceHubConfig: ConsensusConfig = {
    ...structuredClone(sourceConfig),
    threshold: 1n,
    validators: [sourceHubSignerId],
    shares: { [sourceHubSignerId]: 1n },
  };
  const targetConfig: ConsensusConfig = {
    ...structuredClone(sourceConfig),
    jurisdiction: targetJurisdictionConfig,
    threshold: 1n,
    validators: [targetSignerId],
    shares: { [targetSignerId]: 1n },
  };
  const targetHubConfig: ConsensusConfig = {
    ...targetConfig,
    validators: [targetHubSignerId],
    shares: { [targetHubSignerId]: 1n },
  };
  const sourceHubEntityId = runtime.generateLazyEntityId([sourceHubSignerId], 1n);
  const targetEntityId = runtime.generateLazyEntityId([targetSignerId], 1n);
  const targetHubEntityId = runtime.generateLazyEntityId([targetHubSignerId], 1n);

  const hubCommit: Commit = async submitted => {
    const afterHeight = hubEnv.state.height;
    runtime.enqueueRuntimeInput(hubEnv, submitted);
    await runtime.waitForRuntimeInputCommitted({
      env: hubEnv,
      submitted,
      afterHeight,
      readPersistedFrame: height => runtime.readPersistedStorageFrameRecord(hubEnv, height),
      timeoutMs: 20_000,
    });
  };
  await hubCommit({
    runtimeTxs: [
      runtime.importEntity({
        entityId: sourceHubEntityId,
        signerId: sourceHubSignerId,
        entitySeed: `${hubSeed}:source-hub`,
        data: { config: sourceHubConfig, isProposer: true, profileName: 'Browser Cross Source Hub' },
      }),
      runtime.importEntity({
        entityId: targetHubEntityId,
        signerId: targetHubSignerId,
        entitySeed: `${hubSeed}:target-hub`,
        data: { config: targetHubConfig, isProposer: true, profileName: 'Browser Target Hub' },
      }),
    ],
    entityInputs: [],
  });
  await hubCommit({
    runtimeTxs: [],
    entityInputs: [
      {
        entityId: sourceHubEntityId,
        signerId: sourceHubSignerId,
        entityTxs: buildWalletFixtureHubTxs(sourceHubEntityId, 'Browser Cross Source Hub'),
      },
      {
        entityId: targetHubEntityId,
        signerId: targetHubSignerId,
        entityTxs: buildWalletFixtureHubTxs(targetHubEntityId, 'Browser Target Hub'),
      },
    ],
  });
  await commit({
    runtimeTxs: [
      runtime.importEntity({
        entityId: targetEntityId,
        signerId: targetSignerId,
        entitySeed: `${seed}:cross-j:user`,
        data: { config: targetConfig, isProposer: true, profileName: 'Browser Target User' },
      }),
    ],
    entityInputs: [],
  });
  await commit({
    runtimeTxs: [],
    entityInputs: [
      {
        entityId: targetEntityId,
        signerId: targetSignerId,
        entityTxs: [buildWalletFixtureProfileTx(targetEntityId, 'Browser Target User')],
      },
    ],
  });

  const relayPort = Number(new URL(relayUrl).port);
  const directPort = relayPort + 1;
  if (!Number.isSafeInteger(directPort) || directPort > 65_535) {
    throw new Error('WALLET_CROSS_DIRECT_PORT_INVALID');
  }
  const hubDirectUrl = `ws://127.0.0.1:${directPort}/ws`;
  const directRoute = createHubDirectRuntimeRoute(hubEnv, hubSeed, () => true, { lastSeen: null, lastError: null });
  const directServer = Bun.serve<{ type?: string }>({
    hostname: '127.0.0.1',
    port: directPort,
    fetch(request, server) {
      const upgrade = directRoute.maybeUpgrade(request, server);
      if (upgrade.handled) return upgrade.response;
      return new Response('Not found', { status: 404 });
    },
    websocket: directRoute.websocket,
  });
  const hubP2P = runtime.startP2P(hubEnv, {
    relayUrls: [relayUrl],
    wsUrl: hubDirectUrl,
    seedRuntimeIds: [String(env.runtimeId)],
    advertiseEntityIds: [sourceHubEntityId, targetHubEntityId],
  });
  if (!hubP2P) throw new Error('WALLET_CROSS_HUB_P2P_START_FAILED');
  sourceP2P.updateConfig({
    relayUrls: [relayUrl],
    seedRuntimeIds: [String(hubEnv.runtimeId)],
    advertiseEntityIds: [sourceEntityId, targetEntityId],
  });
  await waitForWalletFixtureState('cross-j relay clients', () => sourceP2P.isConnected() && hubP2P.isConnected());
  await Promise.all([sourceP2P.announceLocalProfiles(), hubP2P.announceLocalProfiles()]);
  const userProfiles = [sourceEntityId, targetEntityId]
    .map(entityId => env.gossip.getProfile(entityId))
    .filter(profile => profile !== undefined);
  const hubProfiles = [sourceHubEntityId, targetHubEntityId]
    .map(entityId => hubEnv.gossip.getProfile(entityId))
    .filter(profile => profile !== undefined);
  if (userProfiles.length !== 2 || hubProfiles.length !== 2) {
    throw new Error(
      `WALLET_CROSS_LOCAL_PROFILE_BATCH_INCOMPLETE:user=${[sourceEntityId, targetEntityId]
        .map(entityId => `${entityId}:${env.gossip.getProfile(entityId) ? 'ready' : 'missing'}`)
        .join(',')}:hub=${[sourceHubEntityId, targetHubEntityId]
        .map(entityId => `${entityId}:${hubEnv.gossip.getProfile(entityId) ? 'ready' : 'missing'}`)
        .join(',')}`,
    );
  }
  // Multiple Runtimes in this fixture share only their signed public profile
  // bytes. Each receiver still executes the production sanitizer, Hanko and
  // Runtime-route verification before installing transport authority.
  await Promise.all([sourceP2P.admitSharedProfiles(hubProfiles), hubP2P.admitSharedProfiles(userProfiles)]);
  await Promise.all([
    waitForProfiles(env, [sourceHubEntityId, targetHubEntityId]),
    waitForProfiles(hubEnv, [sourceEntityId, targetEntityId]),
  ]);
  const userRoutesReady = await sourceP2P.bootstrapDirectEntityRoutes([sourceHubEntityId, targetHubEntityId], 10_000);
  if (!userRoutesReady) {
    throw new Error('WALLET_CROSS_DIRECT_ROUTES_NOT_READY');
  }

  await commit({
    runtimeTxs: [],
    entityInputs: [
      {
        entityId: sourceEntityId,
        signerId: String(env.runtimeId),
        entityTxs: [
          {
            type: 'openAccount',
            data: {
              targetEntityId: sourceHubEntityId,
              tokenId: 1,
              creditAmount: 0n,
              disputeConfig: defaultAccountDisputeConfigForParties(sourceEntityId, false, sourceHubEntityId, true),
            },
          },
        ],
      },
      {
        entityId: targetEntityId,
        signerId: targetSignerId,
        entityTxs: [
          {
            type: 'openAccount',
            data: {
              targetEntityId: targetHubEntityId,
              tokenId: 2,
              creditAmount: 0n,
              disputeConfig: defaultAccountDisputeConfigForParties(targetEntityId, false, targetHubEntityId, true),
            },
          },
        ],
      },
    ],
  });
  await waitForWalletFixtureState('cross-j accounts', () =>
    Boolean(
      settledAccount(env, sourceEntityId, sourceHubEntityId, 1) &&
      settledAccount(env, targetEntityId, targetHubEntityId, 1) &&
      settledAccount(hubEnv, sourceHubEntityId, sourceEntityId, 1) &&
      settledAccount(hubEnv, targetHubEntityId, targetEntityId, 1),
    ),
  );

  await Promise.all([
    hubCommit({
      runtimeTxs: [],
      entityInputs: [
        {
          entityId: sourceHubEntityId,
          signerId: sourceHubSignerId,
          entityTxs: [
            { type: 'extendCredit', data: { counterpartyEntityId: sourceEntityId, tokenId: 1, amount: 500_000_000n } },
          ],
        },
      ],
    }),
    commit({
      runtimeTxs: [],
      entityInputs: [
        {
          entityId: targetEntityId,
          signerId: targetSignerId,
          entityTxs: [
            { type: 'extendCredit', data: { counterpartyEntityId: targetHubEntityId, tokenId: 2, amount: 10n ** 20n } },
          ],
        },
      ],
    }),
  ]);
  await waitForWalletFixtureState('cross-j credit', () => {
    const sourceAccount = settledAccount(env, sourceEntityId, sourceHubEntityId, 2);
    const targetAccount = settledAccount(env, targetEntityId, targetHubEntityId, 2);
    return Boolean(
      sourceAccount &&
      targetAccount &&
      readSwapAccountCapacity({
        account: sourceAccount.state,
        ownerEntityId: sourceEntityId,
        counterpartyEntityId: sourceHubEntityId,
        tokenId: 1,
      }).outCapacity >= 500_000_000n &&
      readSwapAccountCapacity({
        account: targetAccount.state,
        ownerEntityId: targetEntityId,
        counterpartyEntityId: targetHubEntityId,
        tokenId: 2,
      }).inCapacity >=
        10n ** 20n,
    );
  });

  return {
    sourceHubEntityId,
    targetEntityId,
    targetHubEntityId,
    targetJurisdiction,
    close: async () => {
      await runtime.stopP2PAndWait(hubEnv, 1_000);
      await directServer.stop(true);
      await runtime.stopRuntimeLoopAndWait(hubEnv).catch(() => false);
      await runtime.closeRuntimeDb(hubEnv);
      await runtime.closeInfraDb(hubEnv);
    },
  };
}
