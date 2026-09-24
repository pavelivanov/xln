import { describe, expect, test } from 'bun:test';

import { PersistentAccountStateMap } from '../../../account/state/persistent-state-map';
import {
  capturePriorSwapCancelScopes,
  classifyCommittedSwapCancels,
} from '../../../entity/tx/handlers/account/committed-input';
import type { AccountTx, SwapOffer } from '../../../types/account';
import type { CrossJurisdictionSwapRoute } from '../../../types/cross-jurisdiction';
import { makeAccount, putTestAccountSwapOffer } from '../../helpers/cross-j';

const offer = (
  offerId: string,
  crossJurisdiction?: CrossJurisdictionSwapRoute,
): SwapOffer => ({
  offerId,
  giveTokenId: 1,
  giveTokenDecimals: 18,
  giveAmount: 1n,
  wantTokenId: 2,
  wantTokenDecimals: 18,
  wantAmount: 1n,
  maxFee: 0n,
  minNetReceive: 1n,
  priceTicks: 1n,
  makerIsLeft: true,
  createdHeight: 1,
  quantizedGive: 1n,
  quantizedWant: 1n,
  ...(crossJurisdiction ? { crossJurisdiction } : {}),
});

const cancel = (offerId: string): AccountTx => ({
  type: 'swap_cancel_request',
  data: { offerId },
});

const crossJScopeState = (
  orderId?: string,
): Parameters<typeof capturePriorSwapCancelScopes>[1] => ({
  entityId: 'alice',
  crossJurisdictionSwaps: new Map(orderId
    ? [[orderId, {
        orderId,
        source: { entityId: 'alice', counterpartyEntityId: 'hub' },
      } as CrossJurisdictionSwapRoute]]
    : []),
});

describe('committed cross-j swap cancellation scope', () => {
  test('uses the exact parent route when this Account envelope lacks the resting offer', () => {
    const account = makeAccount('alice', 'hub');
    const offerId = 'cross-j-resting-cancel';
    const accountTx = cancel(offerId);
    putTestAccountSwapOffer(account, offer(
      offerId,
      { status: 'resting' } as CrossJurisdictionSwapRoute,
    ));

    const offers = account.state.swapOffers;
    if (!(offers instanceof PersistentAccountStateMap)) {
      throw new Error('TEST_ACCOUNT_SWAP_OFFERS_NOT_PERSISTENT');
    }
    account.state.swapOffers = offers.removed(offerId);
    const priorScope = capturePriorSwapCancelScopes(
      account,
      crossJScopeState(offerId),
      'hub',
      [accountTx],
    );

    expect(account.state.swapOffers.has(offerId)).toBe(false);
    expect(priorScope.get(offerId)).toBe(false);
    expect(classifyCommittedSwapCancels(
      account,
      crossJScopeState(offerId),
      'hub',
      [accountTx],
      priorScope,
    )).toEqual([false]);
  });

  test('preserves same-j scope and still rejects a request with no scope evidence', () => {
    const account = makeAccount('alice', 'hub');
    const sameJurisdictionId = 'same-j-resting-cancel';
    const sameJurisdictionCancel = cancel(sameJurisdictionId);
    putTestAccountSwapOffer(account, offer(sameJurisdictionId));
    const priorScope = capturePriorSwapCancelScopes(
      account,
      crossJScopeState(),
      'hub',
      [sameJurisdictionCancel],
    );

    expect(priorScope.get(sameJurisdictionId)).toBe(true);
    expect(classifyCommittedSwapCancels(
      account,
      crossJScopeState(),
      'hub',
      [sameJurisdictionCancel],
      priorScope,
    )).toEqual([true]);
    expect(() => classifyCommittedSwapCancels(
      account,
      crossJScopeState(),
      'hub',
      [cancel('missing-offer')],
      new Map(),
    )).toThrow('ACCOUNT_SWAP_CANCEL_SCOPE_UNRESOLVED:missing-offer');
  });
});
