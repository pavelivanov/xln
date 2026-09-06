import { expect, test } from 'bun:test';
import { WalletWorkspaceSelection } from '../../../frontend/apps/wallet/src/wallet-workspace-selection';
import { resolveWalletAppRoute } from '../../../frontend/apps/wallet/src/wallet-navigation-model';
import { buildWalletMoveDraftTxs, type WalletMoveDraft } from '../../../frontend/apps/wallet/src/wallet-move-model';
import { buildWalletLoanRepayment, createWalletLendingIntentId, decodeWalletLending } from '../../../frontend/apps/wallet/src/wallet-lending-model';
import { historyTimeRange } from '../../../frontend/apps/wallet/src/wallet-history-model';
import { dedupeHistoryEvents } from '../../../frontend/src/lib/components/Entity/account/activity-history-events';
import { buildLendingTokenOptions } from '../../../frontend/src/lib/components/Entity/payments/lending-token-options';

const owner = `0x${'11'.repeat(32)}`, peer = `0x${'22'.repeat(32)}`, recipient = `0x${'33'.repeat(32)}`;
const base: WalletMoveDraft = { entityId: owner, sourceAccountId: peer, targetEntityId: recipient, targetHubId: peer, reserveRecipient: recipient,
  externalRecipient: `0x${'44'.repeat(20)}`, tokenAddress: `0x${'55'.repeat(20)}`, tokenId: 1, amount: 100n, from: 'reserve', to: 'account' };

test('four retained Account routes resolve to real tool destinations', () => {
  for (const tab of ['configure', 'move', 'lending', 'history']) expect(resolveWalletAppRoute('', `#accounts/${tab}`)).toEqual({ view: 'account-tools', tab });
});

test('tool selections preserve independent ownership and reset at Entity and Runtime boundaries', () => {
  const selection = new WalletWorkspaceSelection();
  selection.bindRuntime('runtime'); selection.observeEntity('runtime', owner, true); selection.focusAccount('runtime', owner, peer);
  selection.selectAccountTool('runtime', owner, 'manage', { tokenId: 2, tab: 'collateral' });
  selection.selectAccountTool('runtime', owner, 'lending', { tokenId: 3, hub: recipient });
  expect(selection.getAccountTools().manage).toEqual({ tokenId: 2, tab: 'collateral' });
  expect(selection.getSnapshot().workspaceAccountId).toBe(peer);
  expect(selection.getAccountTools().move.target).toBe('');
  expect(() => selection.selectAccountTool('runtime', peer, 'lending', { tokenId: 1, hub: peer })).toThrow('TOOL_ENTITY_MISMATCH');
  selection.selectEntity('runtime', peer);
  expect(selection.getAccountTools().lending).toEqual({ tokenId: 1, hub: '' });
  selection.selectAccountTool('runtime', peer, 'manage', { tokenId: 3, tab: 'dispute' });
  selection.bindRuntime('other');
  expect(selection.getAccountTools().manage).toEqual({ tokenId: 1, tab: 'extend-credit' });
});

test('Move uses ordered existing draft operations and canonical c2r continuations', () => {
  expect(buildWalletMoveDraftTxs(base)).toEqual([{ type: 'r2c', data: { counterpartyId: peer, receivingEntityId: recipient, tokenId: 1, amount: 100n } }]);
  expect(buildWalletMoveDraftTxs({ ...base, from: 'external' }).map(tx => tx.type)).toEqual(['e2r', 'r2c']);
  expect(buildWalletMoveDraftTxs({ ...base, from: 'external', to: 'reserve' }).map(tx => tx.type)).toEqual(['e2r']);
  expect(buildWalletMoveDraftTxs({ ...base, to: 'reserve' })).toEqual([{ type: 'r2r', data: { toEntityId: recipient, tokenId: 1, amount: 100n } }]);
  expect(buildWalletMoveDraftTxs({ ...base, to: 'external' })[0]?.type).toBe('r2e');
  for (const to of ['external', 'reserve', 'account'] as const) {
    const tx = buildWalletMoveDraftTxs({ ...base, from: 'account', to })[0];
    if (!tx || tx.type !== 'settle_propose') throw new Error('Expected canonical settlement');
    expect(tx.data.ops).toEqual([{ type: 'c2r', tokenId: 1, amount: 100n }]);
    expect(tx.data.continuation?.broadcast).toBe(false);
    expect(tx.data.continuation?.actions.map(action => action.type)).toEqual(to === 'reserve' ? [] : [to === 'external' ? 'r2e' : 'r2c']);
  }
  expect(() => buildWalletMoveDraftTxs({ ...base, from: 'external', to: 'external' })).toThrow('EXTERNAL_AUTHORITY');
  expect(() => buildWalletMoveDraftTxs({ ...base, amount: 0n })).toThrow('NOT_POSITIVE');
});

