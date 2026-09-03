import type { RuntimeAdapter } from '../../../../core/api/public/runtime-module';
import { createActiveTabLockController } from '../../../packages/browser/src/active-tab-lock';
import {
  createWalletEmbeddedRuntimeSession,
  type WalletEmbeddedRuntimeSessionSnapshot,
} from '../../../packages/browser/src/wallet-embedded-runtime-session';
import type {
  WalletCanonicalRecoveryDiscoveryView,
  WalletCanonicalRuntimeOpeningOutcome,
  WalletCanonicalRuntimeOpeningRequest,
} from '../../../packages/browser/src/wallet-runtime-opening';
import type {
  WalletBrainVaultDerivationInput,
  WalletBrainVaultDerivationProgress,
  WalletBrainVaultPreparedView,
} from '../../../packages/browser/src/wallet-brainvault-opening';

const activeTabLock = createActiveTabLockController({ publishState: () => {} });
let pageUnloadFence: () => void = () => {};
let pagehideInstalled = false;
let discardCanonicalRecovery: ((token?: string) => void) | null = null;
let discardCanonicalBrainVault: ((token?: string) => void) | null = null;

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

const openDiscoveredWalletRuntime = async (
  request: WalletCanonicalRuntimeOpeningRequest,
  discovery: WalletCanonicalRecoveryDiscoveryView,
  candidateId: string,
): Promise<WalletCanonicalRuntimeOpeningOutcome> => {
  const canonical = await import('../../../bridges/wallet-canonical-vault-runtime');
  try {
    const adapter = await session.replace(async () => {
      return canonical.openCanonicalWalletRuntime(
        request,
        discovery.token,
        candidateId,
        setPageUnloadFence,
      );
    });
    return { status: 'opened', runtimeId: adapter.runtimeId };
  } catch (error) {
    canonical.discardCanonicalWalletRuntimeRecovery(discovery.token);
    throw error;
  }
};

export const openWalletRuntimeWithCanonicalVault = async (
  request: WalletCanonicalRuntimeOpeningRequest,
): Promise<WalletCanonicalRuntimeOpeningOutcome> => {
  installPagehideFence();
  await session.start();
  const canonical = await import('../../../bridges/wallet-canonical-vault-runtime');
  discardCanonicalRecovery = canonical.discardCanonicalWalletRuntimeRecovery;
  const discovery = await canonical.discoverCanonicalWalletRuntimeRecoveryView(request);
  if (discovery.candidates.length > 0) return { status: 'recovery-required', discovery };
  return openDiscoveredWalletRuntime(request, discovery, '');
};

export const restoreWalletRuntimeFromCanonicalRecovery = (
  request: WalletCanonicalRuntimeOpeningRequest,
  discovery: WalletCanonicalRecoveryDiscoveryView,
  candidateId: string,
): Promise<WalletCanonicalRuntimeOpeningOutcome> =>
  openDiscoveredWalletRuntime(request, discovery, candidateId);

export const discardWalletRuntimeRecovery = (token = ''): void => {
  discardCanonicalRecovery?.(token);
};

export const prepareWalletBrainVaultWithCanonicalVault = async (
  input: WalletBrainVaultDerivationInput,
  onProgress: (progress: WalletBrainVaultDerivationProgress) => void,
): Promise<WalletBrainVaultPreparedView> => {
  installPagehideFence();
  await session.start();
  const canonical = await import('../../../bridges/wallet-canonical-vault-runtime');
  discardCanonicalBrainVault = canonical.discardCanonicalWalletBrainVault;
  return canonical.prepareCanonicalWalletBrainVault(input, onProgress);
};

export const openPreparedWalletBrainVault = async (
  prepared: WalletBrainVaultPreparedView,
  candidateId: string,
): Promise<WalletCanonicalRuntimeOpeningOutcome> => {
  const canonical = await import('../../../bridges/wallet-canonical-vault-runtime');
  try {
    const adapter = await session.replace(() => canonical.openCanonicalWalletBrainVault(
      prepared.token,
      prepared.runtimeId,
      prepared.discovery.token,
      candidateId,
      setPageUnloadFence,
    ));
    return { status: 'opened', runtimeId: adapter.runtimeId };
  } catch (error) {
    canonical.discardCanonicalWalletBrainVault(prepared.token);
    throw error;
  }
};

export const discardWalletBrainVault = (token = ''): void => {
  discardCanonicalBrainVault?.(token);
};

export const stopWalletEmbeddedRuntime = (): Promise<void> => session.stop();

export const requireWalletEmbeddedRuntimeAdapter = (): RuntimeAdapter =>
  session.requireAdapter();

export const getWalletEmbeddedRuntimeSnapshot = (): WalletEmbeddedRuntimeSessionSnapshot =>
  session.getSnapshot();

export const subscribeWalletEmbeddedRuntime = (listener: () => void): (() => void) =>
  session.subscribe(listener);
