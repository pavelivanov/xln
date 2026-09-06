import type { AccountReplica } from '@xln/core/api/public/runtime-module';
import { amountToUsd } from '../../../utils/assetPricing';

export function collateralRentEstimate(amount: bigint, decimals: number, symbol: string, minutes: number) {
  const usd = amountToUsd(amount, decimals, symbol);
  return usd * (1 / 100) * (minutes / 60);
}

// Shared by the retained and React forms; the committed peer policy owns fees.
export function resolveCollateralFeePolicy(account: AccountReplica | null | undefined, ownerEntityId: string, tokenId: number) {
  if (!account) return null;
  const owner = ownerEntityId.trim().toLowerCase();
  const side = owner === account.state.leftEntity.toLowerCase() ? 'right'
    : owner === account.state.rightEntity.toLowerCase() ? 'left' : null;
  if (!side) return null;
  const policy = account.state.rebalanceFeePolicies?.get(tokenId)?.[side];
  if (!policy) return null;
  return { policyVersion: policy.policyVersion, baseFee: policy.baseFee, liquidityFeeBps: policy.liquidityFeeBps, gasFee: policy.gasFee };
}

export function collateralRequestFee(policy: NonNullable<ReturnType<typeof resolveCollateralFeePolicy>>, amount: bigint) {
  return policy.baseFee + policy.gasFee + ((amount * policy.liquidityFeeBps) / 10000n);
}

export function buildCollateralRequest(account: AccountReplica, entityId: string, counterpartyEntityId: string, tokenId: number, amount: bigint) {
  if (amount <= 0n) throw new Error('Collateral request must be positive.');
  const policy = resolveCollateralFeePolicy(account, entityId, tokenId);
  if (!policy) throw new Error('Missing committed counterparty rebalance fee policy. Wait for the Account policy frame.');
  if (policy.baseFee < 0n || policy.gasFee < 0n || policy.liquidityFeeBps < 0n) throw new Error('Counterparty rebalance fee policy contains negative values.');
  const feeAmount = collateralRequestFee(policy, amount);
  if (feeAmount < 0n) throw new Error('Computed rebalance fee is negative. Counterparty policy is invalid.');
  if (feeAmount >= amount) throw new Error('Collateral fee must be lower than the gross request amount.');
  return { type: 'requestCollateral', data: { counterpartyEntityId, tokenId, amount, feeTokenId: tokenId, feeAmount, policyVersion: policy.policyVersion } } as const;
}
