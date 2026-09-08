import type { RuntimeInput } from '../../../../../core/runtime/types';
import type { AccountState } from '../../../../../core/types/account';
import type { CrossJurisdictionSwapCommandPlan } from '../../../../../core/runtime/swap-cmd/swap-command-plan';

import type { WalletPaymentMath } from '../payments/wallet-payment-model';
import {
  normalizeRequiredRuntimeEntityId,
  requireRuntimeInteger,
  requireRuntimeMap,
  requireRuntimeRecord,
  requireRuntimeString,
} from '../runtime/wallet-runtime-decode';
import type { WalletMarketMath } from '../runtime/wallet-runtime-read-boundary';
import type { WalletCrossMarketTarget, WalletMarketProjection } from './wallet-market-model';

export type WalletCrossMarketDraft = Readonly<{
  routeValue: string;
  giveTokenId: number;
  wantTokenId: number;
  giveAmount: string;
  wantAmount: string;
}>;

export type WalletCrossMarketReview = Readonly<{
  draftKey: string;
  routeValue: string;
  orderId: string;
  sourceJurisdictionLabel: string;
  targetJurisdictionLabel: string;
  sourceEntityLabel: string;
  targetEntityLabel: string;
  sourceHubLabel: string;
  targetHubLabel: string;
  giveAssetLabel: string;
  wantAssetLabel: string;
  giveAmountLabel: string;
  wantAmountLabel: string;
  plan: CrossJurisdictionSwapCommandPlan;
}>;

type FrameEntity = Readonly<{
  entityId: string;
  signerId: string;
  label: string;
  isHub: boolean;
}>;

const readFrameEntities = (frame: unknown): readonly FrameEntity[] => {
  const root = requireRuntimeRecord(frame, 'WALLET_CROSS_FRAME');
  if (!Array.isArray(root['entities'])) throw new Error('WALLET_CROSS_ENTITIES_INVALID');
  return root['entities'].map((value): FrameEntity => {
    const entity = requireRuntimeRecord(value, 'WALLET_CROSS_ENTITY');
    return {
      entityId: normalizeRequiredRuntimeEntityId(entity['entityId'], 'WALLET_CROSS_ENTITY_ID'),
      signerId: requireRuntimeString(entity['signerId'], 'WALLET_CROSS_ENTITY_SIGNER').toLowerCase(),
      label: requireRuntimeString(entity['label'], 'WALLET_CROSS_ENTITY_LABEL'),
      isHub: entity['isHub'] === true,
    };
  });
};

const requireFrameEntity = (
  entities: readonly FrameEntity[],
  entityId: string,
  hub: boolean,
  code: string,
): FrameEntity => {
  const found = entities.find(entity => entity.entityId === entityId);
  if (!found || found.isHub !== hub || !found.signerId) throw new Error(code);
  return found;
};

const readAccount = (frame: unknown, entityId: string, hubEntityId: string): AccountState | null => {
  const root = requireRuntimeRecord(frame, 'WALLET_CROSS_ACCOUNT_FRAME');
  const active = requireRuntimeRecord(root['activeEntity'], 'WALLET_CROSS_ACTIVE_ENTITY');
  const accounts = requireRuntimeRecord(active['accounts'], 'WALLET_CROSS_ACCOUNTS');
  if (!Array.isArray(accounts['items'])) throw new Error('WALLET_CROSS_ACCOUNT_ITEMS_INVALID');
  for (const value of accounts['items']) {
    const account = requireRuntimeRecord(value, 'WALLET_CROSS_ACCOUNT');
    const state = requireRuntimeRecord(account['state'], 'WALLET_CROSS_ACCOUNT_STATE');
    const left = normalizeRequiredRuntimeEntityId(state['leftEntity'], 'WALLET_CROSS_ACCOUNT_LEFT');
    const right = normalizeRequiredRuntimeEntityId(state['rightEntity'], 'WALLET_CROSS_ACCOUNT_RIGHT');
    if (!new Set([left, right]).has(entityId) || !new Set([left, right]).has(hubEntityId)) continue;
    if (requireRuntimeString(account['status'], 'WALLET_CROSS_ACCOUNT_STATUS') !== 'active') {
      throw new Error('WALLET_CROSS_ACCOUNT_NOT_ACTIVE');
    }
    const deltas = requireRuntimeMap(state['deltas'], 'WALLET_CROSS_ACCOUNT_DELTAS');
    const dispute = requireRuntimeRecord(state['disputeConfig'], 'WALLET_CROSS_ACCOUNT_DISPUTE_CONFIG');
    const disputeConfig = {
      leftResponseSeconds: requireRuntimeInteger(
        dispute['leftResponseSeconds'],
        'WALLET_CROSS_LEFT_RESPONSE_SECONDS',
        1,
      ),
      rightResponseSeconds: requireRuntimeInteger(
        dispute['rightResponseSeconds'],
        'WALLET_CROSS_RIGHT_RESPONSE_SECONDS',
        1,
      ),
    };
    return { ...state, leftEntity: left, rightEntity: right, deltas, disputeConfig } as AccountState;
  }
  return null;
};

