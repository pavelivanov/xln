import {
  bytesToHex,
  combineShards,
  deriveEthereumAddress,
  deriveKey,
  entropyToMnemonic,
} from '../../brainvault/core.ts';
import type {
  WalletBrainVaultDerivationInput,
  WalletBrainVaultDerivedMaterial,
} from '../packages/browser/src/wallet-brainvault-opening';
import { resolveWalletBrainVaultFinalizationShardOrder } from '../packages/browser/src/wallet-brainvault-finalization';

export const finalizeWalletBrainVaultMaterial = async (
  input: WalletBrainVaultDerivationInput,
  shardCount: number,
  results: ReadonlyMap<number, Uint8Array>,
  isCurrent: () => boolean,
): Promise<WalletBrainVaultDerivedMaterial> => {
  const order = resolveWalletBrainVaultFinalizationShardOrder(shardCount, new Set(results.keys()));
  const ordered = order.map((index) => {
    const shard = results.get(index);
    if (!shard) throw new Error(`Missing shard ${index}`);
    return shard;
  });
  let master: Uint8Array | null = null;
  let entropy24: Uint8Array | null = null;
  let entropy12: Uint8Array | null = null;
  let deviceKey: Uint8Array | null = null;
  try {
    master = await combineShards(ordered, input.factor);
    if (!isCurrent()) throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
    entropy24 = await deriveKey(master, 'bip39/entropy/v1.0', 32);
    if (!isCurrent()) throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
    entropy12 = await deriveKey(master, 'bip39/entropy-128/v1.0', 16);
    if (!isCurrent()) throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
    deviceKey = await deriveKey(master, 'bip39/passphrase/v1.0', 32);
    if (!isCurrent()) throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
    const mnemonic24 = await entropyToMnemonic(entropy24);
    if (!isCurrent()) throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
    const mnemonic12 = await entropyToMnemonic(entropy12);
    if (!isCurrent()) throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
    const runtimeId = (await deriveEthereumAddress(mnemonic24)).toLowerCase();
    if (!isCurrent()) throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
    return {
      runtimeId,
      name: input.name,
      factor: input.factor,
      shardCount,
      mnemonic24,
      mnemonic12,
      devicePassphrase: bytesToHex(deviceKey),
    };
  } finally {
    master?.fill(0);
    entropy24?.fill(0);
    entropy12?.fill(0);
    deviceKey?.fill(0);
  }
};
