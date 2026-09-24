import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';

let healthFixtureSequence = 0;

/** Real isolated Orchestrator and Anvil; health bodies are never fabricated. */
export const startHealthOrchestratorFixture = async (basePort: number, root: string) => {
  const fixtureSequence = healthFixtureSequence++;
  const portOffset = fixtureSequence * 100;
  const runRoot = join(root, `run-${fixtureSequence}`);
  const port = basePort + 20 + portOffset;
  const rpcPort = basePort + 21 + portOffset;
  const anvilPort = basePort + 22 + portOffset;
  const custodyPort = basePort + 27 + portOffset;
  const custodyDaemonPort = basePort + 28 + portOffset;
  const nodeApiPort = basePort + 30 + portOffset;
  if (nodeApiPort + 10 > 65_535) throw new Error('HEALTH_FIXTURE_PORT_INVALID');
  const token = `react-health-isolated-operator-${basePort}-minimum-32-bytes`;
  await mkdir(runRoot, { recursive: true });
  const log = await open(join(runRoot, 'orchestrator.log'), 'w');
  const anvil = Bun.spawn(
    [
      'anvil',
      '--silent',
      '--host',
      '127.0.0.1',
      '--port',
      String(anvilPort),
      '--chain-id',
      '31337',
      '--block-gas-limit',
      '300000000',
      '--code-size-limit',
      '65536',
    ],
    { stdout: log.fd, stderr: log.fd },
  );
  let rpcAvailable = true;
  const rpcProxy = Bun.serve({
    hostname: '127.0.0.1',
    port: rpcPort,
    async fetch(request) {
      if (!rpcAvailable) {
        return Response.json({ error: 'HEALTH_FIXTURE_RPC_UNAVAILABLE' }, { status: 503 });
      }
      return fetch(`http://127.0.0.1:${anvilPort}`, {
        method: request.method,
        headers: { 'content-type': 'application/json' },
        ...(request.method === 'POST' ? { body: await request.arrayBuffer() } : {}),
      });
    },
  });
  const orchestrator = Bun.spawn(
    [
      'bun',
      'core/orchestrator/orchestrator.ts',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--node-api-port-base',
      String(nodeApiPort),
      '--db-root',
      join(runRoot, 'db'),
      '--rpc-url',
      `http://127.0.0.1:${rpcPort}`,
      '--mm',
      '--custody',
      '--custody-port',
      String(custodyPort),
      '--custody-daemon-port',
      String(custodyDaemonPort),
      '--custody-db-root',
      join(runRoot, 'custody'),
    ],
    {
      cwd: new URL('../../../../', import.meta.url).pathname,
      env: {
        ...process.env,
        XLN_ORCHESTRATOR_OPERATOR_TOKEN: token,
        XLN_MESH_ROOT_SEED: `react-health-isolated-mesh-${basePort}-${fixtureSequence}`,
        ANVIL_RPC2: '',
        RPC2: '',
        XLN_RPC2_URL: '',
        RPC_TRON: '',
        ANVIL_RPC3: '',
        RPC3: '',
        XLN_RPC3_URL: '',
        XLN_JURISDICTIONS_PATH: join(runRoot, 'jurisdictions.json'),
        XLN_DB_PATH: join(runRoot, 'runtime-db'),
        XLN_EPHEMERAL_TESTNET: '1',
        XLN_DISABLE_RUNTIME_RESTORE: '1',
        XLN_MARKET_MAKER_DISABLE_RESTORE: '1',
      },
      stdout: log.fd,
      stderr: log.fd,
    },
  );
  return {
    async handle(request: Request): Promise<Response | null> {
      const path = new URL(request.url).pathname;
      if (path === '/health-fixture/rpc-failure' && request.method === 'POST') {
        rpcAvailable = false;
        return Response.json({ rpcAvailable });
      }
      if (path === '/health-fixture/rpc-recovery' && request.method === 'POST') {
        rpcAvailable = true;
        return Response.json({ rpcAvailable });
      }
      const target =
        path === '/api/health'
          ? `http://127.0.0.1:${port}/api/health`
          : path === '/rpc' && request.method === 'POST'
            ? `http://127.0.0.1:${rpcPort}`
            : null;
      if (!target) return null;
      return fetch(target, {
        method: request.method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        ...(request.method === 'POST' ? { body: await request.text() } : {}),
      });
    },
    async close() {
      orchestrator.kill('SIGTERM');
      await orchestrator.exited;
      await rpcProxy.stop(true);
      anvil.kill('SIGTERM');
      await anvil.exited;
      await log.close();
    },
  };
};
