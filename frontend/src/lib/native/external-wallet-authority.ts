import { Capacitor } from '@capacitor/core';

import type { WalletExternalAuthorityPlatform } from '../../../packages/browser/src/wallet-external-provider';

export const resolveExternalWalletAuthorityPlatform = (): WalletExternalAuthorityPlatform => {
  if (window.xlnDesktop) return 'desktop';
  if (!Capacitor.isNativePlatform()) return 'web';
  const platform = Capacitor.getPlatform();
  if (platform === 'ios' || platform === 'android') return platform;
  throw new Error(`EXTERNAL_WALLET_NATIVE_PLATFORM_UNSUPPORTED:${platform}`);
};
