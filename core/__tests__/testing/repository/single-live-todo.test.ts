import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const checker = resolve(import.meta.dir, '../../../scripts/checks/repository/check-single-live-todo.ts');

const checkBacklog = (extraPath: string) => {
  const root = mkdtempSync(join(tmpdir(), 'xln-live-todo-'));
  try {
    writeFileSync(join(root, 'todo.md'), '# The only live TODO/NEXT file\n');
    const extra = join(root, extraPath);
    mkdirSync(dirname(extra), { recursive: true });
    writeFileSync(extra, '# Copied or competing backlog\n');
    const result = Bun.spawnSync(['bun', checker], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    return { code: result.exitCode, error: new TextDecoder().decode(result.stderr) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('ignores the backlog copy bundled into an immutable frontend release', () => {
  expect(checkBacklog('frontend/.artifacts/releases/sha256-test/docs-catalog/todo.md').code).toBe(0);
});

test.each(['frontend/apps/wallet/todo.md', 'frontend/.artifacts-source/next.md', 'docs/next.md'])(
  'still rejects a competing source backlog at %s',
  path => {
    const result = checkBacklog(path);
    expect(result.code).toBe(1);
    expect(result.error).toContain(`stale live backlog candidate found: ${path}`);
  },
);
