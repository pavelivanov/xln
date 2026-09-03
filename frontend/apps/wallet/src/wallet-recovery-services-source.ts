import type {
  WalletRecoveryServicesMutation,
  WalletRecoveryServicesReadyView,
  WalletRecoveryServicesView,
} from '../../../packages/browser/src/wallet-recovery-services';

export const readWalletRecoveryServices = async (): Promise<WalletRecoveryServicesView> => {
  const canonical = await import('../../../bridges/wallet-canonical-recovery-services');
  return canonical.readCanonicalWalletRecoveryServices();
};

export const previewWalletRecoveryServices = async (
  mutation: WalletRecoveryServicesMutation,
): Promise<WalletRecoveryServicesReadyView> => {
  const canonical = await import('../../../bridges/wallet-canonical-recovery-services');
  return canonical.previewCanonicalWalletRecoveryServices(mutation);
};

export const saveWalletRecoveryServices = async (
  mutation: WalletRecoveryServicesMutation,
): Promise<WalletRecoveryServicesReadyView> => {
  const canonical = await import('../../../bridges/wallet-canonical-recovery-services');
  return canonical.saveCanonicalWalletRecoveryServices(mutation);
};
