import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { walletRecoveryFileErrorMessage } from '../../../frontend/apps/wallet/src/identity-onboarding-model';

const read = (path: string): string => readFileSync(path, 'utf8');

describe('React wallet recovery file boundary', () => {
  test('decrypts and retains full file candidates only in the canonical bridge session', () => {
    const bridge = read('frontend/bridges/wallet-canonical-vault-runtime.ts');

    expect(bridge).toContain('parseRuntimeRecoveryCandidateFile(request.seed, file.contents');
    expect(bridge.indexOf('recoverySelection.read(token, runtimeId)'))
      .toBeLessThan(bridge.indexOf('parseRuntimeRecoveryCandidateFile(request.seed'));
    expect(bridge).toContain('if (candidate.runtimeId !== runtimeId)');
    expect(bridge.indexOf('if (candidate.runtimeId !== runtimeId)'))
      .toBeLessThan(bridge.indexOf('recoverySelection.update(token, runtimeId'));
    expect(bridge).toContain('recoverySelection.update(token, runtimeId, candidates => (');
    expect(bridge).toContain('mergeWalletRecoveryCandidate(candidates, candidate)');
    expect(bridge).toContain('return projectRecoveryCandidate(candidate)');
  });

  test('reads Brain Vault seed material without consuming its one-shot opening token', () => {
    const bridge = read('frontend/bridges/wallet-canonical-vault-runtime.ts');
    const embedded = read('frontend/apps/wallet/src/wallet-embedded-runtime.ts');
    const onboarding = read('frontend/apps/wallet/src/identity-onboarding.tsx');

    expect(bridge).toContain('brainVaultMaterials.read(token, runtimeId)');
    expect(bridge).toContain('importCanonicalWalletRuntimeRecoveryFile(');
    expect(onboarding).toContain('await importWalletIdentityRecoveryFile({');
    expect(onboarding).not.toContain('backupFileContents');
    expect(onboarding).not.toContain('parseRuntimeRecoveryCandidateFile');
    expect(embedded.match(/revision !== recoveryFileImportRevision/g)?.length).toBeGreaterThanOrEqual(3);
    expect(embedded).toContain('recoveryFileImportRevision += 1');
  });

  test('uses a genuine encrypted Runtime bundle in browser evidence', () => {
    const fixture = read('frontend/tests/react-candidate/wallet-recovery-fixture.ts');
    const browser = read('frontend/tests/react-candidate/wallet.spec.ts');

    expect(fixture).toContain('runtime.encryptRuntimeRecoveryBundle(bundle, seed)');
    expect(fixture).toContain('bundles: [brainVault.encrypted]');
    expect(browser).toContain("name: 'invalid-brainvault-backup.json'");
    expect(browser).toContain('fixture.recovery.brainVault.backupFileContents');
    expect(browser).toContain("name: /brainvault-backup\\.json/");
  });

  test('maps malformed, empty, mismatched, and cancelled imports without hiding unknown errors', () => {
    expect(walletRecoveryFileErrorMessage(new Error('RECOVERY_BACKUP_FILE_JSON_INVALID')))
      .toBe('Backup file is not valid recovery JSON.');
    expect(walletRecoveryFileErrorMessage(new Error('RECOVERY_BACKUP_FILE_EMPTY')))
      .toBe('Backup file contains no encrypted Runtime bundles.');
    expect(walletRecoveryFileErrorMessage(new Error('RECOVERY_BACKUP_FILE_RUNTIME_MISMATCH:a:b')))
      .toBe('Backup file does not match the verified wallet.');
    expect(walletRecoveryFileErrorMessage(new Error('WALLET_RECOVERY_FILE_IMPORT_CANCELLED')))
      .toBe('Backup import was cancelled.');
    expect(walletRecoveryFileErrorMessage(new Error('decrypt failed')))
      .toBe('Backup import failed: decrypt failed');
  });
});
