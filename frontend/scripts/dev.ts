import { fileURLToPath } from 'node:url';

import { getSurface, type SurfaceId } from '../config/surfaces';
import { prepareGeneratedInputs } from './generated-inputs';
import { parseSurfaceSelection } from './surface-selection';

const FRONTEND_ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export type DevelopmentProcessSpec = Readonly<{
  label: string;
  argv: readonly string[];
  gatewayAware: boolean;
  environment?: Readonly<Record<string, string>>;
}>;

export const createDevelopmentProcessSpecs = (
  surfaceIds: readonly SurfaceId[],
): readonly DevelopmentProcessSpec[] => {
  const runtimeFixtureEnabled = process.env['XLN_REACT_WALLET_ADDRESS_FIXTURE'] === '1'
    && surfaceIds.length === 1
    && (surfaceIds[0] === 'wallet' || surfaceIds[0] === 'ops');
  const walletFixtureEnabled = runtimeFixtureEnabled && surfaceIds[0] === 'wallet';
  return [
    ...surfaceIds.map((surfaceId) => ({
      label: `vite-${getSurface(surfaceId).id}`,
      argv: ['bunx', 'vite', '--config', `apps/${surfaceId}/vite.config.ts`],
      gatewayAware: true,
    })),
    {
      label: 'same-origin-gateway',
      argv: ['bun', 'scripts/run-dev-gateway.ts'],
      gatewayAware: false,
      ...(walletFixtureEnabled
        ? { environment: {
            XLN_REACT_EDGE_TARGET: `http://127.0.0.1:${Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] || 19092) + 3}`,
          } }
        : surfaceIds.length === 1 && surfaceIds[0] === 'site'
        ? { environment: { XLN_REACT_DOCS_PROXY_OWNER: 'site' } }
        : surfaceIds.length === 1 && surfaceIds[0] === 'ops'
          ? { environment: { XLN_REACT_WALLET_PROXY_OWNER: 'ops' } }
        : {}),
    },
    ...(runtimeFixtureEnabled ? [{
      label: 'wallet-address-runtime-fixture',
      argv: ['bun', 'tests/react-candidate/wallet-runtime-fixture.ts'],
      gatewayAware: false,
    }] : []),
  ];
};

export const getDevelopmentExitFailure = (
  shutdownRequested: boolean,
  label: string,
  exitCode: number,
): Error | undefined => shutdownRequested
  ? undefined
  : new Error(`FRONTEND_DEV_PROCESS_EXITED:${label}:${exitCode}`);

const run = async (): Promise<void> => {
  const surfaceIds = parseSurfaceSelection(Bun.argv.slice(2));
  await prepareGeneratedInputs(REPOSITORY_ROOT, FRONTEND_ROOT, surfaceIds);
  const processes = createDevelopmentProcessSpecs(surfaceIds).map((spec) => ({
    spec,
    child: Bun.spawn([...spec.argv], {
      cwd: FRONTEND_ROOT,
      env: {
        ...process.env,
        ...spec.environment,
        ...(spec.gatewayAware ? { XLN_REACT_DEV_GATEWAY: '1' } : {}),
      },
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    }),
  }));

  let shutdownRequested = false;
  const stop = (): void => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    for (const { child } of processes) child.kill('SIGTERM');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const exits = processes.map(async ({ spec, child }) => ({ spec, exitCode: await child.exited }));
  const first = await Promise.race(exits);
  const shutdownWasRequested = shutdownRequested;
  stop();
  await Promise.all(exits);
  const failure = getDevelopmentExitFailure(shutdownWasRequested, first.spec.label, first.exitCode);
  if (failure !== undefined) throw failure;
};

if (import.meta.main) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
