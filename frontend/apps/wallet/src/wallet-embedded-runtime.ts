import type { RuntimeAdapter } from '../../../../core/api/public/runtime-module';
import { createActiveTabLockController } from '../../../packages/browser/src/active-tab-lock';
import {
  createWalletEmbeddedRuntimeSession,
  type WalletEmbeddedRuntimeSessionSnapshot,
} from '../../../packages/browser/src/wallet-embedded-runtime-session';
import type { WalletCanonicalRuntimeOpeningRequest } from '../../../packages/browser/src/wallet-runtime-opening';

const activeTabLock = createActiveTabLockController({ publishState: () => {} });
let pageUnloadFence: () => void = () => {};
let pagehideInstalled = false;

const setPageUnloadFence = (fence: () => void): void => {
  pageUnloadFence = fence;
};

const session = createWalletEmbeddedRuntimeSession<RuntimeAdapter>({
  acquireLock: handler => activeTabLock.initializeActiveTabLock(handler),
  boot: async () => {
    const bootstrap = await import('./wallet-embedded-runtime-bootstrap');
    return bootstrap.bootWalletEmbeddedRuntime(setPageUnloadFence);
  },
});

const handlePageHide = (event: PageTransitionEvent): void => {
  if (!event.persisted) pageUnloadFence();
};

const installPagehideFence = (): void => {
  if (pagehideInstalled || typeof window === 'undefined') return;
  window.addEventListener('pagehide', handlePageHide);
  pagehideInstalled = true;
};

export const startWalletEmbeddedRuntime = async (): Promise<RuntimeAdapter> => {
  installPagehideFence();
  return session.start();
};

export const openWalletRuntimeWithCanonicalVault = async (
  request: WalletCanonicalRuntimeOpeningRequest,
): Promise<string> => {
  installPagehideFence();
  await session.start();
  const adapter = await session.replace(async () => {
    const canonical = await import('../../../bridges/wallet-canonical-vault-runtime');
    return canonical.openCanonicalWalletRuntime(request, setPageUnloadFence);
  });
  return adapter.runtimeId;
};

export const stopWalletEmbeddedRuntime = (): Promise<void> => session.stop();

export const requireWalletEmbeddedRuntimeAdapter = (): RuntimeAdapter =>
  session.requireAdapter();

export const getWalletEmbeddedRuntimeSnapshot = (): WalletEmbeddedRuntimeSessionSnapshot =>
  session.getSnapshot();

export const subscribeWalletEmbeddedRuntime = (listener: () => void): (() => void) =>
  session.subscribe(listener);
