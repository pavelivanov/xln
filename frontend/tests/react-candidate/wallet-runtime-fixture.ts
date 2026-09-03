import type { ServerWebSocket } from 'bun';
import { rm } from 'node:fs/promises';

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

await commit({
  runtimeTxs: [runtime.importEntity({
    entityId,
    signerId: runtimeId,
    data: { config, isProposer: true, profileName: 'Browser Alice' },
    entitySeed: `${runtimeSeed}:entity`,
  })],
  entityInputs: [],
});
await commit({
  runtimeTxs: [],
  entityInputs: [{
    entityId,
    signerId: runtimeId,
    entityTxs: [{
      type: 'profile-update',
      data: {
        profile: {
          entityId,
          name: 'Browser Alice',
          avatar: '',
          bio: 'Committed by the isolated candidate Runtime.',
          website: 'https://xln.finance',
        },
      },
    }],
  }],
});

const token = auth.deriveRuntimeAdapterCapabilityToken(
  authSeed,
  'full',
  Date.now() + 60 * 60_000,
  { audience: runtimeId, keyId: 'wallet-address-e2e', tokenId: 'wallet-address-e2e' },
);
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
        wsUrl: `ws://127.0.0.1:${server.port}/rpc`,
        token,
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
  await runtime.stopRuntimeLoopAndWait(env).catch(() => false);
  await runtime.closeRuntimeDb(env);
  await runtime.closeInfraDb(env);
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
