import { expect, test } from 'bun:test';
import { buildAccountDisputeDeadline, buildPendingSecretAckInfo } from '../../../frontend/src/lib/components/Entity/account/account-focused-view';
import { createAccountActivityPresentation } from '../../../frontend/src/lib/components/Entity/account/account-activity-presentation';
import { requestAccountFaucet, type AccountFaucetRequest } from '../../../frontend/src/lib/components/Entity/account/account-faucet-command';

test('focused dispute countdown uses observed Unix seconds and rounds a remaining partial second up', () => {
  const disputeTimeout = 1_800_000_000;
  expect(buildAccountDisputeDeadline({ disputeTimeout, observedOnChain: true }, disputeTimeout * 1000 - 1001)).toEqual({
    disputeTimeoutSeconds: disputeTimeout, hasObservedDisputeDeadline: true, disputeSecondsLeft: 2,
  });
  expect(buildAccountDisputeDeadline({ disputeTimeout, observedOnChain: true }, disputeTimeout * 1000 + 1).disputeSecondsLeft).toBe(0);
  expect(buildAccountDisputeDeadline({ disputeTimeout, observedOnChain: false }, disputeTimeout * 1000 - 1001).hasObservedDisputeDeadline).toBe(false);
  expect(buildAccountDisputeDeadline(null, disputeTimeout * 1000).hasObservedDisputeDeadline).toBe(false);
});

test('shared Account activity formatting preserves BigInt precision and projected participant names', () => {
  const presentation = createAccountActivityPresentation({ entityNames: new Map([['peer', 'Counterparty']]), activeXlnFunctions: null });
  const amount = 9007199254740993001n;
  const params = presentation.buildActionParams({ type: 'direct_payment', data: {
    tokenId: 1, amount, route: ['self', 'peer'], fromEntityId: 'self', toEntityId: 'peer', deliveryMode: 'direct',
  } });
  expect(params.find(row => row.label === 'Amount')?.value).toBe(amount.toString());
  expect(params.find(row => row.label === 'To')?.value).toBe('Counterparty (peer)');
  expect(params.find(row => row.label === 'Route')?.value).toBe('self → Counterparty (peer)');
  expect(presentation.txTypeLabel('set_credit_limit')).toBe('Set Credit Limit');
});

test('shared Account faucet rejects invalid action context before making an HTTP request', async () => {
  const input: AccountFaucetRequest = {
    apiBase: '', entityId: 'self', runtimeId: 'runtime', hubEntityId: 'peer', tokenId: 1,
    symbol: 'USDC', commandsReady: false, sameJurisdiction: true,
  };
  await expect(requestAccountFaucet(input)).rejects.toThrow('Runtime is not ready for financial actions');
  await expect(requestAccountFaucet({ ...input, commandsReady: true, sameJurisdiction: false })).rejects.toThrow('Switch to the matching jurisdiction entity');
  await expect(requestAccountFaucet({ ...input, commandsReady: true, runtimeId: '' })).rejects.toThrow('missing runtimeId');
  await expect(requestAccountFaucet({ ...input, commandsReady: true, hubEntityId: '' })).rejects.toThrow('requires a target hub account');
  const controller = new AbortController();
  controller.abort();
  await expect(requestAccountFaucet({ ...input, commandsReady: true, signal: controller.signal })).rejects.toThrow('aborted');
});


test('pending secret ACK countdown reads canonical paybook entries for only the inbound counterparty', () => {
  const entries = new Map([
    ['first', { hashlock: 'first', createdTimestamp: 0, inboundEntity: 'PEER', secretAckPending: true, secretAckDeadlineAt: 3001 }],
    ['earlier', { hashlock: 'earlier', createdTimestamp: 0, inboundEntity: 'peer', secretAckPending: true, secretAckDeadlineAt: 2001 }],
    ['other', { hashlock: 'other', createdTimestamp: 0, inboundEntity: 'other', secretAckPending: true, secretAckDeadlineAt: 1001 }],
    ['settled', { hashlock: 'settled', createdTimestamp: 0, inboundEntity: 'peer', secretAckPending: false, secretAckDeadlineAt: 1001 }],
    ['invalid', { hashlock: 'invalid', createdTimestamp: 0, inboundEntity: 'peer', secretAckPending: true, secretAckDeadlineAt: NaN }],
  ]);
  const paybook = { entries, feesEarned: 0n };
  expect(buildPendingSecretAckInfo(paybook, 'peer', 1000)).toEqual({ count: 2, secondsLeft: 2 });
  expect(buildPendingSecretAckInfo(paybook, 'PEER', 4000)).toEqual({ count: 2, secondsLeft: 0 });
  expect(buildPendingSecretAckInfo(paybook, 'unrelated', 1000)).toBeNull();
  expect(buildPendingSecretAckInfo(undefined, 'peer', 1000)).toBeNull();
});

test('Account activity reads invoice comments from the hashlock-owned paybook entry', () => {
  const payments = new Map([
    ['invoice', { hashlock: 'invoice', createdTimestamp: 0, description: '  invoice 42  ' }],
    ['other', { hashlock: 'other', createdTimestamp: 0, description: 'private other invoice' }],
  ]);
  const presentation = createAccountActivityPresentation({ entityNames: new Map(), payments, activeXlnFunctions: null });
  const lock = { type: 'htlc_lock', data: { lockId: 'invoice', hashlock: 'invoice', timelock: 100n, revealBeforeHeight: 10, amount: 42n, tokenId: 1 } } as const;
  expect(presentation.buildActionParams(lock)).toContainEqual({ label: 'Comment', value: 'invoice 42' });
  expect(presentation.buildActionParams({ ...lock, data: { ...lock.data, hashlock: 'missing' } }).some(row => row.label === 'Comment')).toBe(false);
  payments.delete('invoice');
  expect(presentation.buildActionParams(lock).some(row => row.label === 'Comment')).toBe(false);
});
