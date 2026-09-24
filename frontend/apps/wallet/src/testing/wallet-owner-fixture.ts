import type { VaultUnlockDurationMs } from '../../../../packages/browser/src/vault/vault-protection';
import { unlockVaultRuntimeSecrets, vaultOperations } from '../../../../bridges/vault/vault-store';

export const unlockWalletOwnerFixture = async (
  runtimeId: string,
  seed: string,
  durationMs: VaultUnlockDurationMs,
): Promise<string> => {
  vaultOperations.loadFromStorage();
  return unlockVaultRuntimeSecrets(runtimeId, seed, durationMs);
};
