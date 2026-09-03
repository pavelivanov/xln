import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { buildWalletEntityTxsInput } from '../../../frontend/apps/wallet/src/wallet-payment-model';
import type { WalletPaymentProjection } from '../../../frontend/apps/wallet/src/wallet-payment-model';
import {
  encodeWalletExternalRecipient,
  formatWalletExternalAmount,
  normalizeWalletExternalAddress,
  parseWalletExternalAmount,
  walletExternalBindingMatches,
  walletExternalCompletionMessage,
  type WalletExternalProviderBinding,
} from '../../../frontend/packages/browser/src/wallet-external-provider';

const entityId = `0x${'11'.repeat(32)}`;
const signerId = `0x${'22'.repeat(20)}`;
const recipient = `0x${'33'.repeat(20)}`;

const binding: WalletExternalProviderBinding = {
  runtimeId: signerId,
  entityId,
  signerId,
  owner: signerId,
  jurisdiction: 'local',
  adapterMode: 'rpc',
  chainId: 31337,
  depository: `0x${'44'.repeat(20)}`,
  platform: 'web',
};

const projection = {
  activeEntityId: entityId,
  signerId,
} as WalletPaymentProjection;

describe('React wallet external provider', () => {
  test('parses exact decimal amounts and rejects ambiguous or excessive values', () => {
    expect(parseWalletExternalAmount('1.250001', 6, 2_000_000n)).toBe(1_250_001n);
    expect(parseWalletExternalAmount('.5', 6)).toBe(500_000n);
    expect(formatWalletExternalAmount(1_250_001n, 6)).toBe('1.250001');
    expect(() => parseWalletExternalAmount('1e3', 6)).toThrow('EXTERNAL_WALLET_AMOUNT_FORMAT_INVALID');
    expect(() => parseWalletExternalAmount('0.0000001', 6)).toThrow('EXTERNAL_WALLET_AMOUNT_PRECISION_EXCEEDED');
    expect(() => parseWalletExternalAmount('2.1', 6, 2_000_000n)).toThrow('EXTERNAL_WALLET_AMOUNT_EXCEEDS_BALANCE');
  });

  test('normalizes EOA destinations and encodes reserve withdrawals as bytes32', () => {
    expect(normalizeWalletExternalAddress(recipient.toUpperCase().replace('0X', '0x'))).toBe(recipient);
    expect(encodeWalletExternalRecipient(recipient)).toBe(`0x${'0'.repeat(24)}${'33'.repeat(20)}`);
    expect(() => normalizeWalletExternalAddress(entityId)).toThrow('EXTERNAL_WALLET_ADDRESS_INVALID');
  });

  test('binds every authority dimension and preserves confirmed outcomes after context switches', () => {
    expect(walletExternalBindingMatches(binding, { ...binding })).toBe(true);
    expect(walletExternalBindingMatches(binding, { ...binding, chainId: 1 })).toBe(false);
    expect(walletExternalBindingMatches(binding, { ...binding, entityId: `0x${'55'.repeat(32)}` })).toBe(false);
    expect(walletExternalCompletionMessage('transfer', false)).toContain('no second transaction was submitted');
    expect(walletExternalCompletionMessage('approve', true)).toBe('Approval confirmed. Finalized balances are refreshing.');
  });

  test('builds canonical deposit and withdrawal batches without moving key authority into React', () => {
    const tokenAddress = `0x${'66'.repeat(20)}`;
    expect(buildWalletEntityTxsInput(projection, [{
      type: 'e2r',
      data: {
        contractAddress: tokenAddress,
        tokenType: 0,
        externalTokenId: 0n,
        internalTokenId: 1,
        amount: 25_000_000n,
      },
    }]).entityInputs[0]?.entityTxs[0]).toMatchObject({
      type: 'e2r',
      data: { contractAddress: tokenAddress, internalTokenId: 1, amount: 25_000_000n },
    });
    expect(buildWalletEntityTxsInput(projection, [
      { type: 'r2e', data: { receivingEntity: encodeWalletExternalRecipient(recipient), tokenId: 1, amount: 4n } },
      { type: 'j_broadcast', data: {} },
    ]).entityInputs[0]?.entityTxs.map(({ type }) => type)).toEqual(['r2e', 'j_broadcast']);

    const bridge = readFileSync('frontend/bridges/wallet-canonical-external-provider.ts', 'utf8');
    const react = readFileSync('frontend/apps/wallet/src/wallet-payment-external.tsx', 'utf8');
    expect(bridge.match(/assertCurrent\(request\.binding\)/g)).toHaveLength(4);
    expect(bridge).toContain('EXTERNAL_WALLET_APPROVAL_POSTCONDITION_FAILED');
    expect(bridge).toContain('walletExternalBindingMatches');
    expect(react).not.toContain('getSignerPrivateKey');
    expect(react).not.toContain('privateKey');
  });
});
