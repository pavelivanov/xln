import { describe, expect, test } from 'bun:test';

import { WalletRecoverySelectionSession } from '../../../frontend/packages/browser/src/wallet-recovery-selection-session';

type Candidate = Readonly<{ id: string; height: number }>;

describe('wallet recovery selection session', () => {
  test('consumes the selected canonical candidate exactly once', () => {
    const session = new WalletRecoverySelectionSession<Candidate>();
    const revision = session.begin();
    const candidates = [{ id: 'older', height: 4 }, { id: 'latest', height: 7 }];
    const token = session.commit(revision, 'runtime-a', candidates);

    expect(session.consume(token, 'runtime-a', 'latest')).toBe(candidates[1]);
    expect(() => session.consume(token, 'runtime-a', 'latest'))
      .toThrow('WALLET_RECOVERY_DISCOVERY_STALE');
  });

  test('allows fresh continuation only after an exact empty discovery', () => {
    const session = new WalletRecoverySelectionSession<Candidate>();
    const token = session.commit(session.begin(), 'runtime-a', []);

    expect(session.consume(token, 'runtime-a', '')).toBeUndefined();
  });

  test('rejects missing selection, cross-Runtime use, and stale discovery', () => {
    const session = new WalletRecoverySelectionSession<Candidate>();
    const firstRevision = session.begin();
    const token = session.commit(firstRevision, 'runtime-a', [{ id: 'backup', height: 9 }]);

    expect(() => session.consume(token, 'runtime-b', 'backup'))
      .toThrow('WALLET_RECOVERY_DISCOVERY_STALE');
    expect(() => session.consume(token, 'runtime-a', ''))
      .toThrow('WALLET_RECOVERY_CANDIDATE_REQUIRED');
    const staleRevision = session.begin();
    session.begin();
    expect(() => session.commit(staleRevision, 'runtime-a', []))
      .toThrow('WALLET_RECOVERY_DISCOVERY_CANCELLED');
  });

  test('discards only the active token unless full invalidation is requested', () => {
    const session = new WalletRecoverySelectionSession<Candidate>();
    const token = session.commit(session.begin(), 'runtime-a', [{ id: 'backup', height: 2 }]);

    session.discard('another-token');
    expect(session.consume(token, 'runtime-a', 'backup')).toEqual({ id: 'backup', height: 2 });
    const nextToken = session.commit(session.begin(), 'runtime-a', []);
    session.discard();
    expect(() => session.consume(nextToken, 'runtime-a', ''))
      .toThrow('WALLET_RECOVERY_DISCOVERY_STALE');
  });
});
