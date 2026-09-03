import type { WalletCanonicalRecoveryDiscoveryView } from './wallet-runtime-opening';

export type WalletBrainVaultDerivationInput = Readonly<{
  name: string;
  passphrase: string;
  factor: number;
}>;

export type WalletBrainVaultDerivationProgress = Readonly<{
  phase: 'deriving' | 'recovery';
  completed: number;
  total: number;
  workers: number;
  notice: string;
}>;

export type WalletBrainVaultPreparedView = Readonly<{
  token: string;
  runtimeId: string;
  name: string;
  factor: number;
  shardCount: number;
  discovery: WalletCanonicalRecoveryDiscoveryView;
}>;

export type WalletBrainVaultDerivedMaterial = Readonly<{
  runtimeId: string;
  name: string;
  factor: number;
  shardCount: number;
  mnemonic24: string;
  mnemonic12: string;
  devicePassphrase: string;
}>;
