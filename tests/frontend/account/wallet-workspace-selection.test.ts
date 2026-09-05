import { expect, test } from 'bun:test';
import { WalletWorkspaceSelection, requireWalletWorkspaceEntity } from '../../../frontend/apps/wallet/src/wallet-workspace-selection';
import { ACCOUNT_WORKSPACE_TABS, accountWorkspaceTabsForAccounts } from '../../../frontend/packages/runtime-client/src/account-workspace-tabs';

test('wallet route consumers share Entity and Account selection only within the bound Runtime', () => {
  const selection = new WalletWorkspaceSelection();
  expect(selection.bindRuntime('first')).toBe('');
  selection.observeEntity('first', 'alice', true);
  selection.focusAccount('first', 'alice', 'peer');
  selection.closeAccount();
  expect(selection.getSnapshot().workspaceAccountId).toBe('peer');
  expect(selection.bindRuntime('first')).toBe('alice');
  selection.selectEntity('first', 'bob');
  expect(selection.getSnapshot()).toEqual({ runtimeId: 'first', entityId: 'bob', workspaceAccountId: '', focusedAccountId: null, hasAccounts: false });
  expect(selection.bindRuntime('second')).toBe('');
  expect(selection.getSnapshot().workspaceAccountId).toBe('');
  expect(() => selection.observeEntity('first', 'alice', true)).toThrow('WALLET_WORKSPACE_RUNTIME_MISMATCH');
  expect(() => selection.selectAccount('second', 'alice', 'peer')).toThrow('WALLET_WORKSPACE_ACCOUNT_ENTITY_MISMATCH');
});

test('wallet selection keeps stable snapshots and tears down view subscriptions', () => {
  const selection = new WalletWorkspaceSelection();
  let changes = 0;
  const unsubscribe = selection.subscribe(() => { changes += 1; });
  selection.bindRuntime('runtime');
  selection.observeEntity('runtime', 'alice', true);
  const before = selection.getSnapshot();
  selection.bindRuntime('runtime');
  selection.observeEntity('runtime', 'alice', true);
  expect(selection.getSnapshot()).toBe(before);
  expect(changes).toBe(3);
  unsubscribe();
  selection.selectEntity('runtime', 'bob');
  expect(changes).toBe(3);
  expect(new WalletWorkspaceSelection().getSnapshot().entityId).toBe('');
});

test('an explicit Entity read cannot silently publish the Runtime default Entity', () => {
  const projection = { activeEntityId: 'alice', height: 6 };
  expect(requireWalletWorkspaceEntity(projection, 'alice')).toBe(projection);
  expect(requireWalletWorkspaceEntity(projection, '')).toBe(projection);
  expect(() => requireWalletWorkspaceEntity(projection, 'bob')).toThrow('WALLET_WORKSPACE_ENTITY_MISMATCH:bob:alice');
  expect(() => requireWalletWorkspaceEntity({ activeEntityId: '' }, 'alice')).toThrow('WALLET_WORKSPACE_ENTITY_MISMATCH');
});

test('the retained Account rail exposes only Open Account before a relationship exists', () => {
  expect(ACCOUNT_WORKSPACE_TABS.map(tab => tab.id)).toEqual(['open', 'send', 'receive', 'swap', 'move', 'lending', 'history', 'configure', 'activity', 'appearance']);
  expect(accountWorkspaceTabsForAccounts(ACCOUNT_WORKSPACE_TABS, false)).toEqual([{ id: 'open', label: 'Open Account' }]);
  expect(accountWorkspaceTabsForAccounts(ACCOUNT_WORKSPACE_TABS, true)).toBe(ACCOUNT_WORKSPACE_TABS);
});
