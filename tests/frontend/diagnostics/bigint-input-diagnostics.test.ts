import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('React wallet amount input exposes validation and submission failures without raw console output', () => {
  const source = readFileSync('frontend/apps/wallet/src/move/wallet-move.tsx', 'utf8');

  expect(source).toContain("let requestedAmount = 0n, amountError = '';");
  expect(source).toContain('requestedAmount = parsePositiveAssetAmount(amount, token)');
  expect(source).toContain('const validation =');
  expect(source).toContain('{validation ? <p role="status">{validation}</p> : null}');
  expect(source).toContain('disabled={Boolean(validation)}');
  expect(source).toContain('{error ? <p role="alert">{error}</p> : null}');
  expect(source).not.toContain('console.warn');
  expect(source).not.toContain('console.error');
});
