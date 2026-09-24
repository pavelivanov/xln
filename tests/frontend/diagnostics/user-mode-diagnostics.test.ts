import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('React wallet shell exposes Runtime and recovery diagnostics without raw console output', () => {
  const shell = readFileSync('frontend/apps/wallet/src/app-shell.tsx', 'utf8');
  const onboarding = readFileSync('frontend/apps/wallet/src/onboarding/wallet-onboarding.tsx', 'utf8');

  expect(shell).toContain("const [recoveryError, setRecoveryError] = useState('');");
  expect(shell).toContain('Local Runtime boot failed.');
  expect(shell).toContain('data-testid="storage-schema-recover"');
  expect(shell).toContain('{recoveryError ? <span role="alert">{recoveryError}</span> : null}');
  expect(onboarding).toContain('role="alert"');
  expect(`${shell}\n${onboarding}`).not.toContain('console.error');
  expect(`${shell}\n${onboarding}`).not.toContain('console.warn');
  expect(`${shell}\n${onboarding}`).not.toContain('console.info');
});
