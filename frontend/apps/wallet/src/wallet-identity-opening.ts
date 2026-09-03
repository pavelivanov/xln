import type { WalletBrainVaultPreparedView } from '../../../packages/browser/src/wallet-brainvault-opening';
import type {
  WalletCanonicalRecoveryDiscoveryView,
  WalletCanonicalRecoveryFile,
  WalletCanonicalRecoveryFileImport,
  WalletCanonicalRuntimeOpeningRequest,
} from '../../../packages/browser/src/wallet-runtime-opening';
import {
  importPreparedWalletBrainVaultRecoveryFile,
  importWalletRuntimeRecoveryFileWithCanonicalVault,
} from './wallet-embedded-runtime';

export const createMnemonicWalletOpeningRequest = (
  runtimeId: string,
  seed: string,
): WalletCanonicalRuntimeOpeningRequest => ({
  runtimeId,
  name: `Mnemonic ${runtimeId.slice(0, 6)}`,
  labelOverride: undefined,
  seed,
  mnemonic12: '',
  devicePassphrase: '',
  loginType: 'manual',
  unlockDurationMs: 600_000,
});

export const importWalletIdentityRecoveryFile = async (input: Readonly<{
  brainVault: WalletBrainVaultPreparedView | null;
  discovery: WalletCanonicalRecoveryDiscoveryView | null;
  file: File;
  mnemonicSeed: string;
  runtimeId: string;
}>): Promise<WalletCanonicalRecoveryFileImport> => {
  const file: WalletCanonicalRecoveryFile = {
    contents: await input.file.text(),
    sourceLabel: input.file.name.trim() || 'Local backup file',
  };
  if (input.brainVault) {
    return importPreparedWalletBrainVaultRecoveryFile(
      input.brainVault,
      input.discovery ?? input.brainVault.discovery,
      file,
    );
  }
  if (!input.mnemonicSeed || !input.runtimeId) {
    throw new Error('WALLET_VERIFIED_IDENTITY_REQUIRED');
  }
  return importWalletRuntimeRecoveryFileWithCanonicalVault(
    createMnemonicWalletOpeningRequest(input.runtimeId, input.mnemonicSeed),
    input.discovery,
    file,
  );
};
