import { fileURLToPath } from 'node:url';

import { SURFACE_IDS, type SurfaceId } from '../config/surfaces';
import { parseSurfaceSelection } from './surface-selection';

export const CANDIDATE_BROWSER_TEST_FILES = {
  site: ['tests/react-candidate/site.spec.ts', 'tests/react-candidate/site-routes.spec.ts'],
  docs: ['tests/react-candidate/docs.spec.ts'],
  wallet: ['tests/react-candidate/wallet.spec.ts', 'tests/react-candidate/wallet-financial.spec.ts'],
  ops: ['tests/react-candidate/ops.spec.ts'],
} as const satisfies Readonly<Record<SurfaceId, readonly string[]>>;

export const CANDIDATE_BROWSER_READY_PATHS = {
  site: '/',
  docs: '/docs',
  wallet: '/testnet',
  ops: '/embed',
} as const satisfies Readonly<Record<SurfaceId, `/${string}`>>;

export type CandidateBrowserCommand = Readonly<{
  argv: readonly string[];
  environment: Readonly<Record<'PLAYWRIGHT_REACT_SURFACE', string>>;
  scope: SurfaceId | 'candidate';
}>;

export const parseCandidateBrowserSurface = (rawValue: string | undefined): SurfaceId | null => {
  if (rawValue === undefined || rawValue === '') return null;
  const surface = SURFACE_IDS.find((surfaceId) => surfaceId === rawValue);
  if (surface === undefined) throw new Error(`FRONTEND_BROWSER_SURFACE_UNKNOWN:${rawValue}`);
  return surface;
};

export const createCandidateBrowserCommand = (
  surfaceIds: readonly SurfaceId[],
): CandidateBrowserCommand => {
  const selectedSurface = surfaceIds.length === 1 ? surfaceIds[0] : null;
  if (
    selectedSurface === null
    && (surfaceIds.length !== SURFACE_IDS.length
      || surfaceIds.some((surfaceId, index) => surfaceId !== SURFACE_IDS[index]))
  ) throw new Error('FRONTEND_BROWSER_SURFACE_SELECTION_INVALID');
  return {
    argv: [
      'bunx',
      'playwright',
      'test',
      '--config',
      'playwright.react.config.ts',
      ...(selectedSurface === null ? [] : CANDIDATE_BROWSER_TEST_FILES[selectedSurface]),
    ],
    environment: { PLAYWRIGHT_REACT_SURFACE: selectedSurface ?? '' },
    scope: selectedSurface ?? 'candidate',
  };
};

const run = async (): Promise<void> => {
  const command = createCandidateBrowserCommand(parseSurfaceSelection(Bun.argv.slice(2)));
  const child = Bun.spawn([...command.argv], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ...command.environment },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`FRONTEND_BROWSER_TEST_FAILED:${command.scope}:${exitCode}`);
  console.info(`FRONTEND_BROWSER_TEST_OK scope=${command.scope}`);
};

if (import.meta.main) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
