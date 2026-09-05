import { expect, test } from 'bun:test';
import { buildAccountDropdownItems, showsAccountDropdown } from '../../../frontend/src/lib/components/Entity/account/account-dropdown-model';

test('Account dropdown preserves map order, names and the retained five-Account threshold', () => {
  const accounts = new Map([
    ['PEER-B', { status: 'active' as const, mempool: [] }],
    ['peer-a', { status: 'active' as const, mempool: [] }],
  ]);
  const rows = buildAccountDropdownItems(accounts, new Map([['peer-b', 'Bob']]), id => `avatar:${id}`);
  expect(rows.map(row => [row.id, row.name, row.avatar])).toEqual([
    ['PEER-B', 'Bob', 'avatar:PEER-B'], ['peer-a', 'peer-a', 'avatar:peer-a'],
  ]);
  expect([0, 1, 5, 6, 26].map(showsAccountDropdown)).toEqual([false, false, false, true, true]);
  expect(buildAccountDropdownItems([], new Map(), () => '')).toEqual([]);
});

test('Account dropdown uses the retained status precedence and pending count', () => {
  type StatusSource = Parameters<typeof buildAccountDropdownItems>[0] extends Iterable<readonly [string, infer T]> ? T : never;
  const pending: StatusSource = { status: 'active', mempool: [{ type: 'direct_payment', data: {
    tokenId: 1, amount: 1n, fromEntityId: 'alice', toEntityId: 'bob', route: ['alice', 'bob'], deliveryMode: 'direct',
  } }] };
  const disputed: StatusSource = { ...pending, activeDispute: {
    startedByLeft: true, initialProofbodyHash: '0x01', initialNonce: 1, initialProposerIsLeft: true,
    disputeTimeout: 100, jNonce: 1, starterInitialArguments: '0x', starterCounterArguments: '0x', starterCounterProofCommitment: '0x',
  } };
  const rows = buildAccountDropdownItems(new Map<string, StatusSource>([
    ['ready', { status: 'active', mempool: [] }], ['pending', pending],
    ['preparing', { ...pending, status: 'dispute_preparing' }], ['disputed', disputed],
    ['finalized', { status: 'disputed', mempool: [] }],
  ]), new Map(), () => '');
  expect(rows.map(row => [row.status, row.statusLabel, row.pendingCount])).toEqual([
    ['ready', 'READY', 0], ['sent', 'PENDING', 1], ['dispute_preparing', 'DISPUTE PREP', 1],
    ['disputed', 'DISPUTED', 1], ['finalized_disputed', 'FINALIZED DISPUTED', 0],
  ]);
});
