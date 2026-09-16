import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  countMnemonicWords,
  estimateBrainVaultWork,
  hasSupportedMnemonicWordCount,
  normalizeMnemonicPhrase,
} from '../../../../frontend/packages/ui/src/runtime-creation-model';

import {
  BRAINVAULT_SHARD_TIME_MAX_MS,
  normalizeWalletBrainVaultShardTimeSample,
} from '../../../../frontend/packages/browser/src/identity/wallet-brainvault-worker-validation';

describe('runtime creation', () => {
  test('accepts only the supported 12-word and 24-word mnemonic lengths', () => {
    const words12 = Array.from({ length: 12 }, (_, index) => `word${index + 1}`).join(' ');
    const words24 = Array.from({ length: 24 }, (_, index) => `word${index + 1}`).join('\n');

    expect(normalizeMnemonicPhrase(`  ${words12}  `)).toBe(words12);
    expect(countMnemonicWords(words24)).toBe(24);
    expect(hasSupportedMnemonicWordCount(words12)).toBe(true);
    expect(hasSupportedMnemonicWordCount(words24)).toBe(true);
    expect(hasSupportedMnemonicWordCount(`${words12} extra`)).toBe(false);
  });

  test('reports BrainVault time and memory work without password entropy claims', () => {
    expect(estimateBrainVaultWork(100, 256, 3_000, 4)).toEqual({
      recoveryMs: 75_000,
      totalMemoryWorkMb: 25_600,
    });
    expect(() => estimateBrainVaultWork(1.5, 256, 3_000, 1))
      .toThrow('BRAINVAULT_SHARD_COUNT_INVALID');
  });

  test('keeps shard timing telemetry bounded without failing valid derivation work', () => {
    expect(normalizeWalletBrainVaultShardTimeSample(Number.NaN)).toBeNull();
    expect(normalizeWalletBrainVaultShardTimeSample('3000')).toBeNull();
    expect(normalizeWalletBrainVaultShardTimeSample(1)).toBe(100);
    expect(normalizeWalletBrainVaultShardTimeSample(750_000)).toBe(750_000);
    expect(normalizeWalletBrainVaultShardTimeSample(BRAINVAULT_SHARD_TIME_MAX_MS * 2)).toBe(
      BRAINVAULT_SHARD_TIME_MAX_MS,
    );
  });

  test('keeps wallet identity inputs and worker cleanup at their canonical boundaries', () => {
    const form = readFileSync('frontend/apps/wallet/src/identity/identity-entry-form.tsx', 'utf8');
    const onboarding = readFileSync('frontend/apps/wallet/src/identity/identity-onboarding.tsx', 'utf8');
    const derivation = readFileSync(
      'frontend/bridges/wallet/brainvault/wallet-brainvault-browser-derivation.ts',
      'utf8',
    );

    expect(form).toContain("(['brainvault', 'mnemonic'] as const).map");
    expect(form).toContain('id="identity-panel-brainvault"');
    expect(form).toContain('id="identity-panel-mnemonic"');
    expect(form).not.toContain('wallet-panel-testnet');
    expect(form).not.toContain('live-runtime-section');
    expect(form).not.toContain('quick-login-section');
    expect(onboarding).toContain('prepareWalletBrainVaultWithCanonicalVault(');
    expect(derivation).toContain('terminateWorker(run, worker)');
    expect(derivation).toContain('worker.onmessage = null;');
    expect(derivation).toContain('worker.onerror = null;');
    expect(derivation.indexOf('worker.onmessage = null;')).toBeLessThan(derivation.indexOf('worker.terminate();'));
  });
});
