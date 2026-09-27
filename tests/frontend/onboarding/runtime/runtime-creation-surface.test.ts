import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('frontend/apps/wallet/src/identity/identity-entry-form.tsx', 'utf8');
const reactTestnet = readFileSync('frontend/apps/wallet/src/testnet/testnet-page.tsx', 'utf8');
const walletShell = readFileSync('frontend/apps/wallet/src/app-shell.tsx', 'utf8');

test('wallet entry contains only the canonical Brain Vault and mnemonic choices', () => {
  expect(source).toContain('id={`identity-mode-${mode}`}');
  expect(source).toContain("props.modeOptions ?? ['brainvault', 'mnemonic']");
  expect(source).toContain('modeOptions.map((mode)');
  expect(source).not.toContain('identity-mode-testnet');
  expect(source).not.toContain("acceptRecoveryRehearsal('brainvault'");
  expect(source).not.toContain('Download sheet');
});

test('disposable identities and destructive reset live on the dedicated testnet page', () => {
  expect(reactTestnet).toContain('DEMO_ACCOUNTS');
  expect(reactTestnet).toContain('Delete local testnet data');
  expect(reactTestnet).toContain("reason: 'testnet-tools'");
});

test('paired-daemon owner setup stays out of the normal wallet entry bundle', () => {
  expect(walletShell).toContain("lazy(() => import('./onboarding/wallet-daemon-owner')");
  expect(walletShell).not.toContain("from './onboarding/wallet-daemon-owner'");
});
