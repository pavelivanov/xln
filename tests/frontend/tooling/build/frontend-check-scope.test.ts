import { describe, expect, test } from 'bun:test';
import { runCommands } from '../../../../frontend/scripts/shared/command-runner';
import { readFileSync } from 'node:fs';

import {
  createCheckCommands,
  createLocalCheckCommands,
  parseCheckRequest,
  selectChangedSurfaces,
} from '../../../../frontend/scripts/check';
import { parseSurfaceSelection } from '../../../../frontend/scripts/shared/surface-selection';

describe('scoped frontend checks', () => {
  test('slice builds the selected app and runs exactly its registered browser spec', () => {
    const commands = createCheckCommands(
      parseCheckRequest([
        '--surface=ops',
        '--level=slice',
        '--spec=tests/react-candidate/ops/workspace/ops-workspace-session.spec.ts',
      ]),
    );
    expect(commands.map(command => command.label)).toEqual([
      'frontend-unsafe-types',
      'react-tooling',
      'react-ops',
      'prepare-ops',
      'build-ops',
      'slice-browser',
    ]);
    expect(commands.at(-1)?.environment).toEqual({ PLAYWRIGHT_REACT_SURFACE: 'ops' });
    expect(commands.at(-1)?.argv.at(-1)).toBe('tests/react-candidate/ops/workspace/ops-workspace-session.spec.ts');
    expect(() =>
      parseCheckRequest(['--surface=ops', '--level=slice', '--spec=tests/react-candidate/wallet.spec.ts']),
    ).toThrow('FRONTEND_CHECK_SLICE_SPEC_REQUIRED');
    expect(() => parseCheckRequest(['--all', '--level=slice'])).toThrow('FRONTEND_CHECK_SLICE_SPEC_REQUIRED');
  });

  test('frontend contracts remain mandatory and only a full build assembles a release', () => {
    const single = createCheckCommands(parseCheckRequest(['--surface=docs', '--level=frontend']));
    expect(single.find(command => command.label === 'frontend-contracts')?.argv).toContain(
      'tests/frontend/tooling/frontend-shared-boundaries.test.ts',
    );
    expect(single.find(command => command.label === 'frontend-contracts')?.cwd).toBe(`${process.cwd()}/`);
    expect(single.some(command => command.label === 'assemble-candidate')).toBe(false);
    expect(createCheckCommands(parseCheckRequest(['--all', '--level=frontend'])).at(-1)?.label).toBe(
      'assemble-candidate',
    );
  });

  test('full frontend acceptance runs every unit once before preparation and assembly', () => {
    const commands = createCheckCommands(parseCheckRequest(['--all', '--level=frontend']));
    const units = commands.filter(command => command.argv[1] === 'test');
    expect(units).toHaveLength(1);
    expect(units[0]?.argv).toEqual(['bun', 'test', 'tests/frontend']);
    expect(units[0]?.cwd).toBe(`${process.cwd()}/`);
    expect(commands.findIndex(command => command.label === 'frontend-units')).toBeLessThan(
      commands.findIndex(command => command.label.startsWith('prepare-')),
    );
    expect(
      createCheckCommands(parseCheckRequest(['--all', '--level=local'])).some(command => command.argv[1] === 'test'),
    ).toBe(false);
  });

  test('a failed unit process prevents subsequent preparation from running', async () => {
    await expect(
      runCommands([
        { label: 'frontend-units', argv: ['bun', '-e', 'process.exit(19)'], cwd: process.cwd() },
        { label: 'must-not-run', argv: ['bun', '-e', 'process.exit(23)'], cwd: process.cwd() },
      ]),
    ).rejects.toThrow('FRONTEND_STEP_FAILED:frontend-units:19');
  });

  test('changed paths include all apps for shared or unknown ownership', () => {
    expect(parseCheckRequest(['--changed-from=HEAD', '--level=local']).changedFrom).toBe('HEAD');
    expect(selectChangedSurfaces(['frontend/apps/ops/src/main.tsx'])).toEqual(['ops']);
    expect(selectChangedSurfaces(['plans/readme.md'])).toEqual([]);
    expect(
      selectChangedSurfaces([
        'frontend/apps/wallet/src/main.tsx',
        'frontend/packages/browser/src/preferences/display-preferences.ts',
      ]),
    ).toEqual(['site', 'docs', 'wallet', 'ops']);
    expect(selectChangedSurfaces(['package.json'])).toEqual(['site', 'docs', 'wallet', 'ops']);
    expect(() => parseCheckRequest(['--surface=site', '--changed-from=HEAD'])).toThrow(
      'FRONTEND_CHECK_CHANGE_SELECTION_INVALID',
    );
  });

  test('accepts canonical explicit TypeScript imports without emitting', () => {
    const config = JSON.parse(readFileSync('frontend/tsconfig.react-base.json', 'utf8')) as {
      compilerOptions?: Record<string, unknown>;
    };
    expect(config.compilerOptions?.['moduleResolution']).toBe('Bundler');
    expect(config.compilerOptions?.['allowImportingTsExtensions']).toBe(true);
    expect(config.compilerOptions?.['noEmit']).toBe(true);
  });

  test('selects one surface without broad repository commands', () => {
    const request = parseCheckRequest(['--surface=site', '--level=local']);
    const commands = createLocalCheckCommands(request.surfaceIds);
    expect(commands.map(({ label }) => label)).toEqual(['frontend-unsafe-types', 'react-tooling', 'react-site']);
    expect(commands.flatMap(({ argv }) => argv).join(' ')).not.toContain('bun run check');
    expect(commands.flatMap(({ argv }) => argv).join(' ')).not.toContain('apps/docs');
  });

  test('selects every surface explicitly', () => {
    expect(parseSurfaceSelection(['--all'])).toEqual(['site', 'docs', 'wallet', 'ops']);
  });

  test('rejects ambiguous or unsupported requests', () => {
    expect(() => parseSurfaceSelection([])).toThrow('FRONTEND_SURFACE_REQUIRED');
    expect(() => parseSurfaceSelection(['--surface=site', '--all'])).toThrow('FRONTEND_SURFACE_SELECTION_CONFLICT');
    expect(() => parseCheckRequest(['--surface=site', '--level=repository'])).toThrow(
      'FRONTEND_CHECK_LEVEL_UNSUPPORTED',
    );
  });
});
