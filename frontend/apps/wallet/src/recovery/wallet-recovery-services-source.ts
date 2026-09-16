import type {
  WalletRecoveryServicesMutation,
  WalletRecoveryServicesReadyView,
  WalletRecoveryServicesView,
} from '../../../../packages/browser/src/recovery/wallet-recovery-services';

export const observeWalletRecoveryServices = async (
  mutation: WalletRecoveryServicesMutation | null,
  onChange: (view: WalletRecoveryServicesView) => void,
  onError: (error: unknown) => void,
): Promise<() => void> => {
  const canonical = await import('../../../../bridges/wallet/wallet-canonical-recovery-services');
  return canonical.observeCanonicalWalletRecoveryServices(mutation, onChange, onError);
};

export const previewWalletRecoveryServices = async (
  mutation: WalletRecoveryServicesMutation,
): Promise<WalletRecoveryServicesReadyView> => {
  const canonical = await import('../../../../bridges/wallet/wallet-canonical-recovery-services');
  return canonical.previewCanonicalWalletRecoveryServices(mutation);
};

export const saveWalletRecoveryServices = async (
  mutation: WalletRecoveryServicesMutation,
): Promise<WalletRecoveryServicesReadyView> => {
  const canonical = await import('../../../../bridges/wallet/wallet-canonical-recovery-services');
  return canonical.saveCanonicalWalletRecoveryServices(mutation);
};
