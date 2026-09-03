import { describe, expect, test } from 'bun:test';

import { WalletBrainVaultMaterialSession } from '../../../frontend/packages/browser/src/wallet-brainvault-material-session';

type Material = Readonly<{ runtimeId: string; mnemonic24: string }>;

describe('wallet Brain Vault material session', () => {
  test('consumes bridge-held material exactly once for the matching Runtime', () => {
    const session = new WalletBrainVaultMaterialSession<Material>();
    const material = { runtimeId: 'runtime-a', mnemonic24: 'secret words' };
    const token = session.commit(session.begin(), material);

    expect(session.consume(token, 'runtime-a')).toBe(material);
    expect(() => session.consume(token, 'runtime-a'))
      .toThrow('WALLET_BRAINVAULT_DERIVATION_STALE');
  });

  test('rejects cross-Runtime use and preserves the active exact token', () => {
    const session = new WalletBrainVaultMaterialSession<Material>();
    const material = { runtimeId: 'runtime-a', mnemonic24: 'secret words' };
    const token = session.commit(session.begin(), material);

    expect(() => session.consume(token, 'runtime-b'))
      .toThrow('WALLET_BRAINVAULT_DERIVATION_STALE');
    session.discard('another-token');
    expect(session.consume(token, 'runtime-a')).toBe(material);
  });

  test('allows bridge-only recovery work without consuming derived material', () => {
    const session = new WalletBrainVaultMaterialSession<Material>();
    const material = { runtimeId: 'runtime-a', mnemonic24: 'secret words' };
    const token = session.commit(session.begin(), material);

    expect(session.read(token, 'runtime-a')).toBe(material);
    expect(session.consume(token, 'runtime-a')).toBe(material);
  });

  test('invalidates stale derivations and explicit cancellation', () => {
    const session = new WalletBrainVaultMaterialSession<Material>();
    const staleRevision = session.begin();
    session.begin();
    expect(() => session.commit(staleRevision, {
      runtimeId: 'runtime-a', mnemonic24: 'secret words',
    })).toThrow('WALLET_BRAINVAULT_DERIVATION_CANCELLED');

    const token = session.commit(session.begin(), {
      runtimeId: 'runtime-a', mnemonic24: 'secret words',
    });
    session.discard();
    expect(() => session.consume(token, 'runtime-a'))
      .toThrow('WALLET_BRAINVAULT_DERIVATION_STALE');
  });
});
