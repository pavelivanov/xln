import {
  canonicalizeEntityPanelRoute,
  getLocationHashRoute,
} from '../../../packages/runtime-client/src/entity-workspace-navigation';
import type { WalletAppView } from './app-shell-model';

export type WalletPaymentTab = 'send' | 'receive' | 'operations' | 'external';
export type WalletMarketTab = 'market' | 'activity';
export type WalletSettingsSection = 'all' | 'preferences' | 'recovery';
export type WalletAppRoute =
  | Readonly<{ view: 'payments'; tab: WalletPaymentTab; invoice: string }>
  | Readonly<{ view: 'markets'; tab: WalletMarketTab }>
  | Readonly<{ view: 'settings'; section: WalletSettingsSection }>
  | Readonly<{ view: 'portfolio'; section: 'assets' | 'open' | 'appearance' }>
  | Readonly<{ view: Exclude<WalletAppView, 'payments' | 'markets' | 'settings' | 'portfolio'> }>;

export const resolveWalletAppRoute = (search: string, hash = ''): WalletAppRoute => {
  const params = new URLSearchParams(search);
  if (params.get('locktest') === '1' && params.get('scenarioPreview') === '1') return { view: 'scenario-preview' };
  const rawRoute = getLocationHashRoute({ search, hash });
  if (rawRoute?.startsWith('pay/')) {
    return { view: 'payments', tab: 'send', invoice: `https://xln.finance/app${hash}` };
  }
  const route = canonicalizeEntityPanelRoute(rawRoute);
  if (route === 'accounts/open') return { view: 'portfolio', section: 'open' };
  if (route === 'accounts/appearance') return { view: 'portfolio', section: 'appearance' };
  if (route === 'accounts/send') return { view: 'payments', tab: 'send', invoice: '' };
  if (route === 'accounts/receive') return { view: 'payments', tab: 'receive', invoice: '' };
  if (route === 'accounts/swap') return { view: 'markets', tab: 'market' };
  if (route === 'accounts/activity') return { view: 'markets', tab: 'activity' };
  if (route === 'settings/recovery') return { view: 'settings', section: 'recovery' };
  if (route === 'settings/display') return { view: 'settings', section: 'preferences' };
  if (route === 'settings') return { view: 'settings', section: 'all' };
  if (params.get('setup') === '1' || params.has('demo')) return { view: 'identity' };
  if (params.get('portfolio') === '1') return { view: 'portfolio', section: 'assets' };
  if (params.get('health') === '1') return { view: 'health' };
  if (params.get('payments') === '1') {
    const tool = params.get('paymentTool');
    const tab = tool === 'operations' || tool === 'external' ? tool : 'send';
    return { view: 'payments', tab, invoice: '' };
  }
  if (params.get('markets') === '1') return { view: 'markets', tab: 'market' };
  if (params.get('settings') === '1') return { view: 'settings', section: 'all' };
  return { view: params.get('diagnostics') === '1' ? 'diagnostics' : 'overview' };
};

export const walletPaymentTabHref = (tab: WalletPaymentTab): string =>
  tab === 'send' || tab === 'receive'
    ? `/app#accounts/${tab}`
    : `/app?payments=1&paymentTool=${tab}`;
