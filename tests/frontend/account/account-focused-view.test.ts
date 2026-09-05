import { expect, test } from 'bun:test';
import { buildAccountDisputeDeadline } from '../../../frontend/src/lib/components/Entity/account/account-focused-view';
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
