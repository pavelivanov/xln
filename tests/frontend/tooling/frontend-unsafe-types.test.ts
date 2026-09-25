import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FRONTEND_HANDWRITTEN_SOURCE_ROOTS } from '../../../frontend/config/source-roots';
import { frontendScanRoots } from '../../../frontend/scripts/checks/check-unsafe-types';

const REPOSITORY_ROOT = join(import.meta.dir, '../../..');
const FRONTEND_ROOT = join(REPOSITORY_ROOT, 'frontend');

describe('frontend unsafe type scan ownership', () => {
  test('scans every canonical React source root without requiring retired Svelte src', () => {
    const roots = frontendScanRoots(FRONTEND_ROOT);

    expect(FRONTEND_HANDWRITTEN_SOURCE_ROOTS).toEqual([
      'frontend/apps',
      'frontend/packages',
      'frontend/bridges',
      'frontend/config',
      'frontend/scripts',
    ]);
    expect(roots.map(root => `frontend/${relative(FRONTEND_ROOT, root)}`))
      .toEqual(FRONTEND_HANDWRITTEN_SOURCE_ROOTS);
    expect(roots.every(existsSync)).toBe(true);
  });
});
