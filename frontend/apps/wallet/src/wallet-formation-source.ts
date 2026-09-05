import type { WalletFormationRequest } from '../../../packages/browser/src/wallet-formation';

export const loadWalletFormation = () => import('../../../bridges/wallet-canonical-formation');
export const createWalletFormation = async (request: WalletFormationRequest, signal: AbortSignal) => {
  const bridge = await loadWalletFormation();
  signal.throwIfAborted();
  return bridge.createCanonicalWalletFormation(request, signal);
};
