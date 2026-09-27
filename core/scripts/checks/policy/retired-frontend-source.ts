import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RETIRED_FRONTEND_SOURCE_ROOT = 'frontend/src';
export const RETIRED_FRONTEND_SOURCE_ALLOWLIST: readonly string[] = [];

const listTreeFiles = (directory: string): string[] =>
  existsSync(directory)
    ? readdirSync(directory, {
        withFileTypes: true,
      }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? listTreeFiles(path) : [path];
      })
    : [];

const repoRelativePath = (repositoryRoot: string, path: string): string =>
  relative(repositoryRoot, path).split(sep).join('/');

export const findRetiredFrontendSourceFiles = (repositoryRoot = process.cwd()): readonly string[] =>
  listTreeFiles(join(repositoryRoot, RETIRED_FRONTEND_SOURCE_ROOT))
    .map(path => repoRelativePath(repositoryRoot, path))
    .filter(path => !RETIRED_FRONTEND_SOURCE_ALLOWLIST.includes(path))
    .sort((left, right) => left.localeCompare(right));

export const assertRetiredFrontendSourceIsEmpty = (repositoryRoot: string): void => {
  const paths = findRetiredFrontendSourceFiles(repositoryRoot);
  if (paths.length === 0) return;
  throw new Error(
    'RETIRED_FRONTEND_SOURCE_VIOLATION: frontend/src is retired and its allowlist is empty.\n' + paths.join('\n'),
  );
};
