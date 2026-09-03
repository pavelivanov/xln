export const WALLET_VAULT_STORAGE_KEY = 'xln-vaults';

export type WalletVaultStorage = Readonly<{
  getItem: (key: string) => string | null;
}>;

export const hasPersistedWalletVault = (storage: WalletVaultStorage): boolean =>
  storage.getItem(WALLET_VAULT_STORAGE_KEY) !== null;
