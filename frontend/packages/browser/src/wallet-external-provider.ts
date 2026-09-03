export type WalletExternalAuthorityPlatform = 'web' | 'desktop' | 'ios' | 'android';

export type WalletExternalToken = Readonly<{
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  tokenId: number;
  tokenType: 0;
  externalTokenId: string;
  balance: bigint;
  allowance: bigint;
}>;

export type WalletExternalProviderBinding = Readonly<{
  runtimeId: string;
  entityId: string;
  signerId: string;
  owner: string;
  jurisdiction: string;
  adapterMode: string;
  chainId: number;
  depository: string;
  platform: WalletExternalAuthorityPlatform;
}>;

export type WalletExternalProviderReadyView = WalletExternalProviderBinding & Readonly<{
  state: 'ready';
  sourceHeight: number;
  sourceHash: string;
  finalityDepth: number;
  headBlockNumber: number;
  nativeBalance: bigint;
  tokens: readonly WalletExternalToken[];
  writable: boolean;
  blockedReason: string;
}>;

export type WalletExternalProviderView =
  | WalletExternalProviderReadyView
  | Readonly<{ state: 'unavailable'; reason: string }>;

export type WalletExternalTransferRequest = Readonly<{
  binding: WalletExternalProviderBinding;
  tokenAddress: string;
  recipient: string;
  amount: bigint;
}>;

export type WalletExternalApprovalRequest = Readonly<{
  binding: WalletExternalProviderBinding;
  tokenAddress: string;
  amount: bigint;
}>;

export type WalletExternalOperation = Readonly<{
  kind: 'transfer' | 'approve';
  binding: WalletExternalProviderBinding;
  tokenAddress: string;
  amount: bigint;
  transactionHash: string;
  contextCurrent: boolean;
}>;

const EOA_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export const normalizeWalletExternalAddress = (value: string): string => {
  const normalized = value.trim();
  if (!EOA_PATTERN.test(normalized)) throw new Error('EXTERNAL_WALLET_ADDRESS_INVALID');
  return normalized.toLowerCase();
};

export const encodeWalletExternalRecipient = (value: string): string => {
  const address = normalizeWalletExternalAddress(value);
  return `0x${address.slice(2).padStart(64, '0')}`;
};

const requireDecimals = (decimals: number): number => {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('EXTERNAL_WALLET_DECIMALS_INVALID');
  }
  return decimals;
};

export const parseWalletExternalAmount = (
  raw: string,
  decimals: number,
  available?: bigint,
): bigint => {
  const value = raw.trim();
  const scale = requireDecimals(decimals);
  if (!value) throw new Error('EXTERNAL_WALLET_AMOUNT_REQUIRED');
  if (!/^(?:\d+|\d+\.\d*|\.\d+)$/.test(value)) {
    throw new Error('EXTERNAL_WALLET_AMOUNT_FORMAT_INVALID');
  }
  const [whole = '0', fraction = ''] = value.split('.');
  if (fraction.length > scale) throw new Error('EXTERNAL_WALLET_AMOUNT_PRECISION_EXCEEDED');
  const amount = BigInt(whole || '0') * (10n ** BigInt(scale))
    + BigInt((fraction || '').padEnd(scale, '0') || '0');
  if (amount <= 0n) throw new Error('EXTERNAL_WALLET_AMOUNT_NOT_POSITIVE');
  if (available !== undefined && amount > available) {
    throw new Error('EXTERNAL_WALLET_AMOUNT_EXCEEDS_BALANCE');
  }
  return amount;
};

export const formatWalletExternalAmount = (
  amount: bigint,
  decimals: number,
  maximumFractionDigits = 6,
): string => {
  const scale = requireDecimals(decimals);
  const divisor = 10n ** BigInt(scale);
  const whole = amount / divisor;
  if (scale === 0) return whole.toString();
  const fraction = (amount % divisor).toString().padStart(scale, '0');
  const visible = fraction
    .slice(0, Math.max(0, Math.min(scale, maximumFractionDigits)))
    .replace(/0+$/, '');
  return visible ? `${whole}.${visible}` : whole.toString();
};

export const walletExternalBindingMatches = (
  left: WalletExternalProviderBinding,
  right: WalletExternalProviderBinding,
): boolean => (
  left.runtimeId === right.runtimeId
  && left.entityId === right.entityId
  && left.signerId === right.signerId
  && left.owner === right.owner
  && left.jurisdiction === right.jurisdiction
  && left.adapterMode === right.adapterMode
  && left.chainId === right.chainId
  && left.depository === right.depository
  && left.platform === right.platform
);

export const walletExternalCompletionMessage = (
  kind: WalletExternalOperation['kind'],
  contextCurrent: boolean,
): string => {
  const action = kind === 'approve' ? 'Approval' : 'Transfer';
  return contextCurrent
    ? `${action} confirmed. Finalized balances are refreshing.`
    : `${action} confirmed. The selected authority changed after submission; no second transaction was submitted.`;
};
