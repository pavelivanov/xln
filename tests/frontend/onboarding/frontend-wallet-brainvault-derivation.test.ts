import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string): string => readFileSync(path, 'utf8');

describe('React wallet Brain Vault derivation boundary', () => {
  test('uses the canonical versioned browser worker and validated shard protocol', () => {
    const runtime = read('frontend/bridges/wallet-brainvault-worker-runtime.ts');
    const derivation = read('frontend/bridges/wallet-brainvault-browser-derivation.ts');
    const finalization = read('frontend/bridges/wallet-brainvault-material-finalization.ts');

    expect(runtime).toContain('/brainvault-worker.js?spec=');
    expect(runtime).toContain('BRAINVAULT_V1_SPEC_ID');
    expect(runtime).toContain('decodeWalletBrainVaultWorkerMessage(');
    expect(derivation).toContain('validateWalletBrainVaultShardCompletion(');
    expect(derivation).toContain('resolveWalletBrainVaultShardDispatch(');
    expect(derivation).toContain('resolveWalletBrainVaultShardRetry(');
    expect(derivation).toContain('run.workers.size >= run.workerTarget');
    expect(derivation).toContain('rejectRun(run, failure)');
    expect(runtime).toContain('worker.onmessage = null');
    expect(finalization).toContain('resolveWalletBrainVaultFinalizationShardOrder(');
    expect(finalization).toContain("deriveKey(master, 'bip39/entropy/v1.0', 32)");
    expect(finalization.match(/if \(!isCurrent\(\)\)/g)?.length).toBeGreaterThanOrEqual(6);
  });

  test('keeps derived secret material in a one-shot migration bridge session', () => {
    const onboarding = read('frontend/apps/wallet/src/identity-onboarding.tsx');
    const embedded = read('frontend/apps/wallet/src/wallet-embedded-runtime.ts');
    const bridge = read('frontend/bridges/wallet-canonical-vault-runtime.ts');

    expect(onboarding).toContain("setDraft(current => ({ ...current, passphrase: '', showPassphrase: false }))");
    expect(onboarding).toContain('await prepareWalletBrainVaultWithCanonicalVault(');
    expect(onboarding).not.toContain('setMnemonic24');
    expect(onboarding).not.toContain('setDevicePassphrase');
    expect(embedded).toContain('canonical.prepareCanonicalWalletBrainVault(input, onProgress)');
    expect(bridge).toContain('new WalletBrainVaultMaterialSession<WalletBrainVaultDerivedMaterial>()');
    expect(bridge).toContain('brainVaultMaterials.consume(token, runtimeId)');
    expect(bridge.indexOf('brainVaultMaterials.consume(token, runtimeId)'))
      .toBeLessThan(bridge.indexOf('openCanonicalWalletRuntime(request, recoveryToken'));
  });

  test('discovers recovery before authorizing fresh canonical opening', () => {
    const bridge = read('frontend/bridges/wallet-canonical-vault-runtime.ts');
    const recovery = read('frontend/apps/wallet/src/identity-recovery.tsx');

    expect(bridge.indexOf('await brainVaultDerivation.derive(input, onProgress)'))
      .toBeLessThan(bridge.indexOf('await discoverCanonicalWalletRuntimeRecoveryView('));
    expect(bridge.indexOf('await discoverCanonicalWalletRuntimeRecoveryView('))
      .toBeLessThan(bridge.indexOf('brainVaultMaterials.commit(revision, material)'));
    expect(recovery).toContain('Create and open wallet');
    expect(recovery).toContain('Derived wallet material remains outside React state.');
    expect(recovery).toContain('Fresh creation is blocked.');
  });
});
