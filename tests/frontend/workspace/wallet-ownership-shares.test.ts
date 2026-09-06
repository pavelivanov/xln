import { describe, expect, test } from 'bun:test';
import { projectWalletOwnership } from '../../../frontend/bridges/wallet-canonical-ownership';
import { ENTITY_DIVIDEND_TOKEN_FLAG } from '../../../frontend/src/lib/components/Entity/ownership/ownership-flow';

const entityId = `0x${'0'.repeat(63)}1`;
const peerId = `0x${'0'.repeat(63)}2`;
const token = (tokenId: number, externalTokenId: bigint) => ({
  tokenId, externalTokenId: externalTokenId.toString(), tokenType: 2 as const,
  symbol: 'SHARE', address: `0x${'1'.repeat(40)}`, balance: 0n, decimals: 0,
});
const tokens = [token(7, 1n), token(8, ENTITY_DIVIDEND_TOKEN_FLAG | 1n), token(9, 2n)];
const frame = (id = entityId) => ({ height: 42, activeEntityId: id,
  activeEntity: { core: { entityId: id, config: { jurisdiction: { entityProviderAddress: `0x${'1'.repeat(40)}` } }, reserves: new Map([[7, 80n], [8, 40n], [9, 23n]]) } },
});

describe('Wallet Ownership shares', () => {
  test('uses exact selected Entity share IDs and committed reserves across Entity reversal', () => {
    expect(projectWalletOwnership(frame(), entityId, tokens).shares.map(share => share.reserve)).toEqual([80n, 40n]);
    expect(projectWalletOwnership(frame(peerId), peerId, tokens).shares.map(share => share.reserve)).toEqual([23n, 0n]);
    expect(projectWalletOwnership(frame(), entityId, tokens).shares.map(share => share.reserve)).toEqual([80n, 40n]);
    expect(() => projectWalletOwnership(frame(), peerId, tokens)).toThrow('OWNERSHIP_ENTITY_CHANGED');
  });

  test('refresh reflects updated reserves and exact committed action nonce', () => {
    const updated = frame();
    const view = projectWalletOwnership({ ...updated, height: 43, activeEntity: { core: {
      ...updated.activeEntity.core, reserves: new Map([[7, 12n], [8, 40n]]),
      entityProviderActionState: { version: 1, confirmedNonce: 6n, generation: 1 },
    } } }, entityId, tokens);
    expect(view.height).toBe(43);
    expect(view.shares.map(share => share.reserve)).toEqual([12n, 40n]);
    expect(view.confirmedNonce).toBe(6n);
    expect(view.pendingRelease).toBeNull();
  });

  test('retains the pending release hash and nonce from committed remote core', () => {
    const selected = frame();
    const view = projectWalletOwnership({ ...selected, activeEntity: { core: {
      ...selected.activeEntity.core,
      entityProviderActionState: { version: 1, confirmedNonce: 6n, generation: 1, pending: {
        version: 1, entityId, entityNumber: 1n, chainId: 31337n,
        entityProviderAddress: `0x${'1'.repeat(40)}`, boardEpoch: 1n,
        actionNonce: 7n, actionHash: `0x${'ab'.repeat(32)}`, generation: 1, createdAt: 42,
        payload: { kind: 'releaseControlShares', release: {
          recipientAddress: `0x${'2'.repeat(40)}`, controlAmount: 80n, dividendAmount: 40n, purpose: 'treasury',
        } },
      } },
    } } }, entityId, tokens);
    expect(view.pendingRelease).toEqual({ hash: `0x${'ab'.repeat(32)}`, nonce: 7n });
    expect(view.confirmedNonce).toBe(6n);
    expect(view.releaseBlocked).toBe(false);
  });

  test('does not confuse another ERC1155 contract with the selected Entity provider', () => {
    const foreign = { ...token(10, 1n), address: `0x${'f'.repeat(40)}` };
    expect(projectWalletOwnership(frame(), entityId, [foreign, ...tokens]).shares[0]?.internalTokenId).toBe(7);
  });

  test('reports an existing non-release action as blocking issuance', () => {
    const selected = frame();
    const view = projectWalletOwnership({ ...selected, activeEntity: { core: {
      ...selected.activeEntity.core,
      entityProviderActionState: { version: 1, confirmedNonce: 6n, generation: 1, pending: {
        version: 1, entityId, entityNumber: 1n, chainId: 31337n,
        entityProviderAddress: `0x${'1'.repeat(40)}`, boardEpoch: 1n,
        actionNonce: 7n, actionHash: `0x${'ab'.repeat(32)}`, generation: 1, createdAt: 42,
        payload: { kind: 'entityTransferTokens', transfer: { to: peerId, tokenId: 7n, amount: 1n } },
      } },
    } } }, entityId, tokens);
    expect(view.pendingRelease).toBeNull();
    expect(view.releaseBlocked).toBe(true);
  });

  test('missing compact action status stays unavailable instead of inventing nonce zero', () => {
    const view = projectWalletOwnership(frame(), entityId, tokens);
    expect(view.confirmedNonce).toBeNull();
    expect(view.pendingRelease).toBeNull();
  });

  test('lazy Entities do not invent numbered shares from unrelated reserve tokens', () => {
    const lazyId = `0x${'ab'.repeat(32)}`;
    const view = projectWalletOwnership(frame(lazyId), lazyId, tokens);
    expect(view.numbered).toBe(false);
    expect(view.shares).toEqual([]);
  });
});
