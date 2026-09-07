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
  fixture: 'wallet' | 'dropdown';
  clientIp: string;
  audience: string;
}>;

const port = Math.floor(Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092));
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`WALLET_RUNTIME_FIXTURE_PORT_INVALID:${String(port)}`);
}

const databaseRoot = `/tmp/xln-react-wallet-address-${port}`;
const runtimeSeed = 'test test test test test test test test test test test junk';
const authSeed = `xln-react-wallet-address-auth:${port}:minimum-32-bytes`;
process.env['XLN_DB_PATH'] = databaseRoot;
process.env['XLN_DISABLE_RUNTIME_RESTORE'] = '1';
process.env['XLN_RADAPTER_AUTH_SEED'] = authSeed;

const runtime = await import('../../../../../core/runtime');
const { createStackManagerController } = await import('../../../../../core/api/server/control/stack-manager');
const { dbRootPath } = await import('../../../../../core/runtime/replica/platform');
if (dbRootPath !== databaseRoot) throw new Error(`WALLET_FIXTURE_STORAGE_SCOPE_MISMATCH:${dbRootPath}:${databaseRoot}`);
const crypto = await import('../../../../../core/account/crypto');
const accountConfig = await import('../../../../../core/account/config/dispute-config');
const codec = await import('../../../../../core/api/runtime-adapter/codec');
const adapterServer = await import('../../../../../core/api/runtime-adapter/server');
const auth = await import('../../../../../core/api/runtime-adapter/security/auth');
const rpc = await import('../../../../../core/api/server/network/rpc-ws');
const loopEnvironment = await import('../../../../../core/runtime/loop/loop-environment');
const relay = await import('../../../../../core/network/relay/standalone-server');
const { createAssistantProxyFromEnv } = await import('../../../../../core/api/server/assistant/proxy');
const assistantProxy = createAssistantProxyFromEnv();
const scenario = await import('../../../../../core/scenarios/harness/boot');
const { createJAdapter } = await import('../../../../../core/jurisdiction/adapter/kernel/factory');

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
const chainAdapter = await createJAdapter({ mode: 'browservm', chainId: 31_337 });
const { depository: depositoryAddress, entityProvider: entityProviderAddress } = chainAdapter.addresses;
const jurisdictionName = 'Wallet Browser Fixture';
const jurisdictionReplica = scenario.createJReplica(env, jurisdictionName, depositoryAddress);
scenario.bindScenarioJReplica(env, jurisdictionReplica, chainAdapter);
chainAdapter.startWatching(env);
const jurisdiction = scenario.createJurisdictionConfig(
  jurisdictionName,
  depositoryAddress,
  entityProviderAddress,
  'browservm://',
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
  entityInputs: [
    { entityId, signerId: runtimeId, entityTxs: [{ type: 'mintReserves', data: { tokenId: 1, amount: 500_000_000n } }] },
    { entityId: counterpartyEntityId, signerId: counterpartySignerId, entityTxs: [{ type: 'mintReserves', data: { tokenId: 1, amount: 500_000_000n } }] },
  ],
});
await waitForWalletFixtureState('reserves-funded-on-chain', () =>
  [entityId, counterpartyEntityId].every((owner) => [...env.state.eReplicas.values()]
    .find((replica) => replica.state.entityId === owner)?.state.reserves.get(1) === 500_000_000n));
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
const gatewayPort = Math.floor(Number(process.env['XLN_REACT_GATEWAY_PORT'] || 19080));
const relayPort = port + 3;
if (relayPort > 65_535) throw new Error('WALLET_RUNTIME_FIXTURE_RELAY_PORT_INVALID');
const relayServer = relay.startStandaloneRelayServer({
  host: '127.0.0.1',
  port: relayPort,
  serverId: `0x${'99'.repeat(20)}`,
  audience: `ws://localhost:${gatewayPort}/relay`,
});
const stackManager = createStackManagerController({ parseBody: request => request.json(), headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
const handleRpc = rpc.createServerRpcMessageHandler({
  validateRuntimeInputAdmission: runtime.validateRuntimeInputAdmission,
});
let ownershipFixtures: ReturnType<typeof import('./wallet-ownership-fixture').createWalletOwnershipFixtures> | null = null;
let server: ReturnType<typeof Bun.serve<FixtureSocketData>>;
const activeRpcSockets = new Set<ServerWebSocket<FixtureSocketData>>();
let dropdownFixture: ReturnType<typeof import('../account/wallet-account-dropdown-fixture').createAccountDropdownFixture> | null = null;
let dropdownRuntime: typeof env | null = null;
const socketRuntime = (socket: ServerWebSocket<FixtureSocketData>) => {
  if (socket.data.fixture === 'wallet') return env;
  if (!dropdownRuntime) throw new Error('ACCOUNT_DROPDOWN_FIXTURE_NOT_READY');
  return dropdownRuntime;
};
server = Bun.serve<FixtureSocketData>({
  hostname: '127.0.0.1',
  port,
  async fetch(request, bunServer) {
    const url = new URL(request.url);
    const assistantResponse = await assistantProxy.handle(request, url.pathname, '127.0.0.1');
    if (assistantResponse) return assistantResponse;
    const apiHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, cache-control, pragma, authorization', 'content-type': 'application/json' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders });
    if (url.pathname === '/ownership-fixture' && request.method === 'POST') {
      ownershipFixtures ??= import('./wallet-ownership-fixture').then(module => module.createWalletOwnershipFixtures(env, chainAdapter, config, commit));
      return Response.json((await ownershipFixtures).released, { headers: apiHeaders });
    }
    if (url.pathname === '/ownership-release-fixture' && request.method === 'POST') {
      ownershipFixtures ??= import('./wallet-ownership-fixture').then(module => module.createWalletOwnershipFixtures(env, chainAdapter, config, commit));
      const slot = String(url.searchParams.get('slot') || '');
      const fixture = (await ownershipFixtures).unreleased[slot];
      if (!fixture) return new Response('Ownership fixture slot not found', { status: 404, headers: apiHeaders });
      return Response.json(fixture, { headers: apiHeaders });
    }
    if (url.pathname === '/ownership-action-state' && request.method === 'GET') {
      const requestedEntityId = String(url.searchParams.get('entityId') || '').toLowerCase();
      const replica = [...env.state.eReplicas.values()].find(candidate => candidate.state.entityId === requestedEntityId);
      if (!replica) return new Response('Ownership Entity not found', { status: 404, headers: apiHeaders });
      return Response.json({
        confirmedNonce: (replica.state.entityProviderActionState?.confirmedNonce ?? 0n).toString(),
        pendingKind: replica.state.entityProviderActionState?.pending?.payload.kind ?? null,
      }, { headers: apiHeaders });
    }
    if (url.pathname === '/api/tokens') return new Response(runtime.safeStringify({ tokens: (await chainAdapter.getTokenRegistry()).map(token => ({ ...token, externalTokenId: token.externalTokenId.toString() })) }), { headers: apiHeaders });
    if (url.pathname === '/api/stack-manager/status' && request.method === 'GET') {
      if (request.headers.get('authorization') !== `Bearer ${token}`) return new Response('Unauthorized', { status: 401, headers: apiHeaders });
      return stackManager.status(request, env);
    }
    if (url.pathname === '/api/jurisdictions') return new Response(recoveryFixture.readJurisdictionsJson(), {
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
    });
    if (url.pathname === '/api/lending/state') {
      const { handleLendingStateRequest } = await import('../../../../../core/api/server/entities/lending');
      const requestedHub = url.searchParams.get('hubEntityId');
      const dropdownEntities = dropdownRuntime ? [...dropdownRuntime.state.eReplicas.values()].map(replica => replica.state.entityId) : [];
      const readDropdown = dropdownRuntime && requestedHub && dropdownEntities.includes(requestedHub);
      return handleLendingStateRequest({ req: request, env: readDropdown ? dropdownRuntime : env,
        headers: apiHeaders, activeHubEntityIds: readDropdown ? dropdownEntities : [counterpartyEntityId] });
    }
    if (url.pathname === '/api/credit/request') {
      const { handleCreditRequest } = await import('../../../../../core/api/server/faucet/credit');
      return handleCreditRequest({ req: request, env, headers: apiHeaders, activeHubEntityIds: [counterpartyEntityId],
        enqueueRuntimeInput: runtime.enqueueRuntimeInput, validateRuntimeInputAdmission: runtime.validateRuntimeInputAdmission, getCurrentRuntimeHeight: env => env ? env.state.height : 0 });
    }
    if (url.pathname === '/account-tool-state') {
      if (url.searchParams.get('dump') === '1') return new Response(runtime.safeStringify(env.state), { headers: apiHeaders });
      const owner = url.searchParams.get('entityId') || entityId;
      const peer = url.searchParams.get('accountId') || counterpartyEntityId;
      const account = readAccount(owner, peer);
      if (!account) throw new Error('ACCOUNT_TOOL_FIXTURE_ACCOUNT_MISSING');
      const tokenId = Number(url.searchParams.get('tokenId') || 1);
      const delta = account.state.deltas.get(tokenId);
      const derived = delta ? runtime.deriveDelta(delta, owner.toLowerCase() < peer.toLowerCase()) : null;
      const policy = account.state.rebalanceFeePolicies?.get(tokenId)?.[runtime.isLeftEntity(owner, peer) ? 'right' : 'left'];
      const request = account.state.requestedRebalanceFeeState.get(tokenId);
      return Response.json({ height: env.state.height, tokenIds: [...account.state.deltas.keys()], tokenDecimals: runtime.getTokenInfo(tokenId).decimals, status: account.status,
        ownCreditLimit: derived ? derived.ownCreditLimit.toString() : null, peerCreditLimit: derived ? derived.peerCreditLimit.toString() : null,
        peerFeePolicy: policy ? { policyVersion: policy.policyVersion, baseFee: String(policy.baseFee), gasFee: String(policy.gasFee), liquidityFeeBps: String(policy.liquidityFeeBps) } : null,
        collateralRequest: request ? { amount: String(request.requestedAmount), feePaid: String(request.feePaidUpfront), feeTokenId: request.feeTokenId, policyVersion: request.policyVersion } : null,
        collateral: delta ? delta.collateral.toString() : null, settlement: account.state.settlementWorkspace ? runtime.safeStringify(account.state.settlementWorkspace) : null });
    }
    if (url.pathname === '/account-dropdown-fixture' && request.method === 'POST') {
      dropdownFixture ??= import('../account/wallet-account-dropdown-fixture').then(module => module.createAccountDropdownFixture(port));
      const fixture = await dropdownFixture;
      dropdownRuntime = fixture.env;
      return Response.json({ runtimeId: fixture.runtimeId, entityId: fixture.entityId, height: fixture.env.state.height,
        wsUrl: `ws://127.0.0.1:${port}/dropdown-rpc`,
        token: auth.deriveRuntimeAdapterCapabilityToken(authSeed, 'full', Date.now() + 60 * 60_000,
          { audience: fixture.runtimeId, keyId: 'account-dropdown-e2e', tokenId: 'account-dropdown-e2e' }),
      });
    }
    if (url.pathname === '/dropdown-rpc' && dropdownRuntime && bunServer.upgrade(request, {
      data: { type: 'rpc', fixture: 'dropdown', clientIp: '127.0.0.1', audience: String(dropdownRuntime.runtimeId) },
    })) {
      return;
    }
    if (url.pathname === '/rpc' && bunServer.upgrade(request, {
      data: { type: 'rpc', fixture: 'wallet', clientIp: '127.0.0.1', audience: runtimeId },
    })) return;
    if (url.pathname === '/chain-balances') {
      const alice = [...env.state.eReplicas.values()].find((replica) => replica.state.entityId === entityId);
      const account = readAccount(entityId, counterpartyEntityId);
      if (!alice || !account) throw new Error('WALLET_FIXTURE_ACCOUNT_MISSING');
      return Response.json({
        reserve: String(alice.state.reserves.get(1) ?? 0n),
        collateral: String(account.state.deltas.get(1)?.collateral ?? 0n),
        chainReserve: String(await chainAdapter.getReserves(entityId, 1)),
        chainCollateral: String(await chainAdapter.getCollateral(entityId, counterpartyEntityId, 1)),
      });
    }
    if (url.pathname === '/info') {
      return Response.json({
        runtimeId,
        entityId,
        counterpartyEntityId,
        height: env.state.height,
        walletSeed: runtimeSeed,
        wsUrl: `ws://127.0.0.1:${server.port}/rpc`,
        token,
        recovery: {
          backupFileContents: recoveryFixture.backupFileContents,
          entityId: recoveryFixture.entityId,
          runtimeId: recoveryFixture.runtimeId,
          runtimeHeight: recoveryFixture.runtimeHeight,
          towerUrl: recoveryFixture.towerUrl,
          rpcUrl: recoveryFixture.rpcUrl,
          hubDiscovery: recoveryFixture.hubDiscovery,
          external: recoveryFixture.external,
          brainVault: recoveryFixture.brainVault,
        },
      }, { headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.pathname === '/connections') return Response.json({ active: activeRpcSockets.size });
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  },
  websocket: {
    open(socket: ServerWebSocket<FixtureSocketData>) {
      activeRpcSockets.add(socket);
      adapterServer.attachRuntimeAdapterTicker(socketRuntime(socket), loopEnvironment.registerEnvChangeCallback);
    },
    async message(socket: ServerWebSocket<FixtureSocketData>, raw: string | Buffer) {
      try {
        const decoded = (typeof raw === 'string'
          ? codec.decodeRuntimeAdapterBrowserMessage(raw)
          : codec.decodeRuntimeAdapterRequest(raw));
        if (!('id' in decoded)) throw new Error('RADAPTER_CLIENT_REQUEST_REQUIRED');
        await handleRpc(socket, decoded, socketRuntime(socket));
      } catch (error: unknown) {
        adapterServer.closeInvalidRuntimeAdapterMessage(socket, error);
      }
    },
    close(socket: ServerWebSocket<FixtureSocketData>) {
      activeRpcSockets.delete(socket);
      adapterServer.forgetRuntimeAdapterClient(socket);
    },
  },
});

let stopping = false;
const stop = async (): Promise<void> => {
  if (stopping) return;
  stopping = true;
  await server.stop(true);
  if (dropdownFixture) await (await dropdownFixture).close();
  relayServer.close();
  await runtime.stopP2PAndWait(env, 1_000);
  await runtime.stopRuntimeLoopAndWait(env).catch(() => false);
  await runtime.closeRuntimeDb(env);
  await runtime.closeInfraDb(env);
  await recoveryFixture.close();
  await chainAdapter.close();
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
