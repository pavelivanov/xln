import type { ServerWebSocket } from 'bun';
import { rm } from 'node:fs/promises';

import {
  buildWalletFixtureHubTxs,
  buildWalletFixtureOrderTx,
  buildWalletFixtureProfileTx,
} from './wallet-runtime-fixture-topology';
import { createWalletRecoveryFixture, waitForWalletFixtureState } from './wallet-recovery-fixture';

type FixtureSocketData = Readonly<{
  type: 'rpc';
  clientIp: string;
  audience: string;
}>;

const port = Math.floor(Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092));
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`WALLET_RUNTIME_FIXTURE_PORT_INVALID:${String(port)}`);
}

const databaseRoot = `/tmp/xln-react-wallet-address-${port}`;
const runtimeSeed = `xln-react-wallet-address:${port}`;
const authSeed = `xln-react-wallet-address-auth:${port}:minimum-32-bytes`;
process.env['XLN_DB_PATH'] = databaseRoot;
process.env['XLN_DISABLE_RUNTIME_RESTORE'] = '1';
process.env['XLN_RADAPTER_AUTH_SEED'] = authSeed;

const runtime = await import('../../../core/runtime');
const crypto = await import('../../../core/account/crypto');
const accountConfig = await import('../../../core/account/config/dispute-config');
const codec = await import('../../../core/api/runtime-adapter/codec');
const adapterServer = await import('../../../core/api/runtime-adapter/server');
const auth = await import('../../../core/api/runtime-adapter/security/auth');
const rpc = await import('../../../core/api/server/network/rpc-ws');
const loopEnvironment = await import('../../../core/runtime/loop/loop-environment');
const scenario = await import('../../../core/scenarios/harness/boot');

await rm(databaseRoot, { recursive: true, force: true });
const env = await runtime.main(runtimeSeed);
env.quietRuntimeLogs = true;
runtime.startRuntimeLoop(env);

const runtimeId = String(env.runtimeId || '').trim().toLowerCase();
if (!/^0x[0-9a-f]{40}$/.test(runtimeId)) throw new Error('WALLET_RUNTIME_FIXTURE_ID_INVALID');
const counterpartySignerId = crypto.deriveSignerAddressSync(runtimeSeed, '2').toLowerCase();
crypto.registerSignerKey(
  env,
  counterpartySignerId,
  crypto.deriveSignerKeySync(runtimeSeed, '2'),
);
const depositoryAddress = `0x${'11'.repeat(20)}`;
const entityProviderAddress = `0x${'22'.repeat(20)}`;
const jurisdictionName = 'Wallet Browser Fixture';
const jurisdictionReplica = scenario.createJReplica(env, jurisdictionName, depositoryAddress);
Object.assign(jurisdictionReplica, {
  chainId: 31_337,
  depositoryAddress,
  entityProviderAddress,
  rpcs: ['http://127.0.0.1:8545'],
  contracts: {
    depository: depositoryAddress,
    entityProvider: entityProviderAddress,
    account: `0x${'33'.repeat(20)}`,
    deltaTransformer: `0x${'44'.repeat(20)}`,
  },
});
const jurisdiction = scenario.createJurisdictionConfig(
  jurisdictionName,
  depositoryAddress,
  entityProviderAddress,
  'http://127.0.0.1:8545',
  31_337,
);
const config = {
  mode: 'proposer-based' as const,
  threshold: 1n,
  validators: [runtimeId],
  shares: { [runtimeId]: 1n },
  jurisdiction,
};
const entityId = runtime.generateLazyEntityId([runtimeId], 1n);
const peerConfig = {
  ...config,
  validators: [counterpartySignerId],
  shares: { [counterpartySignerId]: 1n },
};
const counterpartyEntityId = runtime.generateLazyEntityId(peerConfig.validators, 1n);
if (counterpartyEntityId === entityId) throw new Error('WALLET_RUNTIME_FIXTURE_ENTITY_COLLISION');

const commit = async (submitted: Parameters<typeof runtime.enqueueRuntimeInput>[1]): Promise<void> => {
  const afterHeight = env.state.height;
  runtime.enqueueRuntimeInput(env, submitted);
  await runtime.waitForRuntimeInputCommitted({
    env,
    submitted,
    afterHeight,
    readPersistedFrame: height => runtime.readPersistedStorageFrameRecord(env, height),
    timeoutMs: 20_000,
  });
};

const readAccount = (ownerEntityId: string, peerEntityId: string) => {
  const replica = [...env.state.eReplicas.values()]
    .find((candidate) => candidate.state.entityId === ownerEntityId);
  return replica?.state.accounts.get(peerEntityId);
};

await commit({
  runtimeTxs: [
    runtime.importEntity({
      entityId,
      signerId: runtimeId,
      data: { config, isProposer: true, profileName: 'Browser Alice' },
      entitySeed: `${runtimeSeed}:entity`,
    }),
    runtime.importEntity({
      entityId: counterpartyEntityId,
      signerId: counterpartySignerId,
      data: { config: peerConfig, isProposer: true, profileName: 'Browser Hub' },
      entitySeed: `${runtimeSeed}:counterparty`,
    }),
  ],
  entityInputs: [],
});
await commit({
  runtimeTxs: [],
  entityInputs: [
    {
      entityId,
      signerId: runtimeId,
      entityTxs: [buildWalletFixtureProfileTx(entityId)],
    },
    {
      entityId: counterpartyEntityId,
      signerId: counterpartySignerId,
      entityTxs: buildWalletFixtureHubTxs(counterpartyEntityId),
    },
  ],
});
await commit({
  runtimeTxs: [],
  entityInputs: [{
    entityId,
    signerId: runtimeId,
    entityTxs: [{
      type: 'openAccount',
      data: {
        targetEntityId: counterpartyEntityId,
        disputeConfig: accountConfig.defaultAccountDisputeConfigForParties(
          entityId,
          false,
          counterpartyEntityId,
          false,
        ),
      },
    }],
  }],
});
await waitForWalletFixtureState('account-open', () =>
  Boolean(readAccount(entityId, counterpartyEntityId))
  && Boolean(readAccount(counterpartyEntityId, entityId)));

