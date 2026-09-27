import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  assertRetiredFrontendSourceIsEmpty,
  findRetiredFrontendSourceFiles,
  RETIRED_FRONTEND_SOURCE_ALLOWLIST,
} from '../../../core/scripts/checks/policy/retired-frontend-source';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('the retired frontend source tree has no files or allowances', () => {
  expect(RETIRED_FRONTEND_SOURCE_ALLOWLIST).toEqual([]);
  expect(findRetiredFrontendSourceFiles()).toEqual([]);
});

test('the source policy rejects a new file beneath frontend/src', () => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), 'xln-retired-frontend-'));
  temporaryRoots.push(repositoryRoot);
  const fixture = join(repositoryRoot, 'frontend/src/resurrected.ts');
  mkdirSync(join(repositoryRoot, 'frontend/src'), { recursive: true });
  writeFileSync(fixture, 'export const resurrected = true;\n');

  expect(() => assertRetiredFrontendSourceIsEmpty(repositoryRoot)).toThrow(
    'RETIRED_FRONTEND_SOURCE_VIOLATION: frontend/src is retired and its allowlist is empty.\n' +
      'frontend/src/resurrected.ts',
  );
});
