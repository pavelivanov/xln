import type { EntityTx } from '@xln/core/api/public/runtime-module';
import { isAddress, ZeroAddress } from 'ethers';
import { buildExternalToReserveTx, buildMoveSettlementContinuation, buildReserveToCollateralTx,
  buildReserveToExternalEoaTx, buildReserveToReserveTx, type MovePostSettleOp } from '../../../../src/lib/components/Entity/account/entity-action-txs';
import { getMoveRouteKey, type MoveEndpoint } from '../../../../src/lib/components/Entity/move-routes';

export type WalletMoveDraft = Readonly<{
  from: MoveEndpoint; to: MoveEndpoint; entityId: string; sourceAccountId: string; targetEntityId: string;
  targetHubId: string; reserveRecipient: string; externalRecipient: string; tokenId: number; amount: bigint; tokenAddress: string;
}>;

export function buildWalletMoveDraftTxs(draft: WalletMoveDraft): EntityTx[] {
  if (draft.amount <= 0n) throw new Error('MOVE_AMOUNT_NOT_POSITIVE');
  const { entityId, tokenId, amount } = draft;
  const route = getMoveRouteKey(draft.from, draft.to);
  if (route === 'external->external') throw new Error('MOVE_DIRECT_REQUIRES_EXTERNAL_AUTHORITY');
  if (draft.to === 'external' && !isAddress(draft.externalRecipient)) throw new Error('MOVE_EXTERNAL_RECIPIENT_INVALID');
  if (draft.from === 'account') {
    const postSettleOp: MovePostSettleOp = draft.to === 'external' ? { type: 'r2e', recipientEoa: draft.externalRecipient }
      : draft.to === 'account' ? { type: 'reserve_to_collateral', targetEntityId: draft.targetEntityId, counterpartyEntityId: draft.targetHubId }
      : { type: 'none' };
    // Match the retained draft flow: its c2r lands in the owner's reserve and
    // carries the existing continuation for external/Account destinations.
    return [{ type: 'settle_propose', data: { counterpartyEntityId: draft.sourceAccountId,
      executorIsLeft: entityId.toLowerCase() < draft.sourceAccountId.toLowerCase(), memo: 'asset-c2r',
      ops: [{ type: 'c2r', tokenId, amount }], continuation: buildMoveSettlementContinuation(entityId, tokenId, amount, postSettleOp, false) } }];
  }
  const funding = () => buildReserveToCollateralTx({ selfEntityId: entityId, receivingEntityId: draft.targetEntityId,
    counterpartyEntityId: draft.targetHubId, tokenId, amount });
  if (draft.from === 'external') {
    if (!isAddress(draft.tokenAddress) || draft.tokenAddress === ZeroAddress) throw new Error('MOVE_ERC20_REQUIRED');
    const deposit = buildExternalToReserveTx({ contractAddress: draft.tokenAddress, amount, internalTokenId: tokenId });
    return draft.to === 'account' ? [deposit, funding()] : [deposit];
  }
  if (draft.to === 'external') return [buildReserveToExternalEoaTx(draft.externalRecipient, tokenId, amount)];
  if (draft.to === 'account') return [funding()];
  return [buildReserveToReserveTx(draft.reserveRecipient, tokenId, amount)];
}
