import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';

/** Real isolated Orchestrator and Anvil; health bodies are never fabricated. */
export const startHealthOrchestratorFixture = async (basePort: number, root: string) => {
  const port = basePort + 20;
  const rpcPort = basePort + 21;
  const nodeApiPort = basePort + 30;
  if (nodeApiPort + 10 > 65_535) throw new Error('HEALTH_FIXTURE_PORT_INVALID');
  const token = `react-health-isolated-operator-${basePort}-minimum-32-bytes`;
  await mkdir(root, { recursive: true });
  const log = await open(join(root, 'orchestrator.log'), 'w');
  const anvil = Bun.spawn(
    [
      'anvil',
      '--silent',
      '--host',
      '127.0.0.1',
      '--port',
      String(rpcPort),
      '--chain-id',
      '31337',
      '--block-gas-limit',
      '300000000',
      '--code-size-limit',
      '65536',
    ],
    { stdout: log.fd, stderr: log.fd },
  );
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
      join(root, 'db'),
      '--rpc-url',
      `http://127.0.0.1:${rpcPort}`,
    ],
    {
      cwd: new URL('../../../../', import.meta.url).pathname,
      env: {
        ...process.env,
        XLN_ORCHESTRATOR_OPERATOR_TOKEN: token,
        XLN_MESH_ROOT_SEED: `react-health-isolated-mesh-${basePort}`,
        ANVIL_RPC2: '',
        RPC2: '',
        XLN_RPC2_URL: '',
        RPC_TRON: '',
        ANVIL_RPC3: '',
        RPC3: '',
        XLN_RPC3_URL: '',
        XLN_JURISDICTIONS_PATH: join(root, 'jurisdictions.json'),
        XLN_DB_PATH: join(root, 'runtime-db'),
      },
      stdout: log.fd,
      stderr: log.fd,
    },
  );
  return {
    async handle(request: Request): Promise<Response | null> {
      const path = new URL(request.url).pathname;
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
      anvil.kill('SIGTERM');
      await anvil.exited;
      await log.close();
    },
  };
};
