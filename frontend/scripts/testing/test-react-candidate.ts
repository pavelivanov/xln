import { fileURLToPath } from 'node:url';

import { SURFACE_IDS, type SurfaceId } from '../../../packages/frontend-release/surfaces';
import { parseSurfaceSelection } from '../shared/surface-selection';

export const CANDIDATE_BROWSER_TEST_FILES = {
  site: ['tests/react-candidate/site.spec.ts', 'tests/react-candidate/site-routes.spec.ts'],
  docs: ['tests/react-candidate/docs.spec.ts'],
  wallet: [
    'tests/react-candidate/wallet/wallet-localization.spec.ts',
    'tests/react-candidate/wallet.spec.ts',
    'tests/react-candidate/wallet/wallet-financial.spec.ts',
    'tests/react-candidate/wallet/wallet-transactions.spec.ts',
    'tests/react-candidate/wallet/wallet-navigation.spec.ts',
    'tests/react-candidate/wallet/wallet-settlement.spec.ts',
    'tests/react-candidate/wallet/onboarding/wallet-onboarding.spec.ts',
    'tests/react-candidate/wallet/onboarding/wallet-formation.spec.ts',
    'tests/react-candidate/wallet/onboarding/wallet-hub-discovery.spec.ts',
    'tests/react-candidate/wallet/account/wallet-account-open.spec.ts',
    'tests/react-candidate/wallet/account/wallet-account-view.spec.ts',
    'tests/react-candidate/wallet/account/wallet-account-appearance.spec.ts',
    'tests/react-candidate/wallet/account/wallet-account-rail.spec.ts',
    'tests/react-candidate/wallet/account/wallet-account-dropdown.spec.ts',
    'tests/react-candidate/wallet/wallet-entity-selection.spec.ts',
    'tests/react-candidate/wallet/account/wallet-account-workspace.spec.ts',
    'tests/react-candidate/wallet/account/wallet-account-commands.spec.ts',
    'tests/react-candidate/wallet/wallet-entity-evidence.spec.ts',
  ],
  ops: [
    'tests/react-candidate/ops/ops.spec.ts',
    'tests/react-candidate/ops/ops-health-events.spec.ts',
    'tests/react-candidate/ops/ops-health-topology.spec.ts',
    'tests/react-candidate/ops/workspace/ops-command-palette.spec.ts',
    'tests/react-candidate/ops/ops-public-embed.spec.ts',
    'tests/react-candidate/ops/workspace/ops-workspace-localization.spec.ts',
    'tests/react-candidate/ops/panels/ops-workspace-panels.spec.ts',
    'tests/react-candidate/ops/workspace/ops-workspace-session.spec.ts',
    'tests/react-candidate/ops/panels/ops-workspace-graph.spec.ts',
    'tests/react-candidate/ops/owner/ops-owner-unlock.spec.ts',
    'tests/react-candidate/ops/owner/ops-local-owner-unlock.spec.ts',
    'tests/react-candidate/ops/panels/ops-workspace-guide.spec.ts',
    'tests/react-candidate/ops/panels/ops-workspace-local-panels.spec.ts',
    'tests/react-candidate/ops/panels/ops-workspace-database.spec.ts',
    'tests/react-candidate/ops/workspace/ops-runtime-manager.spec.ts',
    'tests/react-candidate/ops/workspace/ops-workspace-settings.spec.ts',
    'tests/react-candidate/ops/panels/ops-workspace-wallet.spec.ts',
    'tests/react-candidate/ops/panels/ops-workspace-jurisdiction.spec.ts',
    'tests/react-candidate/ops/panels/ops-workspace-architect.spec.ts',
    'tests/react-candidate/ops/panels/brainvault/ops-workspace-brainvault.spec.ts',
    'tests/react-candidate/ops/panels/brainvault/ops-brainvault-destination.spec.ts',
    'tests/react-candidate/ops/panels/brainvault/ops-brainvault-late-open.spec.ts',
  ],
} as const satisfies Readonly<Record<SurfaceId, readonly string[]>>;

export const CANDIDATE_BROWSER_READY_PATHS = {
  site: '/',
  docs: '/docs',
  wallet: '/testnet',
  ops: '/embed',
} as const satisfies Readonly<Record<SurfaceId, `/${string}`>>;

