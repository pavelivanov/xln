import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('frontend/apps/wallet/src/onboarding/wallet-onboarding.tsx', 'utf8');

test('onboarding keeps identity and default credit limits primary', () => {
  const advancedStart = source.indexOf('<details className="wallet-onboarding-advanced">');
  expect(source.indexOf('<span>Display name</span>')).toBeLessThan(advancedStart);
  expect(source.indexOf('id="wallet-onboarding-limits">Default limits</h3>')).toBeLessThan(advancedStart);
  expect(source.indexOf('Initial hub join')).toBeGreaterThan(advancedStart);
  expect(source.indexOf('id="wallet-onboarding-jurisdictions">Jurisdictions</h3>')).toBeGreaterThan(advancedStart);
  expect(source.indexOf('<WalletRecoveryServices runtimeState={runtimeState} onDraftChange={setRecovery}', advancedStart)).toBeGreaterThan(advancedStart);
});

test('Brain Vault onboarding does not expose or require mnemonic backup controls', () => {
  expect(source).not.toContain('Download sheet');
  expect(source).not.toContain('Show seed');
  expect(source).not.toContain('Copy seed');
  expect(source).not.toContain('Save the offline recovery sheet');
});