const committedRoles = (entities: readonly FrameEntity[]): ReadonlyMap<string, boolean> =>
  new Map(entities.map(entity => [entity.entityId, entity.isHub]));

const draftTarget = (projection: WalletMarketProjection, draft: WalletCrossMarketDraft): WalletCrossMarketTarget => {
  const target = projection.crossTargets.find(candidate => candidate.routeValue === draft.routeValue);
  if (!target) throw new Error('WALLET_CROSS_TARGET_UNKNOWN');
  return target;
};

export const walletCrossMarketDraftKey = (draft: WalletCrossMarketDraft): string =>
  [draft.routeValue, draft.giveTokenId, draft.wantTokenId, draft.giveAmount.trim(), draft.wantAmount.trim()].join('|');

export const buildWalletCrossMarketReview = (
  draft: WalletCrossMarketDraft,
  projection: WalletMarketProjection,
  sourceFrame: unknown,
  targetFrame: unknown,
  paymentMath: WalletPaymentMath,
  marketMath: WalletMarketMath,
): WalletCrossMarketReview => {
  const target = draftTarget(projection, draft);
  const hub = projection.hubs.find(candidate => candidate.entityId === projection.selectedHubId);
  if (!hub) throw new Error('WALLET_CROSS_SOURCE_HUB_UNKNOWN');
  if (draft.giveTokenId === draft.wantTokenId) throw new Error('WALLET_CROSS_TOKEN_PAIR_INVALID');
  const giveToken = projection.tokens.find(token => token.tokenId === draft.giveTokenId);
  const wantToken = projection.tokens.find(token => token.tokenId === draft.wantTokenId);
  if (!giveToken || !wantToken) throw new Error('WALLET_CROSS_TOKEN_UNKNOWN');
  const rawGive = paymentMath.parseTokenAmount(draft.giveTokenId, draft.giveAmount.trim());
  const rawWant = paymentMath.parseTokenAmount(draft.wantTokenId, draft.wantAmount.trim());
  if (rawGive <= 0n || rawWant <= 0n) throw new Error('WALLET_CROSS_AMOUNT_NOT_POSITIVE');
  const dimensions = marketMath.getStaticSwapTokenDimensions(draft.giveTokenId, draft.wantTokenId);
  const prepared = marketMath.prepareSwapOrderForDimensions(
    draft.giveTokenId,
    draft.wantTokenId,
    rawGive,
    rawWant,
    dimensions,
  );
  if (!prepared) throw new Error('WALLET_CROSS_ORDER_BELOW_CANONICAL_LOT');

  const sourceEntities = readFrameEntities(sourceFrame);
  const targetEntities = readFrameEntities(targetFrame);
  const sourceEntity = requireFrameEntity(
    sourceEntities,
    projection.activeEntityId,
    false,
    'WALLET_CROSS_SOURCE_ROLE_UNAVAILABLE',
  );
  const sourceHub = requireFrameEntity(sourceEntities, hub.entityId, true, 'WALLET_CROSS_SOURCE_HUB_ROLE_UNAVAILABLE');
  const targetEntity = requireFrameEntity(
    targetEntities,
    target.entityId,
    false,
    'WALLET_CROSS_TARGET_ROLE_UNAVAILABLE',
  );
  const targetHub = requireFrameEntity(
    targetEntities,
    target.hubEntityId,
    true,
    'WALLET_CROSS_TARGET_HUB_ROLE_UNAVAILABLE',
  );
  const plan = marketMath.planSwapCommand({
    mode: 'cross',
    logicalTimestamp: projection.logicalTimestamp,
    logicalHeight: projection.height,
    routeValue: target.routeValue,
    giveTokenId: draft.giveTokenId,
    wantTokenId: draft.wantTokenId,
    ...dimensions,
    giveAmount: rawGive,
    priceTicks: prepared.priceTicks,
    maxFee: 0n,
    minNetReceive: prepared.effectiveWant,
    source: {
      entityId: sourceEntity.entityId,
      signerId: sourceEntity.signerId,
      hubEntityId: sourceHub.entityId,
      hubSignerId: sourceHub.signerId,
      jurisdiction: projection.sourceJurisdiction,
      entityRoleEvidence: { entityId: sourceEntity.entityId, isHub: false, source: 'committed-profile' },
      hubRoleEvidence: { entityId: sourceHub.entityId, isHub: true, source: 'committed-profile' },
      committedRoles: committedRoles(sourceEntities),
      account: readAccount(sourceFrame, sourceEntity.entityId, sourceHub.entityId),
    },
    target: {
      entityId: targetEntity.entityId,
      signerId: targetEntity.signerId,
      hubEntityId: targetHub.entityId,
      hubSignerId: targetHub.signerId,
      jurisdiction: target.jurisdiction,
      entityRoleEvidence: { entityId: targetEntity.entityId, isHub: false, source: 'committed-profile' },
      hubRoleEvidence: { entityId: targetHub.entityId, isHub: true, source: 'committed-profile' },
      committedRoles: committedRoles(targetEntities),
      account: readAccount(targetFrame, targetEntity.entityId, targetHub.entityId),
    },
    allowOpenTargetAccount: false,
    expiresInMs: 24 * 60 * 60 * 1_000,
  });
  if (plan.mode !== 'cross') throw new Error('WALLET_CROSS_PLAN_INVALID');
  return {
    draftKey: walletCrossMarketDraftKey(draft),
    routeValue: target.routeValue,
    orderId: plan.offerId,
    sourceJurisdictionLabel: projection.sourceJurisdictionLabel,
    targetJurisdictionLabel: target.jurisdictionLabel,
    sourceEntityLabel: sourceEntity.label,
    targetEntityLabel: targetEntity.label,
    sourceHubLabel: sourceHub.label,
    targetHubLabel: targetHub.label,
    giveAssetLabel: giveToken.symbol,
    wantAssetLabel: wantToken.symbol,
    giveAmountLabel: paymentMath.formatTokenAmount(draft.giveTokenId, plan.preparedOrder.effectiveGive),
    wantAmountLabel: paymentMath.formatTokenAmount(draft.wantTokenId, plan.preparedOrder.effectiveWant),
    plan,
  };
};

export const buildWalletCrossMarketCancelInput = (
  projection: WalletMarketProjection,
  orderId: string,
): RuntimeInput => {
  const route = projection.crossRoutes.find(candidate => candidate.orderId === orderId);
  if (!route) throw new Error('WALLET_CROSS_ROUTE_UNKNOWN');
  if (['settled', 'cancelled', 'expired'].includes(route.status)) throw new Error('WALLET_CROSS_ROUTE_TERMINAL');
  return {
    runtimeTxs: [],
    entityInputs: [
      {
        entityId: projection.activeEntityId,
        signerId: projection.signerId,
        entityTxs: [{ type: 'requestCrossJurisdictionClear', data: { orderId, cancelRemainder: true } }],
      },
    ],
  };
};
