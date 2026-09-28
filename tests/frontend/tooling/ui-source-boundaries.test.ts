import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { importSpecifiers, resolveSourceImport } from '../../../frontend/scripts/checks/source-imports';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const UI_ROOT = 'ui';

const walkTypeScript = async (root: string): Promise<readonly string[]> => {
  const entries = await readdir(join(REPOSITORY_ROOT, root), { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const pathname = `${root}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...(await walkTypeScript(pathname)));
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) paths.push(pathname);
  }
  return paths.sort((left, right) => left.localeCompare(right));
};

describe('retained ui source boundaries', () => {
  test('does not import retired frontend/src modules or unresolved frontend/lib aliases', async () => {
    const paths = await walkTypeScript(UI_ROOT);
    const violations: string[] = [];

    for (const pathname of paths) {
      const source = await readFile(join(REPOSITORY_ROOT, pathname), 'utf8');
      for (const specifier of importSpecifiers(source)) {
        const target = resolveSourceImport(pathname, specifier);
        if (
          target === 'frontend/src' ||
          target.startsWith('frontend/src/') ||
          specifier === '@xln/frontend/lib' ||
          specifier.startsWith('@xln/frontend/lib/')
        )
          violations.push(`${pathname}: ${specifier} -> ${target}`);
      }
    }

    expect(paths.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  }, 30_000);

  test('keeps the retained ui typecheck in the canonical root check', async () => {
    const packageJson = JSON.parse(await readFile(join(REPOSITORY_ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['check:ui']).toBe('cd ui && bun run check');
    expect(packageJson.scripts?.['check:long']?.split(/\s+/)).toContain('check:ui');
  });
});
