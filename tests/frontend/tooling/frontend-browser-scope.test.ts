import { describe, expect, test } from 'bun:test';

import packageJson from '../../../frontend/package.json';
import { SURFACE_IDS } from '../../../packages/frontend-release/surfaces';
import {
  CANDIDATE_BROWSER_TEST_FILES,
  CANDIDATE_BROWSER_READY_PATHS,
  CANDIDATE_BROWSER_VIEWPORTS,
  createCandidateBrowserCommand,
  createCandidateBrowserRuns,
  createCandidateBrowserSignalHandlers,
  parseCandidateBrowserSurface,
} from '../../../frontend/scripts/testing/test-react-candidate';

describe('React candidate browser scope', () => {
  test('selects only the requested surface files and process environment', () => {
    const command = createCandidateBrowserCommand(['site']);
    expect(command.scope).toBe('site');
    expect(command.environment).toEqual({ PLAYWRIGHT_REACT_SURFACE: 'site' });
    expect(command.argv.slice(-2)).toEqual(CANDIDATE_BROWSER_TEST_FILES.site);
    expect(command.argv.join(' ')).not.toContain('docs.spec.ts');
    expect(command.argv.join(' ')).not.toContain('cross-surface.spec.ts');
    expect(CANDIDATE_BROWSER_READY_PATHS).toEqual({
      site: '/',
      docs: '/docs',
      wallet: '/testnet',
      ops: '/embed',
    });
  });

  test('keeps the full candidate command broad and clears inherited scope', () => {
    const command = createCandidateBrowserCommand(SURFACE_IDS);
    expect(command).toEqual({
      argv: ['bunx', 'playwright', 'test', '--max-failures=1', '--config', 'playwright.react.config.ts'],
      environment: { PLAYWRIGHT_REACT_SURFACE: '' },
      scope: 'candidate',
    });
  });

  test('runs every viewport against a fresh server and evidence directory', () => {
    const runs = createCandidateBrowserRuns(createCandidateBrowserCommand(SURFACE_IDS));
    expect(runs.map(({ project }) => project)).toEqual(
      CANDIDATE_BROWSER_VIEWPORTS.map(({ name }) => name),
    );
    expect(runs.map(({ argv }) => argv.at(-1))).toEqual(
      CANDIDATE_BROWSER_VIEWPORTS.map(({ name }) => `--project=${name}`),
    );
    expect(new Set(runs.map(({ environment }) => environment['PLAYWRIGHT_REACT_PORT'])).size).toBe(3);
    expect(new Set(runs.map(({ environment }) => environment['PLAYWRIGHT_REACT_PORT_OFFSET'])).size).toBe(3);
    for (const run of runs) {
      expect(run.environment['PLAYWRIGHT_REACT_RUN_SCOPE']).toBe(run.project);
    }
  });

  test('forwards runner interrupts to the active Playwright child', () => {
    const signals: string[] = [];
    const handlers = createCandidateBrowserSignalHandlers(signal => signals.push(signal));
    handlers.interrupt();
    handlers.terminate();
    expect(signals).toEqual(['SIGINT', 'SIGTERM']);
  });

  test('publishes one browser and development command per surface', () => {
    const scripts = packageJson.scripts as Readonly<Record<string, string>>;
    for (const surface of SURFACE_IDS) {
      expect(scripts[`test:react:${surface}`]).toBe(
        `bun scripts/testing/test-react-candidate.ts --surface=${surface}`,
      );
      expect(scripts[`dev:react:${surface}`]).toBe(`bun scripts/dev.ts --surface=${surface}`);
    }
  });

  test('keeps every Health acceptance spec in the Ops-only browser command', () => {
    expect(CANDIDATE_BROWSER_TEST_FILES.ops).toContain(
      'tests/react-candidate/ops/ops-health-events.spec.ts',
    );
    expect(CANDIDATE_BROWSER_TEST_FILES.ops).toContain(
      'tests/react-candidate/ops/ops-health-topology.spec.ts',
    );
  });

  test('rejects unknown or structurally partial surface selection', () => {
    expect(parseCandidateBrowserSurface(undefined)).toBeNull();
    expect(parseCandidateBrowserSurface('')).toBeNull();
    expect(parseCandidateBrowserSurface('wallet')).toBe('wallet');
    expect(() => parseCandidateBrowserSurface('runtime')).toThrow(
      'FRONTEND_BROWSER_SURFACE_UNKNOWN:runtime',
    );
    expect(() => createCandidateBrowserCommand(['site', 'docs'])).toThrow(
      'FRONTEND_BROWSER_SURFACE_SELECTION_INVALID',
    );
  });
});
