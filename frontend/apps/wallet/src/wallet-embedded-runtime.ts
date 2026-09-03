import type { RuntimeAdapter } from '../../../../core/api/public/runtime-module';
import { createActiveTabLockController } from '../../../packages/browser/src/active-tab-lock';
import {
  createWalletEmbeddedRuntimeSession,
  type WalletEmbeddedRuntimeSessionSnapshot,
} from '../../../packages/browser/src/wallet-embedded-runtime-session';
import type {
  WalletCanonicalRecoveryDiscoveryView,
  WalletCanonicalRecoveryFile,
  WalletCanonicalRecoveryFileImport,
  WalletCanonicalRuntimeOpeningOutcome,
  WalletCanonicalRuntimeOpeningRequest,
} from '../../../packages/browser/src/wallet-runtime-opening';
import { mergeWalletRecoveryCandidate } from '../../../packages/browser/src/wallet-recovery-choice';
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
let recoveryFileImportRevision = 0;

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

const mergeImportedRecoveryCandidate = (
  discovery: WalletCanonicalRecoveryDiscoveryView,
  candidate: WalletCanonicalRecoveryDiscoveryView['candidates'][number],
): WalletCanonicalRecoveryFileImport => ({
  candidateId: candidate.id,
  discovery: {
    ...discovery,
    candidates: mergeWalletRecoveryCandidate(discovery.candidates, candidate),
  },
});

export const importWalletRuntimeRecoveryFileWithCanonicalVault = async (
  request: WalletCanonicalRuntimeOpeningRequest,
  discovery: WalletCanonicalRecoveryDiscoveryView | null,
  file: WalletCanonicalRecoveryFile,
): Promise<WalletCanonicalRecoveryFileImport> => {
  const revision = recoveryFileImportRevision + 1;
  recoveryFileImportRevision = revision;
  installPagehideFence();
  await session.start();
  if (revision !== recoveryFileImportRevision) throw new Error('WALLET_RECOVERY_FILE_IMPORT_CANCELLED');
  const canonical = await import('../../../bridges/wallet-canonical-vault-runtime');
  if (revision !== recoveryFileImportRevision) throw new Error('WALLET_RECOVERY_FILE_IMPORT_CANCELLED');
  discardCanonicalRecovery = canonical.discardCanonicalWalletRuntimeRecovery;
  const current = discovery ?? await canonical.discoverCanonicalWalletRuntimeRecoveryView(request);
  if (revision !== recoveryFileImportRevision) {
    canonical.discardCanonicalWalletRuntimeRecovery(current.token);
    throw new Error('WALLET_RECOVERY_FILE_IMPORT_CANCELLED');
  }
  const candidate = await canonical.importCanonicalWalletRuntimeRecoveryFile(
    request, current.token, file,
  );
  if (revision !== recoveryFileImportRevision) {
    canonical.discardCanonicalWalletRuntimeRecovery(current.token);
    throw new Error('WALLET_RECOVERY_FILE_IMPORT_CANCELLED');
  }
  return mergeImportedRecoveryCandidate(current, candidate);
};

export const discardWalletRuntimeRecovery = (token = ''): void => {
  recoveryFileImportRevision += 1;
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

export const importPreparedWalletBrainVaultRecoveryFile = async (
  prepared: WalletBrainVaultPreparedView,
  discovery: WalletCanonicalRecoveryDiscoveryView,
  file: WalletCanonicalRecoveryFile,
): Promise<WalletCanonicalRecoveryFileImport> => {
  const canonical = await import('../../../bridges/wallet-canonical-vault-runtime');
  const candidate = await canonical.importCanonicalWalletBrainVaultRecoveryFile(
    prepared.token, prepared.runtimeId, discovery.token, file,
  );
  return mergeImportedRecoveryCandidate(discovery, candidate);
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
