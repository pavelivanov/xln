import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  resolveWalletRuntimeOpeningPlan,
  walletRuntimeOpeningNeedsLocalLookup,
  type WalletRuntimeOpeningInput,
} from '../../../../frontend/packages/browser/src/runtime/wallet-runtime-opening';

type Candidate = Readonly<{ id: string }>;
type OpeningInput = WalletRuntimeOpeningInput<Candidate, number | null>;

const openingInput = (
  overrides: Partial<OpeningInput> = {},
): OpeningInput => ({
  runtimeId: '0x1234567890',
  name: 'Primary Runtime',
  labelOverride: undefined,
  seed: 'canonical seed',
  mnemonic12: '',
  devicePassphrase: '',
  loginType: 'manual',
  unlockDurationMs: 600_000,
  recoveryCandidate: undefined,
  forceFresh: false,
  openLocal: false,
  localRuntimeExists: false,
  ...overrides,
});

describe('browser wallet Runtime opening', () => {
  test('reads local Runtime state only for the default no-override path', () => {
    expect(walletRuntimeOpeningNeedsLocalLookup({
      openLocal: false,
      forceFresh: false,
      hasRecoveryCandidate: false,
    })).toBe(true);
    expect(walletRuntimeOpeningNeedsLocalLookup({
      openLocal: true,
      forceFresh: false,
      hasRecoveryCandidate: false,
    })).toBe(false);
    expect(walletRuntimeOpeningNeedsLocalLookup({
      openLocal: false,
      forceFresh: true,
      hasRecoveryCandidate: false,
    })).toBe(false);
    expect(walletRuntimeOpeningNeedsLocalLookup({
      openLocal: false,
      forceFresh: false,
      hasRecoveryCandidate: true,
    })).toBe(false);
  });

  test('explicit local opening wins without depending on discovery state', () => {
    expect(resolveWalletRuntimeOpeningPlan(openingInput({
      openLocal: true,
      forceFresh: true,
      recoveryCandidate: { id: 'backup' },
    }))).toEqual({
      action: 'unlock-local',
      runtimeId: '0x1234567890',
      seed: 'canonical seed',
      unlockDurationMs: 600_000,
    });
  });

  test('opens an existing local Runtime on the default path', () => {
    expect(resolveWalletRuntimeOpeningPlan(openingInput({
      localRuntimeExists: true,
      unlockDurationMs: null,
    }))).toEqual({
      action: 'unlock-local',
      runtimeId: '0x1234567890',
      seed: 'canonical seed',
      unlockDurationMs: null,
    });
  });

  test('force-fresh bypasses an existing local Runtime', () => {
    expect(resolveWalletRuntimeOpeningPlan(openingInput({
      forceFresh: true,
      localRuntimeExists: true,
    })).action).toBe('create-runtime');
  });

  test('builds normalized manual Runtime creation inputs', () => {
    expect(resolveWalletRuntimeOpeningPlan(openingInput({
      labelOverride: '  Restored Runtime  ',
      mnemonic12: '  one   two\nthree  ',
      devicePassphrase: 'device secret',
      unlockDurationMs: 86_400_000,
    }))).toEqual({
      action: 'create-runtime',
      label: 'Restored Runtime',
      seed: 'canonical seed',
      options: {
        loginType: 'manual',
        requiresOnboarding: true,
        mnemonic12: 'one two three',
        devicePassphrase: 'device secret',
        recoveryCandidate: undefined,
        skipRecoveryRestore: true,
        unlockDurationMs: 86_400_000,
      },
    });
  });

  test('uses the canonical address-derived label and skips onboarding for demo login', () => {
    expect(resolveWalletRuntimeOpeningPlan(openingInput({
      name: '',
      labelOverride: '   ',
      loginType: 'demo',
    }))).toEqual({
      action: 'create-runtime',
      label: 'Runtime 0x1234',
      seed: 'canonical seed',
      options: {
        loginType: 'demo',
        requiresOnboarding: false,
        mnemonic12: undefined,
        devicePassphrase: undefined,
        recoveryCandidate: undefined,
        skipRecoveryRestore: true,
        unlockDurationMs: 600_000,
      },
    });
  });

  test('creates from a selected backup even when a local Runtime exists', () => {
    const recoveryCandidate = { id: 'backup' };
    const plan = resolveWalletRuntimeOpeningPlan(openingInput({
      recoveryCandidate,
      localRuntimeExists: true,
    }));

    expect(plan.action).toBe('create-runtime');
    if (plan.action === 'create-runtime') {
      expect(plan.options.recoveryCandidate).toBe(recoveryCandidate);
      expect(plan.options.skipRecoveryRestore).toBe(false);
    }
  });

  test('shares recovery-authorized Runtime opening across canonical React adapters', () => {
    const boundary = readFileSync(
      'frontend/packages/browser/src/runtime/wallet-runtime-opening.ts',
      'utf8',
    );
    const adapter = readFileSync(
      'frontend/bridges/vault/wallet-runtime-opening-adapter.ts',
      'utf8',
    );
    const view = readFileSync(
      'frontend/apps/wallet/src/identity/identity-onboarding.tsx',
      'utf8',
    );
    const reactBridge = readFileSync(
      'frontend/bridges/wallet/canonical/wallet-canonical-vault-runtime.ts',
      'utf8',
    );
    const reactRuntime = readFileSync(
      'frontend/apps/wallet/src/runtime/wallet-embedded-runtime.ts',
      'utf8',
    );
    const reactBootstrap = readFileSync(
      'frontend/bridges/runtime/browser/browser-runtime-bootstrap.ts',
      'utf8',
    );
    const vaultMetadata = readFileSync('frontend/bridges/vault/vault-metadata-store.ts', 'utf8');

    expect(boundary).not.toContain('svelte');
    expect(boundary).not.toContain('vaultOperations');
    expect(boundary).not.toContain('../../../../core');
    expect(boundary).toContain('export const executeWalletRuntimeOpening = async');
    expect(boundary).toContain('dependencies.runtimeExists(input.runtimeId)');
    expect(boundary).toContain('await dependencies.unlockRuntime(');
    expect(boundary).toContain('await dependencies.createRuntime(');
    expect(adapter).toContain('executeWalletRuntimeOpening(input, {');
    expect(adapter).toContain('vaultOperations.runtimeExists(runtimeId)');
    expect(adapter).toContain('vaultOperations.unlockRuntime(runtimeId, seed, unlockDurationMs)');
    expect(adapter).toContain('vaultOperations.createRuntime(label, seed, options)');
    expect(adapter).toContain('discoverCanonicalWalletRuntimeRecovery');
    expect(adapter).toContain('buildRemoteRuntimeRecoveryPeerSources({ runtimeId: expectedRuntimeId })');
    expect(view).toContain('await openWalletRuntimeWithCanonicalVault(request)');
    expect(view).toContain('await restoreWalletRuntimeFromCanonicalRecovery(');
    expect(view).not.toContain('executeWalletRuntimeOpening({');
    expect(view).toContain("verifiedMnemonicRef.current = '';");
    expect(view).not.toContain("openingPlan.action === 'unlock-local'");
    expect(reactBridge.indexOf('await discoverCanonicalWalletRuntimeRecovery('))
      .toBeLessThan(reactBridge.indexOf('await executeCanonicalWalletRuntimeOpening({'));
    expect(reactBridge).toContain('recoverySelection.commit(revision, discovery.runtimeId, discovery.candidates)');
    expect(reactBridge).toContain('recoverySelection.consume(token, runtimeId, candidateId)');
    expect(reactBridge).toContain('writeRuntimeRecoveryDiscoveryStatus({');
    expect(reactRuntime).toContain('await session.replace(async () => {');
    expect(reactRuntime).toContain("status: 'recovery-required', discovery");
    expect(reactRuntime.indexOf('const discovery = await canonical.discoverCanonicalWalletRuntimeRecoveryView(request)'))
      .toBeLessThan(reactRuntime.indexOf('if (discovery.candidates.length > 0)'));
    expect(reactRuntime.indexOf('if (discovery.candidates.length > 0)'))
      .toBeLessThan(reactRuntime.lastIndexOf("return openDiscoveredWalletRuntime(request, discovery, '');"));
    expect(reactBootstrap).toContain('hasPersistedWalletVault(localStorage)');
    expect(reactBootstrap).toContain("await import('../../wallet/canonical/wallet-canonical-vault-runtime')");
    expect(vaultMetadata).toContain("import { WALLET_VAULT_STORAGE_KEY } from '../../packages/browser/src/wallet/wallet-vault-storage';");
    expect(vaultMetadata).not.toContain("const VAULT_STORAGE_KEY = 'xln-vaults'");
  });
});