export const CANDIDATE_BROWSER_VIEWPORTS = [
  { name: 'mobile-390x844', viewport: { width: 390, height: 844 } },
  { name: 'laptop-1366x900', viewport: { width: 1366, height: 900 } },
  { name: 'wide-1920x1080', viewport: { width: 1920, height: 1080 } },
] as const;

export type CandidateBrowserCommand = Readonly<{
  argv: readonly string[];
  environment: Readonly<Record<string, string>>;
  scope: SurfaceId | 'candidate';
}>;

export type CandidateBrowserRun = CandidateBrowserCommand & Readonly<{
  project: (typeof CANDIDATE_BROWSER_VIEWPORTS)[number]['name'];
}>;

export const createCandidateBrowserSignalHandlers = (
  kill: (signal: 'SIGINT' | 'SIGTERM') => void,
) => ({
  interrupt: () => kill('SIGINT'),
  terminate: () => kill('SIGTERM'),
});

export const parseCandidateBrowserSurface = (rawValue: string | undefined): SurfaceId | null => {
  if (rawValue === undefined || rawValue === '') return null;
  const surface = SURFACE_IDS.find(surfaceId => surfaceId === rawValue);
  if (surface === undefined) throw new Error(`FRONTEND_BROWSER_SURFACE_UNKNOWN:${rawValue}`);
  return surface;
};

export const createCandidateBrowserCommand = (surfaceIds: readonly SurfaceId[]): CandidateBrowserCommand => {
  const selectedSurface = surfaceIds.length === 1 ? (surfaceIds[0] ?? null) : null;
  if (
    selectedSurface === null &&
    (surfaceIds.length !== SURFACE_IDS.length ||
      surfaceIds.some((surfaceId, index) => surfaceId !== SURFACE_IDS[index]))
  )
    throw new Error('FRONTEND_BROWSER_SURFACE_SELECTION_INVALID');
  return {
    argv: [
      'bunx',
      'playwright',
      'test',
      '--max-failures=1',
      '--config',
      'playwright.react.config.ts',
      ...(selectedSurface === null ? [] : CANDIDATE_BROWSER_TEST_FILES[selectedSurface]),
    ],
    environment: { PLAYWRIGHT_REACT_SURFACE: selectedSurface ?? '' },
    scope: selectedSurface ?? 'candidate',
  };
};

export const createCandidateBrowserRuns = (
  command: CandidateBrowserCommand,
): readonly CandidateBrowserRun[] => CANDIDATE_BROWSER_VIEWPORTS.map(({ name }, index) => ({
  ...command,
  project: name,
  argv: [...command.argv, `--project=${name}`],
  environment: {
    ...command.environment,
    PLAYWRIGHT_REACT_RUN_SCOPE: name,
    PLAYWRIGHT_REACT_PORT: String(19_080 + index * 10_000),
    PLAYWRIGHT_REACT_PORT_OFFSET: String(12_000 + index * 10_000),
  },
}));

const run = async (): Promise<void> => {
  const command = createCandidateBrowserCommand(parseSurfaceSelection(Bun.argv.slice(2)));
  for (const projectRun of createCandidateBrowserRuns(command)) {
    console.info(`FRONTEND_BROWSER_PROJECT_START scope=${command.scope} project=${projectRun.project}`);
    const child = Bun.spawn([...projectRun.argv], {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      env: { ...process.env, ...projectRun.environment },
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    });
    const signalHandlers = createCandidateBrowserSignalHandlers(signal => child.kill(signal));
    process.once('SIGINT', signalHandlers.interrupt);
    process.once('SIGTERM', signalHandlers.terminate);
    const exitCode = await child.exited.finally(() => {
      process.off('SIGINT', signalHandlers.interrupt);
      process.off('SIGTERM', signalHandlers.terminate);
    });
    if (exitCode !== 0) {
      throw new Error(`FRONTEND_BROWSER_TEST_FAILED:${command.scope}:${projectRun.project}:${exitCode}`);
    }
    console.info(`FRONTEND_BROWSER_PROJECT_OK scope=${command.scope} project=${projectRun.project}`);
  }
  console.info(
    `FRONTEND_BROWSER_TEST_OK scope=${command.scope} projects=${CANDIDATE_BROWSER_VIEWPORTS.length}`,
  );
};

if (import.meta.main) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
