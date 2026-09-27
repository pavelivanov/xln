import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  findRetiredFrontendSourceFiles,
  RETIRED_FRONTEND_SOURCE_ALLOWLIST,
} from '../../../core/scripts/checks/policy/retired-frontend-source';

const temporaryRoots: string[] = [];
const repositoryRoot = join(import.meta.dir, '../../..');
const policyDirectory = join(repositoryRoot, 'core/scripts/checks/policy');
const sourcePolicyPath = readdirSync(policyDirectory)
  .filter(name => name.startsWith('check-no-') && name.endsWith('.ts'))
  .map(name => join(policyDirectory, name))
  .find(path => readFileSync(path, 'utf8').includes("from './retired-frontend-source'"));

if (!sourcePolicyPath) throw new Error('RETIRED_FRONTEND_SOURCE_POLICY_NOT_FOUND');

const sourcePolicy = (await import(sourcePolicyPath)) as {
  checkSourcePolicy: (repositoryRoot: string) => { scanned: number; allowlist: number };
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('the retired frontend source tree has no files or allowances', () => {
  expect(RETIRED_FRONTEND_SOURCE_ALLOWLIST).toEqual([]);
  expect(findRetiredFrontendSourceFiles()).toEqual([]);
});

test('the source policy rejects a new file beneath frontend/src', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'xln-retired-frontend-'));
  temporaryRoots.push(fixtureRoot);
  const fixture = join(fixtureRoot, 'frontend/src/resurrected.ts');
  mkdirSync(join(fixtureRoot, 'frontend/src'), { recursive: true });
  writeFileSync(fixture, 'export const resurrected = true;\n');

  expect(() => sourcePolicy.checkSourcePolicy(fixtureRoot)).toThrow(
    'RETIRED_FRONTEND_SOURCE_VIOLATION: frontend/src is retired and its allowlist is empty.\n' +
      'frontend/src/resurrected.ts',
  );
});

test('the source policy fails when its required scan roots are absent', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'xln-missing-source-roots-'));
  temporaryRoots.push(fixtureRoot);

  expect(() => sourcePolicy.checkSourcePolicy(fixtureRoot)).toThrow("scandir '");
  expect(() => sourcePolicy.checkSourcePolicy(fixtureRoot)).toThrow('/.github');
});
