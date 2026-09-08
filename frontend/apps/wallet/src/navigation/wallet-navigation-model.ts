import {
  canonicalizeEntityPanelRoute,
  getLocationHashRoute,
  getLocationParamValue,
} from '../../../../packages/runtime-client/src/entity/entity-workspace-navigation';
import type { WalletAppView } from '../app-shell-model';

export type WalletPaymentTab = 'send' | 'receive' | 'operations' | 'external';
export type WalletMarketTab = 'market' | 'activity';
export type WalletSettingsSection = 'profile' | 'preferences' | 'recovery';
export type WalletAppRoute =
  | Readonly<{ view: 'entity-tools'; tab: 'ownership' | 'consensus'; entityId: string }>
  | Readonly<{ view: 'account-tools'; tab: 'configure' | 'move' | 'lending' | 'history' }>
  | Readonly<{ view: 'payments'; tab: WalletPaymentTab; invoice: string }>
  | Readonly<{ view: 'markets'; tab: WalletMarketTab }>
  | Readonly<{ view: 'settings'; section: WalletSettingsSection; entityId: string }>
  | Readonly<{ view: 'portfolio'; section: 'assets' | 'open' | 'appearance';
      focus?: Readonly<{ entityId: string; accountId: string; tokenId: number }>;
    }>
  | Readonly<{ view: Exclude<WalletAppView, 'payments' | 'markets' | 'settings' | 'portfolio' | 'account-tools' | 'entity-tools'> }>;

export const resolveWalletAppRoute = (search: string, hash = ''): WalletAppRoute => {
  const params = new URLSearchParams(search);
  if (params.get('locktest') === '1' && params.get('scenarioPreview') === '1') return { view: 'scenario-preview' };
  const rawRoute = getLocationHashRoute({ search, hash });
  const settingsEntityId = getLocationParamValue({ search, hash }, ['entity']) ?? '';
  if (rawRoute?.startsWith('pay/')) {
    return { view: 'payments', tab: 'send', invoice: `https://xln.finance/app${hash}` };
  }
  const route = canonicalizeEntityPanelRoute(rawRoute);
  if (route === 'ownership') return { view: 'entity-tools', tab: 'ownership', entityId: settingsEntityId };
  if (route === 'settings/consensus') return { view: 'entity-tools', tab: 'consensus', entityId: settingsEntityId };
  if (route === 'accounts/configure' || route === 'accounts/move' || route === 'accounts/lending' || route === 'accounts/history') {
    const tab = route === 'accounts/configure' ? 'configure' : route === 'accounts/move' ? 'move' : route === 'accounts/lending' ? 'lending' : 'history';
    return { view: 'account-tools', tab };
  }
  if (route === 'accounts/open') return { view: 'portfolio', section: 'open' };
  if (route === 'accounts/appearance') return { view: 'portfolio', section: 'appearance' };
  if (route === 'accounts/send') return { view: 'payments', tab: 'send', invoice: '' };
  if (route === 'accounts/receive') return { view: 'payments', tab: 'receive', invoice: '' };
  if (route === 'accounts/swap') return { view: 'markets', tab: 'market' };
  if (route === 'accounts/activity') return { view: 'markets', tab: 'activity' };
  if (route === 'settings/recovery') return { view: 'settings', section: 'recovery', entityId: settingsEntityId };
  if (route === 'settings/display') return { view: 'settings', section: 'preferences', entityId: settingsEntityId };
  if (route === 'settings' || route === 'settings/entity') return { view: 'settings', section: 'profile', entityId: settingsEntityId };
  if (params.get('setup') === '1' || params.has('demo')) return { view: 'identity' };
  if (params.get('portfolio') === '1') {
    const entityId = String(params.get('entity') || '')
      .trim()
      .toLowerCase();
    const accountId = String(params.get('account') || '')
      .trim()
      .toLowerCase();
    const tokenId = Number(params.get('token'));
    const focus =
      /^0x[0-9a-f]{64}$/u.test(entityId) &&
      /^0x[0-9a-f]{64}$/u.test(accountId) &&
      Number.isSafeInteger(tokenId) &&
      tokenId >= 1
        ? { entityId, accountId, tokenId }
        : undefined; return { view: 'portfolio', section: 'assets', ...(focus ? { focus } : {}) };
  }
  if (params.get('health') === '1') return { view: 'health' };
  if (params.get('payments') === '1') {
    const tool = params.get('paymentTool');
    const tab = tool === 'operations' || tool === 'external' ? tool : 'send';
    return { view: 'payments', tab, invoice: '' };
  }
  if (params.get('markets') === '1') return { view: 'markets', tab: 'market' };
  if (params.get('settings') === '1') return { view: 'settings', section: 'profile', entityId: settingsEntityId };
  return { view: params.get('diagnostics') === '1' ? 'diagnostics' : 'overview' };
};

export const walletPaymentTabHref = (tab: WalletPaymentTab): string =>
  tab === 'send' || tab === 'receive'
    ? `/app#accounts/${tab}`
    : `/app?payments=1&paymentTool=${tab}`;
