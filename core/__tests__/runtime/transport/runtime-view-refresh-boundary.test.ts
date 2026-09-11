import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'frontend/bridges/runtime/runtime-view-store.ts'),
  'utf8',
);

test('runtime adapter changes discard the previous runtime height target', () => {
  const resetStart = source.indexOf('export const resetRuntimeView = (): void => {');
  const resetEnd = source.indexOf('\n};', resetStart);
  expect(resetStart).toBeGreaterThanOrEqual(0);
  // The shared coordinator owns the queued height and retry cancellation.
  // Its reset behavior is exercised by tests/frontend/runtime/view/runtime-view-catchup.test.ts.
  expect(source.slice(resetStart, resetEnd)).toContain('runtimeViewCatchup.reset();');
});
