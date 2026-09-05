import type { AccountWorkspaceTab } from './entity-workspace-navigation';

export const ACCOUNT_WORKSPACE_TABS = [
  { id: 'open', label: 'Open Account' },
  { id: 'send', label: 'Pay' },
  { id: 'receive', label: 'Receive' },
  { id: 'swap', label: 'Swap' },
  { id: 'move', label: 'Move' },
  { id: 'lending', label: 'Lending' },
  { id: 'history', label: 'History' },
  { id: 'configure', label: 'Manage' },
  { id: 'activity', label: 'Activity' },
  { id: 'appearance', label: 'Appearance' },
] as const satisfies readonly Readonly<{ id: AccountWorkspaceTab; label: string }>[];

export const accountWorkspaceTabsForAccounts = <T extends { id: AccountWorkspaceTab }>(
  tabs: readonly T[],
  hasAccounts: boolean,
): readonly T[] => hasAccounts ? tabs : tabs.filter(tab => tab.id === 'open');
