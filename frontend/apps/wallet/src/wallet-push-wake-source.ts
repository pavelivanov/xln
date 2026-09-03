import type {
  WalletPushWakeOperation,
  WalletPushWakeView,
} from '../../../packages/browser/src/wallet-push-wake';

export const readWalletPushWake = async (): Promise<WalletPushWakeView> => {
  const canonical = await import('../../../bridges/wallet-canonical-push-wake');
  return canonical.readCanonicalWalletPushWake();
};

export const registerWalletPushWake = async (runtimeId: string): Promise<WalletPushWakeOperation> => {
  const canonical = await import('../../../bridges/wallet-canonical-push-wake');
  return canonical.registerCanonicalWalletPushWake(runtimeId);
};

export const unregisterWalletPushWake = async (runtimeId: string): Promise<WalletPushWakeOperation> => {
  const canonical = await import('../../../bridges/wallet-canonical-push-wake');
  return canonical.unregisterCanonicalWalletPushWake(runtimeId);
};