const usdcTokenId = 1;
const creditLimit = 250_000_000n;
await commit({
  runtimeTxs: [],
  entityInputs: [
    {
      entityId,
      signerId: runtimeId,
      entityTxs: [{
        type: 'extendCredit',
        data: { counterpartyEntityId, tokenId: usdcTokenId, amount: creditLimit },
      }],
    },
    {
      entityId: counterpartyEntityId,
      signerId: counterpartySignerId,
      entityTxs: [{
        type: 'extendCredit',
        data: { counterpartyEntityId: entityId, tokenId: usdcTokenId, amount: creditLimit },
      }],
    },
  ],
});
await waitForWalletFixtureState('credit-extended', () => {
  const delta = readAccount(entityId, counterpartyEntityId)?.state.deltas.get(usdcTokenId);
  return delta?.leftCreditLimit === creditLimit && delta.rightCreditLimit === creditLimit;
});
await commit({
  runtimeTxs: [],
  entityInputs: [{
    entityId,
    signerId: runtimeId,
    entityTxs: [buildWalletFixtureOrderTx(counterpartyEntityId)],
  }],
});
await waitForWalletFixtureState('market-open-order', () => {
  const hub = [...env.state.eReplicas.values()]
    .find((candidate) => candidate.state.entityId === counterpartyEntityId);
  return hub?.state.orderbookExt?.books.get('1/2')?.orders.size === 1;
});
const p2p = runtime.startP2P(env, {
  relayUrls: [],
  wsUrl: null,
  seedRuntimeIds: [],
  advertiseEntityIds: [entityId, counterpartyEntityId],
});
if (!p2p) throw new Error('WALLET_RUNTIME_FIXTURE_P2P_START_FAILED');
await p2p.announceProfilesForEntitiesNow(
  [entityId, counterpartyEntityId],
  'wallet-browser-fixture',
  false,
);
if (!await runtime.ensureGossipProfiles(env, [entityId, counterpartyEntityId])) {
  throw new Error('WALLET_RUNTIME_FIXTURE_PROFILES_UNAVAILABLE');
}
const token = auth.deriveRuntimeAdapterCapabilityToken(
  authSeed,
  'full',
  Date.now() + 60 * 60_000,
  { audience: runtimeId, keyId: 'wallet-address-e2e', tokenId: 'wallet-address-e2e' },
);
const recoveryFixture = await createWalletRecoveryFixture(port);
const handleRpc = rpc.createServerRpcMessageHandler({
  validateRuntimeInputAdmission: runtime.validateRuntimeInputAdmission,
});
let server: ReturnType<typeof Bun.serve<FixtureSocketData>>;
server = Bun.serve<FixtureSocketData>({
  hostname: '127.0.0.1',
  port,
  fetch(request, bunServer) {
    const url = new URL(request.url);
    if (url.pathname === '/rpc' && bunServer.upgrade(request, {
      data: { type: 'rpc', clientIp: '127.0.0.1', audience: runtimeId },
    })) return;
    if (url.pathname === '/info') {
      return Response.json({
        runtimeId,
        entityId,
        counterpartyEntityId,
        height: env.state.height,
        wsUrl: `ws://127.0.0.1:${server.port}/rpc`,
        token,
        recovery: {
          runtimeId: recoveryFixture.runtimeId,
          runtimeHeight: recoveryFixture.runtimeHeight,
          towerUrl: recoveryFixture.towerUrl,
        },
      }, { headers: { 'access-control-allow-origin': '*' } });
    }
    return new Response('not found', { status: 404 });
  },
  websocket: {
    open() {
      adapterServer.attachRuntimeAdapterTicker(env, loopEnvironment.registerEnvChangeCallback);
    },
    async message(socket: ServerWebSocket<FixtureSocketData>, raw: string | Buffer) {
      try {
        const decoded = (typeof raw === 'string'
          ? codec.decodeRuntimeAdapterBrowserMessage(raw)
          : codec.decodeRuntimeAdapterRequest(raw));
        if (!('id' in decoded)) throw new Error('RADAPTER_CLIENT_REQUEST_REQUIRED');
        await handleRpc(socket, decoded, env);
      } catch (error: unknown) {
        adapterServer.closeInvalidRuntimeAdapterMessage(socket, error);
      }
    },
    close(socket: ServerWebSocket<FixtureSocketData>) {
      adapterServer.forgetRuntimeAdapterClient(socket);
    },
  },
});

let stopping = false;
const stop = async (): Promise<void> => {
  if (stopping) return;
  stopping = true;
  await server.stop(true);
  await runtime.stopP2PAndWait(env, 1_000);
  await runtime.stopRuntimeLoopAndWait(env).catch(() => false);
  await runtime.closeRuntimeDb(env);
  await runtime.closeInfraDb(env);
  await recoveryFixture.close();
  await rm(databaseRoot, { recursive: true, force: true });
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void stop().then(() => process.exit(0)).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  });
}

console.log(`wallet address Runtime fixture ready on ${server.port}`);
