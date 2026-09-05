import { useSyncExternalStore } from 'react';

import { resolveWalletAppRoute, type WalletAppRoute } from './wallet-navigation-model';

const navigationEvent = 'xln:wallet-navigation';
const readLocation = (): string => `${window.location.pathname}${window.location.search}${window.location.hash}`;
const subscribeLocation = (listener: () => void): (() => void) => {
  window.addEventListener('popstate', listener);
  window.addEventListener('hashchange', listener);
  window.addEventListener(navigationEvent, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener('hashchange', listener);
    window.removeEventListener(navigationEvent, listener);
  };
};

export const navigateWallet = (href: string): void => {
  if (href === readLocation()) return;
  window.history.pushState(window.history.state, '', href);
  window.dispatchEvent(new Event(navigationEvent));
  window.scrollTo({ top: 0, behavior: 'auto' });
};

export const useWalletRoute = (): WalletAppRoute => {
  // A primitive snapshot stays referentially stable between navigation events.
  const location = useSyncExternalStore(subscribeLocation, readLocation, () => '/app');
  const url = new URL(location, 'https://xln.finance');
  return resolveWalletAppRoute(url.search, url.hash);
};
