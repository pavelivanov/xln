import { describe, expect, test } from 'bun:test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { importSpecifiers, resolveSourceImport } from '../../../frontend/scripts/checks/source-imports';

import { CAPABILITIES } from '../../../frontend/config/capabilities';
import { PLATFORM_INVENTORY } from '../../../frontend/config/platform-inventory';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const PACKAGE_ROOTS = ['frontend/packages/browser/src', 'frontend/packages/runtime-client/src'] as const;
const ALL_PACKAGE_ROOTS = [...PACKAGE_ROOTS, 'frontend/packages/ui/src'] as const;

const ALLOWED_BROWSER_SAFE_CORE_IMPORTS = [
  '../../../../../../core/config/remote-runtime',
  '../../../../../core/config/remote-runtime',
  '@xln/core/api/public/runtime-module',
  '@xln/core/api/public/runtime-module-guard',
  '@xln/core/api/runtime-adapter/security/owner-binding',
  '@xln/core/config/qa',
  '@xln/core/protocol/serialization',
  '@xln/core/qa/hlt/hlt-dashboard-preview',
  '@xln/core/qa/severity',
  '@xln/core/qa/types',
  '@xln/core/runtime/decode',
  // Pure logging type unions (LogLevel/LogCategory/FrameLogEntry, no
  // implementations) consumed by the shared panel view models.
  '@xln/core/types/logging',
] as const;

