import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import type { WalletFormationRequest } from '../../../../packages/browser/src/wallet/wallet-formation';

export const loadWalletFormation = () => import('../../../../bridges/wallet/wallet-canonical-formation');
export const createWalletFormation = async (adapter: RuntimeAdapter, request: WalletFormationRequest, signal: AbortSignal) => {
  const bridge = await loadWalletFormation();
  signal.throwIfAborted();
  return bridge.createCanonicalWalletFormation(adapter, request, signal);
};