test('Lending rejects stale Hub/token/user reads and derives only the selected borrower repayment', () => {
  const loan = { hubEntityId: peer, borrowerEntityId: owner, lenderEntityId: recipient, tokenId: 1, loanId: 'loan-one', principalAmount: '100', repaymentAmount: '110', repaidAmount: '10', interestBps: 1000, termId: '1d', dueAt: 1000, status: 'active' };
  const page = { success: true, hubEntityId: peer, pools: [], loans: [loan], totals: { availableAmount: '100', borrowedAmount: '100' } };
  const state = decodeWalletLending(page, peer, 1, owner);
  const decoded = state.loans[0]; if (!decoded) throw new Error('Expected loan');
  expect(buildWalletLoanRepayment(decoded, owner, peer)).toEqual({ type: 'lendingRepay', data: { hubEntityId: peer, loanId: 'loan-one', tokenId: 1, amount: 100n } });
  expect(() => buildWalletLoanRepayment(decoded, recipient, peer)).toThrow('BORROWER_MISMATCH');
  expect(() => decodeWalletLending(page, owner, 1, owner)).toThrow('HUB_MISMATCH');
  expect(() => decodeWalletLending(page, peer, 2, owner)).toThrow('ROW_CONTEXT_MISMATCH');
  expect(() => decodeWalletLending({ ...page, loans: [{ ...loan, principalAmount: 'bad' }] }, peer, 1, owner)).toThrow('AMOUNT_INVALID');
  expect(() => decodeWalletLending({ ...page, loans: [{ ...loan, borrowerEntityId: recipient }] }, peer, 1, owner)).toThrow('USER_MISMATCH');
});

test('History rejects invalid and reversed time windows', () => {
  expect(historyTimeRange('', '')).toEqual({ fromTimestamp: undefined, toTimestamp: undefined });
  expect(() => historyTimeRange('bad', '')).toThrow('Invalid history date');
  expect(() => historyTimeRange('2026-09-05T12:00', '2026-09-04T12:00')).toThrow('start must precede end');
});

test('Lending UI intent IDs satisfy the canonical admission format', () => {
  expect(createWalletLendingIntentId('lend')).toMatch(/^lend-[0-9a-f]{16}$/);
  expect(createWalletLendingIntentId('borrow')).toMatch(/^borrow-[0-9a-f]{16}$/);
});

test('Lending keeps default assets before token deltas exist and otherwise uses only Account assets', () => {
  const symbols = new Map([[1, 'USDC'], [2, 'USDT'], [3, 'WETH'], [4, 'AAA'], [5, 'AAA']]);
  const symbol = (id: number) => { const value = symbols.get(id); if (!value) throw new Error('Unknown token'); return value; };
  expect(buildLendingTokenOptions([], symbol)).toEqual([{ id: 1, symbol: 'USDC' }, { id: 2, symbol: 'USDT' }, { id: 3, symbol: 'WETH' }]);
  expect(buildLendingTokenOptions([3, 1], symbol).map(token => token.id)).toEqual([1, 3]);
  expect(buildLendingTokenOptions([5, 4, 4], symbol).map(token => token.id)).toEqual([4, 5]);
});

test('History coalesces repeated HTLC observations without merging opposite directions or distinct hashes', () => {
  const event = { id: 'first', timestamp: 10, height: 1, rawType: 'HtlcSettled', direction: 'out', source: 'runtime_log', runtimeId: 'runtime', entityId: owner,
    counterpartyId: peer, hash: 'hash-one', amount: '10', tokenId: 1 };
  const events = dedupeHistoryEvents([event, { ...event, id: 'late', timestamp: 30, height: 3 }, { ...event, id: 'other-hash', hash: 'hash-two' }, { ...event, id: 'incoming', direction: 'in' }]);
  expect(events.map(item => item.id)).toEqual(['first', 'other-hash', 'incoming']);
});
