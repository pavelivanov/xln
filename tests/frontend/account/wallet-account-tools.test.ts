import { expect, test } from 'bun:test';
import { WalletWorkspaceSelection } from '../../../frontend/apps/wallet/src/runtime/wallet-workspace-selection';
import { resolveWalletAppRoute } from '../../../frontend/apps/wallet/src/navigation/wallet-navigation-model';
import { buildWalletMoveDraftTxs, type WalletMoveDraft } from '../../../frontend/apps/wallet/src/move/wallet-move-model';
import { WALLET_LENDING_UNSUPPORTED_REASON } from '../../../frontend/apps/wallet/src/manage/wallet-lending';
import { historyTimeRange } from '../../../frontend/apps/wallet/src/history/wallet-history-model';
import { dedupeHistoryEvents } from '../../../frontend/packages/ui/src/account/activity/activity-history-events';

const owner = `0x${'11'.repeat(32)}`, peer = `0x${'22'.repeat(32)}`, recipient = `0x${'33'.repeat(32)}`;
const base: WalletMoveDraft = { entityId: owner, sourceAccountId: peer, targetEntityId: recipient, targetHubId: peer, reserveRecipient: recipient,
  externalRecipient: `0x${'44'.repeat(20)}`, tokenAddress: `0x${'55'.repeat(20)}`, tokenId: 1, amount: 100n, from: 'reserve', to: 'account' };

test('four retained Account routes resolve to real tool destinations', () => {
  for (const tab of ['configure', 'move', 'lending', 'history']) expect(resolveWalletAppRoute('', `#accounts/${tab}`)).toEqual({ view: 'account-tools', tab });
});

test('retained Ownership and Consensus deep links resolve to Entity evidence', () => {
  expect(resolveWalletAppRoute('', '#ownership')).toEqual({ view: 'entity-tools', tab: 'ownership', entityId: '' });
  expect(resolveWalletAppRoute('', '#settings/consensus')).toEqual({ view: 'entity-tools', tab: 'consensus', entityId: '' });
  expect(resolveWalletAppRoute('', '#settings/consensus?entity=0x1234')).toEqual({
    view: 'entity-tools', tab: 'consensus', entityId: '0x1234',
  });
});

test('tool selections preserve independent ownership and reset at Entity and Runtime boundaries', () => {
  const selection = new WalletWorkspaceSelection();
  selection.bindRuntime('runtime'); selection.observeEntity('runtime', owner, true); selection.focusAccount('runtime', owner, peer);
  selection.selectAccountTool('runtime', owner, 'manage', { tokenId: 2, tab: 'collateral' });
  expect(selection.getAccountTools().manage).toEqual({ tokenId: 2, tab: 'collateral' });
  expect(selection.getSnapshot().workspaceAccountId).toBe(peer);
  expect(selection.getAccountTools().move.target).toBe('');
  selection.selectEntity('runtime', peer);
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

test('Lending states the production admission boundary without implying command availability', () => {
  expect(WALLET_LENDING_UNSUPPORTED_REASON).toContain('outside the current production admission profile');
  expect(WALLET_LENDING_UNSUPPORTED_REASON).toContain('No lending command can be submitted');
});

test('History rejects invalid and reversed time windows', () => {
  expect(historyTimeRange('', '')).toEqual({ fromTimestamp: undefined, toTimestamp: undefined });
  expect(() => historyTimeRange('bad', '')).toThrow('Invalid history date');
  expect(() => historyTimeRange('2026-09-05T12:00', '2026-09-04T12:00')).toThrow('start must precede end');
});

test('History coalesces repeated HTLC observations without merging opposite directions or distinct hashes', () => {
  const event = { id: 'first', timestamp: 10, height: 1, rawType: 'HtlcSettled', direction: 'out', source: 'runtime_log', runtimeId: 'runtime', entityId: owner,
    counterpartyId: peer, hash: 'hash-one', amount: '10', tokenId: 1 };
  const events = dedupeHistoryEvents([event, { ...event, id: 'late', timestamp: 30, height: 3 }, { ...event, id: 'other-hash', hash: 'hash-two' }, { ...event, id: 'incoming', direction: 'in' }]);
  expect(events.map(item => item.id)).toEqual(['first', 'other-hash', 'incoming']);
});
