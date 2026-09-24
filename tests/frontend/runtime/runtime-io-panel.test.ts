import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('RuntimeIOPanel renders compact projections instead of raw RuntimeReplica dumps', () => {
  const source = readFileSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-io-panel.tsx', 'utf8');

  expect(source).toContain('R → E → A event stack');
  expect(source).toContain('Structured data present; use the typed activity projection for details.');
  expect(source).not.toContain('safeStringify');
  expect(source).not.toContain('Full State JSON');
  expect(source).not.toContain('Full Frame JSON');
  expect(source).not.toContain('Runtime Input');
  expect(source).not.toContain('Runtime Outputs');
  expect(source).not.toContain('class="json-block"');
  expect(source).not.toContain('class="json-mini"');
  expect(source).not.toContain('class="json-block-small"');
});
