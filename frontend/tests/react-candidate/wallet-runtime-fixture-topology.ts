import { deriveSwapNetAuthorization } from '../../../core/account/swap/swap-net-authorization';
import {
  DEFAULT_SPREAD_DISTRIBUTION,
  getStaticSwapTokenDimensions,
} from '../../../core/orderbook';
import type { EntityTx } from '../../../core/types/entity-tx';

const profileTx = (
  entityId: string,
  name: string,
  bio: string,
): EntityTx => ({
  type: 'profile-update',
  data: {
    profile: {
      entityId,
      name,
      avatar: '',
      bio,
      website: 'https://xln.finance',
    },
  },
});

export const buildWalletFixtureProfileTx = (entityId: string): EntityTx => profileTx(
  entityId,
  'Browser Alice',
  'Committed by the isolated candidate Runtime.',
);

export const buildWalletFixtureHubTxs = (entityId: string): EntityTx[] => [
  profileTx(
    entityId,
    'Browser Hub',
    'Counterparty committed by the isolated candidate Runtime.',
  ),
  {
    type: 'setHubConfig',
    data: {
      matchingStrategy: 'amount',
      policyVersion: 1,
      routingFeePPM: 1,
      baseFee: 0n,
      swapTakerFeeBps: 1,
      rebalanceLiquidityFeeBps: 0n,
      rebalanceTimeoutMs: 60_000,
    },
  },
  {
    type: 'initOrderbookExt',
    data: {
      name: 'Browser Hub',
      spreadDistribution: DEFAULT_SPREAD_DISTRIBUTION,
      referenceTokenId: 1,
      usdQuoteAuthorityEntityId: entityId,
      minTradeSize: 0n,
      supportedPairs: ['1/2'],
    },
  },
];

export const buildWalletFixtureOrderTx = (hubEntityId: string): EntityTx => {
  const wantAmount = 10_000_000_000_000_000n;
  return {
    type: 'placeSwapOffer',
    data: {
      counterpartyEntityId: hubEntityId,
      offerId: 'browser-bid-001',
      giveTokenId: 1,
      giveAmount: 25_000_000n,
      wantTokenId: 2,
      ...getStaticSwapTokenDimensions(1, 2),
      wantAmount,
      ...deriveSwapNetAuthorization(wantAmount, 1),
    },
  };
};