const walkFiles = async (root: string): Promise<readonly string[]> => {
  const entries = await readdir(join(REPOSITORY_ROOT, root), { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const pathname = `${root}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...(await walkFiles(pathname)));
    else if (entry.isFile()) paths.push(pathname);
  }
  return paths.sort((left, right) => left.localeCompare(right));
};

const readSources = async (roots: readonly string[]): Promise<ReadonlyMap<string, string>> => {
  const paths = (await Promise.all(roots.map(root => walkFiles(root)))).flat();
  return new Map(
    await Promise.all(
      paths.map(async pathname => [pathname, await readFile(join(REPOSITORY_ROOT, pathname), 'utf8')] as const),
    ),
  );
};

describe('frontend shared browser and Runtime-client boundaries', () => {
  test('keeps every shared module in the typed ownership inventory', async () => {
    const modules = (await Promise.all(PACKAGE_ROOTS.map(root => walkFiles(root)))).flat();
    const inventory = new Set([
      ...CAPABILITIES.flatMap(({ currentSources }) => currentSources),
      ...PLATFORM_INVENTORY.flatMap(({ sources }) => sources),
    ]);

    expect(modules.length).toBeGreaterThan(0);
    for (const module of modules) expect(inventory.has(module)).toBe(true);
  });

  test('has live React consumers for both shared packages', async () => {
    const consumers = await readSources(['frontend/apps']);
    for (const packageName of ['browser', 'runtime-client'] as const) {
      const marker = `packages/${packageName}/src`;
      const paths = [...consumers].filter(([, source]) => source.includes(marker)).map(([pathname]) => pathname);

      expect(paths.some(pathname => pathname.startsWith('frontend/apps/'))).toBe(true);
    }
  });

  test('does not import Runtime, Entity, Account, consensus, or persistence implementations', async () => {
    const sources = await readSources(PACKAGE_ROOTS);
    const coreImports = [...sources.values()]
      .flatMap(importSpecifiers)
      .filter(specifier => specifier.includes('/core/'));
    const source = [...sources.values()].join('\n');

    expect([...new Set(coreImports)].sort()).toEqual([...ALLOWED_BROWSER_SAFE_CORE_IMPORTS].sort());
    for (const forbidden of [
      'applyRuntimeInput',
      'applyEntityInput',
      'applyAccountInput',
      'computeFrameHash',
      'leftCreditLimit',
      'rightCreditLimit',
    ])
      expect(source.includes(forbidden)).toBe(false);
  });

  test('keeps browser persistence and lifecycle effects out of runtime-client', async () => {
    const sources = await readSources(['frontend/packages/runtime-client/src']);
    const source = [...sources.values()].join('\n');

    for (const browserEffect of [
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'BroadcastChannel',
      'navigator.locks',
      'navigator.serviceWorker',
      'new Worker',
    ])
      expect(source.includes(browserEffect)).toBe(false);
  });

  test('resolves retained paths, re-exports, type imports and literal dynamic imports', () => {
    const importer = 'frontend/packages/browser/src/wallet/wallet-formation.ts';
    const missed = '../../../../src/lib/components/Entity/onboarding/formation/formation-commands';
    expect(resolveSourceImport(importer, missed)).toBe(
      'frontend/src/lib/components/Entity/onboarding/formation/formation-commands',
    );
    expect(
      resolveSourceImport('frontend/bridges/vault/vault-store.ts', '../../src/lib/utils/identity/entityFactory'),
    ).toBe('frontend/src/lib/utils/identity/entityFactory');
    for (const specifier of ['$lib/stores/x', '@xln/frontend/src/lib/stores/x', '/frontend/src/lib/stores/x'])
      expect(resolveSourceImport(importer, specifier)).toBe('frontend/src/lib/stores/x');
    expect(
      importSpecifiers(`import type { X } from 'types'; export * from 'forward';
      import 'effects'; const lazy = import('lazy'); type T = import('type-query').T;
      // import('comment')
      const text = "import('string')";`),
    ).toEqual(['types', 'forward', 'effects', 'lazy', 'type-query']);
  });

  test('keeps apps, bridges and shared packages independent from retained source and Svelte', async () => {
    const sources = new Map(await readSources(['frontend/apps', 'frontend/bridges', ...ALL_PACKAGE_ROOTS]));
    // Map iteration also visits newly found modules: follow re-exports/config owners
    // outside the initial roots so a forwarding hop cannot hide a retained edge.
    for (const [pathname, source] of sources)
      for (const specifier of importSpecifiers(source)) {
        const target = resolveSourceImport(pathname, specifier);
        if (
          (!target.startsWith('frontend/') && !target.startsWith('packages/frontend-release/')) ||
          target.startsWith('frontend/src/')
        )
          continue;
        const resolved = [target, `${target}.ts`, `${target}.tsx`, `${target}.js`, `${target}/index.ts`].find(
          candidate => /\.[cm]?[jt]sx?$/.test(candidate) && existsSync(join(REPOSITORY_ROOT, candidate)),
        );
        if (resolved && !sources.has(resolved))
          sources.set(resolved, await readFile(join(REPOSITORY_ROOT, resolved), 'utf8'));
      }
    const violations = [...sources].flatMap(([pathname, source]) =>
      importSpecifiers(source).flatMap(specifier => {
        const target = resolveSourceImport(pathname, specifier);
        const app = pathname.match(/^frontend\/apps\/([^/]+)\//)?.[1];
        const retained = target === 'frontend/src' || target.startsWith('frontend/src/');
        const svelte = /^(svelte(?:\/|$)|@sveltejs\/|\$app(?:\/|$))/.test(specifier) || target.endsWith('.svelte');
        const crossApp =
          target.startsWith('frontend/apps/') &&
          (pathname.startsWith('frontend/packages/') ||
            (/\/(?:main|bootstrap)(?:\.[cm]?[jt]sx?)?$/.test(target) &&
              (!app || !target.startsWith(`frontend/apps/${app}/`))));
        return retained || svelte || crossApp ? [`${pathname}: ${specifier} -> ${target}`] : [];
      }),
    );
    expect(violations).toEqual([]);
    expect(
      (await readFile(join(REPOSITORY_ROOT, 'frontend/config/create-react-app-config.ts'), 'utf8')).includes("'$lib'"),
    ).toBe(false);
  });
});
