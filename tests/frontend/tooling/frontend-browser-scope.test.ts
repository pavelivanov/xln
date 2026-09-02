import { describe, expect, test } from 'bun:test';

import packageJson from '../../../frontend/package.json';
import { SURFACE_IDS } from '../../../frontend/config/surfaces';
import {
  CANDIDATE_BROWSER_TEST_FILES,
  CANDIDATE_BROWSER_READY_PATHS,
  createCandidateBrowserCommand,
  parseCandidateBrowserSurface,
} from '../../../frontend/scripts/test-react-candidate';

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
      argv: ['bunx', 'playwright', 'test', '--config', 'playwright.react.config.ts'],
      environment: { PLAYWRIGHT_REACT_SURFACE: '' },
      scope: 'candidate',
    });
  });

  test('publishes one browser and development command per surface', () => {
    const scripts = packageJson.scripts as Readonly<Record<string, string>>;
    for (const surface of SURFACE_IDS) {
      expect(scripts[`test:react:${surface}`]).toBe(
        `bun scripts/test-react-candidate.ts --surface=${surface}`,
      );
      expect(scripts[`dev:react:${surface}`]).toBe(`bun scripts/dev.ts --surface=${surface}`);
    }
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
