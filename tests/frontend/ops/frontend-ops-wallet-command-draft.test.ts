import { expect, test } from 'bun:test';
import { requireDraftToken, walletDraftPayment } from '../../../frontend/apps/wallet/src/wallet-command-draft';

test('Wallet drafts resolve symbols against the selected projection and reject missing or ambiguous assets', () => {
  const tokens = [{ tokenId: 7, symbol: 'USDC' }, { tokenId: 21, symbol: 'WETH' }];
  expect(walletDraftPayment({ id: 1, type: 'pay', args: { amount: '2.5', token: 'usdc', recipientId: `0x${'ab'.repeat(32)}`, recipientName: 'Recipient' } }, tokens))
    .toEqual({ id: 1, tokenId: 7, amount: '2.5', recipientId: `0x${'ab'.repeat(32)}` });
  expect(() => requireDraftToken(tokens, 'DAI')).toThrow('unavailable');
  expect(() => requireDraftToken([...tokens, { tokenId: 9, symbol: 'usdc' }], 'USDC')).toThrow('ambiguous');
});
