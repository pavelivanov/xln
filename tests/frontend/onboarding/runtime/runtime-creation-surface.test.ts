import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('frontend/apps/wallet/src/identity/identity-entry-form.tsx', 'utf8');
const reactTestnet = readFileSync('frontend/apps/wallet/src/testnet/testnet-page.tsx', 'utf8');

test('wallet entry contains only the canonical Brain Vault and mnemonic choices', () => {
  expect(source).toContain('id={`identity-mode-${mode}`}');
  expect(source).toContain("(['brainvault', 'mnemonic'] as const).map");
  expect(source).not.toContain('identity-mode-testnet');
  expect(source).not.toContain("acceptRecoveryRehearsal('brainvault'");
  expect(source).not.toContain('Download sheet');
});

test('disposable identities and destructive reset live on the dedicated testnet page', () => {
  expect(reactTestnet).toContain('DEMO_ACCOUNTS');
  expect(reactTestnet).toContain('Delete local testnet data');
  expect(reactTestnet).toContain("reason: 'testnet-tools'");
});
