import type { RuntimeAdapter } from '../../../core/api/public/runtime-module';
import { createActiveTabLockController } from '../../packages/browser/src/active-tab-lock';
import { createWalletEmbeddedRuntimeSession } from '../../packages/browser/src/runtime/wallet-embedded-runtime-session';

// One page owns the browser Runtime. Dock panels acquire reads from this session;
// panel teardown never suspends or replaces the live Runtime.
const activeTabLock = createActiveTabLockController({ publishState: () => {} });
let pageUnloadFence: () => void = () => {};
let pagehideInstalled = false;

export const setPageUnloadFence = (fence: () => void): void => {
  pageUnloadFence = fence;
};
export const browserRuntimeSession = createWalletEmbeddedRuntimeSession<RuntimeAdapter>({
  acquireLock: handler => activeTabLock.initializeActiveTabLock(handler),
  boot: async () => {
    const bootstrap = await import('./browser-runtime-bootstrap');
    return bootstrap.bootWalletEmbeddedRuntime(setPageUnloadFence);
  },
});

const handlePageHide = (event: PageTransitionEvent): void => {
  if (!event.persisted) pageUnloadFence();
};

export const installPagehideFence = (): void => {
  if (pagehideInstalled || typeof window === 'undefined') return;
  window.addEventListener('pagehide', handlePageHide);
  pagehideInstalled = true;
};

export const startBrowserRuntime = async (): Promise<RuntimeAdapter> => {
  installPagehideFence();
  return browserRuntimeSession.start();
};
