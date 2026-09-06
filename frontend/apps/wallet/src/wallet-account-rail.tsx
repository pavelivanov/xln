import { useSyncExternalStore } from 'react';
import { ACCOUNT_WORKSPACE_TABS, accountWorkspaceTabsForAccounts } from '../../../packages/runtime-client/src/account-workspace-tabs';
import { AccountWorkspaceRail } from '../../../packages/ui/src/account-workspace-rail';
import { navigateWallet } from './wallet-navigation';
import type { WalletAppRoute } from './wallet-navigation-model';
import type { WalletWorkspaceSelection } from './wallet-workspace-selection';

const tabs = ACCOUNT_WORKSPACE_TABS.map(tab => ({ ...tab, href: `/app#accounts/${tab.id}` }));

export function WalletAccountRail({ route, selection }: Readonly<{ route: WalletAppRoute; selection: WalletWorkspaceSelection }>) {
  const context = useSyncExternalStore(selection.subscribe, selection.getSnapshot, selection.getSnapshot);
  if (!context.entityId || (route.view !== 'portfolio' && route.view !== 'payments' && route.view !== 'markets' && route.view !== 'account-tools')) return null;
  if (route.view === 'portfolio' && route.section !== 'appearance' && context.focusedAccountId) return null;
  const activeTab = route.view === 'account-tools' ? route.tab : route.view === 'portfolio' ? route.section === 'assets' ? null : route.section
    : route.view === 'payments' ? route.tab === 'send' || route.tab === 'receive' ? route.tab : null
    : route.tab === 'market' ? 'swap' : 'activity';
  return <AccountWorkspaceRail tabs={accountWorkspaceTabsForAccounts(tabs, context.hasAccounts)} activeTab={activeTab} onNavigate={navigateWallet} />;
}
