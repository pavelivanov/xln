import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { frontendScanRoots } from '../../../frontend/scripts/checks/check-unsafe-types';

const REPOSITORY_ROOT = join(import.meta.dir, '../../..');
const FRONTEND_ROOT = join(REPOSITORY_ROOT, 'frontend');

describe('frontend unsafe type scan ownership', () => {
  test('scans every canonical React source root without requiring retired Svelte src', () => {
    const roots = frontendScanRoots(FRONTEND_ROOT);

    expect(roots.map(root => relative(FRONTEND_ROOT, root))).toEqual([
      'apps',
      'packages',
      'bridges',
      'config',
      'scripts',
    ]);
    expect(roots.every(existsSync)).toBe(true);
  });
});
