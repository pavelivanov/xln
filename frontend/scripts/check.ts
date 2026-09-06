import { fileURLToPath } from 'node:url';
import type { SurfaceId } from '../config/surfaces';
import { runCommands, type CommandSpec } from './command-runner';
import { createBuildCommands } from './build';
import { parseCheckRequest, selectChangedSurfaces, type CheckRequest } from './check-request';

export { parseCheckRequest, selectChangedSurfaces } from './check-request';

export const createLocalCheckCommands = (surfaceIds: readonly SurfaceId[]): readonly CommandSpec[] => [
  { label: 'frontend-unsafe-types', argv: ['bun', 'scripts/check-unsafe-types.ts'] },
  { label: 'react-tooling', argv: ['bunx', 'tsc', '-p', 'tsconfig.react-tooling.json'] },
  ...surfaceIds.map(surfaceId => ({ label: `react-${surfaceId}`, argv: ['bunx', 'tsc', '-p', `apps/${surfaceId}/tsconfig.json`] })),
];

export const createCheckCommands = (request: CheckRequest): readonly CommandSpec[] => {
  const commands = [...createLocalCheckCommands(request.surfaceIds)];
  if (request.level === 'local' || request.surfaceIds.length === 0) return commands;
  if (request.level === 'frontend') commands.push({ label: 'frontend-contracts', cwd: fileURLToPath(new URL('../..', import.meta.url)), argv: [
    'bun', 'test', 'tests/frontend/tooling/frontend-route-ownership.test.ts',
    'tests/frontend/tooling/frontend-candidate-assembly.test.ts',
    'tests/frontend/tooling/frontend-platform-inventory.test.ts',
    'tests/frontend/tooling/frontend-shared-boundaries.test.ts',
  ] });
  for (const surface of request.surfaceIds) commands.push({ label: `prepare-${surface}`, argv: ['bun', 'scripts/prepare.ts', `--surface=${surface}`] });
  commands.push(...createBuildCommands(request.surfaceIds));
  if (request.level === 'slice' && request.spec) commands.push({
    label: 'slice-browser', argv: ['bunx', 'playwright', 'test', '--config', 'playwright.react.config.ts', request.spec],
    environment: { PLAYWRIGHT_REACT_SURFACE: request.surfaceIds[0] ?? '' },
  });
  if (request.level === 'frontend' && request.surfaceIds.length === 4) commands.push({ label: 'assemble-candidate', argv: ['bun', 'scripts/assemble.ts'] });
  return commands;
};

const gitOutput = async (args: string[]): Promise<string> => {
  const child = Bun.spawn(['git', ...args], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)), stdout: 'pipe', stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code !== 0) throw new Error(`FRONTEND_CHECK_GIT_FAILED:${stderr.trim()}`);
  return stdout;
};

const run = async (): Promise<void> => {
  let request = parseCheckRequest(Bun.argv.slice(2));
  if (request.changedFrom) {
    const sha = (await gitOutput(['rev-parse', '--verify', '--end-of-options', `${request.changedFrom}^{commit}`])).trim();
    const changed = await Promise.all([
      gitOutput(['diff', '--name-only', '-z', sha, '--']),
      gitOutput(['ls-files', '--others', '--exclude-standard', '-z']),
    ]);
    request = { ...request, surfaceIds: selectChangedSurfaces(changed.flatMap(output => output.split('\0').filter(Boolean))) };
  }
  const commands = createCheckCommands(request);
  if (request.explain) {
    console.info(commands.map(({ label, argv, environment }) => `${label}: ${Object.entries(environment ?? {}).map(([key, value]) => `${key}=${value}`).join(' ')} ${argv.join(' ')}`.trim()).join('\n'));
    return;
  }
  await runCommands(commands);
  console.info(`FRONTEND_CHECK_OK surfaces=${request.surfaceIds.join(',')} level=${request.level}`);
};

if (import.meta.main) run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
