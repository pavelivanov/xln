import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'frontend/bridges/wallet/canonical/wallet-canonical-external-provider.ts'),
  'utf8',
);

const section = (start: string, end: string): string => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
};

test('ERC20 approval pins signer authority before every await and verifies on the same adapter', () => {
  const approval = section('export const approveCanonicalWalletExternalAsset', '};\n');
  expect(approval).toContain('const context = await assertCurrent(request.binding);');
  expect(approval).toContain('const privateKey = requirePrivateKey(context);');
  expect(approval).toContain('await assertCurrent(request.binding);');
  expect(approval).toContain('await context.adapter.approveErc20(');
  expect(approval).toContain('await context.adapter.getErc20Allowance(');
  expect(approval).not.toContain('getActiveSignerPrivateKey()');
  expect(approval.indexOf('await assertCurrent(request.binding);')).toBeLessThan(
    approval.indexOf('await context.adapter.approveErc20'),
  );
});

test('external transfer cannot pair a captured adapter with a later signer key', () => {
  const transfer = section('export const transferCanonicalWalletExternalAsset', 'export const approveCanonicalWalletExternalAsset');
  expect(transfer).toContain('const context = await assertCurrent(request.binding);');
  expect(transfer).toContain('const privateKey = requirePrivateKey(context);');
  expect(transfer).toContain('await assertCurrent(request.binding);');
  expect(transfer).toContain('context.adapter.transferErc20(privateKey');
  expect(transfer).not.toContain('getActiveSignerPrivateKey()');
});
