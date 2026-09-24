import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('React address pages expose Runtime and history read failures without raw console output', () => {
  const source = readFileSync('frontend/apps/wallet/src/address/wallet-address-source.ts', 'utf8');
  const view = readFileSync('frontend/apps/wallet/src/address/wallet-address.tsx', 'utf8');
  const combined = `${source}\n${view}`;

  expect(source).toContain("return { status: 'error', message: snapshot.error, projection: null };");
  expect(source).toContain('historyError: walletRuntimeReadErrorMessage(error)');
  expect(source).toContain("this.publish({ status: 'error', message: walletRuntimeReadErrorMessage(error), projection: null });");
  expect(view).toContain("role={error ? 'alert' : 'status'}");
  expect(view).toContain('Activity history is unavailable: {projection.historyError}');
  expect(view).toContain('role="alert"');
  expect(combined).not.toContain('console.error');
  expect(combined).not.toContain('console.warn');
  expect(combined).not.toContain('console.info');
});
